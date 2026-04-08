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
    }
}
