import re

with open(r'C:\Users\esth633\Desktop\hk\Endpoints\ReturnsEndpoints.cs', 'r', encoding='utf-8') as f:
    text = f.read()

# We need to insert POST /returns/bulk-delete before DELETE /returns
new_endpoint = """
        app.MapPost("/returns/bulk-delete", async (HttpContext context, DatabaseService db) => {
            try {
                var request = await context.Request.ReadFromJsonAsync<BulkDeleteRequest>();
                if (request == null) return Results.BadRequest("Invalid request");

                using var conn = await db.GetOpenConnectionAsync();
                var config = DatabaseService.LoadServerConfig();
                
                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";

                if (request.DeleteAllFiltered) {
                    string sqlWhere = "WHERE 1=1";
                    var parameters = new Dapper.DynamicParameters();

                    if (config.ActiveImportId > 0) {
                        sqlWhere += " AND ImportId = @ActiveImportId";
                        parameters.Add("ActiveImportId", config.ActiveImportId);
                    }
                    sqlWhere += " AND IsDeleted = 0";
                    
                    try {
                        if (!string.IsNullOrWhiteSpace(request.Search)) {
                            var words = request.Search.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                            for (int i = 0; i < words.Length; i++) {
                                string spLike = $"SL{i}";
                                string spMatch = $"SM{i}";
                                sqlWhere += $@" AND (
                                    ReturnCode LIKE @{spLike} 
                                    OR RawData LIKE @{spLike} 
                                    OR Id IN (SELECT rowid FROM Returns_FTS WHERE Returns_FTS MATCH @{spMatch})
                                )";
                                parameters.Add(spLike, $"%{words[i]}%");
                                parameters.Add(spMatch, words[i] + "*"); 
                            }
                        }

                        if (!string.IsNullOrEmpty(request.UploadDateFrom)) {
                            sqlWhere += " AND UploadDate >= @UploadDateFrom";
                            parameters.Add("UploadDateFrom", request.UploadDateFrom);
                        }
                        if (!string.IsNullOrEmpty(request.UploadDateTo)) {
                            string to = request.UploadDateTo;
                            if (to.Length == 10) to += " 23:59:59";
                            sqlWhere += " AND UploadDate <= @UploadDateTo";
                            parameters.Add("UploadDateTo", to);
                        }
                        
                        if (!string.IsNullOrEmpty(request.FilterId)) {
                            var filterDef = await db.GetFilterByIdAsync(request.FilterId);
                            if (filterDef != null && filterDef.Criteria != null && filterDef.Criteria.Count > 0) {
                                foreach (var crit in filterDef.Criteria) {
                                    var critType = crit.Type ?? "list";
                                    double? critMin = crit.MinValue;
                                    double? critMax = crit.MaxValue;
                                    if (critType == "range") {
                                        if (request.Min.HasValue) critMin = request.Min;
                                        if (request.Max.HasValue) critMax = request.Max;
                                    }
                                    ApplyCriterion(crit.TargetColumn ?? "كود الملف", critType, crit.ValuesContent, critMin, critMax, ref sqlWhere, parameters);
                                }
                            }
                        } else if (!string.IsNullOrWhiteSpace(request.Filter) && request.Filter != "All" && request.Filter != "الكل") {
                            ApplyCriterion(request.TargetColumn ?? "كود الملف", "list", request.Filter, request.Min, request.Max, ref sqlWhere, parameters);
                        } else if (request.Min.HasValue || request.Max.HasValue) {
                            ApplyCriterion(request.TargetColumn ?? "كود الملف", "range", null, request.Min, request.Max, ref sqlWhere, parameters);
                        }
                    } catch (Exception ex) {
                        Console.WriteLine($"[FILTER ERROR BULK DELETE] {ex.Message}");
                    }

                    if (!string.IsNullOrWhiteSpace(request.AttachmentStatus) && request.AttachmentStatus != "all") {
                        if (request.AttachmentStatus == "yes") {
                            sqlWhere += " AND EXISTS (SELECT 1 FROM ReturnsImages WHERE ReturnId = Returns.Id)";
                        } else if (request.AttachmentStatus == "no") {
                            sqlWhere += " AND NOT EXISTS (SELECT 1 FROM ReturnsImages WHERE ReturnId = Returns.Id)";
                        }
                    }

                    int count = await conn.ExecuteAsync($"UPDATE Returns SET IsDeleted = 1 {sqlWhere}", parameters);
                    await db.AddNotificationEventAsync("Returns", "حذف مجمع", 0, user);
                    return Results.Ok(new { success = true, count = count });

                } else if (request.Ids != null && request.Ids.Any()) {
                    var ids = request.Ids;
                    if (config.ActiveImportId > 0) {
                        int count = await conn.ExecuteAsync("UPDATE Returns SET IsDeleted = 1 WHERE Id IN @Ids AND ImportId = @ImportId AND IsDeleted = 0", new { Ids = ids, ImportId = config.ActiveImportId });
                        await db.AddNotificationEventAsync("Returns", "حذف مجمع", 0, user);
                        return Results.Ok(new { success = true, count = count });
                    } else {
                        int count = await conn.ExecuteAsync("UPDATE Returns SET IsDeleted = 1 WHERE Id IN @Ids AND IsDeleted = 0", new { Ids = ids });
                        await db.AddNotificationEventAsync("Returns", "حذف مجمع", 0, user);
                        return Results.Ok(new { success = true, count = count });
                    }
                }

                return Results.BadRequest("No ids or all-selected flag provided");
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });
"""

model_class = """
public class BulkDeleteRequest {
    public List<int> Ids { get; set; } = new List<int>();
    public bool DeleteAllFiltered { get; set; }
    public string? Search { get; set; }
    public string? Filter { get; set; }
    public string? FilterId { get; set; }
    public string? AttachmentStatus { get; set; }
    public double? Min { get; set; }
    public double? Max { get; set; }
    public string? TargetColumn { get; set; }
    public string? UploadDateFrom { get; set; }
    public string? UploadDateTo { get; set; }
}
"""

if "BulkDeleteRequest" not in text:
    text = text.replace("public static class ReturnsEndpoints", model_class + "\npublic static class ReturnsEndpoints")

if 'app.MapPost("/returns/bulk-delete"' not in text:
    target = 'app.MapDelete("/returns",'
    idx = text.find(target)
    if idx != -1:
        text = text[:idx] + new_endpoint + "\n" + text[idx:]
        
with open(r'C:\Users\esth633\Desktop\hk\Endpoints\ReturnsEndpoints.cs', 'w', encoding='utf-8') as f:
    f.write(text)

print("Backend updated.")
