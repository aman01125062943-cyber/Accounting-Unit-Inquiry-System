using HKServer.Services;
using HKServer.Hubs;
using Microsoft.AspNetCore.SignalR;
using Dapper;
using System.Text.Encodings.Web;
using System.Text.Unicode;
using System.Text.Json;

namespace HKServer.Endpoints;

public static class SalaryReturnsEndpoints
{
    public static void MapSalaryReturnsEndpoints(this WebApplication app)
    {
        // ==========================================
        // Upload Date Filter Options
        // ==========================================
        app.MapGet("/salary-returns/upload-dates", async (DatabaseService db) => {
            try {
                using var conn = await db.GetOpenConnectionAsync();
                var dates = await conn.QueryAsync<string>(
                    "SELECT DISTINCT UploadDate FROM SalaryReturns WHERE UploadDate IS NOT NULL AND UploadDate != '' ORDER BY UploadDate DESC");
                return Results.Ok(dates.ToList());
            } catch (Exception ex) {
                Console.WriteLine($"[ERROR] Fetching salary upload dates: {ex.Message}");
                return Results.Ok(new List<string>()); 
            }
        });


        // Lightweight endpoint: Get distinct return statuses for filter dropdown
        app.MapGet("/salary-returns/statuses", async (DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var statuses = await conn.QueryAsync<string>(
                @"SELECT DISTINCT COALESCE(
                    json_extract(RawData, '$.""الحالة""'),
                    json_extract(RawData, '$.""حالة الارتداد""'),
                    json_extract(RawData, '$.status'),
                    json_extract(RawData, '$.ReturnStatus')
                  ) as Status 
                  FROM SalaryReturns 
                  WHERE IsDeleted = 0 
                  AND Status IS NOT NULL 
                  AND TRIM(Status) != ''");
            return Results.Ok(statuses.Where(s => !string.IsNullOrWhiteSpace(s)).Distinct().ToList());
        });

        // ==========================================
        // GET /salary-returns — Paged data with search/filter
        // ==========================================
        app.MapGet("/salary-returns", async (DatabaseService db, int? page, int? pageSize, string? search, string? attachmentStatus, string? uploadDateFrom, string? uploadDateTo) => {
             using var conn = await db.GetOpenConnectionAsync();
             
             try {
                 await conn.ExecuteScalarAsync("SELECT UploadDate FROM SalaryReturns LIMIT 1");
             } catch {
                 uploadDateFrom = null;
                 uploadDateTo = null;
             }
             
             var jsonOptions = new JsonSerializerOptions { 
                Encoder = JavaScriptEncoder.Create(UnicodeRanges.All)
             };
             
             int p = Math.Max(1, page ?? 1);
             int s = Math.Max(10, Math.Min(100, pageSize ?? 50));
             int offset = (p - 1) * s;
             
             string sqlWhere = "WHERE 1=1";
             var parameters = new DynamicParameters();
             
             // --- Active Archive Filter ---
             var config = DatabaseService.LoadServerConfig();
             if (config.ActiveSalaryImportId > 0) {
                 sqlWhere += " AND ImportId = @ActiveImportId";
                 parameters.Add("ActiveImportId", config.ActiveSalaryImportId);
             }
             sqlWhere += " AND IsDeleted = 0";

             try {
                  if (!string.IsNullOrWhiteSpace(search)) {
                      var words = search.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                      for (int i = 0; i < words.Length; i++) {
                          string spLike = $"SL{i}";
                          string spMatch = $"SM{i}";
                          sqlWhere += $@" AND (
                              ReturnCode LIKE @{spLike} 
                              OR RawData LIKE @{spLike} 
                              OR Id IN (SELECT rowid FROM SalaryReturns_FTS WHERE SalaryReturns_FTS MATCH @{spMatch})
                          )";
                          parameters.Add(spLike, $"%{words[i]}%");
                          parameters.Add(spMatch, words[i] + "*");
                      }
                  }

                  if (!string.IsNullOrEmpty(uploadDateFrom)) {
                       sqlWhere += " AND UploadDate >= @UploadDateFrom";
                       parameters.Add("UploadDateFrom", uploadDateFrom);
                  }
                  if (!string.IsNullOrEmpty(uploadDateTo)) {
                       if (uploadDateTo.Length == 10) uploadDateTo += " 23:59:59";
                       sqlWhere += " AND UploadDate <= @UploadDateTo";
                       parameters.Add("UploadDateTo", uploadDateTo);
                  }
             } catch (Exception ex) {
                  Console.WriteLine($"[SALARY FILTER ERROR] {ex.Message}");
             }

             if (!string.IsNullOrWhiteSpace(attachmentStatus) && attachmentStatus != "all") {
                  if (attachmentStatus == "yes") {
                      sqlWhere += " AND EXISTS (SELECT 1 FROM SalaryReturnsImages WHERE ReturnId = SalaryReturns.Id)";
                  } else if (attachmentStatus == "no") {
                      sqlWhere += " AND NOT EXISTS (SELECT 1 FROM SalaryReturnsImages WHERE ReturnId = SalaryReturns.Id)";
                  }
             }

             var statsSql = $@"
                WITH AmountData AS (
                    SELECT 
                        Id,
                        RawData,
                        COALESCE(
                            CAST(json_extract(RawData, '$.""المبلغ""') AS REAL),
                            CAST(json_extract(RawData, '$.""مبلغ""') AS REAL),
                            CAST(json_extract(RawData, '$.""قيمة العملية""') AS REAL),
                            CAST(json_extract(RawData, '$.""صافي المبلغ""') AS REAL),
                            CAST(json_extract(RawData, '$.""الإجمالي""') AS REAL),
                            CAST(json_extract(RawData, '$.Amount') AS REAL),
                            0
                        ) as RowAmount,
                        COALESCE(
                            json_extract(RawData, '$.""تاريخ اعتماد التعديل""'),
                            json_extract(RawData, '$.""تاريخ التسوية""'),
                            json_extract(RawData, '$.""تاريخ التنفيذ""'),
                            json_extract(RawData, '$.ModificationDate'),
                            json_extract(RawData, '$.SettlementDate')
                        ) as ModDate
                    FROM SalaryReturns
                    {sqlWhere}
                )
                SELECT 
                    COUNT(*) as FilteredCount,
                    SUM(RowAmount) as TotalAmount,
                    SUM(CASE WHEN ModDate IS NOT NULL AND ModDate != '' THEN 1 ELSE 0 END) as SuccessCount,
                    SUM(CASE WHEN ModDate IS NULL OR ModDate = '' THEN 1 ELSE 0 END) as PendingCount,
                    SUM(CASE WHEN ModDate IS NOT NULL AND ModDate != '' THEN RowAmount ELSE 0 END) as SettledAmount,
                    SUM(CASE WHEN ModDate IS NULL OR ModDate = '' THEN RowAmount ELSE 0 END) as PendingAmount
                FROM AmountData";
             
             var stats = await conn.QueryFirstOrDefaultAsync<dynamic>(statsSql, parameters);
             double totalAmount = stats?.TotalAmount ?? 0;
             double settledAmount = stats?.SettledAmount ?? 0;
             double pendingAmount = stats?.PendingAmount ?? 0;
             int successCount = (int)(stats?.SuccessCount ?? 0);
             int pendingCount = (int)(stats?.PendingCount ?? 0);
             int filteredCount = (int)(stats?.FilteredCount ?? 0);
             
             var systemTotalCount = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM SalaryReturns");

             bool hasUploadDateInDb = true;
             try { await conn.ExecuteScalarAsync("SELECT UploadDate FROM SalaryReturns LIMIT 1"); }
             catch { hasUploadDateInDb = false; }

             string selectFields = hasUploadDateInDb 
                 ? "Id, RawData, ReturnCode, UploadDate" 
                 : "Id, RawData, ReturnCode, NULL as UploadDate";

             var sqlPaged = $@"
                SELECT {selectFields}
                FROM SalaryReturns 
                {sqlWhere} 
                ORDER BY Id ASC 
                LIMIT @Limit OFFSET @Offset";
             
             var pagingParams = new DynamicParameters(parameters);
             pagingParams.Add("Limit", s);
             pagingParams.Add("Offset", offset);
             
             var pagedRows = await conn.QueryAsync<(int Id, string RawData, string ReturnCode, string UploadDate)>(sqlPaged, pagingParams);
             
             var ids = pagedRows.Select(r => (long)r.Id).ToList();
             var attachmentCounts = new Dictionary<long, int>();
             
             if (ids.Any()) {
                 var counts = await conn.QueryAsync<(long ReturnId, int Count)>(
                     "SELECT ReturnId, COUNT(DISTINCT Filename) as Count FROM SalaryReturnsImages WHERE ReturnId IN @Ids GROUP BY ReturnId", 
                     new { Ids = ids });
                 attachmentCounts = counts.ToDictionary(c => c.ReturnId, c => c.Count);
             }

             var data = pagedRows.Select(r => {
                Dictionary<string, object>? obj = null;
                try {
                    if (!string.IsNullOrWhiteSpace(r.RawData)) {
                        obj = JsonSerializer.Deserialize<Dictionary<string, object>>(r.RawData, jsonOptions);
                    }
                } catch (Exception ex) {
                    Console.WriteLine($"[ERROR] Deserializing Salary ID {r.Id}: {ex.Message}");
                }

                if (obj != null) {
                    obj["id"] = r.Id;
                    if (r.UploadDate != null) {
                        obj["تاريخ الرفع"] = r.UploadDate;
                    }
                    obj["AttachmentCount"] = attachmentCounts.ContainsKey(r.Id) ? attachmentCounts[r.Id] : 0;
                }
                return obj;
             }).Where(obj => obj != null).ToList();

             
             var totalPages = (int)Math.Ceiling((double)filteredCount / s);
             
             return Results.Ok(new {
                data,
                pagination = new {
                    currentPage = p,
                    totalPages,
                    itemsPerPage = s,
                    total = filteredCount,
                    hasNextPage = p < totalPages,
                    hasPreviousPage = p > 1
                },
                stats = new {
                    systemTotalCount,
                    filteredCount,
                    totalAmount,
                    settledAmount,
                    pendingAmount,
                    successCount,
                    pendingCount
                }
             });
        });
        
        // ==========================================
        // GET /salary-returns/all — All data (for cache)
        // ==========================================
        app.MapGet("/salary-returns/all", async (DatabaseService db, string? search) => {
             using var conn = await db.GetOpenConnectionAsync();
             
             bool hasUploadDate = true;
             try { await conn.ExecuteScalarAsync("SELECT UploadDate FROM SalaryReturns LIMIT 1"); }
             catch { hasUploadDate = false; }

             string sqlWhere = "WHERE 1=1";
             var parameters = new DynamicParameters();
             
             try {
                 if (!string.IsNullOrWhiteSpace(search)) {
                     sqlWhere += " AND Id IN (SELECT rowid FROM SalaryReturns_FTS WHERE SalaryReturns_FTS MATCH @Search)";
                     parameters.Add("Search", search);
                 }
                 
                 var config = DatabaseService.LoadServerConfig();
                 if (config.ActiveSalaryImportId > 0) {
                     sqlWhere += " AND ImportId = @ActiveImportId";
                     parameters.Add("ActiveImportId", config.ActiveSalaryImportId);
                 }
                 sqlWhere += " AND IsDeleted = 0";
             } catch (Exception ex) {
                 Console.WriteLine($"[SALARY FILTER ALL ERROR] {ex.Message}");
             }

             string uploadDateSelect = hasUploadDate ? "COALESCE(UploadDate, '')" : "''";
             var allRawRows = await conn.QueryAsync<string>(
                 $@"SELECT json_insert(RawData, 
                        '$.id', Id, 
                        '$.تاريخ الرفع', {uploadDateSelect}, 
                        '$.AttachmentCount', COALESCE((SELECT COUNT(DISTINCT Filename) FROM SalaryReturnsImages WHERE ReturnId = SalaryReturns.Id), 0)
                    )
                    FROM SalaryReturns {sqlWhere}", parameters);
             
             var finalJson = "[" + string.Join(",", allRawRows) + "]";
             return Results.Text(finalJson, "application/json");
        });

        // ==========================================
        // POST /salary-returns/import — Import data
        // ==========================================
        app.MapPost("/salary-returns/import", async (HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
             try {
                 var importData = await context.Request.ReadFromJsonAsync<ImportData>();
                 if (importData == null) return Results.BadRequest();
                 
                 using var conn = await db.GetOpenConnectionAsync();
                 using var trans = conn.BeginTransaction();
                 
                 try {
                    var archiveId = await conn.QuerySingleAsync<int>(@"
                        INSERT INTO SalaryArchives (Date, Filename, RecordCount, Size, Headers)
                        VALUES (@Date, @Filename, @RecordCount, @Size, @Headers)
                        RETURNING Id;",
                        new
                        {
                            Date = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                            Filename = importData.filename,
                            RecordCount = importData.data.Count,
                            Size = importData.size,
                            Headers = JsonSerializer.Serialize(importData.headers)
                        }, trans);

                    const int batchSize = 2000;
                    var jsonOptions = new JsonSerializerOptions
                    {
                        Encoder = JavaScriptEncoder.Create(UnicodeRanges.All)
                    };

                    for (int i = 0; i < importData.data.Count; i += batchSize)
                    {
                        var batch = importData.data.Skip(i).Take(batchSize).Select(d => {
                            var je = (JsonElement)d;
                            string raw = je.GetRawText();
                            string fCode = DatabaseService.ExtractFileCodeDirect(raw);
                            
                            string currentDate = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

                            string modifiedRaw = raw;
                            try {
                                var dict = JsonSerializer.Deserialize<Dictionary<string, object>>(raw, jsonOptions) ?? new Dictionary<string, object>();
                                dict["تاريخ الرفع"] = currentDate;
                                modifiedRaw = JsonSerializer.Serialize(dict, jsonOptions);
                            } catch {
                                modifiedRaw = raw;
                            }

                            return new
                            {
                                ImportId = archiveId,
                                RawData = modifiedRaw,
                                ReturnCode = DatabaseService.ExtractReturnCode(fCode),
                                UploadDate = currentDate
                            };
                        });

                        await conn.ExecuteAsync(@"
                            INSERT INTO SalaryReturns (ImportId, RawData, ReturnCode, UploadDate) VALUES (@ImportId, @RawData, @ReturnCode, @UploadDate)",
                            batch, trans);
                    }

                    trans.Commit();
                    string user = context.Request.Query["user"].ToString();
                    if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                    await hub.Clients.All.SendAsync("UpdateData", "SalaryReturns", user);
                    return Results.Ok(new { success = true, count = importData.data.Count });
                }
                catch (Exception)
                {
                    trans.Rollback();
                    throw;
                }
             } catch (Exception ex) {
                 return Results.Json(new { success = false, message = ex.Message });
             }
        });

        // ==========================================
        // DELETE /salary-returns — Delete all
        // ==========================================
        app.MapDelete("/salary-returns", async (HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            try {
                using var conn = await db.GetOpenConnectionAsync();
                var config = DatabaseService.LoadServerConfig();
                
                if (config.ActiveSalaryImportId > 0) {
                    await conn.ExecuteAsync("UPDATE SalaryReturns SET IsDeleted = 1 WHERE ImportId = @ImportId AND IsDeleted = 0", new { ImportId = config.ActiveSalaryImportId });
                } else {
                    await conn.ExecuteAsync("UPDATE SalaryReturns SET IsDeleted = 1 WHERE IsDeleted = 0");
                }
                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await hub.Clients.All.SendAsync("UpdateData", "SalaryReturns", user);
                return Results.Ok(new { success = true });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        // ==========================================
        // DELETE /salary-returns/{id} — Delete one record
        // ==========================================
        app.MapDelete("/salary-returns/{id}", async (int id, HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            try {
                using var conn = await db.GetOpenConnectionAsync();
                var config = DatabaseService.LoadServerConfig();
                
                if (config.ActiveSalaryImportId > 0) {
                    await conn.ExecuteAsync("UPDATE SalaryReturns SET IsDeleted = 1 WHERE Id = @Id AND ImportId = @ActiveId", new { Id = id, ActiveId = config.ActiveSalaryImportId });
                } else {
                    await conn.ExecuteAsync("UPDATE SalaryReturns SET IsDeleted = 1 WHERE Id = @Id", new { Id = id });
                }
                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await hub.Clients.All.SendAsync("UpdateData", "SalaryReturns", user);
                return Results.Ok(new { success = true });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        // ==========================================
        // PUT /salary-returns/{id} — Update record
        // ==========================================


        // ==========================================
        // POST /salary-returns/settle — Bulk Settle
        // ==========================================
        app.MapPost("/salary-returns/settle", async (HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            try {
                var request = await context.Request.ReadFromJsonAsync<SettleRequest>();
                if (request == null || request.Ids == null || !request.Ids.Any()) return Results.BadRequest("No IDs provided");

                using var conn = await db.GetOpenConnectionAsync();
                using var trans = conn.BeginTransaction();

                try {
                    var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                    foreach (var id in request.Ids) {
                        var rawData = await conn.QueryFirstOrDefaultAsync<string>("SELECT RawData FROM SalaryReturns WHERE Id = @Id", new { Id = id }, trans);
                        if (!string.IsNullOrEmpty(rawData)) {
                            var obj = JsonSerializer.Deserialize<Dictionary<string, object>>(rawData);
                            if (obj != null) {
                                obj["تاريخ اعتماد التعديل"] = now;
                                obj["تاريخ التسوية"] = now;
                                obj["حالة التسوية"] = "تمت التسوية";
                                
                                var updatedRaw = JsonSerializer.Serialize(obj, new JsonSerializerOptions { 
                                    Encoder = Microsoft.Extensions.WebEncoders.Testing.HtmlTestEncoder.Default == null ? JsonSerializerOptions.Default.Encoder : System.Text.Encodings.Web.JavaScriptEncoder.Create(System.Text.Unicode.UnicodeRanges.All)
                                });
                                
                                await conn.ExecuteAsync("UPDATE SalaryReturns SET RawData = @RawData WHERE Id = @Id", new { RawData = updatedRaw, Id = id }, trans);
                            }
                        }
                    }
                    trans.Commit();
                    string user = context.Request.Query["user"].ToString();
                    if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                    await hub.Clients.All.SendAsync("UpdateData", "SalaryReturns", user);
                    return Results.Ok(new { success = true, count = request.Ids.Count });
                } catch (Exception) {
                    trans.Rollback();
                    throw;
                }
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        // ==========================================
        // Attachment Management for Salary Returns
        // ==========================================
        app.MapGet("/salary-returns/attachments/{returnId}", async (int returnId, DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            
            // جلب مرفقات السجل المحدد فقط بدون بحث عبر الأسماء
            var attachments = await conn.QueryAsync(
                "SELECT Id, Filename, CreatedAt, 'salary' as Source FROM SalaryReturnsImages WHERE ReturnId = @ReturnId ORDER BY CreatedAt DESC",
                new { ReturnId = returnId });

            return Results.Ok(attachments.ToList());
        });

        app.MapPost("/salary-returns/attachments/{returnId}", async (int returnId, IFormFile file, HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            if (file == null || file.Length == 0) return Results.BadRequest("No file uploaded");

            var config = DatabaseService.LoadServerConfig();
            if (!Directory.Exists(config.ArchivePath)) Directory.CreateDirectory(config.ArchivePath);

            using var conn = await db.GetOpenConnectionAsync();
            var rawDataJson = await conn.QueryFirstOrDefaultAsync<string>("SELECT RawData FROM SalaryReturns WHERE Id = @Id", new { Id = returnId });
            if (string.IsNullOrEmpty(rawDataJson)) return Results.NotFound();

            string originalName = DatabaseService.ExtractName(rawDataJson);
            string nid = DatabaseService.ExtractNID(rawDataJson);
            string cleanName = new string(originalName.Where(ch => !Path.GetInvalidFileNameChars().Contains(ch)).ToArray()).Trim();

            string folderPrefix = !string.IsNullOrEmpty(nid) ? nid : returnId.ToString();
            var folderNameWithId = $"salary_{folderPrefix}_{cleanName}";
            var targetFolder = Path.Combine(config.ArchivePath, folderNameWithId);
            if (!Directory.Exists(targetFolder)) Directory.CreateDirectory(targetFolder);

            var ext = Path.GetExtension(file.FileName);
            var safeName = Path.GetFileNameWithoutExtension(file.FileName).Replace(" ", "_");
            if (safeName.Length > 50) safeName = safeName.Substring(0, 50);
            var newFilename = $"{DateTime.Now.Ticks}_{safeName}{ext}";
            var fullPath = Path.Combine(targetFolder, newFilename);
            var dbFilename = Path.Combine(folderNameWithId, newFilename);

            try {
                using (var stream = new FileStream(fullPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                await conn.ExecuteAsync(
                     "INSERT INTO SalaryReturnsImages (ReturnId, Filename, CreatedAt) VALUES (@ReturnId, @Filename, @CreatedAt)",
                     new { ReturnId = returnId, Filename = dbFilename, CreatedAt = DateTime.Now });

                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await hub.Clients.All.SendAsync("UpdateData", "SalaryReturns", user);

                return Results.Ok(new { success = true });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        }).DisableAntiforgery();

        app.MapGet("/salary-returns/attachment/{id}", async (int id, DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var record = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT Filename FROM SalaryReturnsImages WHERE Id = @Id", new { Id = id });
            
            if (record == null) {
                // Try ReturnsImages
                record = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT Filename FROM ReturnsImages WHERE Id = @Id", new { Id = id });
            }

            if (record == null) return Results.NotFound();

            string storedPath = (string)record.Filename;
            var config = DatabaseService.LoadServerConfig();
            string finalPath = Path.IsPathRooted(storedPath) ? storedPath : Path.Combine(config.ArchivePath, storedPath);

            if (!File.Exists(finalPath)) return Results.NotFound();

            var provider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
            if (!provider.TryGetContentType(finalPath, out var contentType)) contentType = "application/octet-stream";

            return Results.File(finalPath, contentType, Path.GetFileName(finalPath));
        });

        app.MapDelete("/salary-returns/attachment/{id}", async (int id, HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            using var conn = await db.GetOpenConnectionAsync();
            var config = DatabaseService.LoadServerConfig();
            
            string user = context.Request.Query["user"].ToString();
            if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";

            // Try SalaryReturnsImages
            var record = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT Filename FROM SalaryReturnsImages WHERE Id = @Id", new { Id = id });
            if (record != null) {
                var path = Path.Combine(config.ArchivePath, (string)record.Filename);
                try { if (File.Exists(path)) File.Delete(path); } catch {}
                await conn.ExecuteAsync("DELETE FROM SalaryReturnsImages WHERE Id = @Id", new { Id = id });
                await hub.Clients.All.SendAsync("UpdateData", "SalaryReturns", user);
                return Results.Ok(new { success = true });
            }

            // Try ReturnsImages
            record = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT Filename FROM ReturnsImages WHERE Id = @Id", new { Id = id });
            if (record != null) {
                var path = Path.Combine(config.ArchivePath, (string)record.Filename);
                try { if (File.Exists(path)) File.Delete(path); } catch {}
                await conn.ExecuteAsync("DELETE FROM ReturnsImages WHERE Id = @Id", new { Id = id });
                await hub.Clients.All.SendAsync("UpdateData", "Returns", user);
                return Results.Ok(new { success = true });
            }

            return Results.NotFound();
        });

        app.MapPost("/salary-returns/open-folder/{returnId}", async (int returnId, DatabaseService db) => {
            try {
                using var conn = await db.GetOpenConnectionAsync();
                var rawDataJson = await conn.QueryFirstOrDefaultAsync<string>("SELECT RawData FROM SalaryReturns WHERE Id = @Id", new { Id = returnId });
                if (string.IsNullOrEmpty(rawDataJson)) return Results.NotFound(new { success = false, message = "Record not found" });
                var config = DatabaseService.LoadServerConfig();
                string originalName = DatabaseService.ExtractName(rawDataJson);
                string nid = DatabaseService.ExtractNID(rawDataJson);
                string cleanName = new string(originalName.Where(ch => !Path.GetInvalidFileNameChars().Contains(ch)).ToArray()).Trim();
                string folderPrefix = !string.IsNullOrEmpty(nid) ? nid : returnId.ToString();
                var folderNameWithId = $"salary_{folderPrefix}_{cleanName}";
                var targetFolder = Path.Combine(config.ArchivePath, folderNameWithId);
                if (!Directory.Exists(targetFolder)) Directory.CreateDirectory(targetFolder);
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = targetFolder, UseShellExecute = true, Verb = "open" });
                return Results.Ok(new { success = true });
            } catch (Exception ex) { return Results.Json(new { success = false, message = ex.Message }); }
        }).DisableAntiforgery();
        
        // ==========================================
        // Salary Sync Endpoints (Proxied to AutoSyncService)
        // ==========================================

        app.MapPost("/salary-returns/sync/start", async (HttpContext context, AutoSyncService syncService, IHubContext<NotificationHub> hub) => {
            if (syncService.IsRunning) return Results.Conflict(new { message = "المزامنة تعمل بالفعل" });
            var config = DatabaseService.LoadServerConfig();
            if (string.IsNullOrWhiteSpace(config.AutoSyncPath)) return Results.BadRequest(new { message = "لم يتم تحديد مسار المزامنة في الإعدادات" });
            if (!Directory.Exists(config.AutoSyncPath)) return Results.BadRequest(new { message = "مسار المزامنة غير موجود" });
            
            await syncService.StartSync(config.AutoSyncPath);
            
            string user = context.Request.Query["user"].ToString();
            if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
            await hub.Clients.All.SendAsync("UpdateData", "SalaryReturns", user);

            return Results.Ok(new { success = true, message = "تم بدء المزامنة في الخلفية" });
        });

        app.MapGet("/salary-returns/sync/progress", (AutoSyncService syncService) => {
            return Results.Ok(new {
                isRunning = syncService.IsRunning,
                total = syncService.TotalFiles,
                processed = syncService.ProcessedFiles,
                matched = syncService.MatchedFiles,
                unmatched = syncService.UnmatchedFiles,
                moved = syncService.MovedFiles,
                failed = syncService.FailedFiles,
                currentFile = syncService.CurrentFile,
                percent = syncService.TotalFiles > 0 ? (int)((double)syncService.ProcessedFiles / syncService.TotalFiles * 100) : 0
            });
        });

        app.MapGet("/salary-returns/sync/report", (AutoSyncService syncService) => {
            return Results.Ok(new { unmatched = syncService.UnmatchedList, matched = syncService.MatchedList });
        });
    }

    public record ImportData(string filename, string size, List<string> headers, List<object> data);
    public record SettleRequest(List<int> Ids, string SettlementDate);
}
