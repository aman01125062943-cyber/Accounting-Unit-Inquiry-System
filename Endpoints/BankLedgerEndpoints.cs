using Dapper;
using Microsoft.AspNetCore.Mvc;
using HKServer.Services;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace HKServer.Endpoints;

public static class BankLedgerEndpoints
{
    private static int GetActorUserId(HttpContext context)
    {
        return SecurityHardening.GetActorUserId(context);
    }

    public static void MapBankLedgerEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/bank-ledger");

        // 1. GET /api/bank-ledger/{type}/data?year=2026&month=03
        group.MapGet("/{type}/data", async (string type, [FromQuery] string? year, [FromQuery] string? month, DatabaseService db) =>
        {
            try
            {
                using var conn = await db.GetOpenConnectionAsync();
                string tableName = (type.ToLower() == "salary" || type.ToLower() == "مرتبات") ? "SalaryReturns" : "Returns";

                string sql = $@"SELECT Id, ReturnCode, [رقم تسوية السداد] AS SettlementNo, UploadDate, RawData 
                                FROM {tableName} 
                                WHERE IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0";

                var rows = await conn.QueryAsync<dynamic>(sql);

                // Data structures for (منه) and (له)
                var منهOrdersMap = new Dictionary<string, BankLedgerRow>(StringComparer.OrdinalIgnoreCase);
                var لهOrdersMap = new Dictionary<string, BankLedgerRow>(StringComparer.OrdinalIgnoreCase);

                var availableYears = new HashSet<string>();
                var availableMonths = new HashSet<string>();

                string reqYear = (year ?? "").Trim();
                if (reqYear == "all") reqYear = "";

                string reqMonth = (month ?? "").Trim();
                if (reqMonth == "all") reqMonth = "";

                foreach (var row in rows)
                {
                    string rawData = row.RawData?.ToString() ?? "{}";
                    string returnCode = ((string?)row.ReturnCode ?? "").Trim();
                    string settlementNo = ((string?)row.SettlementNo ?? "").Trim();
                    string uploadDate = row.UploadDate?.ToString() ?? "";

                    using var doc = JsonDocument.Parse(rawData);
                    var root = doc.RootElement;

                    // Extract Amount
                    double amount = 0;
                    string amtStr = GetProp(root, "قيمة العملية", "صافي المبلغ", "المبلغ", "الإجمالي", "Amount");
                    if (!string.IsNullOrEmpty(amtStr))
                    {
                        amtStr = amtStr.Replace(",", "").Trim();
                        double.TryParse(amtStr, out amount);
                    }

                    // Extract Status/Type (Return vs Reject)
                    string status = GetProp(root, "حالة الحركة", "الحالة", "Status", "السبب", "سبب المرتد");
                    bool isReject = status.Contains("Reject", StringComparison.OrdinalIgnoreCase) || status.Contains("ريجكت", StringComparison.OrdinalIgnoreCase);

                    // Extract Specific Dates for (منه) and (له)
                    string minhuDateRaw = GetProp(root, "تاريخ اعتماد المرتد", "تاريخ اعتماد المرتدات", "تاريخ الاعتماد المرتد", "تاريخ المرتدات", "تاريخ المرتد", "returnApprovalDate", "returnDate", "تاريخ الرفع", "uploadDate", "Date");
                    if (string.IsNullOrEmpty(minhuDateRaw)) minhuDateRaw = uploadDate;
                    string minhuFormattedDate = FormatOnlyDate(minhuDateRaw);

                    string lahuDateRaw = GetProp(root, "تاريخ اعتماد التعديل", "تاريخ الاعتماد التعديل", "تاريخ الاعتماد", "approvalDate", "تاريخ تعديل السداد", "تاريخ التسوية", "settlementDate", "uploadDate", "Date");
                    if (string.IsNullOrEmpty(lahuDateRaw)) lahuDateRaw = minhuDateRaw;
                    string lahuFormattedDate = FormatOnlyDate(lahuDateRaw);

                    // Extract Year and Month (using return date or upload date)
                    var (recYear, recMonthNum) = ParseYearAndMonth(returnCode, rawData, minhuDateRaw);

                    if (!string.IsNullOrEmpty(recYear)) availableYears.Add(recYear);
                    if (!string.IsNullOrEmpty(recMonthNum)) availableMonths.Add(recMonthNum);

                    // Apply Year Filter
                    if (!string.IsNullOrEmpty(reqYear) && recYear != reqYear) continue;

                    // Apply Month Filter
                    if (!string.IsNullOrEmpty(reqMonth))
                    {
                        string normalizedReq = reqMonth.PadLeft(2, '0');
                        if (recMonthNum != normalizedReq && !recMonthNum.EndsWith(reqMonth)) continue;
                    }

                    // 1. Process (منه) - Debit / Incoming returns by Payment Order Code (تاريخ اعتماد المرتد)
                    if (!string.IsNullOrEmpty(returnCode))
                    {
                        if (!منهOrdersMap.TryGetValue(returnCode, out var minhuRow))
                        {
                            minhuRow = new BankLedgerRow
                            {
                                PaymentOrderNo = returnCode,
                                Date = minhuFormattedDate,
                                Note = ExtractCodeNote(returnCode)
                            };
                            منهOrdersMap[returnCode] = minhuRow;
                        }

                        if (isReject) minhuRow.RejectAmount += amount;
                        else minhuRow.ReturnAmount += amount;
                    }

                    // 2. Process (له) - Credit / Re-issued settlements by Settlement Number (تاريخ اعتماد التعديل)
                    if (!string.IsNullOrEmpty(settlementNo))
                    {
                        if (!لهOrdersMap.TryGetValue(settlementNo, out var lahuRow))
                        {
                            lahuRow = new BankLedgerRow
                            {
                                PaymentOrderNo = settlementNo,
                                Date = lahuFormattedDate,
                                Note = ExtractCodeNote(settlementNo)
                            };
                            لهOrdersMap[settlementNo] = lahuRow;
                        }

                        if (isReject) lahuRow.RejectAmount += amount;
                        else lahuRow.ReturnAmount += amount;
                    }
                }

                // Convert maps to ordered lists
                var منهList = منهOrdersMap.Values.OrderBy(x => x.PaymentOrderNo).ToList();
                var لهList = لهOrdersMap.Values.OrderBy(x => x.PaymentOrderNo).ToList();

                // Compute Serials and Totals
                int seq1 = 1;
                double minhuTotalReturn = 0, minhuTotalReject = 0, minhuGrandTotal = 0;
                foreach (var item in منهList)
                {
                    item.Ser = seq1++;
                    item.TotalAmount = item.ReturnAmount + item.RejectAmount;
                    minhuTotalReturn += item.ReturnAmount;
                    minhuTotalReject += item.RejectAmount;
                    minhuGrandTotal += item.TotalAmount;
                }

                int seq2 = 1;
                double lahuTotalReturn = 0, lahuTotalReject = 0, lahuGrandTotal = 0;
                double runningBalance = 0;
                foreach (var item in لهList)
                {
                    item.Ser = seq2++;
                    item.TotalAmount = item.ReturnAmount + item.RejectAmount;
                    lahuTotalReturn += item.ReturnAmount;
                    lahuTotalReject += item.RejectAmount;
                    lahuGrandTotal += item.TotalAmount;

                    runningBalance = minhuGrandTotal - lahuGrandTotal;
                    item.Balance = runningBalance;
                }

                int minhuReturnCount = منهList.Count(x => x.ReturnAmount > 0);
                int minhuRejectCount = منهList.Count(x => x.RejectAmount > 0);
                int minhuTotalCount = منهList.Count;

                int lahuReturnCount = لهList.Count(x => x.ReturnAmount > 0);
                int lahuRejectCount = لهList.Count(x => x.RejectAmount > 0);
                int lahuTotalCount = لهList.Count;

                return Results.Ok(new
                {
                    success = true,
                    type = type,
                    year = reqYear,
                    month = reqMonth,
                    availableYears = availableYears.OrderByDescending(x => x).ToList(),
                    availableMonths = availableMonths.OrderBy(x => x).ToList(),
                    minhu = new
                    {
                        rows = منهList,
                        totalReturn = minhuTotalReturn,
                        totalReject = minhuTotalReject,
                        grandTotal = minhuGrandTotal,
                        returnCount = minhuReturnCount,
                        rejectCount = minhuRejectCount,
                        totalCount = minhuTotalCount
                    },
                    lahu = new
                    {
                        rows = لهList,
                        totalReturn = lahuTotalReturn,
                        totalReject = lahuTotalReject,
                        grandTotal = lahuGrandTotal,
                        finalBalance = minhuGrandTotal - lahuGrandTotal,
                        returnCount = lahuReturnCount,
                        rejectCount = lahuRejectCount,
                        totalCount = lahuTotalCount
                    }
                });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
            }
        });
    }

    private static (string Year, string Month) ParseYearAndMonth(string returnCode, string rawData, string dateStr)
    {
        string year = "";
        string month = "";

        // 1. Try from ReturnCode (e.g. Army-c-463-10-03-2026 or Army-8001012600646-02-2026)
        if (!string.IsNullOrEmpty(returnCode))
        {
            var match = Regex.Match(returnCode, @"-(\d{2})-(\d{4})$");
            if (match.Success)
            {
                month = match.Groups[1].Value;
                year = match.Groups[2].Value;
                return (year, month);
            }

            var match2 = Regex.Match(returnCode, @"-c-463-\d+-(\d{2})-(\d{4})");
            if (match2.Success)
            {
                month = match2.Groups[1].Value;
                year = match2.Groups[2].Value;
                return (year, month);
            }
        }

        // 2. Try from Date string (e.g. 2026-03-15 or 15/03/2026)
        if (!string.IsNullOrEmpty(dateStr))
        {
            var matchDate1 = Regex.Match(dateStr, @"^(\d{4})[-/](\d{1,2})");
            if (matchDate1.Success)
            {
                year = matchDate1.Groups[1].Value;
                month = matchDate1.Groups[2].Value.PadLeft(2, '0');
                return (year, month);
            }
            var matchDate2 = Regex.Match(dateStr, @"\d{1,2}[-/](\d{1,2})[-/](\d{4})");
            if (matchDate2.Success)
            {
                month = matchDate2.Groups[1].Value.PadLeft(2, '0');
                year = matchDate2.Groups[2].Value;
                return (year, month);
            }
        }

        // Default year fallback
        if (string.IsNullOrEmpty(year)) year = "2026";
        return (year, month);
    }

    private static string FormatOnlyDate(string dateStr)
    {
        if (string.IsNullOrWhiteSpace(dateStr)) return "-";
        dateStr = dateStr.Trim();

        // If string contains ISO timestamp e.g. 2026-07-24T19:26:12
        if (dateStr.Contains('T'))
        {
            dateStr = dateStr.Split('T')[0];
        }

        // Match yyyy-MM-dd or yyyy/MM/dd
        var match1 = Regex.Match(dateStr, @"\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b");
        if (match1.Success)
        {
            var parts = match1.Groups[1].Value.Split(new[] { '-', '/' });
            return $"{parts[0]}-{parts[1].PadLeft(2, '0')}-{parts[2].PadLeft(2, '0')}";
        }

        // Match dd-MM-yyyy or dd/MM/yyyy
        var match2 = Regex.Match(dateStr, @"\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b");
        if (match2.Success)
        {
            var parts = match2.Groups[1].Value.Split(new[] { '-', '/' });
            return $"{parts[2]}-{parts[1].PadLeft(2, '0')}-{parts[0].PadLeft(2, '0')}";
        }

        return dateStr;
    }

    private static string GetProp(JsonElement root, params string[] keys)
    {
        foreach (var k in keys)
        {
            if (root.TryGetProperty(k, out JsonElement p))
            {
                return p.ValueKind == JsonValueKind.String ? (p.GetString() ?? "") : p.GetRawText();
            }
        }
        return "";
    }

    private static string ExtractCodeNote(string code)
    {
        if (code.Contains("463")) return "مرتد (كود 463)";
        if (code.Contains("46")) return "مرتد (كود 46)";
        if (code.Contains("دائنة")) return "حساب الدائنة";
        if (code.Contains("وفر")) return "حساب الوفر";
        return "";
    }
}

public class BankLedgerRow
{
    public int Ser { get; set; }
    public string PaymentOrderNo { get; set; } = "";
    public string Date { get; set; } = "";
    public string Note { get; set; } = "";
    public double ReturnAmount { get; set; }
    public double RejectAmount { get; set; }
    public double TotalAmount { get; set; }
    public double Balance { get; set; }
}
