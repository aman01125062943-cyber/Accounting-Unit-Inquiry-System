using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using HKServer.Services;

namespace HKServer.Endpoints;

public static class AccountStatementEndpoints
{
    private sealed class StatementRecord
    {
        public long Id { get; set; }
        public string Source { get; set; } = "";
        public string SourceLabel { get; set; } = "";
        public string Name { get; set; } = "";
        public string NationalId { get; set; } = "";
        public string AccountNumber { get; set; } = "";
        public string Bank { get; set; } = "";
        public string FileCode { get; set; } = "";
        public string Month { get; set; } = "فارغ";
        public string Status { get; set; } = "";
        public double Amount { get; set; }
        public string UploadDate { get; set; } = "";
        public string SettlementDate { get; set; } = "";
        public string PaymentSettlementNo { get; set; } = "";
        public string SettlementStatus { get; set; } = "";
        public string Reason { get; set; } = "";
        public int AttachmentCount { get; set; }
    }

    public static void MapAccountStatementEndpoints(this WebApplication app)
    {
        app.MapGet("/api/search/comprehensive", async (HttpRequest request, DatabaseService db) =>
        {
            var query = request.Query["q"].FirstOrDefault()?.Trim() ?? "";
            var settlementStatus = request.Query["settlementStatus"].FirstOrDefault()?.Trim() ?? "all";
            var page = int.TryParse(request.Query["page"].FirstOrDefault(), out var p) ? Math.Max(1, p) : 1;
            var pageSize = int.TryParse(request.Query["pageSize"].FirstOrDefault(), out var ps) ? Math.Clamp(ps, 10, 200) : 50;
            var offset = (page - 1) * pageSize;

            await db.EnsureSearchFilterIndexFreshAsync();
            using var conn = await db.GetOpenConnectionAsync();

            var where = "WHERE SearchFilterIndex.IsDeleted = 0 AND SearchFilterIndex.IsArchived = 0";
            var parameters = new DynamicParameters();
            if (!string.IsNullOrWhiteSpace(query))
            {
                where += @" AND (
                    SearchFilterIndex.SearchText LIKE @Query
                    OR SearchFilterIndex.Name LIKE @Query
                    OR SearchFilterIndex.NationalId LIKE @Query
                    OR SearchFilterIndex.AccountNumber LIKE @Query
                    OR SearchFilterIndex.Bank LIKE @Query
                    OR SearchFilterIndex.FileCode LIKE @Query
                )";
                parameters.Add("Query", $"%{query}%");
            }

            static string SettlementClause(string settlementStatus, string sourceType)
            {
                var tableName = sourceType == "salary" ? "SalaryReturns" : "Returns";
                if (settlementStatus == "settled")
                {
                    return $@" AND EXISTS (
                        SELECT 1 FROM {tableName} src
                        WHERE src.Id = SearchFilterIndex.RecordId
                          AND (json_extract(src.RawData, '$.""رقم تسوية السداد""') IS NOT NULL
                               AND json_extract(src.RawData, '$.""رقم تسوية السداد""') != '')
                    )";
                }

                if (settlementStatus == "not_settled")
                {
                    return $@" AND EXISTS (
                        SELECT 1 FROM {tableName} src
                        WHERE src.Id = SearchFilterIndex.RecordId
                          AND (json_extract(src.RawData, '$.""رقم تسوية السداد""') IS NULL
                               OR json_extract(src.RawData, '$.""رقم تسوية السداد""') = '')
                    )";
                }

                return "";
            }

            var incentiveWhere = $"{where} AND SearchFilterIndex.SourceType = 'returns'{SettlementClause(settlementStatus, "returns")}";
            var salaryWhere = $"{where} AND SearchFilterIndex.SourceType = 'salary'{SettlementClause(settlementStatus, "salary")}";

            var incentiveTotal = await conn.ExecuteScalarAsync<int>($"SELECT COUNT(*) FROM SearchFilterIndex {incentiveWhere}", parameters);
            var salaryTotal = await conn.ExecuteScalarAsync<int>($"SELECT COUNT(*) FROM SearchFilterIndex {salaryWhere}", parameters);
            var total = incentiveTotal + salaryTotal;

            async Task<List<dynamic>> LoadSourceRows(string sourceType)
            {
                var sourceParams = new DynamicParameters(parameters);
                sourceParams.Add("SourceType", sourceType);
                sourceParams.Add("Limit", pageSize);
                sourceParams.Add("Offset", offset);
                var sourceWhere = sourceType == "salary" ? salaryWhere : incentiveWhere;
                var tableName = sourceType == "salary" ? "SalaryReturns" : "Returns";
                var imagesTable = sourceType == "salary" ? "SalaryReturnsImages" : "ReturnsImages";
                return (await conn.QueryAsync<dynamic>($@"
                SELECT SearchFilterIndex.RecordId, SearchFilterIndex.SourceType, SearchFilterIndex.Name,
                       SearchFilterIndex.NationalId, SearchFilterIndex.AccountNumber, SearchFilterIndex.Bank,
                       SearchFilterIndex.FileCode, SearchFilterIndex.ExtractedMonth, SearchFilterIndex.PaymentDate,
                       SearchFilterIndex.UploadDate, SearchFilterIndex.Status, SearchFilterIndex.ReturnedRejected,
                       SearchFilterIndex.HasAttachments, src.RawData,
                       COALESCE(
                           NULLIF(json_extract(src.RawData, '$.""قيمة العملية""'), ''),
                           NULLIF(json_extract(src.RawData, '$."" قيمة العملية""'), ''),
                           NULLIF(json_extract(src.RawData, '$.""المبلغ""'), ''),
                           NULLIF(json_extract(src.RawData, '$.""مبلغ""'), ''),
                           NULLIF(json_extract(src.RawData, '$.""صافي المبلغ""'), ''),
                           NULLIF(json_extract(src.RawData, '$.Amount'), ''),
                           NULLIF(json_extract(src.RawData, '$.amount'), ''),
                           NULLIF(json_extract(src.RawData, '$.OperationValue'), ''),
                           NULLIF(json_extract(src.RawData, '$.operationValue'), ''),
                           NULLIF(json_extract(src.RawData, '$.ProcessValue'), ''),
                           NULLIF(json_extract(src.RawData, '$.processValue'), ''),
                           NULLIF(json_extract(src.RawData, '$.Value'), ''),
                           NULLIF(json_extract(src.RawData, '$.value'), '')
                       ) AS OperationAmount,
                       (SELECT COUNT(*) FROM {imagesTable} img WHERE img.ReturnId = SearchFilterIndex.RecordId) AS AttachmentCount
                FROM SearchFilterIndex
                INNER JOIN {tableName} src ON src.Id = SearchFilterIndex.RecordId
                {sourceWhere}
                ORDER BY SearchFilterIndex.UpdatedAt DESC, SearchFilterIndex.RecordId DESC
                LIMIT @Limit OFFSET @Offset", sourceParams)).ToList();
            }

            async Task<double> LoadSourceAmount(string sourceType)
            {
                var sourceWhere = sourceType == "salary" ? salaryWhere : incentiveWhere;
                var tableName = sourceType == "salary" ? "SalaryReturns" : "Returns";
                var rawRows = await conn.QueryAsync<string>($@"
                SELECT src.RawData
                FROM SearchFilterIndex
                INNER JOIN {tableName} src ON src.Id = SearchFilterIndex.RecordId
                {sourceWhere}", parameters);
                return rawRows.Sum(raw =>
                {
                    var parsed = ParseRaw(raw);
                    var amountText = FirstAmountText(parsed,
                        "قيمة العملية", " قيمة العملية", "المبلغ", "مبلغ", "صافي المبلغ",
                        "Amount", "amount", "OperationAmount", "operationAmount",
                        "OperationValue", "operationValue", "ProcessValue", "processValue",
                        "Transaction Amount", "Transaction Value", "Value", "value");
                    return ParseAmount(amountText ?? "");
                });
            }

            var incentiveRows = await LoadSourceRows("returns");
            var salaryRows = await LoadSourceRows("salary");
            var incentiveAmount = await LoadSourceAmount("returns");
            var salaryAmount = await LoadSourceAmount("salary");

            object Map(dynamic r) => new Dictionary<string, object?>
            {
                ["id"] = Convert.ToInt64(r.RecordId),
                ["المصدر"] = Convert.ToString(r.SourceType) == "salary" ? "المرتبات" : "الحوافز",
                ["الاسم"] = Convert.ToString(r.Name) ?? "",
                ["الرقم القومي"] = Convert.ToString(r.NationalId) ?? "",
                ["رقم الحساب"] = Convert.ToString(r.AccountNumber) ?? "",
                ["البنك"] = Convert.ToString(r.Bank) ?? "",
                ["كود الملف"] = Convert.ToString(r.FileCode) ?? "",
                ["الشهر"] = Convert.ToString(r.ExtractedMonth) ?? "",
                ["تاريخ الرفع"] = Convert.ToString(r.UploadDate) ?? "",
                ["تاريخ السداد"] = Convert.ToString(r.PaymentDate) ?? "",
                ["الحالة"] = Convert.ToString(r.Status) ?? "",
                ["Returned/Rejected"] = Convert.ToString(r.ReturnedRejected) ?? "",
                ["AttachmentCount"] = Convert.ToInt32(r.HasAttachments),
                ["_src"] = Convert.ToString(r.SourceType) == "salary" ? "salary" : "incentive"
            };

            object MapFull(dynamic r)
            {
                var raw = Convert.ToString(r.RawData) ?? "{}";
                Dictionary<string, object?> parsed = ParseRaw(raw);
                var row = new Dictionary<string, object?>(parsed);
                var recordId = Convert.ToInt64(r.RecordId);
                var sourceType = Convert.ToString(r.SourceType) == "salary" ? "salary" : "incentive";
                var paymentNo = FirstText(parsed, "رقم تسوية السداد", "PaymentSettlementNo", "SettlementNo");

                row["id"] = recordId;
                row["Id"] = recordId;
                row["كود الملف"] = FirstNonEmpty(row, "كود الملف", "كـــود الملف", "كُـــود المـلف", "كود_الملف", "FileCode", "ReturnCode") ?? Convert.ToString(r.FileCode) ?? "";
                row["الشهر"] = Convert.ToString(r.ExtractedMonth) ?? "";
                row["الاسم"] = FirstNonEmpty(row, "الاسم", "الاسم ", "الإسم", "Name", "FullName") ?? Convert.ToString(r.Name) ?? "";
                row["الرقم القومي"] = FirstNonEmpty(row, "الرقم القومي", "الرقم_القومي", "رقم قومي", "NationalId", "NID") ?? Convert.ToString(r.NationalId) ?? "";
                row["رقم الحساب"] = FirstNonEmpty(row, "رقم الحساب", "رقم الحساب القديم", "AccountNumber", "Account", "OldAccount") ?? Convert.ToString(r.AccountNumber) ?? "";
                row["البنك"] = FirstNonEmpty(row, "البنك", "اسم البنك", "Bank", "BankName") ?? Convert.ToString(r.Bank) ?? "";
                row["تاريخ الرفع"] = FirstNonEmpty(row, "تاريخ الرفع", "UploadDate", "uploadDate") ?? Convert.ToString(r.UploadDate) ?? "";
                row["الحالة"] = FirstNonEmpty(row, "الحالة", "حالة الارتداد", "ReturnStatus", "Status") ?? Convert.ToString(r.Status) ?? "";
                row["Returned/Rejected"] = Convert.ToString(r.ReturnedRejected) ?? "";
                var operationAmount = Convert.ToString(r.OperationAmount);
                var amountValue = FirstNonEmpty(row, "قيمة العملية", " قيمة العملية")
                    ?? (!string.IsNullOrWhiteSpace(operationAmount) ? operationAmount : null)
                    ?? FirstNonEmpty(row, "Amount", "amount", "OperationValue", "operationValue", "ProcessValue", "processValue", "Value", "value", "المبلغ", "مبلغ", "صافي المبلغ")
                    ?? "";
                row["قيمة العملية"] = amountValue;
                row["OperationAmount"] = amountValue;
                if (!row.ContainsKey("Amount")) row["Amount"] = amountValue;
                row["رقم تسوية السداد"] = FirstNonEmpty(row, "رقم تسوية السداد", "PaymentSettlementNo", "SettlementNo") ?? "";
                row["تاريخ اعتماد التعديل"] = FirstNonEmpty(row, "تاريخ اعتماد التعديل", "ModificationDate", "ModApprovalDate") ?? "";
                row["تاريخ اعتماد التعديل / تاريخ السداد"] = FirstNonEmpty(row, "تاريخ اعتماد التعديل / تاريخ السداد", "تاريخ السداد", "تاريخ اعتماد التعديل", "تاريخ اعتماد المرتدات", "SettlementDate", "ModificationDate") ?? "";
                row["حالة التسوية"] = string.IsNullOrWhiteSpace(paymentNo) ? "لم يتم التسوية" : "تم التسوية";
                row["AttachmentCount"] = Convert.ToInt32(r.AttachmentCount);
                row["_src"] = sourceType;
                return row;
            }

            var incentiveMapped = incentiveRows.Select(MapFull).Cast<Dictionary<string, object?>>().ToList();
            var salaryMapped = salaryRows.Select(MapFull).Cast<Dictionary<string, object?>>().ToList();
            var mapped = incentiveMapped.Concat(salaryMapped).ToList();
            return Results.Ok(new
            {
                success = true,
                query,
                settlementStatus,
                data = mapped,
                incentiveRecords = incentiveMapped,
                salaryRecords = salaryMapped,
                stats = new
                {
                    totalCount = total,
                    incentiveCount = incentiveTotal,
                    salaryCount = salaryTotal,
                    totalAmount = incentiveAmount + salaryAmount,
                    incentiveAmount,
                    salaryAmount
                },
                pagination = new
                {
                    currentPage = page,
                    totalPages = (int)Math.Ceiling(total / (double)pageSize),
                    itemsPerPage = pageSize,
                    total,
                    hasNextPage = page * pageSize < total,
                    hasPreviousPage = page > 1
                }
            });
        });

        app.MapGet("/api/search/account-statement", async (HttpRequest request, DatabaseService db) =>
        {
            var query = request.Query["q"].FirstOrDefault()?.Trim() ?? "";
            var personKey = request.Query["personKey"].FirstOrDefault()?.Trim() ?? "";
            var includeArchived = bool.TryParse(request.Query["includeArchived"].FirstOrDefault(), out var ia) && ia;

            if (string.IsNullOrWhiteSpace(query) && string.IsNullOrWhiteSpace(personKey))
                return Results.BadRequest(new { success = false, message = "Search query is required" });

            var all = await LoadStatementRecords(db, includeArchived);
            var filtered = !string.IsNullOrWhiteSpace(personKey)
                ? all.Where(r => BuildPersonKey(r) == personKey).ToList()
                : all.Where(r => Matches(r, query)).ToList();

            if (!filtered.Any())
            {
                return Results.Ok(new
                {
                    success = true,
                    requiresSelection = false,
                    personInfo = (object?)null,
                    summary = BuildSummary(filtered),
                    incentiveRecords = Array.Empty<StatementRecord>(),
                    salaryRecords = Array.Empty<StatementRecord>(),
                    matches = Array.Empty<object>()
                });
            }

            var groups = filtered
                .GroupBy(BuildPersonKey)
                .Select(g => new
                {
                    personKey = g.Key,
                    personInfo = BuildPersonInfo(g),
                    totalCount = g.Count(),
                    totalAmount = g.Sum(x => x.Amount),
                    incentiveCount = g.Count(x => x.Source == "incentive"),
                    salaryCount = g.Count(x => x.Source == "salary")
                })
                .OrderByDescending(x => x.totalCount)
                .Take(20)
                .ToList();

            var exactIdentitySearch = filtered.Any(r =>
                SameDigits(r.NationalId, query) ||
                SameDigits(r.AccountNumber, query));

            if (groups.Count > 1 && !exactIdentitySearch && string.IsNullOrWhiteSpace(personKey))
            {
                return Results.Ok(new
                {
                    success = true,
                    requiresSelection = true,
                    matches = groups
                });
            }

            var selected = string.IsNullOrWhiteSpace(personKey)
                ? filtered.Where(r => BuildPersonKey(r) == groups[0].personKey).ToList()
                : filtered;

            return Results.Ok(new
            {
                success = true,
                requiresSelection = false,
                personInfo = BuildPersonInfo(selected),
                summary = BuildSummary(selected),
                incentiveRecords = selected.Where(r => r.Source == "incentive").ToList(),
                salaryRecords = selected.Where(r => r.Source == "salary").ToList(),
                matches = groups
            });
        });
    }

    private static async Task<List<StatementRecord>> LoadStatementRecords(DatabaseService db, bool includeArchived)
    {
        using var conn = await db.GetOpenConnectionAsync();
        var archiveWhere = includeArchived ? "" : " AND COALESCE(IsArchived, 0) = 0";
        var returns = await conn.QueryAsync<dynamic>($@"
            SELECT r.Id, r.RawData, r.ReturnCode, r.UploadDate,
                   (SELECT COUNT(*) FROM ReturnsImages i WHERE i.ReturnId = r.Id) AS AttachmentCount
            FROM Returns r
            WHERE COALESCE(r.IsDeleted, 0) = 0{archiveWhere}");
        var salaries = await conn.QueryAsync<dynamic>($@"
            SELECT r.Id, r.RawData, r.ReturnCode, r.UploadDate,
                   (SELECT COUNT(*) FROM SalaryReturnsImages i WHERE i.ReturnId = r.Id) AS AttachmentCount
            FROM SalaryReturns r
            WHERE COALESCE(r.IsDeleted, 0) = 0{archiveWhere}");

        var rows = new List<StatementRecord>();
        rows.AddRange(returns.Select<dynamic, StatementRecord>(r => MapRecord(r, "incentive", "الحوافز")));
        rows.AddRange(salaries.Select<dynamic, StatementRecord>(r => MapRecord(r, "salary", "المرتبات")));
        return rows;
    }

    private static StatementRecord MapRecord(dynamic row, string source, string sourceLabel)
    {
        var data = ParseRaw((string?)row.RawData);
        var fileCode = FirstText(data, "كود الملف", "كـــود الملف", "كُـــود المـلف", "كود_الملف", "FileCode");
        if (string.IsNullOrWhiteSpace(fileCode)) fileCode = (string?)row.ReturnCode ?? "";

        var paymentNo = FirstText(data, "رقم تسوية السداد", "PaymentSettlementNo", "SettlementNo");
        var statusBlob = Normalize(FirstText(data, "الحالة", "حالة المرتد", "ReturnStatus", "Status", "السبب") + " " + JsonSerializer.Serialize(data));
        var isRejected = statusBlob.Contains("rejected") || statusBlob.Contains("reject") || statusBlob.Contains("مرفوض") || statusBlob.Contains("رفض");
        var isReturned = !isRejected && (statusBlob.Contains("returned") || statusBlob.Contains("return") || statusBlob.Contains("مرتد") || statusBlob.Contains("ارجاع") || statusBlob.Contains("إرجاع"));

        return new StatementRecord
        {
            Id = (long)row.Id,
            Source = source,
            SourceLabel = sourceLabel,
            Name = FirstText(data, "الاسم", "الإسم", "الأسم", "الاســــم", "اسم العميل", "اسم الموظف", "المستفيد", "Name", "FullName"),
            NationalId = FirstText(data, "الرقم القومي", "رقم قومي", "NationalId", "NID", "NationalID"),
            AccountNumber = FirstText(data, "رقم الحساب", "رقم الحساب القديم", "AccountNumber", "Account", "OldAccount"),
            Bank = FirstText(data, "البنك", "اسم البنك", "Bank", "BankName"),
            FileCode = fileCode,
            Month = ExtractMonth(fileCode),
            Status = isRejected ? "Rejected" : (isReturned ? "Returned" : FirstText(data, "الحالة", "Status")),
            Amount = ParseAmount(FirstText(data, "قيمة العملية", "المبلغ", "مبلغ", "صافي المبلغ", "Amount", "ProcessValue")),
            UploadDate = FirstText(data, "تاريخ الرفع", "UploadDate", "CreatedAt", "تاريخ المرتد", "ت. المرتد") is { Length: > 0 } d ? d : ((string?)row.UploadDate ?? ""),
            SettlementDate = FirstText(data, "تاريخ اعتماد التعديل / تاريخ السداد", "تاريخ اعتماد التعديل", "تاريخ السداد", "تاريخ التسوية", "SettlementDate", "ModificationDate"),
            PaymentSettlementNo = paymentNo,
            SettlementStatus = string.IsNullOrWhiteSpace(paymentNo) ? "لم يتم التسوية" : "تم التسوية",
            Reason = FirstText(data, "السبب", "سبب الرفض", "Reason", "RejectReason"),
            AttachmentCount = Convert.ToInt32(row.AttachmentCount ?? 0)
        };
    }

    private static bool Matches(StatementRecord r, string query)
    {
        var q = Normalize(query);
        var qDigits = DigitsOnly(query);
        if (string.IsNullOrWhiteSpace(q)) return false;
        return Normalize(r.Name).Contains(q) ||
               Normalize(r.Bank).Contains(q) ||
               (!string.IsNullOrWhiteSpace(qDigits) && DigitsOnly(r.NationalId).Contains(qDigits)) ||
               (!string.IsNullOrWhiteSpace(qDigits) && DigitsOnly(r.AccountNumber).Contains(qDigits));
    }

    private static object BuildSummary(List<StatementRecord> rows) => new
    {
        incentiveCount = rows.Count(r => r.Source == "incentive"),
        incentiveAmount = rows.Where(r => r.Source == "incentive").Sum(r => r.Amount),
        salaryCount = rows.Count(r => r.Source == "salary"),
        salaryAmount = rows.Where(r => r.Source == "salary").Sum(r => r.Amount),
        returnedCount = rows.Count(r => r.Status == "Returned"),
        rejectedCount = rows.Count(r => r.Status == "Rejected"),
        settledCount = rows.Count(r => r.SettlementStatus == "تم التسوية"),
        unsettledCount = rows.Count(r => r.SettlementStatus != "تم التسوية")
    };

    private static object BuildPersonInfo(IEnumerable<StatementRecord> records)
    {
        var rows = records.ToList();
        string First(Func<StatementRecord, string> selector) => rows.Select(selector).FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)) ?? "";
        return new
        {
            name = First(r => r.Name),
            nationalId = First(r => r.NationalId),
            accountNumber = First(r => r.AccountNumber),
            bank = First(r => r.Bank)
        };
    }

    private static string BuildPersonKey(StatementRecord r)
    {
        var nid = DigitsOnly(r.NationalId);
        if (nid.Length >= 10) return $"nid:{nid}";
        var account = DigitsOnly(r.AccountNumber);
        if (account.Length >= 6) return $"acc:{account}|bank:{Normalize(r.Bank)}";
        return $"name:{Normalize(r.Name)}|bank:{Normalize(r.Bank)}";
    }

    private static bool SameDigits(string left, string right)
    {
        var l = DigitsOnly(left);
        var r = DigitsOnly(right);
        return r.Length >= 6 && l == r;
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
            if (data.TryGetValue(key, out var value) && value is not null && !string.IsNullOrWhiteSpace(value.ToString()))
                return value.ToString()!.Trim();
        return "";
    }

    private static string? FirstNonEmpty(Dictionary<string, object?> data, params string[] keys)
    {
        var value = FirstText(data, keys);
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private static string? FirstAmountText(Dictionary<string, object?> data, params string[] keys)
    {
        var exact = FirstNonEmpty(data, keys);
        if (!string.IsNullOrWhiteSpace(exact)) return exact;

        foreach (var (key, value) in data)
        {
            var normalized = NormalizeAmountKey(key);
            var isAmountKey =
                normalized.Contains("قيمهالعمليه") ||
                normalized.Contains("مبلغ") ||
                normalized.Contains("amount") ||
                normalized.Contains("operationvalue") ||
                normalized.Contains("transactionamount") ||
                normalized.Contains("transactionvalue") ||
                normalized.Contains("salaryamount") ||
                normalized == "value";
            var isNonAmountKey =
                normalized.Contains("تسويه") ||
                normalized.Contains("settlement") ||
                normalized.Contains("حساب") ||
                normalized.Contains("account") ||
                normalized.Contains("قومي") ||
                normalized.Contains("national") ||
                normalized.Contains("id");

            if (!isAmountKey || isNonAmountKey) continue;
            var text = value?.ToString()?.Trim();
            if (!string.IsNullOrWhiteSpace(text)) return text;
        }

        return null;
    }

    private static string NormalizeAmountKey(string key)
    {
        return (key ?? "")
            .Replace("ـ", "")
            .Replace("أ", "ا")
            .Replace("إ", "ا")
            .Replace("آ", "ا")
            .Replace("ة", "ه")
            .Replace("ى", "ي")
            .Replace(" ", "")
            .Trim()
            .ToLowerInvariant();
    }

    private static double ParseAmount(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return 0;
        var cleaned = Regex.Replace(value, @"[^\d\.\-,]", "").Replace(",", "");
        return double.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out var result) ? result : 0;
    }

    private static string ExtractMonth(string fileCode)
    {
        var clean = (fileCode ?? "").Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(clean) || clean == "---") return "فارغ";
        string? Format(string month, string year) =>
            int.TryParse(month, out var m) && m is >= 1 and <= 12 && Regex.IsMatch(year, @"^\d{4}$") ? $"{m:00}-{year}" : null;

        var patterns = new (Regex Regex, Func<Match, string?> Map)[]
        {
            (new Regex(@"(?:^|[^\d])(\d{4})\d*[-/](\d{1,2})[-/](\d{1,2})(?=$|[^\d])"), m => Format(m.Groups[2].Value, m.Groups[1].Value)),
            (new Regex(@"(?:^|[^\d])(\d{1,2})[-/](\d{1,2})[-/](\d{4})\d*(?=$|[^\d])"), m => Format(m.Groups[2].Value, m.Groups[3].Value)),
            (new Regex(@"(?:^|[^\d])(\d{4})\d*[-/](\d{1,2})(?=$|[^\d])"), m => Format(m.Groups[2].Value, m.Groups[1].Value)),
            (new Regex(@"(?:^|[^\d])(0?[1-9]|1[0-2])[-/](\d{4})\d*(?=$|[^\d])"), m => Format(m.Groups[1].Value, m.Groups[2].Value))
        };

        var matches = patterns.SelectMany(p => p.Regex.Matches(clean).Select(m => new { m.Index, Value = p.Map(m) }))
            .Where(x => !string.IsNullOrWhiteSpace(x.Value))
            .OrderBy(x => x.Index)
            .ToList();
        return matches.LastOrDefault()?.Value ?? "فارغ";
    }

    private static string DigitsOnly(string? value) => Regex.Replace(value ?? "", @"\D", "");

    private static string Normalize(string? value)
    {
        var text = (value ?? "").Trim().ToLowerInvariant();
        return text
            .Replace("أ", "ا").Replace("إ", "ا").Replace("آ", "ا")
            .Replace("ة", "ه").Replace("ى", "ي")
            .Replace("ؤ", "ء").Replace("ئ", "ء");
    }
}
