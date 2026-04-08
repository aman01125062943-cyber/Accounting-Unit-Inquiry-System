namespace HKServer.Models;

public class User {
    public int id { get; set; }
    public string username { get; set; } = "";
    public string password { get; set; } = "";
    public string fullname { get; set; } = "";
    public string role { get; set; } = "";
    public bool active { get; set; }
    public DateTime createdAt { get; set; }
}

public class LoginRequest {
    public string username { get; set; } = "";
    public string password { get; set; } = "";
}
