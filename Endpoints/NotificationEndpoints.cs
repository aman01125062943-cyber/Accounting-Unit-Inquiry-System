using Dapper;
using HKServer.Hubs;
using HKServer.Models;
using HKServer.Services;
using Microsoft.AspNetCore.SignalR;

namespace HKServer.Endpoints;

public static class NotificationEndpoints
{
    public static void MapNotificationEndpoints(this WebApplication app)
    {
        async Task<IResult> GetNotifications(int userId, int? limit, DatabaseService db)
        {
            if (userId <= 0) return Results.BadRequest(new { success = false, message = "Invalid userId" });

            using var conn = await db.GetOpenConnectionAsync();
            var take = Math.Clamp(limit ?? 50, 1, 100);
            var rows = await conn.QueryAsync<UserNotification>(@"
                SELECT n.Id,
                       n.TargetUserId,
                       n.ActorUserId,
                       n.Type,
                       n.Title,
                       n.Message,
                       n.RelatedEntityId,
                       n.RelatedEntityType,
                       n.IsRead,
                       n.CreatedAt,
                       u.Fullname AS ActorName
                FROM UserNotifications n
                LEFT JOIN Users u ON n.ActorUserId = u.Id
                WHERE n.TargetUserId = @UserId
                ORDER BY n.CreatedAt DESC, n.Id DESC
                LIMIT @Take",
                new { UserId = userId, Take = take });

            return Results.Ok(rows);
        }

        async Task<IResult> GetUnreadCount(int userId, DatabaseService db)
        {
            if (userId <= 0) return Results.BadRequest(new { success = false, message = "Invalid userId" });

            using var conn = await db.GetOpenConnectionAsync();
            var count = await conn.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM UserNotifications WHERE TargetUserId = @UserId AND IsRead = 0",
                new { UserId = userId });
            return Results.Ok(new { count });
        }

        async Task<IResult> MarkRead(long id, int userId, DatabaseService db, IHubContext<NotificationHub> hub)
        {
            if (id <= 0 || userId <= 0) return Results.BadRequest(new { success = false, message = "Invalid request" });

            using var conn = await db.GetOpenConnectionAsync();
            var updated = await conn.ExecuteAsync(
                "UPDATE UserNotifications SET IsRead = 1 WHERE Id = @Id AND TargetUserId = @UserId",
                new { Id = id, UserId = userId });
            await conn.ExecuteAsync(
                "UPDATE Notifications SET IsRead = 1 WHERE Id = @Id AND TargetUserId = @UserId",
                new { Id = id, UserId = userId });

            if (updated > 0)
            {
                await hub.Clients.Group(userId.ToString()).SendAsync("NotificationsChanged", new { userId });
            }

            return Results.Ok(new { success = true, updated });
        }

        async Task<IResult> MarkAllRead(int userId, DatabaseService db, IHubContext<NotificationHub> hub)
        {
            if (userId <= 0) return Results.BadRequest(new { success = false, message = "Invalid userId" });

            using var conn = await db.GetOpenConnectionAsync();
            var updated = await conn.ExecuteAsync(
                "UPDATE UserNotifications SET IsRead = 1 WHERE TargetUserId = @UserId AND IsRead = 0",
                new { UserId = userId });
            await conn.ExecuteAsync(
                "UPDATE Notifications SET IsRead = 1 WHERE TargetUserId = @UserId AND IsRead = 0",
                new { UserId = userId });

            if (updated > 0)
            {
                await hub.Clients.Group(userId.ToString()).SendAsync("NotificationsChanged", new { userId });
            }

            return Results.Ok(new { success = true, updated });
        }

        app.MapGet("/notifications", GetNotifications);
        app.MapGet("/api/notifications", GetNotifications);
        app.MapGet("/notifications/unread-count", GetUnreadCount);
        app.MapGet("/api/notifications/unread-count", GetUnreadCount);
        app.MapPut("/notifications/{id:long}/read", MarkRead);
        app.MapPost("/api/notifications/{id:long}/read", MarkRead);
        app.MapPut("/notifications/read-all", MarkAllRead);
        app.MapPost("/api/notifications/mark-all-read", MarkAllRead);
    }
}
