using HKServer.Services;
using Dapper;
using System.Text.Json;

namespace HKServer.Endpoints;

public static class ConnectorEndpoints
{
    private static Dictionary<string, object>? _tablesCache = null;
    private static DateTime _lastCacheTime = DateTime.MinValue;

    public static void MapConnectorEndpoints(this WebApplication app)
    {
        // 1. API لاسترجاع جداول قاعدة البيانات بأسلوب خفيف وسريع جداً (Memory Cache + Optimized Limit)
        app.MapGet("/api/connector/all-tables", async (DatabaseService db) =>
        {
            try
            {
                if (_tablesCache != null && (DateTime.Now - _lastCacheTime).TotalSeconds < 5)
                {
                    return Results.Ok(new { success = true, totalTables = _tablesCache.Count, tables = _tablesCache, cached = true });
                }

                using var conn = db.GetConnection();
                var tableNames = (await conn.QueryAsync<string>(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_FTS_%' ORDER BY name"
                )).ToList();

                var tablesResult = new Dictionary<string, object>();
                foreach (var table in tableNames)
                {
                    try
                    {
                        var rows = (await conn.QueryAsync($"SELECT * FROM `{table}` LIMIT 30")).ToList();
                        tablesResult[table] = rows;
                    }
                    catch
                    {
                        tablesResult[table] = new List<object>();
                    }
                }

                _tablesCache = tablesResult;
                _lastCacheTime = DateTime.Now;

                return Results.Ok(new { success = true, totalTables = tableNames.Count, tables = tablesResult });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
            }
        });

        // 2. API لـ Paginated Query سريعة جداً بأسلوب C# Minimal API
        app.MapGet("/api/connector/table/{tableName}", async (string tableName, HttpContext context, DatabaseService db) =>
        {
            try
            {
                using var conn = db.GetConnection();
                var limit = int.TryParse(context.Request.Query["limit"], out var l) ? Math.Min(l, 100) : 50;
                var offset = int.TryParse(context.Request.Query["offset"], out var o) ? o : 0;

                var rows = (await conn.QueryAsync($"SELECT * FROM `{tableName}` LIMIT @Limit OFFSET @Offset", new { Limit = limit, Offset = offset })).ToList();

                return Results.Ok(new {
                    success = true,
                    tableName,
                    limit,
                    offset,
                    data = rows
                });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
            }
        });
    }
}
