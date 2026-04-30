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
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy => {
        policy.SetIsOriginAllowed(_ => true) // Allow any origin for SignalR
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

// 5. Open Browser Automatically (Configure Port)
var url = "http://*:5001";
builder.WebHost.UseUrls(url);

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

// 3. Init DB
using (var scope = app.Services.CreateScope()) {
    var db = scope.ServiceProvider.GetRequiredService<DatabaseService>();
    try {
        db.InitDatabase().Wait();
    } catch (Exception ex) {
        Console.WriteLine($"[WARNING] Database initialization failed: {ex.InnerException?.Message ?? ex.Message}");
        Console.WriteLine("[WARNING] The application will start but database features may not work.");
    }
}

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
app.MapChatEndpoints();
app.MapTaskEndpoints();
app.MapNotificationEndpoints();
app.MapDashboardEndpoints();
app.MapAccountStatementEndpoints();
app.MapAdabirEndpoints();
app.MapSearchIndexEndpoints();

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
    return Results.Ok(new {
        basePath = "Local SQLite (hk.db)",
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
            Console.WriteLine("    - Local:   http://localhost:5001");
            
            // Print all local IP addresses for LAN access
            var host = System.Net.Dns.GetHostEntry(System.Net.Dns.GetHostName());
            foreach (var ip in host.AddressList) {
                if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork) {
                    Console.WriteLine($"    - Network: http://{ip}:5001");
                }
            }
            Console.WriteLine("[*] Port 5001 is pre-approved in Windows Firewall.");
            Console.WriteLine(new string('=', 50) + "\n");

            Console.WriteLine("[*] Launching Local Browser...");
            Process.Start(new ProcessStartInfo {
                FileName = "http://localhost:5001",
                UseShellExecute = true
            });
        } catch (Exception ex) {
            Console.WriteLine($"[!] Could not open browser: {ex.Message}");
        }
    });
});


app.Run();
