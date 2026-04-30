using HKServer.Services;
using HKServer.Models;
using HKServer.Hubs;
using Microsoft.AspNetCore.SignalR;
using Dapper;
using System.Text.Encodings.Web;
using System.Text.Unicode;
using Microsoft.AspNetCore.Mvc;
using System.IO;
using Microsoft.AspNetCore.Http;
using System.Text.Json;

namespace HKServer.Endpoints;


public class BulkDeleteRequest {
    public List<int> Ids { get; set; } = new List<int>();
    public bool DeleteAllFiltered { get; set; }
    public string? Search { get; set; }
    public string? Filter { get; set; }
    public string? FilterId { get; set; }
    public string? AttachmentStatus { get; set; }
    public string? ReturnStatus { get; set; }
    public string? Settlement { get; set; }
    public string? MonthFilter { get; set; }
    public double? Min { get; set; }
    public double? Max { get; set; }
    public string? TargetColumn { get; set; }
    public string? UploadDateFrom { get; set; }
    public string? UploadDateTo { get; set; }
}

public static class ReturnsEndpoints
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

    public static void MapReturnsEndpoints(this WebApplication app)
    {
        // Lightweight endpoint: Get distinct return statuses for filter dropdown (instant)
        // Moved to top to avoid routing conflicts with /returns/{id}
        app.MapGet("/returns/statuses", async (DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var statuses = await conn.QueryAsync<string>(
                @"SELECT DISTINCT COALESCE(
                    json_extract(RawData, '$.""الحالة""'),
                    json_extract(RawData, '$.""حالة الارتداد""'),
                    json_extract(RawData, '$.status'),
                    json_extract(RawData, '$.ReturnStatus')
                  ) as Status 
                  FROM Returns 
                  WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0 
                  AND COALESCE(
                    json_extract(RawData, '$.""الحالة""'),
                    json_extract(RawData, '$.""حالة الارتداد""'),
                    json_extract(RawData, '$.status'),
                    json_extract(RawData, '$.ReturnStatus')
                  ) IS NOT NULL 
                  AND TRIM(COALESCE(
                    json_extract(RawData, '$.""الحالة""'),
                    json_extract(RawData, '$.""حالة الارتداد""'),
                    json_extract(RawData, '$.status'),
                    json_extract(RawData, '$.ReturnStatus')
                  )) != ''");
            return Results.Ok(statuses.Where(s => !string.IsNullOrWhiteSpace(s)).Distinct().ToList());
        });

        app.MapGet("/debug/returns", async (DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            
            // Manual trigger for testing
            var pending = await conn.QueryAsync<dynamic>("SELECT Id, RawData FROM Returns WHERE ReturnCode IS NULL OR trim(ReturnCode) = '' LIMIT 100");
            int fixedCount = 0;
            using (var trans = conn.BeginTransaction()) {
                foreach (var row in pending) {
                    string raw = row.RawData;
                    string fCode = DatabaseService.ExtractFileCodeDirect(raw);
                    string rCode = DatabaseService.ExtractReturnCode(fCode);
                    if (!string.IsNullOrEmpty(rCode)) {
                        await conn.ExecuteAsync("UPDATE Returns SET ReturnCode = @ReturnCode WHERE Id = @Id", new { ReturnCode = rCode, Id = row.Id }, trans);
                        fixedCount++;
                    }
                }
                trans.Commit();
            }

            var samples = await conn.QueryAsync<dynamic>("SELECT Id, ReturnCode, FileCode, substr(RawData, 1, 150) as Raw FROM Returns LIMIT 15");
            return Results.Ok(new { fixedCount, samples });
        });

        app.MapGet("/maintenance/re-extract-codes", async (DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var allReturns = await conn.QueryAsync<dynamic>("SELECT Id, RawData, FileCode FROM Returns");
            int count = 0;
            
            using (var trans = conn.BeginTransaction()) {
                foreach (var row in allReturns) {
                    string fCode = row.FileCode;
                    if (string.IsNullOrEmpty(fCode)) {
                        fCode = DatabaseService.ExtractFileCodeDirect(row.RawData ?? "");
                    }
                    
                    string rCode = DatabaseService.ExtractReturnCode(fCode ?? "");
                    if (!string.IsNullOrEmpty(rCode)) {
                        await conn.ExecuteAsync("UPDATE Returns SET ReturnCode = @ReturnCode WHERE Id = @Id", new { ReturnCode = rCode, Id = row.Id }, trans);
                        count++;
                    }
                }
                trans.Commit();
            }
            return Results.Ok(new { success = true, updatedCount = count, totalProcessed = allReturns.Count() });
        });

        app.MapGet("/test-extract", async (DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var row = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
                SELECT 
                    Id,
                    json_extract(RawData, '$.""تاريخ اعتماد التعديل""') as d1,
                    json_extract(RawData, '$.""تاريخ اعتماد التعديل / تاريخ السداد""') as d2,
                    json_extract(RawData, '$.""الشهر""') as m1,
                    RawData
                FROM Returns 
                WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0 
                AND (
                    (json_extract(RawData, '$.""تاريخ اعتماد التعديل / تاريخ السداد""') IS NOT NULL AND json_extract(RawData, '$.""تاريخ اعتماد التعديل / تاريخ السداد""') != '')
                    OR (json_extract(RawData, '$.""الشهر""') IS NOT NULL AND json_extract(RawData, '$.""الشهر""') != '')
                )
                LIMIT 1");
            return Results.Ok(row);
        });

        app.MapPost("/maintenance/repair-schema", async (DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var logs = new List<string>();
            
            try {
                // 1. Check/Add UploadDate Column
                try {
                    await conn.ExecuteScalarAsync("SELECT UploadDate FROM Returns LIMIT 1");
                } catch {
                    await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN UploadDate TEXT;");
                    await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_UploadDate ON Returns(UploadDate);");
                    logs.Add("Added UploadDate column.");
                }

                // 2. Update NULL/Empty UploadDate with Today's Date
                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                var count = await conn.ExecuteAsync("UPDATE Returns SET UploadDate = @Now WHERE UploadDate IS NULL OR UploadDate = ''", new { Now = now });

                // 3. Add IsDeleted to Returns
                try {
                    await conn.ExecuteScalarAsync("SELECT IsDeleted FROM Returns LIMIT 1");
                } catch {
                    await conn.ExecuteAsync("ALTER TABLE Returns ADD COLUMN IsDeleted INTEGER DEFAULT 0;");
                    await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_Returns_IsDeleted ON Returns(IsDeleted);");
                    logs.Add("Added IsDeleted to Returns.");
                }

                // 4. Add IsDeleted to SalaryReturns
                try {
                    await conn.ExecuteScalarAsync("SELECT IsDeleted FROM SalaryReturns LIMIT 1");
                } catch {
                    await conn.ExecuteAsync("ALTER TABLE SalaryReturns ADD COLUMN IsDeleted INTEGER DEFAULT 0;");
                    await conn.ExecuteAsync("CREATE INDEX IF NOT EXISTS IDX_SalaryReturns_IsDeleted ON SalaryReturns(IsDeleted);");
                    logs.Add("Added IsDeleted to SalaryReturns.");
                }
                if (count > 0) logs.Add($"Updated {count} records with default date: {now}");

                // 3. Ensure RawData has UploadDate injected (for frontend consistency)
                // We do this for records where RawData doesn't contain the date string yet
                // This is a heavier operation, so we limit it or do it carefully
                var rowsToFix = await conn.QueryAsync<dynamic>(
                    "SELECT Id, RawData, UploadDate FROM Returns WHERE RawData NOT LIKE '%تاريخ الرفع%' AND UploadDate IS NOT NULL LIMIT 5000");
                
                int jsonFixed = 0;
                if (rowsToFix.Any()) {
                    using var trans = conn.BeginTransaction();
                    foreach(var row in rowsToFix) {
                        try {
                            string raw = row.RawData;
                            string date = row.UploadDate;
                            
                            // Simple injection before the last closing brace
                            int lastBrace = raw.LastIndexOf('}');
                            if (lastBrace > 0) {
                                string newRaw = raw.Substring(0, lastBrace) + $", \"تاريخ الرفع\": \"{date}\"}}";
                                await conn.ExecuteAsync("UPDATE Returns SET RawData = @Raw WHERE Id = @Id", new { Raw = newRaw, Id = row.Id }, trans);
                                jsonFixed++;
                            }
                        } catch {}
                    }
                    trans.Commit();
                    if (jsonFixed > 0) logs.Add($"Injected 'تاريخ الرفع' into {jsonFixed} JSON records.");
                }

                return Results.Ok(new { success = true, logs });
            } catch (Exception ex) {
                return Results.Ok(new { success = false, error = ex.Message, logs });
            }
        }).DisableAntiforgery();

        // ==========================================
        // Upload Date Filter Options
        // ==========================================
        // Moved to top to avoid routing conflicts with /returns/{id}
        app.MapGet("/returns/upload-dates", async (DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            
            // Fetch from BOTH the column and the JSON for maximum reliability
            try {
                var rawDates = await conn.QueryAsync<string>(@"
                    SELECT DISTINCT UploadDateVal FROM (
                        SELECT UploadDate as UploadDateVal FROM Returns WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0
                        UNION
                        SELECT json_extract(RawData, '$.""تاريخ الرفع""') as UploadDateVal FROM Returns WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0
                    )
                    WHERE UploadDateVal IS NOT NULL AND UploadDateVal != ''
                    ORDER BY UploadDateVal DESC");
                
                var formattedDates = rawDates
                    .Where(d => !string.IsNullOrWhiteSpace(d))
                    .Select(d => {
                        if (DateTime.TryParse(d, out var dt)) return dt.ToString("yyyy-MM-dd");
                        return d.Length >= 10 ? d.Substring(0, 10) : d;
                    })
                    .Distinct()
                    .OrderByDescending(d => d)
                    .ToList();
                    
                return Results.Ok(formattedDates);
            } catch (Exception ex) {
                Console.WriteLine($"[ERROR] Fetching upload dates: {ex.Message}");
                return Results.Ok(new List<string>()); 
            }
        });

        // ==========================================
        // Payment Date Filter Options
        // ==========================================
        app.MapGet("/returns/payment-dates", async (DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            try {
                var rawDates = await conn.QueryAsync<string>(@"
                    SELECT DISTINCT PaymentDate FROM (
                        SELECT trim(json_extract(RawData, '$.""تاريخ اعتماد التعديل / تاريخ السداد""')) as PaymentDate 
                        FROM Returns 
                        WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0
                        UNION
                        SELECT trim(json_extract(RawData, '$.""تاريخ السداد""')) as PaymentDate 
                        FROM Returns 
                        WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0
                    )
                    WHERE PaymentDate IS NOT NULL AND PaymentDate != ''
                    ORDER BY PaymentDate DESC");
                
                var formattedDates = rawDates
                    .Where(d => !string.IsNullOrWhiteSpace(d))
                    .Select(d => d.Length >= 10 ? d.Substring(0, 10) : d)
                    .Distinct()
                    .OrderByDescending(d => d)
                    .ToList();
                    
                return Results.Ok(formattedDates);
            } catch (Exception ex) {
                Console.WriteLine($"[ERROR] Fetching payment dates: {ex.Message}");
                return Results.Ok(new List<string>()); 
            }
        });

        // ==========================================
        // Month Filter Options
        // ==========================================
        app.MapGet("/returns/months", async (DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            try {
                var rows = await conn.QueryAsync<dynamic>(@"
                    SELECT RawData, ReturnCode
                    FROM Returns
                    WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0");

                var formattedMonths = rows
                    .Select(r => {
                        var raw = (string?)r.RawData ?? "";
                        var code = DatabaseService.ExtractFileCodeDirect(raw);
                        if (string.IsNullOrWhiteSpace(code)) code = (string?)r.ReturnCode ?? "";
                        return DatabaseService.ExtractMonthFromFileCode(code);
                    })
                    .Where(m => !string.IsNullOrWhiteSpace(m) && m != "فارغ")
                    .Distinct()
                    .OrderByDescending(m => m)
                    .ToList();
                    
                return Results.Ok(formattedMonths);
            } catch (Exception ex) {
                Console.WriteLine($"[ERROR] Fetching return months: {ex.Message}");
                return Results.Ok(new List<string>()); 
            }
        });

        app.MapGet("/returns", async (DatabaseService db, int? page, int? pageSize, string? search, string? filter, string? filterId, string? attachmentStatus, double? min, double? max, string? targetColumn, string? uploadDateFrom, string? uploadDateTo, string? settlementFilter, string? statusFilter, string? monthFilter, string? paymentDateFilter) => {
             using var conn = await db.GetOpenConnectionAsync();
             
             // Ensure UploadDate column exists to prevent runtime errors if migration hasn't completed yet
             try {
                 await conn.ExecuteScalarAsync("SELECT UploadDate FROM Returns LIMIT 1");
             } catch {
                 // Fast fallback if column doesn't exist yet
                 uploadDateFrom = null;
                 uploadDateTo = null;
             }
             
             var jsonOptions = new JsonSerializerOptions { 
                Encoder = JavaScriptEncoder.Create(UnicodeRanges.All)
             };
             
             // Pagination & Shared Parameters
             int p = Math.Max(1, page ?? 1);
             int s = Math.Max(10, Math.Min(100, pageSize ?? 50));
             int offset = (p - 1) * s;
             
             string sqlWhere = "WHERE 1=1";
             var parameters = new DynamicParameters();

             var config = DatabaseService.LoadServerConfig();
             if (config.ActiveImportId > 0) {
                 sqlWhere += " AND ImportId = @ActiveImportId";
                 parameters.Add("ActiveImportId", config.ActiveImportId);
             }
             sqlWhere += " AND IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0";
             
             try {
                  if (!string.IsNullOrWhiteSpace(search)) {
                      var words = search.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                      for (int i = 0; i < words.Length; i++) {
                          // Sanitize for FTS5
                          string sanitized = words[i].Replace("\"", "").Replace("\\", "").Replace("*", "").Replace(":", "").Trim();
                          if (string.IsNullOrEmpty(sanitized)) continue;

                          string spLike = $"SL{i}";
                          string spMatch = $"SM{i}";
                          // AI Fix: Combined search logic for maximum reliability
                          // Search in ReturnCode, RawData (using LIKE), and through FTS5 for deep indexing
                          sqlWhere += $@" AND (
                              ReturnCode LIKE @{spLike} 
                              OR RawData LIKE @{spLike} 
                              OR Id IN (SELECT rowid FROM Returns_FTS WHERE Returns_FTS MATCH @{spMatch})
                              OR Id IN (SELECT RecordId FROM SearchFilterIndex WHERE SourceType = 'returns' AND IsDeleted = 0 AND IsArchived = 0 AND SearchText LIKE @{spLike})
                          )";
                          parameters.Add(spLike, $"%{sanitized}%");
                          parameters.Add(spMatch, sanitized + "*"); // Added wildcard for partial matching in FTS
                      }
                  }

                  // 1. Settlement Filter
                  if (!string.IsNullOrWhiteSpace(settlementFilter) && settlementFilter != "all") {
                      if (settlementFilter == "تم التسوية" || settlementFilter == "تمت التسوية") {
                          sqlWhere += " AND (json_extract(RawData, '$.\"رقم تسوية السداد\"') IS NOT NULL AND json_extract(RawData, '$.\"رقم تسوية السداد\"') != '')";
                      } else if (settlementFilter == "لم يتم التسوية") {
                          sqlWhere += " AND (json_extract(RawData, '$.\"رقم تسوية السداد\"') IS NULL OR json_extract(RawData, '$.\"رقم تسوية السداد\"') = '')";
                      }
                  }

                  // 2. Return Status Filter
                  if (!string.IsNullOrWhiteSpace(statusFilter) && statusFilter != "all") {
                      string rsParam = $"RS_{Guid.NewGuid().ToString("N").Substring(0, 6)}";
                      sqlWhere += $@" AND (
                          json_extract(RawData, '$.""الحالة""') LIKE @{rsParam}
                          OR json_extract(RawData, '$.""حالة الارتداد""') LIKE @{rsParam}
                          OR json_extract(RawData, '$.status') LIKE @{rsParam}
                          OR json_extract(RawData, '$.ReturnStatus') LIKE @{rsParam}
                      )";
                      parameters.Add(rsParam, $"%{statusFilter}%");
                  }

                  // 3. Month Filter (Literal Match only as requested)
                  if (!string.IsNullOrWhiteSpace(monthFilter) && monthFilter != "all") {
                      if (monthFilter == "فارغ") {
                          sqlWhere += " AND (json_extract(RawData, '$.\"الشهر\"') IS NULL OR json_extract(RawData, '$.\"الشهر\"') = '') AND (json_extract(RawData, '$.\"شهر\"') IS NULL OR json_extract(RawData, '$.\"شهر\"') = '')";
                      } else {
                          var normalizedMonth = DatabaseService.NormalizeMonthText(monthFilter);
                          var parts = normalizedMonth.Split('-', StringSplitOptions.RemoveEmptyEntries);
                          var invertedMonth = parts.Length == 2 ? $"{parts[1]}-{parts[0]}" : normalizedMonth;
                          var slashMonth = normalizedMonth.Replace('-', '/');
                          var invertedSlashMonth = invertedMonth.Replace('-', '/');
                          sqlWhere += @" AND (
                              json_extract(RawData, '$.""الشهر""') = @MonthFilter 
                              OR json_extract(RawData, '$.""شهر""') = @MonthFilter
                              OR ReturnCode LIKE @MonthFilterLike
                              OR ReturnCode LIKE @MonthFilterInvertedLike
                              OR ReturnCode LIKE @MonthFilterSlashLike
                              OR ReturnCode LIKE @MonthFilterInvertedSlashLike
                              OR RawData LIKE @MonthFilterLike
                              OR RawData LIKE @MonthFilterInvertedLike
                              OR RawData LIKE @MonthFilterSlashLike
                              OR RawData LIKE @MonthFilterInvertedSlashLike
                          )";
                          parameters.Add("MonthFilter", monthFilter);
                          parameters.Add("MonthFilterLike", $"%{normalizedMonth}%");
                          parameters.Add("MonthFilterInvertedLike", $"%{invertedMonth}%");
                          parameters.Add("MonthFilterSlashLike", $"%{slashMonth}%");
                          parameters.Add("MonthFilterInvertedSlashLike", $"%{invertedSlashMonth}%");
                      }
                  }

                  // 4. Payment Date Filter (Strict Match as requested)
                  if (!string.IsNullOrWhiteSpace(paymentDateFilter) && paymentDateFilter != "all") {
                      sqlWhere += @" AND (
                          json_extract(RawData, '$.""تاريخ اعتماد التعديل / تاريخ السداد""') LIKE @PaymentDateFilter
                          OR json_extract(RawData, '$.""تاريخ السداد""') LIKE @PaymentDateFilter
                          OR json_extract(RawData, '$.""تاريخ اعتماد التعديل""') LIKE @PaymentDateFilter
                          OR json_extract(RawData, '$.""تاريخ اعتماد المرتدات""') LIKE @PaymentDateFilter
                          OR json_extract(RawData, '$.SettlementDate') LIKE @PaymentDateFilter
                          OR Id IN (
                              SELECT RecordId
                              FROM SearchFilterIndex
                              WHERE SourceType = 'returns'
                                AND IsDeleted = 0
                                AND IsArchived = 0
                                AND PaymentDate = @PaymentDateExact
                          )
                      )";
                      parameters.Add("PaymentDateFilter", $"{paymentDateFilter}%");
                      parameters.Add("PaymentDateExact", paymentDateFilter);
                  }

                  // Upload Date Filter
                  if (!string.IsNullOrEmpty(uploadDateFrom)) {
                       sqlWhere += " AND UploadDate >= @UploadDateFrom";
                       parameters.Add("UploadDateFrom", uploadDateFrom);
                  }
                  if (!string.IsNullOrEmpty(uploadDateTo)) {
                       if (uploadDateTo.Length == 10) uploadDateTo += " 23:59:59";
                       sqlWhere += " AND UploadDate <= @UploadDateTo";
                       parameters.Add("UploadDateTo", uploadDateTo);
                  }
                  
                  // --- UNIFIED FILTER LOGIC (Consolidated Smart & Legacy) ---
                  if (!string.IsNullOrEmpty(filterId)) {
                      var filterDef = await db.GetFilterByIdAsync(filterId);
                      if (filterDef != null && filterDef.Criteria != null && filterDef.Criteria.Count > 0) {
                          foreach (var crit in filterDef.Criteria) {
                              var critType = crit.Type ?? "list";
                              double? critMin = crit.MinValue;
                              double? critMax = crit.MaxValue;
                              
                              // If criteria is a range type and user provided min/max in URL, use those instead
                              if (critType == "range") {
                                  if (min.HasValue) critMin = min;
                                  if (max.HasValue) critMax = max;
                              }
                              
                              ApplyCriterion(crit.TargetColumn ?? "كود الملف", critType, crit.ValuesContent, critMin, critMax, ref sqlWhere, parameters);
                          }
                      }
                  } else if (!string.IsNullOrWhiteSpace(filter) && filter != "All" && filter != "الكل") {
                     // Legacy/Ad-hoc from URL
                     ApplyCriterion(targetColumn ?? "كود الملف", "list", filter, min, max, ref sqlWhere, parameters);
                 } else if (min.HasValue || max.HasValue) {
                     // Ad-hoc Range from URL
                     ApplyCriterion(targetColumn ?? "كود الملف", "range", null, min, max, ref sqlWhere, parameters);
                 }
             } catch (Exception ex) {
                 Console.WriteLine($"[FILTER ERROR] {ex.Message}");
                 // Fallback: Continue without crashed filter parts to prevent SEHException
             }

             if (!string.IsNullOrWhiteSpace(attachmentStatus) && attachmentStatus != "all") {
                  if (attachmentStatus == "yes") {
                      sqlWhere += " AND EXISTS (SELECT 1 FROM ReturnsImages WHERE ReturnId = Returns.Id)";
                  } else if (attachmentStatus == "no") {
                      sqlWhere += " AND NOT EXISTS (SELECT 1 FROM ReturnsImages WHERE ReturnId = Returns.Id)";
                  }
             }

             // 1. Fetch Global Stats + Matching Count using SQL Aggregation
             // We use json_extract for robust key detection in the JSON blob
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
                    FROM Returns
                    {sqlWhere}
                )
                SELECT 
                    COUNT(*) as FilteredCount,
                    SUM(RowAmount) as TotalAmount,
                    COUNT(CASE WHEN RawData LIKE '%إرجاع%' OR RawData LIKE '%ارجاع%' OR RawData LIKE '%return%' THEN 1 END) as ReturnedCount,
                    COUNT(CASE WHEN RawData LIKE '%مرفوض%' OR RawData LIKE '%reject%' OR RawData LIKE '%fail%' THEN 1 END) as RejectedCount,
                    SUM(CASE WHEN ModDate IS NOT NULL AND ModDate != '' THEN 1 ELSE 0 END) as SuccessCount,
                    SUM(CASE WHEN ModDate IS NULL OR ModDate = '' THEN 1 ELSE 0 END) as PendingCount,
                    SUM(CASE WHEN ModDate IS NOT NULL AND ModDate != '' THEN RowAmount ELSE 0 END) as SettledAmount,
                    SUM(CASE WHEN ModDate IS NULL OR ModDate = '' THEN RowAmount ELSE 0 END) as PendingAmount
                FROM AmountData";
             
             var stats = await conn.QueryFirstOrDefaultAsync<dynamic>(statsSql, parameters);
             double totalAmount = stats?.TotalAmount ?? 0;
             double settledAmount = stats?.SettledAmount ?? 0;
             double pendingAmount = stats?.PendingAmount ?? 0;
             int returnedCount = (int)(stats?.ReturnedCount ?? 0);
             int rejectedCount = (int)(stats?.RejectedCount ?? 0);
             int successCount = (int)(stats?.SuccessCount ?? 0);
             int pendingCount = (int)(stats?.PendingCount ?? 0);
             int filteredCount = (int)(stats?.FilteredCount ?? 0);
             
             // 0. Get Global System Total (Unfiltered)
             var systemTotalCount = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Returns WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0");

             // 2. Fetch Paged Data
             bool hasUploadDateInDb = true;
             try { await conn.ExecuteScalarAsync("SELECT UploadDate FROM Returns LIMIT 1"); }
             catch { hasUploadDateInDb = false; }

             string selectFields = hasUploadDateInDb 
                 ? "Id, RawData, ReturnCode, UploadDate" 
                 : "Id, RawData, ReturnCode, NULL as UploadDate";

             var sqlPaged = $@"
                SELECT {selectFields}
                FROM Returns 
                {sqlWhere} 
                ORDER BY Id ASC 
                LIMIT @Limit OFFSET @Offset";
             
             var pagingParams = new DynamicParameters(parameters);
             pagingParams.Add("Limit", s);
             pagingParams.Add("Offset", offset);
             
             var pagedRows = await conn.QueryAsync<dynamic>(sqlPaged, pagingParams);
             
             // Extract Ids to fetch attachment counts
             var ids = pagedRows.Select(r => (long)r.Id).ToList();
             var attachmentCounts = new Dictionary<long, int>();
             
             if (ids.Any()) {
                 var counts = await conn.QueryAsync<(long ReturnId, int Count)>(
                     "SELECT ReturnId, COUNT(DISTINCT Filename) as Count FROM ReturnsImages WHERE ReturnId IN @Ids GROUP BY ReturnId", 
                     new { Ids = ids });
                 attachmentCounts = counts.ToDictionary(c => c.ReturnId, c => c.Count);
             }

var data = pagedRows.Select(r => {
                 var obj = JsonSerializer.Deserialize<Dictionary<string, object>>(r.RawData, jsonOptions);
                 if (obj != null) {
                     obj["id"] = (long)r.Id;
                     object uDateVal = r.UploadDate;
                     if (uDateVal != null) {
                         obj["تاريخ الرفع"] = uDateVal.ToString();
                     }
                     
                     // Normalize payment date field for frontend compatibility
                     // Check for "تاريخ السداد" and copy to "تاريخ اعتماد التعديل / تاريخ السداد" if preferred field is missing
                     string paymentDateKey1 = "تاريخ اعتماد التعديل / تاريخ السداد";
                     string paymentDateKey2 = "تاريخ السداد";
                     var paymentDateVal1 = obj.ContainsKey(paymentDateKey1) ? obj[paymentDateKey1] : null;
                     var paymentDateVal2 = obj.ContainsKey(paymentDateKey2) ? obj[paymentDateKey2] : null;
                     string paymentDateStr1 = (paymentDateVal1 is JsonElement p1 && (p1.ValueKind == JsonValueKind.Null || p1.ValueKind == JsonValueKind.Undefined)) ? "" : paymentDateVal1?.ToString() ?? "";
                     string paymentDateStr2 = (paymentDateVal2 is JsonElement p2 && (p2.ValueKind == JsonValueKind.Null || p2.ValueKind == JsonValueKind.Undefined)) ? "" : paymentDateVal2?.ToString() ?? "";
                     bool hasPaymentDate1 = !string.IsNullOrWhiteSpace(paymentDateStr1);
                     bool hasPaymentDate2 = !string.IsNullOrWhiteSpace(paymentDateStr2);
                     
                     if (!hasPaymentDate1 && hasPaymentDate2) {
                         obj[paymentDateKey1] = obj[paymentDateKey2];
                     }
                     
                     // Ensure crucial status field is calculated for UI consistency
                     var sVal = obj.ContainsKey("رقم تسوية السداد") ? obj["رقم تسوية السداد"] : null;
                     string sStr = (sVal is JsonElement e && (e.ValueKind == JsonValueKind.Null || e.ValueKind == JsonValueKind.Undefined)) ? "" : sVal?.ToString() ?? "";
                     bool hasSettlement = !string.IsNullOrWhiteSpace(sStr);
                     obj["حالة التسوية"] = hasSettlement ? "تم التسوية" : "لم يتم التسوية";

                     var fileCode = DatabaseService.ExtractFileCodeDirect(r.RawData);
                     if (string.IsNullOrWhiteSpace(fileCode)) fileCode = r.ReturnCode;
                     obj["الشهر"] = DatabaseService.ExtractMonthFromFileCode(fileCode ?? "");

                     long rIdVal = (long)r.Id;
                     obj["AttachmentCount"] = attachmentCounts.ContainsKey(rIdVal) ? attachmentCounts[rIdVal] : 0;
                 }
                 return obj;
              }).ToList();
             
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
                    returnedCount,
                    rejectedCount,
                    successCount,
                    pendingCount
                }
             });
        });
        
        // Extended: Get ALL data for validation (No Pagination) - OPTIMIZED FOR RAW JSON SPEED (Server-Side JSON Joining)
        app.MapGet("/returns/all", async (DatabaseService db, string? search, string? filter, string? filterId, string? attachmentStatus, double? min, double? max, string? targetColumn, string? uploadDateFrom, string? uploadDateTo) => {
             using var conn = await db.GetOpenConnectionAsync();
             
             // Safety check for UploadDate column
             bool hasUploadDate = true;
             try { await conn.ExecuteScalarAsync("SELECT UploadDate FROM Returns LIMIT 1"); }
             catch { hasUploadDate = false; uploadDateFrom = null; uploadDateTo = null; }

             string sqlWhere = "WHERE 1=1";
             var parameters = new DynamicParameters();

             sqlWhere += " AND IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0";
             
             try {
                if (!string.IsNullOrWhiteSpace(search)) {
                    var words = search.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    for (int i = 0; i < words.Length; i++) {
                        string sp = $"SearchParam{i}";
                        sqlWhere += $" AND RawData LIKE @{sp}";
                        parameters.Add(sp, $"%{words[i]}%");
                    }
                }

                 // Upload Date Filter
                 if (!string.IsNullOrEmpty(uploadDateFrom)) {
                      sqlWhere += " AND UploadDate >= @UploadDateFrom";
                      parameters.Add("UploadDateFrom", uploadDateFrom);
                 }
                 if (!string.IsNullOrEmpty(uploadDateTo)) {
                      if (uploadDateTo.Length == 10) uploadDateTo += " 23:59:59";
                      sqlWhere += " AND UploadDate <= @UploadDateTo";
                      parameters.Add("UploadDateTo", uploadDateTo);
                 }
                 
                 // --- UNIFIED FILTER LOGIC (Consolidated Smart & Legacy) ---
                 if (!string.IsNullOrEmpty(filterId)) {
                     var filterDef = await db.GetFilterByIdAsync(filterId);
                     if (filterDef != null && filterDef.Criteria != null && filterDef.Criteria.Count > 0) {
                         foreach (var crit in filterDef.Criteria) {
                             ApplyCriterion(crit.TargetColumn ?? "كود الملف", crit.Type, crit.ValuesContent, crit.MinValue, crit.MaxValue, ref sqlWhere, parameters);
                         }
                     }
                 } else if (!string.IsNullOrWhiteSpace(filter) && filter != "All" && filter != "الكل") {
                     // Legacy/Ad-hoc from URL
                     ApplyCriterion(targetColumn ?? "كود الملف", "list", filter, min, max, ref sqlWhere, parameters);
                 } else if (min.HasValue || max.HasValue) {
                     // Ad-hoc Range from URL
                     ApplyCriterion(targetColumn ?? "كود الملف", "range", null, min, max, ref sqlWhere, parameters);
                 }
             } catch (Exception ex) {
                 Console.WriteLine($"[FILTER ALL ERROR] {ex.Message}");
                 // Fallback: Continue without crashed filter parts to prevent SEHException
             }

             if (!string.IsNullOrWhiteSpace(attachmentStatus) && attachmentStatus != "all") {
                  if (attachmentStatus == "yes") {
                      sqlWhere += " AND EXISTS (SELECT 1 FROM ReturnsImages WHERE ReturnId = Returns.Id)";
                  } else if (attachmentStatus == "no") {
                      sqlWhere += " AND NOT EXISTS (SELECT 1 FROM ReturnsImages WHERE ReturnId = Returns.Id)";
                  }
              }
 
              // Speed Optimization: Improved JSON injection for reliability
              string uploadDateSelect = hasUploadDate ? "COALESCE(UploadDate, '')" : "''";
              var allRawRows = await conn.QueryAsync<string>(
                  $@"SELECT json_insert(RawData, 
                         '$.id', Id, 
                         '$.تاريخ الرفع', {uploadDateSelect}, 
                         '$.AttachmentCount', COALESCE((SELECT COUNT(DISTINCT Filename) FROM ReturnsImages WHERE ReturnId = Returns.Id), 0),
                         '$.تاريخ اعتماد التعديل / تاريخ السداد', COALESCE(
                             json_extract(RawData, '$.""تاريخ اعتماد التعديل / تاريخ السداد""'),
                             json_extract(RawData, '$.""تاريخ السداد""')
                         )
                     )
                     FROM Returns {sqlWhere}", parameters);
              
              var finalJson = "[" + string.Join(",", allRawRows) + "]";
              return Results.Text(finalJson, "application/json");
        });

        app.MapPost("/returns/import", async (HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            try {
                 var forbidden = await RequirePermission(context, db, "action.import", "غير مصرح بتنفيذ الاستيراد");
                 if (forbidden != null) return forbidden;
                 var importData = await context.Request.ReadFromJsonAsync<ImportData>();
                 if (importData == null) return Results.BadRequest();
                 
                 using var conn = await db.GetOpenConnectionAsync();
                 using var trans = conn.BeginTransaction();
                 
                 try {
                    // Preparation of the archive record
                    var archiveId = await conn.QuerySingleAsync<int>(@"
                        INSERT INTO Archives (Date, Filename, RecordCount, Size, Headers)
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
                    try { await conn.ExecuteScalarAsync("SELECT UploadDate FROM Returns LIMIT 1"); }
                    catch { hasUploadDateInDb = false; }

                    string currentDate = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                    
                    // Use json_set in SQL to inject the upload date efficiently directly in the database engine
                    // This avoids the massive CPU overhead of Deserializing/Serializing every JSON record in C#
                    string insertSql = hasUploadDateInDb
                        ? "INSERT INTO Returns (ImportId, RawData, ReturnCode, UploadDate, [رقم تسوية التعلية], [رقم تسوية السداد]) VALUES (@ImportId, json_set(@RawData, '$.\"تاريخ الرفع\"', @UploadDate), @ReturnCode, @UploadDate, @InquiryNum, @PaymentNum)"
                        : "INSERT INTO Returns (ImportId, RawData, ReturnCode, [رقم تسوية التعلية], [رقم تسوية السداد]) VALUES (@ImportId, json_set(@RawData, '$.\"تاريخ الرفع\"', @UploadDate), @ReturnCode, @InquiryNum, @PaymentNum)";

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
                                InquiryNum = je.TryGetProperty("رقم تسوية التعلية", out var inq) ? inq.ToString() : "",
                                PaymentNum = je.TryGetProperty("رقم تسوية السداد", out var pay) ? pay.ToString() : ""
                            };
                        }).ToList();

                        await conn.ExecuteAsync(insertSql, batch, trans);
                    }

                    trans.Commit();
                    string user = context.Request.Query["user"].ToString();
                    if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                    await db.AddNotificationEventAsync("Returns", "استيراد", archiveId, user);
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

        
        app.MapPost("/returns/bulk-delete", async (HttpContext context, DatabaseService db) => {
            try {
                var forbidden = await RequireDeletePermission(context, db);
                if (forbidden != null) return forbidden;
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
                    sqlWhere += " AND IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0";
                    
                    try {
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
                                    OR Id IN (SELECT rowid FROM Returns_FTS WHERE Returns_FTS MATCH @{spMatch})
                                )";
                                parameters.Add(spLike, $"%{sanitized}%");
                                parameters.Add(spMatch, sanitized + "*"); 
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

                    // Return Status Filter
                    if (!string.IsNullOrWhiteSpace(request.ReturnStatus) && request.ReturnStatus != "all" && request.ReturnStatus != "الكل") {
                        string rsParam = $"RS_{Guid.NewGuid().ToString("N").Substring(0, 6)}";
                        sqlWhere += $@" AND (
                            json_extract(RawData, '$.""الحالة""') LIKE @{rsParam}
                            OR json_extract(RawData, '$.""حالة الارتداد""') LIKE @{rsParam}
                            OR json_extract(RawData, '$.""Status""') LIKE @{rsParam}
                            OR json_extract(RawData, '$.""ReturnStatus""') LIKE @{rsParam}
                        )";
                        parameters.Add(rsParam, $"%{request.ReturnStatus}%");
                    }

                    int count = await conn.ExecuteAsync($"UPDATE Returns SET IsDeleted = 1 {sqlWhere}", parameters);
                    await db.AddNotificationEventAsync("Returns", "حذف مجمع", 0, user);
                    return Results.Ok(new { success = true, count = count });

                } else if (request.Ids != null && request.Ids.Any()) {
                    var ids = request.Ids;
                    if (config.ActiveImportId > 0) {
                        int count = await conn.ExecuteAsync("UPDATE Returns SET IsDeleted = 1 WHERE Id IN @Ids AND ImportId = @ImportId AND IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0", new { Ids = ids, ImportId = config.ActiveImportId });
                        await db.AddNotificationEventAsync("Returns", "حذف مجمع", 0, user);
                        return Results.Ok(new { success = true, count = count });
                    } else {
                        int count = await conn.ExecuteAsync("UPDATE Returns SET IsDeleted = 1 WHERE Id IN @Ids AND IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0", new { Ids = ids });
                        await db.AddNotificationEventAsync("Returns", "حذف مجمع", 0, user);
                        return Results.Ok(new { success = true, count = count });
                    }
                }

                return Results.BadRequest("No ids or all-selected flag provided");
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

app.MapDelete("/returns", async (HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            try {
                var forbidden = await RequireDeletePermission(context, db);
                if (forbidden != null) return forbidden;
                using var conn = await db.GetOpenConnectionAsync();
                var config = DatabaseService.LoadServerConfig();
                
                if (config.ActiveImportId > 0) {
                    // إذا كان في وضع عرض أرشيف محدد، نؤرشف السجلات المرتبطة بهذا الأرشيف فقط
                    await conn.ExecuteAsync("UPDATE Returns SET IsDeleted = 1 WHERE ImportId = @ImportId AND IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0", new { ImportId = config.ActiveImportId });
                } else {
                    await conn.ExecuteAsync("UPDATE Returns SET IsDeleted = 1 WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0");
                }
                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await db.AddNotificationEventAsync("Returns", "حذف", 0, user);
                return Results.Ok(new { success = true });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        app.MapDelete("/returns/{id}", async (int id, HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            try {
                var forbidden = await RequireDeletePermission(context, db);
                if (forbidden != null) return forbidden;
                using var conn = await db.GetOpenConnectionAsync();
                var config = DatabaseService.LoadServerConfig();
                
                if (config.ActiveImportId > 0) {
                    // أرشفة السجل المختار حتى في وضع استعراض الأرشيف
                    await conn.ExecuteAsync("UPDATE Returns SET IsDeleted = 1 WHERE Id = @Id AND ImportId = @ImportId", new { Id = id, ImportId = config.ActiveImportId });
                } else {
                    // حذف ناعم (أرشفة) في الوضع الطبيعي
                    await conn.ExecuteAsync("UPDATE Returns SET IsDeleted = 1 WHERE Id = @Id", new { Id = id });
                }
                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await db.AddNotificationEventAsync("Returns", "حذف", id, user);
                return Results.Ok(new { success = true });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        app.MapPut("/returns/{id}", async (int id, HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            try {
                using var reader = new StreamReader(context.Request.Body);
                var rawBody = await reader.ReadToEndAsync();
                if (string.IsNullOrWhiteSpace(rawBody)) return Results.BadRequest();

                using var conn = await db.GetOpenConnectionAsync();
                
                var obj = JsonSerializer.Deserialize<Dictionary<string, object>>(rawBody);
                string settlementNo = "";
                string accrualNo = "";

                if (obj != null) {
                    // Settlement status based on رقم تسوية السداد
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

                // Attempt to update physical columns if they exist
                try {
                    await conn.ExecuteAsync(@"
                        UPDATE Returns 
                        SET RawData = @RawData, 
                            ReturnCode = @ReturnCode,
                            [رقم تسوية السداد] = @SettlementNo,
                            [رقم تسوية التعلية] = @AccrualNo
                        WHERE Id = @Id", 
                        new { RawData = rawBody, ReturnCode = rCode, SettlementNo = settlementNo, AccrualNo = accrualNo, Id = id }
                    );
                } catch {
                    // Fallback if physical columns don't exist
                    await conn.ExecuteAsync(
                        "UPDATE Returns SET RawData = @RawData, ReturnCode = @ReturnCode WHERE Id = @Id", 
                        new { RawData = rawBody, ReturnCode = rCode, Id = id }
                    );
                }

                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await db.AddNotificationEventAsync("Returns", "تعديل", id, user);
                return Results.Ok(new { success = true });

            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        app.MapPost("/returns/settle", async (HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            try {
                var request = await context.Request.ReadFromJsonAsync<SettleRequest>();
                if (request == null || request.Ids == null || !request.Ids.Any()) return Results.BadRequest("No IDs provided");

                using var conn = await db.GetOpenConnectionAsync();
                using var trans = conn.BeginTransaction();

                try {
                    // Update the modification date in RawData to current date
                    // We also need to ensure the RawData stays valid JSON
                    var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                    
                    foreach (var id in request.Ids) {
                        var rawData = await conn.QueryFirstOrDefaultAsync<string>("SELECT RawData FROM Returns WHERE Id = @Id", new { Id = id }, trans);
                        if (!string.IsNullOrEmpty(rawData)) {
                            var obj = JsonSerializer.Deserialize<Dictionary<string, object>>(rawData);
                            if (obj != null) {
                                // Add or update settlement fields
                                obj["تاريخ اعتماد التعديل"] = now;
                                obj["تاريخ التسوية"] = now;
                                obj["حالة التسوية"] = "تم التسوية";
                                
                                var updatedRaw = JsonSerializer.Serialize(obj, new JsonSerializerOptions { 
                                    Encoder = JavaScriptEncoder.Create(UnicodeRanges.All) 
                                });
                                
                                await conn.ExecuteAsync("UPDATE Returns SET RawData = @RawData WHERE Id = @Id", new { RawData = updatedRaw, Id = id }, trans);
                            }
                        }
                    }

                    trans.Commit();
                    string user = context.Request.Query["user"].ToString();
                    if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                    await db.AddNotificationEventAsync("Returns", "تسوية", request.Ids.FirstOrDefault(), user);
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
        // Attachment Management Endpoints (Main Returns)
        // ==========================================

        app.MapGet("/returns/attachments/{returnId}", async (int returnId, DatabaseService db) => {
            var related = await db.GetRelatedIdsAcrossTables(returnId, "returns");
            
            using var conn = await db.GetOpenConnectionAsync();
            
            var attachments = new List<dynamic>();

            // Fetch from ReturnsImages
            if (related.ReturnIds.Any()) {
                var rAttachments = await conn.QueryAsync(
                    "SELECT Id, Filename, CreatedAt, 'returns' as Source FROM ReturnsImages WHERE ReturnId IN @Ids", 
                    new { Ids = related.ReturnIds });
                attachments.AddRange(rAttachments);
            }

            // Fetch from SalaryReturnsImages
            if (related.SalaryIds.Any()) {
                var sAttachments = await conn.QueryAsync(
                    "SELECT Id, Filename, CreatedAt, 'salary' as Source FROM SalaryReturnsImages WHERE ReturnId IN @Ids", 
                    new { Ids = related.SalaryIds });
                attachments.AddRange(sAttachments);
            }

            // Group by Filename to avoid duplicates and order by CreatedAt
            var finalResult = attachments
                .GroupBy(a => (string)a.Filename)
                .Select(g => g.OrderByDescending(a => a.CreatedAt).First())
                .OrderByDescending(a => a.CreatedAt)
                .ToList();

            return Results.Ok(finalResult);
        });

        app.MapGet("/returns/attachment/{id}", async (int id, DatabaseService db) => {
            using var conn = await db.GetOpenConnectionAsync();
            var record = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT Filename FROM ReturnsImages WHERE Id = @Id", new { Id = id });
            
            if (record == null) {
                // Try SalaryReturnsImages
                record = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT Filename FROM SalaryReturnsImages WHERE Id = @Id", new { Id = id });
            }

            if (record == null) return Results.NotFound();

            string storedPath = (string)record.Filename;
            string finalPath;
            var config = DatabaseService.LoadServerConfig();

            if (Path.IsPathRooted(storedPath)) {
                finalPath = storedPath;
            } else {
                finalPath = Path.Combine(config.ArchivePath, storedPath);
            }

            if (!File.Exists(finalPath)) return Results.NotFound(new { message = "File not found on disk", path = finalPath });

            var provider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
            if (!provider.TryGetContentType(finalPath, out var contentType))
            {
                contentType = "application/octet-stream";
            }

            return Results.File(finalPath, contentType, Path.GetFileName(finalPath));
        });

        app.MapPost("/returns/attachments/{returnId}", async (int returnId, IFormFile file, HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            string user = context.Request.Query["user"].ToString();
            if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";

            if (file == null || file.Length == 0) return Results.BadRequest("No file uploaded");

            var config = DatabaseService.LoadServerConfig();
            if (!Directory.Exists(config.ArchivePath)) Directory.CreateDirectory(config.ArchivePath);

            using var conn = db.GetConnection();
            var rawDataJson = await conn.QueryFirstOrDefaultAsync<string>("SELECT RawData FROM Returns WHERE Id = @Id", new { Id = returnId });
            if (string.IsNullOrEmpty(rawDataJson)) return Results.NotFound();

            string originalName = DatabaseService.ExtractName(rawDataJson);
            string nid = DatabaseService.ExtractNID(rawDataJson);
            string cleanName = new string(originalName.Where(ch => !Path.GetInvalidFileNameChars().Contains(ch)).ToArray()).Trim();

            string folderPrefix = !string.IsNullOrEmpty(nid) ? nid : returnId.ToString();
            var folderNameWithId = $"{folderPrefix}_{cleanName}";
            var targetFolder = Path.Combine(config.ArchivePath, folderNameWithId);
            if (!Directory.Exists(targetFolder)) Directory.CreateDirectory(targetFolder);

            var targetReturnIds = new HashSet<int> { returnId };
            var linkMode = config.AttachmentLinkMode ?? "Both";
            
            if (linkMode != "Name" && !string.IsNullOrEmpty(nid))
            {
                var matches = await conn.QueryAsync<int>("SELECT Id FROM Returns WHERE RawData LIKE @Nid", new { Nid = $"%\"{nid}\"%" });
                foreach (var id in matches) targetReturnIds.Add(id);
            }
            
            if (linkMode != "NID" && !string.IsNullOrWhiteSpace(cleanName))
            {
                var matches = await conn.QueryAsync<int>("SELECT Id FROM Returns WHERE RawData LIKE @Name", new { Name = $"%\"{originalName}\"%" });
                foreach (var id in matches) targetReturnIds.Add(id);
            }

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

                foreach (var rId in targetReturnIds)
                {
                    await conn.ExecuteAsync(
                         "INSERT INTO ReturnsImages (ReturnId, Filename, CreatedAt) VALUES (@ReturnId, @Filename, @CreatedAt)",
                         new { ReturnId = rId, Filename = dbFilename, CreatedAt = DateTime.Now });
                }

                await db.AddNotificationEventAsync("Returns", "رفع مرفق", returnId, user);

                return Results.Ok(new { success = true });
            } catch (Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        }).DisableAntiforgery();

        app.MapDelete("/returns/attachment/{id}", async (int id, HttpContext context, DatabaseService db, IHubContext<NotificationHub> hub) => {
            var forbidden = await RequireDeletePermission(context, db);
            if (forbidden != null) return forbidden;
            using var conn = await db.GetOpenConnectionAsync();
            var config = DatabaseService.LoadServerConfig();
            
            string user = context.Request.Query["user"].ToString();
            if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";

            // Try ReturnsImages
            var record = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT Filename FROM ReturnsImages WHERE Id = @Id", new { Id = id });
            if (record != null) {
                var path = Path.Combine(config.ArchivePath, (string)record.Filename);
                try { if (File.Exists(path)) File.Delete(path); } catch {}
                
                // Restore DB deletion
                await conn.ExecuteAsync("DELETE FROM ReturnsImages WHERE Id = @Id", new { Id = id });
                
                await db.AddNotificationEventAsync("Returns", "حذف مرفق", (long)id, user);
                return Results.Ok(new { success = true });
            }

            // Try SalaryReturnsImages
            record = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT Filename FROM SalaryReturnsImages WHERE Id = @Id", new { Id = id });
            if (record != null) {
                // Restore physical file deletion
                var path = Path.Combine(config.ArchivePath, (string)record.Filename);
                try { if (File.Exists(path)) File.Delete(path); } catch {}
                
                // Restore DB deletion
                await conn.ExecuteAsync("DELETE FROM SalaryReturnsImages WHERE Id = @Id", new { Id = id });

                await db.AddNotificationEventAsync("SalaryReturns", "حذف مرفق", (long)id, user);
                return Results.Ok(new { success = true });
            }

            return Results.NotFound();
        });

        app.MapPost("/returns/open-folder/{id}", async (int id, HttpContext context, DatabaseService db) => {
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
              var rawDataJson = await conn.QueryFirstOrDefaultAsync<string>("SELECT RawData FROM Returns WHERE Id = @Id", new { Id = id });
              string nid = "";
              if (!string.IsNullOrEmpty(rawDataJson)) {
                  nid = DatabaseService.ExtractNID(rawDataJson);
                  if (folderName == "Unknown") folderName = DatabaseService.ExtractName(rawDataJson);
              }

              var invalidChars = Path.GetInvalidFileNameChars();
              var cleanName = new string(folderName.Where(ch => !invalidChars.Contains(ch)).ToArray()).Trim();
              if (string.IsNullOrEmpty(cleanName)) cleanName = "Unknown";
              
              string folderPrefix = !string.IsNullOrEmpty(nid) ? nid : id.ToString();
              var folderNameWithId = $"{folderPrefix}_{cleanName}";
              var config = DatabaseService.LoadServerConfig();
              var targetFolder = Path.Combine(config.ArchivePath ?? "", folderNameWithId);
              
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
                Console.WriteLine($"!!! ERROR opening folder {targetFolder}: {ex.Message}");
                return Results.Json(new { success = false, message = "فشل فتح المجلد: " + ex.Message, path = targetFolder });
             }
        });

        app.MapPost("/returns/sync/start", async (HttpContext context, AutoSyncService syncService, IHubContext<NotificationHub> hub) => {
            var db = context.RequestServices.GetRequiredService<DatabaseService>();
            var forbidden = await RequirePermission(context, db, "action.sync", "غير مصرح بتنفيذ المزامنة");
            if (forbidden != null) return forbidden;
            if (syncService.IsRunning) return Results.Conflict(new { message = "المزامنة تعمل بالفعل" });
            var config = DatabaseService.LoadServerConfig();
            if (string.IsNullOrWhiteSpace(config.AutoSyncPath)) return Results.BadRequest(new { message = "لم يتم تحديد مسار المزامنة في الإعدادات" });
            if (!Directory.Exists(config.AutoSyncPath)) return Results.BadRequest(new { message = "مسار المزامنة غير موجود" });
            
            await syncService.StartSync(config.AutoSyncPath);
            
            string user = context.Request.Query["user"].ToString();
            if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
            await hub.Clients.All.SendAsync("UpdateData", "Returns", user, "مزامنة");

            return Results.Ok(new { success = true, message = "تم بدء المزامنة في الخلفية" });
        });

        app.MapGet("/returns/sync/progress", (AutoSyncService syncService) => {
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

        app.MapGet("/returns/sync/report", (AutoSyncService syncService) => {
            return Results.Ok(new { unmatched = syncService.UnmatchedList, matched = syncService.MatchedList });
        });

    }
    public record ScanCompleteRequest(string Filename);
    public record SettleRequest(List<int> Ids);
    public class ReturnRecord {
        public int Id { get; set; }
        public string RawData { get; set; } = "";
        public string ReturnCode { get; set; } = "";
    }
    private static void ApplyCriterion(string critCol, string critType, string? values, double? minValue, double? maxValue, ref string sqlWhere, DynamicParameters parameters)
    {
        string critJsonPath = $"$.\"{critCol.Replace("\"", "\\\"")}\"";
        string paramId = Guid.NewGuid().ToString("N").Substring(0, 8);
        
        // Normalize column name for better detection
        string normCol = critCol.Replace(" ", "").Replace("ـ", "");
        bool isCodeCol = normCol == "كودالملف" || normCol == "FileCode" || normCol == "ReturnCode" || normCol == "كودالمرتد" || normCol.Contains("كود");

        // SPECIAL CASE: Redirect Code filters to the new indexed ReturnCode column
        if (isCodeCol) {
            if (critType == "list" && !string.IsNullOrEmpty(values)) {
                var rawVals = values.Split(new[] { ',', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (rawVals.Length > 0) {
                    var listParts = new List<string>();
                    for (int i = 0; i < rawVals.Length; i++) {
                        string pName = $"RC_{paramId}_{i}";
                        string pFile = $"FC_{paramId}_{i}";
                        
                        string v = rawVals[i];
                        string cleanV = DatabaseService.ExtractReturnCode(v);
                        if (string.IsNullOrEmpty(cleanV)) cleanV = v; 

                        // AI Fix: Hybrid Match (Numeric OR Full Text with Prefix)
                        // This allows searching for "434" or "Army-c-434"
                        listParts.Add("(ReturnCode LIKE @"+pName+" OR FileCode LIKE @"+pFile+")");
                        parameters.Add(pName, $"%{cleanV}%");
                        parameters.Add(pFile, $"%{v}%");
                    }
                    sqlWhere += $" AND ({string.Join(" OR ", listParts)})";
                    return; 
                }
            } else if (critType == "range") {
                double? finalMin = minValue;
                double? finalMax = maxValue;

                // AI Improvement: Support hybrid range storage (prefixes in ValuesContent)
                if (!finalMin.HasValue && !finalMax.HasValue && !string.IsNullOrEmpty(values) && values.Contains('|')) {
                    var parts = values.Split('|');
                    if (parts.Length >= 2) {
                        string minExt = DatabaseService.ExtractReturnCode(parts[0]);
                        string maxExt = DatabaseService.ExtractReturnCode(parts[1]);
                        if (double.TryParse(minExt, out double mi)) finalMin = mi;
                        else if (double.TryParse(parts[0].Trim(), out double mi2)) finalMin = mi2;

                        if (double.TryParse(maxExt, out double ma)) finalMax = ma;
                        else if (double.TryParse(parts[1].Trim(), out double ma2)) finalMax = ma2;
                    }
                }

                if (finalMin.HasValue) {
                    sqlWhere += $" AND CAST(ReturnCode AS REAL) >= @MinRC_{paramId}";
                    parameters.Add($"MinRC_{paramId}", finalMin.Value);
                }
                if (finalMax.HasValue) {
                    sqlWhere += $" AND CAST(ReturnCode AS REAL) <= @MaxRC_{paramId}";
                    parameters.Add($"MaxRC_{paramId}", finalMax.Value);
                }
                return;
            }
        }

        // Generic JSON Filter
        if (critType == "list" && !string.IsNullOrEmpty(values)) {
            var rawVals = values.Split(new[] { ',', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (rawVals.Length > 0) {
                var listParts = new List<string>();
                for (int i = 0; i < rawVals.Length; i++) {
                    string pName = $"L_{paramId}_{i}";
                    listParts.Add($"json_extract(RawData, @JP_{paramId}) LIKE @{pName}");
                    parameters.Add(pName, $"%{rawVals[i]}%");
                }
                parameters.Add($"JP_{paramId}", critJsonPath);
                sqlWhere += $" AND ({string.Join(" OR ", listParts)})";
            }
        } else if (critType == "range") {
            bool isAmount = critCol.Contains("المبلغ") || critCol.Contains("مبلغ") || critCol.Contains("قيمة") || critCol.ToLower().Contains("amount");
            if (isAmount) {
                // استخراج المبلغ مباشرة من JSON لدعم كل المسميات
                string amountExpr = @"COALESCE(
                    CAST(json_extract(RawData, '$.""المبلغ""') AS REAL),
                    CAST(json_extract(RawData, '$.""مبلغ""') AS REAL),
                    CAST(json_extract(RawData, '$.""قيمة العملية""') AS REAL),
                    CAST(json_extract(RawData, '$.""صافي المبلغ""') AS REAL),
                    CAST(json_extract(RawData, '$.Amount') AS REAL),
                    0)";
                if (minValue.HasValue) {
                    sqlWhere += $" AND {amountExpr} >= @Min_{paramId}";
                    parameters.Add($"Min_{paramId}", minValue.Value);
                }
                if (maxValue.HasValue) {
                    sqlWhere += $" AND {amountExpr} <= @Max_{paramId}";
                    parameters.Add($"Max_{paramId}", maxValue.Value);
                }
            } else {
                parameters.Add($"JP_{paramId}", critJsonPath);
                if (minValue.HasValue) {
                    sqlWhere += $" AND CAST(json_extract(RawData, @JP_{paramId}) AS REAL) >= @Min_{paramId}";
                    parameters.Add($"Min_{paramId}", minValue.Value);
                }
                if (maxValue.HasValue) {
                    sqlWhere += $" AND CAST(json_extract(RawData, @JP_{paramId}) AS REAL) <= @Max_{paramId}";
                    parameters.Add($"Max_{paramId}", maxValue.Value);
                }
            }
        }
    }
}

