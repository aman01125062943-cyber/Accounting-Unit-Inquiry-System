using Dapper;
using Microsoft.AspNetCore.Mvc;
using HKServer.Services;
using HKServer.Hubs;
using Microsoft.AspNetCore.SignalR;
using System.Text.Json;

namespace HKServer.Endpoints;

public static class AutoImportReportEndpoints
{
    private static int GetActorUserId(HttpContext context)
    {
        return SecurityHardening.GetActorUserId(context);
    }

    public static void MapAutoImportReportEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/auto-import-reports");

        // Get all reports summary
        group.MapGet("/", async (DatabaseService db) =>
        {
            try
            {
                using var conn = await db.GetOpenConnectionAsync();
                var sql = "SELECT Id, RunDateTime, Filename, TotalRows, MatchedCount, FailedCount, Type FROM AutoImportReports ORDER BY Id DESC LIMIT 100";
                var rows = await conn.QueryAsync<dynamic>(sql);
                return Results.Ok(new { success = true, data = rows });
            }
            catch (Exception ex)
            {
                Console.WriteLine("=== GET AUTO IMPORT REPORTS ERROR ===");
                Console.WriteLine(ex.ToString());
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // Get detailed report by Id (including failed details)
        group.MapGet("/{id:int}", async (int id, DatabaseService db) =>
        {
            try
            {
                using var conn = await db.GetOpenConnectionAsync();
                var sql = "SELECT Id, RunDateTime, Filename, TotalRows, MatchedCount, FailedCount, FailedDetailsJson, Type FROM AutoImportReports WHERE Id = @Id";
                var report = await conn.QueryFirstOrDefaultAsync<dynamic>(sql, new { Id = id });
                
                if (report == null)
                {
                    return Results.NotFound(new { success = false, message = "لم يتم العثور على التقرير المطلوب" });
                }

                // Deserialize JSON list of failures
                var failures = new List<object>();
                string json = report.FailedDetailsJson?.ToString() ?? "[]";
                try
                {
                    failures = JsonSerializer.Deserialize<List<object>>(json) ?? new List<object>();
                }
                catch { }

                return Results.Ok(new
                {
                    success = true,
                    data = new
                    {
                        Id = report.Id,
                        RunDateTime = report.RunDateTime,
                        Filename = report.Filename,
                        TotalRows = report.TotalRows,
                        MatchedCount = report.MatchedCount,
                        FailedCount = report.FailedCount,
                        Type = report.Type,
                        Failures = failures
                    }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"=== GET AUTO IMPORT REPORT DETAILS ERROR (ID: {id}) ===");
                Console.WriteLine(ex.ToString());
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // Delete a report from log
        group.MapDelete("/{id:int}", async (int id, DatabaseService db, HttpContext context) =>
        {
            try
            {
                // Check permissions
                if (!await db.UserHasPermissionAsync(GetActorUserId(context), "action.delete"))
                    return Results.Json(new { success = false, message = "غير مصرح لك بحذف التقارير" }, statusCode: 403);

                using var conn = await db.GetOpenConnectionAsync();
                var affected = await conn.ExecuteAsync("DELETE FROM AutoImportReports WHERE Id = @Id", new { Id = id });
                
                if (affected > 0)
                {
                    return Results.Ok(new { success = true, message = "تم حذف التقرير بنجاح" });
                }
                return Results.NotFound(new { success = false, message = "لم يتم العثور على التقرير المطلوب" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"=== DELETE AUTO IMPORT REPORT ERROR (ID: {id}) ===");
                Console.WriteLine(ex.ToString());
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });
    }
}
