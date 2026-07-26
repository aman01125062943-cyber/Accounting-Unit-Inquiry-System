using Dapper;
using HKServer.Services;
using System.Text.Json;
using System.Text.Encodings.Web;
using System.Text.Unicode;

namespace HKServer.Endpoints;

public static class DailyReportEndpoints
{
    public static void MapDailyReportEndpoints(this WebApplication app)
    {
        // ─── GET /api/daily-report/new ──────────────────────────────────────────
        // Returns new returns from Returns + SalaryReturns filtered by "تاريخ المرتدات" (Return Date)
        app.MapGet("/api/daily-report/new", async (DatabaseService db, string? date) =>
        {
            string targetDate = string.IsNullOrWhiteSpace(date)
                ? DateTime.Now.ToString("yyyy-MM-dd")
                : date;

            using var conn = await db.GetOpenConnectionAsync();

            var jsonOptions = new JsonSerializerOptions {
                Encoder = JavaScriptEncoder.Create(UnicodeRanges.All)
            };

            bool hasUploadDate = true;
            try { await conn.ExecuteScalarAsync("SELECT UploadDate FROM Returns LIMIT 1"); }
            catch { hasUploadDate = false; }

            bool hasSalaryUploadDate = true;
            try { await conn.ExecuteScalarAsync("SELECT UploadDate FROM SalaryReturns LIMIT 1"); }
            catch { hasSalaryUploadDate = false; }

            string returnsDateCol = hasUploadDate ? "UploadDate" : "''";
            string salaryDateCol = hasSalaryUploadDate ? "UploadDate" : "''";

            // Returns table (حوافز) filtered strictly by actual return date
            var returnsRows = await conn.QueryAsync<dynamic>($@"
                SELECT Id, RawData, {returnsDateCol} as UploadDate
                FROM Returns
                WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0
                  AND (
                    substr(json_extract(RawData, '$.""تاريخ المرتدات""'), 1, 10) = @Date
                    OR substr(json_extract(RawData, '$.""تاريخ المرتد / تاريخ التعلية""'), 1, 10) = @Date
                    OR substr(json_extract(RawData, '$.""returnDate""'), 1, 10) = @Date
                    OR substr(json_extract(RawData, '$.""batchSettlementDate""'), 1, 10) = @Date
                    OR substr(json_extract(RawData, '$.""receivingDate""'), 1, 10) = @Date
                  )
                ORDER BY Id DESC
            ", new { Date = targetDate });

            // SalaryReturns table (مرتبات) filtered strictly by actual return date
            var salaryRows = await conn.QueryAsync<dynamic>($@"
                SELECT Id, RawData, {salaryDateCol} as UploadDate
                FROM SalaryReturns
                WHERE IsDeleted = 0
                  AND (
                    substr(json_extract(RawData, '$.""تاريخ المرتدات""'), 1, 10) = @Date
                    OR substr(json_extract(RawData, '$.""تاريخ المرتد / تاريخ التعلية""'), 1, 10) = @Date
                    OR substr(json_extract(RawData, '$.""returnDate""'), 1, 10) = @Date
                    OR substr(json_extract(RawData, '$.""batchSettlementDate""'), 1, 10) = @Date
                    OR substr(json_extract(RawData, '$.""receivingDate""'), 1, 10) = @Date
                  )
                ORDER BY Id DESC
            ", new { Date = targetDate });

            var result = new List<object>();

            // Helper for extracting clean YYYY-MM-DD date
            string CleanDate(object? val) {
                if (val == null) return "";
                var s = val.ToString()?.Trim() ?? "";
                if (string.IsNullOrWhiteSpace(s)) return "";
                var m = System.Text.RegularExpressions.Regex.Match(s, @"(\d{4}-\d{2}-\d{2})");
                return m.Success ? m.Groups[1].Value : s.Split(' ')[0].Split('T')[0];
            }

            foreach (var r in returnsRows)
            {
                try {
                    var obj = JsonSerializer.Deserialize<Dictionary<string, object>>(r.RawData, jsonOptions);
                    if (obj != null) {
                        obj["id"] = (long)r.Id;
                        obj["_type"] = "حوافز"; // Returns = حوافز
                        
                        // Extract Original Return Date
                        string origReturnDate = "";
                        foreach (var key in new[] { "تاريخ المرتد / تاريخ التعلية", "تاريخ المرتدات", "returnDate", "batchSettlementDate", "orderDate", "receivingDate" }) {
                            object? valObj;
                            if (obj.TryGetValue(key, out valObj) && valObj != null && !string.IsNullOrWhiteSpace(valObj.ToString())) {
                                origReturnDate = CleanDate(valObj);
                                break;
                            }
                        }
                        if (string.IsNullOrWhiteSpace(origReturnDate)) {
                            origReturnDate = CleanDate(r.UploadDate) ?? targetDate;
                        }

                        obj["تاريخ المرتدات"] = origReturnDate;
                        obj["تاريخ الرفع"] = CleanDate(r.UploadDate) ?? origReturnDate;
                        
                        var sVal = obj.ContainsKey("رقم تسوية السداد") ? obj["رقم تسوية السداد"] : null;
                        string sStr = (sVal is JsonElement e && (e.ValueKind == JsonValueKind.Null || e.ValueKind == JsonValueKind.Undefined)) ? "" : sVal?.ToString() ?? "";
                        obj["حالة التسوية"] = !string.IsNullOrWhiteSpace(sStr) ? "تم التسوية" : "لم يتم التسوية";
                        result.Add(obj);
                    }
                } catch { }
            }

            foreach (var r in salaryRows)
            {
                try {
                    var obj = JsonSerializer.Deserialize<Dictionary<string, object>>(r.RawData, jsonOptions);
                    if (obj != null) {
                        obj["id"] = (long)r.Id;
                        obj["_type"] = "مرتبات"; // SalaryReturns = مرتبات
                        
                        // Extract Original Return Date
                        string origReturnDate = "";
                        foreach (var key in new[] { "تاريخ المرتد / تاريخ التعلية", "تاريخ المرتدات", "returnDate", "batchSettlementDate", "orderDate", "receivingDate" }) {
                            object? valObj;
                            if (obj.TryGetValue(key, out valObj) && valObj != null && !string.IsNullOrWhiteSpace(valObj.ToString())) {
                                origReturnDate = CleanDate(valObj);
                                break;
                            }
                        }
                        if (string.IsNullOrWhiteSpace(origReturnDate)) {
                            origReturnDate = CleanDate(r.UploadDate) ?? targetDate;
                        }

                        obj["تاريخ المرتدات"] = origReturnDate;
                        obj["تاريخ الرفع"] = CleanDate(r.UploadDate) ?? origReturnDate;
                        
                        var sVal = obj.ContainsKey("رقم تسوية السداد") ? obj["رقم تسوية السداد"] : null;
                        string sStr = (sVal is JsonElement e && (e.ValueKind == JsonValueKind.Null || e.ValueKind == JsonValueKind.Undefined)) ? "" : sVal?.ToString() ?? "";
                        obj["حالة التسوية"] = !string.IsNullOrWhiteSpace(sStr) ? "تم التسوية" : "لم يتم التسوية";
                        result.Add(obj);
                    }
                } catch { }
            }

            return Results.Ok(new {
                success = true,
                date = targetDate,
                total = result.Count,
                salaryCount = salaryRows.Count(),
                incentiveCount = returnsRows.Count(),
                data = result
            });
        });

        // ─── GET /api/daily-report/settled ──────────────────────────────────────
        // Returns records that were settled today
        app.MapGet("/api/daily-report/settled", async (DatabaseService db, string? date) =>
        {
            string targetDate = string.IsNullOrWhiteSpace(date)
                ? DateTime.Now.ToString("yyyy-MM-dd")
                : date;

            using var conn = await db.GetOpenConnectionAsync();
            var jsonOptions = new JsonSerializerOptions {
                Encoder = JavaScriptEncoder.Create(UnicodeRanges.All)
            };

            bool hasUpdatedAt = true;
            try { await conn.ExecuteScalarAsync("SELECT UpdatedAt FROM Returns LIMIT 1"); }
            catch { hasUpdatedAt = false; }

            string updatedAtCol = hasUpdatedAt ? "UpdatedAt" : "''";

            var returnsSettled = await conn.QueryAsync<dynamic>($@"
                SELECT Id, RawData, {updatedAtCol} as UpdatedAt,
                       [رقم تسوية السداد] as SettlementNo
                FROM Returns
                WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0
                  AND ([رقم تسوية السداد] IS NOT NULL AND [رقم تسوية السداد] != '')
                  AND (
                    substr({updatedAtCol}, 1, 10) = @Date
                    OR substr(json_extract(RawData, '$.""تاريخ التسوية""'), 1, 10) = @Date
                    OR substr(json_extract(RawData, '$.""تاريخ التعديل""'), 1, 10) = @Date
                  )
                ORDER BY Id DESC
            ", new { Date = targetDate });

            bool hasSalaryUpdatedAt = true;
            try { await conn.ExecuteScalarAsync("SELECT UpdatedAt FROM SalaryReturns LIMIT 1"); }
            catch { hasSalaryUpdatedAt = false; }

            string salUpdatedAtCol = hasSalaryUpdatedAt ? "UpdatedAt" : "''";

            var salarySettled = await conn.QueryAsync<dynamic>($@"
                SELECT Id, RawData, {salUpdatedAtCol} as UpdatedAt,
                       [رقم تسوية السداد] as SettlementNo
                FROM SalaryReturns
                WHERE IsDeleted = 0
                  AND ([رقم تسوية السداد] IS NOT NULL AND [رقم تسوية السداد] != '')
                  AND (
                    substr({salUpdatedAtCol}, 1, 10) = @Date
                    OR substr(json_extract(RawData, '$.""تاريخ التسوية""'), 1, 10) = @Date
                    OR substr(json_extract(RawData, '$.""تاريخ التعديل""'), 1, 10) = @Date
                  )
                ORDER BY Id DESC
            ", new { Date = targetDate });

            var result = new List<object>();

            foreach (var r in returnsSettled)
            {
                try {
                    var obj = JsonSerializer.Deserialize<Dictionary<string, object>>(r.RawData, jsonOptions);
                    if (obj != null) {
                        obj["id"] = (long)r.Id;
                        obj["_type"] = "مرتبات";
                        obj["رقم التسوية"] = r.SettlementNo?.ToString() ?? "";
                        obj["تاريخ التسوية_فعلي"] = r.UpdatedAt?.ToString() ?? "";
                        result.Add(obj);
                    }
                } catch { }
            }

            foreach (var r in salarySettled)
            {
                try {
                    var obj = JsonSerializer.Deserialize<Dictionary<string, object>>(r.RawData, jsonOptions);
                    if (obj != null) {
                        obj["id"] = (long)r.Id;
                        obj["_type"] = "حوافز";
                        obj["رقم التسوية"] = r.SettlementNo?.ToString() ?? "";
                        obj["تاريخ التسوية_فعلي"] = r.UpdatedAt?.ToString() ?? "";
                        result.Add(obj);
                    }
                } catch { }
            }

            return Results.Ok(new {
                success = true,
                date = targetDate,
                total = result.Count,
                data = result
            });
        });
    }
}
