using Dapper;
using HKServer.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace HKServer.Services;

public class NotificationDispatcherService : BackgroundService
{
    private readonly DatabaseService _db;
    private readonly IHubContext<NotificationHub> _hub;
    private long _lastEventId = 0;
    private bool _initialized = false;

    public NotificationDispatcherService(DatabaseService db, IHubContext<NotificationHub> hub)
    {
        _db = db;
        _hub = hub;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var conn = _db.GetConnection();
                await conn.OpenAsync(stoppingToken);

                // تهيئة رقم آخر حدث عند تشغيل التطبيق لعدم جلب الإشعارات القديمة
                if (!_initialized)
                {
                    var maxId = await conn.ExecuteScalarAsync<long?>("SELECT MAX(Id) FROM NotificationEvents");
                    _lastEventId = maxId ?? 0;
                    _initialized = true;
                }

                var rows = await conn.QueryAsync<dynamic>(
                    "SELECT Id, TableName, Operation, RowId, CreatedAt FROM NotificationEvents WHERE Id > @LastId ORDER BY Id LIMIT 200",
                    new { LastId = _lastEventId }
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
                            timestamp = (string)r.CreatedAt,
                            status = "ناجحة"
                        };
                        
                        try
                        {
                            await _hub.Clients.All.SendAsync("DbChange", payload, cancellationToken: stoppingToken);
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[RealTime] Error broadcasting event {r.Id}: " + ex.Message);
                        }

                        // تحديث آخر حدث تم قبوله
                        if ((long)r.Id > _lastEventId) 
                        {
                            _lastEventId = (long)r.Id;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                // قد يظهر خطأ إذا كان الجدول غير موجود (أول تشغيل قبل التهيئة)، يتم التجاهل والانتظار 
                Console.WriteLine("[RealTime] Dispatcher error: " + ex.Message);
            }
            await Task.Delay(2000, stoppingToken); // الفحص كل ثانيتين للحفاظ على أداء الشبكة
        }
    }
}
