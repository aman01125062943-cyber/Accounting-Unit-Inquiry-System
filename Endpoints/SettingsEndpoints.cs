using HKServer.Services;
using HKServer.Models;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Mvc;

namespace HKServer.Endpoints;

public static class SettingsEndpoints
{
    public static void MapSettingsEndpoints(this WebApplication app)
    {
        // ----------------------------------------------------
        // Phase 3-6: Filter Management Endpoints
        // ----------------------------------------------------

        // GET: Fetch all active filters
        app.MapGet("/api/filters", async (DatabaseService db) => {
            var filters = await db.GetFiltersAsync();
            return Results.Ok(filters);
        });

        // POST: Add a new filter
        app.MapPost("/api/filters", async (HKServer.Models.FilterDefinition filter, DatabaseService db) => {
            if (string.IsNullOrEmpty(filter.Name)) return Results.BadRequest("Name is required");
            await db.AddFilterAsync(filter);
            return Results.Ok(new { success = true });
        });

        // PUT: Edit existing filter
        app.MapPut("/api/filters/{id}", async (string id, HKServer.Models.FilterDefinition filter, DatabaseService db) => {
            filter.Id = id; // Ensure ID matches
            await db.UpdateFilterAsync(filter);
            return Results.Ok(new { success = true });
        });

        // DELETE: Remove existing filter
        app.MapDelete("/api/filters/{id}", async (string id, DatabaseService db) => {
            await db.DeleteFilterAsync(id);
            return Results.Ok(new { success = true });
        });
    }
}
