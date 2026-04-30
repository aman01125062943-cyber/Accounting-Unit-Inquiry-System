using HKServer.Services;
using HKServer.Models.Chat;
using HKServer.Hubs;
using Dapper;
using Microsoft.AspNetCore.SignalR;

namespace HKServer.Endpoints;

/// <summary>
/// Endpoints ظ…ط³طھظ‚ظ„ط© ظ„ظ†ظا�… ا�„ظ…راس�„ط© - ظ„ا تؤثر ع�„ظ‰ ط£ظٹ Endpoint ظ…ظˆط¬ظˆد
/// </summary>
public static class ChatEndpoints
{
    public static void MapChatEndpoints(this WebApplication app)
    {
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        // طھظ‡يئة جدا�ˆظ„ ا�„شات ع�†ط¯ ط£ظˆظ„ استدعاء
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
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

        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        // ظ‚ائ�…ة ا�„ظ…ط³طھط®ط¯ظ…ظٹظ† (ظ…ع حا�„ة ا�„اتصا�„)
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        app.MapGet("/chat/users", async (DatabaseService db) =>
        {
            try
            {
                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                
                // ط¬ظ„ط¨ ظƒافة ا�„ظ…ط³طھط®ط¯ظ…ظٹظ† ظˆتحديد ا�„ظ†ط´ط·ظٹظ† ظ…ظ†ظ‡ظ…
                var allUsers = await conn.QueryAsync<HKServer.Models.User>(
                    "SELECT Id as id, Username as username, Fullname as fullname, Role as role, Active as active FROM Users"
                );
                
                // ا�„طھط£ظƒط¯ ظ…ظ† ظپظ„ترة ا�„ظ…ط³طھط®ط¯ظ…ظٹظ† ا�„ظ†ط´ط·ظٹظ† ظپظ‚ط·
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

        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        // ظ…حادثات �…ط³طھط®ط¯ظ… ظ…ط¹ظٹظ†
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
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

        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•�
        // إ�†شاء/فتح �…حادثة بي�† ظ…ط³طھط®ط¯ظ…ظٹظ†
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        app.MapPost("/chat/conversations", async (HttpContext context, DatabaseService db) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<CreateConversationRequest>();
                if (req == null) return Results.BadRequest(new { success = false, message = "Invalid request" });

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                // ا�„طھط£ظƒط¯ ظ…ظ† ا�„ترتيب ا�„ثابت (ا�„ط£طµط؛ط± ط£ظˆظ„ا�‹)
                var u1 = Math.Min(req.User1Id, req.User2Id);
                var u2 = Math.Max(req.User1Id, req.User2Id);

                if (u1 <= 0 || u2 <= 0 || u1 == u2)
                    return Results.BadRequest(new { success = false, message = "Invalid users" });

                if (!await IsActiveUser(conn, u1) || !await IsActiveUser(conn, u2))
                    return Results.BadRequest(new { success = false, message = "User not found or inactive" });

                // ظ…حا�ˆظ„ة إيجاد �…حادثة �…ظˆط¬ظˆط¯ط©
                var existing = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT Id FROM ChatConversations WHERE User1Id = @U1 AND User2Id = @U2",
                    new { U1 = u1, U2 = u2 }
                );

                if (existing != null)
                {
                    return Results.Ok(new { success = true, conversationId = (long)existing.Id, isNew = false });
                }

                // إ�†شاء �…حادثة جديدة
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

        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•�
        // رسائ�„ ظ…حادثة �…ط¹ظٹظ†ط© (ظ…ع pagination)
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        app.MapGet("/chat/messages/{conversationId:long}", async (long conversationId, int? page, int? pageSize, int? userId, DatabaseService db) =>
        {
            try
            {
                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                if (userId.GetValueOrDefault() > 0 && !await IsConversationParticipant(conn, conversationId, userId.Value))
                    return Results.Forbid();

                var p = Math.Max(page ?? 1, 1);
                var ps = Math.Clamp(pageSize ?? 50, 1, 100);
                var offset = (p - 1) * ps;

                var total = await conn.ExecuteScalarAsync<int>(
                    "SELECT COUNT(*) FROM ChatMessages WHERE ConversationId = @ConvId",
                    new { ConvId = conversationId }
                );

                var hasLikeCount = await ColumnExists(conn, "ChatMessages", "LikeCount");
                var likeCountSelect = hasLikeCount ? "m.LikeCount" : "0";

                var messages = await conn.QueryAsync<dynamic>($@"
                    SELECT m.Id, m.ConversationId, m.SenderId, m.Content, m.SentAt, m.IsRead, m.IsTaskConverted,
                           m.AttachmentUrl, m.AttachmentType, {likeCountSelect} as LikeCount,
                           u.Fullname as SenderName
                    FROM ChatMessages m
                    LEFT JOIN Users u ON m.SenderId = u.Id
                    WHERE m.ConversationId = @ConvId
                    ORDER BY m.Id DESC
                    LIMIT @Limit OFFSET @Offset
                ", new { ConvId = conversationId, Limit = ps, Offset = offset });

                var result = messages.Select(m =>
                {
                    var attachmentUrl = ResolveExistingChatAttachmentUrl((string?)m.AttachmentUrl);
                    return new
                    {
                        id = (long)m.Id,
                        conversationId = (long)m.ConversationId,
                        senderId = (int)(long)m.SenderId,
                        content = (string?)m.Content ?? "",
                        sentAt = (string?)m.SentAt,
                        isRead = Convert.ToInt64(m.IsRead ?? 0) == 1,
                        isTaskConverted = Convert.ToInt64(m.IsTaskConverted ?? 0) == 1,
                        attachmentUrl,
                        attachmentType = attachmentUrl == null ? null : (string?)m.AttachmentType,
                        likeCount = Convert.ToInt32(m.LikeCount ?? 0),
                        senderName = (string?)m.SenderName ?? "مستخدم"
                    };
                }).Reverse(); // ط¹ظƒس ا�„طھط±طھظٹط¨ ظ„ظٹظƒظˆظ† ا�„ط£ظ‚ط¯ظ… ط£ظˆظ„ا�‹

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

        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•�
        // إرسا�„ رسا�„ة جديدة
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        app.MapPost("/chat/messages", async (HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub, IHubContext<NotificationHub> notificationHub) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<SendMessageRequest>();
                if (req == null || (string.IsNullOrWhiteSpace(req.Content) && string.IsNullOrWhiteSpace(req.AttachmentUrl)))
                    return Results.BadRequest(new { success = false, message = "رسالة فارغة" });

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                if (!await IsConversationParticipant(conn, req.ConversationId, req.SenderId))
                    return Results.Forbid();

                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

                // إدراج ا�„رسا�„ط©
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

                // تحديث آخر رسا�„ة في ا�„ظ…حادثة
                await conn.ExecuteAsync(
                    "UPDATE ChatConversations SET LastMessageAt = @Now WHERE Id = @ConvId",
                    new { Now = now, ConvId = req.ConversationId }
                );

                // ط¬ظ„ب اس�… ا�„ظ…ط±ط³ظ„
                var senderName = await conn.ExecuteScalarAsync<string>(
                    "SELECT Fullname FROM Users WHERE Id = @Id", new { Id = req.SenderId }
                ) ?? "مستخدم";

                var targetUserId = await GetOtherConversationUserId(conn, req.ConversationId, req.SenderId);
                if (targetUserId.HasValue)
                {
                    var preview = string.IsNullOrWhiteSpace(req.Content) ? "مرفق جديد" : req.Content;
                    await db.AddUserNotificationAsync(
                        targetUserId.Value,
                        req.SenderId,
                        "chat",
                        "رسالة جديدة",
                        preview,
                        msgId,
                        "ChatMessages");
                    await notificationHub.Clients.Group(targetUserId.Value.ToString()).SendAsync("NotificationsChanged", new { userId = targetUserId.Value });
                }

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

                // إرسا�„ ا�„رسا�„ط© ط¹ط¨ط± SignalR ظ„حظيا�‹
                var groupName = $"chat_{req.ConversationId}";
                await chatHub.Clients.Group(groupName).SendAsync("ReceiveMessage", messagePayload);

                // إرسا�„ إشعار عبر �†ظا�… ا�„إشعارات ا�„حا�„ظٹ
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

        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•�
        // ا�„تفاع�„ ظ…ع رسا�„ة (Like)
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        app.MapPost("/chat/call", async (HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub, IHubContext<NotificationHub> notificationHub) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<SendChatCallRequest>();
                if (req == null) return Results.BadRequest(new { success = false, message = "Invalid request" });

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                var actorUserId = req.CurrentUserId;
                if (actorUserId <= 0) return Results.BadRequest(new { success = false, message = "Current user is required" });
                if (!await IsConversationParticipant(conn, req.ConversationId, actorUserId)) return Results.Forbid();

                var targetUserId = await GetOtherConversationUserId(conn, req.ConversationId, actorUserId);
                if (!targetUserId.HasValue) return Results.BadRequest(new { success = false, message = "Direct conversation target was not found" });
                if (req.TargetUserId > 0 && req.TargetUserId != targetUserId.Value) return Results.BadRequest(new { success = false, message = "Target user does not match this conversation" });
                if (targetUserId.Value == actorUserId) return Results.BadRequest(new { success = false, message = "Cannot ring yourself" });
                if (!await IsActiveUser(conn, targetUserId.Value)) return Results.BadRequest(new { success = false, message = "Target user not found or inactive" });

                var callerName = await conn.ExecuteScalarAsync<string>("SELECT Fullname FROM Users WHERE Id = @Id", new { Id = actorUserId }) ?? "مستخدم";
                var ringTone = string.IsNullOrWhiteSpace(req.RingTone) ? "classic" : req.RingTone.Trim();
                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                var ringId = await conn.ExecuteScalarAsync<long>(@"
                    INSERT INTO ChatRingEvents (ConversationId, CallerUserId, TargetUserId, Status, RingTone, CreatedAt, UpdatedAt)
                    VALUES (@ConversationId, @CallerUserId, @TargetUserId, 'Pending', @RingTone, @Now, @Now)
                    RETURNING Id;",
                    new { req.ConversationId, CallerUserId = actorUserId, TargetUserId = targetUserId.Value, RingTone = ringTone, Now = now });
                var notificationId = await db.AddUserNotificationAsync(
                    targetUserId.Value,
                    actorUserId,
                    "chat-call",
                    "رنين اتصال",
                    $"لديك رنين اتصال من {callerName}",
                    ringId,
                    "ChatRingEvents");

                await notificationHub.Clients.Group(targetUserId.Value.ToString()).SendAsync("NotificationsChanged", new { userId = targetUserId.Value });
                await chatHub.Clients.Group($"user_{targetUserId.Value}").SendAsync("IncomingChatCall", new
                {
                    conversationId = req.ConversationId,
                    ringId,
                    callerId = actorUserId,
                    callerName,
                    ringTone,
                    notificationId,
                    sentAt = now
                });

                await chatHub.Clients.Group($"user_{actorUserId}").SendAsync("ChatCallStatus", new { ringId, conversationId = req.ConversationId, status = "Pending", message = "جاري الاتصال..." });

                return Results.Ok(new { success = true, ringId, message = "جاري الاتصال...", targetUserId = targetUserId.Value });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Call error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        app.MapPost("/chat/call/accept", async (HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub, IHubContext<NotificationHub> notificationHub) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<RespondChatCallRequest>();
                if (req == null || req.RingId <= 0 || req.UserId <= 0) return Results.BadRequest(new { success = false, message = "Invalid request" });

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();
                var ring = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT * FROM ChatRingEvents WHERE Id = @Id", new { Id = req.RingId });
                if (ring == null) return Results.NotFound();

                var conversationId = (long)ring.ConversationId;
                var callerId = (int)(long)ring.CallerUserId;
                var targetId = (int)(long)ring.TargetUserId;
                if (req.UserId != targetId || !await IsConversationParticipant(conn, conversationId, req.UserId)) return Results.Forbid();
                if (((string?)ring.Status ?? "") != "Pending") return Results.BadRequest(new { success = false, message = "Ring already handled" });

                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                await conn.ExecuteAsync("UPDATE ChatRingEvents SET Status = 'Accepted', RespondedAt = @Now, UpdatedAt = @Now WHERE Id = @Id", new { Now = now, Id = req.RingId });

                var responderName = await conn.ExecuteScalarAsync<string>("SELECT Fullname FROM Users WHERE Id = @Id", new { Id = req.UserId }) ?? "مستخدم";
                var msgId = await InsertChatMessage(conn, conversationId, req.UserId, "أمرك يا فندم", now, null, null);
                await conn.ExecuteAsync("UPDATE ChatConversations SET LastMessageAt = @Now WHERE Id = @ConvId", new { Now = now, ConvId = conversationId });

                var messagePayload = new
                {
                    id = msgId,
                    conversationId,
                    senderId = req.UserId,
                    content = "أمرك يا فندم",
                    sentAt = now,
                    isRead = false,
                    isTaskConverted = false,
                    attachmentUrl = (string?)null,
                    attachmentType = (string?)null,
                    likeCount = 0,
                    senderName = responderName
                };

                await chatHub.Clients.Group($"chat_{conversationId}").SendAsync("ReceiveMessage", messagePayload);
                await chatHub.Clients.Group($"user_{callerId}").SendAsync("ChatCallStatus", new { ringId = req.RingId, conversationId, status = "Accepted", responderId = req.UserId, responderName, message = $"{responderName} رد على الرنين" });
                await db.AddUserNotificationAsync(callerId, req.UserId, "chat-call", "تم الرد على الرنين", $"{responderName} رد على الرنين", req.RingId, "ChatRingEvents");
                await notificationHub.Clients.Group(callerId.ToString()).SendAsync("NotificationsChanged", new { userId = callerId });
                await db.AddNotificationEventAsync("ChatRingEvents", "ACCEPT", req.RingId, responderName);

                return Results.Ok(new { success = true, message = messagePayload });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Accept call error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        app.MapPost("/chat/call/decline", async (HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub, IHubContext<NotificationHub> notificationHub) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<RespondChatCallRequest>();
                if (req == null || req.RingId <= 0 || req.UserId <= 0) return Results.BadRequest(new { success = false, message = "Invalid request" });

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();
                var ring = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT * FROM ChatRingEvents WHERE Id = @Id", new { Id = req.RingId });
                if (ring == null) return Results.NotFound();

                var conversationId = (long)ring.ConversationId;
                var callerId = (int)(long)ring.CallerUserId;
                var targetId = (int)(long)ring.TargetUserId;
                if (req.UserId != targetId || !await IsConversationParticipant(conn, conversationId, req.UserId)) return Results.Forbid();
                if (((string?)ring.Status ?? "") != "Pending") return Results.BadRequest(new { success = false, message = "Ring already handled" });

                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                await conn.ExecuteAsync("UPDATE ChatRingEvents SET Status = 'Declined', RespondedAt = @Now, UpdatedAt = @Now WHERE Id = @Id", new { Now = now, Id = req.RingId });
                var responderName = await conn.ExecuteScalarAsync<string>("SELECT Fullname FROM Users WHERE Id = @Id", new { Id = req.UserId }) ?? "مستخدم";

                await chatHub.Clients.Group($"user_{callerId}").SendAsync("ChatCallStatus", new { ringId = req.RingId, conversationId, status = "Declined", responderId = req.UserId, responderName, message = "تم رفض الرنين" });
                await db.AddUserNotificationAsync(callerId, req.UserId, "chat-call", "تم رفض الرنين", $"{responderName} رفض الرنين", req.RingId, "ChatRingEvents");
                await notificationHub.Clients.Group(callerId.ToString()).SendAsync("NotificationsChanged", new { userId = callerId });
                await db.AddNotificationEventAsync("ChatRingEvents", "DECLINE", req.RingId, responderName);

                return Results.Ok(new { success = true });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Decline call error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        app.MapPost("/chat/call/timeout", async (HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub, IHubContext<NotificationHub> notificationHub) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<TimeoutChatCallRequest>();
                if (req == null || req.RingId <= 0 || req.CallerId <= 0) return Results.BadRequest(new { success = false, message = "Invalid request" });

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();
                var ring = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT * FROM ChatRingEvents WHERE Id = @Id", new { Id = req.RingId });
                if (ring == null) return Results.NotFound();

                var conversationId = (long)ring.ConversationId;
                var callerId = (int)(long)ring.CallerUserId;
                if (req.CallerId != callerId || !await IsConversationParticipant(conn, conversationId, req.CallerId)) return Results.Forbid();
                if (((string?)ring.Status ?? "") != "Pending") return Results.Ok(new { success = true, handled = true });

                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                await conn.ExecuteAsync("UPDATE ChatRingEvents SET Status = 'NoAnswer', UpdatedAt = @Now WHERE Id = @Id", new { Now = now, Id = req.RingId });
                await chatHub.Clients.Group($"user_{callerId}").SendAsync("ChatCallStatus", new { ringId = req.RingId, conversationId, status = "NoAnswer", message = "لم يتم الرد" });
                await db.AddUserNotificationAsync(callerId, (int)(long)ring.TargetUserId, "chat-call", "لم يتم الرد", "لم يتم الرد على الرنين", req.RingId, "ChatRingEvents");
                await notificationHub.Clients.Group(callerId.ToString()).SendAsync("NotificationsChanged", new { userId = callerId });
                await db.AddNotificationEventAsync("ChatRingEvents", "NO_ANSWER", req.RingId, "system");

                return Results.Ok(new { success = true });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Timeout call error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        app.MapPost("/chat/messages/like", async (HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<LikeMessageRequest>();
                if (req == null) return Results.BadRequest(new { success = false, message = "Invalid request" });

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                // تحديث عداد ا�„إعجابات
                await conn.ExecuteAsync(
                    "UPDATE ChatMessages SET LikeCount = LikeCount + 1 WHERE Id = @Id",
                    new { Id = req.MessageId }
                );

                // ط¬ظ„ب ا�„بيا�†ات ا�„ظ…ط­ط¯ط«ط©
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

        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•�
        // إعادة جد�ˆظ„ط© ظ…ظ‡ظ…ة (Reschedule)
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        app.MapPut("/chat/tasks/{taskId:long}/reschedule", async (long taskId, HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub, IHubContext<NotificationHub> notificationHub) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<RescheduleTaskRequest>();
                if (req == null) return Results.BadRequest(new { success = false, message = "Invalid request" });

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                if (!await IsTaskParticipant(conn, taskId, req.UpdatedById))
                    return Results.Forbid();

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

                    await NotifyTaskParticipantsAsync(
                        task,
                        req.UpdatedById,
                        updaterName,
                        "task",
                        "إعادة جدولة مهمة",
                        $"{updaterName} أعاد جدولة المهمة: {(string)task.Title}",
                        taskId,
                        db,
                        notificationHub);
                }

                return Results.Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        // ط­ط°ظپ ظ…ظ‡ظ…ة
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        app.MapDelete("/chat/tasks/{taskId:long}", async (long taskId, int userId, DatabaseService db, IHubContext<ChatHub> chatHub, IHubContext<NotificationHub> notificationHub) =>
        {
            try
            {
                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                var task = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT * FROM ChatTasks WHERE Id = @Id", new { Id = taskId });
                if (task == null) return Results.NotFound();

                if (!await IsTaskParticipant(conn, taskId, userId))
                    return Results.Forbid();

                await conn.ExecuteAsync("DELETE FROM ChatTasks WHERE Id = @Id", new { Id = taskId });

                var deleterName = await conn.ExecuteScalarAsync<string>("SELECT Fullname FROM Users WHERE Id = @Id", new { Id = userId }) ?? "مستخدم";

                if (task.ConversationId != null)
                {
                    await chatHub.Clients.Group($"chat_{(long)task.ConversationId}").SendAsync("TaskDeleted", new { taskId, deletedBy = deleterName });
                }

                await NotifyTaskParticipantsAsync(
                    task,
                    userId,
                    deleterName,
                    "task",
                    "حذف مهمة",
                    $"{deleterName} حذف المهمة: {(string)task.Title}",
                    taskId,
                    db,
                    notificationHub);

                return Results.Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•�
        // إي�‚اف ا�„طھظ†ط¨ظٹظ‡ ظ„ظ…ظ‡ظ…ة (Deactivate Reminder)
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
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

        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•�
        // تحديث حا�„ة ا�„ظ‚راءة
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        app.MapPut("/chat/messages/read/{conversationId:long}", async (long conversationId, HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<MarkMessagesAsReadRequest>();
                int readerId = req?.ReaderId ?? 0;

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                if (readerId <= 0 || !await IsConversationParticipant(conn, conversationId, readerId))
                    return Results.Forbid();

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

        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•�
        // رفع ا�„ظ…ط±ظپظ‚ات ا�„خاصة با�„شات
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        app.MapPost("/chat/upload", async (HttpContext context, DatabaseService db) =>
        {
            try
            {
                var form = await context.Request.ReadFormAsync();
                var file = form.Files.GetFile("file");
                var userId = int.TryParse(form["userId"], out var parsedUserId) ? parsedUserId : 0;
                var conversationId = long.TryParse(form["conversationId"], out var parsedConversationId) ? parsedConversationId : 0;
                if (userId <= 0 || conversationId <= 0)
                    return Results.BadRequest(new { success = false, message = "User and conversation are required" });

                await InitChatTables(db);
                using (var conn = await db.GetOpenConnectionAsync())
                {
                    if (!await IsConversationParticipant(conn, conversationId, userId))
                        return Results.Forbid();
                }

                if (file != null)
                {
                    if (file.Length > 10 * 1024 * 1024)
                        return Results.BadRequest(new { success = false, message = "File is too large" });

                    var allowedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                    {
                        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".rar", ".zip"
                    };
                    var extension = Path.GetExtension(file.FileName);
                    if (!allowedExtensions.Contains(extension))
                        return Results.BadRequest(new { success = false, message = "Unsupported file type" });

                    var allowedImageContentTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                    {
                        "image/png", "image/jpeg", "image/webp", "image/gif"
                    };
                    if (file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase) && !allowedImageContentTypes.Contains(file.ContentType))
                        return Results.BadRequest(new { success = false, message = "Unsupported image type" });
                }
                if (file == null || file.Length == 0)
                    return Results.BadRequest(new { success = false, message = "لم يتم اختيار ملف" });

                // طھط­ط¯ظٹط¯ ظ…ط¬ظ„د ا�„ط­ظپط¸ ظپظٹ wwwroot
                var uploadsFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "uploads", "chat");
                if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

                var safeOriginalName = Path.GetFileName(file.FileName);
                var fileName = $"{Guid.NewGuid()}_{safeOriginalName}";
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

        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        // طھط­ظˆظٹظ„ رسا�„ة إ�„ظ‰ ظ…ظ‡ظ…ة
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        app.MapPost("/chat/tasks", async (HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub, IHubContext<NotificationHub> notificationHub) =>
        {
            try
            {
                var req = await context.Request.ReadFromJsonAsync<CreateTaskFromMessageRequest>();
                if (req == null) return Results.BadRequest(new { success = false, message = "Invalid request" });

                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                if (!await IsConversationParticipant(conn, req.ConversationId, req.CreatedById))
                    return Results.Forbid();

                if (!await IsActiveUser(conn, req.AssignedToId))
                    return Results.BadRequest(new { success = false, message = "Assigned user not found or inactive" });

                if (!await IsConversationParticipant(conn, req.ConversationId, req.AssignedToId))
                    return Results.Forbid();

                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

                // إ�†شاء ا�„ظ…ظ‡ظ…ط©
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

                var userTaskId = await conn.ExecuteScalarAsync<long>(@"
                    INSERT INTO UserTasks
                        (ManagerId, TargetUserId, Title, Description, Priority, Status, SourceTableId, SourceType, DueDate, ChatConversationId, ChatMessageId, CreatorUserId, AssignedUserId, CreatedAt)
                    VALUES
                        (@ManagerId, @TargetUserId, @Title, @Description, @Priority, 'New', @SourceTableId, 'Chat', @DueDate, @ConversationId, @MessageId, @CreatedById, @AssignedToId, @Now)
                    RETURNING Id;",
                    new
                    {
                        ManagerId = req.CreatedById,
                        TargetUserId = req.AssignedToId,
                        req.Title,
                        req.Description,
                        req.Priority,
                        SourceTableId = taskId,
                        req.DueDate,
                        req.ConversationId,
                        req.MessageId,
                        req.CreatedById,
                        req.AssignedToId,
                        Now = now
                    });

                // تحديث ا�„رسا�„ط© ظƒظ…ط­ظˆظ„ط© ظ„ظ…ظ‡ظ…ط©
                if (req.MessageId > 0)
                {
                    await conn.ExecuteAsync(
                        "UPDATE ChatMessages SET IsTaskConverted = 1 WHERE Id = @Id",
                        new { Id = req.MessageId }
                    );
                }

                // ط¬ظ„ط¨ ط£ط³ظ…اء ا�„ظ…ط³طھط®ط¯ظ…ظٹظ†
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

                // إرسا�„ إشعار SignalR
                var groupName = $"chat_{req.ConversationId}";
                await chatHub.Clients.Group(groupName).SendAsync("TaskCreated", taskPayload);

                // إشعار عبر ا�„ظ†ظا�… ا�„حا�„ظٹ
                await db.AddNotificationEventAsync("ChatTasks", "INSERT", taskId, creatorName);

                if (req.AssignedToId != req.CreatedById)
                {
                    await db.AddUserNotificationAsync(
                        req.AssignedToId,
                        req.CreatedById,
                        "task",
                        "مهمة محادثة جديدة",
                        req.Title,
                        userTaskId,
                        "UserTasks");
                    await notificationHub.Clients.Group(req.AssignedToId.ToString()).SendAsync("NotificationsChanged", new { userId = req.AssignedToId });
                }

                Console.WriteLine($"[Chat] Task created: {taskId} from message {req.MessageId} by {creatorName}");
                return Results.Ok(new { success = true, task = taskPayload });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Chat] Create task error: {ex.Message}");
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });

        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        // ظ…ظ‡ا�… ظ…ط³طھط®ط¯ظ… ظ…ط¹ظٹظ†
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
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

        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•�
        // تحديث حا�„ط© ظ…ظ‡ظ…ة
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        app.MapPut("/chat/tasks/{taskId:long}/status", async (long taskId, HttpContext context, DatabaseService db, IHubContext<ChatHub> chatHub, IHubContext<NotificationHub> notificationHub) =>
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

                if (!await IsTaskParticipant(conn, taskId, req.UpdatedById))
                    return Results.Forbid();

                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

                await conn.ExecuteAsync(
                    "UPDATE ChatTasks SET Status = @Status, UpdatedAt = @Now WHERE Id = @Id",
                    new { Status = req.Status, Now = now, Id = taskId }
                );

                // ط¬ظ„ب تفاصي�„ ا�„ظ…ظ‡ظ…ط©
                var task = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT * FROM ChatTasks WHERE Id = @Id", new { Id = taskId }
                );

                if (task != null)
                {
                    var updaterName = await conn.ExecuteScalarAsync<string>(
                        "SELECT Fullname FROM Users WHERE Id = @Id", new { Id = req.UpdatedById }
                    ) ?? "مستخدم";

                    // إرسا�„ إشعار
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
                    var statusText = req.Status switch
                    {
                        "Done" => "مكتملة",
                        "InProgress" => "قيد التنفيذ",
                        "Delayed" => "متأخرة",
                        "Canceled" => "ملغاة",
                        _ => "جديدة"
                    };
                    await NotifyTaskParticipantsAsync(
                        task,
                        req.UpdatedById,
                        updaterName,
                        "task",
                        req.Status == "Done" ? "تم إكمال مهمة" : "تحديث مهمة",
                        $"{updaterName} غيّر حالة المهمة \"{(string)task.Title}\" إلى {statusText}",
                        taskId,
                        db,
                        notificationHub);
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

        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        // ظ…ظ‡ا�… ظ…حادثة �…ط¹ظٹظ†ة
        // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
        app.MapGet("/chat/tasks/conversation/{conversationId:long}", async (long conversationId, int? userId, DatabaseService db) =>
        {
            try
            {
                await InitChatTables(db);
                using var conn = await db.GetOpenConnectionAsync();

                if (userId.GetValueOrDefault() > 0 && !await IsConversationParticipant(conn, conversationId, userId.Value))
                    return Results.Forbid();

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

    // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
    // طھظ‡يئة جدا�ˆظ„ ا�„شات (يت�… استدعاؤ�‡ا ت�„ظ‚ائيا�‹)
    // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
    private static bool _tablesInitialized = false;
    private static readonly object _initLock = new();

    private static async Task<bool> IsActiveUser(System.Data.IDbConnection conn, int userId)
    {
        if (userId <= 0) return false;
        var count = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM Users WHERE Id = @UserId AND Active = 1",
            new { UserId = userId });
        return count > 0;
    }

    private static async Task<bool> IsConversationParticipant(System.Data.IDbConnection conn, long conversationId, int userId)
    {
        if (conversationId <= 0 || userId <= 0) return false;
        var count = await conn.ExecuteScalarAsync<int>(@"
            SELECT COUNT(*)
            FROM ChatConversations
            WHERE Id = @ConversationId AND (User1Id = @UserId OR User2Id = @UserId)",
            new { ConversationId = conversationId, UserId = userId });
        return count > 0;
    }

    private static string? ResolveExistingChatAttachmentUrl(string? attachmentUrl)
    {
        if (string.IsNullOrWhiteSpace(attachmentUrl))
        {
            return null;
        }

        if (!attachmentUrl.StartsWith("/uploads/chat/", StringComparison.OrdinalIgnoreCase))
        {
            return attachmentUrl;
        }

        var fileName = Path.GetFileName(Uri.UnescapeDataString(attachmentUrl));
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return null;
        }

        var filePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "uploads", "chat", fileName);
        return File.Exists(filePath) ? attachmentUrl : null;
    }

    private static async Task<bool> IsTaskParticipant(System.Data.IDbConnection conn, long taskId, int userId)
    {
        if (taskId <= 0 || userId <= 0) return false;
        var count = await conn.ExecuteScalarAsync<int>(@"
            SELECT COUNT(*)
            FROM ChatTasks
            WHERE Id = @TaskId AND (AssignedToId = @UserId OR CreatedById = @UserId)",
            new { TaskId = taskId, UserId = userId });
        return count > 0;
    }

    private static async Task<int?> GetOtherConversationUserId(System.Data.IDbConnection conn, long conversationId, int userId)
    {
        var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT User1Id, User2Id FROM ChatConversations WHERE Id = @ConversationId",
            new { ConversationId = conversationId });

        if (row == null) return null;

        var user1Id = (int)(long)row.User1Id;
        var user2Id = (int)(long)row.User2Id;
        if (user1Id == userId) return user2Id;
        if (user2Id == userId) return user1Id;
        return null;
    }

    private static async Task NotifyTaskParticipantsAsync(
        dynamic task,
        int actorUserId,
        string actorName,
        string type,
        string title,
        string message,
        long taskId,
        DatabaseService db,
        IHubContext<NotificationHub> notificationHub)
    {
        var recipients = new[] { (int)(long)task.AssignedToId, (int)(long)task.CreatedById }
            .Where(id => id > 0 && id != actorUserId)
            .Distinct()
            .ToList();

        foreach (var targetUserId in recipients)
        {
            await db.AddUserNotificationAsync(
                targetUserId,
                actorUserId,
                type,
                title,
                message,
                taskId,
                "ChatTasks");

            await notificationHub.Clients.Group(targetUserId.ToString()).SendAsync("NotificationsChanged", new { userId = targetUserId });
        }
    }

    private static async Task<bool> ColumnExists(System.Data.IDbConnection conn, string tableName, string columnName)
    {
        var columns = await conn.QueryAsync<dynamic>($"PRAGMA table_info({tableName})");
        return columns.Any(c => string.Equals((string)c.name, columnName, StringComparison.OrdinalIgnoreCase));
    }

    private static async Task AddColumnIfMissing(System.Data.IDbConnection conn, string tableName, string columnName, string definition)
    {
        if (!await ColumnExists(conn, tableName, columnName))
            await conn.ExecuteAsync($"ALTER TABLE {tableName} ADD COLUMN {columnName} {definition};");
    }

    private static async Task<long> InsertChatMessage(System.Data.IDbConnection conn, long conversationId, int senderId, string content, string sentAt, string? attachmentUrl, string? attachmentType)
    {
        return await conn.ExecuteScalarAsync<long>(@"
            INSERT INTO ChatMessages (ConversationId, SenderId, Content, SentAt, IsRead, IsTaskConverted, AttachmentUrl, AttachmentType, LikeCount)
            VALUES (@ConversationId, @SenderId, @Content, @SentAt, 0, 0, @AttachmentUrl, @AttachmentType, 0)
            RETURNING Id;",
            new { ConversationId = conversationId, SenderId = senderId, Content = content, SentAt = sentAt, AttachmentUrl = attachmentUrl, AttachmentType = attachmentType });
    }

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

                CREATE TABLE IF NOT EXISTS ChatRingEvents (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ConversationId INTEGER NOT NULL,
                    CallerUserId INTEGER NOT NULL,
                    TargetUserId INTEGER NOT NULL,
                    Status TEXT NOT NULL DEFAULT 'Pending',
                    RingTone TEXT,
                    CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    RespondedAt TEXT,
                    UpdatedAt TEXT,
                    FOREIGN KEY(ConversationId) REFERENCES ChatConversations(Id),
                    FOREIGN KEY(CallerUserId) REFERENCES Users(Id),
                    FOREIGN KEY(TargetUserId) REFERENCES Users(Id)
                );
                CREATE INDEX IF NOT EXISTS IDX_ChatRingEvents_Target ON ChatRingEvents(TargetUserId, Status, CreatedAt);
                CREATE INDEX IF NOT EXISTS IDX_ChatRingEvents_Caller ON ChatRingEvents(CallerUserId, Status, CreatedAt);
            ");

            await AddColumnIfMissing(conn, "ChatMessages", "AttachmentUrl", "TEXT");
            await AddColumnIfMissing(conn, "ChatMessages", "AttachmentType", "TEXT");
            await AddColumnIfMissing(conn, "ChatMessages", "LikeCount", "INTEGER DEFAULT 0");
            await AddColumnIfMissing(conn, "ChatTasks", "ReminderTime", "TEXT");
            await AddColumnIfMissing(conn, "ChatTasks", "AlertSound", "TEXT");
            await AddColumnIfMissing(conn, "ChatTasks", "IsReminderActive", "INTEGER DEFAULT 1");

            _tablesInitialized = true;
            Console.WriteLine("[Chat] Tables initialized successfully");

            // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•گ
            // طھط­ط¯ظٹط« ظ‡ظٹظƒظ„ ا�„جدا�ˆظ„ (Schema Migration)
            // �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•�
            try {
                // إضافة أع�…دة ا�„ظ…ط±ظپظ‚ات �ˆا�„إعجابات �„ط¬ط¯ظˆظ„ ا�„رسائ�„ إذا �„ظ… طھظƒظ† ظ…ظˆط¬ظˆط¯ط©
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
                try { await conn.ExecuteAsync("ALTER TABLE ChatMessages ADD COLUMN LikeCount INTEGER DEFAULT 0;"); } catch {}
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


