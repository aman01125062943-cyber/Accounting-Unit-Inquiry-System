using HKServer.Services;

namespace HKServer.Endpoints;

public static class SearchIndexEndpoints
{
    public static void MapSearchIndexEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/search-index");

        group.MapGet("/status", async (DatabaseService db) =>
        {
            var status = await db.GetSearchFilterIndexStatusAsync();
            return Results.Ok(status);
        });

        group.MapGet("/filters", async (string? sourceType, DatabaseService db) =>
        {
            var filters = await db.GetSearchFilterIndexFiltersAsync(sourceType);
            return Results.Ok(filters);
        });

        group.MapPost("/rebuild", async (DatabaseService db) =>
        {
            var count = await db.RebuildSearchFilterIndexAsync();
            var status = await db.GetSearchFilterIndexStatusAsync();
            return Results.Ok(new { success = true, indexedCount = count, status });
        });
    }
}
