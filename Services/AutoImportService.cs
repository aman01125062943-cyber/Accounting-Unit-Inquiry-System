using System.Data;
using System.Text.Json;
using System.Text.Encodings.Web;
using System.Text.Unicode;
using Dapper;
using ExcelDataReader;
using HKServer.Models;

namespace HKServer.Services;

public class AutoImportService : BackgroundService
{
    private readonly DatabaseService _db;
    private bool _isProcessing = false;

    public AutoImportService(DatabaseService db)
    {
        _db = db;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Register ExcelDataReader encoding provider
        System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var config = DatabaseService.LoadServerConfig();
                if (config.AutoImportEnabled && !_isProcessing)
                {
                    await ProcessAutoImportFolderAsync(config);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AutoImport] Error in loop: {ex.Message}");
            }

            try
            {
                await Task.Delay(5000, stoppingToken); // check every 5 seconds
            }
            catch (TaskCanceledException)
            {
                break;
            }
        }
    }

    private async Task ProcessAutoImportFolderAsync(ServerConfig config)
    {
        _isProcessing = true;
        try
        {
            var configPath = config.AutoImportPath;
            if (string.IsNullOrWhiteSpace(configPath)) return;

            var rootPath = configPath.EndsWith("استيراد_تلقائي", StringComparison.OrdinalIgnoreCase) || 
                           configPath.EndsWith("استيراد_تلقائي\\", StringComparison.OrdinalIgnoreCase) ||
                           configPath.EndsWith("استيراد_تلقائي/", StringComparison.OrdinalIgnoreCase)
                ? configPath
                : Path.Combine(configPath, "استيراد_تلقائي");

            if (!Directory.Exists(rootPath))
            {
                Directory.CreateDirectory(rootPath);
            }

            var incentivesPath = Path.Combine(rootPath, "حوافز");
            var salariesPath = Path.Combine(rootPath, "مرتبات");

            if (!Directory.Exists(incentivesPath)) Directory.CreateDirectory(incentivesPath);
            if (!Directory.Exists(salariesPath)) Directory.CreateDirectory(salariesPath);

            var incImportPath = Path.Combine(incentivesPath, "استيراد");
            var incSidadPath = Path.Combine(incentivesPath, "سداد");
            var salImportPath = Path.Combine(salariesPath, "استيراد");
            var salSidadPath = Path.Combine(salariesPath, "سداد");

            if (!Directory.Exists(incImportPath)) Directory.CreateDirectory(incImportPath);
            if (!Directory.Exists(incSidadPath)) Directory.CreateDirectory(incSidadPath);
            if (!Directory.Exists(salImportPath)) Directory.CreateDirectory(salImportPath);
            if (!Directory.Exists(salSidadPath)) Directory.CreateDirectory(salSidadPath);

            var extensions = new[] { "*.xlsx", "*.xls", "*.csv" };

            // 1. Process Incentive Imports (Taelia)
            await ProcessSpecificFolderAsync(incImportPath, extensions, isSalary: false, isPayment: false);
            // 2. Process Incentive Payments (Sidad)
            await ProcessSpecificFolderAsync(incSidadPath, extensions, isSalary: false, isPayment: true);

            // 3. Process Salary Imports (Taelia)
            await ProcessSpecificFolderAsync(salImportPath, extensions, isSalary: true, isPayment: false);
            // 4. Process Salary Payments (Sidad)
            await ProcessSpecificFolderAsync(salSidadPath, extensions, isSalary: true, isPayment: true);

            // Fallbacks: parent folders
            await ProcessFallbackFolderAsync(incentivesPath, extensions, isSalary: false);
            await ProcessFallbackFolderAsync(salariesPath, extensions, isSalary: true);

            // Legacy/Root scan (fallback)
            var rootFiles = extensions.SelectMany(ext => Directory.GetFiles(rootPath, ext)).ToList();
            if (rootFiles.Any())
            {
                var rootProcessed = Path.Combine(rootPath, "تمت_المعالجة");
                var rootFailed = Path.Combine(rootPath, "فشل_الاستيراد");
                if (!Directory.Exists(rootProcessed)) Directory.CreateDirectory(rootProcessed);
                if (!Directory.Exists(rootFailed)) Directory.CreateDirectory(rootFailed);
                
                foreach (var filePath in rootFiles)
                {
                    var fileName = Path.GetFileName(filePath);
                    try
                    {
                        var isSalary = fileName.Contains("مرتبات", StringComparison.OrdinalIgnoreCase) || 
                                       fileName.Contains("salary", StringComparison.OrdinalIgnoreCase);

                        var result = ReadFile(filePath);
                        if (result.Rows.Count > 0)
                        {
                            await ImportToDatabaseAsync(filePath, result.Headers, result.Rows, isSalary);
                            var targetPath = Path.Combine(rootProcessed, $"{DateTime.Now:yyyyMMddHHmmss}_{fileName}");
                            File.Move(filePath, targetPath);
                        }
                    }
                    catch (Exception ex)
                    {
                        try
                        {
                            var targetPath = Path.Combine(rootFailed, $"{DateTime.Now:yyyyMMddHHmmss}_{fileName}");
                            File.Move(filePath, targetPath);
                            File.WriteAllText(targetPath + ".error.txt", ex.ToString());
                        }
                        catch {}
                    }
                }
            }
        }
        finally
        {
            _isProcessing = false;
        }
    }

    private class LocalMatchRecord
    {
        public long Id { get; set; }
        public string Name { get; set; } = "";
        public string NationalId { get; set; } = "";
        public string BatchCode { get; set; } = "";
        public double Amount { get; set; }
    }

    private static string GetArchiveSubFolder(string rootArchiveFolder)
    {
        var now = DateTime.Now;
        string yearStr = now.ToString("yyyy");
        string monthStr = now.ToString("M"); // 7 instead of 07
        string dayStr = now.ToString("dd") + "_" + GetArabicDayOfWeek(now.DayOfWeek);

        string targetPath = Path.Combine(rootArchiveFolder, yearStr, monthStr, dayStr);
        return targetPath;
    }

    private async Task ProcessSpecificFolderAsync(string folderPath, string[] extensions, bool isSalary, bool isPayment)
    {
        var files = extensions.SelectMany(ext => Directory.GetFiles(folderPath, ext)).ToList();
        if (!files.Any()) return;

        var processedFolder = Path.Combine(folderPath, "تمت_المعالجة");
        var failedFolder = Path.Combine(folderPath, "فشل_الاستيراد");

        foreach (var filePath in files)
        {
            var fileName = Path.GetFileName(filePath);
            Console.WriteLine($"[AutoImport] Processing folder {Path.GetFileName(folderPath)} file: {fileName} (IsPayment: {isPayment})");

            try
            {
                var result = ReadFile(filePath);
                int recordCount = result.Rows.Count;
                if (recordCount > 0)
                {
                    if (isPayment)
                    {
                        await ProcessPaymentDatabaseUpdateAsync(filePath, result.Headers, result.Rows, isSalary, folderPath);
                    }
                    else
                    {
                        await ImportToDatabaseAsync(filePath, result.Headers, result.Rows, isSalary);
                    }
                    
                    var targetSubFolder = GetArchiveSubFolder(processedFolder);
                    if (!Directory.Exists(targetSubFolder)) Directory.CreateDirectory(targetSubFolder);

                    string timeStr = DateTime.Now.ToString("HH-mm-ss");
                    string newFileName = $"{timeStr}_عدد_{recordCount}_{fileName}";
                    var targetPath = Path.Combine(targetSubFolder, newFileName);

                    File.Move(filePath, targetPath);
                    Console.WriteLine($"[AutoImport] Successfully processed and moved to archive: {newFileName}");
                }
                else
                {
                    throw new Exception("الملف فارغ أو لا يحتوي على صفوف بيانات.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AutoImport] Failed to process file {fileName}: {ex.Message}");
                try
                {
                    var targetSubFolder = GetArchiveSubFolder(failedFolder);
                    if (!Directory.Exists(targetSubFolder)) Directory.CreateDirectory(targetSubFolder);

                    string timeStr = DateTime.Now.ToString("HH-mm-ss");
                    string errorFileName = $"{timeStr}_فشل_{fileName}";
                    var targetPath = Path.Combine(targetSubFolder, errorFileName);

                    File.Move(filePath, targetPath);
                    File.WriteAllText(targetPath + ".error.txt", ex.ToString());
                }
                catch {}
            }
        }
    }

    private async Task ProcessFallbackFolderAsync(string folderPath, string[] extensions, bool isSalary)
    {
        var files = extensions.SelectMany(ext => Directory.GetFiles(folderPath, ext)).ToList();
        if (!files.Any()) return;

        var processedFolder = Path.Combine(folderPath, "تمت_المعالجة");
        var failedFolder = Path.Combine(folderPath, "فشل_الاستيراد");

        foreach (var filePath in files)
        {
            var fileName = Path.GetFileName(filePath);
            bool isPayment = fileName.Contains("سداد", StringComparison.OrdinalIgnoreCase) || 
                             fileName.Contains("تسوية", StringComparison.OrdinalIgnoreCase) ||
                             fileName.Contains("sidad", StringComparison.OrdinalIgnoreCase) ||
                             fileName.Contains("settlement", StringComparison.OrdinalIgnoreCase);

            try
            {
                var result = ReadFile(filePath);
                int recordCount = result.Rows.Count;
                if (recordCount > 0)
                {
                    if (isPayment)
                    {
                        await ProcessPaymentDatabaseUpdateAsync(filePath, result.Headers, result.Rows, isSalary, folderPath);
                    }
                    else
                    {
                        await ImportToDatabaseAsync(filePath, result.Headers, result.Rows, isSalary);
                    }

                    var targetSubFolder = GetArchiveSubFolder(processedFolder);
                    if (!Directory.Exists(targetSubFolder)) Directory.CreateDirectory(targetSubFolder);

                    string timeStr = DateTime.Now.ToString("HH-mm-ss");
                    string newFileName = $"{timeStr}_عدد_{recordCount}_{fileName}";
                    var targetPath = Path.Combine(targetSubFolder, newFileName);

                    File.Move(filePath, targetPath);
                }
            }
            catch (Exception ex)
            {
                try
                {
                    var targetSubFolder = GetArchiveSubFolder(failedFolder);
                    if (!Directory.Exists(targetSubFolder)) Directory.CreateDirectory(targetSubFolder);

                    string timeStr = DateTime.Now.ToString("HH-mm-ss");
                    string errorFileName = $"{timeStr}_فشل_{fileName}";
                    var targetPath = Path.Combine(targetSubFolder, errorFileName);

                    File.Move(filePath, targetPath);
                    File.WriteAllText(targetPath + ".error.txt", ex.ToString());
                }
                catch {}
            }
        }
    }

    private static string GetArabicDayOfWeek(DayOfWeek day)
    {
        return day switch
        {
            DayOfWeek.Sunday => "الأحد",
            DayOfWeek.Monday => "الاثنين",
            DayOfWeek.Tuesday => "الثلاثاء",
            DayOfWeek.Wednesday => "الأربعاء",
            DayOfWeek.Thursday => "الخميس",
            DayOfWeek.Friday => "الجمعة",
            DayOfWeek.Saturday => "السبت",
            _ => ""
        };
    }

    private static void WriteCsvFile(string outputPath, List<string> headers, List<Dictionary<string, object>> rows)
    {
        using var writer = new StreamWriter(outputPath, false, System.Text.Encoding.UTF8);
        writer.Write('\uFEFF'); // UTF-8 BOM

        var csvHeaders = new List<string>(headers);
        if (!csvHeaders.Contains("سبب الفشل")) csvHeaders.Add("سبب الفشل");

        writer.WriteLine(string.Join(",", csvHeaders.Select(h => $"\"{h.Replace("\"", "\"\"")}\"")));

        foreach (var row in rows)
        {
            var values = csvHeaders.Select(h => {
                if (row.TryGetValue(h, out var val) && val != null)
                    return $"\"{val.ToString().Replace("\"", "\"\"")}\"";
                return "\"\"";
            });
            writer.WriteLine(string.Join(",", values));
        }
    }

    private async Task ProcessPaymentDatabaseUpdateAsync(string filePath, List<string> headers, List<Dictionary<string, object>> rows, bool isSalary, string folderPath)
    {
        using var conn = await _db.GetOpenConnectionAsync();
        using var trans = conn.BeginTransaction();

        try
        {
            var jsonOptions = new JsonSerializerOptions
            {
                Encoder = JavaScriptEncoder.Create(UnicodeRanges.All)
            };

            // Fetch all database records for matching
            var tableName = isSalary ? "SalaryReturns" : "Returns";
            string sqlFetch = $"SELECT Id, ReturnCode, RawData FROM {tableName} WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0";
            var dbRows = await conn.QueryAsync<dynamic>(sqlFetch, null, trans);

            var dbRecords = new List<LocalMatchRecord>();
            foreach (var r in dbRows)
            {
                var rawData = r.RawData?.ToString() ?? "{}";
                double dbAmount = 0;
                try
                {
                    using var doc = JsonDocument.Parse(rawData);
                    var root = doc.RootElement;
                    string[] amtKeys = new[] { "قيمة العملية", "صافي المبلغ", "المبلغ", "الإجمالي", "Amount", "ProcessValue", "Transaction Amount" };
                    foreach (var k in amtKeys)
                    {
                        JsonElement p;
                        if (root.TryGetProperty(k, out p))
                        {
                            string amountVal = p.ValueKind == JsonValueKind.String ? (p.GetString() ?? "") : p.GetRawText();
                            if (!string.IsNullOrEmpty(amountVal))
                            {
                                amountVal = amountVal.Replace(",", "").Trim();
                                if (double.TryParse(amountVal, out var parsedAmt))
                                {
                                    dbAmount = parsedAmt;
                                    break;
                                }
                            }
                        }
                    }
                }
                catch { }

                // Extract BatchCode from RawData (Instruction Identification) first,
                // fallback to ReturnCode column (which may store Batch ID)
                string extractedFileCode = DatabaseService.ExtractInstructionId(rawData);
                string batchCode = !string.IsNullOrWhiteSpace(extractedFileCode)
                     ? extractedFileCode
                     : (r.ReturnCode?.ToString() ?? "");

                var record = new LocalMatchRecord
                {
                    Id = r.Id,
                    Name = DatabaseService.ExtractName(rawData),
                    NationalId = DatabaseService.ExtractNID(rawData),
                    BatchCode = batchCode,
                    Amount = dbAmount
                };
                dbRecords.Add(record);
            }

            int matchedCount = 0;
            var failureDetails = new List<Dictionary<string, object>>();
            var failedDetailsList = new List<object>();

            string updateSql = $@"UPDATE {tableName}
                               SET [رقم تسوية السداد] = @SettlementNo,
                                   UpdatedAt = @UpdatedAt,
                                   RawData = json_set(COALESCE(NULLIF(RawData, ''), '{{}}'),
                                       '$.""رقم الحساب بعد التعديل""', @NewAccount,
                                       '$.""البنك بعد التعديل""', @NewBank,
                                       '$.""رقم تسوية السداد""', @SettlementNo,
                                       '$.""تاريخ تسوية السداد""', @SettlementDate,
                                       '$.""تاريخ اعتماد التعديل / تاريخ السداد""', @SettlementDate,
                                       '$.""حالة التسوية""', 'تم التسوية')
                               WHERE Id = @DbRecordId";

            string GetExcelVal(Dictionary<string, object> dict, params string[] keys)
            {
                foreach (var k in keys)
                {
                    if (dict.TryGetValue(k, out var val) && val != null) return val.ToString().Trim();

                    var keyLower = k.ToLower();
                    foreach (var pair in dict)
                    {
                        if (pair.Key.ToLower() == keyLower && pair.Value != null) return pair.Value.ToString().Trim();
                    }
                }
                return "";
            }

            double ParseDouble(string val)
            {
                if (string.IsNullOrEmpty(val)) return 0;
                val = val.Replace(",", "").Trim();
                if (double.TryParse(val, out var res)) return res;
                return 0;
            }

            for (int i = 0; i < rows.Count; i++)
            {
                var excelRow = rows[i];
                int excelRowIndex = i + 2; // Row 1 is headers

                string excelName = GetExcelVal(excelRow, "الاسم", "الاســــم", "الاسم رباعي", "اسم المستفيد", "Name", "Creditor Name", "CREDITOR_NAME");
                string excelNid = GetExcelVal(excelRow, "الرقم القومي", "الرقم القومى", "رقم القومي", "رقم القومى", "NID", "NationalId", "Creditor National ID", "CreditorNationalID");
                string excelBatchCode = GetExcelVal(excelRow, "كود الملف", "كود الملف المعلي", "Instruction ID", "InstructionID", "BatchCode", "FileCode");
                string excelAmountStr = GetExcelVal(excelRow, "قيمة العملية", "المبلغ", "Amount", "Transaction Amount", "TransactionAmount");
                double excelAmount = ParseDouble(excelAmountStr);

                string newAccount = GetExcelVal(excelRow, "رقم الحساب الجديد", "رقم الحساب بعد التعديل", "رقم الحساب المعدل", "الحساب الجديد", "NewAccount", "Creditor Account Number", "CreditorAccountNumber");
                string newBank = GetExcelVal(excelRow, "اسم البنك الجديد", "البنك الجديد", "البنك بعد التعديل", "NewBank", "Creditor Bank", "CreditorBank");
                string settlementNo = GetExcelVal(excelRow, "رقم تسوية السداد", "رقم التسوية", "تسوية السداد", "SettlementNo");
                string settlementDate = GetExcelVal(excelRow, "تاريخ السداد", "تاريخ تسوية السداد", "تاريخ التسوية", "SettlementDate");

                if (string.IsNullOrEmpty(settlementDate))
                {
                    settlementDate = DateTime.Now.ToString("yyyy-MM-dd");
                }

                string cleanExcelName = DatabaseService.CleanArabic(excelName);
                string cleanExcelNid = System.Text.RegularExpressions.Regex.Replace(excelNid, @"[^\d]", "");
                string cleanExcelBatch = excelBatchCode.Trim();

                LocalMatchRecord match = null;
                string failReason = "";

                // Find all matches that satisfy the 3 strict criteria:
                // 1. BatchCode == excelBatchCode
                // 2. CleanArabic(Name) == cleanExcelName
                // 3. Amount == excelAmount
                var candidates = dbRecords.Where(d =>
                    d.BatchCode.Trim().Equals(cleanExcelBatch, StringComparison.OrdinalIgnoreCase) &&
                    DatabaseService.CleanArabic(d.Name ?? "") == cleanExcelName &&
                    Math.Abs(d.Amount - excelAmount) < 0.01
                ).ToList();

                if (candidates.Any())
                {
                    if (!string.IsNullOrEmpty(cleanExcelNid))
                    {
                        // Match with NID
                        match = candidates.FirstOrDefault(c => c.NationalId == cleanExcelNid);
                        if (match == null)
                        {
                            failReason = "الرقم القومي غير متطابق مع السجلات المكتشفة بالاسم والمبلغ وكود الملف";
                        }
                    }
                    else
                    {
                        // NID not provided in excel: match the first candidate
                        match = candidates.FirstOrDefault();
                    }
                }
                else
                {
                    failReason = "لم يتم العثور على سجل معلق يطابق كود الملف والاسم وقيمة المبلغ معاً";
                }

                if (match != null)
                {
                    await conn.ExecuteAsync(updateSql, new
                    {
                        NewAccount = newAccount,
                        NewBank = newBank,
                        SettlementNo = settlementNo,
                        SettlementDate = settlementDate,
                        UpdatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff"),
                        DbRecordId = match.Id
                    }, trans);

                    matchedCount++;
                    dbRecords.Remove(match); // Prevent duplicate match
                }
                else
                {
                    var dictCopy = new Dictionary<string, object>(excelRow);
                    dictCopy["سبب الفشل"] = failReason;
                    failureDetails.Add(dictCopy);

                    failedDetailsList.Add(new
                    {
                        RowIndex = excelRowIndex,
                        InstructionId = excelBatchCode,
                        CreditorName = excelName,
                        CreditorNationalId = excelNid,
                        TransactionAmount = excelAmountStr,
                        Reason = failReason
                    });
                }
            }

            // Save report log to database table AutoImportReports
            string failedDetailsJson = JsonSerializer.Serialize(failedDetailsList, jsonOptions);
            await conn.ExecuteAsync(@"
                INSERT INTO AutoImportReports (RunDateTime, Filename, TotalRows, MatchedCount, FailedCount, FailedDetailsJson, Type)
                VALUES (@RunDateTime, @Filename, @TotalRows, @MatchedCount, @FailedCount, @FailedDetailsJson, @Type)",
                new
                {
                    RunDateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    Filename = Path.GetFileName(filePath),
                    TotalRows = rows.Count,
                    MatchedCount = matchedCount,
                    FailedCount = failedDetailsList.Count,
                    FailedDetailsJson = failedDetailsJson,
                    Type = isSalary ? "SalaryReturns" : "Returns"
                }, trans);

            trans.Commit();

            // Write unmatched rows if any
            if (failureDetails.Count > 0)
            {
                var failedFolder = Path.Combine(folderPath, "فشل_الاستيراد");
                var targetSubFolder = GetArchiveSubFolder(failedFolder);
                if (!Directory.Exists(targetSubFolder)) Directory.CreateDirectory(targetSubFolder);

                string timeStr = DateTime.Now.ToString("HH-mm-ss");
                string unmatchedFileName = $"{timeStr}_فشل_تطابق_{failureDetails.Count}_من_{rows.Count}_{Path.GetFileNameWithoutExtension(filePath)}.csv";
                string outputPath = Path.Combine(targetSubFolder, unmatchedFileName);
                WriteCsvFile(outputPath, headers, failureDetails);
            }

            await _db.AddNotificationEventAsync(tableName, "تسوية تلقائية", matchedCount, "النظام");
            Console.WriteLine($"[AutoImport] Payment file processed successfully: matched and settled {matchedCount} records.");
        }
        catch
        {
            trans.Rollback();
            throw;
        }
    }

    private (List<string> Headers, List<Dictionary<string, object>> Rows) ReadFile(string filePath)
    {
        var headers = new List<string>();
        var rows = new List<Dictionary<string, object>>();

        using var stream = File.Open(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        using var reader = filePath.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)
            ? ExcelReaderFactory.CreateCsvReader(stream)
            : ExcelReaderFactory.CreateReader(stream);

        var dataSet = reader.AsDataSet(new ExcelDataSetConfiguration()
        {
            ConfigureDataTable = (_) => new ExcelDataTableConfiguration() { UseHeaderRow = true }
        });

        if (dataSet.Tables.Count > 0)
        {
            var table = dataSet.Tables[0];
            foreach (DataColumn column in table.Columns)
            {
                headers.Add(column.ColumnName);
            }

            foreach (DataRow row in table.Rows)
            {
                var dict = new Dictionary<string, object>();
                foreach (DataColumn col in table.Columns)
                {
                    var val = row[col];
                    if (val == DBNull.Value) val = null;
                    dict[col.ColumnName] = val;
                }
                rows.Add(dict);
            }
        }

        return (headers, rows);
    }

    private async Task ImportToDatabaseAsync(string filePath, List<string> headers, List<Dictionary<string, object>> rows, bool isSalary)
    {
        using var conn = await _db.GetOpenConnectionAsync();
        using var trans = conn.BeginTransaction();

        try
        {
            var jsonOptions = new JsonSerializerOptions
            {
                Encoder = JavaScriptEncoder.Create(UnicodeRanges.All)
            };

            var dateStr = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            var fileSizeStr = (new FileInfo(filePath).Length / 1024.0).ToString("F2") + " KB";
            var fileName = Path.GetFileName(filePath);

            int archiveId = 0;

            if (isSalary)
            {
                archiveId = await conn.QuerySingleAsync<int>(@"
                    INSERT INTO SalaryArchives (Date, Filename, RecordCount, Size, Headers)
                    VALUES (@Date, @Filename, @RecordCount, @Size, @Headers)
                    RETURNING Id;",
                    new
                    {
                        Date = dateStr,
                        Filename = fileName,
                        RecordCount = rows.Count,
                        Size = fileSizeStr,
                        Headers = JsonSerializer.Serialize(headers, jsonOptions)
                    }, trans);

                const int batchSize = 2000;
                bool hasUploadDateInDb = true;
                try { await conn.ExecuteScalarAsync("SELECT UploadDate FROM SalaryReturns LIMIT 1", null, trans); }
                catch { hasUploadDateInDb = false; }

                string insertSql = hasUploadDateInDb
                    ? "INSERT INTO SalaryReturns (ImportId, RawData, ReturnCode, UploadDate, UpdatedAt) VALUES (@ImportId, json_set(@RawData, '$.\"تاريخ الرفع\"', @UploadDate), @ReturnCode, @UploadDate, @UpdatedAt)"
                    : "INSERT INTO SalaryReturns (ImportId, RawData, ReturnCode, UpdatedAt) VALUES (@ImportId, json_set(@RawData, '$.\"تاريخ الرفع\"', @UploadDate), @ReturnCode, @UpdatedAt)";

                for (int i = 0; i < rows.Count; i += batchSize)
                {
                    var batch = rows.Skip(i).Take(batchSize).Select(d => {
                        string raw = JsonSerializer.Serialize(d, jsonOptions);
                        string fCode = DatabaseService.ExtractFileCodeDirect(raw);

                        return new
                        {
                            ImportId = archiveId,
                            RawData = raw,
                            ReturnCode = DatabaseService.ExtractReturnCode(fCode),
                            UploadDate = dateStr,
                            UpdatedAt = dateStr
                        };
                    }).ToList();

                    await conn.ExecuteAsync(insertSql, batch, trans);
                }
            }
            else
            {
                archiveId = await conn.QuerySingleAsync<int>(@"
                    INSERT INTO Archives (Date, Filename, RecordCount, Size, Headers)
                    VALUES (@Date, @Filename, @RecordCount, @Size, @Headers)
                    RETURNING Id;",
                    new
                    {
                        Date = dateStr,
                        Filename = fileName,
                        RecordCount = rows.Count,
                        Size = fileSizeStr,
                        Headers = JsonSerializer.Serialize(headers, jsonOptions)
                    }, trans);

                const int batchSize = 2000;
                bool hasUploadDateInDb = true;
                try { await conn.ExecuteScalarAsync("SELECT UploadDate FROM Returns LIMIT 1", null, trans); }
                catch { hasUploadDateInDb = false; }

                string insertSql = hasUploadDateInDb
                    ? "INSERT INTO Returns (ImportId, RawData, ReturnCode, UploadDate, UpdatedAt) VALUES (@ImportId, json_set(@RawData, '$.\"تاريخ الرفع\"', @UploadDate), @ReturnCode, @UploadDate, @UpdatedAt)"
                    : "INSERT INTO Returns (ImportId, RawData, ReturnCode, UpdatedAt) VALUES (@ImportId, json_set(@RawData, '$.\"تاريخ الرفع\"', @UploadDate), @ReturnCode, @UpdatedAt)";

                for (int i = 0; i < rows.Count; i += batchSize)
                {
                    var batch = rows.Skip(i).Take(batchSize).Select(d => {
                        string raw = JsonSerializer.Serialize(d, jsonOptions);
                        string fCode = DatabaseService.ExtractFileCodeDirect(raw);

                        return new
                        {
                            ImportId = archiveId,
                            RawData = raw,
                            ReturnCode = DatabaseService.ExtractReturnCode(fCode),
                            UploadDate = dateStr,
                            UpdatedAt = dateStr
                        };
                    }).ToList();

                    await conn.ExecuteAsync(insertSql, batch, trans);
                }
            }

            trans.Commit();

            // Trigger notification
            var tableName = isSalary ? "SalaryReturns" : "Returns";
            await _db.AddNotificationEventAsync(tableName, "استيراد تلقائي", archiveId, "النظام");

            _ = Task.Run(async () =>
            {
                try
                {
                    await _db.RebuildSearchFilterIndexAsync();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[AutoImport] Failed to rebuild index: {ex.Message}");
                }
            });
        }
        catch
        {
            trans.Rollback();
            throw;
        }
    }
}
