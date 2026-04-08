using Dapper;
using HKServer.Models;
using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.IO;
using System.Data;

namespace HKServer.Services;

public class AutoSyncService
{
    private readonly DatabaseService _db;
    
    // State
    public bool IsRunning { get; private set; }
    public int TotalFiles { get; private set; }
    public int ProcessedFiles { get; private set; }
    public int MatchedFiles { get; private set; }
    public int UnmatchedFiles { get; private set; }
    public int MovedFiles { get; private set; }
    public int FailedFiles { get; private set; }
    public string CurrentFile { get; private set; } = "";
    
    // Memory Cache for fast matching
    private List<CachedRecord> _recordsCache = new();

    private class CachedRecord
    {
        public int Id { get; set; }
        public string NormalizedName { get; set; } = "";
        public string StrictName { get; set; } = ""; // المطابقة الحرفية
        public string NID { get; set; } = "";
        public string OriginalName { get; set; } = "";
        public string TableName { get; set; } = "Returns"; // "Returns"
    }

    // Report Data
    public List<string> UnmatchedList { get; private set; } = new();
    public List<SyncMatchInfo> MatchedList { get; private set; } = new();

    public class SyncMatchInfo
    {
        [System.Text.Json.Serialization.JsonPropertyName("fileName")]
        public string FileName { get; set; } = "";
        
        [System.Text.Json.Serialization.JsonPropertyName("linkedName")]
        public string LinkedName { get; set; } = "";
        
        [System.Text.Json.Serialization.JsonPropertyName("linkedNID")]
        public string LinkedNID { get; set; } = "";
    }
    
    public AutoSyncService(DatabaseService db)
    {
        _db = db;
    }

    public Task StartSync(string sourcePath)
    {
        if (IsRunning) return Task.CompletedTask;
        
        IsRunning = true;
        ResetStats();

        _ = Task.Run(async () =>
        {
            try
            {
                sourcePath = sourcePath.Trim();
                // Ensure absolute path
                if (!Path.IsPathRooted(sourcePath)) {
                    sourcePath = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, sourcePath));
                }

                if (!Directory.Exists(sourcePath))
                {
                    Console.WriteLine($"[SYNC ERROR] Source path does not exist: {sourcePath}");
                    IsRunning = false;
                    CurrentFile = "المسار غير موجود: " + sourcePath;
                    return;
                }

                // 1. Build Memory Cache for matching
                CurrentFile = "جاري تجهيز البيانات...";
                await BuildCache();

                Console.WriteLine($"[SYNC START] Scanning folder: {sourcePath}");

                var allowedExtensions = new[] { ".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif", ".docx", ".doc", ".xlsx", ".xls", ".txt", ".csv", ".zip", ".rar" };
                var allFiles = Directory.GetFiles(sourcePath, "*.*", SearchOption.AllDirectories);
                var files = allFiles.Where(f => allowedExtensions.Contains(Path.GetExtension(f).ToLower())).ToArray();
                
                TotalFiles = files.Length;

                if (TotalFiles == 0)
                {
                    Console.WriteLine($"[SYNC] No supported files found in {sourcePath} (Total ignored: {allFiles.Length})");
                    IsRunning = false;
                    CurrentFile = allFiles.Length > 0 ? "لا توجد ملفات مدعومة" : "المجلد فارغ";
                    return;
                }

                // Load Server Config for Archive Path
                var config = DatabaseService.LoadServerConfig();
                var archivePath = config.ArchivePath;

                using var conn = _db.GetConnection();
                conn.Open();

                foreach (var filePath in files)
                {
                    ProcessedFiles++;
                    CurrentFile = Path.GetFileName(filePath);
                    
                    try
                    {
                        await ProcessFile(conn, filePath, archivePath);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error processing file {filePath}: {ex.Message}");
                        FailedFiles++;
                    }
                }
                // 4. Final Diagnostics Log
                try {
                    var logPath = Path.Combine(archivePath, "sync_diagnosis.log");
                    var log = new List<string> {
                        $"Sync Run: {DateTime.Now}",
                        $"Total Files: {TotalFiles}",
                        $"Matched: {MatchedFiles}",
                        $"Unmatched: {UnmatchedFiles}",
                        $"Cache Size: {_recordsCache.Count}",
                        "--- SAMPLES FROM CACHE (First 10) ---"
                    };
                    log.AddRange(_recordsCache.Take(10).Select(r => $"ID: {r.Id} | StrictName: '{r.StrictName}' | Table: {r.TableName}"));
                    
                    log.Add("--- UNMATCHED FILES (Up to 100) ---");
                    log.AddRange(UnmatchedList.Take(100));
                    
                    File.WriteAllLines(logPath, log);
                } catch {}
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Sync Fatal Error: {ex.Message}");
            }
            finally
            {
                IsRunning = false;
                _recordsCache.Clear(); // Free memory
                CurrentFile = "مكتمل";
            }
        });
        
        return Task.CompletedTask;
    }

    private async Task BuildCache()
    {
        _recordsCache.Clear();
        using var conn = _db.GetConnection();
        
        // 1. Load from Main Returns
        var dataReturns = await conn.QueryAsync<dynamic>("SELECT Id, RawData FROM Returns WHERE IsDeleted = 0");
        int returnsCount = 0;
        foreach (var r in dataReturns)
        {
            string raw = (string)r.RawData;
            string name = DatabaseService.ExtractName(raw);
            _recordsCache.Add(new CachedRecord
            {
                Id = (int)r.Id,
                OriginalName = name,
                NormalizedName = DatabaseService.CleanArabic(name),
                StrictName = DatabaseService.CleanArabic(name, true),
                NID = DatabaseService.ExtractNID(raw),
                TableName = "Returns"
            });
            returnsCount++;
        }
        Console.WriteLine($"[SYNC] Loaded {returnsCount} records from Returns.");

        // 2. Load from Salary Returns
        int salaryCount = 0;
        try {
            var dataSalaries = await conn.QueryAsync<dynamic>("SELECT Id, RawData FROM SalaryReturns WHERE IsDeleted = 0");
            foreach (var r in dataSalaries)
            {
                string raw = (string)r.RawData;
                string name = DatabaseService.ExtractName(raw);
                _recordsCache.Add(new CachedRecord
                {
                    Id = (int)r.Id,
                    OriginalName = name,
                    NormalizedName = DatabaseService.CleanArabic(name),
                    StrictName = DatabaseService.CleanArabic(name, true),
                    NID = DatabaseService.ExtractNID(raw),
                    TableName = "SalaryReturns"
                });
                salaryCount++;
            }
            Console.WriteLine($"[SYNC] Loaded {salaryCount} records from SalaryReturns.");
        } catch (Exception ex) {
            Console.WriteLine($"[SYNC] Error loading salaries into cache: {ex.Message}");
        }

        // 3. Load from Full Returns (البحث الشامل)
        int fullCount = 0;
        try {
            var dataFull = await conn.QueryAsync<dynamic>("SELECT ID as Id, RawData FROM FullReturns");
            foreach (var r in dataFull)
            {
                string raw = (string)r.RawData;
                string name = DatabaseService.ExtractName(raw);
                _recordsCache.Add(new CachedRecord
                {
                    Id = (int)r.Id,
                    OriginalName = name,
                    NormalizedName = DatabaseService.CleanArabic(name),
                    StrictName = DatabaseService.CleanArabic(name, true),
                    NID = DatabaseService.ExtractNID(raw),
                    TableName = "FullReturns"
                });
                fullCount++;
            }
            Console.WriteLine($"[SYNC] Loaded {fullCount} records from FullReturns.");
        } catch (Exception ex) {
            Console.WriteLine($"[SYNC] Error loading full returns into cache: {ex.Message}");
        }

        Console.WriteLine($"[SYNC] Cache built successfully. Total records: {_recordsCache.Count}");
    }

    private void ResetStats()
    {
        TotalFiles = 0;
        ProcessedFiles = 0;
        MatchedFiles = 0;
        UnmatchedFiles = 0;
        MovedFiles = 0;
        FailedFiles = 0;
        UnmatchedList.Clear();
        MatchedList.Clear();
        CurrentFile = "جاري البدء...";
    }

    private async Task ProcessFile(System.Data.IDbConnection conn, string filePath, string archivePath)
    {
        var fileName = Path.GetFileNameWithoutExtension(filePath);
        var dirName = Path.GetFileName(Path.GetDirectoryName(filePath) ?? ""); // IMPORTANT: Get identity from parent folder if needed
        var ext = Path.GetExtension(filePath);
        
        // Load Current Config for Linking Mode
        var config = DatabaseService.LoadServerConfig();
        var linkMode = config.AttachmentLinkMode ?? "Both"; // Name, NID, Both

        // 1. Detect NID in filename OR Folder name (14 digits)
        var combinedText = fileName + " _ " + dirName;
        var nidMatch = Regex.Match(combinedText, @"\d{14}");
        string? foundNid = nidMatch.Success ? nidMatch.Value : null;

        // 2. Identify the effective source name (Filename or Folder)
        string effectiveRawName = fileName;
        var fuzzyNameCheck = DatabaseService.CleanArabic(fileName);
        
        // Strategy: If filename is short/generic (like "image", "doc", "scan"), use folder name
        if (fuzzyNameCheck.Length < 3 || fuzzyNameCheck.Contains("image") || fuzzyNameCheck.Contains("scan") || fuzzyNameCheck.Contains("IMG")) {
             var fuzzyFolder = DatabaseService.CleanArabic(dirName);
             if (fuzzyFolder.Length > 2) effectiveRawName = dirName;
        }

        // Remove NID digits from effectiveRawName if they exist 
        if (!string.IsNullOrEmpty(foundNid)) {
            effectiveRawName = effectiveRawName.Replace(foundNid, "").Trim();
        }

        List<(int Id, string Table)> targetRecords = new();
        string linkedName = "Unknown";
        string linkedNID = foundNid ?? "";

        // SMART MATCHING in Memory
        
        // Tactic A: Match by NID
        if (linkMode != "Name" && !string.IsNullOrEmpty(foundNid))
        {
            var matches = _recordsCache.Where(r => r.NID == foundNid).ToList();
            if (matches.Any())
            {
                foreach(var m in matches)
                {
                    targetRecords.Add((m.Id, m.TableName));
                    if (linkedName == "Unknown" && m.OriginalName != "Unknown") linkedName = m.OriginalName;
                    if (!string.IsNullOrEmpty(m.NID)) linkedNID = m.NID;
                }
            }
        }

        // Tactic B: Match by Name — الربط بجميع السجلات المطابقة تماماً (حرفياً)
        if (linkMode != "NID" && !string.IsNullOrWhiteSpace(effectiveRawName))
        {
            var strictCleanName = DatabaseService.CleanArabic(effectiveRawName, true);
            var matches = _recordsCache.Where(r => r.StrictName == strictCleanName).ToList();

            if (matches.Any())
            {
                // فلتر: استبعد السجلات المضافة بالفعل عبر NID لعدم التكرار في targetRecords
                var alreadyLinked = targetRecords.Select(t => t.Id).ToHashSet();
                var newMatches = matches.Where(m => !alreadyLinked.Contains(m.Id)).ToList();

                if (newMatches.Count > 0)
                {
                    // اسم مطابق حرفياً -> ربط بجميع السجلات المطابقة (سواء في الحوافز أو المرتبات)
                    foreach (var m in newMatches)
                    {
                        targetRecords.Add((m.Id, m.TableName));
                        if (linkedName == "Unknown" && m.OriginalName != "Unknown") linkedName = m.OriginalName;
                        if (!string.IsNullOrEmpty(m.NID)) linkedNID = m.NID;
                    }
                    Console.WriteLine($"[SYNC] MATCH (Name): '{strictCleanName}' matched {newMatches.Count} records — file: {Path.GetFileName(filePath)}");
                }
            }
        }

        if (targetRecords.Count > 0)
        {
            MatchedFiles++;
            
            foreach (var rec in targetRecords.Distinct())
            {
                try {
                    // 1. Organize Target Archive Path (MATCHING ENDPOINTS LOGIC)
                    string cleanName = DatabaseService.CleanFileName(string.IsNullOrEmpty(linkedName) || linkedName == "Unknown" ? "Record" : linkedName);
                    string folderPrefix = !string.IsNullOrEmpty(linkedNID) ? linkedNID : rec.Id.ToString();
                    
                    string folderNameWithId = "";
                    string targetSubFolder = "";
                    
                    if (rec.Table == "SalaryReturns") {
                        folderNameWithId = $"salary_{folderPrefix}_{cleanName}";
                        targetSubFolder = folderNameWithId;
                    } else if (rec.Table == "FullReturns") {
                        folderNameWithId = $"{rec.Id}_{cleanName}";
                        targetSubFolder = Path.Combine("FullReturns", folderNameWithId);
                    } else {
                        // Main Returns
                        folderNameWithId = $"{folderPrefix}_{cleanName}";
                        targetSubFolder = folderNameWithId;
                    }
                    
                    string targetDir = Path.Combine(archivePath, targetSubFolder);
                    
                    if (!Directory.Exists(targetDir)) Directory.CreateDirectory(targetDir);
                    
                    string originalFileName = Path.GetFileName(filePath);
                    string targetFilePath = Path.Combine(targetDir, originalFileName);
                    
                    // 2. Perform Copy (Safe)
                    if (filePath.ToLower() != targetFilePath.ToLower()) {
                         File.Copy(filePath, targetFilePath, true);
                         MovedFiles++;
                    }

                    // 3. Database Link (Using Relative Path)
                    // Important: dbFilename should be relative to the expected base in each View Attachment endpoint
                    string dbFilename = "";
                    if (rec.Table == "FullReturns") {
                        dbFilename = Path.Combine(folderNameWithId, originalFileName);
                    } else {
                        dbFilename = Path.Combine(folderNameWithId, originalFileName);
                    }
                    
                    string targetTable = rec.Table + "Images"; // Dynamic table linking
                    
                    // Check if the link already exists to prevent duplicates
                    var alreadyExists = await conn.ExecuteScalarAsync<int>(
                        $"SELECT COUNT(1) FROM {targetTable} WHERE ReturnId = @ReturnId AND Filename = @Filename",
                        new { ReturnId = rec.Id, Filename = dbFilename }) > 0;

                    if (!alreadyExists)
                    {
                        await conn.ExecuteAsync(
                            $"INSERT INTO {targetTable} (ReturnId, Filename, CreatedAt) VALUES (@ReturnId, @Filename, @CreatedAt)",
                            new { ReturnId = rec.Id, Filename = dbFilename, CreatedAt = DateTime.Now });
                    }
                } catch (Exception ex) {
                    Console.WriteLine($"[SYNC COPY ERROR] Failed to copy/link {filePath}: {ex.Message}");
                    FailedFiles++;
                }
            }

            MatchedList.Add(new SyncMatchInfo 
            { 
                FileName = Path.GetFileName(filePath), 
                LinkedName = linkedName, 
                LinkedNID = linkedNID 
            });
        }
        else
        {
            UnmatchedFiles++;
            var strictCleanName = DatabaseService.CleanArabic(effectiveRawName, true);
            UnmatchedList.Add($"{Path.GetFileName(filePath)} (Detected: '{strictCleanName}')");
        }
    }

}
