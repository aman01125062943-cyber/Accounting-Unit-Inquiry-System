using HKServer.Services;
using HKServer.Models;
using HKServer.Hubs;
using Microsoft.AspNetCore.SignalR;
using Dapper;

namespace HKServer.Endpoints;

public static class ArchiveEndpoints
{
    public static void MapArchiveEndpoints(this WebApplication app)
    {
        app.MapGet("/archive", async (DatabaseService db) => {
            using var conn = db.GetConnection();
            var archive = await conn.QueryAsync<ArchiveEntry>("SELECT Id, Date, Filename, RecordCount, Size FROM Archives ORDER BY Id DESC");
            return Results.Ok(archive);
        });

        app.MapPost("/archive/restore/{id}", async (int id, HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            try {
                var config = DatabaseService.LoadServerConfig();
                config.ActiveImportId = id;
                DatabaseService.SaveServerConfig(config);
                await db.MarkSearchFilterIndexStaleAsync();
                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await hub.Clients.All.SendAsync("UpdateData", "Archive", user, "استعادة");
                return Results.Ok(new { success = true, message = "تم تفعيل الأرشيف بنجاح" });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        }).DisableAntiforgery();

        app.MapPost("/archive/clear-restore", async (HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
             try {
                var config = DatabaseService.LoadServerConfig();
                config.ActiveImportId = 0;
                DatabaseService.SaveServerConfig(config);
                await db.MarkSearchFilterIndexStaleAsync();
                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await hub.Clients.All.SendAsync("UpdateData", "Archive", user, "استعادة");
                return Results.Ok(new { success = true, message = "تم إلغاء التفعيل والعودة للوضع الطبيعي" });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        }).DisableAntiforgery();

        app.MapDelete("/archive/{id}", async (int id, HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            try {
                using var conn = await db.GetOpenConnectionAsync();
                await conn.ExecuteAsync("PRAGMA foreign_keys = ON; DELETE FROM Archives WHERE Id = @Id", new { Id = id });
                await db.MarkSearchFilterIndexStaleAsync();
                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await hub.Clients.All.SendAsync("UpdateData", "Archive", user, "حذف");
                return Results.Ok(new { success = true });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        }).DisableAntiforgery();

        // ==========================================
        // Salary Archive Endpoints
        // ==========================================
        app.MapGet("/salary-archive", async (DatabaseService db) => {
            using var conn = db.GetConnection();
            var archive = await conn.QueryAsync<ArchiveEntry>("SELECT Id, Date, Filename, RecordCount, Size FROM SalaryArchives ORDER BY Id DESC");
            return Results.Ok(archive);
        });

        app.MapPost("/salary-archive/restore/{id}", async (int id, HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            try {
                var config = DatabaseService.LoadServerConfig();
                config.ActiveSalaryImportId = id;
                DatabaseService.SaveServerConfig(config);
                await db.MarkSearchFilterIndexStaleAsync();
                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await hub.Clients.All.SendAsync("UpdateData", "SalaryArchive", user, "استعادة");
                return Results.Ok(new { success = true, message = "تم تفعيل أرشيف المرتبات بنجاح" });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        }).DisableAntiforgery();

        app.MapPost("/salary-archive/clear-restore", async (HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
             try {
                var config = DatabaseService.LoadServerConfig();
                config.ActiveSalaryImportId = 0;
                DatabaseService.SaveServerConfig(config);
                await db.MarkSearchFilterIndexStaleAsync();
                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await hub.Clients.All.SendAsync("UpdateData", "SalaryArchive", user, "استعادة");
                return Results.Ok(new { success = true, message = "تم إلغاء التفعيل والعودة للوضع الطبيعي" });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        }).DisableAntiforgery();

        app.MapDelete("/salary-archive/{id}", async (int id, HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            try {
                using var conn = await db.GetOpenConnectionAsync();
                await conn.ExecuteAsync("PRAGMA foreign_keys = ON; DELETE FROM SalaryArchives WHERE Id = @Id", new { Id = id });
                await db.MarkSearchFilterIndexStaleAsync();
                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await hub.Clients.All.SendAsync("UpdateData", "SalaryArchive", user, "حذف");
                return Results.Ok(new { success = true });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        }).DisableAntiforgery();
    }
}
