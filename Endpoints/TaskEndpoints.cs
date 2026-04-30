using HKServer.Services;
using HKServer.Models;
using HKServer.Hubs;
using Microsoft.AspNetCore.SignalR;
using Dapper;

namespace HKServer.Endpoints;

public static class TaskEndpoints
{
    private static int GetActorUserId(HttpContext context)
    {
        if (int.TryParse(context.Request.Headers["X-User-Id"], out var headerId)) return headerId;
        if (int.TryParse(context.Request.Query["userId"], out var queryId)) return queryId;
        return 0;
    }

    public static void MapTaskEndpoints(this WebApplication app)
    {
        // --- User Tasks ---

        app.MapGet("/tasks/my", async (int userId, DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var tasks = await conn.QueryAsync<UserTask>(@"
                SELECT t.*, u.Fullname as ManagerName, tu.Fullname as TargetUserName
                FROM UserTasks t
                JOIN Users u ON t.ManagerId = u.Id
                JOIN Users tu ON t.TargetUserId = tu.Id
                WHERE t.TargetUserId = @UserId
                ORDER BY CASE Priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, t.CreatedAt DESC", 
                new { UserId = userId });
            return Results.Ok(tasks);
        });

        app.MapGet("/tasks/assigned", async (int managerId, DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var tasks = await conn.QueryAsync<UserTask>(@"
                SELECT t.*, u.Fullname as ManagerName, tu.Fullname as TargetUserName
                FROM UserTasks t
                JOIN Users u ON t.ManagerId = u.Id
                JOIN Users tu ON t.TargetUserId = tu.Id
                WHERE t.ManagerId = @ManagerId
                ORDER BY CASE Priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, t.CreatedAt DESC", 
                new { ManagerId = managerId });
            return Results.Ok(tasks);
        });

        app.MapGet("/tasks/all", async (DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var tasks = await conn.QueryAsync<UserTask>(@"
                SELECT t.*, u.Fullname as ManagerName, tu.Fullname as TargetUserName
                FROM UserTasks t
                JOIN Users u ON t.ManagerId = u.Id
                JOIN Users tu ON t.TargetUserId = tu.Id
                ORDER BY CASE Priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, t.CreatedAt DESC");
            return Results.Ok(tasks);
        });

        app.MapGet("/tasks/stats", async (int userId, DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var total = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM UserTasks WHERE TargetUserId = @Id", new { Id = userId });
            var newCount = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM UserTasks WHERE TargetUserId = @Id AND Status = 'New'", new { Id = userId });
            var inProgress = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM UserTasks WHERE TargetUserId = @Id AND Status = 'InProgress'", new { Id = userId });
            var done = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM UserTasks WHERE TargetUserId = @Id AND Status = 'Done'", new { Id = userId });
            var highPriority = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM UserTasks WHERE TargetUserId = @Id AND Priority = 'High' AND Status != 'Done'", new { Id = userId });
            return Results.Ok(new { total, newCount, inProgress, done, highPriority });
        });

        app.MapPost("/tasks/assign", async (UserTask task, DatabaseService db, IHubContext<NotificationHub> hub) => {
            using var conn = await db.GetOpenConnectionAsync();
            task.CreatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            
            var id = await conn.QuerySingleAsync<int>(@"
                INSERT INTO UserTasks (ManagerId, TargetUserId, Title, Description, Priority, Status, SourceTableId, SourceType, DueDate, CreatedAt)
                VALUES (@ManagerId, @TargetUserId, @Title, @Description, @Priority, 'New', @SourceTableId, @SourceType, @DueDate, @CreatedAt)
                RETURNING Id;", task);
            
            // Log it
            var manager = await conn.QueryFirstOrDefaultAsync<User>("SELECT * FROM Users WHERE Id = @Id", new { Id = task.ManagerId });
            await db.AddAuditLogAsync(task.ManagerId, manager?.fullname ?? "Manager", "إسناد مهمة", $"تم إسناد مهمة '{task.Title}' إلى المستخدم ID: {task.TargetUserId}");

            await db.AddUserNotificationAsync(
                task.TargetUserId,
                task.ManagerId,
                "task",
                "مهمة جديدة من المدير",
                task.Title,
                id,
                "UserTasks");

            await hub.Clients.Group(task.TargetUserId.ToString()).SendAsync("NotificationsChanged", new { userId = task.TargetUserId });

            return Results.Ok(new { success = true, id });
        });

        app.MapPost("/tasks/update-status", async (HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            var req = await context.Request.ReadFromJsonAsync<HKServer.Models.UpdateUserTaskStatusReq>();
            if (req == null) return Results.BadRequest();

            using var conn = await db.GetOpenConnectionAsync();
            string completedAt = req.Status == "Done" ? DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") : null;
            await conn.ExecuteAsync(
                "UPDATE UserTasks SET Status = @Status, CompletedAt = @CompletedAt WHERE Id = @TaskId",
                new { req.Status, CompletedAt = completedAt, req.TaskId });

            // Notify manager
            var task = await conn.QueryFirstOrDefaultAsync<UserTask>("SELECT * FROM UserTasks WHERE Id = @Id", new { Id = req.TaskId });
            if (task != null) {
                var user = await conn.QueryFirstOrDefaultAsync<User>("SELECT * FROM Users WHERE Id = @Id", new { Id = task.TargetUserId });
                string statusText = req.Status == "Done" ? "مكتملة" : req.Status == "InProgress" ? "قيد التنفيذ" : "جديدة";
                var message = $"قام {user?.fullname} بتغيير حالة '{task.Title}' إلى: {statusText}";
                await db.AddUserNotificationAsync(task.ManagerId, task.TargetUserId, "task", "تحديث مهمة", message, task.Id, "UserTasks");
                await hub.Clients.Group(task.ManagerId.ToString()).SendAsync("NotificationsChanged", new { userId = task.ManagerId });
            }

            return Results.Ok(new { success = true });
        });

        app.MapDelete("/tasks/{id}", async (int id, HttpContext context, DatabaseService db) => {
            if (!await db.UserHasPermissionAsync(GetActorUserId(context), "action.delete"))
                return Results.Json(new { success = false, message = "غير مصرح بتنفيذ الحذف" }, statusCode: 403);
            using var conn = await db.GetOpenConnectionAsync();
            await conn.ExecuteAsync("DELETE FROM UserTasks WHERE Id = @Id", new { Id = id });
            return Results.Ok(new { success = true });
        });

        // --- Table Sharing ---

        app.MapPost("/shares/send", async (TableShare share, DatabaseService db, IHubContext<NotificationHub> hub) => {
            using var conn = await db.GetOpenConnectionAsync();
            share.CreatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            share.Status = "Pending";

            var id = await conn.QuerySingleAsync<int>(@"
                INSERT INTO TableShares (TableId, TableType, SharedById, SharedWithId, Message, Status, CreatedAt)
                VALUES (@TableId, @TableType, @SharedById, @SharedWithId, @Message, @Status, @CreatedAt)
                RETURNING Id;", share);

            // Log it
            var sender = await conn.QueryFirstOrDefaultAsync<User>("SELECT * FROM Users WHERE Id = @Id", new { Id = share.SharedById });
            await db.AddAuditLogAsync(share.SharedById, sender?.fullname ?? "User", "مشاركة جدول", $"مشاركة جدول ID: {share.TableId} مع المستخدم ID: {share.SharedWithId}");

            await db.AddUserNotificationAsync(
                share.SharedWithId,
                share.SharedById,
                "share",
                "طلب مشاركة جدول",
                $"قام {sender?.fullname} بمشاركة جدول معك",
                id,
                "TableShares");

            await hub.Clients.Group(share.SharedWithId.ToString()).SendAsync("NotificationsChanged", new { userId = share.SharedWithId });

            return Results.Ok(new { success = true, id });
        });

        app.MapGet("/shares/pending", async (int userId, DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var shares = await conn.QueryAsync<TableShare>(@"
                SELECT s.*, u.Fullname as SharedByName 
                FROM TableShares s
                JOIN Users u ON s.SharedById = u.Id
                WHERE s.SharedWithId = @UserId AND s.Status = 'Pending'
                ORDER BY s.CreatedAt DESC", new { UserId = userId });
            return Results.Ok(shares);
        });

        app.MapPost("/shares/respond", async (HttpContext context, DatabaseService db) => {
            var req = await context.Request.ReadFromJsonAsync<dynamic>();
            int shareId = (int)req?.shareId;
            string status = (string)req?.status; // 'Accepted' or 'Rejected'
            int userId = (int)req?.userId;

            using var conn = await db.GetOpenConnectionAsync();
            await conn.ExecuteAsync("UPDATE TableShares SET Status = @Status WHERE Id = @Id AND SharedWithId = @UserId", 
                new { Status = status, Id = shareId, UserId = userId });

            // Log response
            var user = await conn.QueryFirstOrDefaultAsync<User>("SELECT * FROM Users WHERE Id = @Id", new { Id = userId });
            await db.AddAuditLogAsync(userId, user?.fullname ?? "User", "رد على مشاركة", $"تم { (status == "Accepted" ? "قبول" : "رفض") } المشاركة ID: {shareId}");

            return Results.Ok(new { success = true });
        });

        // --- Audit Logs ---

        app.MapGet("/audit/logs", async (DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var logs = await conn.QueryAsync<AuditLogEntry>("SELECT * FROM AuditLogs ORDER BY CreatedAt DESC LIMIT 200");
            return Results.Ok(logs);
        });
        
        // --- Set Exclusive User ---
        app.MapPost("/archives/exclusive", async (HttpContext context, DatabaseService db) => {
            var req = await context.Request.ReadFromJsonAsync<dynamic>();
            int archiveId = (int)req?.archiveId;
            int? userId = (int?)req?.userId;
            string type = (string)req?.type; // 'incentive' or 'salary'

            using var conn = await db.GetOpenConnectionAsync();
            string table = type == "salary" ? "SalaryArchives" : "Archives";
            await conn.ExecuteAsync($"UPDATE {table} SET ExclusiveUserId = @UserId WHERE Id = @Id", new { UserId = userId, Id = archiveId });
            
            return Results.Ok(new { success = true });
        });
    }
}

