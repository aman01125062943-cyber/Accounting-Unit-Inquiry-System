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
using Microsoft.Extensions.Configuration;

namespace HKServer.Services;

public class DatabaseService
{
    private static readonly string[] OfficialImportHeaders =
    {
        "كود الملف",
        "الاسم",
        "الرقم القومي",
        "رقم الحساب",
        "البنك",
        "قيمة العملية",
        "الحالة",
        "السبب",
        "رقم الحساب بعد التعديل",
        "البنك بعد التعديل",
        "كود الفرع بعد التعديل",
        "رقم تسوية التعلية",
        "تاريخ المرتد / تاريخ التعلية",
        "تاريخ اعتماد المرتدات",
        "تاريخ التعديل",
        "تاريخ اعتماد التعديل",
        "رقم تسوية السداد",
        "تاريخ اعتماد التعديل / تاريخ السداد"
    };

    private static readonly Dictionary<string, string[]> ImportHeaderAliases = new(StringComparer.Ordinal)
    {
        ["كود الملف"] = new[] { "كودالملف", "FileCode", "Code", "Batch ID", "BatchCode" },
        ["الاسم"] = new[] { "Name", "FullName", "CREDITOR_NAME", "Beneficiary Name", "اسم المستفيد" },
        ["الرقم القومي"] = new[] { "الرقم القومى", "الرقم_القومي", "NationalID", "National Id", "National ID", "NID", "رقم قومي" },
        ["رقم الحساب"] = new[] { "AccountNumber", "Account No", "CurrentAccount", "ACCOUNT_NUMBER", "رقمالحساب" },
        ["البنك"] = new[] { "Bank", "CurrentBank", "اسم البنك" },
        ["قيمة العملية"] = new[] { "Amount", "Transaction Value", "Value", "المبلغ", "القيمة" },
        ["الحالة"] = new[] { "Status", "ReturnStatus", "حالة الارتداد" },
        ["السبب"] = new[] { "Reason" },
        ["رقم الحساب بعد التعديل"] = new[] { "EditedAccountNumber", "NewAccountNumber", "ModifiedAccount", "رقم الحساب الجديد", "الحساب الجديد", "تعديل رقم الحساب" },
        ["البنك بعد التعديل"] = new[] { "ModifiedBank", "البنك الجديد", "اسم البنك الجديد" },
        ["كود الفرع بعد التعديل"] = new[] { "BranchCode", "ModifiedBranchCode" },
        ["رقم تسوية التعلية"] = new[] { "ElevationSettlementNo", "AccrualSettlementNo", "رقم تسوية تعلية", "تسوية تعلية" },
        ["تاريخ المرتد / تاريخ التعلية"] = new[] { "تاريخ المرتد/تاريخ التعلية", "تاريخ المرتد", "تاريخ المرتدات", "تاريخ التعلية", "ReturnDate" },
        ["تاريخ اعتماد المرتدات"] = new[] { "ReturnApprovalDate" },
        ["تاريخ التعديل"] = new[] { "ModDate", "ModificationDate" },
        ["تاريخ اعتماد التعديل"] = new[] { "ModApprovalDate" },
        ["رقم تسوية السداد"] = new[] { "SettlementNo", "Settlement No", "رقم التسوية", "رقم تسوية سداد" },
        ["تاريخ اعتماد التعديل / تاريخ السداد"] = new[] { "تاريخ اعتماد التعديل/تاريخ السداد", "تاريخ السداد", "تاريخ التسوية", "تاريخ السداد الفعلي", "SettlementDate", "Settlement Date", "تاريخ تسوية السداد" }
    };

    private ServerConfig _config = new();
    private string _dbPath;
    private string _connectionString;
    private DatabasePathValidationResult? _lastValidation;
    private bool _validatedForCurrentSession;
    private readonly bool _enableDatabaseDiagnostics;
    private readonly object _pathLock = new();

    public DatabaseService(IConfiguration configuration)
    {
        _enableDatabaseDiagnostics = IsDatabaseDiagnosticsEnabled(configuration);
        _config = LoadServerConfig();
        _dbPath = ResolveDatabasePath(configuration, out var startupValidation);
        _connectionString = BuildConnectionString(_dbPath);
        var validation = startupValidation ?? ValidateDatabasePath(_dbPath);
        if (!validation.Success)
        {
            _lastValidation = validation;
            _validatedForCurrentSession = false;
            Console.WriteLine($"[DB][CRITICAL] Configured SQLite database is not available: {FormatDatabasePathForLog(_dbPath, _enableDatabaseDiagnostics)}");
            Console.WriteLine(_enableDatabaseDiagnostics
                ? $"[DB][CRITICAL] {validation.Code}: {validation.Message}"
                : $"[DB][CRITICAL] {validation.Code}: enable EnableDatabaseDiagnostics for full database path diagnostics.");
            Console.WriteLine("[DB][CRITICAL] No local SQLite fallback will be used. Fix the configured database path from Settings.");
            return;
        }
        _lastValidation = validation;
        _validatedForCurrentSession = true;
        Console.WriteLine($"[DB] Using SQLite database: {FormatDatabasePathForLog(_dbPath, _enableDatabaseDiagnostics)}");
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

    private static string ResolveDatabasePath(IConfiguration configuration, out DatabasePathValidationResult? startupValidation)
    {
        startupValidation = null;
        var savedConfig = LoadServerConfig();
        var configuredPath =
            FirstNonEmpty(savedConfig.DatabasePath, configuration["DatabasePath"], configuration["LocalDatabasePath"])
            ?? ServerConfig.DefaultDatabasePath;
        var enableDatabaseDiagnostics = IsDatabaseDiagnosticsEnabled(configuration);

        DatabasePathResolution normalized;
        try
        {
            normalized = NormalizeDatabasePath(configuredPath);
        }
        catch (Exception ex)
        {
            startupValidation = DatabasePathValidationResult.Fail(
                "invalid_path",
                $"Invalid configured SQLite database path: {ex.Message}",
                configuredPath);
            return configuredPath;
        }

        startupValidation = ValidateDatabasePath(normalized.DatabasePath);
        if (startupValidation.Success)
        {
            savedConfig.DatabasePath = normalized.DatabasePath;
            savedConfig.BasePath = Path.GetDirectoryName(normalized.DatabasePath) ?? savedConfig.BasePath;
            savedConfig.LastSuccessfulDatabasePath = normalized.DatabasePath;
            savedConfig.LastSuccessfulDatabaseConnection = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            SaveServerConfig(savedConfig);
            Console.WriteLine($"[DB] Using configured SQLite database: {FormatDatabasePathForLog(normalized.DatabasePath, enableDatabaseDiagnostics)}");
        }
        else
        {
            Console.WriteLine(enableDatabaseDiagnostics
                ? $"[DB] Configured path rejected: {normalized.DatabasePath} | {startupValidation.Code}: {startupValidation.Message}"
                : $"[DB] Configured path rejected: {FormatDatabasePathForLog(normalized.DatabasePath, false)} | {startupValidation.Code}");
        }

        return normalized.DatabasePath;
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))?.Trim();

    public static DatabasePathResolution NormalizeDatabasePath(string inputPath)
    {
        var expanded = Environment.ExpandEnvironmentVariables(inputPath.Trim().Trim('"'));
        if (!Path.IsPathRooted(expanded))
        {
            expanded = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, expanded);
        }

        var fullPath = Path.GetFullPath(expanded);
        var extension = Path.GetExtension(fullPath);
        var hasDatabaseExtension =
            extension.Equals(".db", StringComparison.OrdinalIgnoreCase) ||
            extension.Equals(".sqlite", StringComparison.OrdinalIgnoreCase) ||
            extension.Equals(".sqlite3", StringComparison.OrdinalIgnoreCase);

        if (hasDatabaseExtension)
        {
            return new DatabasePathResolution(fullPath, false);
        }

        if (File.Exists(fullPath))
        {
            throw new InvalidOperationException("Invalid database file type. Please select a .db, .sqlite, or .sqlite3 file.");
        }

        return new DatabasePathResolution(Path.Combine(fullPath, "hk.db"), true);
    }

    public static DatabasePathValidationResult ValidateDatabasePath(string dbPath, bool requireExistingFile = true)
    {
        var task = Task.Run(() => ValidateDatabasePathCore(dbPath, requireExistingFile));
        if (!task.Wait(TimeSpan.FromSeconds(4)))
        {
            return DatabasePathValidationResult.Fail(
                dbPath.StartsWith(@"\\", StringComparison.Ordinal) ? "shared_folder_unavailable" : "connection_timeout",
                $"Timed out after 4 seconds while checking SQLite database path: {dbPath}",
                dbPath);
        }

        return task.GetAwaiter().GetResult();
    }

    private static DatabasePathValidationResult ValidateDatabasePathCore(string dbPath, bool requireExistingFile = true)
    {
        var directory = Path.GetDirectoryName(dbPath);
        if (string.IsNullOrWhiteSpace(directory))
        {
            return DatabasePathValidationResult.Fail("invalid_path", $"Invalid SQLite database path: {dbPath}", dbPath);
        }

        if (!Directory.Exists(directory))
        {
            return DatabasePathValidationResult.Fail(
                dbPath.StartsWith(@"\\", StringComparison.Ordinal) ? "shared_folder_unavailable" : "folder_not_found",
                $"SQLite database folder is not available: {directory}",
                dbPath);
        }

        if (requireExistingFile && !File.Exists(dbPath))
        {
            return DatabasePathValidationResult.Fail("file_not_found", $"SQLite database file was not found: {dbPath}", dbPath);
        }

        var probePath = Path.Combine(directory, $".hk_write_test_{Guid.NewGuid():N}.tmp");
        try
        {
            File.WriteAllText(probePath, "test");
            _ = File.ReadAllText(probePath);
        }
        catch (Exception ex)
        {
            return DatabasePathValidationResult.Fail("permission_denied", $"SQLite database folder must allow read/write/create access: {directory}. {ex.Message}", dbPath);
        }
        finally
        {
            try
            {
                if (File.Exists(probePath)) File.Delete(probePath);
            }
            catch { }
        }

        try
        {
            var builder = new SqliteConnectionStringBuilder
            {
                DataSource = dbPath,
                Mode = requireExistingFile ? SqliteOpenMode.ReadWrite : SqliteOpenMode.ReadWriteCreate,
                Pooling = false,
                DefaultTimeout = 3
            };

            using var conn = new SqliteConnection(builder.ToString());
            conn.Open();
            using var pragmaCmd = conn.CreateCommand();
            pragmaCmd.CommandText = "PRAGMA busy_timeout=3000;";
            pragmaCmd.ExecuteNonQuery();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT name FROM sqlite_master LIMIT 1;";
            _ = cmd.ExecuteScalar();
        }
        catch (SqliteException ex) when (ex.SqliteErrorCode == 5 || ex.SqliteErrorCode == 6)
        {
            return DatabasePathValidationResult.Fail("sqlite_locked", $"SQLite database is locked or busy: {ex.Message}", dbPath);
        }
        catch (SqliteException ex) when (ex.SqliteErrorCode == 14)
        {
            return DatabasePathValidationResult.Fail("permission_denied", $"SQLite cannot open the database file. Check read/write/lock permissions: {ex.Message}", dbPath);
        }
        catch (UnauthorizedAccessException ex)
        {
            return DatabasePathValidationResult.Fail("permission_denied", $"Permission denied: {ex.Message}", dbPath);
        }
        catch (IOException ex)
        {
            return DatabasePathValidationResult.Fail("shared_folder_unavailable", $"Cannot access the SQLite file or network share: {ex.Message}", dbPath);
        }
        catch (Exception ex)
        {
            return DatabasePathValidationResult.Fail("invalid_sqlite", $"The selected file is not a usable SQLite database: {ex.Message}", dbPath);
        }

        return DatabasePathValidationResult.Ok(dbPath);
    }

    public string GetDbPath()
    {
        lock (_pathLock) return _dbPath;
    }

    public void SetDatabasePath(string databasePath, bool createIfMissing = false) {
        var normalized = NormalizeDatabasePath(databasePath);
        var validation = ValidateDatabasePath(normalized.DatabasePath, requireExistingFile: !createIfMissing);
        if (!validation.Success)
        {
            throw new InvalidOperationException(validation.Message);
        }

        lock (_pathLock)
        {
            _dbPath = normalized.DatabasePath;
            _connectionString = BuildConnectionString(_dbPath);
            _lastValidation = validation;
            _validatedForCurrentSession = true;
        }

        _config.DatabasePath = normalized.DatabasePath;
        _config.BasePath = Path.GetDirectoryName(normalized.DatabasePath) ?? _config.BasePath;
        _config.LastSuccessfulDatabasePath = normalized.DatabasePath;
        _config.LastSuccessfulDatabaseConnection = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        SaveServerConfig(_config);
    }

    public DbConnection GetConnection()
    {
        lock (_pathLock)
        {
            return new SqliteConnection(_connectionString);
        }
    }

    public async Task<DbConnection> GetOpenConnectionAsync()
    {
        var conn = GetConnection();
        try
        {
            await conn.OpenAsync();
            await ApplySafePragmasAsync(conn);
            lock (_pathLock)
            {
                _lastValidation = DatabasePathValidationResult.Ok(_dbPath);
                _validatedForCurrentSession = true;
            }
            return conn;
        }
        catch (Exception ex)
        {
            if (_enableDatabaseDiagnostics)
            {
                LogDatabaseOpenDiagnostics(_dbPath, ex);
            }
            lock (_pathLock)
            {
                _lastValidation = DatabasePathValidationResult.Fail(
                    "connection_failed",
                    $"SQLite connection failed for configured database path: {ex.Message}",
                    _dbPath);
                _validatedForCurrentSession = false;
            }
            await conn.DisposeAsync();
            throw;
        }
    }

    private static void LogDatabaseOpenDiagnostics(string dbPath, Exception openException)
    {
        var directory = "";
        try { directory = Path.GetDirectoryName(dbPath) ?? ""; } catch { }

        var directoryExists = false;
        var fileExists = false;
        var canRead = false;
        var canWrite = false;
        var tempFile = string.IsNullOrWhiteSpace(directory) ? "" : Path.Combine(directory, $".hk_sqlite_probe_{Guid.NewGuid():N}.tmp");

        try { directoryExists = !string.IsNullOrWhiteSpace(directory) && Directory.Exists(directory); } catch { }
        try { fileExists = File.Exists(dbPath); } catch { }

        try
        {
            if (fileExists)
            {
                using var stream = File.Open(dbPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                canRead = true;
            }
        }
        catch { }

        try
        {
            if (directoryExists)
            {
                File.WriteAllText(tempFile, "probe");
                canWrite = true;
            }
        }
        catch { }
        finally
        {
            try { if (!string.IsNullOrWhiteSpace(tempFile) && File.Exists(tempFile)) File.Delete(tempFile); } catch { }
        }

        Console.WriteLine("[DB DIAG] SQLite open failed.");
        Console.WriteLine($"[DB DIAG] DatabasePath={dbPath}");
        Console.WriteLine($"[DB DIAG] Directory={directory}");
        Console.WriteLine($"[DB DIAG] Directory.Exists={directoryExists}");
        Console.WriteLine($"[DB DIAG] File.Exists={fileExists}");
        Console.WriteLine($"[DB DIAG] CanRead={canRead}");
        Console.WriteLine($"[DB DIAG] CanWriteInDirectory={canWrite}");
        Console.WriteLine($"[DB DIAG] CurrentUser={Environment.UserDomainName}\\{Environment.UserName}");
        Console.WriteLine($"[DB DIAG] OpenError={openException.GetType().Name}: {openException.Message}");
    }

    private static bool IsDatabaseDiagnosticsEnabled(IConfiguration configuration) =>
        bool.TryParse(configuration["EnableDatabaseDiagnostics"], out var enabled) && enabled;

    private static string FormatDatabasePathForLog(string dbPath, bool includeFullPath)
    {
        if (includeFullPath) return dbPath;
        if (string.IsNullOrWhiteSpace(dbPath)) return "<empty>";
        if (dbPath.StartsWith(@"\\", StringComparison.Ordinal)) return "<network SQLite path>";
        try { return Path.GetFileName(dbPath); } catch { return "<SQLite path>"; }
    }

    public DatabasePathValidationResult GetCachedConnectionStatus()
    {
        lock (_pathLock)
        {
            return _lastValidation ?? DatabasePathValidationResult.Fail("not_tested", "Connection has not been tested yet.", _dbPath);
        }
    }

    public DatabasePathValidationResult TestCurrentConnection()
    {
        lock (_pathLock)
        {
            if (_validatedForCurrentSession && _lastValidation?.Success == true)
            {
                return _lastValidation;
            }
        }

        var path = GetDbPath();
        var validation = ValidateDatabasePath(path);
        lock (_pathLock)
        {
            _lastValidation = validation;
            _validatedForCurrentSession = validation.Success;
        }
        return validation;
    }

    private static string BuildConnectionString(string dbPath)
    {
        var builder = new SqliteConnectionStringBuilder
        {
            DataSource = dbPath,
            Mode = SqliteOpenMode.ReadWrite,
            Pooling = false, // Disable pooling to avoid file handle persistence issues
            DefaultTimeout = 10
        };
        return builder.ToString();
    }

    private static async Task ApplySafePragmasAsync(DbConnection conn)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            PRAGMA busy_timeout=15000;
            PRAGMA journal_mode=DELETE;
            PRAGMA cache_size=-65536;
            PRAGMA temp_store=MEMORY;
            PRAGMA synchronous=NORMAL;";
        await cmd.ExecuteNonQueryAsync();
    }

    public bool IsNetworkDatabase()
    {
        return GetDbPath().StartsWith(@"\\", StringComparison.Ordinal);
    }

    public async Task InitDatabase()
    {
        const int SCHEMA_VERSION = 13;
        using var conn = await GetOpenConnectionAsync();

        // Switch away from WAL mode on network shares (run once, non-fatal)
        if (IsNetworkDatabase())
        {
            try
            {
                using var walCmd = conn.CreateCommand();
                walCmd.CommandTimeout = 10;
                walCmd.CommandText = "PRAGMA journal_mode=DELETE;";
                await walCmd.ExecuteNonQueryAsync();
                Console.WriteLine("[DB] Journal mode set to DELETE (network share).");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB] Could not switch journal mode: {ex.Message}");
            }
        }

        var sql = @"
            CREATE TABLE IF NOT EXISTS Users (Id INTEGER PRIMARY KEY AUTOINCREMENT, Username TEXT UNIQUE, Password TEXT, Fullname TEXT, Role TEXT, Active INTEGER, CreatedAt TEXT);
            CREATE TABLE IF NOT EXISTS Archives (Id INTEGER PRIMARY KEY AUTOINCREMENT, Date TEXT, Filename TEXT, RecordCount INTEGER, Size TEXT, Headers TEXT, ExclusiveUserId INTEGER);
            CREATE TABLE IF NOT EXISTS Returns (Id INTEGER PRIMARY KEY AUTOINCREMENT, ImportId INTEGER, RawData TEXT, ReturnCode TEXT, UploadDate TEXT, IsDeleted INTEGER DEFAULT 0, IsArchived INTEGER DEFAULT 0, ArchivedBatchId INTEGER NULL, UpdatedAt TEXT, [رقم تسوية التعلية] TEXT, [رقم تسوية السداد] TEXT, FOREIGN KEY(ImportId) REFERENCES Archives(Id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS ReturnsImages (Id INTEGER PRIMARY KEY AUTOINCREMENT, ReturnId INTEGER, Filename TEXT, CreatedAt TEXT, FOREIGN KEY(ReturnId) REFERENCES Returns(Id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS Filters (Id TEXT PRIMARY KEY, Name TEXT NOT NULL, Type TEXT NOT NULL, ValuesContent TEXT, MinValue REAL, MaxValue REAL, TargetPage TEXT, TargetColumn TEXT, Criteria TEXT, CreatedAt TEXT);
            CREATE TABLE IF NOT EXISTS FullReturns (Id INTEGER PRIMARY KEY AUTOINCREMENT, RawData TEXT, CreatedAt TEXT, UpdatedAt TEXT);
            CREATE TABLE IF NOT EXISTS FullReturnsImages (Id INTEGER PRIMARY KEY AUTOINCREMENT, ReturnId INTEGER, Filename TEXT, CreatedAt TEXT, FOREIGN KEY(ReturnId) REFERENCES FullReturns(Id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS FullReturnsSyncState (Id INTEGER PRIMARY KEY CHECK (Id = 1), LastChangedAt TEXT, LastResetAt TEXT);
            CREATE TABLE IF NOT EXISTS SalaryArchives (Id INTEGER PRIMARY KEY AUTOINCREMENT, Date TEXT, Filename TEXT, RecordCount INTEGER, Size TEXT, Headers TEXT, ExclusiveUserId INTEGER);
            CREATE TABLE IF NOT EXISTS SalaryReturns (Id INTEGER PRIMARY KEY AUTOINCREMENT, ImportId INTEGER, RawData TEXT, ReturnCode TEXT, UploadDate TEXT, IsDeleted INTEGER DEFAULT 0, IsArchived INTEGER DEFAULT 0, ArchivedBatchId INTEGER NULL, UpdatedAt TEXT, [رقم تسوية التعلية] TEXT, [رقم تسوية السداد] TEXT, FOREIGN KEY(ImportId) REFERENCES SalaryArchives(Id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS SalaryReturnsImages (Id INTEGER PRIMARY KEY AUTOINCREMENT, ReturnId INTEGER, Filename TEXT, CreatedAt TEXT, FOREIGN KEY(ReturnId) REFERENCES SalaryReturns(Id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS NotificationEvents (Id INTEGER PRIMARY KEY AUTOINCREMENT, TableName TEXT, Operation TEXT, RowId INTEGER, CreatedBy TEXT, CreatedAt TEXT, Status TEXT DEFAULT 'Pending', Error TEXT);
            
            -- Extended local SQLite tables
            CREATE TABLE IF NOT EXISTS ArchiveBatches (Id INTEGER PRIMARY KEY AUTOINCREMENT, ExcelNames TEXT, RecordCount INTEGER, DateFrom TEXT, DateTo TEXT, SourceTable TEXT, Reason TEXT, ArchivedAt TEXT);
            CREATE TABLE IF NOT EXISTS ArchiveDetails (Id INTEGER PRIMARY KEY AUTOINCREMENT, BatchId INTEGER, OriginalId INTEGER, SourceTable TEXT, ReturnCode TEXT, UploadDate TEXT, InquirySettlementNo TEXT, PaymentSettlementNo TEXT, RawData TEXT, FOREIGN KEY(BatchId) REFERENCES ArchiveBatches(Id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS TableShares (Id INTEGER PRIMARY KEY AUTOINCREMENT, TableId INTEGER, TableType TEXT, SharedById INTEGER, SharedWithId INTEGER, Message TEXT, Status TEXT DEFAULT 'Pending', CreatedAt TEXT);
            CREATE TABLE IF NOT EXISTS UserTasks (Id INTEGER PRIMARY KEY AUTOINCREMENT, ManagerId INTEGER, TargetUserId INTEGER, Title TEXT, Description TEXT, Priority TEXT DEFAULT 'Medium', Status TEXT DEFAULT 'New', SourceTableId INTEGER, SourceType TEXT, DueDate TEXT, CompletedAt TEXT, ChatConversationId INTEGER, ChatMessageId INTEGER, CreatorUserId INTEGER, AssignedUserId INTEGER, CreatedAt TEXT);
            CREATE TABLE IF NOT EXISTS AuditLogs (Id INTEGER PRIMARY KEY AUTOINCREMENT, UserId INTEGER, Username TEXT, Action TEXT, Details TEXT, IPAddress TEXT, CreatedAt TEXT);
            CREATE TABLE IF NOT EXISTS UserNotifications (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                TargetUserId INTEGER NOT NULL,
                ActorUserId INTEGER NULL,
                Type TEXT NOT NULL,
                Title TEXT NOT NULL,
                Message TEXT NOT NULL,
                RelatedEntityId INTEGER NULL,
                RelatedEntityType TEXT NULL,
                IsRead INTEGER NOT NULL DEFAULT 0,
                CreatedAt TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS Notifications (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                TargetUserId INTEGER NOT NULL,
                ActorUserId INTEGER NULL,
                Type TEXT NOT NULL,
                Title TEXT NOT NULL,
                Message TEXT NOT NULL,
                RelatedEntityType TEXT NULL,
                RelatedEntityId INTEGER NULL,
                IsRead INTEGER NOT NULL DEFAULT 0,
                CreatedAt TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS UserPermissions (
                UserId INTEGER NOT NULL,
                PermissionKey TEXT NOT NULL,
                IsAllowed INTEGER NOT NULL DEFAULT 1,
                UpdatedAt TEXT NOT NULL,
                PRIMARY KEY (UserId, PermissionKey),
                FOREIGN KEY(UserId) REFERENCES Users(Id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS SearchFilterIndex (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                RecordId INTEGER NOT NULL,
                SourceType TEXT NOT NULL,
                Name TEXT,
                NationalId TEXT,
                AccountNumber TEXT,
                Bank TEXT,
                FileCode TEXT,
                ExtractedMonth TEXT,
                PaymentDate TEXT,
                UploadDate TEXT,
                Status TEXT,
                ReturnedRejected TEXT,
                HasAttachments INTEGER NOT NULL DEFAULT 0,
                IsArchived INTEGER NOT NULL DEFAULT 0,
                IsDeleted INTEGER NOT NULL DEFAULT 0,
                SearchText TEXT,
                UpdatedAt TEXT,
                UNIQUE(SourceType, RecordId)
            );
            CREATE TABLE IF NOT EXISTS SearchFilterIndexState (
                Id INTEGER PRIMARY KEY CHECK (Id = 1),
                LastRebuiltAt TEXT,
                IndexedCount INTEGER NOT NULL DEFAULT 0,
                IsStale INTEGER NOT NULL DEFAULT 1,
                LastError TEXT
            );
            INSERT OR IGNORE INTO SearchFilterIndexState (Id, IsStale, IndexedCount) VALUES (1, 1, 0);
            INSERT OR IGNORE INTO FullReturnsSyncState (Id, LastChangedAt, LastResetAt) VALUES (1, '', '');
        ";
        await conn.ExecuteAsync(sql);
        
        var userCount = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Users");
        if (userCount == 0)
        {
            await conn.ExecuteAsync(@"INSERT INTO Users (Username, Password, Fullname, Role, Active, CreatedAt) VALUES (@Username, @Password, @Fullname, @Role, 1, @CreatedAt)",
                new { Username = "admin", Password = "0946777651a28a30367fc9b578c7857fa12add5f82c611481e360dc05a108a73", Fullname = "المدير العام", Role = "admin", CreatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") }
            );
        }

        // Skip migrations if schema is already at current version
        var schemaVersion = await conn.ExecuteScalarAsync<int>("PRAGMA user_version");
        if (schemaVersion >= SCHEMA_VERSION)
        {
            Console.WriteLine($"[DB] Schema v{schemaVersion} is current. Skipping migrations.");
            return;
        }
        Console.WriteLine($"[DB] Migrating schema from v{schemaVersion} to v{SCHEMA_VERSION}...");

        // Schema updates for SQLite
        try { await conn.ExecuteAsync("ALTER TABLE Filters ADD COLUMN Criteria TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE Filters ADD COLUMN TargetPage TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE Filters ADD COLUMN TargetColumn TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN IsArchived INTEGER DEFAULT 0;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN ArchivedBatchId INTEGER NULL;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN UpdatedAt TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE FullReturns ADD COLUMN UpdatedAt TEXT;"); } catch {}
        try { await conn.ExecuteAsync("CREATE TABLE IF NOT EXISTS FullReturnsSyncState (Id INTEGER PRIMARY KEY CHECK (Id = 1), LastChangedAt TEXT, LastResetAt TEXT);"); } catch {}
        try { await conn.ExecuteAsync("INSERT OR IGNORE INTO FullReturnsSyncState (Id, LastChangedAt, LastResetAt) VALUES (1, '', '');"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE SalaryReturns ADD COLUMN IsArchived INTEGER DEFAULT 0;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE SalaryReturns ADD COLUMN ArchivedBatchId INTEGER NULL;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE SalaryReturns ADD COLUMN UpdatedAt TEXT;"); } catch {}
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
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_FilterFast ON Returns(IsDeleted, IsArchived, ReturnCode, UploadDate);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_UpdatedAt ON Returns(UpdatedAt, IsDeleted, IsArchived);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_FullReturns_UpdatedAt ON FullReturns(UpdatedAt);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_ImportState ON Returns(ImportId, IsDeleted, IsArchived);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_SalaryReturns_FilterFast ON SalaryReturns(IsDeleted, IsArchived, ReturnCode, UploadDate);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_SalaryReturns_UpdatedAt ON SalaryReturns(UpdatedAt, IsDeleted, IsArchived);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_SalaryReturns_ImportState ON SalaryReturns(ImportId, IsDeleted, IsArchived);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_ReturnsImages_ReturnId ON ReturnsImages(ReturnId);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_SalaryReturnsImages_ReturnId ON SalaryReturnsImages(ReturnId);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_ArchiveDetails_SourceOriginal ON ArchiveDetails(SourceTable, OriginalId);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_UserNotifications_TargetRead ON UserNotifications(TargetUserId, IsRead, CreatedAt);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_UserNotifications_Related ON UserNotifications(RelatedEntityType, RelatedEntityId);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Notifications_TargetRead ON Notifications(TargetUserId, IsRead, CreatedAt);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Notifications_Related ON Notifications(RelatedEntityType, RelatedEntityId);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_UserPermissions_User ON UserPermissions(UserId, PermissionKey);"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE UserTasks ADD COLUMN DueDate TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE UserTasks ADD COLUMN CompletedAt TEXT;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE UserTasks ADD COLUMN ChatConversationId INTEGER;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE UserTasks ADD COLUMN ChatMessageId INTEGER;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE UserTasks ADD COLUMN CreatorUserId INTEGER;"); } catch {}
        try { await conn.ExecuteAsync("ALTER TABLE UserTasks ADD COLUMN AssignedUserId INTEGER;"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_UserTasks_ChatRefs ON UserTasks(ChatConversationId, ChatMessageId);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_SearchFilterIndex_SourceState ON SearchFilterIndex(SourceType, IsDeleted, IsArchived);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_SearchFilterIndex_Month ON SearchFilterIndex(SourceType, ExtractedMonth);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_SearchFilterIndex_UploadDate ON SearchFilterIndex(SourceType, UploadDate);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_SearchFilterIndex_PaymentDate ON SearchFilterIndex(SourceType, PaymentDate);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_SearchFilterIndex_Status ON SearchFilterIndex(SourceType, Status, ReturnedRejected);"); } catch {}
        try { await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_SearchFilterIndex_Attachments ON SearchFilterIndex(SourceType, HasAttachments);"); } catch {}
        try { await conn.ExecuteAsync("CREATE VIRTUAL TABLE IF NOT EXISTS SearchFilterIndexFts USING fts5(SourceType UNINDEXED, RecordId UNINDEXED, SearchText);"); } catch {}
        var migrationNow = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
        try { await conn.ExecuteAsync("UPDATE Returns SET UpdatedAt = COALESCE(NULLIF(UpdatedAt, ''), NULLIF(UploadDate, ''), @Now);", new { Now = migrationNow }); } catch {}
        try { await conn.ExecuteAsync("UPDATE FullReturns SET UpdatedAt = COALESCE(NULLIF(UpdatedAt, ''), NULLIF(CreatedAt, ''), @Now);", new { Now = migrationNow }); } catch {}
        try { await conn.ExecuteAsync("UPDATE SalaryReturns SET UpdatedAt = COALESCE(NULLIF(UpdatedAt, ''), NULLIF(UploadDate, ''), @Now);", new { Now = migrationNow }); } catch {}

        await conn.ExecuteAsync($"PRAGMA user_version = {SCHEMA_VERSION}");
        Console.WriteLine($"[DB] Schema updated to v{SCHEMA_VERSION}.");
    }

    public async Task AddNotificationEventAsync(string tableName, string operation, long rowId, string user, bool markSearchFilterIndex = true)
    {
        try {
            using var conn = await GetOpenConnectionAsync();
            await conn.ExecuteAsync(@"INSERT INTO NotificationEvents (TableName, Operation, RowId, CreatedBy, CreatedAt) VALUES (@TableName, @Operation, @RowId, @CreatedBy, datetime('now'))",
                new { TableName = tableName, Operation = operation, RowId = rowId, CreatedBy = user ?? "النظام" }
            );
            if (markSearchFilterIndex && AffectsSearchFilterIndex(tableName))
            {
                await MarkSearchFilterIndexStaleAsync(conn);
            }
        } catch {}
    }

    public async Task<long> AddUserNotificationAsync(int targetUserId, int? actorUserId, string type, string title, string message, long? relatedEntityId = null, string? relatedEntityType = null)
    {
        if (targetUserId <= 0) return 0;

        try
        {
            using var conn = await GetOpenConnectionAsync();
            var payload = new
            {
                TargetUserId = targetUserId,
                ActorUserId = actorUserId,
                Type = type ?? "general",
                Title = title ?? "",
                Message = message ?? "",
                RelatedEntityId = relatedEntityId,
                RelatedEntityType = relatedEntityType
            };

            var id = await conn.ExecuteScalarAsync<long>(@"
                INSERT INTO UserNotifications
                    (TargetUserId, ActorUserId, Type, Title, Message, RelatedEntityId, RelatedEntityType, IsRead, CreatedAt)
                VALUES
                    (@TargetUserId, @ActorUserId, @Type, @Title, @Message, @RelatedEntityId, @RelatedEntityType, 0, datetime('now'))
                RETURNING Id;",
                payload);

            try
            {
                await conn.ExecuteAsync(@"
                    INSERT INTO Notifications
                        (Id, TargetUserId, ActorUserId, Type, Title, Message, RelatedEntityType, RelatedEntityId, IsRead, CreatedAt)
                    VALUES
                        (@Id, @TargetUserId, @ActorUserId, @Type, @Title, @Message, @RelatedEntityType, @RelatedEntityId, 0, datetime('now'))",
                    new
                    {
                        Id = id,
                        payload.TargetUserId,
                        payload.ActorUserId,
                        payload.Type,
                        payload.Title,
                        payload.Message,
                        payload.RelatedEntityType,
                        payload.RelatedEntityId
                    });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Notifications] Compatibility insert failed: {ex.Message}");
            }

            return id;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Notifications] Failed to add user notification: {ex.Message}");
            return 0;
        }
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

    public async Task<List<string>> GetUserPermissionsAsync(int userId)
    {
        if (userId <= 0) return new List<string>();
        using var conn = await GetOpenConnectionAsync();
        var role = await conn.ExecuteScalarAsync<string>("SELECT Role FROM Users WHERE Id = @UserId", new { UserId = userId });
        if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
            return DefaultPermissionKeys().ToList();

        var saved = (await conn.QueryAsync<string>(
            "SELECT PermissionKey FROM UserPermissions WHERE UserId = @UserId AND IsAllowed = 1",
            new { UserId = userId })).ToList();

        if (saved.Count > 0) return saved;

        return DefaultPermissionsForRole(role).ToList();
    }

    public async Task SaveUserPermissionsAsync(int userId, IEnumerable<string> permissionKeys)
    {
        using var conn = await GetOpenConnectionAsync();
        var allowed = permissionKeys
            .Where(p => DefaultPermissionKeys().Contains(p))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        using var tx = conn.BeginTransaction();
        await conn.ExecuteAsync("DELETE FROM UserPermissions WHERE UserId = @UserId", new { UserId = userId }, tx);
        foreach (var key in allowed)
        {
            await conn.ExecuteAsync(@"
                INSERT INTO UserPermissions (UserId, PermissionKey, IsAllowed, UpdatedAt)
                VALUES (@UserId, @PermissionKey, 1, datetime('now'))",
                new { UserId = userId, PermissionKey = key }, tx);
        }
        tx.Commit();
    }

    public async Task<bool> UserHasPermissionAsync(int userId, string permissionKey)
    {
        if (userId <= 0 || string.IsNullOrWhiteSpace(permissionKey)) return false;
        using var conn = await GetOpenConnectionAsync();
        var role = await conn.ExecuteScalarAsync<string>("SELECT Role FROM Users WHERE Id = @UserId", new { UserId = userId });
        if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase)) return true;

        var explicitValue = await conn.ExecuteScalarAsync<int?>(
            "SELECT IsAllowed FROM UserPermissions WHERE UserId = @UserId AND PermissionKey = @PermissionKey",
            new { UserId = userId, PermissionKey = permissionKey });
        if (explicitValue.HasValue) return explicitValue.Value == 1;

        return DefaultPermissionsForRole(role).Contains(permissionKey);
    }

    public static IReadOnlyList<string> DefaultPermissionKeys() => new[]
    {
        "page.dashboard", "page.returns", "page.salary-returns", "page.full-returns",
        "page.smart-payment", "page.chat", "page.tasks", "page.archive", "page.adabir", "page.settings",
        "action.import", "action.export", "action.delete", "action.edit", "action.archive",
        "action.account-statement", "action.validation", "action.sync", "action.message", "action.tasks",
        "action.smart-payment", "action.dashboard-reports", "action.row-actions", "action.bulk-actions"
    };

    private static IReadOnlyList<string> DefaultPermissionsForRole(string? role)
    {
        if (string.Equals(role, "editor", StringComparison.OrdinalIgnoreCase))
        {
            return new[]
            {
                "page.dashboard", "page.returns", "page.salary-returns", "page.full-returns",
                "page.chat", "page.tasks", "page.archive", "page.adabir",
                "action.import", "action.export", "action.edit", "action.archive",
                "action.account-statement", "action.validation", "action.sync", "action.message",
                "action.tasks", "action.dashboard-reports", "action.row-actions", "action.bulk-actions"
            };
        }

        return new[]
        {
            "page.dashboard", "page.returns", "page.salary-returns", "page.chat", "page.tasks",
            "action.export", "action.message", "action.tasks", "action.dashboard-reports"
        };
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

    public static string NormalizeImportHeader(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "";
        return name.Trim()
            .Replace("\uFEFF", "")
            .Replace("\u200B", "")
            .Replace("\u200C", "")
            .Replace("\u200D", "")
            .Replace("\u200E", "")
            .Replace("\u200F", "")
            .Replace("\u202A", "")
            .Replace("\u202B", "")
            .Replace("\u202C", "")
            .Replace("\u202D", "")
            .Replace("\u202E", "")
            .Replace("\u2066", "")
            .Replace("\u2067", "")
            .Replace("\u2068", "")
            .Replace("\u2069", "")
            .Replace("\u0640", "")
            .Replace('\uFF0F', '/')
            .Replace('\u2044', '/')
            .Replace('\u2215', '/')
            .Replace("\r", " ")
            .Replace("\n", " ")
            .Replace("\t", " ");
    }

    public static string CanonicalizeImportHeader(string? name)
    {
        var normalized = Regex.Replace(NormalizeImportHeader(name), @"[\u064B-\u0652\u06D6-\u06ED]", "");
        normalized = Regex.Replace(normalized, @"\s+", " ").Trim();
        normalized = Regex.Replace(normalized, @"\s*/\s*", " / ");

        foreach (var header in OfficialImportHeaders)
        {
            if (string.Equals(normalized, CanonicalizeComparableHeader(header), StringComparison.OrdinalIgnoreCase))
            {
                return header;
            }
        }

        foreach (var entry in ImportHeaderAliases)
        {
            if (entry.Value.Any(alias => string.Equals(normalized, CanonicalizeComparableHeader(alias), StringComparison.OrdinalIgnoreCase)))
            {
                return entry.Key;
            }
        }

        return normalized;
    }

    private static string CanonicalizeComparableHeader(string? name)
    {
        var normalized = NormalizeImportHeader(name);
        normalized = Regex.Replace(normalized, @"[\u064B-\u0652\u06D6-\u06ED]", "");
        normalized = Regex.Replace(normalized, @"\s+", " ").Trim();
        return Regex.Replace(normalized, @"\s*/\s*", " / ");
    }

    public static (bool IsValid, List<string> MissingHeaders, List<string> DuplicateOfficialHeaders, List<string> ExtraHeaders) ValidateOfficialImportHeaders(IEnumerable<string>? headers)
    {
        var rawHeaders = headers?
            .Where(h => !string.IsNullOrWhiteSpace(h))
            .Select(h => h.Trim())
            .ToList() ?? new List<string>();

        var canonicalHeaders = rawHeaders
            .Select(CanonicalizeImportHeader)
            .Where(h => !string.IsNullOrWhiteSpace(h))
            .ToList();

        var duplicates = canonicalHeaders
            .GroupBy(h => h, StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() > 1 && OfficialImportHeaders.Contains(g.Key, StringComparer.OrdinalIgnoreCase))
            .Select(g => g.Key)
            .ToList();

        var present = canonicalHeaders
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var missing = OfficialImportHeaders
            .Where(h => !present.Contains(h))
            .ToList();

        var extras = canonicalHeaders
            .Where(h => !OfficialImportHeaders.Contains(h, StringComparer.OrdinalIgnoreCase))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return (missing.Count == 0 && duplicates.Count == 0, missing, duplicates, extras);
    }

    public static Dictionary<string, string> NormalizeImportedRow(JsonElement root)
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        if (root.ValueKind != JsonValueKind.Object) return result;

        foreach (var prop in root.EnumerateObject())
        {
            var canonicalKey = CanonicalizeImportHeader(prop.Name);
            var value = JsonElementToString(prop.Value);
            var existing = result.TryGetValue(canonicalKey, out var currentValue) ? currentValue : "";
            var hasExisting = !string.IsNullOrWhiteSpace(existing);
            var hasIncoming = !string.IsNullOrWhiteSpace(value);
            var exactCanonicalSource = string.Equals(CanonicalizeComparableHeader(prop.Name), CanonicalizeComparableHeader(canonicalKey), StringComparison.OrdinalIgnoreCase);

            if (!hasExisting || (hasIncoming && exactCanonicalSource))
            {
                result[canonicalKey] = value;
            }
        }

        return result;
    }

    public static string NormalizeImportedJson(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return raw;
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return raw;
            return JsonSerializer.Serialize(NormalizeImportedRow(doc.RootElement));
        }
        catch
        {
            return raw;
        }
    }

    public static string ExtractImportedFieldValue(string raw, params string[] fieldNames)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "";
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return "";
            var normalized = NormalizeImportedRow(doc.RootElement);
            foreach (var fieldName in fieldNames)
            {
                var canonical = CanonicalizeImportHeader(fieldName);
                if (normalized.TryGetValue(canonical, out var value) && !string.IsNullOrWhiteSpace(value))
                {
                    return value;
                }
            }

            return "";
        }
        catch
        {
            return "";
        }
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

    public static string NormalizeMonthText(string value) {
        if (string.IsNullOrWhiteSpace(value) || value.Trim() == "فارغ") return "فارغ";
        return ExtractMonthFromFileCode(value);
    }

    public static string ExtractMonthFromFileCode(string fileCode) {
        if (string.IsNullOrWhiteSpace(fileCode)) return "فارغ";
        var cleanCode = fileCode.Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(cleanCode) || cleanCode == "---") return "فارغ";

        static string? Format(string month, string year) {
            if (!int.TryParse(month, out var m) || m < 1 || m > 12) return null;
            if (!Regex.IsMatch(year ?? "", @"^\d{4}$")) return null;
            return $"{m:00}-{year}";
        }

        static List<(int Index, string Value)> Collect(string input, string pattern, Func<Match, string?> map) {
            var result = new List<(int, string)>();
            foreach (Match match in Regex.Matches(input, pattern)) {
                var value = map(match);
                if (!string.IsNullOrEmpty(value)) result.Add((match.Index, value));
            }
            return result;
        }

        var fullDates = new List<(int Index, string Value)>();
        fullDates.AddRange(Collect(cleanCode, @"(?:^|[^\d])(\d{4})\d*[-/](\d{1,2})[-/](\d{1,2})(?=$|[^\d])", m => Format(m.Groups[2].Value, m.Groups[1].Value)));
        fullDates.AddRange(Collect(cleanCode, @"(?:^|[^\d])(\d{1,2})[-/](\d{1,2})[-/](\d{4})\d*(?=$|[^\d])", m => Format(m.Groups[2].Value, m.Groups[3].Value)));
        if (fullDates.Count > 0) return fullDates.OrderBy(x => x.Index).Last().Value;

        var monthYears = new List<(int Index, string Value)>();
        monthYears.AddRange(Collect(cleanCode, @"(?:^|[^\d])(\d{4})\d*[-/](\d{1,2})(?=$|[^\d])", m => Format(m.Groups[2].Value, m.Groups[1].Value)));
        monthYears.AddRange(Collect(cleanCode, @"(?:^|[^\d])(0?[1-9]|1[0-2])[-/](\d{4})\d*(?=$|[^\d])", m => Format(m.Groups[1].Value, m.Groups[2].Value)));
        return monthYears.Count > 0 ? monthYears.OrderBy(x => x.Index).Last().Value : "فارغ";
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

    private static bool AffectsSearchFilterIndex(string? tableName)
    {
        var name = (tableName ?? "").Trim();
        return name.Equals("Returns", StringComparison.OrdinalIgnoreCase)
            || name.Equals("SalaryReturns", StringComparison.OrdinalIgnoreCase)
            || name.Equals("ReturnsImages", StringComparison.OrdinalIgnoreCase)
            || name.Equals("SalaryReturnsImages", StringComparison.OrdinalIgnoreCase)
            || name.Equals("SmartSettlement", StringComparison.OrdinalIgnoreCase)
            || name.Equals("ArchiveBatches", StringComparison.OrdinalIgnoreCase)
            || name.Equals("Adabir", StringComparison.OrdinalIgnoreCase);
    }

    private static async Task MarkSearchFilterIndexStaleAsync(IDbConnection conn)
    {
        await conn.ExecuteAsync(@"
            INSERT INTO SearchFilterIndexState (Id, IsStale, IndexedCount)
            VALUES (1, 1, 0)
            ON CONFLICT(Id) DO UPDATE SET IsStale = 1;");
    }

    public async Task MarkSearchFilterIndexStaleAsync()
    {
        using var conn = await GetOpenConnectionAsync();
        await MarkSearchFilterIndexStaleAsync(conn);
    }

    public async Task<object> GetSearchFilterIndexStatusAsync()
    {
        using var conn = await GetOpenConnectionAsync();
        return await conn.QueryFirstOrDefaultAsync(@"
            SELECT LastRebuiltAt, IndexedCount, IsStale, LastError
            FROM SearchFilterIndexState WHERE Id = 1")
            ?? new { LastRebuiltAt = (string?)null, IndexedCount = 0, IsStale = 1, LastError = (string?)null };
    }

    public async Task EnsureSearchFilterIndexFreshAsync()
    {
        using var conn = await GetOpenConnectionAsync();
        var state = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT IsStale, IndexedCount FROM SearchFilterIndexState WHERE Id = 1");
        if (state == null || Convert.ToInt32(state.IsStale) == 1 || Convert.ToInt32(state.IndexedCount) == 0)
        {
            await RebuildSearchFilterIndexAsync();
        }
    }

    private static readonly SemaphoreSlim _rebuildLock = new(1, 1);

    public async Task<int> RebuildSearchFilterIndexAsync()
    {
        if (!await _rebuildLock.WaitAsync(0))
        {
            Console.WriteLine("[SearchIndex] Rebuild already in progress, skipping.");
            return -1;
        }
        const int BATCH_SIZE = 300;
        try
        {
            // Clear index in one small transaction
            using (var conn = await GetOpenConnectionAsync())
            {
                using var tx = conn.BeginTransaction();
                await conn.ExecuteAsync("DELETE FROM SearchFilterIndex;", transaction: tx);
                try { await conn.ExecuteAsync("DELETE FROM SearchFilterIndexFts;", transaction: tx); } catch {}
                tx.Commit();
            }

            var count = 0;
            count += await RebuildSearchFilterIndexForSourceAsync("returns", "Returns", "ReturnsImages", BATCH_SIZE);
            count += await RebuildSearchFilterIndexForSourceAsync("salary", "SalaryReturns", "SalaryReturnsImages", BATCH_SIZE);

            using (var conn = await GetOpenConnectionAsync())
            {
                await conn.ExecuteAsync(@"
                    INSERT INTO SearchFilterIndexState (Id, LastRebuiltAt, IndexedCount, IsStale, LastError)
                    VALUES (1, datetime('now'), @Count, 0, NULL)
                    ON CONFLICT(Id) DO UPDATE SET
                        LastRebuiltAt = excluded.LastRebuiltAt,
                        IndexedCount = excluded.IndexedCount,
                        IsStale = 0,
                        LastError = NULL;",
                    new { Count = count });
            }
            return count;
        }
        catch (Exception ex)
        {
            try
            {
                using var errorConn = await GetOpenConnectionAsync();
                await errorConn.ExecuteAsync(@"
                    INSERT INTO SearchFilterIndexState (Id, IsStale, LastError)
                    VALUES (1, 1, @Error)
                    ON CONFLICT(Id) DO UPDATE SET IsStale = 1, LastError = excluded.LastError;",
                    new { Error = ex.Message });
            }
            catch { }
            throw;
        }
        finally
        {
            _rebuildLock.Release();
        }
    }

    private async Task<int> RebuildSearchFilterIndexForSourceAsync(string sourceType, string tableName, string imagesTable, int batchSize)
    {
        List<dynamic> rows;
        using (var conn = await GetOpenConnectionAsync())
        {
            rows = (await conn.QueryAsync<dynamic>($@"
                SELECT r.Id, r.RawData, r.ReturnCode, r.UploadDate, COALESCE(r.IsDeleted, 0) AS IsDeleted,
                       COALESCE(r.IsArchived, 0) AS IsArchived,
                       CASE WHEN EXISTS (SELECT 1 FROM {imagesTable} i WHERE i.ReturnId = r.Id) THEN 1 ELSE 0 END AS HasAttachments
                FROM {tableName} r;")).ToList();
        }

        var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        var count = 0;

        // Build all index rows in memory first (no DB lock during processing)
        var indexRows = rows.Select(row =>
        {
            var raw = (string?)row.RawData ?? "";
            var data = ParseRawObject(raw);
            var fileCode = FirstText(data, "كود الملف", "كـــود الملف", "كود_الملف", "FileCode", "ReturnCode");
            if (string.IsNullOrWhiteSpace(fileCode)) fileCode = (string?)row.ReturnCode ?? "";
            var status = FirstText(data, "الحالة", "حالة الارتداد", "ReturnStatus", "Status", "السبب");
            var upload = FirstText(data, "تاريخ الرفع", "UploadDate", "CreatedAt");
            if (string.IsNullOrWhiteSpace(upload)) upload = (string?)row.UploadDate ?? "";
            return new
            {
                RecordId = (long)row.Id,
                SourceType = sourceType,
                Name = FirstText(data, "الاسم", "اسم", "Name", "BeneficiaryName", "الاسم بالكامل"),
                NationalId = FirstText(data, "الرقم القومي", "رقم قومي", "NationalId", "NID"),
                AccountNumber = FirstText(data, "رقم الحساب", "رقم الحساب القديم", "AccountNumber", "IBAN"),
                Bank = FirstText(data, "البنك", "Bank", "اسم البنك"),
                FileCode = fileCode,
                ExtractedMonth = NormalizeMonthText(FirstText(data, "الشهر", "شهر", "Month", "month", "ExtractedMonth", "Extracted Month", " ") is var m && !string.IsNullOrWhiteSpace(m) ? m : fileCode),
                PaymentDate = NormalizeDateOnly(FirstText(data, "تاريخ اعتماد التعديل / تاريخ السداد", "تاريخ السداد", "تاريخ التسوية", "تاريخ السداد الفعلي", "SettlementDate")),
                UploadDate = NormalizeDateOnly(upload),
                Status = status,
                ReturnedRejected = NormalizeReturnedRejected(status + " " + raw),
                HasAttachments = Convert.ToInt32(row.HasAttachments),
                IsArchived = Convert.ToInt32(row.IsArchived),
                IsDeleted = Convert.ToInt32(row.IsDeleted),
                SearchText = BuildSearchText(data, fileCode, sourceType),
                UpdatedAt = now
            };
        }).ToList();

        // Insert in batches — each batch is a short transaction to avoid long locks
        foreach (var batch in indexRows.Chunk(batchSize))
        {
            using var conn = await GetOpenConnectionAsync();
            using var tx = conn.BeginTransaction();
            foreach (var indexRow in batch)
            {
                await conn.ExecuteAsync(@"
                    INSERT OR REPLACE INTO SearchFilterIndex
                        (RecordId, SourceType, Name, NationalId, AccountNumber, Bank, FileCode, ExtractedMonth, PaymentDate, UploadDate, Status, ReturnedRejected, HasAttachments, IsArchived, IsDeleted, SearchText, UpdatedAt)
                    VALUES
                        (@RecordId, @SourceType, @Name, @NationalId, @AccountNumber, @Bank, @FileCode, @ExtractedMonth, @PaymentDate, @UploadDate, @Status, @ReturnedRejected, @HasAttachments, @IsArchived, @IsDeleted, @SearchText, @UpdatedAt);",
                    indexRow, tx);
                try { await conn.ExecuteAsync("INSERT OR REPLACE INTO SearchFilterIndexFts (SourceType, RecordId, SearchText) VALUES (@SourceType, @RecordId, @SearchText);", indexRow, tx); } catch {}
                count++;
            }
            tx.Commit();
        }
        return count;
    }

    public async Task<object> GetSearchFilterIndexFiltersAsync(string? sourceType, bool ensureFresh = true)
    {
        if (ensureFresh) await EnsureSearchFilterIndexFreshAsync();
        using var conn = await GetOpenConnectionAsync();
        var source = NormalizeSourceType(sourceType);
        var where = source == "all" ? "WHERE IsDeleted = 0 AND IsArchived = 0" : "WHERE SourceType = @Source AND IsDeleted = 0 AND IsArchived = 0";
        var param = new { Source = source };
        var status = await conn.QueryAsync<string>($"SELECT DISTINCT Status FROM SearchFilterIndex {where} AND COALESCE(Status, '') != '' ORDER BY Status", param);
        var returnedRejected = await conn.QueryAsync<string>($"SELECT DISTINCT ReturnedRejected FROM SearchFilterIndex {where} AND COALESCE(ReturnedRejected, '') != '' ORDER BY ReturnedRejected", param);
        var months = await conn.QueryAsync<string>($"SELECT DISTINCT ExtractedMonth FROM SearchFilterIndex {where} AND COALESCE(ExtractedMonth, '') != '' ORDER BY ExtractedMonth DESC", param);
        var uploadDates = await conn.QueryAsync<string>($"SELECT DISTINCT UploadDate FROM SearchFilterIndex {where} AND COALESCE(UploadDate, '') != '' ORDER BY UploadDate DESC", param);
        var paymentDates = await conn.QueryAsync<string>($"SELECT DISTINCT PaymentDate FROM SearchFilterIndex {where} AND COALESCE(PaymentDate, '') != '' ORDER BY PaymentDate DESC", param);
        var hasAttachments = await conn.QueryAsync<int>($"SELECT DISTINCT HasAttachments FROM SearchFilterIndex {where} ORDER BY HasAttachments DESC", param);
        var indexedCount = await conn.ExecuteScalarAsync<int>($"SELECT COUNT(*) FROM SearchFilterIndex {where}", param);
        var state = await GetSearchFilterIndexStatusAsync();
        return new
        {
            sourceType = source,
            indexedCount,
            filters = new
            {
                statuses = status,
                returnedRejected,
                months,
                uploadDates,
                paymentDates,
                hasAttachments
            },
            state
        };
    }

    private static string NormalizeSourceType(string? sourceType)
    {
        var source = (sourceType ?? "all").Trim().ToLowerInvariant();
        return source is "returns" or "incentive" ? "returns" : source is "salary" or "salary-returns" ? "salary" : "all";
    }

    private static Dictionary<string, object?> ParseRawObject(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new();
        try
        {
            using var doc = JsonDocument.Parse(raw);
            return doc.RootElement.ValueKind == JsonValueKind.Object
                ? doc.RootElement.EnumerateObject().ToDictionary(p => p.Name, p => (object?)JsonElementToString(p.Value))
                : new();
        }
        catch { return new(); }
    }

    private static string JsonElementToString(JsonElement el) => el.ValueKind switch
    {
        JsonValueKind.Null => "",
        JsonValueKind.String => el.GetString() ?? "",
        _ => el.ToString()
    };

    private static string FirstText(Dictionary<string, object?> data, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (data.TryGetValue(key, out var value) && value is not null && !string.IsNullOrWhiteSpace(value.ToString()))
                return value.ToString()!.Trim();
        }
        return "";
    }

    private static string NormalizeDateOnly(string? value)
    {
        var text = (value ?? "").Trim();
        if (string.IsNullOrWhiteSpace(text)) return "";
        if (DateTime.TryParse(text, out var parsed)) return parsed.ToString("yyyy-MM-dd");
        return text.Length >= 10 ? text[..10] : text;
    }

    private static string NormalizeReturnedRejected(string text)
    {
        var normalized = (text ?? "").ToLowerInvariant();
        if (normalized.Contains("rejected") || normalized.Contains("reject") || normalized.Contains("مرفوض") || normalized.Contains("رفض")) return "Rejected";
        if (normalized.Contains("returned") || normalized.Contains("return") || normalized.Contains("مرتد") || normalized.Contains("إرجاع") || normalized.Contains("ارجاع")) return "Returned";
        return "";
    }

    private static string BuildSearchText(Dictionary<string, object?> data, string fileCode, string sourceType)
    {
        var values = data.Values.Where(v => v is not null).Select(v => v!.ToString()).Where(v => !string.IsNullOrWhiteSpace(v));
        return string.Join(' ', values.Append(fileCode).Append(sourceType)).ToLowerInvariant();
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

public record DatabasePathResolution(string DatabasePath, bool InputWasFolder);

public record DatabasePathValidationResult(bool Success, string Code, string Message, string? DatabasePath)
{
    public static DatabasePathValidationResult Ok(string databasePath) =>
        new(true, "connected", "Connected successfully", databasePath);

    public static DatabasePathValidationResult Fail(string code, string message, string? databasePath = null) =>
        new(false, code, message, databasePath);
}
