using HKServer.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text.Encodings.Web;
using System.Text.Unicode;

namespace HKServer.Endpoints;

public static class ModifiedRecordsEndpoints
{
    public static void MapModifiedRecordsEndpoints(this WebApplication app)
    {
        app.MapGet("/api/modified-records", async (DatabaseService db, string? date, string? search, int? page, int? pageSize, string? source) => {
            using var conn = await db.GetOpenConnectionAsync();
            
            var targetDate = string.IsNullOrWhiteSpace(date) || date == "today" 
                ? DateTime.Now.ToString("yyyy-MM-dd") 
                : date.Trim();

            var jsonOptions = new JsonSerializerOptions {
                Encoder = JavaScriptEncoder.Create(UnicodeRanges.All)
            };

            int p = Math.Max(1, page ?? 1);
            int s = Math.Max(10, Math.Min(500, pageSize ?? 50));
            int offset = (p - 1) * s;

            var results = new List<Dictionary<string, object>>();

            // 1. Fetch from Returns (حوافز) & SalaryReturns (مرتبات)
            var sqlReturns = @"
                SELECT Id, RawData, UpdatedAt, 'مرتدات الحوافز' as SourceType
                FROM Returns
                WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0
                AND (
                    (json_extract(RawData, '$.""رقم الحساب بعد التعديل""') IS NOT NULL AND TRIM(json_extract(RawData, '$.""رقم الحساب بعد التعديل""')) != '')
                    OR (json_extract(RawData, '$.""البنك بعد التعديل""') IS NOT NULL AND TRIM(json_extract(RawData, '$.""البنك بعد التعديل""')) != '')
                    OR (json_extract(RawData, '$.""تاريخ التعديل""') IS NOT NULL AND TRIM(json_extract(RawData, '$.""تاريخ التعديل""')) != '')
                )";

            var sqlSalary = @"
                SELECT Id, RawData, UpdatedAt, 'مرتدات المرتبات' as SourceType
                FROM SalaryReturns
                WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0
                AND (
                    (json_extract(RawData, '$.""رقم الحساب بعد التعديل""') IS NOT NULL AND TRIM(json_extract(RawData, '$.""رقم الحساب بعد التعديل""')) != '')
                    OR (json_extract(RawData, '$.""البنك بعد التعديل""') IS NOT NULL AND TRIM(json_extract(RawData, '$.""البنك بعد التعديل""')) != '')
                    OR (json_extract(RawData, '$.""تاريخ التعديل""') IS NOT NULL AND TRIM(json_extract(RawData, '$.""تاريخ التعديل""')) != '')
                )";

            var rowsReturns = await conn.QueryAsync<dynamic>(sqlReturns);
            var rowsSalary = await conn.QueryAsync<dynamic>(sqlSalary);

            var allRows = new List<dynamic>();
            if (string.IsNullOrWhiteSpace(source) || source == "all" || source == "حوافز" || source == "مرتدات الحوافز") allRows.AddRange(rowsReturns);
            if (string.IsNullOrWhiteSpace(source) || source == "all" || source == "مرتبات" || source == "مرتدات المرتبات") allRows.AddRange(rowsSalary);

            foreach (var row in allRows)
            {
                string raw = row.RawData ?? "";
                if (string.IsNullOrWhiteSpace(raw)) continue;

                var obj = JsonSerializer.Deserialize<Dictionary<string, object>>(raw, jsonOptions);
                if (obj == null) continue;

                string modDate = "";
                if (obj.TryGetValue("تاريخ التعديل", out var md1) && md1 != null) modDate = md1.ToString() ?? "";
                if (string.IsNullOrWhiteSpace(modDate) && obj.TryGetValue("تاريخ اعتماد التعديل", out var md2) && md2 != null) modDate = md2.ToString() ?? "";
                if (string.IsNullOrWhiteSpace(modDate) && obj.TryGetValue("تاريخ المرتد / تاريخ التعلية", out var md3) && md3 != null) modDate = md3.ToString() ?? "";
                if (string.IsNullOrWhiteSpace(modDate) && obj.TryGetValue("تاريخ اعتماد المرتدات", out var md4) && md4 != null) modDate = md4.ToString() ?? "";
                if (string.IsNullOrWhiteSpace(modDate)) modDate = (string?)row.UpdatedAt ?? "";

                // Date filtering
                if (targetDate != "all" && !string.IsNullOrWhiteSpace(targetDate))
                {
                    bool matchDate = false;
                    if (DateTime.TryParse(targetDate, out var dt))
                    {
                        string iso = dt.ToString("yyyy-MM-dd");
                        string isoSlash = dt.ToString("yyyy/MM/dd");
                        string egSlash = dt.ToString("dd/MM/yyyy");
                        string egDash = dt.ToString("dd-MM-yyyy");

                        matchDate = modDate.StartsWith(iso) || modDate.StartsWith(isoSlash) || 
                                    modDate.StartsWith(egSlash) || modDate.StartsWith(egDash);
                    }
                    else
                    {
                        matchDate = modDate.StartsWith(targetDate);
                    }

                    if (!matchDate) continue;
                }

                string fileCode = DatabaseService.ExtractFileCodeDirect(raw);
                if (string.IsNullOrWhiteSpace(fileCode) && obj.TryGetValue("كود الملف", out var fc) && fc != null) fileCode = fc.ToString() ?? "";

                string name = obj.TryGetValue("الاسم", out var n) && n != null ? n.ToString() ?? "" : "";
                string accBefore = obj.TryGetValue("رقم الحساب", out var ab) && ab != null ? ab.ToString() ?? "" : "";
                string bankBefore = obj.TryGetValue("البنك", out var bb) && bb != null ? bb.ToString() ?? "" : (obj.TryGetValue("اسم البنك", out var bb2) && bb2 != null ? bb2.ToString() ?? "" : "");
                string accAfter = obj.TryGetValue("رقم الحساب بعد التعديل", out var aa) && aa != null ? aa.ToString() ?? "" : "";
                string bankAfter = obj.TryGetValue("البنك بعد التعديل", out var ba) && ba != null ? ba.ToString() ?? "" : "";
                string tasFlag = obj.TryGetValue("علامة التسوية", out var tf1) && tf1 != null ? tf1.ToString() ?? "0" : (obj.TryGetValue("tasFlag", out var tf2) && tf2 != null ? tf2.ToString() ?? "0" : "0");

                string srcSys = "NEW_SYSTEM";
                if (obj.TryGetValue("مصدر التعديل", out var s1) && s1 != null && s1.ToString()!.Contains("القديمة")) srcSys = "OLD_SYSTEM";
                else if (obj.TryGetValue("SourceSystem", out var s2) && s2 != null && s2.ToString() == "OLD_SYSTEM") srcSys = "OLD_SYSTEM";

                double amount = 0;
                if (obj.TryGetValue("المبلغ", out var am1) && am1 != null && double.TryParse(am1.ToString(), out var parsedAm1)) amount = parsedAm1;
                else if (obj.TryGetValue("قيمة العملية", out var am2) && am2 != null && double.TryParse(am2.ToString(), out var parsedAm2)) amount = parsedAm2;

                // Search Filter
                if (!string.IsNullOrWhiteSpace(search))
                {
                    var searchLower = search.Trim().ToLower();
                    bool match = fileCode.ToLower().Contains(searchLower) || name.ToLower().Contains(searchLower) || accBefore.ToLower().Contains(searchLower) || bankBefore.ToLower().Contains(searchLower) || accAfter.ToLower().Contains(searchLower) || bankAfter.ToLower().Contains(searchLower);
                    if (!match) continue;
                }

                results.Add(new Dictionary<string, object>
                {
                    ["id"] = (long)row.Id,
                    ["source"] = (string)row.SourceType,
                    ["sourceSystem"] = srcSys,
                    ["tasFlag"] = tasFlag,
                    ["fileCode"] = fileCode,
                    ["name"] = name,
                    ["amount"] = amount,
                    ["accountBefore"] = accBefore,
                    ["bankBefore"] = bankBefore,
                    ["accountAfter"] = accAfter,
                    ["bankAfter"] = bankAfter,
                    ["modificationDate"] = modDate
                });
            }

            // 2. Fetch from FailQueryTransactions (مرتدات البوابة)
            if (string.IsNullOrWhiteSpace(source) || source == "all" || source == "بوابة" || source == "مرتدات البوابة")
            {
                var sqlFailQuery = @"
                    SELECT 
                        Id, BatchId, CreditorName, CreditorAccount, CreditorBic, 
                        NewCreditorAccount, NewCreditorBic, TransactionAmount, ModifiedAt, SourceSystem, TasFlag
                    FROM FailQueryTransactions
                    WHERE NewCreditorAccount IS NOT NULL 
                    AND TRIM(NewCreditorAccount) != '' 
                    AND TRIM(NewCreditorAccount) != '0' 
                    AND TRIM(NewCreditorAccount) != '--'";
                
                var fqRows = await conn.QueryAsync<dynamic>(sqlFailQuery);
                foreach (var r in fqRows)
                {
                    string modDate = (string)r.ModifiedAt ?? "";

                    if (targetDate != "all" && !string.IsNullOrWhiteSpace(targetDate))
                    {
                        bool matchDate = false;
                        if (DateTime.TryParse(targetDate, out var dt))
                        {
                            string iso = dt.ToString("yyyy-MM-dd");
                            string isoSlash = dt.ToString("yyyy/MM/dd");
                            string egSlash = dt.ToString("dd/MM/yyyy");
                            string egDash = dt.ToString("dd-MM-yyyy");

                            matchDate = modDate.StartsWith(iso) || modDate.StartsWith(isoSlash) || 
                                        modDate.StartsWith(egSlash) || modDate.StartsWith(egDash);
                        }
                        else
                        {
                            matchDate = modDate.StartsWith(targetDate);
                        }

                        if (!matchDate) continue;
                    }

                    string fileCode = (string)r.BatchId ?? "";
                    string name = (string)r.CreditorName ?? "";
                    string accBefore = (string)r.CreditorAccount ?? "";
                    string bankBefore = (string)r.CreditorBic ?? "";
                    string accAfter = (string)r.NewCreditorAccount ?? "";
                    string bankAfter = (string)r.NewCreditorBic ?? "";
                    string srcSys = (string)r.SourceSystem ?? "NEW_SYSTEM";
                    string tasFlag = (string)(r.TasFlag?.ToString() ?? "0");
                    double amount = (double)(decimal)(r.TransactionAmount ?? 0m);

                    if (!string.IsNullOrWhiteSpace(search))
                    {
                        var searchLower = search.Trim().ToLower();
                        bool match = fileCode.ToLower().Contains(searchLower) || name.ToLower().Contains(searchLower) || accBefore.ToLower().Contains(searchLower) || bankBefore.ToLower().Contains(searchLower) || accAfter.ToLower().Contains(searchLower) || bankAfter.ToLower().Contains(searchLower);
                        if (!match) continue;
                    }

                    results.Add(new Dictionary<string, object>
                    {
                        ["id"] = (long)r.Id,
                        ["source"] = "مرتدات البوابة",
                        ["sourceSystem"] = srcSys,
                        ["tasFlag"] = tasFlag,
                        ["fileCode"] = fileCode,
                        ["name"] = name,
                        ["amount"] = amount,
                        ["accountBefore"] = accBefore,
                        ["bankBefore"] = bankBefore,
                        ["accountAfter"] = accAfter,
                        ["bankAfter"] = bankAfter,
                        ["modificationDate"] = modDate
                    });
                }
            }

            int totalCount = results.Count;
            double totalAmount = results.Sum(r => (double)r["amount"]);

            var pagedData = results.Skip(offset).Take(s).ToList();

            return Results.Ok(new {
                success = true,
                data = pagedData,
                date = targetDate,
                stats = new {
                    totalCount,
                    totalAmount
                },
                pagination = new {
                    currentPage = p,
                    pageSize = s,
                    total = totalCount,
                    totalPages = (int)Math.Ceiling((double)totalCount / s)
                }
            });
        });
    }
}
