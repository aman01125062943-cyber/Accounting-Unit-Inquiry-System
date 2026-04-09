$p = "Services/DatabaseService.cs"
$c = Get-Content $p -Raw
$c = $c -replace 'private ServerConfig _config = new\(\);', "private ServerConfig _config = new();`r`n    private DateTime _networkUnavailableUntil = DateTime.MinValue;"
$oldLoadConfig = 'private void LoadConfig\(\)\s+\{\s+var config = LoadServerConfig\(\);\s+_config = config;\s+var localDbPath = GetLocalDbPath\(\);\s+if \(!string\.IsNullOrWhiteSpace\(config\.BasePath\)\)\s+\{\s+var configuredDbPath = Path\.Combine\(config\.BasePath, "hk\.db"\);\s+if \(TryOpenDatabaseFile\(configuredDbPath, out var configPathError\)\)\s+\{\s+_dbPath = configuredDbPath;\s+Console\.WriteLine\(\$"\[INFO\] Database Path set to Config Path: \{_dbPath\}"\);\s+return;\s+\}\s+Console\.WriteLine\(\$"\[WARN\] Config BasePath is not writable or inaccessible: \{config\.BasePath\}"\);\s+Console\.WriteLine\(\$"\[WARN\] Config DB fallback reason: \{configPathError\}"\);\s+\}\s+_dbPath = localDbPath;\s+if \(TryOpenDatabaseFile\(_dbPath, out var localPathError\)\)\s+\{\s+Console\.WriteLine\(\$"\[INFO\] Database Path set to Local: \{_dbPath\}"\);\s+return;\s+\}\s+Console\.WriteLine\(\$"\[ERROR\] Local database path is not usable: \{_dbPath\}"\);\s+Console\.WriteLine\(\$"\[ERROR\] Local DB failure: \{localPathError\}"\);\s+\}'
$newLoadConfig = 'private void LoadConfig()
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
            
            if (config.BasePath.StartsWith(@"\\")) {
                _networkUnavailableUntil = DateTime.Now.AddMinutes(5);
                Console.WriteLine("[DB] Network share marked unreachable. Will retry in 5 minutes.");
            }
        }

        _dbPath = localDbPath;
        Console.WriteLine($"[DB] Falling back to Local Path: {_dbPath}");

        if (TryOpenDatabaseFile(_dbPath, out var localPathError))
        {
            Console.WriteLine($"[DB] Success: Database Path set to Local: {_dbPath}");
            return;
        }

        Console.WriteLine($"[DB] [ERROR] Local database path is not usable: {_dbPath}");
        Console.WriteLine($"[DB] [ERROR] Local DB failure: {localPathError}");
    }'
$c = $c -replace $oldLoadConfig, $newLoadConfig

$oldGetOpen = 'public async Task<SqliteConnection> GetOpenConnectionAsync\(\)\s+\{\s+SqliteConnection conn;\s+try\s+\{\s+conn = GetConnection\(\);\s+await conn\.OpenAsync\(\);\s+\}\s+catch \(Exception ex\)\s+\{\s+SwitchToLocalDbPath\(ex\.Message\);\s+await InitDatabase\(\);\s+conn = GetConnection\(\);\s+await conn\.OpenAsync\(\);\s+\}'
$newGetOpen = 'public async Task<SqliteConnection> GetOpenConnectionAsync()
    {
        // Debounce network share retries if we know it's down
        if (_dbPath.StartsWith(@"\\") && DateTime.Now < _networkUnavailableUntil)
        {
            SwitchToLocalDbPath("Network was marked unavailable. Waiting for retry interval.");
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
            if (_dbPath.StartsWith(@"\\")) {
                _networkUnavailableUntil = DateTime.Now.AddMinutes(2);
            }
            
            SwitchToLocalDbPath(ex.Message);
            await InitDatabase();
            conn = GetConnection();
            await conn.OpenAsync();
        }'
$c = $c -replace $oldGetOpen, $newGetOpen

Set-Content $p $c -NoNewline
