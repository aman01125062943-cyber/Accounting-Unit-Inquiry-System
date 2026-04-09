using Dapper;
using HKServer.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace HKServer.Services;

public class NotificationDispatcherService : BackgroundService
{
    private readonly DatabaseService _db;
    private readonly IHubContext<NotificationHub> _hub;
    private bool _initialized = false;

    public NotificationDispatcherService(DatabaseService db, IHubContext<NotificationHub> hub)
    {
        _db = db;
        _hub = hub;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // ═══ تنظيف أولي عند بدء التشغيل لمحاربة "طوفان" الإشعارات القديمة ═══
        try
        {
            using var conn = _db.GetConnection();
            await conn.OpenAsync(stoppingToken);
            var deletedCount = await conn.ExecuteAsync("DELETE FROM NotificationEvents");
            if (deletedCount > 0)
            {
                Console.WriteLine($"[RealTime] Startup: تم تنظيف {deletedCount} إشعار قديم لتجنب التكرار.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("[RealTime] Startup cleanup error: " + ex.Message);
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var conn = _db.GetConnection();
                await conn.OpenAsync(stoppingToken);

                // جلب الأحداث ومعالجتها ثم حذفها فوراً (مع جلب اسم المستخدم CreatedBy)
                var rows = await conn.QueryAsync<dynamic>(
                    "SELECT Id, TableName, Operation, RowId, CreatedBy, CreatedAt FROM NotificationEvents ORDER BY Id LIMIT 100"
                );

                var events = rows.ToList();
                if (events.Any())
                {
                    foreach (var r in events)
                    {
                        var payload = new
                        {
                            table = (string)r.TableName,
                            operation = (string)r.Operation,
                            rowId = (long)r.RowId,
                            user = (string)r.CreatedBy ?? "النظام",
                            timestamp = (string)r.CreatedAt,
                            status = "ناجحة"
                        };
                        
                        try
                        {
                            // بث الإشعار للجميع
                            await _hub.Clients.All.SendAsync("DbChange", payload, cancellationToken: stoppingToken);
                            
                            // ═══ حذف السجل فوراً بعد البث بنجاح لمنع التكرار ═══
                            await conn.ExecuteAsync("DELETE FROM NotificationEvents WHERE Id = @Id", new { Id = r.Id });
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[RealTime] Error broadcasting/deleting event {r.Id}: " + ex.Message);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[RealTime] Dispatcher error: " + ex.Message);
            }
            
            await Task.Delay(2000, stoppingToken);
        }
    }
}
