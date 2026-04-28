using Microsoft.Data.Sqlite;
using System.Data;
using System.Data.Common;
using System.Text.RegularExpressions;
using System.Text.Json;
using System.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using HKServer.Models;
using Dapper;

namespace HKServer.Services;

public class DatabaseService
{
    private ServerConfig _config = new();

    public DatabaseService()
    {
        _config = LoadServerConfig();
        Console.WriteLine("[DB] Using local SQLite database (hk.db).");
    }

    public static ServerConfig LoadServerConfig() {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var configPath = Path.Combine(appData, "HKServer", "server_config.json");
        var localPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "server_config.json");

        if (File.Exists(configPath)) {
             try {
                var json = File.ReadAllText(configPath);
                var cfg = JsonSerializer.Deserialize<ServerConfig>(json);
                if (cfg != null) return cfg;
             } catch {}
        }

        if (File.Exists(localPath)) {
             try {
                var json = File.ReadAllText(localPath);
                var cfg = JsonSerializer.Deserialize<ServerConfig>(json);
                if (cfg != null) return cfg;
             } catch {}
        }
        
        return new ServerConfig();
    }

    public static void SaveServerConfig(ServerConfig config) {
        try {
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var headerPath = Path.Combine(appData, "HKServer");
            if (!Directory.Exists(headerPath)) Directory.CreateDirectory(headerPath);
            
            var configPath = Path.Combine(headerPath, "server_config.json");
            var json = JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(configPath, json);

            try {
                var localPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "server_config.json");
                File.WriteAllText(localPath, json);
            } catch {}
        } catch (Exception ex) {
            Console.WriteLine($"[Config] Error saving configuration: {ex.Message}");
        }
    }

    public string GetDbPath() {
        return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "hk.db");
    }

    public void SetBasePath(string basePath) {
        _config.BasePath = basePath;
        SaveServerConfig(_config);
    }

    public DbConnection GetConnection()
    {
        return new SqliteConnection($"Data Source={GetDbPath()}");
    }

    public async Task<DbConnection> GetOpenConnectionAsync()
    {
        var conn = GetConnection();
        await conn.OpenAsync();
        return conn;
    }

    public async Task InitDatabase()
    {
        using var conn = await GetOpenConnectionAsync();
        var sql = @"
            CREATE TABLE IF NOT EXISTS Users (Id INTEGER PRIMARY KEY AUTOINCREMENT, Username TEXT UNIQUE, Password TEXT, Fullname TEXT, Role TEXT, Active INTEGER, CreatedAt TEXT);
            CREATE TABLE IF NOT EXISTS Archives (Id INTEGER PRIMARY KEY AUTOINCREMENT, Date TEXT, Filename TEXT, RecordCount INTEGER, Size TEXT, Headers TEXT, ExclusiveUserId INTEGER);
            CREATE TABLE IF NOT EXISTS Returns (Id INTEGER PRIMARY KEY AUTOINCREMENT, ImportId INTEGER, RawData TEXT, ReturnCode TEXT, UploadDate TEXT, IsDeleted INTEGER DEFAULT 0, IsArchived INTEGER DEFAULT 0, ArchivedBatchId INTEGER NULL, [رقم تسوية التعلية] TEXT, [رقم تسوية السداد] TEXT, FOREIGN KEY(ImportId) REFERENCES Archives(Id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS ReturnsImages (Id INTEGER PRIMARY KEY AUTOINCREMENT, ReturnId INTEGER, Filename TEXT, CreatedAt TEXT, FOREIGN KEY(ReturnId) REFERENCES Returns(Id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS Filters (Id TEXT PRIMARY KEY, Name TEXT NOT NULL, Type TEXT NOT NULL, ValuesContent TEXT, MinValue REAL, MaxValue REAL, TargetPage TEXT, TargetColumn TEXT, Criteria TEXT, CreatedAt TEXT);
            CREATE TABLE IF NOT EXISTS FullReturns (Id INTEGER PRIMARY KEY AUTOINCREMENT, RawData TEXT, CreatedAt TEXT);
            CREATE TABLE IF NOT EXISTS FullReturnsImages (Id INTEGER PRIMARY KEY AUTOINCREMENT, ReturnId INTEGER, Filename TEXT, CreatedAt TEXT, FOREIGN KEY(ReturnId) REFERENCES FullReturns(Id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS SalaryArchives (Id INTEGER PRIMARY KEY AUTOINCREMENT, Date TEXT, Filename TEXT, RecordCount INTEGER, Size TEXT, Headers TEXT, ExclusiveUserId INTEGER);
            CREATE TABLE IF NOT EXISTS SalaryReturns (Id INTEGER PRIMARY KEY AUTOINCREMENT, ImportId INTEGER, RawData TEXT, ReturnCode TEXT, UploadDate TEXT, IsDeleted INTEGER DEFAULT 0, IsArchived INTEGER DEFAULT 0, ArchivedBatchId INTEGER NULL, [رقم تسوية التعلية] TEXT, [رقم تسوية السداد] TEXT, FOREIGN KEY(ImportId) REFERENCES SalaryArchives(Id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS SalaryReturnsImages (Id INTEGER PRIMARY KEY AUTOINCREMENT, ReturnId INTEGER, Filename TEXT, CreatedAt TEXT, FOREIGN KEY(ReturnId) REFERENCES SalaryReturns(Id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS NotificationEvents (Id INTEGER PRIMARY KEY AUTOINCREMENT, TableName TEXT, Operation TEXT, RowId INTEGER, CreatedBy TEXT, CreatedAt TEXT, Status TEXT DEFAULT 'Pending', Error TEXT);
            
            -- Extended Tables (from Postgres migration)
            CREATE TABLE IF NOT EXISTS ArchiveBatches (Id INTEGER PRIMARY KEY AUTOINCREMENT, ExcelNames TEXT, RecordCount INTEGER, DateFrom TEXT, DateTo TEXT, SourceTable TEXT, Reason TEXT, ArchivedAt TEXT);
            CREATE TABLE IF NOT EXISTS ArchiveDetails (Id INTEGER PRIMARY KEY AUTOINCREMENT, BatchId INTEGER, OriginalId INTEGER, SourceTable TEXT, ReturnCode TEXT, UploadDate TEXT, InquirySettlementNo TEXT, PaymentSettlementNo TEXT, RawData TEXT, FOREIGN KEY(BatchId) REFERENCES ArchiveBatches(Id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS TableShares (Id INTEGER PRIMARY KEY AUTOINCREMENT, TableId INTEGER, TableType TEXT, SharedById INTEGER, SharedWithId INTEGER, Message TEXT, Status TEXT DEFAULT 'Pending', CreatedAt TEXT);
            CREATE TABLE IF NOT EXISTS UserTasks (Id INTEGER PRIMARY KEY AUTOINCREMENT, ManagerId INTEGER, TargetUserId INTEGER, Title TEXT, Description TEXT, Priority TEXT DEFAULT 'Medium', Status TEXT DEFAULT 'New', SourceTableId INTEGER, SourceType TEXT, CreatedAt TEXT);
            CREATE TABLE IF NOT EXISTS AuditLogs (Id INTEGER PRIMARY KEY AUTOINCREMENT, UserId INTEGER, Username TEXT, Action TEXT, Details TEXT, IPAddress TEXT, CreatedAt TEXT);
        ";
        await conn.ExecuteAsync(sql);
        
        var userCount = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Users");
        if (userCount == 0)
        {
            await conn.ExecuteAsync(@"INSERT INTO Users (Username, Password, Fullname, Role, Active, CreatedAt) VALUES (@Username, @Password, @Fullname, @Role, 1, @CreatedAt)",
                new { Username = "admin", Password = "0946777651a28a30367fc9b578c7857fa12add5f82c611481e360dc05a108a73", Fullname = "المدير العام", Role = "admin", CreatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") }
            );
        }

        // Schema updates for SQLite
        try { await conn.ExecuteAsync("ALTER TABLE Filters ADD COLUMN Criteria TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE Filters ADD COLUMN TargetPage TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE Filters ADD COLUMN TargetColumn TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN IsArchived INTEGER DEFAULT 0;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN ArchivedBatchId INTEGER NULL;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE SalaryReturns ADD COLUMN IsArchived INTEGER DEFAULT 0;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE SalaryReturns ADD COLUMN ArchivedBatchId INTEGER NULL;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN [رقم تسوية التعلية] TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN [رقم تسوية السداد] TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE SalaryReturns ADD COLUMN [رقم تسوية التعلية] TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE SalaryReturns ADD COLUMN [رقم تسوية السداد] TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE ArchiveDetails ADD COLUMN SourceTable TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE ArchiveDetails ADD COLUMN ReturnCode TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE ArchiveDetails ADD COLUMN UploadDate TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE ArchiveDetails ADD COLUMN InquirySettlementNo TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE ArchiveDetails ADD COLUMN PaymentSettlementNo TEXT;"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_ArchiveState ON Returns(IsDeleted, IsArchived, ArchivedBatchId);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_SalaryReturns_ArchiveState ON SalaryReturns(IsDeleted, IsArchived, ArchivedBatchId);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_ArchiveDetails_SourceOriginal ON ArchiveDetails(SourceTable, OriginalId);"); } catch {}
    }

    public async Task AddNotificationEventAsync(string tableName, string operation, long rowId, string user)
    {
        try {
            using var conn = await GetOpenConnectionAsync();
            await conn.ExecuteAsync(@"INSERT INTO NotificationEvents (TableName, Operation, RowId, CreatedBy, CreatedAt) VALUES (@TableName, @Operation, @RowId, @CreatedBy, datetime('now'))",
                new { TableName = tableName, Operation = operation, RowId = rowId, CreatedBy = user ?? "النظام" }
            );
        } catch {}
    }

    public async Task AddAuditLogAsync(int? userId, string username, string action, string details, string ip = "")
    {
        try {
            using var conn = await GetOpenConnectionAsync();
            await conn.ExecuteAsync(@"INSERT INTO AuditLogs (UserId, Username, Action, Details, IPAddress, CreatedAt) 
                                     VALUES (@UserId, @Username, @Action, @Details, @IP, datetime('now'))",
                new { UserId = userId, Username = username ?? "Unknown", Action = action, Details = details, IP = ip }
            );
        } catch {}
    }

    public static string ExtractName(string json)
    {
        if (string.IsNullOrEmpty(json)) return "Unknown";
        try {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            string[] keys = new[] { "الاســــم", "الاسم", "CREDITOR_NAME", "Creditor Name", "CreditorName", "Beneficiary Name", "اسم المستفيد", "Name", "BeneficiaryName", "Beneficiary_Name", "الاسم_بالكامل", "FullName", "اسم العميل", "الإسم", "Full Name", "اسم الموظف" };
            foreach (var prop in root.EnumerateObject()) {
                string cleanPropName = CleanArabic(prop.Name);
                if (keys.Any(k => string.Equals(cleanPropName, CleanArabic(k), StringComparison.OrdinalIgnoreCase))) return prop.Value.ToString();
            }
            return "Unknown";
        } catch { return "Unknown"; }
    }

    public static string ExtractNID(string json)
    {
        if (string.IsNullOrEmpty(json)) return "";
        try {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            string[] nidKeys = new[] { "NationalID", "NID", "National_ID", "الرقم_القومي", "الرقم القومي", "National Id", "NationalId", "رقم قومي", "رقم البطاقة", "National ID", "الرقم القومى" };
            foreach (var prop in root.EnumerateObject()) {
                string cleanPropName = CleanArabic(prop.Name);
                if (nidKeys.Any(k => string.Equals(cleanPropName, CleanArabic(k), StringComparison.OrdinalIgnoreCase))) {
                    string cleanRes = Regex.Replace(prop.Value.ToString(), @"[^\d]", "");
                    if (cleanRes.Length >= 10 && cleanRes.Length <= 14) return cleanRes;
                }
            }
            return "";
        } catch { return ""; }
    }

    public static string CleanArabic(string name, bool strict = false)
    {
        if (string.IsNullOrWhiteSpace(name)) return "";
        string text = name.Trim().Replace("ـ", "").Replace("\u00A0", " ").Replace("عبد ", "عبد");
        if (strict) {
            text = Regex.Replace(text, @"[\u0622\u0623\u0625\u0671\u0627]", "ا");
            text = text.Replace("ة", "ه").Replace("ى", "ي").Replace("ؤ", "و").Replace("ئ", "ي");
            text = Regex.Replace(text, @"[^\u0600-\u06FFa-zA-Z0-9\s]", " ");
            return Regex.Replace(text, @"\s+", " ").Trim();
        }
        text = Regex.Replace(text, @"[\u064B-\u065F]", "");
        text = Regex.Replace(text, @"[\u0622\u0623\u0625\u0671\u0627]", "ا");
        text = text.Replace("ة", "ه").Replace("ى", "ي").Replace("ؤ", "و").Replace("ئ", "ي");
        return Regex.Replace(text, @"\s+", " ").Trim();
    }

    public static string CleanFileName(string name) {
        if (string.IsNullOrEmpty(name)) return "Record";
        var invalid = Path.GetInvalidFileNameChars();
        return new string(name.Where(ch => !invalid.Contains(ch)).ToArray()).Trim();
    }

    public static string ExtractReturnCode(string fileCode) {
        if (string.IsNullOrEmpty(fileCode)) return "";
        var parts = fileCode.Trim().Split('-', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (fileCode.StartsWith("Army-c-", StringComparison.OrdinalIgnoreCase) && parts.Length >= 3) return parts[2];
        if (fileCode.StartsWith("Army-", StringComparison.OrdinalIgnoreCase) && parts.Length >= 2) return parts[1];
        return fileCode.Trim();
    }

    public static string ExtractFileCodeDirect(string json) {
        if (string.IsNullOrEmpty(json)) return "";
        try {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            string[] keys = new[] { "كود الملف", "كـود الملف", "كــود الملف", "كـــود الملف", "Batch ID", "Code", "FileCode" };
            foreach (var k in keys) if (root.TryGetProperty(k, out var p)) return p.ToString();
            return "";
        } catch { return ""; }
    }

    public async Task<List<FilterDefinition>> GetFiltersAsync() {
        using var conn = await GetOpenConnectionAsync();
        var items = await conn.QueryAsync<dynamic>("SELECT * FROM Filters ORDER BY CreatedAt DESC");
        return items.Select(item => {
            var f = new FilterDefinition { Id = item.Id ?? item.id, Name = item.Name ?? item.name, Type = item.Type ?? item.type, ValuesContent = item.ValuesContent ?? item.valuescontent, MinValue = (double?)(item.MinValue ?? item.minvalue), MaxValue = (double?)(item.MaxValue ?? item.maxvalue), TargetPage = item.TargetPage ?? item.targetpage, TargetColumn = item.TargetColumn ?? item.targetcolumn, CreatedAt = item.CreatedAt ?? item.createdat };
            if ((item.Criteria ?? item.criteria) != null) f.Criteria = JsonSerializer.Deserialize<List<FilterCriterion>>((string)(item.Criteria ?? item.criteria)) ?? new();
            if (f.Criteria.Count == 0 && !string.IsNullOrEmpty(f.Type)) f.Criteria.Add(new FilterCriterion { Type = f.Type, ValuesContent = f.ValuesContent, MinValue = f.MinValue, MaxValue = f.MaxValue, TargetColumn = f.TargetColumn });
            return f;
        }).ToList();
    }

    public async Task AddFilterAsync(FilterDefinition filter) {
        using var conn = await GetOpenConnectionAsync();
        await conn.ExecuteAsync(@"INSERT INTO Filters (Id, Name, Type, ValuesContent, MinValue, MaxValue, TargetPage, TargetColumn, Criteria, CreatedAt) VALUES (@Id, @Name, @Type, @ValuesContent, @MinValue, @MaxValue, @TargetPage, @TargetColumn, @Criteria, @CreatedAt)", 
            new { filter.Id, filter.Name, filter.Type, filter.ValuesContent, filter.MinValue, filter.MaxValue, filter.TargetPage, filter.TargetColumn, Criteria = JsonSerializer.Serialize(filter.Criteria), filter.CreatedAt });
    }

    public async Task UpdateFilterAsync(FilterDefinition filter) {
        using var conn = await GetOpenConnectionAsync();
        await conn.ExecuteAsync(@"UPDATE Filters SET Name = @Name, Type = @Type, ValuesContent = @ValuesContent, MinValue = @MinValue, MaxValue = @MaxValue, TargetPage = @TargetPage, TargetColumn = @TargetColumn, Criteria = @Criteria WHERE Id = @Id", 
            new { filter.Id, filter.Name, filter.Type, filter.ValuesContent, filter.MinValue, filter.MaxValue, filter.TargetPage, filter.TargetColumn, Criteria = JsonSerializer.Serialize(filter.Criteria) });
    }

    public async Task<FilterDefinition?> GetFilterByIdAsync(string id) {
        using var conn = await GetOpenConnectionAsync();
        var item = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT * FROM Filters WHERE Id = @Id", new { Id = id });
        if (item == null) return null;
        var f = new FilterDefinition { Id = item.Id ?? item.id, Name = item.Name ?? item.name, Type = item.Type ?? item.type, ValuesContent = item.ValuesContent ?? item.valuescontent, MinValue = (double?)(item.MinValue ?? item.minvalue), MaxValue = (double?)(item.MaxValue ?? item.maxvalue), TargetPage = item.TargetPage ?? item.targetpage, TargetColumn = item.TargetColumn ?? item.targetcolumn, CreatedAt = item.CreatedAt ?? item.createdat };
        if ((item.Criteria ?? item.criteria) != null) f.Criteria = JsonSerializer.Deserialize<List<FilterCriterion>>((string)(item.Criteria ?? item.criteria)) ?? new();
        return f;
    }

    public async Task DeleteFilterAsync(string id) {
        using var conn = await GetOpenConnectionAsync();
        await conn.ExecuteAsync("DELETE FROM Filters WHERE Id = @Id", new { Id = id });
    }

    public async Task<(List<int> ReturnIds, List<int> SalaryIds)> GetRelatedIdsAcrossTables(int sourceId, string tableType) {
        using var conn = await GetOpenConnectionAsync();
        string name = "Unknown", nid = "";
        var sql = tableType == "returns" ? "SELECT RawData FROM Returns WHERE Id = @Id" : "SELECT RawData FROM SalaryReturns WHERE Id = @Id";
        var raw = await conn.QueryFirstOrDefaultAsync<string>(sql, new { Id = sourceId });
        if (!string.IsNullOrEmpty(raw)) { name = ExtractName(raw); nid = ExtractNID(raw); }
        if (name == "Unknown" && string.IsNullOrEmpty(nid)) return tableType == "returns" ? (new List<int>{sourceId}, new List<int>()) : (new List<int>(), new List<int>{sourceId});
        string cn = CleanArabic(name);
        var rIds = await conn.QueryAsync<int>("SELECT Id FROM Returns WHERE Id = @S OR RawData LIKE @N", new { S = (tableType == "returns" ? sourceId : -1), N = $"%{cn}%" });
        var sIds = await conn.QueryAsync<int>("SELECT Id FROM SalaryReturns WHERE Id = @S OR RawData LIKE @N", new { S = (tableType == "salary" ? sourceId : -1), N = $"%{cn}%" });
        return (rIds.Distinct().ToList(), sIds.Distinct().ToList());
    }
}
