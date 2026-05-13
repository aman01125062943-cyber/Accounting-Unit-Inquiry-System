using HKServer.Services;
using HKServer.Models;
using Dapper;
using Microsoft.Extensions.Caching.Memory;

namespace HKServer.Endpoints;

public static class AuthEndpoints
{
    private static int GetActorUserId(HttpContext context)
    {
        if (int.TryParse(context.Request.Headers["X-User-Id"], out var headerId)) return headerId;
        if (int.TryParse(context.Request.Query["userId"], out var queryId)) return queryId;
        return 0;
    }

    private static string HashPassword(string password)
    {
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var bytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
        return Convert.ToHexString(bytes).ToLower();
    }

    public static void MapAuthEndpoints(this WebApplication app)
    {
        app.MapPost("/login", async (HttpContext context, DatabaseService db) => {
            var login = await context.Request.ReadFromJsonAsync<LoginRequest>();
            if (login == null || string.IsNullOrEmpty(login.username)) return Results.BadRequest();

            // Hash the input password to compare with stored hash
            var passwordHash = HashPassword(login.password);

            using var conn = db.GetConnection();
            var user = await conn.QueryFirstOrDefaultAsync<User>(
                "SELECT * FROM Users WHERE Username = @U AND Password = @P", 
                new { U = login.username, P = passwordHash });

            // Backward compatibility: Try plain text if hash fails (for legacy users)
            if (user == null) {
                user = await conn.QueryFirstOrDefaultAsync<User>(
                    "SELECT * FROM Users WHERE Username = @U AND Password = @P", 
                    new { U = login.username, P = login.password });
                
                // If found with plain text, upgrade to hash automatically
                if (user != null) {
                   await conn.ExecuteAsync("UPDATE Users SET Password = @P WHERE Id = @Id", new { P = passwordHash, Id = user.id });
                }
            }

            if (user != null) {
                if (!user.active) return Results.Json(new { success = false, message = "الحساب معطل" }, statusCode: 403);
                var permissions = await db.GetUserPermissionsAsync(user.id);
                return Results.Ok(new { success = true, user = new { user.id, user.username, user.fullname, user.role, permissions } });
            }
            return Results.Json(new { success = false, message = "بيانات الدخول غير صحيحة" }, statusCode: 401);
        });

        app.MapGet("/users", async (DatabaseService db) => {
            using var conn = db.GetConnection();
            var users = await conn.QueryAsync<User>("SELECT Id, Username, Fullname, Role, Active FROM Users");
            return Results.Ok(users);
        });

        app.MapGet("/permissions/keys", () => Results.Ok(DatabaseService.DefaultPermissionKeys()));

        app.MapGet("/permissions/{userId:int}", async (int userId, DatabaseService db, IMemoryCache cache) => {
            var key = $"perms:{userId}";
            if (!cache.TryGetValue(key, out List<string>? permissions))
            {
                permissions = await db.GetUserPermissionsAsync(userId);
                cache.Set(key, permissions, TimeSpan.FromMinutes(5));
            }
            return Results.Ok(new { userId, permissions });
        });

        app.MapPost("/permissions/save", async (HttpContext context, DatabaseService db, IMemoryCache cache) => {
            var req = await context.Request.ReadFromJsonAsync<SaveUserPermissionsRequest>();
            if (req == null || req.UserId <= 0) return Results.BadRequest(new { success = false, message = "Invalid permissions request" });

            var actorId = req.AdminUserId > 0 ? req.AdminUserId : GetActorUserId(context);
            if (!await db.UserHasPermissionAsync(actorId, "page.settings"))
                return Results.Json(new { success = false, message = "غير مصرح بتعديل الصلاحيات" }, statusCode: 403);

            await db.SaveUserPermissionsAsync(req.UserId, req.Permissions);
            cache.Remove($"perms:{req.UserId}");
            return Results.Ok(new { success = true });
        });

        app.MapPost("/users", async (HttpContext context, DatabaseService db) => {
           try {
                var user = await context.Request.ReadFromJsonAsync<User>();
                if (user == null) return Results.BadRequest(new { success = false, message = "Invalid user data" });

                // Hash password if provided
                var hashedPassword = !string.IsNullOrEmpty(user.password) ? HashPassword(user.password) : "";

                using var conn = db.GetConnection();
                if (user.id > 0) {
                    // Update - استخدام anonymous object لضمان ربط المعاملات بشكل صحيح
                    await conn.ExecuteAsync(@"
                        UPDATE Users SET 
                            Username = COALESCE(@Username, Username),
                            Fullname = COALESCE(@Fullname, Fullname), 
                            Role = COALESCE(@Role, Role),
                            Password = CASE WHEN @Password IS NULL OR @Password = '' THEN Password ELSE @Password END,
                            Active = @Active
                        WHERE Id = @Id", new {
                            Username = user.username,
                            Fullname = user.fullname,
                            Role = user.role,
                            Password = hashedPassword,
                            Active = user.active,
                            Id = user.id
                        });
                } else {
                    // Insert
                    if (string.IsNullOrEmpty(hashedPassword)) hashedPassword = HashPassword("1994");
                    await conn.ExecuteAsync(@"
                        INSERT INTO Users (Username, Password, Fullname, Role, Active, CreatedAt)
                        VALUES (@Username, @Password, @Fullname, @Role, @Active, @CreatedAt)", new {
                            Username = user.username,
                            Password = hashedPassword,
                            Fullname = user.fullname,
                            Role = user.role,
                            Active = user.active,
                            CreatedAt = DateTime.Now
                        });
                }
                return Results.Ok(new { success = true });
           } catch (Exception ex) {
               Console.WriteLine($"[USERS] Error saving user: {ex.Message}");
               return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
           }
        });
        
        app.MapDelete("/users/{id}", async (int id, DatabaseService db) => {
             using var conn = db.GetConnection();
             var user = await conn.QueryFirstOrDefaultAsync<User>("SELECT * FROM Users WHERE Id = @Id", new { Id = id });
             if (user != null && user.username != "admin") {
                 await conn.ExecuteAsync("DELETE FROM Users WHERE Id = @Id", new { Id = id });
                 return Results.Ok(new { success = true });
             }
             return Results.BadRequest();
        });
    }
}

