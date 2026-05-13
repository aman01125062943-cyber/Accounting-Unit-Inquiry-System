using HKServer.Services;
using Microsoft.Extensions.Caching.Memory;

namespace HKServer.Endpoints;

public static class SearchIndexEndpoints
{
    private static bool _rebuildInProgress = false;

    public static void MapSearchIndexEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/search-index");

        group.MapGet("/status", async (DatabaseService db) =>
        {
            var status = await db.GetSearchFilterIndexStatusAsync();
            return Results.Ok(status);
        });

        group.MapGet("/filters", async (string? sourceType, DatabaseService db, IMemoryCache cache) =>
        {
            var key = $"sfi:filters:{sourceType ?? "all"}";
            if (cache.TryGetValue(key, out object? cached))
                return Results.Ok(cached);

            var status = await db.GetSearchFilterIndexStatusAsync();
            var indexedCount = Convert.ToInt32((status as dynamic)?.IndexedCount ?? 0);

            if (indexedCount == 0 && !_rebuildInProgress)
            {
                // Index is empty — must rebuild once (first time setup)
                _rebuildInProgress = true;
                _ = Task.Run(async () =>
                {
                    try { await db.RebuildSearchFilterIndexAsync(); }
                    catch { }
                    finally { _rebuildInProgress = false; }
                });
            }
            // If stale but has data: serve existing data, user can manually rebuild from settings

            var result = await db.GetSearchFilterIndexFiltersAsync(sourceType, ensureFresh: false);
            var ttl = indexedCount > 0 ? TimeSpan.FromMinutes(3) : TimeSpan.FromSeconds(5);
            cache.Set(key, result, ttl);
            return Results.Ok(result);
        });

        group.MapPost("/rebuild", (DatabaseService db, IMemoryCache cache) =>
        {
            if (_rebuildInProgress)
                return Results.Ok(new { success = true, message = "Rebuild already in progress" });

            _rebuildInProgress = true;
            _ = Task.Run(async () =>
            {
                try
                {
                    await db.RebuildSearchFilterIndexAsync();
                    cache.Remove("sfi:filters:returns");
                    cache.Remove("sfi:filters:salary");
                    cache.Remove("sfi:filters:all");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[SearchIndex] Background rebuild failed: {ex.Message}");
                }
                finally
                {
                    _rebuildInProgress = false;
                }
            });

            return Results.Ok(new { success = true, message = "Background rebuild started" });
        });
    }
}
