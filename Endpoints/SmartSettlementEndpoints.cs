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
                string fileCodeFilter = request.Filters?.FileCode ?? "";
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
                    dbIncentives = ProcessRows(incRows, monthFilter, fileCodeFilter, statusFilter, "incentive");
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
                    dbSalaries = ProcessRows(salRows, monthFilter, fileCodeFilter, statusFilter, "salary");
                }

                foreach(var excelRow in request.Records) {
                    var item = new MatchResultItem { SourceExcelRow = excelRow };
                    
                    // Fix: Use CleanArabic on matchBy to correctly identify "الاسم" or "الاســــم" selection
                    if (DatabaseService.CleanArabic(matchBy ?? "") == "الاسم") {
                        string cleanExcelName = DatabaseService.CleanArabic(excelRow.Name?.ToString() ?? "");
                        if (!string.IsNullOrEmpty(cleanExcelName)) {
                            // Priority: Strict Exact Match
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
                string m = ExtractRecordMonth(fc, raw);
                if (!string.IsNullOrEmpty(m)) monthSet.Add(m);
            }

            var months = monthSet.OrderByDescending(x => x).ToList();
            return Results.Ok(new { success = true, data = months });
        });

    }
    
    private static string ExtractRecordMonth(string batchCode, string rawData) {
        if (!string.IsNullOrEmpty(batchCode))
        {
            // Case 1: MM-YYYY (Lenient)
            var match = System.Text.RegularExpressions.Regex.Match(batchCode, @"(?:^|[ \-/_\s])(0?[1-9]|1[0-2])([ \-/])(20\d{2})");
            if (match.Success) return $"{match.Groups[1].Value.PadLeft(2, '0')}-{match.Groups[3].Value}";
            
            // Case 2: YYYY-MM (Lenient)
            var matchInv = System.Text.RegularExpressions.Regex.Match(batchCode, @"(?:^|[ \-/_\s])(20\d{2})([ \-/])(0?[1-9]|1[0-2])");
            if (matchInv.Success) return $"{matchInv.Groups[3].Value.PadLeft(2, '0')}-{matchInv.Groups[1].Value}";
        }
        if (!string.IsNullOrEmpty(rawData))
        {
            try
            {
                using var doc = JsonDocument.Parse(rawData);
                var root = doc.RootElement;

                // 1. Try explicit month keys first
                string[] monthKeys = { "الشهر", "شهر", "حافز شهر", "الدفعة", "Month", "MonthCode" };
                foreach (var k in monthKeys) {
                    if (root.TryGetProperty(k, out var p)) {
                        var val = p.ToString();
                        var match = System.Text.RegularExpressions.Regex.Match(val, @"(\d{1,2})[/-](\d{4})");
                        if (match.Success) return $"{match.Groups[1].Value.PadLeft(2, '0')}-{match.Groups[2].Value}";
                    }
                }

                // 2. Try the original File Code from RawData
                string[] fileCodeKeys = { "كود الملف", "كـود الملف", "كــود الملف", "كـــود الملف", "Batch ID", "Code", "FileCode" };
                foreach (var k in fileCodeKeys) {
                    if (root.TryGetProperty(k, out var p)) {
                        var val = p.ToString();
                        var match = System.Text.RegularExpressions.Regex.Match(val, @"(\d{1,2})[/-](\d{4})");
                        if (match.Success) return $"{match.Groups[1].Value.PadLeft(2, '0')}-{match.Groups[2].Value}";
                    }
                }

                // 3. Fallback: Generic scan
                foreach (var prop in root.EnumerateObject())
                {
                    if (prop.Name.Contains("حافز") || prop.Name.Contains("شهر") || prop.Name.Contains("تاريخ"))
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

    private static List<SettlementDBRecord> ProcessRows(IEnumerable<dynamic> rows, string monthFilter, string fileCodeFilter, string statusFilter, string source) {
        var list = new List<SettlementDBRecord>();
        foreach(var row in rows) {
            var rawData = (string)row.RawData;
            var record = new SettlementDBRecord {
                Id = row.Id,
                BatchCode = DatabaseService.ExtractFileCodeDirect(rawData),
                Name = DatabaseService.ExtractName(rawData),
                NationalId = DatabaseService.ExtractNID(rawData),
                Source = source
            };

            // Fallback if direct extraction fails
            if (string.IsNullOrEmpty(record.BatchCode)) record.BatchCode = row.ReturnCode ?? "";

            
            using var doc = JsonDocument.Parse(rawData);
            var root = doc.RootElement;

            var propMap = new Dictionary<string, JsonElement>();
            foreach(var p in root.EnumerateObject()) {
                var ck = DatabaseService.CleanArabic(p.Name);
                if (!propMap.ContainsKey(ck)) propMap[ck] = p.Value;
            }
            
            string GetJsonVal(params string[] keys) {
                foreach(var k in keys) {
                    if (root.TryGetProperty(k, out var p)) 
                        return p.ValueKind == JsonValueKind.String ? (p.GetString() ?? "") : p.GetRawText();
                    
                    var ck = DatabaseService.CleanArabic(k);
                    if (propMap.TryGetValue(ck, out var cp))
                        return cp.ValueKind == JsonValueKind.String ? (cp.GetString() ?? "") : cp.GetRawText();
                }
                return "";
            }

            record.CurrentAccount = GetJsonVal("رقم الحساب", "الحساب الحالي", "ACCOUNT_NUMBER", "رقم الحساب السابق", "حساب", "رقم_الحساب", "Account");
            record.CurrentBank = GetJsonVal("البنك", "اسم البنك", "البنك السابق", "بنك", "Bank", "بانك", "اسم_البنك");
            record.ModifiedAccount = GetJsonVal("رقم الحساب بعد التعديل", "رقم الحساب الجديد", "الحساب الجديد", "NewAccount", "رقم_الحساب_الجديد");
            record.ModifiedBank = GetJsonVal("البنك بعد التعديل", "البنك الجديد", "اسم البنك الجديد", "NewBank", "اسم_البنك_الجديد");
            record.ModifiedBranchCode = GetJsonVal("كود الفرع بعد التعديل", "كود الفرع", "BranchCode", "ModifiedBranchCode");
            
            record.Amount = 0;
            var amountVal = GetJsonVal("قيمة العملية", "صافي المبلغ", "المبلغ", "الإجمالي", "Amount");
            if (!string.IsNullOrEmpty(amountVal)) {
                amountVal = amountVal.Replace(",", "").Trim();
                if (double.TryParse(amountVal, out var parsedAmt)) record.Amount = parsedAmt;
            }

            record.Reason = GetJsonVal("السبب", "سبب المرتد", "Reason");
            record.OriginalStatus = GetJsonVal("الحالة", "حالة الحركة", "Status");
            object uDateVal = null;
            try { uDateVal = row.UploadDate; } catch {}
            record.UploadDate = (uDateVal != null ? uDateVal.ToString() : null) ?? GetJsonVal("تاريخ الرفع", "تاريخ الملف", "UploadDate");
            record.AccrualSettlementNo = GetJsonVal("رقم تسوية التعلية", "رقم تسوية الاضافة", "AccrualSettlementNo");

            record.ReturnDate = GetJsonVal("تاريخ المرتد / تاريخ التعلية", "تاريخ المرتدات", "تاريخ المرتد", "تاريخ المرتجع", "تاريخ الارتداد", "تاريخ_المرتد", "ReturnDate");
            record.ReturnApprovalDate = GetJsonVal("تاريخ اعتماد المرتدات", "تاريخ اعتماد المرتد", "تاريخ الاعتماد", "تاريخ_الاعتماد", "ApprovalDate");
            record.ModDate = GetJsonVal("تاريخ التعديل", "تاريخ_التعديل", "ModDate");
            record.ModApprovalDate = GetJsonVal("تاريخ اعتماد التعديل", "تاريخ_اعتماد_التعديل", "ModApprovalDate");
            record.SettlementNo = GetJsonVal("رقم تسوية السداد", "رقم التسوية", "رقم_التسوية", "SettlementNo", "Settlement Number");
            record.SettlementDate = GetJsonVal("تاريخ تسوية السداد", "تاريخ التسوية", "تاريخ_التسوية", "SettlementDate", "Settlement Date");

            
            record.Month = GetJsonVal("الشهر", "شهر", "حافز شهر", "الدفعة", "Month", "MonthCode");
            
            // Fallback to calculated month if direct field is empty
            if (string.IsNullOrEmpty(record.Month)) {
                record.Month = ExtractRecordMonth(record.BatchCode ?? "", rawData);
            }

            
            // Criterion Consistency: Alignment with SalaryReturns and Returns modules.
            // Only records with an actual Settlement Number are marked as "Settled".
            bool isSettled = !string.IsNullOrEmpty(record.SettlementNo);
            record.Status = isSettled ? "تم التسوية" : "لم يتم التسوية";

            
            bool monthMatch = string.IsNullOrEmpty(monthFilter) || monthFilter == "all" || record.Month == monthFilter;
            bool fileCodeMatch = string.IsNullOrEmpty(fileCodeFilter) || record.BatchCode == fileCodeFilter;
            bool statusMatch = statusFilter == "الكل" || record.Status == statusFilter;

            if (monthMatch && fileCodeMatch && statusMatch) {
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
    public string? ModifiedBranchCode { get; set; }
    public double? Amount { get; set; }
    public string? Reason { get; set; }
    public string? OriginalStatus { get; set; }
    public string? UploadDate { get; set; }
    public string? AccrualSettlementNo { get; set; }
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
    public string? FileCode { get; set; }
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

