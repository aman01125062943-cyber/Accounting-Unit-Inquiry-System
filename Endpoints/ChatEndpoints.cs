using HKServer.Services;
using HKServer.Models.Chat;
using HKServer.Hubs;
using Dapper;
using Microsoft.AspNetCore.SignalR;

namespace HKServer.Endpoints;

/// <summary>
/// Endpoints مستقلة لنظام المراسلة - لا تؤثر على أي Endpoint موجود
/// </summary>
public static class ChatEndpoints
{
    public static void MapChatEndpoints(this WebApplication app)
    {
        // ═══════════════════════════════════════════
        // تهيئة جداول الشات عند أول استدعاء
        // ═══════════════════════════════════════════
        app.MapGet("/chat/init", async (DatabaseService db) =>
        {
            try
            {
                await InitChatTables(db);
                return Results.Ok(new { success = true, message = "Chat tables initialized" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Init error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // ═══════════════════════════════════════════
        // قائمة المستخدمين (مع حالة الاتصال)
        // ═══════════════════════════════════════════
        app.MapGet("/chat/users", async (DatabaseService db) =>
        {
            try
            {
                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();
                
                // جلب كافة المستخدمين وتحديد النشطين منهم
                var allUsers = await conn.QueryAsync<HKServer.Models.User>(
                    "SELECT Id as id, Username as username, Fullname as fullname, Role as role, Active as active FROM Users"
                );
                
                // التأكد من فلترة المستخدمين النشطين فقط
                var activeUsers = allUsers.Where(u => u.active).ToList();
                var onlineIds = ChatHub.GetOnlineUserIds();
                
                var result = activeUsers.Select(u => new
                {
                    id = u.id,
                    username = u.username,
                    fullname = string.IsNullOrWhiteSpace(u.fullname) ? (u.username ?? "مستخدم") : u.fullname,
                    role = u.role,
                    isOnline = onlineIds.Contains(u.id),
                    avatar = !string.IsNullOrEmpty(u.fullname) ? u.fullname[0].ToString().ToUpper() : 
                             (!string.IsNullOrEmpty(u.username) ? u.username[0].ToString().ToUpper() : "?")
                });
                
                return Results.Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Users error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // ═══════════════════════════════════════════
        // محادثات مستخدم معين
        // ═══════════════════════════════════════════
        app.MapGet("/chat/conversations/{userId:int}", async (int userId, DatabaseService db) =>
        {
            try
            {
                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();
                var conversations = await conn.QueryAsync<dynamic>(@"
                    SELECT c.Id, c.User1Id, c.User2Id, c.LastMessageAt, c.CreatedAt,
                           CASE WHEN c.User1Id = @UserId THEN u2.Fullname ELSE u1.Fullname END as OtherUserName,
                           CASE WHEN c.User1Id = @UserId THEN c.User2Id ELSE c.User1Id END as OtherUserId,
                           (SELECT Content FROM ChatMessages WHERE ConversationId = c.Id ORDER BY Id DESC LIMIT 1) as LastMessage,
                           (SELECT COUNT(*) FROM ChatMessages WHERE ConversationId = c.Id AND SenderId != @UserId AND IsRead = 0) as UnreadCount
                    FROM ChatConversations c
                    LEFT JOIN Users u1 ON c.User1Id = u1.Id
                    LEFT JOIN Users u2 ON c.User2Id = u2.Id
                    WHERE c.User1Id = @UserId OR c.User2Id = @UserId
                    ORDER BY c.LastMessageAt DESC
                ", new { UserId = userId });

                var onlineIds = ChatHub.GetOnlineUserIds();
                var result = conversations.Select(c => new
                {
                    id = (long)c.Id,
                    user1Id = (int)(long)c.User1Id,
                    user2Id = (int)(long)c.User2Id,
                    lastMessageAt = (string?)c.LastMessageAt,
                    createdAt = (string?)c.CreatedAt,
                    otherUserName = (string?)c.OtherUserName ?? "مستخدم",
                    otherUserId = (int)(long)c.OtherUserId,
                    lastMessage = (string?)c.LastMessage ?? "",
                    unreadCount = (int)(long)c.UnreadCount,
                    isOnline = onlineIds.Contains((int)(long)c.OtherUserId)
                });

                return Results.Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Conversations error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // ═══════════════════════════════════════════
        // إنشاء/فتح محادثة بين مستخدمين
        // ═══════════════════════════════════════════
        app.MapPost("/chat/conversations", async (HttpContext context, DatabaseService db) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<CreateConversationRequest>();
                if (req == null) return Results.BadRequest(new { success = false, message = "Invalid request" });

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                // التأكد من الترتيب الثابت (الأصغر أولاً)
                var u1 = Math.Min(req.User1Id, req.User2Id);
                var u2 = Math.Max(req.User1Id, req.User2Id);

                // محاولة إيجاد محادثة موجودة
                var existing = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT Id FROM ChatConversations WHERE User1Id = @U1 AND User2Id = @U2",
                    new { U1 = u1, U2 = u2 }
                );

                if (existing != null)
                {
                    return Results.Ok(new { success = true, conversationId = (long)existing.Id, isNew = false });
                }

                // إنشاء محادثة جديدة
                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                var id = await conn.ExecuteScalarAsync<long>(
                    "INSERT INTO ChatConversations (User1Id, User2Id, CreatedAt) VALUES (@U1, @U2, @Now) RETURNING Id;",
                    new { U1 = u1, U2 = u2, Now = now }
                );

                Console.WriteLine($"[Chat] New conversation created: {id} between {u1} and {u2}");
                return Results.Ok(new { success = true, conversationId = id, isNew = true });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Create conversation error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // ═══════════════════════════════════════════
        // رسائل محادثة معينة (مع pagination)
        // ═══════════════════════════════════════════
        app.MapGet("/chat/messages/{conversationId:long}", async (long conversationId, int? page, int? pageSize, DatabaseService db) =>
        {
            try
            {
                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                var p = page ?? 1;
                var ps = pageSize ?? 50;
                var offset = (p - 1) * ps;

                var total = await conn.ExecuteScalarAsync<int>(
                    "SELECT COUNT(*) FROM ChatMessages WHERE ConversationId = @ConvId",
                    new { ConvId = conversationId }
                );

                var messages = await conn.QueryAsync<dynamic>(@"
                    SELECT m.Id, m.ConversationId, m.SenderId, m.Content, m.SentAt, m.IsRead, m.IsTaskConverted,
                           m.AttachmentUrl, m.AttachmentType, m.LikeCount,
                           u.Fullname as SenderName
                    FROM ChatMessages m
                    LEFT JOIN Users u ON m.SenderId = u.Id
                    WHERE m.ConversationId = @ConvId
                    ORDER BY m.Id DESC
                    LIMIT @Limit OFFSET @Offset
                ", new { ConvId = conversationId, Limit = ps, Offset = offset });

                var result = messages.Select(m => new
                {
                    id = (long)m.Id,
                    conversationId = (long)m.ConversationId,
                    senderId = (int)(long)m.SenderId,
                    content = (string)m.Content,
                    sentAt = (string?)m.SentAt,
                    isRead = ((long)m.IsRead) == 1,
                    isTaskConverted = ((long)m.IsTaskConverted) == 1,
                    attachmentUrl = (string?)m.AttachmentUrl,
                    attachmentType = (string?)m.AttachmentType,
                    likeCount = (int)(long)m.LikeCount,
                    senderName = (string?)m.SenderName ?? "مستخدم"
                }).Reverse(); // عكس الترتيب ليكون الأقدم أولاً

                return Results.Ok(new
                {
                    data = result,
                    pagination = new { total, currentPage = p, pageSize = ps, totalPages = (int)Math.Ceiling((double)total / ps) }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Messages error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // ═══════════════════════════════════════════
        // إرسال رسالة جديدة
        // ═══════════════════════════════════════════
        app.MapPost("/chat/messages", async (HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<SendMessageRequest>();
                if (req == null || string.IsNullOrWhiteSpace(req.Content))
                    return Results.BadRequest(new { success = false, message = "رسالة فارغة" });

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

                // إدراج الرسالة
                var msgId = await conn.ExecuteScalarAsync<long>(@"
                    INSERT INTO ChatMessages (ConversationId, SenderId, Content, SentAt, IsRead, IsTaskConverted, AttachmentUrl, AttachmentType, LikeCount)
                    VALUES (@ConvId, @SenderId, @Content, @Now, 0, 0, @AttachmentUrl, @AttachmentType, 0) RETURNING Id;
                ", new { 
                    ConvId = req.ConversationId, 
                    SenderId = req.SenderId, 
                    Content = req.Content, 
                    Now = now,
                    AttachmentUrl = req.AttachmentUrl,
                    AttachmentType = req.AttachmentType
                });

                // تحديث آخر رسالة في المحادثة
                await conn.ExecuteAsync(
                    "UPDATE ChatConversations SET LastMessageAt = @Now WHERE Id = @ConvId",
                    new { Now = now, ConvId = req.ConversationId }
                );

                // جلب اسم المرسل
                var senderName = await conn.ExecuteScalarAsync<string>(
                    "SELECT Fullname FROM Users WHERE Id = @Id", new { Id = req.SenderId }
                ) ?? "مستخدم";

                var messagePayload = new
                {
                    id = msgId,
                    conversationId = req.ConversationId,
                    senderId = req.SenderId,
                    content = req.Content,
                    sentAt = now,
                    isRead = false,
                    isTaskConverted = false,
                    attachmentUrl = req.AttachmentUrl,
                    attachmentType = req.AttachmentType,
                    likeCount = 0,
                    senderName
                };

                // إرسال الرسالة عبر SignalR لحظياً
                var groupName = $"chat_{req.ConversationId}";
                await chatHub.Clients.Group(groupName).SendAsync("ReceiveMessage", messagePayload);

                // إرسال إشعار عبر نظام الإشعارات الحالي
                await db.AddNotificationEventAsync("ChatMessages", "INSERT", msgId, senderName);

                Console.WriteLine($"[Chat] Message sent: {msgId} in conv {req.ConversationId} by {senderName}");
                return Results.Ok(new { success = true, message = messagePayload });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Send message error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // ═══════════════════════════════════════════
        // التفاعل مع رسالة (Like)
        // ═══════════════════════════════════════════
        app.MapPost("/chat/messages/like", async (HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<LikeMessageRequest>();
                if (req == null) return Results.BadRequest(new { success = false, message = "Invalid request" });

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                // تحديث عداد الإعجابات
                await conn.ExecuteAsync(
                    "UPDATE ChatMessages SET LikeCount = LikeCount + 1 WHERE Id = @Id",
                    new { Id = req.MessageId }
                );

                // جلب البيانات المحدثة
                var msg = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT ConversationId, LikeCount FROM ChatMessages WHERE Id = @Id",
                    new { Id = req.MessageId }
                );

                if (msg != null)
                {
                    var groupName = $"chat_{(long)msg.ConversationId}";
                    await chatHub.Clients.Group(groupName).SendAsync("MessageLiked", new
                    {
                        messageId = req.MessageId,
                        likeCount = (int)(long)msg.LikeCount,
                        likedBy = req.UserId
                    });
                }

                return Results.Ok(new { success = true, likeCount = (int)(long)msg?.LikeCount });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Like message error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // ═══════════════════════════════════════════
        // إعادة جدولة مهمة (Reschedule)
        // ═══════════════════════════════════════════
        app.MapPut("/chat/tasks/{taskId:long}/reschedule", async (long taskId, HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<RescheduleTaskRequest>();
                if (req == null) return Results.BadRequest(new { success = false, message = "Invalid request" });

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

                await conn.ExecuteAsync(@"
                    UPDATE ChatTasks 
                    SET DueDate = @NewDueDate, 
                        ReminderTime = @NewReminderTime, 
                        UpdatedAt = @Now,
                        IsReminderActive = 1
                    WHERE Id = @Id",
                    new { req.NewDueDate, req.NewReminderTime, Now = now, Id = taskId }
                );

                var task = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT * FROM ChatTasks WHERE Id = @Id", new { Id = taskId });
                if (task != null)
                {
                    var updaterName = await conn.ExecuteScalarAsync<string>("SELECT Fullname FROM Users WHERE Id = @Id", new { Id = req.UpdatedById }) ?? "مستخدم";
                    
                    if (task.ConversationId != null)
                    {
                        await chatHub.Clients.Group($"chat_{(long)task.ConversationId}").SendAsync("TaskRescheduled", new
                        {
                            taskId,
                            newDueDate = req.NewDueDate,
                            newReminderTime = req.NewReminderTime,
                            updatedAt = now,
                            updatedBy = updaterName
                        });
                    }
                }

                return Results.Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // ═══════════════════════════════════════════
        // حذف مهمة
        // ═══════════════════════════════════════════
        app.MapDelete("/chat/tasks/{taskId:long}", async (long taskId, int userId, DatabaseService db, IHubContext<ChatHub> chatHub) =>
        {
            try
            {
                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                var task = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT * FROM ChatTasks WHERE Id = @Id", new { Id = taskId });
                if (task == null) return Results.NotFound();

                await conn.ExecuteAsync("DELETE FROM ChatTasks WHERE Id = @Id", new { Id = taskId });

                var deleterName = await conn.ExecuteScalarAsync<string>("SELECT Fullname FROM Users WHERE Id = @Id", new { Id = userId }) ?? "مستخدم";

                if (task.ConversationId != null)
                {
                    await chatHub.Clients.Group($"chat_{(long)task.ConversationId}").SendAsync("TaskDeleted", new { taskId, deletedBy = deleterName });
                }

                return Results.Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // ═══════════════════════════════════════════
        // إيقاف التنبيه لمهمة (Deactivate Reminder)
        // ═══════════════════════════════════════════
        app.MapPut("/chat/tasks/{taskId:long}/deactivate-reminder", async (long taskId, DatabaseService db) =>
        {
            try
            {
                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();
                await conn.ExecuteAsync("UPDATE ChatTasks SET IsReminderActive = 0 WHERE Id = @Id", new { Id = taskId });
                return Results.Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // ═══════════════════════════════════════════
        // تحديث حالة القراءة
        // ═══════════════════════════════════════════
        app.MapPut("/chat/messages/read/{conversationId:long}", async (long conversationId, HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<MarkMessagesAsReadRequest>();
                int readerId = req?.ReaderId ?? 0;

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                var updated = await conn.ExecuteAsync(
                    "UPDATE ChatMessages SET IsRead = 1 WHERE ConversationId = @ConvId AND SenderId != @ReaderId AND IsRead = 0",
                    new { ConvId = conversationId, ReaderId = readerId }
                );

                if (updated > 0)
                {
                    var groupName = $"chat_{conversationId}";
                    await chatHub.Clients.Group(groupName).SendAsync("MessageRead", conversationId, readerId);
                }

                return Results.Ok(new { success = true, updatedCount = updated });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Read update error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // ═══════════════════════════════════════════
        // رفع المرفقات الخاصة بالشات
        // ═══════════════════════════════════════════
        app.MapPost("/chat/upload", async (HttpContext context) =>
        {
            try
            {
                var form = await context.Request.ReadFormAsync();
                var file = form.Files.GetFile("file");
                if (file == null || file.Length == 0)
                    return Results.BadRequest(new { success = false, message = "لم يتم اختيار ملف" });

                // تحديد مجلد الحفظ في wwwroot
                var uploadsFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "uploads", "chat");
                if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

                var fileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
                var filePath = Path.Combine(uploadsFolder, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var relativeUrl = $"/uploads/chat/{fileName}";
                return Results.Ok(new { success = true, url = relativeUrl, fileName = file.FileName });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat Upload] Error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        }).DisableAntiforgery();

        // ═══════════════════════════════════════════
        // تحويل رسالة إلى مهمة
        // ═══════════════════════════════════════════
        app.MapPost("/chat/tasks", async (HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<CreateTaskFromMessageRequest>();
                if (req == null) return Results.BadRequest(new { success = false, message = "Invalid request" });

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

                // إنشاء المهمة
                var taskId = await conn.ExecuteScalarAsync<long>(@"
                    INSERT INTO ChatTasks (MessageId, ConversationId, Title, Description, DueDate, ReminderTime, AlertSound, IsReminderActive, Priority, Status, AssignedToId, CreatedById, Attachments, CreatedAt, UpdatedAt)
                    VALUES (@MessageId, @ConversationId, @Title, @Description, @DueDate, @ReminderTime, @AlertSound, 1, @Priority, 'New', @AssignedToId, @CreatedById, @Attachments, @Now, @Now) RETURNING Id;
                ", new
                {
                    req.MessageId,
                    req.ConversationId,
                    req.Title,
                    req.Description,
                    req.DueDate,
                    req.ReminderTime,
                    req.AlertSound,
                    req.Priority,
                    req.AssignedToId,
                    req.CreatedById,
                    req.Attachments,
                    Now = now
                });

                // تحديث الرسالة كمحولة لمهمة
                if (req.MessageId > 0)
                {
                    await conn.ExecuteAsync(
                        "UPDATE ChatMessages SET IsTaskConverted = 1 WHERE Id = @Id",
                        new { Id = req.MessageId }
                    );
                }

                // جلب أسماء المستخدمين
                var creatorName = await conn.ExecuteScalarAsync<string>(
                    "SELECT Fullname FROM Users WHERE Id = @Id", new { Id = req.CreatedById }
                ) ?? "مستخدم";

                var assigneeName = await conn.ExecuteScalarAsync<string>(
                    "SELECT Fullname FROM Users WHERE Id = @Id", new { Id = req.AssignedToId }
                ) ?? "مستخدم";

                var taskPayload = new
                {
                    id = taskId,
                    messageId = req.MessageId,
                    conversationId = req.ConversationId,
                    title = req.Title,
                    description = req.Description,
                    dueDate = req.DueDate,
                    reminderTime = req.ReminderTime,
                    alertSound = req.AlertSound,
                    isReminderActive = true,
                    priority = req.Priority,
                    status = "New",
                    assignedToId = req.AssignedToId,
                    createdById = req.CreatedById,
                    attachments = req.Attachments,
                    createdAt = now,
                    assignedToName = assigneeName,
                    createdByName = creatorName
                };

                // إرسال إشعار SignalR
                var groupName = $"chat_{req.ConversationId}";
                await chatHub.Clients.Group(groupName).SendAsync("TaskCreated", taskPayload);

                // إشعار عبر النظام الحالي
                await db.AddNotificationEventAsync("ChatTasks", "INSERT", taskId, creatorName);

                Console.WriteLine($"[Chat] Task created: {taskId} from message {req.MessageId} by {creatorName}");
                return Results.Ok(new { success = true, task = taskPayload });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Create task error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // ═══════════════════════════════════════════
        // مهام مستخدم معين
        // ═══════════════════════════════════════════
        app.MapGet("/chat/tasks/{userId:int}", async (int userId, DatabaseService db) =>
        {
            try
            {
                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                var tasks = await conn.QueryAsync<dynamic>(@"
                    SELECT t.*, 
                           ua.Fullname as AssignedToName, 
                           uc.Fullname as CreatedByName,
                           m.Content as MessageContent
                    FROM ChatTasks t
                    LEFT JOIN Users ua ON t.AssignedToId = ua.Id
                    LEFT JOIN Users uc ON t.CreatedById = uc.Id
                    LEFT JOIN ChatMessages m ON t.MessageId = m.Id
                    WHERE t.AssignedToId = @UserId OR t.CreatedById = @UserId
                    ORDER BY t.CreatedAt DESC
                ", new { UserId = userId });

                var result = tasks.Select(t => new
                {
                    id = (long)t.Id,
                    messageId = t.MessageId != null ? (long?)t.MessageId : null,
                    conversationId = t.ConversationId != null ? (long?)t.ConversationId : null,
                    title = (string)t.Title,
                    description = (string?)t.Description,
                    dueDate = (string?)t.DueDate,
                    reminderTime = (string?)t.ReminderTime,
                    alertSound = (string?)t.AlertSound,
                    isReminderActive = t.IsReminderActive != null && (long)t.IsReminderActive == 1,
                    priority = (string)t.Priority,
                    status = (string)t.Status,
                    assignedToId = (int)(long)t.AssignedToId,
                    createdById = (int)(long)t.CreatedById,
                    attachments = (string?)t.Attachments,
                    createdAt = (string?)t.CreatedAt,
                    updatedAt = (string?)t.UpdatedAt,
                    assignedToName = (string?)t.AssignedToName ?? "مستخدم",
                    createdByName = (string?)t.CreatedByName ?? "مستخدم",
                    messageContent = (string?)t.MessageContent
                });

                return Results.Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Tasks error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // ═══════════════════════════════════════════
        // تحديث حالة مهمة
        // ═══════════════════════════════════════════
        app.MapPut("/chat/tasks/{taskId:long}/status", async (long taskId, HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<UpdateTaskStatusRequest>();
                if (req == null) return Results.BadRequest(new { success = false, message = "Invalid request" });

                // Validate status
                var validStatuses = new[] { "New", "InProgress", "Delayed", "Done", "Canceled" };
                if (!validStatuses.Contains(req.Status))
                    return Results.BadRequest(new { success = false, message = "حالة غير صالحة" });

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

                await conn.ExecuteAsync(
                    "UPDATE ChatTasks SET Status = @Status, UpdatedAt = @Now WHERE Id = @Id",
                    new { Status = req.Status, Now = now, Id = taskId }
                );

                // جلب تفاصيل المهمة
                var task = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT * FROM ChatTasks WHERE Id = @Id", new { Id = taskId }
                );

                if (task != null)
                {
                    var updaterName = await conn.ExecuteScalarAsync<string>(
                        "SELECT Fullname FROM Users WHERE Id = @Id", new { Id = req.UpdatedById }
                    ) ?? "مستخدم";

                    // إرسال إشعار
                    if (task.ConversationId != null)
                    {
                        var groupName = $"chat_{(long)task.ConversationId}";
                        await chatHub.Clients.Group(groupName).SendAsync("TaskStatusChanged", new
                        {
                            taskId,
                            status = req.Status,
                            updatedAt = now,
                            updatedBy = updaterName
                        });
                    }

                    await db.AddNotificationEventAsync("ChatTasks", "UPDATE", taskId, updaterName);
                    Console.WriteLine($"[Chat] Task {taskId} status updated to {req.Status} by {updaterName}");
                }

                return Results.Ok(new { success = true, taskId, status = req.Status });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Update task error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // ═══════════════════════════════════════════
        // مهام محادثة معينة
        // ═══════════════════════════════════════════
        app.MapGet("/chat/tasks/conversation/{conversationId:long}", async (long conversationId, DatabaseService db) =>
        {
            try
            {
                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                var tasks = await conn.QueryAsync<dynamic>(@"
                    SELECT t.*, 
                           ua.Fullname as AssignedToName, 
                           uc.Fullname as CreatedByName,
                           m.Content as MessageContent
                    FROM ChatTasks t
                    LEFT JOIN Users ua ON t.AssignedToId = ua.Id
                    LEFT JOIN Users uc ON t.CreatedById = uc.Id
                    LEFT JOIN ChatMessages m ON t.MessageId = m.Id
                    WHERE t.ConversationId = @ConvId
                    ORDER BY t.CreatedAt DESC
                ", new { ConvId = conversationId });

                var result = tasks.Select(t => new
                {
                    id = (long)t.Id,
                    messageId = t.MessageId != null ? (long?)t.MessageId : null,
                    title = (string)t.Title,
                    description = (string?)t.Description,
                    dueDate = (string?)t.DueDate,
                    reminderTime = (string?)t.ReminderTime,
                    alertSound = (string?)t.AlertSound,
                    isReminderActive = t.IsReminderActive != null && (long)t.IsReminderActive == 1,
                    priority = (string)t.Priority,
                    status = (string)t.Status,
                    assignedToId = (int)(long)t.AssignedToId,
                    createdById = (int)(long)t.CreatedById,
                    createdAt = (string?)t.CreatedAt,
                    assignedToName = (string?)t.AssignedToName ?? "مستخدم",
                    createdByName = (string?)t.CreatedByName ?? "مستخدم",
                    messageContent = (string?)t.MessageContent
                });

                return Results.Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Conversation tasks error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });
    }

    // ═══════════════════════════════════════════
    // تهيئة جداول الشات (يتم استدعاؤها تلقائياً)
    // ═══════════════════════════════════════════
    private static bool _tablesInitialized = false;
    private static readonly object _initLock = new();

    private static async Task InitChatTables(DatabaseService db)
    {
        if (_tablesInitialized) return;

        lock (_initLock)
        {
            if (_tablesInitialized) return;
        }

        try
        {
            using var conn = await db.GetOpenConnectionAsync();
            await conn.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS ChatConversations (
                    Id SERIAL PRIMARY KEY,
                    User1Id INTEGER NOT NULL,
                    User2Id INTEGER NOT NULL,
                    LastMessageAt TEXT,
                    CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(User1Id, User2Id)
                );

                CREATE TABLE IF NOT EXISTS ChatMessages (
                    Id SERIAL PRIMARY KEY,
                    ConversationId INTEGER NOT NULL,
                    SenderId INTEGER NOT NULL,
                    Content TEXT NOT NULL,
                    SentAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    IsRead INTEGER DEFAULT 0,
                    IsTaskConverted INTEGER DEFAULT 0,
                    AttachmentUrl TEXT,
                    AttachmentType TEXT,
                    LikeCount INTEGER DEFAULT 0,
                    FOREIGN KEY(ConversationId) REFERENCES ChatConversations(Id),
                    FOREIGN KEY(SenderId) REFERENCES Users(Id)
                );
                CREATE INDEX IF NOT EXISTS IDX_ChatMessages_ConvId ON ChatMessages(ConversationId);
                CREATE INDEX IF NOT EXISTS IDX_ChatMessages_SenderId ON ChatMessages(SenderId);

                CREATE TABLE IF NOT EXISTS ChatTasks (
                    Id SERIAL PRIMARY KEY,
                    MessageId INTEGER,
                    ConversationId INTEGER,
                    Title TEXT NOT NULL,
                    Description TEXT,
                    DueDate TEXT,
                    ReminderTime TEXT,
                    AlertSound TEXT,
                    IsReminderActive INTEGER DEFAULT 1,
                    Priority TEXT DEFAULT 'Medium',
                    Status TEXT DEFAULT 'New',
                    AssignedToId INTEGER NOT NULL,
                    CreatedById INTEGER NOT NULL,
                    Attachments TEXT,
                    CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    UpdatedAt TEXT,
                    FOREIGN KEY(MessageId) REFERENCES ChatMessages(Id),
                    FOREIGN KEY(ConversationId) REFERENCES ChatConversations(Id),
                    FOREIGN KEY(AssignedToId) REFERENCES Users(Id),
                    FOREIGN KEY(CreatedById) REFERENCES Users(Id)
                );
                CREATE INDEX IF NOT EXISTS IDX_ChatTasks_AssignedTo ON ChatTasks(AssignedToId);
                CREATE INDEX IF NOT EXISTS IDX_ChatTasks_Status ON ChatTasks(Status);
            ");

            _tablesInitialized = true;
            Console.WriteLine("[Chat] Tables initialized successfully");

            // ═══════════════════════════════════════════
            // تحديث هيكل الجداول (Schema Migration)
            // ═══════════════════════════════════════════
            try {
                // إضافة أعمدة المرفقات والإعجابات لجدول الرسائل إذا لم تكن موجودة
                await conn.ExecuteAsync(@"
                    -- AttachmentUrl
                    BEGIN TRY
                        ALTER TABLE ChatMessages ADD COLUMN AttachmentUrl TEXT;
                    END TRY BEGIN CATCH END CATCH;

                    -- AttachmentType
                    BEGIN TRY
                        ALTER TABLE ChatMessages ADD COLUMN AttachmentType TEXT;
                    END TRY BEGIN CATCH END CATCH;

                    -- LikeCount
                    BEGIN TRY
                        ALTER TABLE ChatMessages ADD COLUMN LikeCount INTEGER DEFAULT 0;
                    END TRY BEGIN CATCH END CATCH;
                ");
            } catch {
                // SQLite doesn't support BEGIN TRY, so we'll do it one by one with individual catch
                try { await conn.ExecuteAsync("ALTER TABLE ChatMessages ADD COLUMN AttachmentUrl TEXT;"); } catch {}
                try { await conn.ExecuteAsync("ALTER TABLE ChatMessages ADD COLUMN AttachmentType TEXT;"); } catch {}
                try { await conn.ExecuteAsync("ALTER TABLE ChatTasks ADD COLUMN ReminderTime TEXT;"); } catch {}
                try { await conn.ExecuteAsync("ALTER TABLE ChatTasks ADD COLUMN AlertSound TEXT;"); } catch {}
                try { await conn.ExecuteAsync("ALTER TABLE ChatTasks ADD COLUMN IsReminderActive INTEGER DEFAULT 1;"); } catch {}
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Chat] Table init error: {ex.Message}");
            throw;
        }
    }
}
