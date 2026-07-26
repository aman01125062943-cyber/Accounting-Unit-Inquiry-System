using HKServer.Endpoints;
using HKServer.Hubs;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.AspNetCore.SignalR;

// --- Taskbar Icon Fix (Win32 API) ---
[DllImport("kernel32.dll", SetLastError = true)]
static extern IntPtr GetConsoleWindow();

[DllImport("user32.dll", SetLastError = true)]
static extern bool SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

[DllImport("user32.dll", SetLastError = true)]
static extern IntPtr LoadImage(IntPtr hinst, string lpszName, uint uType, int cxDesired, int cyDesired, uint fuLoad);

const uint WM_SETICON = 0x80;
const uint ICON_SMALL = 0;
const uint ICON_BIG = 1;
const uint IMAGE_ICON = 1;
const uint LR_LOADFROMFILE = 0x10;

void SetConsoleIcon() {
    try {
        IntPtr hWnd = GetConsoleWindow();
        if (hWnd != IntPtr.Zero) {
            string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app_icon.ico");
            if (File.Exists(iconPath)) {
                IntPtr hIcon = LoadImage(IntPtr.Zero, iconPath, IMAGE_ICON, 0, 0, LR_LOADFROMFILE);
                SendMessage(hWnd, WM_SETICON, (IntPtr)ICON_BIG, hIcon);
                SendMessage(hWnd, WM_SETICON, (IntPtr)ICON_SMALL, hIcon);
            }
        }
    } catch { }
}
// ------------------------------------

SetConsoleIcon();

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

// 1. Services
var networkModeEnabled = SecurityHardening.ReadBool(builder.Configuration, "NetworkModeEnabled", defaultValue: false);
var bindUrl = networkModeEnabled ? "http://*:5001" : "http://127.0.0.1:5001";
var securityMode = networkModeEnabled ? "NetworkMode" : "LocalOnly";
var allowedOrigins = GetAllowedOrigins(builder.Configuration);

Console.WriteLine($"[SECURITY] BindAddress: {bindUrl}");
Console.WriteLine($"[SECURITY] Network mode: {securityMode}");
Console.WriteLine($"[SECURITY] CORS allowed origins: {string.Join(", ", allowedOrigins)}");
if (string.Equals(builder.Configuration["SettingsPin"], "2027", StringComparison.Ordinal))
{
    Console.WriteLine("[SECURITY][WARNING] SettingsPin is still using the default value. Change it before using real data or network mode.");
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy => {
        policy.SetIsOriginAllowed(origin => true)
               .AllowAnyMethod()
               .AllowAnyHeader()
               .AllowCredentials(); // Required for SignalR with specific transports
    });
});

builder.Services.AddSignalR();

// Increase request size limits for large file uploads (100MB)
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 100 * 1024 * 1024; // 100MB
});
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.MaxRequestBodySize = 100 * 1024 * 1024; // 100MB
});

builder.Services.ConfigureHttpJsonOptions(options => {
    options.SerializerOptions.Encoder = System.Text.Encodings.Web.JavaScriptEncoder.Create(System.Text.Unicode.UnicodeRanges.All);
    options.SerializerOptions.WriteIndented = true;
});

// Add Database Service
builder.Services.AddSingleton<DatabaseService>();
builder.Services.AddSingleton<HKServer.Services.AutoSyncService>();
builder.Services.AddHostedService<HKServer.Services.NotificationDispatcherService>();
builder.Services.AddHostedService<HKServer.Services.AutoImportService>();
builder.Services.AddHostedService<HKServer.Services.HiaapayAutoSyncService>();
builder.Services.AddMemoryCache();

// 5. Open Browser Automatically (Configure Port)
builder.WebHost.UseUrls(bindUrl);

var app = builder.Build(); 


// 2. Middleware
app.UseCors("AllowAll");
app.Use(async (context, next) => {
    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] {context.Request.Method} {context.Request.Path}");
    try {
        await next();
    } catch (Exception ex) {
        Console.WriteLine($"!!! SERVER ERROR: {ex.Message}");
        context.Response.StatusCode = 500;
        try {
            var hub = context.RequestServices.GetRequiredService<IHubContext<NotificationHub>>();
            var payload = new {
                table = context.Request.Path.ToString(),
                operation = context.Request.Method,
                rowId = 0,
                timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                status = "فاشلة"
            };
            await hub.Clients.All.SendAsync("DbChange", payload);
        } catch {}
        await context.Response.WriteAsJsonAsync(new { success = false, message = "Server Error", error = ex.Message });
    }
});

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/ping", () => Results.Ok(new { success = true, status = "ok", timestamp = DateTime.UtcNow }));



app.Use(async (context, next) => {
    var path = context.Request.Path.Value ?? "";
    if (IsProtectedDangerousOperation(context.Request.Method, path))
    {
        var protectedResult = SecurityHardening.RequireAdminOperationProtection(
            context,
            app.Configuration,
            $"{context.Request.Method} {path}");
        if (protectedResult != null)
        {
            await protectedResult.ExecuteAsync(context);
            return;
        }
    }

    await next();
});

app.Use(async (context, next) => {
    if (IsDatabaseRecoveryPath(context.Request))
    {
        await next();
        return;
    }

    var db = context.RequestServices.GetRequiredService<DatabaseService>();
    var status = db.GetCachedConnectionStatus();
    if (!status.Success)
    {
        context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        await context.Response.WriteAsJsonAsync(new {
            success = false,
            message = "Configured database is unavailable. No local fallback is active.",
            code = status.Code,
            error = status.Message,
            activePath = db.GetDbPath(),
            isNetworkPath = db.IsNetworkDatabase()
        });
        return;
    }

    await next();
});

static bool IsDatabaseRecoveryPath(HttpRequest request)
{
    var value = request.Path.Value ?? "";
    return value.Equals("/api/ping", StringComparison.OrdinalIgnoreCase)
        || value.StartsWith("/config", StringComparison.OrdinalIgnoreCase)
        || value.StartsWith("/api/settings", StringComparison.OrdinalIgnoreCase)
        || IsProtectedDangerousOperation(request.Method, value);
}

static bool IsProtectedDangerousOperation(string method, string path)
{
    if (HttpMethods.IsDelete(method))
    {
        return path.Equals("/admin/reset", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/salary-returns", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/full-returns", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/archive", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/salary-archive", StringComparison.OrdinalIgnoreCase);
    }

    if (!HttpMethods.IsPost(method)) return false;

    return path.Equals("/returns/import", StringComparison.OrdinalIgnoreCase)
        || path.Equals("/salary-returns/import", StringComparison.OrdinalIgnoreCase)
        || path.Equals("/salary-returns/bulk-delete", StringComparison.OrdinalIgnoreCase)
        || path.Equals("/full-returns/import", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/archive/restore", StringComparison.OrdinalIgnoreCase)
        || path.Equals("/archive/clear-restore", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/salary-archive/restore", StringComparison.OrdinalIgnoreCase)
        || path.Equals("/salary-archive/clear-restore", StringComparison.OrdinalIgnoreCase)
        || path.Equals("/api/adabir/archive", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/adabir/restore", StringComparison.OrdinalIgnoreCase);
}

// Serve uploaded files from wwwroot/uploads (for chat attachments etc.)
var uploadsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "uploads");
if (Directory.Exists(uploadsPath))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
        RequestPath = "/uploads"
    });
}

// 3. Init DB in background so the server starts accepting requests immediately
_ = Task.Run(async () => {
    await Task.Delay(500);
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<DatabaseService>();
    try {
        await db.InitDatabase();
        Console.WriteLine("[DB] Database initialization completed.");
    } catch (Exception ex) {
        Console.WriteLine($"[WARNING] Database initialization failed: {ex.InnerException?.Message ?? ex.Message}");
    }
});

app.MapGet("/api/debug/counts", async (DatabaseService db) => {
    using var conn = await db.GetOpenConnectionAsync();
    var returns = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Returns");
    var salaryReturns = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM SalaryReturns");
    var archives = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Archives");
    var salaryArchives = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM SalaryArchives");
    return Results.Ok(new { returns, salaryReturns, archives, salaryArchives });
});

// 4. Endpoints
app.MapConfigEndpoints();
app.MapAuthEndpoints();
app.MapArchiveEndpoints();
app.MapReturnsEndpoints();
app.MapFullReturnsEndpoints();
app.MapSalaryReturnsEndpoints();
app.MapSmartSettlementEndpoints();
app.MapBankLedgerEndpoints();
app.MapAutoImportReportEndpoints();
app.MapChatEndpoints();
app.MapTaskEndpoints();
app.MapNotificationEndpoints();
app.MapDashboardEndpoints();
app.MapAccountStatementEndpoints();
app.MapAdabirEndpoints();
app.MapSearchIndexEndpoints();
app.MapHiaapayEndpoints();
app.MapConnectorEndpoints();
app.MapDailyReportEndpoints();

app.MapSettingsEndpoints();
app.MapHub<NotificationHub>("/notificationHub");
app.MapHub<ChatHub>("/chatHub");

app.MapPost("/api/test/dbchange", async (DatabaseService db) => {
    using var conn = await db.GetOpenConnectionAsync();
    var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
    var id = await conn.ExecuteScalarAsync<long>("INSERT INTO Returns (ImportId, RawData, ReturnCode, UploadDate, IsDeleted) VALUES (NULL, '{\"اختبار\":\"نظام\"}', NULL, @Now, 0) RETURNING Id;", new { Now = now });
    await conn.ExecuteAsync("UPDATE Returns SET UploadDate = @Now2 WHERE Id = @Id", new { Now2 = now, Id = id });
    await conn.ExecuteAsync("DELETE FROM Returns WHERE Id = @Id", new { Id = id });
    return Results.Ok(new { success = true });
});

// Legacy compatibility for Tables info
app.MapGet("/hk/config/tables", (DatabaseService db) => {
    var activePath = db.GetDbPath();
    return Results.Ok(new {
        basePath = activePath,
        isNetworkPath = db.IsNetworkDatabase(),
        tables = new [] {
            new { name = "Returns (SQLite)", description = "المرتدات (Local Database)", exists = true, recordCount = "Dynamic" },
            new { name = "Archive (SQLite)", description = "الأرشيف (Local Database)", exists = true, recordCount = "Dynamic" }
        }
    });
});


// 5. Open Browser Automatically - Logic moved to ApplicationStarted


// ... Middleware ...

// Register Browser Launch on Application Started
app.Lifetime.ApplicationStarted.Register(() => {
    Task.Run(async () => {
        await Task.Delay(1000); 
        try {
            Console.WriteLine("\n" + new string('=', 50));
            Console.WriteLine("[*] HK Server is running on the following addresses:");
            Console.WriteLine($"    - Bind:    {bindUrl}");
            Console.WriteLine($"    - Mode:    {securityMode}");
            Console.WriteLine("    - Local:   http://127.0.0.1:5001");

            if (networkModeEnabled) {
                var host = System.Net.Dns.GetHostEntry(System.Net.Dns.GetHostName());
                foreach (var ip in host.AddressList) {
                    if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork) {
                        Console.WriteLine($"    - Network: http://{ip}:5001");
                    }
                }
            }
            Console.WriteLine(new string('=', 50) + "\n");

            Console.WriteLine("[*] Launching Local Browser...");
            Process.Start(new ProcessStartInfo {
                FileName = "http://127.0.0.1:5001",
                UseShellExecute = true
            });
        } catch (Exception ex) {
            Console.WriteLine($"[!] Could not open browser: {ex.Message}");
        }
    });
});


app.Run();

static string[] GetAllowedOrigins(IConfiguration configuration)
{
    var origins = configuration.GetSection("AllowedOrigins")
        .GetChildren()
        .Select(origin => origin.Value)
        .Where(origin => !string.IsNullOrWhiteSpace(origin))
        .Select(origin => origin!.Trim().TrimEnd('/'))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    if (origins.Length > 0) return origins;

    var inline = configuration["AllowedOrigins"];
    if (!string.IsNullOrWhiteSpace(inline))
    {
        origins = inline.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(origin => origin.TrimEnd('/'))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (origins.Length > 0) return origins;
    }

    return new[] { "http://localhost:5001", "http://127.0.0.1:5001" };
}
