using Microsoft.Data.Sqlite;
using System.Text.RegularExpressions;
using System.Text.Json;
using System.Linq;
using System;
using System.Collections.Generic;
using System.IO;

namespace HKServer.Services;

public class DatabaseService
{
    private string _dbPath = "";
    private ServerConfig _config = new();

    public DatabaseService()
    {
        // Config load logic will be moved here or passed in. 
        // For now, simpler to load headers.
        LoadConfig();
    }

    private void LoadConfig()
    {
        var config = LoadServerConfig();
        _config = config;
        
        // Use BasePath if set AND المجلد موجود، وإلا استخدم المسار المحلي بجانب البرنامج
        if (!string.IsNullOrEmpty(config.BasePath) && Directory.Exists(config.BasePath)) {
            _dbPath = Path.Combine(config.BasePath, "hk.db");
            Console.WriteLine($"[INFO] Database Path set to Config Path: {_dbPath}");
        } else {
            if (!string.IsNullOrEmpty(config.BasePath) && !Directory.Exists(config.BasePath)) {
                Console.WriteLine($"[WARN] Config BasePath does not exist or is not accessible: {config.BasePath}");
                Console.WriteLine("[WARN] Falling back to local database path next to the server executable.");
            }
            _dbPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "hk.db");
            Console.WriteLine($"[INFO] Database Path set to Local: {_dbPath}");
        }
    }

    public static ServerConfig LoadServerConfig() {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var configPath = Path.Combine(appData, "HKServer", "server_config.json");
        var localPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "server_config.json");

        // Try AppData first
        if (File.Exists(configPath)) {
             try {
                var json = File.ReadAllText(configPath);
                var cfg = JsonSerializer.Deserialize<ServerConfig>(json);
                if (cfg != null) return cfg;
             } catch {}
        }

        // Fallback to Local Directory
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

            // Also save to local directory as backup
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
        
        // Persist immediately to avoid loss
        if (_config == null) _config = new ServerConfig();
        _config.BasePath = basePath;
        
        // We need to save this to disk. 
        // Since SaveServerConfig is private in ConfigEndpoints, we need a way to save.
        // For now, we will rely on the Endpoint doing the save.
        // BUT, the issue is on Startup. LoadConfig MUST read it.
    }

    public async Task InitDatabase()
    {
        if (string.IsNullOrEmpty(_dbPath)) return;

        var dir = Path.GetDirectoryName(_dbPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) Directory.CreateDirectory(dir);

        using var conn = new SqliteConnection($"Data Source={_dbPath};Foreign Keys=True;Cache=Shared;Pooling=False"); // Disable pooling for network shares to release locks faster
        await conn.OpenAsync();

        // Optimized for Network Shares (UNC Paths)
        bool isNetworkPath = _dbPath.StartsWith("\\\\");
        if (isNetworkPath) {
            await conn.ExecuteAsync("PRAGMA journal_mode = DELETE;");   // WAL is unstable on some network shares
            await conn.ExecuteAsync("PRAGMA busy_timeout = 30000;");    // Increase timeout to 30s
            Console.WriteLine("[DB] Applied Network Share Stability Settings (DELETE Mode, 30s Timeout).");
        } else {
            await conn.ExecuteAsync("PRAGMA journal_mode = WAL;");      // Faster locally
            await conn.ExecuteAsync("PRAGMA busy_timeout = 15000;");
        }
        
        await conn.ExecuteAsync("PRAGMA synchronous = NORMAL;");
        await conn.ExecuteAsync("PRAGMA cache_size = -64000;");
        await conn.ExecuteAsync("PRAGMA temp_store = MEMORY;");
        await conn.ExecuteAsync("PRAGMA mmap_size = 268435456;");

        var sql = @"
            CREATE TABLE IF NOT EXISTS Users (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Username TEXT UNIQUE,
                Password TEXT,
                Fullname TEXT,
                Role TEXT,
                Active INTEGER,
                CreatedAt TEXT
            );

            CREATE TABLE IF NOT EXISTS Archives (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Date TEXT,
                Filename TEXT,
                RecordCount INTEGER,
                Size TEXT,
                Headers TEXT
            );

            CREATE TABLE IF NOT EXISTS Returns (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ImportId INTEGER,
                RawData TEXT,
                ReturnCode TEXT,
                UploadDate TEXT,
                IsDeleted INTEGER DEFAULT 0,
                FOREIGN KEY(ImportId) REFERENCES Archives(Id) ON DELETE CASCADE
            );
            
            CREATE INDEX IF NOT EXISTS TXT_Returns_ImportId ON Returns(ImportId);
            CREATE INDEX IF NOT EXISTS IDX_Returns_ReturnCode ON Returns(ReturnCode);
            CREATE INDEX IF NOT EXISTS IDX_Returns_UploadDate ON Returns(UploadDate);
            CREATE INDEX IF NOT EXISTS IDX_Returns_IsDeleted ON Returns(IsDeleted);



            CREATE TABLE IF NOT EXISTS ReturnsImages (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ReturnId INTEGER,
                Filename TEXT,
                CreatedAt TEXT,
                FOREIGN KEY(ReturnId) REFERENCES Returns(Id) ON DELETE CASCADE
            );



            CREATE TABLE IF NOT EXISTS Filters (
                Id TEXT PRIMARY KEY,
                Name TEXT NOT NULL,
                Type TEXT NOT NULL,
                ValuesContent TEXT,
                MinValue REAL,
                MaxValue REAL,
                TargetPage TEXT,
                TargetColumn TEXT,
                Criteria TEXT,
                CreatedAt TEXT
            );

            CREATE TABLE IF NOT EXISTS FullReturns (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                RawData TEXT,
                CreatedAt TEXT
            );

            CREATE TABLE IF NOT EXISTS FullReturnsImages (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ReturnId INTEGER,
                Filename TEXT,
                CreatedAt TEXT,
                FOREIGN KEY(ReturnId) REFERENCES FullReturns(Id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS SalaryArchives (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Date TEXT,
                Filename TEXT,
                RecordCount INTEGER,
                Size TEXT,
                Headers TEXT
            );

            CREATE TABLE IF NOT EXISTS SalaryReturns (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ImportId INTEGER,
                RawData TEXT,
                ReturnCode TEXT,
                UploadDate TEXT,
                IsDeleted INTEGER DEFAULT 0,
                FOREIGN KEY(ImportId) REFERENCES SalaryArchives(Id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS IDX_SalaryReturns_ImportId ON SalaryReturns(ImportId);
            CREATE INDEX IF NOT EXISTS IDX_SalaryReturns_ReturnCode ON SalaryReturns(ReturnCode);
            CREATE INDEX IF NOT EXISTS IDX_SalaryReturns_UploadDate ON SalaryReturns(UploadDate);
            CREATE INDEX IF NOT EXISTS IDX_SalaryReturns_IsDeleted ON SalaryReturns(IsDeleted);

            CREATE TABLE IF NOT EXISTS SalaryReturnsImages (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ReturnId INTEGER,
                Filename TEXT,
                CreatedAt TEXT,
                FOREIGN KEY(ReturnId) REFERENCES SalaryReturns(Id) ON DELETE CASCADE
            );
        ";

        await conn.ExecuteAsync(sql);

        // Add Criteria column if it doesn't exist (Migration for existing DBs)
        try {
            await conn.ExecuteAsync("ALTER TABLE Filters ADD COLUMN Criteria TEXT;");
            Console.WriteLine("[DB] Added 'Criteria' column to Filters table.");
        } catch { /* Column likely already exists */ }

        // --- Performance & Search Optimization (FTS5) ---
        var ftsSql = @"
            -- Returns FTS
            CREATE VIRTUAL TABLE IF NOT EXISTS Returns_FTS USING fts5(RawData, content='Returns', content_rowid='Id');

            CREATE TRIGGER IF NOT EXISTS trg_Returns_ai AFTER INSERT ON Returns BEGIN
                INSERT INTO Returns_FTS(rowid, RawData) VALUES (new.Id, new.RawData);
            END;
            CREATE TRIGGER IF NOT EXISTS trg_Returns_ad AFTER DELETE ON Returns BEGIN
                INSERT INTO Returns_FTS(Returns_FTS, rowid, RawData) VALUES('delete', old.Id, old.RawData);
            END;
            CREATE TRIGGER IF NOT EXISTS trg_Returns_au AFTER UPDATE ON Returns BEGIN
                INSERT INTO Returns_FTS(Returns_FTS, rowid, RawData) VALUES('delete', old.Id, old.RawData);
                INSERT INTO Returns_FTS(rowid, RawData) VALUES (new.Id, new.RawData);
            END;

            -- FullReturns FTS
            CREATE VIRTUAL TABLE IF NOT EXISTS FullReturns_FTS USING fts5(RawData, content='FullReturns', content_rowid='Id');

            CREATE TRIGGER IF NOT EXISTS trg_FullReturns_ai AFTER INSERT ON FullReturns BEGIN
                INSERT INTO FullReturns_FTS(rowid, RawData) VALUES (new.Id, new.RawData);
            END;
            CREATE TRIGGER IF NOT EXISTS trg_FullReturns_ad AFTER DELETE ON FullReturns BEGIN
                INSERT INTO FullReturns_FTS(FullReturns_FTS, rowid, RawData) VALUES('delete', old.Id, old.RawData);
            END;
            CREATE TRIGGER IF NOT EXISTS trg_FullReturns_au AFTER UPDATE ON FullReturns BEGIN
                INSERT INTO FullReturns_FTS(FullReturns_FTS, rowid, RawData) VALUES('delete', old.Id, old.RawData);
                INSERT INTO FullReturns_FTS(rowid, RawData) VALUES (new.Id, new.RawData);
            END;

            -- SalaryReturns FTS
            CREATE VIRTUAL TABLE IF NOT EXISTS SalaryReturns_FTS USING fts5(RawData, content='SalaryReturns', content_rowid='Id');

            CREATE TRIGGER IF NOT EXISTS trg_SalaryReturns_ai AFTER INSERT ON SalaryReturns BEGIN
                INSERT INTO SalaryReturns_FTS(rowid, RawData) VALUES (new.Id, new.RawData);
            END;
            CREATE TRIGGER IF NOT EXISTS trg_SalaryReturns_ad AFTER DELETE ON SalaryReturns BEGIN
                INSERT INTO SalaryReturns_FTS(SalaryReturns_FTS, rowid, RawData) VALUES('delete', old.Id, old.RawData);
            END;
            CREATE TRIGGER IF NOT EXISTS trg_SalaryReturns_au AFTER UPDATE ON SalaryReturns BEGIN
                INSERT INTO SalaryReturns_FTS(SalaryReturns_FTS, rowid, RawData) VALUES('delete', old.Id, old.RawData);
                INSERT INTO SalaryReturns_FTS(rowid, RawData) VALUES (new.Id, new.RawData);
            END;
        ";

        await conn.ExecuteAsync(ftsSql);
        
        var notifSql = @"
            CREATE TABLE IF NOT EXISTS NotificationEvents (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                TableName TEXT,
                Operation TEXT,
                RowId INTEGER,
                CreatedAt TEXT,
                Status TEXT DEFAULT 'Pending',
                Error TEXT
            );

            CREATE TRIGGER IF NOT EXISTS trg_Returns_notify_ai AFTER INSERT ON Returns BEGIN
                INSERT INTO NotificationEvents(TableName, Operation, RowId, CreatedAt) VALUES('Returns','INSERT', NEW.Id, datetime('now','localtime'));
            END;
            CREATE TRIGGER IF NOT EXISTS trg_Returns_notify_au AFTER UPDATE ON Returns BEGIN
                INSERT INTO NotificationEvents(TableName, Operation, RowId, CreatedAt) VALUES('Returns','UPDATE', NEW.Id, datetime('now','localtime'));
            END;
            CREATE TRIGGER IF NOT EXISTS trg_Returns_notify_ad AFTER DELETE ON Returns BEGIN
                INSERT INTO NotificationEvents(TableName, Operation, RowId, CreatedAt) VALUES('Returns','DELETE', OLD.Id, datetime('now','localtime'));
            END;

            CREATE TRIGGER IF NOT EXISTS trg_SalaryReturns_notify_ai AFTER INSERT ON SalaryReturns BEGIN
                INSERT INTO NotificationEvents(TableName, Operation, RowId, CreatedAt) VALUES('SalaryReturns','INSERT', NEW.Id, datetime('now','localtime'));
            END;
            CREATE TRIGGER IF NOT EXISTS trg_SalaryReturns_notify_au AFTER UPDATE ON SalaryReturns BEGIN
                INSERT INTO NotificationEvents(TableName, Operation, RowId, CreatedAt) VALUES('SalaryReturns','UPDATE', NEW.Id, datetime('now','localtime'));
            END;
            CREATE TRIGGER IF NOT EXISTS trg_SalaryReturns_notify_ad AFTER DELETE ON SalaryReturns BEGIN
                INSERT INTO NotificationEvents(TableName, Operation, RowId, CreatedAt) VALUES('SalaryReturns','DELETE', OLD.Id, datetime('now','localtime'));
            END;

            CREATE TRIGGER IF NOT EXISTS trg_Archives_notify_ai AFTER INSERT ON Archives BEGIN
                INSERT INTO NotificationEvents(TableName, Operation, RowId, CreatedAt) VALUES('Archives','INSERT', NEW.Id, datetime('now','localtime'));
            END;
            CREATE TRIGGER IF NOT EXISTS trg_Archives_notify_au AFTER UPDATE ON Archives BEGIN
                INSERT INTO NotificationEvents(TableName, Operation, RowId, CreatedAt) VALUES('Archives','UPDATE', NEW.Id, datetime('now','localtime'));
            END;
            CREATE TRIGGER IF NOT EXISTS trg_Archives_notify_ad AFTER DELETE ON Archives BEGIN
                INSERT INTO NotificationEvents(TableName, Operation, RowId, CreatedAt) VALUES('Archives','DELETE', OLD.Id, datetime('now','localtime'));
            END;

            CREATE TRIGGER IF NOT EXISTS trg_SalaryArchives_notify_ai AFTER INSERT ON SalaryArchives BEGIN
                INSERT INTO NotificationEvents(TableName, Operation, RowId, CreatedAt) VALUES('SalaryArchives','INSERT', NEW.Id, datetime('now','localtime'));
            END;
            CREATE TRIGGER IF NOT EXISTS trg_SalaryArchives_notify_au AFTER UPDATE ON SalaryArchives BEGIN
                INSERT INTO NotificationEvents(TableName, Operation, RowId, CreatedAt) VALUES('SalaryArchives','UPDATE', NEW.Id, datetime('now','localtime'));
            END;
            CREATE TRIGGER IF NOT EXISTS trg_SalaryArchives_notify_ad AFTER DELETE ON SalaryArchives BEGIN
                INSERT INTO NotificationEvents(TableName, Operation, RowId, CreatedAt) VALUES('SalaryArchives','DELETE', OLD.Id, datetime('now','localtime'));
            END;

            CREATE TRIGGER IF NOT EXISTS trg_FullReturns_notify_ai AFTER INSERT ON FullReturns BEGIN
                INSERT INTO NotificationEvents(TableName, Operation, RowId, CreatedAt) VALUES('FullReturns','INSERT', NEW.Id, datetime('now','localtime'));
            END;
            CREATE TRIGGER IF NOT EXISTS trg_FullReturns_notify_au AFTER UPDATE ON FullReturns BEGIN
                INSERT INTO NotificationEvents(TableName, Operation, RowId, CreatedAt) VALUES('FullReturns','UPDATE', NEW.Id, datetime('now','localtime'));
            END;
            CREATE TRIGGER IF NOT EXISTS trg_FullReturns_notify_ad AFTER DELETE ON FullReturns BEGIN
                INSERT INTO NotificationEvents(TableName, Operation, RowId, CreatedAt) VALUES('FullReturns','DELETE', OLD.Id, datetime('now','localtime'));
            END;
        ";
        await conn.ExecuteAsync(notifSql);
        
        // Seed Admin User
        var userCount = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Users");
        if (userCount == 0)
        {
            await conn.ExecuteAsync(@"
                INSERT INTO Users (Username, Password, Fullname, Role, Active, CreatedAt) 
                VALUES (@Username, @Password, @Fullname, @Role, 1, @CreatedAt)",
                new { Username = "admin", Password = "0946777651a28a30367fc9b578c7857fa12add5f82c611481e360dc05a108a73", Fullname = "المدير العام", Role = "admin", CreatedAt = DateTime.Now }
            );
        }

        // Run Migration
        await EnsureSchema(conn);
        await MigrateReturnCodes(conn);
        await MigrateLegacyData(conn);
    }

    private async Task EnsureSchema(SqliteConnection conn) {
        try {
            // 1. Returns Table Optimization
            try {
                await conn.ExecuteScalarAsync("SELECT FileCode FROM Returns LIMIT 1");
            } catch {
                Console.WriteLine("[*] Optimization: Adding Indexed Columns to Returns...");
                await conn.ExecuteAsync(@"
                    ALTER TABLE Returns ADD COLUMN FileCode TEXT GENERATED ALWAYS AS (
                        COALESCE(
                            json_extract(RawData, '$.""كود الملف""'), 
                            json_extract(RawData, '$.""كـــود الملف""'),
                            json_extract(RawData, '$.""Batch ID\""'), 
                            json_extract(RawData, '$.Code'), 
                            json_extract(RawData, '$.FileCode')
                        )
                    ) VIRTUAL;");
                await conn.ExecuteAsync(@"
                    ALTER TABLE Returns ADD COLUMN Amount REAL GENERATED ALWAYS AS (
                        COALESCE(
                            CAST(json_extract(RawData, '$.""المبلغ""') AS REAL), 
                            CAST(json_extract(RawData, '$.""مبلغ""') AS REAL), 
                            CAST(json_extract(RawData, '$.""قيمة العملية""') AS REAL),
                            CAST(json_extract(RawData, '$.""صافي المبلغ""') AS REAL), 
                            CAST(json_extract(RawData, '$.""الإجمالي""') AS REAL),
                            CAST(json_extract(RawData, '$.Amount') AS REAL), 
                            0
                        )
                    ) VIRTUAL;");
                await conn.ExecuteAsync(@"
                    ALTER TABLE Returns ADD COLUMN SettlementDate TEXT GENERATED ALWAYS AS (
                        COALESCE(
                            json_extract(RawData, '$.""تاريخ اعتماد التعديل""'),
                            json_extract(RawData, '$.""تاريخ التسوية""'),
                            json_extract(RawData, '$.""تاريخ التنفيذ""'),
                            json_extract(RawData, '$.ModificationDate'),
                            json_extract(RawData, '$.SettlementDate')
                        )
                    ) VIRTUAL;");
                await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_FileCode ON Returns(FileCode);");
                await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_Amount ON Returns(Amount);");
                await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_SettlementDate ON Returns(SettlementDate);");
            }



            // Check Filters for new columns
            try {
                await conn.ExecuteScalarAsync("SELECT TargetPage FROM Filters LIMIT 1");
            } catch {
                Console.WriteLine("[*] Fixing Schema: Adding TargetPage and TargetColumn to Filters...");
                await conn.ExecuteAsync("ALTER TABLE Filters ADD COLUMN TargetPage TEXT");
                await conn.ExecuteAsync("ALTER TABLE Filters ADD COLUMN TargetColumn TEXT");
            }

            // 3. Add ReturnCode column if it doesn't exist
            try {
                await conn.ExecuteScalarAsync("SELECT ReturnCode FROM Returns LIMIT 1");
            } catch {
                Console.WriteLine("[*] Migration: Adding ReturnCode column to Returns...");
                await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN ReturnCode TEXT;");
                await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_ReturnCode ON Returns(ReturnCode);");
            }

            // 4. Add UploadDate column if it doesn't exist
            try {
                await conn.ExecuteScalarAsync("SELECT UploadDate FROM Returns LIMIT 1");
            } catch {
                Console.WriteLine("[*] Migration: Adding UploadDate column to Returns...");
                try {
                    // Try adding the column. If it fails because it exists (race condition), catch it.
                    await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN UploadDate TEXT;");
                    await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_UploadDate ON Returns(UploadDate);");
                    
                    // Set default value for existing records
                    var today = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                    await conn.ExecuteAsync($"UPDATE Returns SET UploadDate = '{today}' WHERE UploadDate IS NULL");
                    
                    Console.WriteLine("[*] Migration: UploadDate added successfully.");
                } catch (Exception alterEx) {
                    Console.WriteLine($"[!] UploadDate migration note: {alterEx.Message}");
                }
            }

            // 5. Add IsDeleted column to Returns & SalaryReturns if they don't exist
            try {
                await conn.ExecuteScalarAsync("SELECT IsDeleted FROM Returns LIMIT 1");
            } catch {
                Console.WriteLine("[*] Migration: Adding IsDeleted column to Returns...");
                try {
                    await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN IsDeleted INTEGER DEFAULT 0;");
                    await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_IsDeleted ON Returns(IsDeleted);");
                } catch { }
            }
            try {
                await conn.ExecuteScalarAsync("SELECT IsDeleted FROM SalaryReturns LIMIT 1");
            } catch {
                Console.WriteLine("[*] Migration: Adding IsDeleted column to SalaryReturns...");
                try {
                    await conn.ExecuteAsync("ALTER TABLE SalaryReturns ADD COLUMN IsDeleted INTEGER DEFAULT 0;");
                    await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_SalaryReturns_IsDeleted ON SalaryReturns(IsDeleted);");
                } catch { }
            }
        } catch (Exception ex) {
            Console.WriteLine($"[!] Schema Check Warning: {ex.Message}");
        }
    }

    private async Task MigrateReturnCodes(SqliteConnection conn)
    {
        try {
            var count = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Returns WHERE ReturnCode IS NULL OR trim(ReturnCode) = ''");
            if (count == 0) return;

            Console.WriteLine($"[*] Migrating {count} ReturnCodes (Forced Refresh)...");
            var data = await conn.QueryAsync<dynamic>("SELECT Id, FileCode, RawData FROM Returns WHERE ReturnCode IS NULL OR trim(ReturnCode) = ''");
            
            using var trans = conn.BeginTransaction();
            foreach (var row in data)
            {
                string fCode = row.FileCode;
                // If virtual column failed, try direct JSON extraction as fallback
                if (string.IsNullOrEmpty(fCode)) {
                    fCode = ExtractFileCodeDirect(row.RawData ?? "");
                }
                
                string rCode = ExtractReturnCode(fCode ?? "");
                await conn.ExecuteAsync("UPDATE Returns SET ReturnCode = @ReturnCode WHERE Id = @Id", new { ReturnCode = rCode, Id = row.Id }, trans);
            }
            trans.Commit();
            Console.WriteLine("[+] ReturnCode Migration Complete.");
        } catch (Exception ex) {
            Console.WriteLine($"[!] Migration Warning: {ex.Message}");
        }
    }

    private async Task MigrateLegacyData(SqliteConnection conn)
    {
        try {
            // Check if we need migration (Archives table empty but json exists)
            var count = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Archives");
            if (count > 0) return; // Already migrated or new DB

            // Migrate Users
            var usersFile = Path.Combine(_config.BasePath, "users_db.json");
            if (File.Exists(usersFile)) {
                var json = await File.ReadAllTextAsync(usersFile);
                var users = JsonSerializer.Deserialize<List<User>>(json);
                if (users != null) {
                    await conn.ExecuteAsync("DELETE FROM Users"); // Clear default admin
                    foreach(var u in users) {
                         await conn.ExecuteAsync(@"
                            INSERT INTO Users (Id, Username, Password, Fullname, Role, Active, CreatedAt) 
                            VALUES (@id, @username, @password, @fullname, @role, @active, @createdAt)", u);
                    }
                    // Fix sequence
                    await conn.ExecuteAsync("UPDATE sqlite_sequence SET seq = (SELECT MAX(Id) FROM Users) WHERE name = 'Users'");
                }
                Console.WriteLine("[+] Users Parsed.");
            }

            // Migrate Archives
            var archivesFile = Path.Combine(_config.BasePath, "archive_db.json");
            if (File.Exists(archivesFile)) {
                var json = await File.ReadAllTextAsync(archivesFile);
                var archives = JsonSerializer.Deserialize<List<ArchiveEntry>>(json);
                 if (archives != null) {
                    foreach(var a in archives) {
                        // Old ArchiveEntry had List<object> data, we ignore it here, we only want metadata
                        // We store Headers as String
                        var headersJson = "[]";
                        if (!string.IsNullOrEmpty(a.headers)) headersJson = a.headers; 
                        // Note: In old model it was List<string>, in new I changed to string in class, 
                        // BUT deserialize might fail if JSON has array. 
                        // I should use a temporary DTO for migration.
                        
                        await conn.ExecuteAsync(@"
                            INSERT INTO Archives (Id, Date, Filename, RecordCount, Size, Headers) 
                            VALUES (@id, @date, @filename, @recordCount, @size, @headers)", 
                            new { a.id, a.date, a.filename, a.recordCount, a.size, headers = headersJson });
                    }
                    await conn.ExecuteAsync("UPDATE sqlite_sequence SET seq = (SELECT MAX(Id) FROM Archives) WHERE name = 'Archives'");
                    Console.WriteLine("[+] Archives Parsed.");
                 }
            }

            // Migrate Returns
            var returnsFile = Path.Combine(_config.BasePath, "returns_db.json");
            if (File.Exists(returnsFile)) {
                Console.WriteLine("[*] Migrating Returns... this might take a moment.");
                var json = await File.ReadAllTextAsync(returnsFile);
                var returns = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(json);
                
                if (returns != null && returns.Count > 0) {
                     using var trans = conn.BeginTransaction();
                     var batchStart = 0;
                     var batchSize = 1000;
                     while (batchStart < returns.Count) {
                         var batch = returns.Skip(batchStart).Take(batchSize);
                         var dbBatch = batch.Select(r => {
                             int importId = 0;
                             if (r.ContainsKey("importId") && r["importId"] is JsonElement je && je.ValueKind == JsonValueKind.Number) {
                                 importId = je.GetInt32();
                             }
                             // Serialize the WHOLE row as RawData
                             return new { ImportId = importId, RawData = JsonSerializer.Serialize(r) };
                         });
                         
                         await conn.ExecuteAsync(@"
                            INSERT INTO Returns (ImportId, RawData) VALUES (@ImportId, @RawData)", dbBatch, trans);
                            
                         batchStart += batchSize;
                     }
                     trans.Commit();
                     Console.WriteLine($"[+] Migrated {returns.Count} returns.");
                }
            }
        } catch (Exception ex) {
            Console.WriteLine($"!!! MIGRATION ERROR: {ex.Message}");
        }
    }


    public SqliteConnection GetConnection()
    {
        // Return connection. Caller must call OpenAsync then apply session pragmas if needed.
        // But for WAL, it's persistent so InitDatabase is enough.
        return new SqliteConnection($"Data Source={_dbPath};Foreign Keys=True;Pooling=False;Cache=Shared");
    }

    public async Task<SqliteConnection> GetOpenConnectionAsync()
    {
        var conn = GetConnection();
        await conn.OpenAsync();
        
        bool isNetworkPath = _dbPath.StartsWith("\\\\");
        using var cmd = conn.CreateCommand();
        cmd.CommandText = isNetworkPath ? @"
            PRAGMA synchronous = NORMAL;
            PRAGMA journal_mode = DELETE;
            PRAGMA busy_timeout = 30000;
            PRAGMA cache_size = -32000;
        " : @"
            PRAGMA synchronous = NORMAL;
            PRAGMA cache_size = -32000;
            PRAGMA temp_store = MEMORY;
            PRAGMA busy_timeout = 15000;
        ";
        await cmd.ExecuteNonQueryAsync();
        return conn;
    }

    // ========================================
    // Robust Identity Extraction (Unified)
    // ========================================

    public static string ExtractName(string json)
    {
        if (string.IsNullOrEmpty(json)) return "Unknown";
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            
            // Priority keys (Most accurate first)
            string[] keys = new[] { 
                "الاســــم", "الاسم", "CREDITOR_NAME", "Creditor Name", "CreditorName", "Beneficiary Name", "اسم المستفيد", "Name",
                "BeneficiaryName", "Beneficiary_Name", "الاسم_بالكامل", "FullName", "اسم العميل", "الإسم", "Full Name", "اسم الموظف"
            };
            
            string[] excludeKeys = new[] { "رقم الحساب", "السويفت كود", "رقم الحساب الصحيح", "ACCOUNT_NUMBER", "IBAN" };

            // 1. Exact match in priority keys (cleaned)
            foreach (var prop in root.EnumerateObject()) {
                if (excludeKeys.Any(k => prop.Name.Contains(k, StringComparison.OrdinalIgnoreCase))) continue;
                string cleanPropName = CleanArabic(prop.Name);
                foreach(var k in keys) {
                    string cleanK = CleanArabic(k);
                    if (string.Equals(cleanPropName, cleanK, StringComparison.OrdinalIgnoreCase)) {
                        return (prop.Value.ValueKind == JsonValueKind.String ? prop.Value.GetString() : prop.Value.GetRawText()) ?? "Unknown";
                    }
                }
            }

            // 2. Fuzzy match (cleaned)
            var fuzzyKeys = new[] { "الاسم", "Name", "المستفيد", "العميل" };
            foreach (var prop in root.EnumerateObject()) {
                if (excludeKeys.Any(k => prop.Name.Contains(k, StringComparison.OrdinalIgnoreCase))) continue;
                string cleanPropName = CleanArabic(prop.Name);
                foreach (var fk in fuzzyKeys) {
                    string cleanFK = CleanArabic(fk);
                    if (cleanPropName.Contains(cleanFK, StringComparison.OrdinalIgnoreCase)) {
                        return (prop.Value.ValueKind == JsonValueKind.String ? prop.Value.GetString() : prop.Value.GetRawText()) ?? "Unknown";
                    }
                }
            }
            return "Unknown";
        }
        catch { return "Unknown"; }
    }

    public static string ExtractNID(string json)
    {
        if (string.IsNullOrEmpty(json)) return "";
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            
            string[] nidKeys = new[] { "NationalID", "NID", "National_ID", "الرقم_القومي", "الرقم القومي", "National Id", "NationalId", "رقم قومي", "رقم البطاقة", "National ID", "الرقم القومى" };
            string[] excludeKeys = new[] { "رقم الحساب", "ACCOUNT_NUMBER", "IBAN" };

            foreach (var prop in root.EnumerateObject()) {
                foreach(var k in nidKeys) {
                    if (string.Equals(prop.Name, k, StringComparison.OrdinalIgnoreCase)) {
                        string? res = prop.Value.ValueKind == JsonValueKind.String ? prop.Value.GetString() : prop.Value.GetRawText();
                        string cleanRes = Regex.Replace(res ?? "", @"[^\d]", "");
                        if (cleanRes.Length >= 10 && cleanRes.Length <= 14) return cleanRes;
                    }
                }
            }

            // Regex Search as fallback
            foreach (var prop in root.EnumerateObject()) {
                if (excludeKeys.Any(ex => prop.Name.Contains(ex, StringComparison.OrdinalIgnoreCase))) continue;
                string val = (prop.Value.ValueKind == JsonValueKind.String ? prop.Value.GetString() : prop.Value.GetRawText()) ?? "";
                var match = Regex.Match(val, @"\d{14}");
                if (match.Success) return match.Value;
            }

            return "";
        }
        catch { return ""; }
    }

    public static string CleanArabic(string name, bool strict = false)
    {
        if (string.IsNullOrWhiteSpace(name)) return "";
        string text = name.Trim();
        
        // Remove Kashida and Non-breaking spaces always
        text = text.Replace("ـ", "").Replace("\u00A0", " ");
        
        // Unify "عبد" names (عبد الباقي -> عبدالباقي)
        text = text.Replace("عبد ", "عبد");
        
        // Literal Match with Smart Variations: Clean spaces, kashida, and normalize (Alef, Yaa, Ta Marbuta)
        if (strict) {
            text = Regex.Replace(text, @"[\u0622\u0623\u0625\u0671\u0627]", "ا"); // Alef
            text = text.Replace("ة", "ه").Replace("ى", "ي").Replace("ؤ", "و").Replace("ئ", "ي"); // Final characters
            text = Regex.Replace(text, @"[^\u0600-\u06FFa-zA-Z0-9\s]", " "); // Replace any non-alphanumeric/non-Arabic with space
            text = Regex.Replace(text, @"\s+", " ");
            return text.Trim();
        }

        // Normalization for fuzzy matching
        text = Regex.Replace(text, @"[\u064B-\u065F]", ""); // Tashkeel
        text = Regex.Replace(text, @"[\u0622\u0623\u0625\u0671\u0627]", "ا"); // Alef variants (A, I, kashida, etc)
        text = text.Replace("ة", "ه").Replace("ى", "ي").Replace("ؤ", "و").Replace("ئ", "ي");
        text = Regex.Replace(text, @"\s+", " ");
        return text.Trim();
    }

    public static string CleanFileName(string name)
    {
        if (string.IsNullOrEmpty(name)) return "Record";
        // Remove invalid characters for file system
        var invalid = Path.GetInvalidFileNameChars();
        return new string(name.Where(ch => !invalid.Contains(ch)).ToArray()).Trim();
    }

    public static string ExtractReturnCode(string fileCode)
    {
        if (string.IsNullOrEmpty(fileCode)) return "";
        fileCode = fileCode.Trim();
        var parts = fileCode.Split('-', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        
        // Pattern 1: Army-c-448-46-12-2025 -> 448 (Part index 2)
        if (fileCode.StartsWith("Army-c-", StringComparison.OrdinalIgnoreCase) && parts.Length >= 3) {
            return parts[2];
        }
        
        // Pattern 2: Army-8001012600529-02-2026 -> 8001012600529 (Part index 1)
        if (fileCode.StartsWith("Army-", StringComparison.OrdinalIgnoreCase) && parts.Length >= 2) {
            return parts[1];
        }

        return ""; 
    }

    public static string ExtractFileCodeDirect(string json) {
        if (string.IsNullOrEmpty(json)) return "";
        try {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            
            // Check common variants including those with kashida
            string[] keys = new[] { "كود الملف", "كـود الملف", "كــود الملف", "كـــود الملف", "كــــود الملف", "كـــــود الملف", "Batch ID", "Code", "FileCode" };
            foreach (var k in keys) {
                if (root.TryGetProperty(k, out var p)) return p.ToString();
            }
            // Even fuzzier check for keys starting with "ك" and containing "الملف"
            foreach (var prop in root.EnumerateObject()) {
                string cleanName = CleanArabic(prop.Name);
                if (cleanName.Contains("كود الملف") || (cleanName.StartsWith("ك") && cleanName.Contains("الملف"))) return prop.Value.ToString();
            }
            return "";
        } catch { return ""; }
    }

    // --- Filter Management Logic ---

    public async Task<List<HKServer.Models.FilterDefinition>> GetFiltersAsync()
    {
        using var conn = GetConnection();
        var sql = "SELECT * FROM Filters ORDER BY CreatedAt DESC";
        var items = await conn.QueryAsync<dynamic>(sql);
        var result = new List<HKServer.Models.FilterDefinition>();
        
        foreach(var item in items) {
            var filter = new HKServer.Models.FilterDefinition {
                Id = item.Id,
                Name = item.Name,
                Type = item.Type,
                ValuesContent = item.ValuesContent,
                MinValue = (double?)item.MinValue,
                MaxValue = (double?)item.MaxValue,
                TargetPage = item.TargetPage,
                TargetColumn = item.TargetColumn,
                CreatedAt = item.CreatedAt
            };
            
            if (item.Criteria != null && !string.IsNullOrEmpty((string)item.Criteria)) {
                try {
                    filter.Criteria = JsonSerializer.Deserialize<List<HKServer.Models.FilterCriterion>>((string)item.Criteria) ?? new();
                } catch { 
                    filter.Criteria = new();
                }
            }
            
            // Auto-migrate single criterion if Criteria list is empty
            if (filter.Criteria.Count == 0 && !string.IsNullOrEmpty(filter.Type)) {
                filter.Criteria.Add(new HKServer.Models.FilterCriterion {
                    Type = filter.Type,
                    ValuesContent = filter.ValuesContent,
                    MinValue = filter.MinValue,
                    MaxValue = filter.MaxValue,
                    TargetColumn = filter.TargetColumn
                });
            }
            
            result.Add(filter);
        }
        return result;
    }

    public async Task AddFilterAsync(HKServer.Models.FilterDefinition filter)
    {
        using var conn = GetConnection();
        var criteriaJson = JsonSerializer.Serialize(filter.Criteria);
        var sql = @"INSERT INTO Filters (Id, Name, Type, ValuesContent, MinValue, MaxValue, TargetPage, TargetColumn, Criteria, CreatedAt) 
                    VALUES (@Id, @Name, @Type, @ValuesContent, @MinValue, @MaxValue, @TargetPage, @TargetColumn, @Criteria, @CreatedAt)";
        await conn.ExecuteAsync(sql, new { 
            filter.Id, filter.Name, filter.Type, filter.ValuesContent, filter.MinValue, filter.MaxValue, 
            filter.TargetPage, filter.TargetColumn, Criteria = criteriaJson, filter.CreatedAt 
        });
    }

    public async Task UpdateFilterAsync(HKServer.Models.FilterDefinition filter)
    {
        using var conn = GetConnection();
        var criteriaJson = JsonSerializer.Serialize(filter.Criteria);
        var sql = @"UPDATE Filters SET 
                    Name = @Name, 
                    Type = @Type, 
                    ValuesContent = @ValuesContent, 
                    MinValue = @MinValue, 
                    MaxValue = @MaxValue,
                    TargetPage = @TargetPage,
                    TargetColumn = @TargetColumn,
                    Criteria = @Criteria
                    WHERE Id = @Id";
        await conn.ExecuteAsync(sql, new { 
            filter.Id, filter.Name, filter.Type, filter.ValuesContent, filter.MinValue, filter.MaxValue, 
            filter.TargetPage, filter.TargetColumn, Criteria = criteriaJson
        });
    }

    public async Task<HKServer.Models.FilterDefinition?> GetFilterByIdAsync(string id)
    {
        using var conn = GetConnection();
        var sql = "SELECT * FROM Filters WHERE Id = @Id";
        var item = await conn.QueryFirstOrDefaultAsync<dynamic>(sql, new { Id = id });
        if (item == null) return null;

        var filter = new HKServer.Models.FilterDefinition {
            Id = item.Id,
            Name = item.Name,
            Type = item.Type,
            ValuesContent = item.ValuesContent,
            MinValue = (double?)item.MinValue,
            MaxValue = (double?)item.MaxValue,
            TargetPage = item.TargetPage,
            TargetColumn = item.TargetColumn,
            CreatedAt = item.CreatedAt
        };

        if (item.Criteria != null && !string.IsNullOrEmpty((string)item.Criteria)) {
            try {
                filter.Criteria = JsonSerializer.Deserialize<List<HKServer.Models.FilterCriterion>>((string)item.Criteria) ?? new();
            } catch {
                filter.Criteria = new();
            }
        }
        
        // Auto-migrate single criterion
        if (filter.Criteria.Count == 0 && !string.IsNullOrEmpty(filter.Type)) {
            filter.Criteria.Add(new HKServer.Models.FilterCriterion {
                Type = filter.Type,
                ValuesContent = filter.ValuesContent,
                MinValue = filter.MinValue,
                MaxValue = filter.MaxValue,
                TargetColumn = filter.TargetColumn
            });
        }
        
        return filter;
    }

    public async Task DeleteFilterAsync(string id)
    {
        using var conn = GetConnection();
        var sql = "DELETE FROM Filters WHERE Id = @Id";
        await conn.ExecuteAsync(sql, new { Id = id });
    }

    public async Task<(List<int> ReturnIds, List<int> SalaryIds)> GetRelatedIdsAcrossTables(int sourceId, string tableType)
    {
        using var conn = await GetOpenConnectionAsync();
        string name = "Unknown", nid = "";
        
        if (tableType == "returns") {
            var raw = await conn.QueryFirstOrDefaultAsync<string>("SELECT RawData FROM Returns WHERE Id = @Id", new { Id = sourceId });
            if (!string.IsNullOrEmpty(raw)) {
                name = ExtractName(raw);
                nid = ExtractNID(raw);
            }
        } else if (tableType == "salary") {
            var raw = await conn.QueryFirstOrDefaultAsync<string>("SELECT RawData FROM SalaryReturns WHERE Id = @Id", new { Id = sourceId });
            if (!string.IsNullOrEmpty(raw)) {
                name = ExtractName(raw);
                nid = ExtractNID(raw);
            }
        }

        var returnIds = new List<int>();
        var salaryIds = new List<int>();

        if (name == "Unknown" && string.IsNullOrEmpty(nid)) {
            if (tableType == "returns") returnIds.Add(sourceId);
            else salaryIds.Add(sourceId);
            return (returnIds, salaryIds);
        }

        string cleanName = CleanArabic(name);
        
        // Find in Returns
        var rIds = await conn.QueryAsync<int>(@"
            SELECT Id FROM Returns 
            WHERE Id = @SourceId OR Id IN (
                SELECT rowid FROM Returns_FTS 
                WHERE Returns_FTS MATCH @CleanName
            )
        ", new { SourceId = (tableType == "returns" ? sourceId : -1), CleanName = cleanName });
        returnIds.AddRange(rIds);
        
        if (!string.IsNullOrEmpty(nid)) {
            var rNidIds = await conn.QueryAsync<int>(@"
                SELECT Id FROM Returns WHERE RawData LIKE @Nid
            ", new { Nid = $"%{nid}%" });
            returnIds.AddRange(rNidIds);
        }

        // Find in SalaryReturns
        var sIds = await conn.QueryAsync<int>(@"
            SELECT Id FROM SalaryReturns 
            WHERE Id = @SourceId OR Id IN (
                SELECT rowid FROM SalaryReturns_FTS 
                WHERE SalaryReturns_FTS MATCH @CleanName
            )
        ", new { SourceId = (tableType == "salary" ? sourceId : -1), CleanName = cleanName });
        salaryIds.AddRange(sIds);

        if (!string.IsNullOrEmpty(nid)) {
            var sNidIds = await conn.QueryAsync<int>(@"
                SELECT Id FROM SalaryReturns WHERE RawData LIKE @Nid
            ", new { Nid = $"%{nid}%" });
            salaryIds.AddRange(sNidIds);
        }

        return (returnIds.Distinct().ToList(), salaryIds.Distinct().ToList());
    }
}
