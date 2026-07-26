using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using HKServer.Hubs;

namespace HKServer.Services;

public class HiaapayAutoSyncService : BackgroundService
{
    private readonly DatabaseService _db;
    private readonly IHubContext<NotificationHub> _hubContext;
    private bool _isSyncing = false;

    public HiaapayAutoSyncService(DatabaseService db, IHubContext<NotificationHub> hubContext)
    {
        _db = db;
        _hubContext = hubContext;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Initial delay on server startup before first background sync cycle
        await Task.Delay(10000, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (!_isSyncing)
                {
                    await PerformHiaapaySyncAsync(stoppingToken);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[HiaapayAutoSync] Error during background cycle: {ex.Message}");
            }

            try
            {
                // Run background sync check every 20 seconds
                await Task.Delay(20000, stoppingToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }
        }
    }

    private async Task PerformHiaapaySyncAsync(CancellationToken stoppingToken)
    {
        _isSyncing = true;
        try
        {
            var projectRoot = FindProjectRoot();
            var scriptPath = Path.Combine(projectRoot, "hiaapay_connector.py");

            if (!File.Exists(scriptPath))
            {
                return;
            }

            var info = new ProcessStartInfo
            {
                FileName = "python",
                Arguments = $"-u \"{scriptPath}\" --action sync",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                StandardOutputEncoding = System.Text.Encoding.UTF8,
                StandardErrorEncoding = System.Text.Encoding.UTF8
            };

            using var process = Process.Start(info);
            if (process == null) return;

            var outputTask = process.StandardOutput.ReadToEndAsync();
            var errorTask = process.StandardError.ReadToEndAsync();

            await process.WaitForExitAsync(stoppingToken);

            var output = await outputTask;

            if (process.ExitCode == 0 && !string.IsNullOrWhiteSpace(output))
            {
                try
                {
                    using var doc = JsonDocument.Parse(output);
                    var root = doc.RootElement;
                    var success = root.TryGetProperty("success", out var succProp) && succProp.GetBoolean();
                    if (success)
                    {
                        var inserted = root.TryGetProperty("inserted", out var insProp) ? insProp.GetInt32() : 0;
                        var updated = root.TryGetProperty("updated", out var updProp) ? updProp.GetInt32() : 0;

                        if (inserted > 0 || updated > 0)
                        {
                            Console.WriteLine($"[HiaapayAutoSync] Auto-synced {inserted} new records, {updated} updated records.");

                            // Broadcast DbChange event so all web clients (Returns & SalaryReturns UI) refresh automatically
                            var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                            await _hubContext.Clients.All.SendAsync("DbChange", new
                            {
                                table = "Returns",
                                operation = "AUTO_HIAAPAY_SYNC",
                                rowId = 0,
                                timestamp = now,
                                status = "مكتملة",
                                inserted,
                                updated
                            }, stoppingToken);

                            await _hubContext.Clients.All.SendAsync("DbChange", new
                            {
                                table = "SalaryReturns",
                                operation = "AUTO_HIAAPAY_SYNC",
                                rowId = 0,
                                timestamp = now,
                                status = "مكتملة",
                                inserted,
                                updated
                            }, stoppingToken);
                        }
                    }
                }
                catch (Exception jsonEx)
                {
                    Console.WriteLine($"[HiaapayAutoSync] Warning: Failed to parse sync output: {jsonEx.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[HiaapayAutoSync] Sync execution failed: {ex.Message}");
        }
        finally
        {
            _isSyncing = false;
        }
    }

    private static string FindProjectRoot()
    {
        var paths = new[] {
            Directory.GetCurrentDirectory(),
            AppDomain.CurrentDomain.BaseDirectory,
            @"C:\Users\esth633\Desktop\المشاريع\hk"
        };

        foreach (var p in paths)
        {
            if (string.IsNullOrEmpty(p)) continue;
            var dir = p;
            while (!string.IsNullOrEmpty(dir))
            {
                if (File.Exists(Path.Combine(dir, "hiaapay_connector.py")))
                {
                    return dir;
                }
                var parent = Directory.GetParent(dir)?.FullName;
                if (parent == dir) break;
                dir = parent;
            }
        }
        return AppDomain.CurrentDomain.BaseDirectory;
    }
}
