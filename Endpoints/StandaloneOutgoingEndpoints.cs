using Dapper;
using HKServer.Models;
using HKServer.Services;

namespace HKServer.Endpoints
{
    public static class StandaloneOutgoingEndpoints
    {
        public static void MapStandaloneOutgoingEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/standalone-outgoing");

            group.MapGet("/", async (DatabaseService db, string? search, string? actionStatus, string? serviceType, string? destination) =>
            {
                using var conn = await db.GetOpenConnectionAsync();
                var sql = "SELECT * FROM StandaloneOutgoings WHERE 1=1";
                var p = new DynamicParameters();

                if (!string.IsNullOrWhiteSpace(search))
                {
                    sql += " AND (OutgoingNumber LIKE @s OR Subject LIKE @s OR Destination LIKE @s OR CabinetLocation LIKE @s OR FolderLocation LIKE @s)";
                    p.Add("s", $"%{search}%");
                }
                if (!string.IsNullOrWhiteSpace(actionStatus) && actionStatus != "all")
                {
                    sql += " AND ActionStatus = @actionStatus";
                    p.Add("actionStatus", actionStatus);
                }
                if (!string.IsNullOrWhiteSpace(serviceType) && serviceType != "all")
                {
                    sql += " AND ServiceType = @serviceType";
                    p.Add("serviceType", serviceType);
                }
                if (!string.IsNullOrWhiteSpace(destination) && destination != "all")
                {
                    sql += " AND Destination = @destination";
                    p.Add("destination", destination);
                }

                sql += " ORDER BY Id DESC";
                var list = await conn.QueryAsync<StandaloneOutgoing>(sql, p);
                return Results.Ok(new { success = true, data = list });
            });

            group.MapPost("/", async (DatabaseService db, StandaloneOutgoing item) =>
            {
                using var conn = await db.GetOpenConnectionAsync();
                item.CreatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                item.UpdatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                if (string.IsNullOrWhiteSpace(item.ArchiveStatus)) item.ArchiveStatus = "أرشفة مكتملة";

                var sql = @"INSERT INTO StandaloneOutgoings 
                    (OutgoingNumber, OutgoingDate, ServiceType, Destination, Subject, ActionStatus, AttachmentsCount, SalonLocation, CabinetLocation, ShelfLocation, FolderLocation, SerialLocation, ArchiveStatus, CreatedAt, UpdatedAt)
                    VALUES 
                    (@OutgoingNumber, @OutgoingDate, @ServiceType, @Destination, @Subject, @ActionStatus, @AttachmentsCount, @SalonLocation, @CabinetLocation, @ShelfLocation, @FolderLocation, @SerialLocation, @ArchiveStatus, @CreatedAt, @UpdatedAt);
                    SELECT last_insert_rowid();";

                var id = await conn.ExecuteScalarAsync<int>(sql, item);
                item.Id = id;
                return Results.Ok(new { success = true, data = item });
            });

            group.MapPut("/{id:int}", async (int id, DatabaseService db, StandaloneOutgoing item) =>
            {
                using var conn = await db.GetOpenConnectionAsync();
                item.Id = id;
                item.UpdatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

                var sql = @"UPDATE StandaloneOutgoings SET
                    OutgoingNumber = @OutgoingNumber,
                    OutgoingDate = @OutgoingDate,
                    ServiceType = @ServiceType,
                    Destination = @Destination,
                    Subject = @Subject,
                    ActionStatus = @ActionStatus,
                    AttachmentsCount = @AttachmentsCount,
                    SalonLocation = @SalonLocation,
                    CabinetLocation = @CabinetLocation,
                    ShelfLocation = @ShelfLocation,
                    FolderLocation = @FolderLocation,
                    SerialLocation = @SerialLocation,
                    ArchiveStatus = @ArchiveStatus,
                    UpdatedAt = @UpdatedAt
                    WHERE Id = @Id";

                await conn.ExecuteAsync(sql, item);
                return Results.Ok(new { success = true, data = item });
            });

            group.MapPost("/archive-location/{id:int}", async (int id, DatabaseService db, ArchiveLocationRequest req) =>
            {
                using var conn = await db.GetOpenConnectionAsync();
                var sql = @"UPDATE StandaloneOutgoings SET
                    SalonLocation = @SalonLocation,
                    CabinetLocation = @CabinetLocation,
                    ShelfLocation = @ShelfLocation,
                    FolderLocation = @FolderLocation,
                    SerialLocation = @SerialLocation,
                    ArchiveStatus = @ArchiveStatus,
                    UpdatedAt = datetime('now')
                    WHERE Id = @Id";

                await conn.ExecuteAsync(sql, new
                {
                    Id = id,
                    req.SalonLocation,
                    req.CabinetLocation,
                    req.ShelfLocation,
                    req.FolderLocation,
                    req.SerialLocation,
                    ArchiveStatus = req.ArchiveStatus ?? "أرشفة مكتملة"
                });

                return Results.Ok(new { success = true });
            });

            group.MapDelete("/{id:int}", async (int id, DatabaseService db) =>
            {
                using var conn = await db.GetOpenConnectionAsync();
                await conn.ExecuteAsync("DELETE FROM StandaloneOutgoings WHERE Id = @Id", new { Id = id });
                return Results.Ok(new { success = true });
            });
        }
    }

    public class ArchiveLocationRequest
    {
        public string SalonLocation { get; set; } = "";
        public string CabinetLocation { get; set; } = "";
        public string ShelfLocation { get; set; } = "";
        public string FolderLocation { get; set; } = "";
        public string SerialLocation { get; set; } = "";
        public string? ArchiveStatus { get; set; }
    }
}
