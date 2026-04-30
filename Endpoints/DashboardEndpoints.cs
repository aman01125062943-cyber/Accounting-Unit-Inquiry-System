using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using HKServer.Services;

namespace HKServer.Endpoints;

public static class DashboardEndpoints
{
    private sealed record DashboardFilters(string? FromDate, string? ToDate, string? Month, string? Source, string? Status, string? Metric);

    private sealed class DashboardRow
    {
        public long Id { get; set; }
        public string Source { get; set; } = "";
        public string SourceLabel { get; set; } = "";
        public string ReturnCode { get; set; } = "";
        public string Month { get; set; } = "فارغ";
        public string Status { get; set; } = "";
        public bool IsReturned { get; set; }
        public bool IsRejected { get; set; }
        public bool IsSettled { get; set; }
        public bool IsAccrued { get; set; }
        public double Amount { get; set; }
        public string UploadDate { get; set; } = "";
        public DateTime? Date { get; set; }
        public Dictionary<string, object?> Data { get; set; } = new();
    }

    public static void MapDashboardEndpoints(this WebApplication app)
    {
        app.MapGet("/api/dashboard/summary", async (HttpRequest request, DatabaseService db) =>
        {
            var filters = ReadFilters(request);
            var rows = ApplyFilters(await LoadRows(db, includeArchived: false), filters).ToList();
            var archiveCount = await GetArchiveCount(db, filters);
            return Results.Ok(new
            {
                filters,
                summary = BuildSummary(rows, archiveCount)
            });
        });

        app.MapGet("/api/dashboard/charts", async (HttpRequest request, DatabaseService db) =>
        {
            var filters = ReadFilters(request);
            var rows = ApplyFilters(await LoadRows(db, includeArchived: false), filters).ToList();
            var archiveBySource = await GetArchiveBySource(db, filters);
            return Results.Ok(new
            {
                filters,
                charts = BuildCharts(rows, archiveBySource)
            });
        });

        app.MapGet("/api/dashboard/report", async (HttpRequest request, DatabaseService db) =>
        {
            var filters = ReadFilters(request);
            var metric = Normalize(filters.Metric);

            if (metric is "archives" or "archive" or "adabir")
            {
                var archiveRows = await LoadArchiveReport(db, filters);
                return Results.Ok(new
                {
                    title = "تقرير الأضابير",
                    totalCount = archiveRows.Count,
                    totalAmount = 0,
                    dateRange = BuildDateRange(filters),
                    records = archiveRows
                });
            }

            var rows = ApplyMetric(ApplyFilters(await LoadRows(db, includeArchived: false), filters), metric).ToList();
            return Results.Ok(new
            {
                title = GetReportTitle(metric),
                totalCount = rows.Count,
                totalAmount = rows.Sum(r => r.Amount),
                dateRange = BuildDateRange(filters),
                records = rows.Select(ToReportRecord).ToList()
            });
        });
    }

    private static DashboardFilters ReadFilters(HttpRequest request) => new(
        request.Query["fromDate"].FirstOrDefault(),
        request.Query["toDate"].FirstOrDefault(),
        request.Query["month"].FirstOrDefault(),
        request.Query["source"].FirstOrDefault(),
        request.Query["status"].FirstOrDefault(),
        request.Query["metric"].FirstOrDefault()
    );

    private static async Task<List<DashboardRow>> LoadRows(DatabaseService db, bool includeArchived)
    {
        using var conn = await db.GetOpenConnectionAsync();
        var archiveWhere = includeArchived ? "" : " AND COALESCE(IsArchived, 0) = 0";
        var returns = await conn.QueryAsync<dynamic>($@"
            SELECT Id, RawData, ReturnCode, UploadDate, [رقم تسوية التعلية] AS AccrualNo, [رقم تسوية السداد] AS PaymentNo
            FROM Returns
            WHERE COALESCE(IsDeleted, 0) = 0{archiveWhere}");
        var salaries = await conn.QueryAsync<dynamic>($@"
            SELECT Id, RawData, ReturnCode, UploadDate, [رقم تسوية التعلية] AS AccrualNo, [رقم تسوية السداد] AS PaymentNo
            FROM SalaryReturns
            WHERE COALESCE(IsDeleted, 0) = 0{archiveWhere}");

        var rows = new List<DashboardRow>();
        rows.AddRange(returns.Select<dynamic, DashboardRow>(r => MapRow(r, "incentive", "الحوافز")));
        rows.AddRange(salaries.Select<dynamic, DashboardRow>(r => MapRow(r, "salary", "المرتبات")));
        return rows;
    }

    private static DashboardRow MapRow(dynamic row, string source, string sourceLabel)
    {
        var dict = ParseRaw((string?)row.RawData);
        var returnCode = FirstText(dict, "كود الملف", "كـــود الملف", "كُـــود المـلف", "كود_الملف", "FileCode", "ReturnCode");
        if (string.IsNullOrWhiteSpace(returnCode)) returnCode = (string?)row.ReturnCode ?? "";

        var uploadDate = FirstText(dict, "تاريخ الرفع", "UploadDate", "CreatedAt");
        if (string.IsNullOrWhiteSpace(uploadDate)) uploadDate = (string?)row.UploadDate ?? "";

        var paymentNo = FirstText(dict, "رقم تسوية السداد", "PaymentSettlementNo", "SettlementNo");
        if (string.IsNullOrWhiteSpace(paymentNo)) paymentNo = (string?)row.PaymentNo ?? "";

        var accrualNo = FirstText(dict, "رقم تسوية التعلية", "InquirySettlementNo", "AccrualNo");
        if (string.IsNullOrWhiteSpace(accrualNo)) accrualNo = (string?)row.AccrualNo ?? "";

        var statusText = FirstText(dict, "الحالة", "حالة المرتد", "ReturnStatus", "Status", "السبب");
        var amount = ParseAmount(FirstText(dict, "قيمة العملية", "المبلغ", "مبلغ", "صافي المبلغ", "Amount", "ProcessValue"));
        var date = ParseDate(uploadDate);
        var normalizedStatus = Normalize(statusText + " " + JsonSerializer.Serialize(dict));
        var isRejected = normalizedStatus.Contains("rejected") || normalizedStatus.Contains("reject") || normalizedStatus.Contains("مرفوض") || normalizedStatus.Contains("رفض");
        var isReturned = !isRejected && (normalizedStatus.Contains("returned") || normalizedStatus.Contains("return") || normalizedStatus.Contains("مرتد") || normalizedStatus.Contains("ارجاع") || normalizedStatus.Contains("إرجاع"));

        dict["Id"] = (long)row.Id;
        dict["المصدر"] = sourceLabel;
        dict["الشهر"] = ExtractMonth(returnCode);
        dict["حالة التسوية"] = string.IsNullOrWhiteSpace(paymentNo) ? "لم يتم التسوية" : "تم التسوية";

        return new DashboardRow
        {
            Id = (long)row.Id,
            Source = source,
            SourceLabel = sourceLabel,
            ReturnCode = returnCode,
            Month = ExtractMonth(returnCode),
            Status = isRejected ? "Rejected" : (isReturned ? "Returned" : statusText),
            IsReturned = isReturned,
            IsRejected = isRejected,
            IsSettled = !string.IsNullOrWhiteSpace(paymentNo),
            IsAccrued = !string.IsNullOrWhiteSpace(accrualNo),
            Amount = amount,
            UploadDate = uploadDate,
            Date = date,
            Data = dict
        };
    }

    private static IEnumerable<DashboardRow> ApplyFilters(IEnumerable<DashboardRow> rows, DashboardFilters filters)
    {
        var source = Normalize(filters.Source);
        var status = Normalize(filters.Status);
        var month = (filters.Month ?? "").Trim();
        var from = ParseDate(filters.FromDate);
        var to = ParseDate(filters.ToDate)?.Date.AddDays(1).AddTicks(-1);

        return rows.Where(r =>
            (string.IsNullOrWhiteSpace(source) || source == "all" || source == "الكل" || r.Source == source) &&
            (string.IsNullOrWhiteSpace(month) || month == "all" || r.Month == month) &&
            (!from.HasValue || (r.Date.HasValue && r.Date.Value >= from.Value.Date)) &&
            (!to.HasValue || (r.Date.HasValue && r.Date.Value <= to.Value)) &&
            MatchesStatus(r, status)
        );
    }

    private static bool MatchesStatus(DashboardRow row, string status) => status switch
    {
        "" or "all" or "الكل" => true,
        "returned" => row.IsReturned,
        "rejected" => row.IsRejected,
        "تم التسوية" or "تمت التسوية" or "settled" => row.IsSettled,
        "لم يتم التسوية" or "تحت التسوية" or "unsettled" or "pending" => !row.IsSettled,
        _ => Normalize(row.Status) == status
    };

    private static IEnumerable<DashboardRow> ApplyMetric(IEnumerable<DashboardRow> rows, string metric) => metric switch
    {
        "salary" => rows.Where(r => r.Source == "salary"),
        "incentive" => rows.Where(r => r.Source == "incentive"),
        "returned" => rows.Where(r => r.IsReturned),
        "rejected" => rows.Where(r => r.IsRejected),
        "settled" => rows.Where(r => r.IsSettled),
        "unsettled" or "pending" => rows.Where(r => !r.IsSettled),
        "paid" => rows.Where(r => r.IsSettled),
        "accrued" => rows.Where(r => r.IsAccrued),
        "today" => rows.Where(r => r.Date?.Date == DateTime.Today),
        "month" or "thismonth" => rows.Where(r => r.Date?.Year == DateTime.Today.Year && r.Date?.Month == DateTime.Today.Month),
        _ => rows
    };

    private static object BuildSummary(List<DashboardRow> rows, int archiveCount) => new
    {
        salaryCount = rows.Count(r => r.Source == "salary"),
        incentiveCount = rows.Count(r => r.Source == "incentive"),
        totalAmount = rows.Sum(r => r.Amount),
        paidAmount = rows.Where(r => r.IsSettled).Sum(r => r.Amount),
        accruedAmount = rows.Where(r => r.IsAccrued).Sum(r => r.Amount),
        pendingAmount = rows.Where(r => !r.IsSettled).Sum(r => r.Amount),
        settledCount = rows.Count(r => r.IsSettled),
        pendingCount = rows.Count(r => !r.IsSettled),
        returnedCount = rows.Count(r => r.IsReturned),
        rejectedCount = rows.Count(r => r.IsRejected),
        archiveCount,
        todayCount = rows.Count(r => r.Date?.Date == DateTime.Today),
        thisMonthCount = rows.Count(r => r.Date?.Year == DateTime.Today.Year && r.Date?.Month == DateTime.Today.Month),
        totalCount = rows.Count
    };

    private static object BuildCharts(List<DashboardRow> rows, List<object> archiveBySource)
    {
        var byMonth = rows
            .Where(r => r.Month != "فارغ")
            .GroupBy(r => r.Month)
            .OrderBy(g => MonthSortKey(g.Key))
            .Select(g => new
            {
                month = g.Key,
                salary = g.Count(r => r.Source == "salary"),
                incentive = g.Count(r => r.Source == "incentive"),
                amount = g.Sum(r => r.Amount)
            }).ToList();

        return new
        {
            returnedRejected = new[]
            {
                new { label = "Returned", value = rows.Count(r => r.IsReturned), metric = "returned" },
                new { label = "Rejected", value = rows.Count(r => r.IsRejected), metric = "rejected" }
            },
            sourceByMonth = byMonth,
            amountByMonth = byMonth.Select(x => new { x.month, value = x.amount, metric = "amount" }),
            settlement = new[]
            {
                new { label = "المسدد", value = rows.Count(r => r.IsSettled), amount = rows.Where(r => r.IsSettled).Sum(r => r.Amount), metric = "paid" },
                new { label = "المعلّى", value = rows.Count(r => r.IsAccrued), amount = rows.Where(r => r.IsAccrued).Sum(r => r.Amount), metric = "accrued" },
                new { label = "تحت التسوية", value = rows.Count(r => !r.IsSettled), amount = rows.Where(r => !r.IsSettled).Sum(r => r.Amount), metric = "unsettled" }
            },
            archives = archiveBySource
        };
    }

    private static async Task<int> GetArchiveCount(DatabaseService db, DashboardFilters filters)
    {
        return (await LoadArchiveReport(db, filters)).Count;
    }

    private static async Task<List<object>> GetArchiveBySource(DatabaseService db, DashboardFilters filters)
    {
        var archives = await LoadArchiveReport(db, filters);
        return archives
            .GroupBy(r => r.TryGetValue("المصدر", out var source) ? source?.ToString() ?? "غير محدد" : "غير محدد")
            .Select(g => (object)new { label = g.Key, value = g.Count(), metric = "archives", source = g.Key })
            .ToList();
    }

    private static async Task<List<Dictionary<string, object?>>> LoadArchiveReport(DatabaseService db, DashboardFilters filters)
    {
        using var conn = await db.GetOpenConnectionAsync();
        var rows = new List<Dictionary<string, object?>>();
        var source = Normalize(filters.Source);
        if (source is "" or "all" or "الكل" or "incentive")
        {
            var archives = await conn.QueryAsync<dynamic>("SELECT Id, Date, Filename, RecordCount, Size FROM Archives ORDER BY Id DESC LIMIT 1000");
            rows.AddRange(archives.Select(a => new Dictionary<string, object?> { ["Id"] = a.Id, ["المصدر"] = "الحوافز", ["التاريخ"] = a.Date, ["الملف"] = a.Filename, ["عدد السجلات"] = a.RecordCount, ["الحجم"] = a.Size }));
        }
        if (source is "" or "all" or "الكل" or "salary")
        {
            var archives = await conn.QueryAsync<dynamic>("SELECT Id, Date, Filename, RecordCount, Size FROM SalaryArchives ORDER BY Id DESC LIMIT 1000");
            rows.AddRange(archives.Select(a => new Dictionary<string, object?> { ["Id"] = a.Id, ["المصدر"] = "المرتبات", ["التاريخ"] = a.Date, ["الملف"] = a.Filename, ["عدد السجلات"] = a.RecordCount, ["الحجم"] = a.Size }));
        }
        var from = ParseDate(filters.FromDate);
        var to = ParseDate(filters.ToDate)?.Date.AddDays(1).AddTicks(-1);
        return rows.Where(r =>
        {
            var dateText = r.TryGetValue("التاريخ", out var value) ? value?.ToString() : "";
            var date = ParseDate(dateText);
            return (!from.HasValue || (date.HasValue && date.Value >= from.Value.Date)) &&
                   (!to.HasValue || (date.HasValue && date.Value <= to.Value));
        }).ToList();
    }

    private static Dictionary<string, object?> ToReportRecord(DashboardRow row)
    {
        var data = new Dictionary<string, object?>(row.Data)
        {
            ["Id"] = row.Id,
            ["المصدر"] = row.SourceLabel,
            ["كود الملف"] = row.ReturnCode,
            ["الشهر"] = row.Month,
            ["المبلغ"] = row.Amount,
            ["الحالة"] = row.Status,
            ["حالة التسوية"] = row.IsSettled ? "تم التسوية" : "لم يتم التسوية",
            ["تاريخ الرفع"] = row.UploadDate
        };
        return data;
    }

    private static Dictionary<string, object?> ParseRaw(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new();
        try
        {
            using var doc = JsonDocument.Parse(raw);
            return doc.RootElement.EnumerateObject().ToDictionary(p => p.Name, p => JsonValue(p.Value));
        }
        catch { return new(); }
    }

    private static object? JsonValue(JsonElement el) => el.ValueKind switch
    {
        JsonValueKind.Number => el.TryGetDouble(out var d) ? d : el.ToString(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Null => null,
        _ => el.ToString()
    };

    private static string FirstText(Dictionary<string, object?> data, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (data.TryGetValue(key, out var value) && value is not null && !string.IsNullOrWhiteSpace(value.ToString()))
                return value.ToString()!.Trim();
        }
        return "";
    }

    private static double ParseAmount(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return 0;
        var cleaned = Regex.Replace(value, @"[^\d\.\-,]", "").Replace(",", "");
        return double.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out var result) ? result : 0;
    }

    private static DateTime? ParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var text = value.Trim();
        string[] formats = { "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy", "MM/dd/yyyy", "M/d/yyyy" };
        if (DateTime.TryParseExact(text, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var exact)) return exact;
        if (DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)) return parsed;
        if (DateTime.TryParse(text, new CultureInfo("ar-EG"), DateTimeStyles.None, out var arParsed)) return arParsed;
        return null;
    }

    private static string ExtractMonth(string fileCode)
    {
        var clean = (fileCode ?? "").Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(clean) || clean == "---") return "فارغ";
        string? Format(string month, string year)
        {
            return int.TryParse(month, out var m) && m is >= 1 and <= 12 && Regex.IsMatch(year, @"^\d{4}$")
                ? $"{m:00}-{year}"
                : null;
        }

        var patterns = new (Regex Regex, Func<Match, string?> Map)[]
        {
            (new Regex(@"(?:^|[^\d])(\d{4})\d*[-/](\d{1,2})[-/](\d{1,2})(?=$|[^\d])"), m => Format(m.Groups[2].Value, m.Groups[1].Value)),
            (new Regex(@"(?:^|[^\d])(\d{1,2})[-/](\d{1,2})[-/](\d{4})\d*(?=$|[^\d])"), m => Format(m.Groups[2].Value, m.Groups[3].Value)),
            (new Regex(@"(?:^|[^\d])(\d{4})\d*[-/](\d{1,2})(?=$|[^\d])"), m => Format(m.Groups[2].Value, m.Groups[1].Value)),
            (new Regex(@"(?:^|[^\d])(0?[1-9]|1[0-2])[-/](\d{4})\d*(?=$|[^\d])"), m => Format(m.Groups[1].Value, m.Groups[2].Value))
        };

        var matches = patterns
            .SelectMany(p => p.Regex.Matches(clean).Select(m => new { m.Index, Value = p.Map(m) }))
            .Where(x => !string.IsNullOrWhiteSpace(x.Value))
            .OrderBy(x => x.Index)
            .ToList();
        return matches.LastOrDefault()?.Value ?? "فارغ";
    }

    private static int MonthSortKey(string month)
    {
        var match = Regex.Match(month ?? "", @"^(0[1-9]|1[0-2])-(\d{4})$");
        return match.Success ? int.Parse(match.Groups[2].Value) * 100 + int.Parse(match.Groups[1].Value) : 0;
    }

    private static string Normalize(string? value) => (value ?? "").Trim().ToLowerInvariant();

    private static string GetReportTitle(string metric) => metric switch
    {
        "salary" => "تقرير سجلات المرتبات",
        "incentive" => "تقرير سجلات الحوافز",
        "returned" => "تقرير Returned",
        "rejected" => "تقرير Rejected",
        "settled" or "paid" => "تقرير تم التسوية",
        "unsettled" or "pending" => "تقرير تحت التسوية",
        "accrued" => "تقرير المعلّى",
        "today" => "تقرير سجلات اليوم",
        "month" or "thismonth" => "تقرير سجلات هذا الشهر",
        _ => "تقرير لوحة التحكم"
    };

    private static object BuildDateRange(DashboardFilters filters) => new
    {
        from = string.IsNullOrWhiteSpace(filters.FromDate) ? null : filters.FromDate,
        to = string.IsNullOrWhiteSpace(filters.ToDate) ? null : filters.ToDate,
        month = string.IsNullOrWhiteSpace(filters.Month) ? null : filters.Month
    };
}
