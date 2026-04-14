using Dapper;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Mvc;
using HKServer.Services;
using HKServer.Hubs;
using Microsoft.AspNetCore.SignalR;
using System.Text.Json;
using System.Linq;
using System.Collections.Generic;

namespace HKServer.Endpoints;

public static class SmartSettlementEndpoints
{
    public static void MapSmartSettlementEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/smart-settlement");

        group.MapPost("/match", async ([FromBody] MatchRequest request, DatabaseService db) =>
        {
            try {
                using var conn = await db.GetOpenConnectionAsync();
                var results = new List<MatchResultItem>();

                string monthFilter = request.Filters?.Month ?? "";
                if (monthFilter == "all") monthFilter = ""; // Handle frontend "all" option
                string statusFilter = request.Filters?.Status ?? "الكل";
                string matchBy = request.Filters?.MatchBy ?? "الاسم";
                string dataType = request.Filters?.DataType ?? "الكل";

                // --- 1. Fetch Incentive Data (Returns) ---
                var dbIncentives = new List<SettlementDBRecord>();
                if (dataType == "الكل" || dataType == "incentive") {
                    string incSql = string.IsNullOrEmpty(monthFilter) 
                        ? "SELECT Id, ReturnCode, RawData FROM Returns WHERE IsDeleted = 0" 
                        : "SELECT Id, ReturnCode, RawData FROM Returns WHERE IsDeleted = 0 AND (ReturnCode LIKE @LikeParam OR RawData LIKE @RawParam)";
                    
                    string likeParam = $"%-{monthFilter}%";
                    string rawParam = $"%{monthFilter}%";
                    var incRows = await conn.QueryAsync<dynamic>(incSql, new { LikeParam = likeParam, RawParam = rawParam });
                    dbIncentives = ProcessRows(incRows, monthFilter, statusFilter, "incentive");
                }
                
                // --- 2. Fetch Salary Data (SalaryReturns) ---
                var dbSalaries = new List<SettlementDBRecord>();
                if (dataType == "الكل" || dataType == "salary") {
                    string salSql = string.IsNullOrEmpty(monthFilter) 
                        ? "SELECT Id, ReturnCode, RawData FROM SalaryReturns WHERE IsDeleted = 0" 
                        : "SELECT Id, ReturnCode, RawData FROM SalaryReturns WHERE IsDeleted = 0 AND (ReturnCode LIKE @LikeParam OR RawData LIKE @RawParam)";

                    string likeParam = $"%-{monthFilter}%";
                    string rawParam = $"%{monthFilter}%";
                    var salRows = await conn.QueryAsync<dynamic>(salSql, new { LikeParam = likeParam, RawParam = rawParam });
                    dbSalaries = ProcessRows(salRows, monthFilter, statusFilter, "salary");
                }

                foreach(var excelRow in request.Records) {
                    var item = new MatchResultItem { SourceExcelRow = excelRow };
                    
                    // Fix: Use CleanArabic on matchBy to correctly identify "الاسم" or "الاســــم" selection
                    if (DatabaseService.CleanArabic(matchBy ?? "") == "الاسم") {
                        // MATCHING BY NAME: Use CleanArabic for robust matching (handles Hamza, Teh Marbuta, etc.)
                        string cleanExcelName = DatabaseService.CleanArabic(excelRow.Name?.ToString() ?? "");
                        if (!string.IsNullOrEmpty(cleanExcelName)) {
                            item.Matches = dbIncentives.Where(d => DatabaseService.CleanArabic(d.Name ?? "") == cleanExcelName).ToList();
                            item.SalaryMatches = dbSalaries.Where(d => DatabaseService.CleanArabic(d.Name ?? "") == cleanExcelName).ToList();
                        }
                    } else { // الرقم القومي
                        // Clean the National ID from Excel to match the cleaned DB format (digits only)
                        string nId = System.Text.RegularExpressions.Regex.Replace(excelRow.NationalId?.ToString() ?? "", @"[^\d]", "");
                        if(!string.IsNullOrEmpty(nId)) {
                            item.Matches = dbIncentives.Where(d => d.NationalId == nId).ToList();
                            item.SalaryMatches = dbSalaries.Where(d => d.NationalId == nId).ToList();
                        }
                    }
                    results.Add(item);
                }

                return Results.Ok(new { success = true, data = results });
            } catch (Exception ex) {
                Console.WriteLine("=== SMART SETTLEMENT MATCH ERROR ===");
                Console.WriteLine(ex.ToString());
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });


        group.MapPost("/execute", async (HttpContext context, [FromBody] ExecuteRequest request, DatabaseService db, IHubContext<NotificationHub> hub) =>
        {
            try {
                using var conn = await db.GetOpenConnectionAsync();
                using var trans = conn.BeginTransaction();
                int updatedCount = 0;
                int notUpdatedCount = 0;

                string incUpdateSql = @"UPDATE Returns 
                               SET ReturnCode = COALESCE(@BatchCode, ReturnCode),
                                   RawData = json_set(RawData, 
                                   '$.""رقم الحساب بعد التعديل""', @NewAccount, 
                                   '$.""البنك بعد التعديل""', @NewBank,
                                   '$.""تاريخ المرتدات""', @ReturnDate,
                                   '$.""تاريخ اعتماد المرتدات""', @ReturnApprovalDate,
                                   '$.""تاريخ التعديل""', @ModDate,
                                   '$.""تاريخ اعتماد التعديل""', @ModApprovalDate,
                                   '$.""رقم تسوية السداد""', @SettlementNo,
                                   '$.""تاريخ تسوية السداد""', @SettlementDate,
                                   '$.""حالة التسوية""', @StatusVal
                               )
                               WHERE Id = @DbRecordId";

                string salUpdateSql = @"UPDATE SalaryReturns 
                               SET ReturnCode = COALESCE(@BatchCode, ReturnCode),
                                   RawData = json_set(RawData, 
                                   '$.""رقم الحساب بعد التعديل""', @NewAccount, 
                                   '$.""البنك بعد التعديل""', @NewBank,
                                   '$.""تاريخ المرتدات""', @ReturnDate,
                                   '$.""تاريخ اعتماد المرتدات""', @ReturnApprovalDate,
                                   '$.""تاريخ التعديل""', @ModDate,
                                   '$.""تاريخ اعتماد التعديل""', @ModApprovalDate,
                                   '$.""رقم تسوية السداد""', @SettlementNo,
                                   '$.""تاريخ تسوية السداد""', @SettlementDate,
                                   '$.""حالة التسوية""', @StatusVal
                               )
                               WHERE Id = @DbRecordId";

                string today = DateTime.Now.ToString("yyyy-MM-dd");

                foreach(var upd in request.Updates) {
                    if(upd.DbRecordId > 0) {
                        // Accept whatever the frontend sends exactly! If it's an empty string, save the empty string.
                        // We only fallback to current string if it's literally null (missing property in payload)
                        string finalModDate = upd.ModDate ?? "";
                        string finalModApprovalDate = upd.ModApprovalDate ?? "";
                        
                        // Criterion Change: A record is only considered "Settled" (تم التسوية) 
                        // if it has a valid Settlement Number (رقم تسوية السداد).
                        // ModDate/NewAccount alone don't constitute a full financial settlement status.
                        bool hasSettlement = !string.IsNullOrEmpty(upd.SettlementNo);
                        string statusVal = hasSettlement ? "تم التسوية" : "لم يتم التسوية";

                        
                        string currentSql = upd.Source == "salary" ? salUpdateSql : incUpdateSql;

                        var affected = await conn.ExecuteAsync(currentSql, new {
                            BatchCode = upd.BatchCode,
                            NewAccount = upd.NewAccount ?? "",
                            NewBank = upd.NewBank ?? "",
                            ReturnDate = upd.ReturnDate ?? "",
                            ReturnApprovalDate = upd.ReturnApprovalDate ?? "",
                            ModDate = finalModDate,
                            ModApprovalDate = finalModApprovalDate,
                            SettlementNo = upd.SettlementNo ?? "",
                            SettlementDate = upd.SettlementDate ?? "",
                            StatusVal = statusVal,
                            DbRecordId = upd.DbRecordId
                        }, trans);
                        
                        if (affected > 0) updatedCount++;
                        else notUpdatedCount++;
                    }
                }

                trans.Commit();
                string user = context.Request.Query["user"].ToString();
                if (string.IsNullOrWhiteSpace(user)) user = "مستخدم";
                await db.AddNotificationEventAsync("SmartSettlement", "سداد ذكي", 0, user);
                return Results.Ok(new { success = true, report = new { updatedCount, notUpdatedCount, unmatchedCount = 0 } });
            } catch (Exception ex) {
                Console.WriteLine("=== SMART SETTLEMENT EXECUTE ERROR ===");
                Console.WriteLine(ex.ToString());
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });


        group.MapGet("/months", async (DatabaseService db) =>
        {
            using var conn = await db.GetOpenConnectionAsync();
            var sql = "SELECT ReturnCode as FileCode, RawData FROM Returns WHERE IsDeleted = 0 UNION SELECT ReturnCode as FileCode, RawData FROM SalaryReturns WHERE IsDeleted = 0";
            var rows = await conn.QueryAsync<dynamic>(sql);


            var monthSet = new HashSet<string>();

            foreach (var row in rows)
            {
                string fc = (string?)row.FileCode ?? "";
                string raw = (string?)row.RawData ?? "";

                // 1. محاولة استخراج الشهر من RawData (حقل "حافز شهر" أو "كود الموازنة")
                if (!string.IsNullOrEmpty(raw))
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(raw);
                        var root = doc.RootElement;

                        // بحث عن حقل "حافز شهر"
                        foreach (var prop in root.EnumerateObject())
                        {
                            if (prop.Name.Contains("حافز") || prop.Name.Contains("شهر") || prop.Name.ToLower().Contains("month"))
                            {
                                var val = prop.Value.ValueKind == JsonValueKind.String ? prop.Value.GetString() : prop.Value.GetRawText();
                                if (!string.IsNullOrEmpty(val) && val.Length >= 2)
                                {
                                    // محاولة توحيد التنسيق إلى MM-YYYY
                                    var match = System.Text.RegularExpressions.Regex.Match(val, @"(\d{1,2})[/-](\d{4})");
                                    if (match.Success) {
                                        var m = match.Groups[1].Value.PadLeft(2, '0');
                                        var y = match.Groups[2].Value;
                                        monthSet.Add($"{m}-{y}");
                                    } else {
                                        monthSet.Add(val.Trim());
                                    }
                                }
                            }
                        }
                    }
                    catch { /* ignore parse errors */ }
                }

                // 2. fallback: استخراج الشهر من FileCode بنمط MM-YYYY أو XXX-MM-YYYY
                if (!string.IsNullOrEmpty(fc))
                {
                    var parts = fc.Trim().Split('-');
                    if (parts.Length >= 2)
                    {
                        // نحاول العثور على السنة (4 أرقام) والشهر
                        string m = "", y = "";
                        if (parts.Length >= 3) {
                             m = parts[parts.Length - 2];
                             y = parts[parts.Length - 1];
                        } else {
                             m = parts[0];
                             y = parts[1];
                        }

                        if (m.Length <= 2 && y.Length == 4 && int.TryParse(m, out _) && int.TryParse(y, out _))
                        {
                            monthSet.Add($"{m.PadLeft(2, '0')}-{y}");
                        }
                    }
                }
            }

            var months = monthSet.OrderByDescending(x => x).ToList();
            return Results.Ok(new { success = true, data = months });
        });

    }

    private static string ExtractRecordMonth(string batchCode, string rawData)
    {
        if (!string.IsNullOrEmpty(batchCode))
        {
            var match = System.Text.RegularExpressions.Regex.Match(batchCode, @"(\d{1,2})-(\d{4})");
            if (match.Success) return $"{match.Groups[1].Value.PadLeft(2, '0')}-{match.Groups[2].Value}";
        }
        if (!string.IsNullOrEmpty(rawData))
        {
            try
            {
                using var doc = JsonDocument.Parse(rawData);
                var root = doc.RootElement;
                foreach (var prop in root.EnumerateObject())
                {
                    if (prop.Name.Contains("حافز") || prop.Name.Contains("شهر"))
                    {
                        var val = prop.Value.ToString();
                        var match = System.Text.RegularExpressions.Regex.Match(val, @"(\d{1,2})[/-](\d{4})");
                        if (match.Success) return $"{match.Groups[1].Value.PadLeft(2, '0')}-{match.Groups[2].Value}";
                    }
                }
            }
            catch { }
        }
        return "";
    }

    private static List<SettlementDBRecord> ProcessRows(IEnumerable<dynamic> rows, string monthFilter, string statusFilter, string source) {
        var list = new List<SettlementDBRecord>();
        foreach(var row in rows) {
            var rawData = (string)row.RawData;
            var record = new SettlementDBRecord {
                Id = row.Id,
                BatchCode = row.ReturnCode ?? "",
                Name = DatabaseService.ExtractName(rawData),
                NationalId = DatabaseService.ExtractNID(rawData),
                Source = source
            };
            
            using var doc = JsonDocument.Parse(rawData);
            var root = doc.RootElement;
            
            string GetJsonVal(params string[] keys) {
                foreach(var k in keys) {
                    if (root.TryGetProperty(k, out var p)) return p.ValueKind == JsonValueKind.String ? (p.GetString() ?? "") : p.GetRawText();
                }
                return "";
            }

            record.CurrentAccount = GetJsonVal("رقم الحساب", "الحساب الحالي", "ACCOUNT_NUMBER", "رقم الحساب السابق");
            record.CurrentBank = GetJsonVal("البنك", "اسم البنك", "البنك السابق");
            record.ModifiedAccount = GetJsonVal("رقم الحساب بعد التعديل");
            record.ModifiedBank = GetJsonVal("البنك بعد التعديل");
            record.ReturnDate = GetJsonVal("تاريخ المرتدات", "تاريخ المرتد", "تاريخ المرتجع");
            record.ReturnApprovalDate = GetJsonVal("تاريخ اعتماد المرتدات", "تاريخ اعتماد المرتد", "تاريخ الاعتماد");
            record.ModDate = GetJsonVal("تاريخ التعديل");
            record.ModApprovalDate = GetJsonVal("تاريخ اعتماد التعديل");
            record.SettlementNo = GetJsonVal("رقم تسوية السداد", "SettlementNo");
            record.SettlementDate = GetJsonVal("تاريخ تسوية السداد", "SettlementDate");
            
            record.Month = ExtractRecordMonth(record.BatchCode ?? "", rawData);
            
            // Criterion Consistency: Alignment with SalaryReturns and Returns modules.
            // Only records with an actual Settlement Number are marked as "Settled".
            bool isSettled = !string.IsNullOrEmpty(record.SettlementNo);
            record.Status = isSettled ? "تم التسوية" : "لم يتم التسوية";

            
            bool monthMatch = string.IsNullOrEmpty(monthFilter) || monthFilter == "all" || record.Month == monthFilter;
            bool statusMatch = statusFilter == "الكل" || record.Status == statusFilter;

            if (monthMatch && statusMatch) {
                list.Add(record);
            }
        }
        return list;
    }
}


public class ExcelRow
{
    public string? BatchCode { get; set; }
    public string? Name { get; set; }
    public string? NationalId { get; set; }
    public string? CurrentAccount { get; set; }
    public string? CurrentBank { get; set; }
    public string? ModifiedAccount { get; set; }
    public string? ModifiedBank { get; set; }
    public string? ReturnDate { get; set; }
    public string? ReturnApprovalDate { get; set; }
    public string? ModDate { get; set; }
    public string? ModApprovalDate { get; set; }
    public string? SettlementNo { get; set; }
    public string? SettlementDate { get; set; }
}

public class SettlementDBRecord
{
    public long Id { get; set; }
    public string? BatchCode { get; set; }
    public string? Month { get; set; }
    public string? Name { get; set; }
    public string? NationalId { get; set; }
    public string? CurrentAccount { get; set; }
    public string? CurrentBank { get; set; }
    public string? ModifiedAccount { get; set; }
    public string? ModifiedBank { get; set; }
    public string? ReturnDate { get; set; }
    public string? ReturnApprovalDate { get; set; }
    public string? ModDate { get; set; }
    public string? ModApprovalDate { get; set; }
    public string? SettlementNo { get; set; }
    public string? SettlementDate { get; set; }
    public string? Status { get; set; }
    public string? Source { get; set; } // "incentive" or "salary"
}

public class MatchResultItem
{
    public ExcelRow? SourceExcelRow { get; set; }
    public List<SettlementDBRecord> Matches { get; set; } = new(); // Incentive Matches
    public List<SettlementDBRecord> SalaryMatches { get; set; } = new(); // Salary Matches
    public bool MatchStatus => Matches.Count > 0 || SalaryMatches.Count > 0;
}

public class ExecutionReport
{
    public int UpdatedCount { get; set; }
    public int NotUpdatedCount { get; set; }
    public int UnmatchedCount { get; set; }
}

public class MatchRequest
{
    public List<ExcelRow> Records { get; set; } = new();
    public MatchFilter Filters { get; set; } = new();
}

public class MatchFilter
{
    public string? Month { get; set; }
    public string? Status { get; set; }
    public string? MatchBy { get; set; }
    public string? DataType { get; set; }
}

public class ExecuteRequest
{
    public List<ExecuteUpdateItem> Updates { get; set; } = new();
}

public class ExecuteUpdateItem
{
    public long DbRecordId { get; set; }
    public string? Source { get; set; }
    public string? BatchCode { get; set; }
    public string? NewAccount { get; set; }
    public string? NewBank { get; set; }
    public string? ReturnDate { get; set; }
    public string? ReturnApprovalDate { get; set; }
    public string? ModDate { get; set; }
    public string? ModApprovalDate { get; set; }
    public string? SettlementNo { get; set; }
    public string? SettlementDate { get; set; }
}

