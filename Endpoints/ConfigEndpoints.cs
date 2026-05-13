using HKServer.Services;
using HKServer.Models;

namespace HKServer.Endpoints;

public static class ConfigEndpoints
{
    public static void MapConfigEndpoints(this WebApplication app)
    {
        app.MapGet("/config", () => DatabaseService.LoadServerConfig());

        app.MapGet("/config/path", (DatabaseService db) => {
            var config = DatabaseService.LoadServerConfig();
            var status = db.GetCachedConnectionStatus();
            var activePath = db.GetDbPath();
            var isNetworkPath = IsNetworkPath(activePath);
            return Results.Ok(new {
                path = activePath,
                activePath,
                selectedPath = config.DatabasePath,
                lastSuccessfulConnection = config.LastSuccessfulDatabaseConnection,
                lastSuccessfulPath = config.LastSuccessfulDatabasePath,
                isNetworkPath,
                connectionKind = isNetworkPath ? "network" : "local",
                lastError = status.Success ? "" : status.Message,
                status = new {
                    success = status.Success,
                    code = status.Code,
                    message = ToArabicDatabasePathMessage(status.Code, status.Message),
                    rawMessage = status.Message
                },
                recommended = "folder_or_full_file_path",
                message = "يمكن إدخال مجلد أو ملف hk.db كامل، محليًا أو على مشاركة شبكة."
            });
        });

        app.MapPost("/config/test-connection", async (HttpContext context, DatabaseService db) => {
            var req = await context.Request.ReadFromJsonAsync<DatabasePathRequest>();
            DatabasePathResolution? resolved = null;
            var validation = string.IsNullOrWhiteSpace(req?.path)
                ? db.TestCurrentConnection()
                : ValidateSelectedPath(req.path, allowCreateMissing: false, out resolved);
            var responsePath = validation.DatabasePath ?? resolved?.DatabasePath ?? db.GetDbPath();
            return Results.Ok(new {
                success = validation.Success,
                code = validation.Code,
                message = ToArabicDatabasePathMessage(validation.Code, validation.Message),
                rawMessage = validation.Message,
                path = responsePath,
                inputWasFolder = resolved?.InputWasFolder ?? false,
                requiresCreateConfirmation = validation.Code == "folder_db_missing",
                activePath = db.GetDbPath(),
                isNetworkPath = IsNetworkPath(responsePath),
                connectionKind = IsNetworkPath(responsePath) ? "network" : "local",
                sqliteNetworkWarning = "SQLite on a LAN share can be limited by file locking and concurrent writes. busy_timeout is enabled. WAL and synchronous=NORMAL are not enabled automatically for UNC paths."
            });
        });

        app.MapGet("/config/filters", async (DatabaseService db) => {
             // Retrieve from Database instead of obsolete Config property
             var filters = await db.GetFiltersAsync();
             return Results.Ok(filters);
        });

        app.MapPost("/config/filters", (HttpContext context, DatabaseService db) => {
            // This endpoint is legacy, we suggest using /api/filters for now
            // but we'll maintain basic compatibility if possible or return error
            return Results.StatusCode(410); // Gone - Redirected to /api/filters
        });

        app.MapPost("/config/path", async (HttpContext context, DatabaseService db) => {
            var req = await context.Request.ReadFromJsonAsync<DatabasePathRequest>();
            if (string.IsNullOrWhiteSpace(req?.path)) return Results.BadRequest();

            try {
                var validation = ValidateSelectedPath(req.path, req.createIfMissing, out var resolved);

                if (!validation.Success)
                {
                    return Results.Json(new {
                        success = false,
                        code = validation.Code,
                        message = ToArabicDatabasePathMessage(validation.Code, validation.Message),
                        rawMessage = validation.Message,
                        path = resolved.DatabasePath,
                        inputWasFolder = resolved.InputWasFolder,
                        requiresCreateConfirmation = validation.Code == "folder_db_missing",
                        isNetworkPath = IsNetworkPath(resolved.DatabasePath),
                        connectionKind = IsNetworkPath(resolved.DatabasePath) ? "network" : "local"
                    });
                }
                
                var config = DatabaseService.LoadServerConfig();
                config.DatabasePath = resolved.DatabasePath;
                config.BasePath = Path.GetDirectoryName(resolved.DatabasePath) ?? config.BasePath;
                config.LastSuccessfulDatabasePath = resolved.DatabasePath;
                config.LastSuccessfulDatabaseConnection = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                DatabaseService.SaveServerConfig(config);
                
                db.SetDatabasePath(resolved.DatabasePath, createIfMissing: req.createIfMissing);
                await db.InitDatabase();

                return Results.Ok(new {
                    success = true,
                    message = "تم الاتصال وحفظ مسار قاعدة البيانات بنجاح.",
                    path = resolved.DatabasePath,
                    activePath = db.GetDbPath(),
                    isNetworkPath = IsNetworkPath(db.GetDbPath()),
                    connectionKind = IsNetworkPath(db.GetDbPath()) ? "network" : "local",
                    lastSuccessfulConnection = config.LastSuccessfulDatabaseConnection
                });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        // Archive Path Configuration
        app.MapGet("/config/archive-path", () => {
             var config = DatabaseService.LoadServerConfig();
             return Results.Ok(new { path = config.ArchivePath });
        });

        app.MapPost("/config/archive-path", async (HttpContext context) => {
            var req = await context.Request.ReadFromJsonAsync<PathRequest>();
            if (string.IsNullOrWhiteSpace(req?.path)) return Results.BadRequest();

            try {
                if (!Directory.Exists(req.path)) Directory.CreateDirectory(req.path);
                
                var config = DatabaseService.LoadServerConfig();
                config.ArchivePath = req.path;
                DatabaseService.SaveServerConfig(config);
                
                return Results.Ok(new { success = true, message = "تم تغيير مسار الأرشيف بنجاح" });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        // Auto Sync Path Configuration
        app.MapGet("/config/autosync-path", () => {
             var config = DatabaseService.LoadServerConfig();
             return Results.Ok(new { path = config.AutoSyncPath });
        });

        app.MapPost("/config/autosync-path", async (HttpContext context) => {
            var req = await context.Request.ReadFromJsonAsync<PathRequest>();
            // Allow empty path to disable/clear
            
            try {
                if (!string.IsNullOrWhiteSpace(req?.path) && !Directory.Exists(req.path)) {
                     return Results.Json(new { success = false, message = "المجلد غير موجود" });
                }
                
                var config = DatabaseService.LoadServerConfig();
                config.AutoSyncPath = req?.path ?? "";
                DatabaseService.SaveServerConfig(config);
                
                return Results.Ok(new { success = true, message = "تم حفظ مسار المزامنة بنجاح" });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });
        
        // NAPS2 Path Configuration
        app.MapGet("/config/naps2-path", () => {
             var config = DatabaseService.LoadServerConfig();
             return Results.Ok(new { path = config.Naps2Path });
        });

        app.MapGet("/config/scanner-settings", () => {
             var config = DatabaseService.LoadServerConfig();
             return Results.Ok(new { 
                 naps2Path = config.Naps2Path,
                 driver = config.ScannerDriver,
                 device = config.ScannerDevice,
                 source = config.ScannerSource,
                 format = config.ScannerFormat,
                 silent = config.ScannerSilent,
                 force = config.ScannerForce
             });
        });

        app.MapPost("/config/naps2-path", async (HttpContext context) => {
            var req = await context.Request.ReadFromJsonAsync<PathRequest>();
            if (string.IsNullOrWhiteSpace(req?.path)) return Results.BadRequest();

            try {
                var config = DatabaseService.LoadServerConfig();
                config.Naps2Path = req.path;
                DatabaseService.SaveServerConfig(config);
                
                return Results.Ok(new { success = true, message = "تم تغيير مسار NAPS2 بنجاح" });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        app.MapPost("/config/scanner-settings", (ScannerSettingsRequest req) => {
            try {
                var config = DatabaseService.LoadServerConfig();
                config.Naps2Path = req.Naps2Path;
                config.ScannerDriver = req.Driver;
                config.ScannerDevice = req.Device;
                config.ScannerSource = req.Source;
                config.ScannerFormat = req.Format;
                config.ScannerSilent = req.Silent;
                config.ScannerForce = req.Force;
                DatabaseService.SaveServerConfig(config);
                
                return Results.Ok(new { success = true, message = "تمت تحديث إعدادات الماسح بنجاح" });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        // Attachment Linking Mode Configuration
        app.MapGet("/config/attachment-link-mode", () => {
             var config = DatabaseService.LoadServerConfig();
             return Results.Ok(new { mode = config.AttachmentLinkMode });
        });

        app.MapPost("/config/attachment-link-mode", async (HttpContext context) => {
            var req = await context.Request.ReadFromJsonAsync<AttachmentLinkModeRequest>();
            if (string.IsNullOrWhiteSpace(req?.Mode)) return Results.BadRequest();

            try {
                var config = DatabaseService.LoadServerConfig();
                config.AttachmentLinkMode = req.Mode;
                DatabaseService.SaveServerConfig(config);
                
                return Results.Ok(new { success = true, message = "تم تغيير وضع ربط المرفقات بنجاح" });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        app.MapGet("/config/naps2-search", () => {
            var potentialPaths = new List<string> {
                @"C:\Program Files\NAPS2\NAPS2.Console.exe",
                @"C:\Program Files (x86)\NAPS2\NAPS2.Console.exe",
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "naps2", "App", "NAPS2.Console.exe"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "naps2", "App", "NAPS2.Console.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "NAPS2", "NAPS2.Console.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NAPS2", "NAPS2.Console.exe")
            };

            var foundPath = potentialPaths.FirstOrDefault(File.Exists);
            return Results.Ok(new { success = foundPath != null, path = foundPath ?? "" });
        });
        
        app.MapPost("/config/browse", async () => {
            // ... PowerShell Logic kept same ...
             try {
                var psScript = @"
                    Add-Type -AssemblyName System.Windows.Forms;
                    $f = New-Object System.Windows.Forms.FolderBrowserDialog;
                    $f.Description = 'اختر مجلد قاعدة البيانات';
                    $f.ShowNewFolderButton = $true;
                    $result = $f.ShowDialog((New-Object System.Windows.Forms.Form -Property @{TopMost=$true}));
                    if($result -eq 'OK') { $f.SelectedPath }
                ";
                
                var info = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "powershell",
                    Arguments = $"-NoProfile -ExecutionPolicy Bypass -Command \"{psScript.Replace("\"", "\\\"").Replace("\r\n", " ")}\"",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                
                using var process = System.Diagnostics.Process.Start(info);
                if (process == null) return Results.Json(new { path = "" });
                
                var path = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();
                
                return Results.Ok(new { path = path.Trim() });
            } catch (Exception ex) {
                Console.WriteLine($"Browse Error: {ex.Message}");
                return Results.Json(new { path = "" });
            }
        });

        app.MapPost("/config/browse-db-file", async () => {
            try {
                var psScript = @"
                    Add-Type -AssemblyName System.Windows.Forms;
                    $f = New-Object System.Windows.Forms.OpenFileDialog;
                    $f.Title = 'Select hk.db from local disk or network share';
                    $f.Filter = 'SQLite database (*.db;*.sqlite;*.sqlite3)|*.db;*.sqlite;*.sqlite3|All files (*.*)|*.*';
                    $f.CheckFileExists = $true;
                    $f.Multiselect = $false;
                    $result = $f.ShowDialog((New-Object System.Windows.Forms.Form -Property @{TopMost=$true}));
                    if($result -eq 'OK') { $f.FileName }
                ";

                var info = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "powershell",
                    Arguments = $"-NoProfile -ExecutionPolicy Bypass -Command \"{psScript.Replace("\"", "\\\"").Replace("\r\n", " ")}\"",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = System.Diagnostics.Process.Start(info);
                if (process == null) return Results.Json(new { path = "" });

                var path = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();

                return Results.Ok(new { path = path.Trim() });
            } catch (Exception ex) {
                Console.WriteLine($"Browse DB File Error: {ex.Message}");
                return Results.Json(new { path = "" });
            }
        });
        
        // Reset Database Endpoint
        app.MapDelete("/admin/reset", async (HttpContext context, DatabaseService db, IConfiguration configuration) => {
            try {
                var protectedResult = SecurityHardening.RequireAdminOperationProtection(context, configuration, "/admin/reset");
                if (protectedResult != null) return protectedResult;

                using var conn = db.GetConnection();
                await conn.OpenAsync();
                
                // 1. Clear Data Tables
                await conn.ExecuteAsync("DELETE FROM Returns");

                await conn.ExecuteAsync("DELETE FROM Archives");
                
                // 2. Reset Auto Increment
                await conn.ExecuteAsync("DELETE FROM sqlite_sequence WHERE name IN ('Returns', 'Archives')");

                // 3. Clear Physical Images
                var config = DatabaseService.LoadServerConfig();
                if (Directory.Exists(config.ArchivePath)) {
                    var dir = new DirectoryInfo(config.ArchivePath);
                    foreach(var file in dir.GetFiles()) {
                        try { file.Delete(); } catch {}
                    }
                }

                return Results.Ok(new { success = true, message = "تم تصفية قاعدة البيانات بنجاح" });
            } catch (Exception ex) {
                 return Results.Json(new { success = false, message = ex.Message });
            }
        });
    }




    public record ScannerSettingsRequest(
        string Naps2Path,
        string Driver,
        string Device,
        string Source,
        string Format,
        bool Silent,
        bool Force
    );

    public record AttachmentLinkModeRequest(string Mode);
    public record DatabasePathRequest(string path, bool createIfMissing = false);

    private static DatabasePathValidationResult ValidateSelectedPath(string inputPath, bool allowCreateMissing, out DatabasePathResolution resolved)
    {
        resolved = DatabaseService.NormalizeDatabasePath(inputPath);
        var fileExists = File.Exists(resolved.DatabasePath);

        if (resolved.InputWasFolder && !fileExists && !allowCreateMissing)
        {
            return DatabasePathValidationResult.Fail(
                "folder_db_missing",
                "لم يتم العثور على hk.db داخل هذا المجلد. هل تريد إنشاء قاعدة جديدة");
        }

        if (!resolved.InputWasFolder && !fileExists)
        {
            return DatabasePathValidationResult.Fail(
                "file_not_found",
                "ملف قاعدة البيانات غير موجود. لن يتم إنشاء قاعدة فارغة تلقائيا.");
        }

        return DatabaseService.ValidateDatabasePath(
            resolved.DatabasePath,
            requireExistingFile: !allowCreateMissing);
    }

    private static bool IsNetworkPath(string? path) =>
        !string.IsNullOrWhiteSpace(path) && path.StartsWith(@"\\", StringComparison.Ordinal);

    private static string ToArabicDatabasePathMessage(string code, string fallback) => code switch
    {
        "connected" => "تم الاتصال بنجاح.",
        "invalid_path" => "مسار قاعدة البيانات غير صحيح. اختر ملفا بامتداد .db أو .sqlite أو مجلدا يحتوي hk.db.",
        "folder_not_found" => "المجلد غير موجود.",
        "shared_folder_unavailable" => "المجلد المشترك غير متاح. تأكد من الشبكة ومسار المشاركة.",
        "folder_db_missing" => "لم يتم العثور على hk.db داخل هذا المجلد. هل تريد إنشاء قاعدة جديدة",
        "file_not_found" => "ملف قاعدة البيانات غير موجود. لن يتم إنشاء قاعدة فارغة تلقائيا.",
        "permission_denied" => "لا توجد صلاحيات كافية للقراءة/الكتابة/إنشاء ملفات القفل في هذا المسار.",
        "sqlite_locked" => "قاعدة البيانات مقفلة حاليا من عملية أخرى.",
        "invalid_sqlite" => "الملف المحدد ليس قاعدة SQLite صالحة أو لا يمكن فتحه.",
        "not_tested" => "لم يتم اختبار الاتصال بعد.",
        _ => fallback
    };
}
