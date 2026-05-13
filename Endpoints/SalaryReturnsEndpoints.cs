using HKServer.Services;
using HKServer.Hubs;
using Microsoft.AspNetCore.SignalR;
using Dapper;
using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Unicode;
using System.Text.Json;

namespace HKServer.Endpoints;

public class BulkSalaryDeleteRequest {
    public List<int>? Ids { get; set; }
    public bool DeleteAllFiltered { get; set; }
    public string? Search { get; set; }
    public string? AttachmentStatus { get; set; }
    public string? UploadFrom { get; set; }
    public string? UploadTo { get; set; }
    public string? SettlementFilter { get; set; }
    public string? ReturnStatus { get; set; }
    public string? MonthFilter { get; set; }
    public string? PaymentDateFilter { get; set; }
}

public static class SalaryReturnsEndpoints
{
    private static int GetActorUserId(HttpContext context)
    {
        if (int.TryParse(context.Request.Headers["X-User-Id"], out var headerId)) return headerId;
        if (int.TryParse(context.Request.Query["userId"], out var queryId)) return queryId;
        return 0;
    }

    private static async Task<IResult?> RequireDeletePermission(HttpContext context, DatabaseService db)
    {
        if (await db.UserHasPermissionAsync(GetActorUserId(context), "action.delete")) return null;
        return Results.Json(new { success = false, message = "غير مصرح بتنفيذ الحذف" }, statusCode: 403);
    }

    private static async Task<IResult?> RequirePermission(HttpContext context, DatabaseService db, string permissionKey, string message)
    {
        if (await db.UserHasPermissionAsync(GetActorUserId(context), permissionKey)) return null;
        return Results.Json(new { success = false, message }, statusCode: 403);
    }

    private static List<string> BuildDateFilterPatterns(string value) {
        var raw = (value ?? string.Empty).Trim();
        var values = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        void Add(string? candidate) {
            if (!string.IsNullOrWhiteSpace(candidate)) values.Add(candidate.Trim());
        }

        Add(raw);
        var formats = new[] {
            "yyyy-MM-dd", "yyyy/MM/dd", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-ddTHH:mm:ss",
            "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy"
        };
        if (DateTime.TryParseExact(raw, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var exactDate) ||
            DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out exactDate)) {
            Add(exactDate.ToString("yyyy-MM-dd"));
            Add(exactDate.ToString("dd/MM/yyyy"));
            Add(exactDate.ToString("dd-MM-yyyy"));
        }

        return values.Select(v => $"{v}%").ToList();
    }

    private static void AddSalaryPaymentDateFilter(ref string sqlWhere, DynamicParameters parameters, string? paymentDateFilter) {
        if (string.IsNullOrWhiteSpace(paymentDateFilter) || paymentDateFilter == "all") return;

        var fields = new[] {
            @"json_extract(RawData, '$.""تاريخ اعتماد التعديل / تاريخ السداد""')",
            @"json_extract(RawData, '$.""تاريخ السداد""')",
            @"json_extract(RawData, '$.""تاريخ اعتماد التعديل""')",
            @"json_extract(RawData, '$.""تاريخ اعتماد المرتدات""')",
            @"json_extract(RawData, '$.SettlementDate')"
        };

        if (paymentDateFilter.Trim() == "فارغ") {
            sqlWhere += " AND (" + string.Join(" AND ", fields.Select(f => $"({f} IS NULL OR {f} = '')")) + ")";
            return;
        }

        var clauses = new List<string>();
        var patterns = BuildDateFilterPatterns(paymentDateFilter);
        for (var i = 0; i < patterns.Count; i++) {
            var paramName = $"PaymentDateFilter{i}";
            parameters.Add(paramName, patterns[i]);
            clauses.AddRange(fields.Select(f => $"{f} LIKE @{paramName}"));
        }

        if (clauses.Count > 0) {
            sqlWhere += " AND (" + string.Join(" OR ", clauses) + ")";
        }
    }

    private static (string Normalized, string Inverted, string Slash, string InvertedSlash) BuildMonthFilterPatterns(string value) {
        var normalized = DatabaseService.NormalizeMonthText(value);
        var parts = normalized.Split('-', StringSplitOptions.RemoveEmptyEntries);
        var inverted = parts.Length == 2 ? $"{parts[1]}-{parts[0]}" : normalized;
        return (normalized, inverted, normalized.Replace('-', '/'), inverted.Replace('-', '/'));
    }

    private static void AddMonthFilterParameters(DynamicParameters parameters, string month) {
        var patterns = BuildMonthFilterPatterns(month);
        parameters.Add("MonthFilter", month);
        parameters.Add("MonthFilterLike", $"%{patterns.Normalized}%");
        parameters.Add("MonthFilterInvertedLike", $"%{patterns.Inverted}%");
        parameters.Add("MonthFilterSlashLike", $"%{patterns.Slash}%");
        parameters.Add("MonthFilterInvertedSlashLike", $"%{patterns.InvertedSlash}%");
    }

    private const string MonthFilterSql = @" AND (
        json_extract(RawData, '$.""الشهر""') = @MonthFilter 
        OR RawData LIKE @MonthFilterLike
        OR RawData LIKE @MonthFilterInvertedLike
        OR RawData LIKE @MonthFilterSlashLike
        OR RawData LIKE @MonthFilterInvertedSlashLike
        OR ReturnCode = @MonthFilter
        OR ReturnCode LIKE @MonthFilterLike
        OR ReturnCode LIKE @MonthFilterInvertedLike
        OR ReturnCode LIKE @MonthFilterSlashLike
        OR ReturnCode LIKE @MonthFilterInvertedSlashLike
    )";

    public static void MapSalaryReturnsEndpoints(this WebApplication app)
    {
        app.MapPost("/salary-returns/bulk-delete", async (HttpContext context, DatabaseService db) => {
            try {
                var forbidden = await RequireDeletePermission(context, db);
                if (forbidden != null) return forbidden;
                var request = await context.Request.ReadFromJsonAsync<BulkSalaryDeleteRequest>();
                if (request == null) return Results.BadRequest("Invalid request");

                using var conn = await db.GetOpenConnectionAsync();
                var config = DatabaseService.LoadServerConfig();
                
                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";

                if (request.DeleteAllFiltered) {
                    string sqlWhere = "WHERE 1=1";
                    var parameters = new Dapper.DynamicParameters();

                    if (config.ActiveSalaryImportId > 0) {
                        sqlWhere += " AND ImportId = @ActiveImportId";
                        parameters.Add("ActiveImportId", config.ActiveSalaryImportId);
                    }
                    sqlWhere += " AND IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0";
                    
                    if (!string.IsNullOrWhiteSpace(request.Search)) {
                        var words = request.Search.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                        for (int i = 0; i < words.Length; i++) {
                            // Sanitize for FTS5
                            string sanitized = words[i].Replace("\"", "").Replace("\\", "").Replace("*", "").Replace(":", "").Trim();
                            if (string.IsNullOrEmpty(sanitized)) continue;

                            string spLike = $"SL{i}";
                            string spMatch = $"SM{i}";
                            sqlWhere += $@" AND (
                                ReturnCode LIKE @{spLike} 
                                OR RawData LIKE @{spLike} 
                                OR Id IN (SELECT rowid FROM SalaryReturns_FTS WHERE SalaryReturns_FTS MATCH @{spMatch})
                            )";
                            parameters.Add(spLike, $"%{sanitized}%");
                            parameters.Add(spMatch, sanitized + "*"); 
                        }
                    }

                    if (!string.IsNullOrEmpty(request.UploadFrom)) {
                        sqlWhere += " AND UploadDate >= @UploadFrom";
                        parameters.Add("UploadFrom", request.UploadFrom);
                    }
                    if (!string.IsNullOrEmpty(request.UploadTo)) {
                        string to = request.UploadTo;
                        if (to.Length == 10) to += " 23:59:59";
                        sqlWhere += " AND UploadDate <= @UploadTo";
                        parameters.Add("UploadTo", to);
                    }

                    if (!string.IsNullOrWhiteSpace(request.SettlementFilter) && request.SettlementFilter != "all") {
                        if (request.SettlementFilter == "تم التسوية" || request.SettlementFilter == "تمت التسوية") {
                            sqlWhere += " AND (json_extract(RawData, '$.\"رقم تسوية السداد\"') IS NOT NULL AND json_extract(RawData, '$.\"رقم تسوية السداد\"') != '')";
                        } else if (request.SettlementFilter == "لم يتم التسوية") {
                            sqlWhere += " AND (json_extract(RawData, '$.\"رقم تسوية السداد\"') IS NULL OR json_extract(RawData, '$.\"رقم تسوية السداد\"') = '')";
                        }
                    }

                    if (!string.IsNullOrWhiteSpace(request.ReturnStatus) && request.ReturnStatus != "all") {
                        sqlWhere += @" AND (
                            json_extract(RawData, '$.""الحالة""') LIKE @RetStatus
                            OR json_extract(RawData, '$.""حالة الارتداد""') LIKE @RetStatus
                            OR json_extract(RawData, '$.status') LIKE @RetStatus
                        )";
                        parameters.Add("RetStatus", $"%{request.ReturnStatus}%");
                    }

                    if (!string.IsNullOrWhiteSpace(request.MonthFilter) && request.MonthFilter != "all") {
                        if (request.MonthFilter == "فارغ") {
                            sqlWhere += " AND (json_extract(RawData, '$.\"الشهر\"') IS NULL OR json_extract(RawData, '$.\"الشهر\"') = '')";
                        } else {
                            sqlWhere += MonthFilterSql;
                            AddMonthFilterParameters(parameters, request.MonthFilter);
                        }
                    }

                    AddSalaryPaymentDateFilter(ref sqlWhere, parameters, request.PaymentDateFilter);

                    if (!string.IsNullOrWhiteSpace(request.AttachmentStatus) && request.AttachmentStatus != "all") {
                        if (request.AttachmentStatus == "yes") {
                            sqlWhere += " AND EXISTS (SELECT 1 FROM SalaryReturnsImages WHERE ReturnId = SalaryReturns.Id)";
                        } else if (request.AttachmentStatus == "no") {
                            sqlWhere += " AND NOT EXISTS (SELECT 1 FROM SalaryReturnsImages WHERE ReturnId = SalaryReturns.Id)";
                        }
                    }

                    parameters.Add("UpdatedAt", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff"));
                    int count = await conn.ExecuteAsync($"UPDATE SalaryReturns SET IsDeleted = 1, UpdatedAt = @UpdatedAt {sqlWhere}", parameters);
                    await db.AddNotificationEventAsync("SalaryReturns", "حذف مجمع", 0, user);
                    return Results.Ok(new { success = true, count = count });

                } else if (request.Ids != null && request.Ids.Any()) {
                    var ids = request.Ids;
                    int count = await conn.ExecuteAsync("UPDATE SalaryReturns SET IsDeleted = 1, UpdatedAt = @UpdatedAt WHERE Id IN @Ids AND IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0", new { Ids = ids, UpdatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") });
                    await db.AddNotificationEventAsync("SalaryReturns", "حذف مجمع", 0, user);
                    return Results.Ok(new { success = true, count = count });
                }

                return Results.BadRequest("No ids or all-selected flag provided");
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        // ==========================================
        // Upload Date Filter Options
        // ==========================================
        app.MapGet("/salary-returns/upload-dates", async (DatabaseService db) => {
            try {
                using var conn = await db.GetOpenConnectionAsync();
                
                // Fetch raw distinct dates (might still have time parts)
                var rawDates = await conn.QueryAsync<string>(@"
                    SELECT DISTINCT UploadDate 
                    FROM SalaryReturns 
                    WHERE UploadDate IS NOT NULL AND UploadDate != '' AND IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0
                    ORDER BY UploadDate DESC");
                
                // Process dates in C# for strict deduplication (YYYY-MM-DD)
                var formattedDates = rawDates
                    .Where(d => !string.IsNullOrWhiteSpace(d))
                    .Select(d => {
                        if (DateTime.TryParse(d, out var dt)) {
                            return dt.ToString("yyyy-MM-dd");
                        }
                        
                        var match = System.Text.RegularExpressions.Regex.Match(d, @"(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})");
                        if (match.Success) {
                            string p1 = match.Groups[1].Value;
                            string p2 = match.Groups[2].Value.PadLeft(2, '0');
                            string p3 = match.Groups[3].Value.PadLeft(2, '0');
                            
                            if (p1.Length == 4) return $"{p1}-{p2}-{p3}";
                            if (p3.Length == 4) return $"{p3}-{p2}-{p1}";
                        }
                        
                        return d.Length >= 10 ? d.Substring(0, 10) : d;
                    })
                    .Where(d => !string.IsNullOrWhiteSpace(d))
                    .Distinct()
                    .OrderByDescending(d => d)
                    .ToList();

                return Results.Ok(formattedDates);
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
                  WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0 
                  AND Status IS NOT NULL 
                  AND TRIM(Status) != ''");
            return Results.Ok(statuses.Where(s => !string.IsNullOrWhiteSpace(s)).Distinct().ToList());
        });

        // ==========================================
        // GET /salary-returns — Paged data with search/filter
        // ==========================================
        app.MapGet("/salary-returns", async (DatabaseService db, int? page, int? pageSize, string? search, string? attachmentStatus, string? uploadDateFrom, string? uploadDateTo, string? settlementStatus, string? returnStatus, string? month, string? paymentDateFilter) => {
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
             sqlWhere += " AND IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0";

             try {
                  if (!string.IsNullOrWhiteSpace(search)) {
                      var words = search.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                      for (int i = 0; i < words.Length; i++) {
                          // Sanitize for FTS5 (escape/remove special chars that break syntax)
                          string sanitized = words[i].Replace("\"", "").Replace("\\", "").Replace("*", "").Replace(":", "").Trim();
                          if (string.IsNullOrEmpty(sanitized)) continue;

                          string spLike = $"SL{i}";
                          string spMatch = $"SM{i}";
                          sqlWhere += $@" AND (
                              ReturnCode LIKE @{spLike} 
                              OR RawData LIKE @{spLike} 
                              OR Id IN (SELECT rowid FROM SalaryReturns_FTS WHERE SalaryReturns_FTS MATCH @{spMatch})
                              OR Id IN (SELECT RecordId FROM SearchFilterIndex WHERE SourceType = 'salary' AND IsDeleted = 0 AND IsArchived = 0 AND SearchText LIKE @{spLike})
                          )";
                          parameters.Add(spLike, $"%{sanitized}%");
                          parameters.Add(spMatch, sanitized + "*");
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

                  // 1. Settlement Status Filter
                  if (!string.IsNullOrWhiteSpace(settlementStatus) && settlementStatus != "all") {
                      if (settlementStatus == "تم التسوية" || settlementStatus == "تمت التسوية") {
                          sqlWhere += " AND (json_extract(RawData, '$.\"رقم تسوية السداد\"') IS NOT NULL AND json_extract(RawData, '$.\"رقم تسوية السداد\"') != '')";
                      } else if (settlementStatus == "لم يتم التسوية") {
                          sqlWhere += " AND (json_extract(RawData, '$.\"رقم تسوية السداد\"') IS NULL OR json_extract(RawData, '$.\"رقم تسوية السداد\"') = '')";
                      }
                  }

                  // 2. Return Status Filter (using json_extract for performance and accuracy)
                  if (!string.IsNullOrWhiteSpace(returnStatus) && returnStatus != "all") {
                      sqlWhere += @" AND (
                          json_extract(RawData, '$.""الحالة""') LIKE @RetStatus
                          OR json_extract(RawData, '$.""حالة الارتداد""') LIKE @RetStatus
                          OR json_extract(RawData, '$.status') LIKE @RetStatus
                      )";
                      parameters.Add("RetStatus", $"%{returnStatus}%");
                  }

                  // 3. Month Filter
                  if (!string.IsNullOrWhiteSpace(month) && month != "all") {
                      if (month == "فارغ") {
                          sqlWhere += " AND (json_extract(RawData, '$.\"الشهر\"') IS NULL OR json_extract(RawData, '$.\"الشهر\"') = '')";
                      } else {
                          sqlWhere += MonthFilterSql;
                          AddMonthFilterParameters(parameters, month);
                      }
                  }

                  AddSalaryPaymentDateFilter(ref sqlWhere, parameters, paymentDateFilter);

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
             
             var systemTotalCount = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM SalaryReturns WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0");

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
                    object uDateVal = r.UploadDate;
                    if (uDateVal != null) {
                        obj["تاريخ الرفع"] = uDateVal.ToString();
                    }
                    var fileCode = DatabaseService.ExtractFileCodeDirect(r.RawData);
                    if (string.IsNullOrWhiteSpace(fileCode)) fileCode = r.ReturnCode;
                    obj["الشهر"] = DatabaseService.ExtractMonthFromFileCode(fileCode ?? "");
                    long rIdVal = r.Id;
                    obj["AttachmentCount"] = attachmentCounts.ContainsKey(rIdVal) ? attachmentCounts[rIdVal] : 0;
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
        app.MapGet("/salary-returns/all", async (DatabaseService db, string? search, string? attachmentStatus, string? uploadDateFrom, string? uploadDateTo, string? settlementStatus, string? returnStatus, string? month, string? paymentDateFilter) => {
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

                 if (!string.IsNullOrEmpty(uploadDateFrom)) {
                     sqlWhere += " AND UploadDate >= @UploadDateFrom";
                     parameters.Add("UploadDateFrom", uploadDateFrom);
                 }
                 if (!string.IsNullOrEmpty(uploadDateTo)) {
                     if (uploadDateTo.Length == 10) uploadDateTo += " 23:59:59";
                     sqlWhere += " AND UploadDate <= @UploadDateTo";
                     parameters.Add("UploadDateTo", uploadDateTo);
                 }

                 if (!string.IsNullOrWhiteSpace(settlementStatus) && settlementStatus != "all") {
                     if (settlementStatus == "تم التسوية" || settlementStatus == "تمت التسوية") {
                         sqlWhere += " AND (json_extract(RawData, '$.\"رقم تسوية السداد\"') IS NOT NULL AND json_extract(RawData, '$.\"رقم تسوية السداد\"') != '')";
                     } else if (settlementStatus == "لم يتم التسوية") {
                         sqlWhere += " AND (json_extract(RawData, '$.\"رقم تسوية السداد\"') IS NULL OR json_extract(RawData, '$.\"رقم تسوية السداد\"') = '')";
                     }
                 }

                 if (!string.IsNullOrWhiteSpace(returnStatus) && returnStatus != "all") {
                     sqlWhere += @" AND (
                         json_extract(RawData, '$.""الحالة""') LIKE @RetStatus
                         OR json_extract(RawData, '$.""حالة الارتداد""') LIKE @RetStatus
                         OR json_extract(RawData, '$.status') LIKE @RetStatus
                     )";
                     parameters.Add("RetStatus", $"%{returnStatus}%");
                 }

                 if (!string.IsNullOrWhiteSpace(month) && month != "all") {
                     if (month == "فارغ") {
                         sqlWhere += " AND (json_extract(RawData, '$.\"الشهر\"') IS NULL OR json_extract(RawData, '$.\"الشهر\"') = '')";
                     } else {
                         sqlWhere += MonthFilterSql;
                         AddMonthFilterParameters(parameters, month);
                     }
                 }

                 AddSalaryPaymentDateFilter(ref sqlWhere, parameters, paymentDateFilter);

                 if (!string.IsNullOrWhiteSpace(attachmentStatus) && attachmentStatus != "all") {
                     if (attachmentStatus == "yes") {
                         sqlWhere += " AND EXISTS (SELECT 1 FROM SalaryReturnsImages WHERE ReturnId = SalaryReturns.Id)";
                     } else if (attachmentStatus == "no") {
                         sqlWhere += " AND NOT EXISTS (SELECT 1 FROM SalaryReturnsImages WHERE ReturnId = SalaryReturns.Id)";
                     }
                 }
                 
                 var config = DatabaseService.LoadServerConfig();
                 if (config.ActiveSalaryImportId > 0) {
                     sqlWhere += " AND ImportId = @ActiveImportId";
                     parameters.Add("ActiveImportId", config.ActiveSalaryImportId);
                 }
                 sqlWhere += " AND IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0";
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

        app.MapGet("/api/salary-returns/changes", async (DatabaseService db, string? since) => {
            using var conn = await db.GetOpenConnectionAsync();
            var config = DatabaseService.LoadServerConfig();
            var parameters = new DynamicParameters();
            var activeImportSql = "";
            if (config.ActiveSalaryImportId > 0) {
                activeImportSql = " AND ImportId = @ActiveImportId";
                parameters.Add("ActiveImportId", config.ActiveSalaryImportId);
            }

            var sinceSql = "";
            if (!string.IsNullOrWhiteSpace(since)) {
                sinceSql = " AND COALESCE(UpdatedAt, UploadDate, '') > @Since";
                parameters.Add("Since", since);
            }

            var changedCount = await conn.ExecuteScalarAsync<int>(
                $@"SELECT COUNT(*) FROM SalaryReturns
                   WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0 {activeImportSql} {sinceSql}",
                parameters);
            var archivedOrDeletedCount = string.IsNullOrWhiteSpace(since)
                ? 0
                : await conn.ExecuteScalarAsync<int>(
                    $@"SELECT COUNT(*) FROM SalaryReturns
                       WHERE (IsDeleted = 1 OR COALESCE(IsArchived, 0) = 1) {activeImportSql} {sinceSql}",
                    parameters);
            var latestUpdatedAt = await conn.ExecuteScalarAsync<string>(
                $@"SELECT MAX(COALESCE(UpdatedAt, UploadDate, '')) FROM SalaryReturns WHERE 1 = 1 {activeImportSql}",
                parameters);
            var serverTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
            latestUpdatedAt = string.IsNullOrWhiteSpace(latestUpdatedAt) ? serverTime : latestUpdatedAt;

            return Results.Ok(new {
                hasChanges = string.IsNullOrWhiteSpace(since) ? changedCount > 0 : (changedCount + archivedOrDeletedCount) > 0,
                latestUpdatedAt,
                latestVersion = latestUpdatedAt,
                changedCount,
                archivedOrDeletedCount,
                serverTime
            });
        });

        app.MapGet("/api/salary-returns/sync", async (DatabaseService db, string? since) => {
            using var conn = await db.GetOpenConnectionAsync();
            var config = DatabaseService.LoadServerConfig();
            var parameters = new DynamicParameters();
            var activeImportSql = "";
            if (config.ActiveSalaryImportId > 0) {
                activeImportSql = " AND ImportId = @ActiveImportId";
                parameters.Add("ActiveImportId", config.ActiveSalaryImportId);
            }

            var sinceSql = "";
            if (!string.IsNullOrWhiteSpace(since)) {
                sinceSql = " AND COALESCE(UpdatedAt, UploadDate, '') > @Since";
                parameters.Add("Since", since);
            }

            var changedRows = await conn.QueryAsync<string>(
                $@"SELECT json_insert(RawData,
                        '$.id', Id,
                        '$.تاريخ الرفع', COALESCE(UploadDate, ''),
                        '$.UpdatedAt', COALESCE(UpdatedAt, UploadDate, ''),
                        '$.AttachmentCount', COALESCE((SELECT COUNT(DISTINCT Filename) FROM SalaryReturnsImages WHERE ReturnId = SalaryReturns.Id), 0)
                    )
                    FROM SalaryReturns
                    WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0 {activeImportSql} {sinceSql}
                    ORDER BY Id ASC",
                parameters);

            var archivedOrDeletedIds = string.IsNullOrWhiteSpace(since)
                ? Enumerable.Empty<long>()
                : await conn.QueryAsync<long>(
                    $@"SELECT Id FROM SalaryReturns
                       WHERE (IsDeleted = 1 OR COALESCE(IsArchived, 0) = 1) {activeImportSql} {sinceSql}",
                    parameters);

            var latestUpdatedAt = await conn.ExecuteScalarAsync<string>(
                $@"SELECT MAX(COALESCE(UpdatedAt, UploadDate, '')) FROM SalaryReturns WHERE 1 = 1 {activeImportSql}",
                parameters);
            var serverTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
            var latestSyncAt = string.IsNullOrWhiteSpace(latestUpdatedAt) ? serverTime : latestUpdatedAt;
            var json = "{" +
                "\"insertedOrUpdated\":[" + string.Join(",", changedRows) + "]," +
                "\"archivedOrDeletedIds\":[" + string.Join(",", archivedOrDeletedIds) + "]," +
                "\"serverTime\":" + JsonSerializer.Serialize(serverTime) + "," +
                "\"latestSyncAt\":" + JsonSerializer.Serialize(latestSyncAt) +
                "}";
            return Results.Text(json, "application/json");
        });

        // ==========================================
        // POST /salary-returns/import — Import data
        // ==========================================
        app.MapPost("/salary-returns/import", async (HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            try {
                 var forbidden = await RequirePermission(context, db, "action.import", "غير مصرح بتنفيذ الاستيراد");
                 if (forbidden != null) return forbidden;
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

                    // --- Optimized Batch Insertion ---
                    const int batchSize = 2000;
                    
                    // Check if UploadDate exists ONCE before the loop to maximize performance
                    bool hasUploadDateInDb = true;
                    try { await conn.ExecuteScalarAsync("SELECT UploadDate FROM SalaryReturns LIMIT 1"); }
                    catch { hasUploadDateInDb = false; }

                    string currentDate = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                    
                    // Use json_set in SQL to inject the upload date efficiently directly in the database engine
                    // This avoids the massive CPU overhead of Deserializing/Serializing every JSON record in C#
                    string insertSql = hasUploadDateInDb
                        ? "INSERT INTO SalaryReturns (ImportId, RawData, ReturnCode, UploadDate, UpdatedAt) VALUES (@ImportId, json_set(@RawData, '$.\"تاريخ الرفع\"', @UploadDate), @ReturnCode, @UploadDate, @UpdatedAt)"
                        : "INSERT INTO SalaryReturns (ImportId, RawData, ReturnCode, UpdatedAt) VALUES (@ImportId, json_set(@RawData, '$.\"تاريخ الرفع\"', @UploadDate), @ReturnCode, @UpdatedAt)";

                    for (int i = 0; i < importData.data.Count; i += batchSize)
                    {
                        var batch = importData.data.Skip(i).Take(batchSize).Select(d => {
                            var je = (JsonElement)d;
                            string raw = je.GetRawText();
                            string fCode = DatabaseService.ExtractFileCodeDirect(raw);
                            
                            return new
                            {
                                ImportId = archiveId,
                                RawData = raw,
                                ReturnCode = DatabaseService.ExtractReturnCode(fCode),
                                UploadDate = currentDate,
                                UpdatedAt = currentDate
                            };
                        }).ToList();

                        await conn.ExecuteAsync(insertSql, batch, trans);
                    }

                    trans.Commit();
                    string user = context.Request.Query["user"].ToString();
                    if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                    await db.AddNotificationEventAsync("SalaryReturns", "استيراد", archiveId, user);
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
                var forbidden = await RequireDeletePermission(context, db);
                if (forbidden != null) return forbidden;
                using var conn = await db.GetOpenConnectionAsync();
                var config = DatabaseService.LoadServerConfig();
                
                if (config.ActiveSalaryImportId > 0) {
                    await conn.ExecuteAsync("UPDATE SalaryReturns SET IsDeleted = 1, UpdatedAt = @UpdatedAt WHERE ImportId = @ImportId AND IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0", new { ImportId = config.ActiveSalaryImportId, UpdatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") });
                } else {
                    await conn.ExecuteAsync("UPDATE SalaryReturns SET IsDeleted = 1, UpdatedAt = @UpdatedAt WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0", new { UpdatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") });
                }
                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await db.AddNotificationEventAsync("SalaryReturns", "حذف", 0, user);
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
                var forbidden = await RequireDeletePermission(context, db);
                if (forbidden != null) return forbidden;
                using var conn = await db.GetOpenConnectionAsync();
                var config = DatabaseService.LoadServerConfig();
                
                if (config.ActiveSalaryImportId > 0) {
                    await conn.ExecuteAsync("UPDATE SalaryReturns SET IsDeleted = 1, UpdatedAt = @UpdatedAt WHERE Id = @Id AND ImportId = @ActiveId", new { Id = id, ActiveId = config.ActiveSalaryImportId, UpdatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") });
                } else {
                    await conn.ExecuteAsync("UPDATE SalaryReturns SET IsDeleted = 1, UpdatedAt = @UpdatedAt WHERE Id = @Id", new { Id = id, UpdatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") });
                }
                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await db.AddNotificationEventAsync("SalaryReturns", "حذف", id, user);
                return Results.Ok(new { success = true });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        // ==========================================
        // PUT /salary-returns/{id} — Update record
        // ==========================================
        app.MapPut("/salary-returns/{id}", async (int id, HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            try {
                using var reader = new StreamReader(context.Request.Body);
                var rawBody = await reader.ReadToEndAsync();
                if (string.IsNullOrWhiteSpace(rawBody)) return Results.BadRequest();

                using var conn = await db.GetOpenConnectionAsync();

                var obj = JsonSerializer.Deserialize<Dictionary<string, object>>(rawBody);
                string settlementNo = "";
                string accrualNo = "";

                if (obj != null) {
                    var sVal = obj.ContainsKey("رقم تسوية السداد") ? obj["رقم تسوية السداد"] : null;
                    string sStr = (sVal is JsonElement e && (e.ValueKind == JsonValueKind.Null || e.ValueKind == JsonValueKind.Undefined)) ? "" : sVal?.ToString() ?? "";
                    bool hasSettlement = !string.IsNullOrWhiteSpace(sStr);
                    obj["حالة التسوية"] = hasSettlement ? "تم التسوية" : "لم يتم التسوية";

                    rawBody = JsonSerializer.Serialize(obj, new JsonSerializerOptions {
                        Encoder = JavaScriptEncoder.Create(UnicodeRanges.All)
                    });

                    settlementNo = sStr;
                    var aVal = obj.ContainsKey("رقم تسوية التعلية") ? obj["رقم تسوية التعلية"] : null;
                    accrualNo = (aVal is JsonElement ae && (ae.ValueKind == JsonValueKind.Null || ae.ValueKind == JsonValueKind.Undefined)) ? "" : aVal?.ToString() ?? "";
                }

                string fCode = DatabaseService.ExtractFileCodeDirect(rawBody);
                string rCode = DatabaseService.ExtractReturnCode(fCode);

                var updatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
                var affectedRows = 0;
                try {
                    affectedRows = await conn.ExecuteAsync(@"
                        UPDATE SalaryReturns
                        SET RawData = @RawData,
                            ReturnCode = @ReturnCode,
                            [رقم تسوية السداد] = @SettlementNo,
                            [رقم تسوية التعلية] = @AccrualNo,
                            UpdatedAt = @UpdatedAt
                        WHERE Id = @Id",
                        new { RawData = rawBody, ReturnCode = rCode, SettlementNo = settlementNo, AccrualNo = accrualNo, UpdatedAt = updatedAt, Id = id }
                    );
                } catch {
                    affectedRows = await conn.ExecuteAsync(
                        "UPDATE SalaryReturns SET RawData = @RawData, ReturnCode = @ReturnCode, UpdatedAt = @UpdatedAt WHERE Id = @Id",
                        new { RawData = rawBody, ReturnCode = rCode, UpdatedAt = updatedAt, Id = id }
                    );
                }

                if (affectedRows == 0) {
                    return Results.NotFound(new { success = false, message = "Record was not found or was not updated.", id });
                }

                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await db.AddNotificationEventAsync("SalaryReturns", "تعديل", id, user);

                // Return full updated record for frontend cache update
                var updatedRecord = JsonSerializer.Deserialize<Dictionary<string, object>>(rawBody, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (updatedRecord != null) {
                    updatedRecord["id"] = id;
                    updatedRecord["UpdatedAt"] = updatedAt;
                    var attachCount = await conn.ExecuteScalarAsync<int>("SELECT COUNT(DISTINCT Filename) FROM SalaryReturnsImages WHERE ReturnId = @Id", new { Id = id });
                    updatedRecord["AttachmentCount"] = attachCount;
                }
                return Results.Ok(new { success = true, record = updatedRecord });

            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

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
                                
                                await conn.ExecuteAsync("UPDATE SalaryReturns SET RawData = @RawData, UpdatedAt = @UpdatedAt WHERE Id = @Id", new { RawData = updatedRaw, UpdatedAt = now, Id = id }, trans);
                            }
                        }
                    }
                    trans.Commit();
                    string user = context.Request.Query["user"].ToString();
                    if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                    await db.AddNotificationEventAsync("SalaryReturns", "تسوية", request.Ids.FirstOrDefault(), user);
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
                await conn.ExecuteAsync("UPDATE SalaryReturns SET UpdatedAt = @UpdatedAt WHERE Id = @Id", new { UpdatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff"), Id = returnId });

                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await db.AddNotificationEventAsync("SalaryReturns", "رفع مرفق", returnId, user);

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
            var forbidden = await RequireDeletePermission(context, db);
            if (forbidden != null) return forbidden;
            using var conn = await db.GetOpenConnectionAsync();
            var config = DatabaseService.LoadServerConfig();
            
            string user = context.Request.Query["user"].ToString();
            if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";

            // Try SalaryReturnsImages
            var record = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT Filename, ReturnId FROM SalaryReturnsImages WHERE Id = @Id", new { Id = id });
            if (record != null) {
                var path = Path.Combine(config.ArchivePath, (string)record.Filename);
                try { if (File.Exists(path)) File.Delete(path); } catch {}
                await conn.ExecuteAsync("DELETE FROM SalaryReturnsImages WHERE Id = @Id", new { Id = id });
                await conn.ExecuteAsync("UPDATE SalaryReturns SET UpdatedAt = @UpdatedAt WHERE Id = @Id", new { UpdatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff"), Id = Convert.ToInt64(record.ReturnId) });
                await db.AddNotificationEventAsync("SalaryReturns", "حذف مرفق", (long)id, user);
                return Results.Ok(new { success = true });
            }

            // Try ReturnsImages
            record = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT Filename, ReturnId FROM ReturnsImages WHERE Id = @Id", new { Id = id });
            if (record != null) {
                var path = Path.Combine(config.ArchivePath, (string)record.Filename);
                try { if (File.Exists(path)) File.Delete(path); } catch {}
                await conn.ExecuteAsync("DELETE FROM ReturnsImages WHERE Id = @Id", new { Id = id });
                await conn.ExecuteAsync("UPDATE Returns SET UpdatedAt = @UpdatedAt WHERE Id = @Id", new { UpdatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff"), Id = Convert.ToInt64(record.ReturnId) });
                await db.AddNotificationEventAsync("Returns", "حذف مرفق", (long)id, user);
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

        app.MapPost("/salary-returns/sync/start", async (HttpContext context, DatabaseService db, AutoSyncService syncService, IHubContext<NotificationHub> hub) => {
            var forbidden = await RequirePermission(context, db, "action.sync", "غير مصرح بتنفيذ المزامنة");
            if (forbidden != null) return forbidden;
            if (syncService.IsRunning) return Results.Conflict(new { message = "المزامنة تعمل بالفعل" });
            var config = DatabaseService.LoadServerConfig();
            if (string.IsNullOrWhiteSpace(config.AutoSyncPath)) return Results.BadRequest(new { message = "لم يتم تحديد مسار المزامنة في الإعدادات" });
            if (!Directory.Exists(config.AutoSyncPath)) return Results.BadRequest(new { message = "مسار المزامنة غير موجود" });
            
            await syncService.StartSync(config.AutoSyncPath);
            
            string user = context.Request.Query["user"].ToString();
            if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
            await db.AddNotificationEventAsync("SalaryReturns", "مزامنة", 0, user);

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
