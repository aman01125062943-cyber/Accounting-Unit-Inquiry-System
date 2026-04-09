using HKServer.Services;
using HKServer.Models;

namespace HKServer.Endpoints;

public static class ConfigEndpoints
{
    public static void MapConfigEndpoints(this WebApplication app)
    {
        app.MapGet("/config", () => DatabaseService.LoadServerConfig());

        app.MapGet("/config/path", (DatabaseService db) => Results.Ok(new { path = Path.GetDirectoryName(db.GetDbPath()) }));

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
            var req = await context.Request.ReadFromJsonAsync<PathRequest>();
            if (string.IsNullOrWhiteSpace(req?.path)) return Results.BadRequest();

            try {
                if (!Directory.Exists(req.path)) Directory.CreateDirectory(req.path);
                
                var config = DatabaseService.LoadServerConfig();
                config.BasePath = req.path;
                DatabaseService.SaveServerConfig(config);
                
                db.SetBasePath(req.path);
                await db.InitDatabase(); // Re-init DB in new path

                return Results.Ok(new { success = true, message = "تم تغيير المسار والاتصال بنجاح" });
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
        
        // Reset Database Endpoint
        app.MapDelete("/admin/reset", async (DatabaseService db) => {
            try {
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
}
