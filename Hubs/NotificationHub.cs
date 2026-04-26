using Microsoft.AspNetCore.SignalR;

namespace HKServer.Hubs
{
    public class NotificationHub : Hub
    {
        public override async Task OnConnectedAsync()
        {
            var remoteIp = Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString();
            Console.WriteLine($"[RealTime] Client connected: {Context.ConnectionId} from IP: {remoteIp}");
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            Console.WriteLine($"[RealTime] Client disconnected: {Context.ConnectionId}");
            await base.OnDisconnectedAsync(exception);
        }

        public async Task SendUpdate(string module, string userName)
        {
            await Clients.All.SendAsync("UpdateData", module, userName);
        }

        public async Task SendNotificationToUser(string userId, string title, string message, string type = "task")
        {
            // Note: userId here is the system ID, we need to map it or use Groups
            // For simplicity in this demo, we'll use a Group named after the userId
            await Clients.Group(userId).SendAsync("ReceiveNotification", new { title, message, type, time = DateTime.Now.ToString("HH:mm") });
        }

        public async Task JoinGroup(string userId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, userId);
            Console.WriteLine($"[SignalR] User {userId} joined group {userId}");
        }
    }
}
