using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;

namespace HKServer.Hubs;

/// <summary>
/// SignalR Hub مستقل لنظام المراسلة - لا يؤثر على NotificationHub الحالي
/// </summary>
public class ChatHub : Hub
{
    // تتبع المستخدمين المتصلين (UserId → ConnectionIds)
    private static readonly ConcurrentDictionary<int, HashSet<string>> _onlineUsers = new();
    // تتبع ConnectionId → UserId
    private static readonly ConcurrentDictionary<string, int> _connectionUserMap = new();

    /// <summary>
    /// تسجيل المستخدم عند الاتصال
    /// </summary>
    public async Task RegisterUser(int userId)
    {
        _connectionUserMap[Context.ConnectionId] = userId;

        if (!_onlineUsers.ContainsKey(userId))
            _onlineUsers[userId] = new HashSet<string>();

        _onlineUsers[userId].Add(Context.ConnectionId);

        Console.WriteLine($"[Chat] User {userId} connected: {Context.ConnectionId}");

        // إخبار الجميع أن المستخدم أصبح متصلاً
        await Clients.Others.SendAsync("UserOnline", userId);
    }

    /// <summary>
    /// الانضمام لمحادثة معينة (SignalR Group)
    /// </summary>
    public async Task JoinConversation(long conversationId)
    {
        var groupName = $"chat_{conversationId}";
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        Console.WriteLine($"[Chat] {Context.ConnectionId} joined conversation {conversationId}");
    }

    /// <summary>
    /// مغادرة محادثة
    /// </summary>
    public async Task LeaveConversation(long conversationId)
    {
        var groupName = $"chat_{conversationId}";
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
    }

    /// <summary>
    /// إشعار الكتابة
    /// </summary>
    public async Task SendTyping(long conversationId, int userId)
    {
        var groupName = $"chat_{conversationId}";
        await Clients.OthersInGroup(groupName).SendAsync("UserTyping", conversationId, userId);
    }

    /// <summary>
    /// إيقاف إشعار الكتابة
    /// </summary>
    public async Task StopTyping(long conversationId, int userId)
    {
        var groupName = $"chat_{conversationId}";
        await Clients.OthersInGroup(groupName).SendAsync("UserStoppedTyping", conversationId, userId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (_connectionUserMap.TryRemove(Context.ConnectionId, out var userId))
        {
            if (_onlineUsers.TryGetValue(userId, out var connections))
            {
                connections.Remove(Context.ConnectionId);
                if (connections.Count == 0)
                {
                    _onlineUsers.TryRemove(userId, out _);
                    // إخبار الجميع أن المستخدم أصبح غير متصل
                    await Clients.Others.SendAsync("UserOffline", userId);
                    Console.WriteLine($"[Chat] User {userId} fully disconnected");
                }
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// التحقق هل المستخدم متصل
    /// </summary>
    public static bool IsUserOnline(int userId)
    {
        return _onlineUsers.ContainsKey(userId) && _onlineUsers[userId].Count > 0;
    }

    /// <summary>
    /// الحصول على قائمة المستخدمين المتصلين
    /// </summary>
    public static List<int> GetOnlineUserIds()
    {
        return _onlineUsers.Where(x => x.Value.Count > 0).Select(x => x.Key).ToList();
    }
}
