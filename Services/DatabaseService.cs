using Microsoft.Data.Sqlite;
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
    private string _dbPath = "";
    private ServerConfig _config = new();
    private DateTime _networkUnavailableUntil = DateTime.MinValue;

    public DatabaseService()
    {
        LoadConfig();
    }

    private void LoadConfig()
    {
        var config = LoadServerConfig();
        _config = config;

        var localDbPath = GetLocalDbPath();
        if (!string.IsNullOrWhiteSpace(config.BasePath))
        {
            var configuredDbPath = Path.Combine(config.BasePath, "hk.db");
            Console.WriteLine($"[DB] Attempting to use Configured Path: {configuredDbPath}");

            if (TryOpenDatabaseFile(configuredDbPath, out var configPathError))
            {
                _dbPath = configuredDbPath;
                Console.WriteLine($"[DB] Success: Database Path set to Config Path: {_dbPath}");
                return;
            }

            Console.WriteLine($"[DB] [WARN] Config BasePath is inaccessible: {config.BasePath}");
            Console.WriteLine($"[DB] [WARN] Reason: {configPathError}");
            
            if (config.BasePath.StartsWith("\\\\")) {
                _networkUnavailableUntil = DateTime.Now.AddMinutes(5);
                Console.WriteLine("[DB] Network share marked unreachable. Will retry in 5 minutes.");
            }
        }

        _dbPath = localDbPath;
        Console.WriteLine($"[DB] Using Local Path: {_dbPath}");

        if (TryOpenDatabaseFile(_dbPath, out var localPathError))
        {
            Console.WriteLine($"[DB] Success: Database Path set to Local: {_dbPath}");
            return;
        }

        Console.WriteLine($"[DB] [ERROR] Local database path is not usable: {_dbPath}");
        Console.WriteLine($"[DB] [ERROR] Local DB failure: {localPathError}");
    }

    private string GetLocalDbPath()
    {
        // Try Absolute Root first if running from nested publish folders
        var rootDir = "C:\\Users\\esth633\\Desktop\\hk";
        var rootDb = Path.Combine(rootDir, "hk.db");
        if (File.Exists(rootDb)) return rootDb;

        // Fallback to Current directory
        return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "hk.db");
    }

    private void SwitchToLocalDbPath(string reason)
    {
        var localDbPath = GetLocalDbPath();
        if (!string.Equals(_dbPath, localDbPath, StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine($"[DB] [WARN] Switching to local fallback due to: {reason}");
        }
        _dbPath = localDbPath;
    }

    private bool TryOpenDatabaseFile(string dbPath, out string error)
    {
        try
        {
            var dir = Path.GetDirectoryName(dbPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                try {
                    Directory.CreateDirectory(dir);
                } catch (Exception ex) {
                    error = $"Directory Creation Failed: {ex.Message}";
                    return false;
                }
            }

            // For network shares, we prefer Mode=ReadWrite strictly if it exists to avoid creation permission issues
            // adding Default Timeout=5 to prevent long OS hangs on inaccessible shares
            string connectionString = $"Data Source={dbPath};Pooling=False;Cache=Shared";
            if (dbPath.StartsWith("\\\\")) {
                 connectionString += ";Mode=ReadWrite;Default Timeout=5"; 
            } else {
                 connectionString += ";Mode=ReadWriteCreate";
            }

            using var conn = new SqliteConnection(connectionString);
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "PRAGMA user_version;";
            _ = cmd.ExecuteScalar();
            error = string.Empty;
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
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

    public string GetDbPath() => _dbPath;
    
    public void SetBasePath(string basePath) {
        if (string.IsNullOrEmpty(basePath)) return;
        _dbPath = Path.Combine(basePath, "hk.db");
        if (_config == null) _config = new ServerConfig();
        _config.BasePath = basePath;
    }

    public async Task InitDatabase()
    {
        if (string.IsNullOrEmpty(_dbPath)) return;

        var dir = Path.GetDirectoryName(_dbPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) Directory.CreateDirectory(dir);

        if (!TryOpenDatabaseFile(_dbPath, out var pathError))
        {
            SwitchToLocalDbPath(pathError);
            if (!TryOpenDatabaseFile(_dbPath, out var localPathError))
            {
                throw new InvalidOperationException($"Cannot access configured or local database path. Config error: {pathError}. Local error: {localPathError}");
            }
        }

        using var conn = new SqliteConnection($"Data Source={_dbPath};Foreign Keys=True;Cache=Shared;Pooling=False");
        await conn.OpenAsync();

        bool isNetworkPath = _dbPath.StartsWith("\\\\");
        if (isNetworkPath) {
            await conn.ExecuteAsync("PRAGMA journal_mode = DELETE;");
            await conn.ExecuteAsync("PRAGMA busy_timeout = 30000;");
            Console.WriteLine("[DB] Applied Network Share Stability Settings.");
        } else {
            await conn.ExecuteAsync("PRAGMA journal_mode = WAL;");
            await conn.ExecuteAsync("PRAGMA busy_timeout = 15000;");
        }
        
        await conn.ExecuteAsync("PRAGMA synchronous = NORMAL;");
        await conn.ExecuteAsync("PRAGMA cache_size = -64000;");
        await conn.ExecuteAsync("PRAGMA temp_store = MEMORY;");
        await conn.ExecuteAsync("PRAGMA mmap_size = 268435456;");

        var sql = @"
            CREATE TABLE IF NOT EXISTS Users (Id INTEGER PRIMARY KEY AUTOINCREMENT, Username TEXT UNIQUE, Password TEXT, Fullname TEXT, Role TEXT, Active INTEGER, CreatedAt TEXT);
            CREATE TABLE IF NOT EXISTS Archives (Id INTEGER PRIMARY KEY AUTOINCREMENT, Date TEXT, Filename TEXT, RecordCount INTEGER, Size TEXT, Headers TEXT);
            CREATE TABLE IF NOT EXISTS Returns (Id INTEGER PRIMARY KEY AUTOINCREMENT, ImportId INTEGER, RawData TEXT, ReturnCode TEXT, UploadDate TEXT, IsDeleted INTEGER DEFAULT 0, FOREIGN KEY(ImportId) REFERENCES Archives(Id) ON DELETE CASCADE);
            CREATE INDEX IF NOT EXISTS TXT_Returns_ImportId ON Returns(ImportId);
            CREATE INDEX IF NOT EXISTS IDX_Returns_ReturnCode ON Returns(ReturnCode);
            CREATE INDEX IF NOT EXISTS IDX_Returns_UploadDate ON Returns(UploadDate);
            CREATE INDEX IF NOT EXISTS IDX_Returns_IsDeleted ON Returns(IsDeleted);
            CREATE TABLE IF NOT EXISTS ReturnsImages (Id INTEGER PRIMARY KEY AUTOINCREMENT, ReturnId INTEGER, Filename TEXT, CreatedAt TEXT, FOREIGN KEY(ReturnId) REFERENCES Returns(Id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS Filters (Id TEXT PRIMARY KEY, Name TEXT NOT NULL, Type TEXT NOT NULL, ValuesContent TEXT, MinValue REAL, MaxValue REAL, TargetPage TEXT, TargetColumn TEXT, Criteria TEXT, CreatedAt TEXT);
            CREATE TABLE IF NOT EXISTS FullReturns (Id INTEGER PRIMARY KEY AUTOINCREMENT, RawData TEXT, CreatedAt TEXT);
            CREATE TABLE IF NOT EXISTS FullReturnsImages (Id INTEGER PRIMARY KEY AUTOINCREMENT, ReturnId INTEGER, Filename TEXT, CreatedAt TEXT, FOREIGN KEY(ReturnId) REFERENCES FullReturns(Id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS SalaryArchives (Id INTEGER PRIMARY KEY AUTOINCREMENT, Date TEXT, Filename TEXT, RecordCount INTEGER, Size TEXT, Headers TEXT);
            CREATE TABLE IF NOT EXISTS SalaryReturns (Id INTEGER PRIMARY KEY AUTOINCREMENT, ImportId INTEGER, RawData TEXT, ReturnCode TEXT, UploadDate TEXT, IsDeleted INTEGER DEFAULT 0, FOREIGN KEY(ImportId) REFERENCES SalaryArchives(Id) ON DELETE CASCADE);
            CREATE INDEX IF NOT EXISTS IDX_SalaryReturns_ImportId ON SalaryReturns(ImportId);
            CREATE INDEX IF NOT EXISTS IDX_SalaryReturns_ReturnCode ON SalaryReturns(ReturnCode);
            CREATE INDEX IF NOT EXISTS IDX_SalaryReturns_UploadDate ON SalaryReturns(UploadDate);
            CREATE INDEX IF NOT EXISTS IDX_SalaryReturns_IsDeleted ON SalaryReturns(IsDeleted);
            CREATE TABLE IF NOT EXISTS SalaryReturnsImages (Id INTEGER PRIMARY KEY AUTOINCREMENT, ReturnId INTEGER, Filename TEXT, CreatedAt TEXT, FOREIGN KEY(ReturnId) REFERENCES SalaryReturns(Id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS NotificationEvents (Id INTEGER PRIMARY KEY AUTOINCREMENT, TableName TEXT, Operation TEXT, RowId INTEGER, CreatedBy TEXT, CreatedAt TEXT, Status TEXT DEFAULT 'Pending', Error TEXT);
        ";
        await conn.ExecuteAsync(sql);

        try { await conn.ExecuteAsync("ALTER TABLE Filters ADD COLUMN Criteria TEXT;"); } catch {}
        
        var ftsSql = @"
            CREATE VIRTUAL TABLE IF NOT EXISTS Returns_FTS USING fts5(RawData, content='Returns', content_rowid='Id');
            CREATE TRIGGER IF NOT EXISTS trg_Returns_ai AFTER INSERT ON Returns BEGIN INSERT INTO Returns_FTS(rowid, RawData) VALUES (new.Id, new.RawData); END;
            CREATE TRIGGER IF NOT EXISTS trg_Returns_ad AFTER DELETE ON Returns BEGIN INSERT INTO Returns_FTS(Returns_FTS, rowid, RawData) VALUES('delete', old.Id, old.RawData); END;
            CREATE TRIGGER IF NOT EXISTS trg_Returns_au AFTER UPDATE ON Returns BEGIN INSERT INTO Returns_FTS(Returns_FTS, rowid, RawData) VALUES('delete', old.Id, old.RawData); INSERT INTO Returns_FTS(rowid, RawData) VALUES (new.Id, new.RawData); END;
            CREATE VIRTUAL TABLE IF NOT EXISTS FullReturns_FTS USING fts5(RawData, content='FullReturns', content_rowid='Id');
            CREATE TRIGGER IF NOT EXISTS trg_FullReturns_ai AFTER INSERT ON FullReturns BEGIN INSERT INTO FullReturns_FTS(rowid, RawData) VALUES (new.Id, new.RawData); END;
            CREATE TRIGGER IF NOT EXISTS trg_FullReturns_ad AFTER DELETE ON FullReturns BEGIN INSERT INTO FullReturns_FTS(FullReturns_FTS, rowid, RawData) VALUES('delete', old.Id, old.RawData); END;
            CREATE TRIGGER IF NOT EXISTS trg_FullReturns_au AFTER UPDATE ON FullReturns BEGIN INSERT INTO FullReturns_FTS(FullReturns_FTS, rowid, RawData) VALUES('delete', old.Id, old.RawData); INSERT INTO FullReturns_FTS(rowid, RawData) VALUES (new.Id, new.RawData); END;
            CREATE VIRTUAL TABLE IF NOT EXISTS SalaryReturns_FTS USING fts5(RawData, content='SalaryReturns', content_rowid='Id');
            CREATE TRIGGER IF NOT EXISTS trg_SalaryReturns_ai AFTER INSERT ON SalaryReturns BEGIN INSERT INTO SalaryReturns_FTS(rowid, RawData) VALUES (new.Id, new.RawData); END;
            CREATE TRIGGER IF NOT EXISTS trg_SalaryReturns_ad AFTER DELETE ON SalaryReturns BEGIN INSERT INTO SalaryReturns_FTS(SalaryReturns_FTS, rowid, RawData) VALUES('delete', old.Id, old.RawData); END;
            CREATE TRIGGER IF NOT EXISTS trg_SalaryReturns_au AFTER UPDATE ON SalaryReturns BEGIN INSERT INTO SalaryReturns_FTS(SalaryReturns_FTS, rowid, RawData) VALUES('delete', old.Id, old.RawData); INSERT INTO SalaryReturns_FTS(rowid, RawData) VALUES (new.Id, new.RawData); END;
        ";
        await conn.ExecuteAsync(ftsSql);
        
        var userCount = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Users");
        if (userCount == 0)
        {
            await conn.ExecuteAsync(@"INSERT INTO Users (Username, Password, Fullname, Role, Active, CreatedAt) VALUES (@Username, @Password, @Fullname, @Role, 1, @CreatedAt)",
                new { Username = "admin", Password = "0946777651a28a30367fc9b578c7857fa12add5f82c611481e360dc05a108a73", Fullname = "المدير العام", Role = "admin", CreatedAt = DateTime.Now }
            );
        }

        await EnsureSchema(conn);
        await MigrateReturnCodes(conn);
        await MigrateLegacyData(conn);
    }

    private async Task EnsureSchema(SqliteConnection conn) {
        try {
            try { await conn.ExecuteScalarAsync("SELECT FileCode FROM Returns LIMIT 1"); } catch {
                await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN FileCode TEXT GENERATED ALWAYS AS (COALESCE(json_extract(RawData, '$.\"كود الملف\"'), json_extract(RawData, '$.\"كـــود الملف\"'), json_extract(RawData, '$.\"Batch ID\"'), json_extract(RawData, '$.Code'), json_extract(RawData, '$.FileCode'))) VIRTUAL;");
                await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN Amount REAL GENERATED ALWAYS AS (COALESCE(CAST(json_extract(RawData, '$.\"المبلغ\"') AS REAL), CAST(json_extract(RawData, '$.\"مبلغ\"') AS REAL), CAST(json_extract(RawData, '$.\"قيمة العملية\"') AS REAL), CAST(json_extract(RawData, '$.\"صافي المبلغ\"') AS REAL), CAST(json_extract(RawData, '$.\"الإجمالي\"') AS REAL), CAST(json_extract(RawData, '$.Amount') AS REAL), 0)) VIRTUAL;");
                await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN SettlementDate TEXT GENERATED ALWAYS AS (COALESCE(json_extract(RawData, '$.\"تاريخ اعتماد التعديل\"'), json_extract(RawData, '$.\"تاريخ التسوية\"'), json_extract(RawData, '$.\"تاريخ التنفيذ\"'), json_extract(RawData, '$.ModificationDate'), json_extract(RawData, '$.SettlementDate'))) VIRTUAL;");
                await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_FileCode ON Returns(FileCode);");
                await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_Amount ON Returns(Amount);");
                await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_SettlementDate ON Returns(SettlementDate);");
            }
            try { await conn.ExecuteScalarAsync("SELECT TargetPage FROM Filters LIMIT 1"); } catch {
                await conn.ExecuteAsync("ALTER TABLE Filters ADD COLUMN TargetPage TEXT");
                await conn.ExecuteAsync("ALTER TABLE Filters ADD COLUMN TargetColumn TEXT");
            }
            try { await conn.ExecuteScalarAsync("SELECT ReturnCode FROM Returns LIMIT 1"); } catch {
                await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN ReturnCode TEXT;");
                await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_ReturnCode ON Returns(ReturnCode);");
            }
            try { await conn.ExecuteScalarAsync("SELECT UploadDate FROM Returns LIMIT 1"); } catch {
                await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN UploadDate TEXT;");
                await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_UploadDate ON Returns(UploadDate);");
                var today = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                await conn.ExecuteAsync($"UPDATE Returns SET UploadDate = '{today}' WHERE UploadDate IS NULL");
            }
            try { await conn.ExecuteScalarAsync("SELECT IsDeleted FROM Returns LIMIT 1"); } catch {
                await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN IsDeleted INTEGER DEFAULT 0;");
                await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_IsDeleted ON Returns(IsDeleted);");
            }
            try { await conn.ExecuteAsync("ALTER TABLE SalaryReturns ADD COLUMN IsDeleted INTEGER DEFAULT 0;"); await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_SalaryReturns_IsDeleted ON SalaryReturns(IsDeleted);"); } catch { }
            try { await conn.ExecuteScalarAsync("SELECT CreatedBy FROM NotificationEvents LIMIT 1"); } catch {
                await conn.ExecuteAsync("ALTER TABLE NotificationEvents ADD COLUMN CreatedBy TEXT;");
            }
            // --- New Settlement Columns ---
            try { await conn.ExecuteScalarAsync("SELECT [رقم تسوية التعلية] FROM Returns LIMIT 1"); } catch {
                await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN [رقم تسوية التعلية] TEXT;");
            }
            try { await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN [رقم تسوية السداد] TEXT;"); } catch { }
            
            // --- Remove Old Settlement Column ---
            try { await conn.ExecuteAsync("ALTER TABLE Returns DROP COLUMN [رقم التسوية];"); } catch { }
        } catch {}
    }

    private async Task MigrateReturnCodes(SqliteConnection conn)
    {
        try {
            var count = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Returns WHERE ReturnCode IS NULL OR trim(ReturnCode) = ''");
            if (count == 0) return;
            var data = await conn.QueryAsync<dynamic>("SELECT Id, FileCode, RawData FROM Returns WHERE ReturnCode IS NULL OR trim(ReturnCode) = ''");
            using var trans = conn.BeginTransaction();
            foreach (var row in data) {
                string fCode = row.FileCode ?? ExtractFileCodeDirect(row.RawData ?? "");
                string rCode = ExtractReturnCode(fCode ?? "");
                await conn.ExecuteAsync("UPDATE Returns SET ReturnCode = @ReturnCode WHERE Id = @Id", new { ReturnCode = rCode, Id = row.Id }, trans);
            }
            trans.Commit();
        } catch {}
    }

    private async Task MigrateLegacyData(SqliteConnection conn)
    {
        try {
            var count = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Archives");
            if (count > 0) return;
            
            var usersFile = Path.Combine(_config.BasePath, "users_db.json");
            if (File.Exists(usersFile)) {
                var json = await File.ReadAllTextAsync(usersFile);
                var users = JsonSerializer.Deserialize<List<User>>(json);
                if (users != null) {
                    await conn.ExecuteAsync("DELETE FROM Users");
                    foreach(var u in users) {
                         await conn.ExecuteAsync(@"INSERT INTO Users (Id, Username, Password, Fullname, Role, Active, CreatedAt) VALUES (@id, @username, @password, @fullname, @role, @active, @createdAt)", u);
                    }
                    await conn.ExecuteAsync("UPDATE sqlite_sequence SET seq = (SELECT MAX(Id) FROM Users) WHERE name = 'Users'");
                }
            }

            var archivesFile = Path.Combine(_config.BasePath, "archive_db.json");
            if (File.Exists(archivesFile)) {
                var json = await File.ReadAllTextAsync(archivesFile);
                var archives = JsonSerializer.Deserialize<List<ArchiveEntry>>(json);
                 if (archives != null) {
                    foreach(var a in archives) {
                        await conn.ExecuteAsync(@"INSERT INTO Archives (Id, Date, Filename, RecordCount, Size, Headers) VALUES (@id, @date, @filename, @recordCount, @size, @headers)", 
                            new { a.id, a.date, a.filename, a.recordCount, a.size, headers = a.headers ?? "[]" });
                    }
                    await conn.ExecuteAsync("UPDATE sqlite_sequence SET seq = (SELECT MAX(Id) FROM Archives) WHERE name = 'Archives'");
                 }
            }

            var returnsFile = Path.Combine(_config.BasePath, "returns_db.json");
            if (File.Exists(returnsFile)) {
                var json = await File.ReadAllTextAsync(returnsFile);
                var returns = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(json);
                if (returns != null && returns.Count > 0) {
                     using var trans = conn.BeginTransaction();
                     var dbBatch = returns.Select(r => {
                         int importId = 0;
                         if (r.ContainsKey("importId") && r["importId"] is JsonElement je && je.ValueKind == JsonValueKind.Number) importId = je.GetInt32();
                         return new { ImportId = importId, RawData = JsonSerializer.Serialize(r) };
                     });
                     await conn.ExecuteAsync(@"INSERT INTO Returns (ImportId, RawData) VALUES (@ImportId, @RawData)", dbBatch, trans);
                     trans.Commit();
                }
            }
        } catch {}
    }

    public SqliteConnection GetConnection()
    {
        return new SqliteConnection($"Data Source={_dbPath};Foreign Keys=True;Pooling=False;Cache=Shared");
    }

    public async Task<SqliteConnection> GetOpenConnectionAsync()
    {
        if (_dbPath.StartsWith("\\\\") && DateTime.Now < _networkUnavailableUntil)
        {
            SwitchToLocalDbPath("Network is temporarily unreachable.");
            await InitDatabase();
        }

        SqliteConnection conn;
        try
        {
            conn = GetConnection();
            await conn.OpenAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB] Connection failed to {_dbPath}: {ex.Message}");
            if (_dbPath.StartsWith("\\\\")) _networkUnavailableUntil = DateTime.Now.AddMinutes(2);
            SwitchToLocalDbPath(ex.Message);
            await InitDatabase();
            conn = GetConnection();
            await conn.OpenAsync();
        }
        
        bool isNetworkPath = _dbPath.StartsWith("\\\\");
        using var cmd = conn.CreateCommand();
        cmd.CommandText = isNetworkPath ? "PRAGMA synchronous = NORMAL; PRAGMA journal_mode = DELETE; PRAGMA busy_timeout = 30000; PRAGMA cache_size = -32000;" 
                                        : "PRAGMA synchronous = NORMAL; PRAGMA cache_size = -32000; PRAGMA temp_store = MEMORY; PRAGMA busy_timeout = 15000;";
        await cmd.ExecuteNonQueryAsync();
        return conn;
    }

    public async Task AddNotificationEventAsync(string tableName, string operation, long rowId, string user)
    {
        try {
            using var conn = await GetOpenConnectionAsync();
            await conn.ExecuteAsync(@"INSERT INTO NotificationEvents (TableName, Operation, RowId, CreatedBy, CreatedAt) VALUES (@TableName, @Operation, @RowId, @CreatedBy, datetime('now','localtime'))",
                new { TableName = tableName, Operation = operation, RowId = rowId, CreatedBy = user ?? "النظام" }
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
        return "";
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
        using var conn = GetConnection();
        var items = await conn.QueryAsync<dynamic>("SELECT * FROM Filters ORDER BY CreatedAt DESC");
        return items.Select(item => {
            var f = new FilterDefinition { Id = item.Id, Name = item.Name, Type = item.Type, ValuesContent = item.ValuesContent, MinValue = (double?)item.MinValue, MaxValue = (double?)item.MaxValue, TargetPage = item.TargetPage, TargetColumn = item.TargetColumn, CreatedAt = item.CreatedAt };
            if (item.Criteria != null) f.Criteria = JsonSerializer.Deserialize<List<FilterCriterion>>((string)item.Criteria) ?? new();
            if (f.Criteria.Count == 0 && !string.IsNullOrEmpty(f.Type)) f.Criteria.Add(new FilterCriterion { Type = f.Type, ValuesContent = f.ValuesContent, MinValue = f.MinValue, MaxValue = f.MaxValue, TargetColumn = f.TargetColumn });
            return f;
        }).ToList();
    }

    public async Task AddFilterAsync(FilterDefinition filter) {
        using var conn = GetConnection();
        await conn.ExecuteAsync(@"INSERT INTO Filters (Id, Name, Type, ValuesContent, MinValue, MaxValue, TargetPage, TargetColumn, Criteria, CreatedAt) VALUES (@Id, @Name, @Type, @ValuesContent, @MinValue, @MaxValue, @TargetPage, @TargetColumn, @Criteria, @CreatedAt)", 
            new { filter.Id, filter.Name, filter.Type, filter.ValuesContent, filter.MinValue, filter.MaxValue, filter.TargetPage, filter.TargetColumn, Criteria = JsonSerializer.Serialize(filter.Criteria), filter.CreatedAt });
    }

    public async Task UpdateFilterAsync(FilterDefinition filter) {
        using var conn = GetConnection();
        await conn.ExecuteAsync(@"UPDATE Filters SET Name = @Name, Type = @Type, ValuesContent = @ValuesContent, MinValue = @MinValue, MaxValue = @MaxValue, TargetPage = @TargetPage, TargetColumn = @TargetColumn, Criteria = @Criteria WHERE Id = @Id", 
            new { filter.Id, filter.Name, filter.Type, filter.ValuesContent, filter.MinValue, filter.MaxValue, filter.TargetPage, filter.TargetColumn, Criteria = JsonSerializer.Serialize(filter.Criteria) });
    }

    public async Task<FilterDefinition?> GetFilterByIdAsync(string id) {
        using var conn = GetConnection();
        var item = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT * FROM Filters WHERE Id = @Id", new { Id = id });
        if (item == null) return null;
        var f = new FilterDefinition { Id = item.Id, Name = item.Name, Type = item.Type, ValuesContent = item.ValuesContent, MinValue = (double?)item.MinValue, MaxValue = (double?)item.MaxValue, TargetPage = item.TargetPage, TargetColumn = item.TargetColumn, CreatedAt = item.CreatedAt };
        if (item.Criteria != null) f.Criteria = JsonSerializer.Deserialize<List<FilterCriterion>>((string)item.Criteria) ?? new();
        return f;
    }

    public async Task DeleteFilterAsync(string id) {
        using var conn = GetConnection();
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
        var rIds = await conn.QueryAsync<int>("SELECT Id FROM Returns WHERE Id = @S OR Id IN (SELECT rowid FROM Returns_FTS WHERE Returns_FTS MATCH @N)", new { S = (tableType == "returns" ? sourceId : -1), N = cn });
        var sIds = await conn.QueryAsync<int>("SELECT Id FROM SalaryReturns WHERE Id = @S OR Id IN (SELECT rowid FROM SalaryReturns_FTS WHERE SalaryReturns_FTS MATCH @N)", new { S = (tableType == "salary" ? sourceId : -1), N = cn });
        return (rIds.Distinct().ToList(), sIds.Distinct().ToList());
    }
}
