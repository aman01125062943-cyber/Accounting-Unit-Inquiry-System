using HKServer.Services;
using HKServer.Models;
using Dapper;
using System.Text.Encodings.Web;
using System.Text.Unicode;
using Microsoft.AspNetCore.Mvc;
using System.IO;
using Microsoft.AspNetCore.Http;
using System.Text.Json;

namespace HKServer.Endpoints;

public static class FullReturnsEndpoints
{
    public static void MapFullReturnsEndpoints(this WebApplication app)
    {
        app.MapGet("/full-returns", async (DatabaseService db, int? page, int? pageSize, string? search) => {
            using var conn = await db.GetOpenConnectionAsync();
            
            int p = Math.Max(1, page ?? 1);
            int s = Math.Max(10, Math.Min(100, pageSize ?? 50));
            int offset = (p - 1) * s;
            
            string sqlWhere = "WHERE 1=1";
            var parameters = new DynamicParameters();
            
            if (!string.IsNullOrWhiteSpace(search)) {
                // Fallback to RawData LIKE if FTS doesn't return results
                sqlWhere += " AND (RawData LIKE @SearchParam OR Id IN (SELECT rowid FROM FullReturns_FTS WHERE FullReturns_FTS MATCH @SearchFTS))";
                parameters.Add("SearchParam", $"%{search}%");
                parameters.Add("SearchFTS", search);
            }
            
            var totalCount = await conn.ExecuteScalarAsync<int>($"SELECT COUNT(*) FROM FullReturns {sqlWhere}", parameters);
            
            // Calculate Total Amount dynamically from RawData
            // Note: This might be slow for very large tables without an indexed column, but for SQLite and small-medium data it's okay.
            // In a real prod app, we'd have a column for Amount.
            var allRawData = await conn.QueryAsync<string>($"SELECT RawData FROM FullReturns {sqlWhere}", parameters);
            double totalAmount = 0;
            foreach (var raw in allRawData) {
                try {
                    using var doc = JsonDocument.Parse(raw);
                    if (doc.RootElement.TryGetProperty("Transaction Amount", out var prop)) {
                        totalAmount += prop.GetDouble();
                    } else if (doc.RootElement.TryGetProperty("قيمة المعاملة", out var prop2)) {
                        totalAmount += prop2.GetDouble();
                    }
                } catch {}
            }

            var sqlPaged = $@"
                SELECT Id, RawData 
                FROM FullReturns 
                {sqlWhere} 
                ORDER BY Id ASC 
                LIMIT @Limit OFFSET @Offset";
            
            var pagingParams = new DynamicParameters(parameters);
            pagingParams.Add("Limit", s);
            pagingParams.Add("Offset", offset);
            
            var pagedRows = await conn.QueryAsync<(int Id, string RawData)>(sqlPaged, pagingParams);
            
            var rowIds = pagedRows.Select(r => (long)r.Id).ToList();
            var attachmentCounts = new Dictionary<long, int>();
            if (rowIds.Any()) {
                var counts = await conn.QueryAsync<(long ReturnId, int Count)>(
                    "SELECT ReturnId, COUNT(DISTINCT Filename) as Count FROM FullReturnsImages WHERE ReturnId IN @Ids GROUP BY ReturnId", 
                    new { Ids = rowIds });
                attachmentCounts = counts.ToDictionary(c => c.ReturnId, c => c.Count);
            }

            var jsonOptions = new JsonSerializerOptions { Encoder = JavaScriptEncoder.Create(UnicodeRanges.All) };
            var data = pagedRows.Select(r => {
                var obj = JsonSerializer.Deserialize<Dictionary<string, object>>(r.RawData, jsonOptions);
                if (obj != null) {
                    obj["id"] = r.Id;
                    obj["ID"] = r.Id; 
                    obj["AttachmentCount"] = attachmentCounts.ContainsKey(r.Id) ? attachmentCounts[r.Id] : 0;
                }
                return obj;
            }).ToList();
            
            var totalPages = (int)Math.Ceiling((double)totalCount / s);
            
            return Results.Ok(new {
                data,
                stats = new {
                    totalCount,
                    totalAmount
                },
                pagination = new {
                    currentPage = p,
                    totalPages,
                    itemsPerPage = s,
                    total = totalCount,
                    hasNextPage = p < totalPages,
                    hasPreviousPage = p > 1
                }
            });
        });

        app.MapPost("/full-returns/settle", async (HttpContext context, DatabaseService db) => {
            try {
                var request = await context.Request.ReadFromJsonAsync<SettleRequest>();
                if (request == null || request.Ids == null || !request.Ids.Any()) return Results.BadRequest("No IDs provided");

                using var conn = await db.GetOpenConnectionAsync();
                using var trans = conn.BeginTransaction();

                try {
                    var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                    foreach (var id in request.Ids) {
                        var rawData = await conn.QueryFirstOrDefaultAsync<string>("SELECT RawData FROM FullReturns WHERE Id = @Id", new { Id = id }, trans);
                        if (!string.IsNullOrEmpty(rawData)) {
                            var obj = JsonSerializer.Deserialize<Dictionary<string, object>>(rawData);
                            if (obj != null) {
                                obj["تاريخ تسوية السداد"] = now;
                                obj["حالة المدفوعة"] = "تمت التسوية";
                                
                                var updatedRaw = JsonSerializer.Serialize(obj, new JsonSerializerOptions { 
                                    Encoder = JavaScriptEncoder.Create(UnicodeRanges.All) 
                                });
                                
                                await conn.ExecuteAsync("UPDATE FullReturns SET RawData = @RawData WHERE Id = @Id", new { RawData = updatedRaw, Id = id }, trans);
                            }
                        }
                    }

                    trans.Commit();
                    string user = context.Request.Query["user"].ToString();
                    if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                    await db.AddNotificationEventAsync("FullReturns", "تسوية", request.Ids.FirstOrDefault(), user);
                    return Results.Ok(new { success = true, count = request.Ids.Count });
                } catch (Exception) {
                    trans.Rollback();
                    throw;
                }
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        app.MapPost("/full-returns/import", async (HttpContext context, DatabaseService db) => {
            try {
                var importData = await context.Request.ReadFromJsonAsync<ImportData>();
                if (importData == null) return Results.BadRequest();
                
                using var conn = await db.GetOpenConnectionAsync();
                using var trans = conn.BeginTransaction();
                
                try {
                    const int batchSize = 2000;
                    for (int i = 0; i < importData.data.Count; i += batchSize)
                    {
                        var batch = importData.data.Skip(i).Take(batchSize).Select(d => {
                            var je = (JsonElement)d;
                            return new {
                                RawData = je.GetRawText(),
                                CreatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                            };
                        });

                        await conn.ExecuteAsync(
                            "INSERT INTO FullReturns (RawData, CreatedAt) VALUES (@RawData, @CreatedAt)",
                            batch, trans);
                    }

                    trans.Commit();
                    string user = context.Request.Query["user"].ToString();
                    if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                    await db.AddNotificationEventAsync("FullReturns", "استيراد", 0, user);
                    return Results.Ok(new { success = true, count = importData.data.Count });
                }
                catch (Exception) {
                    trans.Rollback();
                    throw;
                }
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        app.MapDelete("/full-returns", async (HttpContext context, DatabaseService db) => {
            try {
                using var conn = await db.GetOpenConnectionAsync();
                await conn.ExecuteAsync("DELETE FROM FullReturns");
                string user = context.Request.Query["user"] .ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await db.AddNotificationEventAsync("FullReturns", "حذف", 0, user);
                return Results.Ok(new { success = true });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        app.MapPost("/full-returns/open-folder/{id}", async (int id, HttpContext context, DatabaseService db) => {
            string folderName = "Unknown";
            try {
                if (context.Request.ContentLength > 0) {
                    var body = await context.Request.ReadFromJsonAsync<Dictionary<string, string>>();
                    if (body != null && body.ContainsKey("folderName") && !string.IsNullOrWhiteSpace(body["folderName"])) {
                        folderName = body["folderName"];
                    }
                }
            } catch {}

            using var conn = await db.GetOpenConnectionAsync();
            var rawDataJson = await conn.QueryFirstOrDefaultAsync<string>("SELECT RawData FROM FullReturns WHERE Id = @Id", new { Id = id });
            
            if (string.IsNullOrEmpty(folderName) && !string.IsNullOrEmpty(rawDataJson)) {
                folderName = DatabaseService.ExtractName(rawDataJson);
            }

            var invalidChars = Path.GetInvalidFileNameChars();
            var cleanName = new string(folderName.Where(ch => !invalidChars.Contains(ch)).ToArray()).Trim();
            if (string.IsNullOrEmpty(cleanName)) cleanName = "Unknown";
            
            var folderNameWithId = $"{id}_{cleanName}";
            var config = DatabaseService.LoadServerConfig();
            var targetFolder = Path.Combine(config.ArchivePath ?? "", "FullReturns", folderNameWithId);
            
            if (!Directory.Exists(targetFolder)) Directory.CreateDirectory(targetFolder);

            try {
                // استخدام المسار المطلق لضمان عمل explorer.exe بشكل صحيح
                string absolutePath = Path.GetFullPath(targetFolder);
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo {
                    FileName = "explorer.exe",
                    Arguments = $"\"{absolutePath}\"", 
                    UseShellExecute = true
                });
                return Results.Ok(new { success = true, path = absolutePath });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        app.MapGet("/full-returns/attachments/{id}", async (int id, DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var attachments = await conn.QueryAsync(
                "SELECT Id, Filename, CreatedAt FROM FullReturnsImages WHERE ReturnId = @Id ORDER BY CreatedAt DESC", 
                new { Id = id });
            return Results.Ok(attachments);
        });

        app.MapGet("/full-returns/history", async (DatabaseService db) => {
            // For now, return the same archive but we could filter by type if we added a Type column to Archives
            using var conn = await db.GetOpenConnectionAsync();
            var history = await conn.QueryAsync("SELECT Id, Date, Filename, RecordCount, Size FROM Archives WHERE Filename LIKE '%full%' OR Filename LIKE '%شامل%' ORDER BY Id DESC");
            return Results.Ok(history);
        });

        app.MapGet("/full-returns/attachment/{id}", async (int id, DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var record = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT Filename FROM FullReturnsImages WHERE Id = @Id", new { Id = id });
            if (record == null) return Results.NotFound();

            string finalPath;
            var config = DatabaseService.LoadServerConfig();
            finalPath = Path.Combine(config.ArchivePath ?? "", "FullReturns", (string)record.Filename);

            if (!File.Exists(finalPath)) return Results.NotFound(new { message = "File not found" });

            var provider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
            if (!provider.TryGetContentType(finalPath, out var contentType)) contentType = "application/octet-stream";

            return Results.File(finalPath, contentType, Path.GetFileName(finalPath));
        });
        
        app.MapPost("/full-returns/attachments/{id}", async (int id, IFormFile file, HttpContext context, DatabaseService db) => {
            if (file == null || file.Length == 0) return Results.BadRequest("No file uploaded");
            
            var config = DatabaseService.LoadServerConfig();
            var baseDir = Path.Combine(config.ArchivePath ?? "", "FullReturns");
            
            using var conn = await db.GetOpenConnectionAsync();
            var rawDataJson = await conn.QueryFirstOrDefaultAsync<string>("SELECT RawData FROM FullReturns WHERE Id = @Id", new { Id = id });
            if (string.IsNullOrEmpty(rawDataJson)) return Results.NotFound();

            string name = DatabaseService.ExtractName(rawDataJson);
            string cleanName = new string(name.Where(ch => !Path.GetInvalidFileNameChars().Contains(ch)).ToArray()).Trim();
            string folderNameWithId = $"{id}_{cleanName}";
            
            var targetFolder = Path.Combine(baseDir, folderNameWithId);
            if (!Directory.Exists(targetFolder)) Directory.CreateDirectory(targetFolder);

            var ext = Path.GetExtension(file.FileName);
            var newFilename = $"{DateTime.Now.Ticks}_{Path.GetFileNameWithoutExtension(file.FileName)}{ext}";
            var fullPath = Path.Combine(targetFolder, newFilename);
            var dbFilename = Path.Combine(folderNameWithId, newFilename);

            using (var stream = new FileStream(fullPath, FileMode.Create)) {
                await file.CopyToAsync(stream);
            }

            await conn.ExecuteAsync(
                "INSERT INTO FullReturnsImages (ReturnId, Filename, CreatedAt) VALUES (@ReturnId, @Filename, @CreatedAt)",
                new { ReturnId = id, Filename = dbFilename, CreatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") });

            string user = context.Request.Query["user"].ToString();
            if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
            await db.AddNotificationEventAsync("FullReturns", "رفع مرفق", (long)id, user);

            return Results.Ok(new { success = true });
        }).DisableAntiforgery();

        app.MapDelete("/full-returns/attachment/{id}", async (int id, HttpContext context, DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var record = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT Filename FROM FullReturnsImages WHERE Id = @Id", new { Id = id });
            if (record != null) {
                var config = DatabaseService.LoadServerConfig();
                var path = Path.Combine(config.ArchivePath ?? "", "FullReturns", (string)record.Filename);
                try { if (File.Exists(path)) File.Delete(path); } catch {}
                await conn.ExecuteAsync("DELETE FROM FullReturnsImages WHERE Id = @Id", new { Id = id });
            }
            string user = context.Request.Query["user"].ToString();
            if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
            await db.AddNotificationEventAsync("FullReturns", "حذف مرفق", (long)id, user);

            return Results.Ok(new { success = true });
        });
    }

    public record ImportData(string filename, string size, List<string> headers, List<object> data);
    public record SettleRequest(List<int> Ids);
}
