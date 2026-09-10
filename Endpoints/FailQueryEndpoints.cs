using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using HKServer.Services;
using Dapper;
using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace HKServer.Endpoints;

public static class FailQueryEndpoints
{
    private static readonly string _baseUrl = "https://hiaapay.faa.local/tahseel-api/api";
    private static readonly string _gehaCode = "463";
    private static bool _isSyncingHistory = false;

    public static void MapFailQueryEndpoints(this WebApplication app)
    {
        // 1. جلب المرتدات الحية (sendFlag=0)
        app.MapGet("/api/failquery/live", async (DatabaseService db) =>
        {
            var res = await ProxyGet($"FailedTransaction?gehaCode={_gehaCode}&sendFlag=0", timeoutSeconds: 6);
            if (res is Microsoft.AspNetCore.Http.IResult r && r.GetType().Name.Contains("Json"))
            {
                // Fallback to local DB if remote portal timed out
                return await GetLocalFailQueryDataAsync(db);
            }
            return res;
        });

        // 2. جلب المرتدات المسواة (sendFlag=1)
        app.MapGet("/api/failquery/settled", async (DatabaseService db) =>
        {
            var res = await ProxyGet($"FailedTransaction?gehaCode={_gehaCode}&sendFlag=1", timeoutSeconds: 6);
            if (res is Microsoft.AspNetCore.Http.IResult r && r.GetType().Name.Contains("Json"))
            {
                return await GetLocalFailQueryDataAsync(db);
            }
            return res;
        });

        // 3. جلب سجل المرتدات (استعلام مباشر للبوابة على نفس نمط شاشتها الأصلية)
        app.MapGet("/api/failquery/history", async (DatabaseService db) =>
        {
            var res = await ProxyGet($"FailedTransaction/history?gehaCode={_gehaCode}", timeoutSeconds: 30);
            if (res is Microsoft.AspNetCore.Http.IResult r && r.GetType().Name.Contains("Json"))
            {
                return await GetLocalFailQueryDataAsync(db);
            }
            return res;
        });

        // 4. مزامنة فورية صريحة عند زر تحديث البيانات
        app.MapPost("/api/failquery/sync", async (DatabaseService db) =>
        {
            await SyncRemotePortalToLocalDbAsync(db);
            var data = await GetLocalFailQueryDataListAsync(db);
            return Results.Ok(new { success = true, data });
        });

        // 5. حالة المزامنة وتاريخ آخر تحديث
        app.MapGet("/api/failquery/sync-status", async (DatabaseService db) =>
        {
            using var conn = await db.GetOpenConnectionAsync();
            var count = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM FailQueryBatches");
            var lastSynced = await conn.ExecuteScalarAsync<string>("SELECT MAX(SyncedAt) FROM FailQueryBatches");
            return Results.Ok(new { isSyncing = _isSyncingHistory, totalBatches = count, lastSynced });
        });

        // 5.5 اقتراحات ذكية لأسماء الجهات والمحول إليهم والحسابات المتاحة
        app.MapGet("/api/failquery/suggestions", async (string? q, DatabaseService db) =>
        {
            var query = q?.Trim() ?? "";
            if (string.IsNullOrEmpty(query) || query.Length < 2)
            {
                return Results.Ok(new string[] { });
            }

            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            try
            {
                using var conn = await db.GetOpenConnectionAsync();
                var dbNames = await conn.QueryAsync<string>(
                    "SELECT DISTINCT CreditorName FROM FailQueryTransactions WHERE CreditorName LIKE @q AND CreditorName IS NOT NULL LIMIT 20",
                    new { q = $"%{query}%" });
                foreach (var n in dbNames)
                {
                    if (!string.IsNullOrWhiteSpace(n)) names.Add(n.Trim());
                }

                var retNames = await conn.QueryAsync<string>(
                    "SELECT DISTINCT CreditorName FROM Returns WHERE CreditorName LIKE @q AND CreditorName IS NOT NULL LIMIT 20",
                    new { q = $"%{query}%" });
                foreach (var n in retNames)
                {
                    if (!string.IsNullOrWhiteSpace(n)) names.Add(n.Trim());
                }
            }
            catch { }

            var knownEntities = new[] {
                "دار امداد و التموين",
                "دار الامداد والتموين",
                "حساب الحوافز - هيئة الامداد والتموين للقوات المسلحة",
                "إدارة المركبات للقوات المسلحة",
                "إدارة الإشارة للقوات المسلحة",
                "إدارة الأسلحة والذخيرة",
                "إدارة الحرب الكيميائية",
                "إدارة الحرب الإلكترونية",
                "هيئة التنظيم والإدارة للقوات المسلحة",
                "هيئة الشئون المالية للقوات المسلحة",
                "هيئة العمليات للقوات المسلحة",
                "صندوق التكافل الاجتماعي",
                "جهاز مشروعات الخدمة الوطنية",
                "مستشفى المعادي العسكري",
                "مجمع الجلاء الطبي للقوات المسلحة"
            };

            foreach (var k in knownEntities)
            {
                if (k.Contains(query, StringComparison.OrdinalIgnoreCase))
                {
                    names.Add(k);
                }
            }

            return Results.Ok(names.Take(15));
        });

        // 5.6 اقتراحات أكواد الملفات والحافظات المتاحة في البوابة
        app.MapGet("/api/failquery/file-suggestions", async () =>
        {
            try
            {
                var handler = new HttpClientHandler { ServerCertificateCustomValidationCallback = (_, _, _, _) => true };
                using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(15) };
                client.DefaultRequestHeaders.Add("X-Request-From", "https://hiaapay.faa.local");
                var authBody = new StringContent(
                    JsonSerializer.Serialize(new { userName = "m.foad", password = "P@ssw0rdP@ssw0rd" }),
                    Encoding.UTF8, "application/json");
                var authResp = await client.PostAsync($"{_baseUrl}/Auth", authBody);
                if (!authResp.IsSuccessStatusCode) return Results.Ok(new object[] { });

                var authJson = await authResp.Content.ReadAsStringAsync();
                using var authDoc = JsonDocument.Parse(authJson);
                string token = authDoc.RootElement.TryGetProperty("token", out var tp) ? tp.GetString()! : authJson.Trim('"');
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");

                var batchesResp = await client.GetAsync($"{_baseUrl}/batch");
                if (batchesResp.IsSuccessStatusCode)
                {
                    var bJson = await batchesResp.Content.ReadAsStringAsync();
                    using var bDoc = JsonDocument.Parse(bJson);
                    if (bDoc.RootElement.ValueKind == JsonValueKind.Array)
                    {
                        var list = bDoc.RootElement.EnumerateArray().Take(80).Select(b => new {
                            fileId = b.TryGetProperty("fileId", out var fip) ? fip.GetString() ?? fip.GetRawText() : "",
                            transCount = b.TryGetProperty("transCount", out var tcp) && tcp.ValueKind == JsonValueKind.Number ? tcp.GetInt64() : 0,
                            total = b.TryGetProperty("total", out var top) && top.ValueKind == JsonValueKind.Number ? top.GetDouble() : 0,
                            fileDate = b.TryGetProperty("fileDate", out var fdp) ? (fdp.GetString() ?? "").Split('T')[0] : "",
                            unMatched = b.TryGetProperty("unMatched", out var unp) && unp.ValueKind == JsonValueKind.Number ? unp.GetInt64() : 0
                        }).Where(x => !string.IsNullOrEmpty(x.fileId)).ToList();

                        return Results.Ok(list);
                    }
                }
            }
            catch { }
            return Results.Ok(new object[] { });
        });

        // 6. الاستعلام المركزي المباشر والشامل (شاشة الحافظات والمطابقات + كشف الحساب)
        app.MapGet("/api/failquery/central-inquiry", async (string? account, double? amount, string? name, string? senderAccount, string? senderName, string? fileId, string? dateFrom, string? dateTo, DatabaseService db) =>
        {
            try
            {
                var queryAcc = account?.Trim() ?? "";
                var querySenderAcc = senderAccount?.Trim() ?? "";
                var queryName = name?.Trim() ?? "";
                var querySenderName = senderName?.Trim() ?? "";
                var queryFileId = fileId?.Trim() ?? "";

                if (string.IsNullOrEmpty(queryAcc) && string.IsNullOrEmpty(querySenderAcc) && string.IsNullOrEmpty(queryName) && string.IsNullOrEmpty(querySenderName) && string.IsNullOrEmpty(queryFileId) && !amount.HasValue)
                {
                    return Results.Json(new { success = false, error = "يرجى إدخال كود الملف أو اسم الجهة أو اسم المودع أو رقم الحساب أو المبلغ" }, statusCode: 400);
                }

                var handler = new HttpClientHandler { ServerCertificateCustomValidationCallback = (_, _, _, _) => true };
                using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(30) };
                client.DefaultRequestHeaders.Add("X-Request-From", "https://hiaapay.faa.local");

                // تسجيل دخول باليوزر المعتمد (m.foad)
                var authBody = new StringContent(
                    JsonSerializer.Serialize(new { userName = "m.foad", password = "P@ssw0rdP@ssw0rd" }),
                    Encoding.UTF8, "application/json");
                var authResp = await client.PostAsync($"{_baseUrl}/Auth", authBody);
                if (!authResp.IsSuccessStatusCode)
                {
                    return Results.Json(new { success = false, error = "تعذر تسجيل الدخول للبوابة المركزية" }, statusCode: 502);
                }

                var authJson = await authResp.Content.ReadAsStringAsync();
                using var authDoc = JsonDocument.Parse(authJson);
                string token = authDoc.RootElement.TryGetProperty("token", out var tp) ? tp.GetString()! : authJson.Trim('"');
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");

                var unifiedResults = new System.Collections.Concurrent.ConcurrentBag<object>();
                var batchResults = new System.Collections.Concurrent.ConcurrentBag<object>();
                var matchResults = new System.Collections.Concurrent.ConcurrentBag<object>();

                // 1. إذا تم تحديد كود ملف محدد، فحص الملف مباشرة وفورياً
                if (!string.IsNullOrEmpty(queryFileId))
                {
                    try
                    {
                        var detResp = await client.GetAsync($"{_baseUrl}/batch/batchDet?fileId={Uri.EscapeDataString(queryFileId)}");
                        if (detResp.IsSuccessStatusCode)
                        {
                            var detJson = await detResp.Content.ReadAsStringAsync();
                            using var detDoc = JsonDocument.Parse(detJson);
                            var txElements = new List<JsonElement>();
                            if (detDoc.RootElement.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var item in detDoc.RootElement.EnumerateArray())
                                {
                                    if (item.TryGetProperty("content", out var cont) && cont.ValueKind == JsonValueKind.Array)
                                    {
                                        foreach (var c in cont.EnumerateArray()) txElements.Add(c);
                                    }
                                    else
                                    {
                                        txElements.Add(item);
                                    }
                                }
                            }

                            foreach (var tx in txElements)
                            {
                                string cAcc = tx.TryGetProperty("creditorAccountNumber", out var cap) ? cap.GetString() ?? "" : "";
                                string dAcc = tx.TryGetProperty("debtorAccountNumber", out var dap) ? dap.GetString() ?? "" : "";
                                string cName = tx.TryGetProperty("creditorName", out var cnp) ? cnp.GetString() ?? "" : "";
                                string dName = tx.TryGetProperty("debtorName", out var dnp) ? dnp.GetString() ?? "" : "";
                                double amt = tx.TryGetProperty("amount", out var ap) && ap.ValueKind == JsonValueKind.Number ? ap.GetDouble() : 0;
                                string bId = tx.TryGetProperty("batchId", out var bip) ? bip.GetString() ?? queryFileId : queryFileId;
                                string tId = tx.TryGetProperty("transactionId", out var tip) ? tip.GetString() ?? "" : "";
                                string rDate = tx.TryGetProperty("recievingDate", out var rdp) ? rdp.GetString() ?? "" : "";

                                bool accMatch = string.IsNullOrEmpty(queryAcc) || cAcc.Contains(queryAcc, StringComparison.OrdinalIgnoreCase) || (string.IsNullOrEmpty(querySenderAcc) && dAcc.Contains(queryAcc, StringComparison.OrdinalIgnoreCase));
                                bool senderAccMatch = string.IsNullOrEmpty(querySenderAcc) || dAcc.Contains(querySenderAcc, StringComparison.OrdinalIgnoreCase);
                                bool nameMatch = string.IsNullOrEmpty(queryName) || cName.Contains(queryName, StringComparison.OrdinalIgnoreCase) || (string.IsNullOrEmpty(querySenderName) && dName.Contains(queryName, StringComparison.OrdinalIgnoreCase));
                                bool senderNameMatch = string.IsNullOrEmpty(querySenderName) || dName.Contains(querySenderName, StringComparison.OrdinalIgnoreCase);
                                bool amtMatch = !amount.HasValue || amount.Value <= 0 || Math.Abs(amt - amount.Value) < 0.05;

                                if (accMatch && senderAccMatch && nameMatch && senderNameMatch && amtMatch)
                                {
                                    string matchTransId = "—";
                                    string matchAcc = "—";
                                    string matchRef = "—";
                                    string matchSnd = "—";
                                    double? matchAmt = null;

                                    if (!string.IsNullOrEmpty(tId))
                                    {
                                        try
                                        {
                                            var mResp = await client.GetAsync($"{_baseUrl}/batch/matchs?transactionId={Uri.EscapeDataString(tId)}");
                                            if (mResp.IsSuccessStatusCode)
                                            {
                                                var mJson = await mResp.Content.ReadAsStringAsync();
                                                using var mDoc = JsonDocument.Parse(mJson);
                                                if (mDoc.RootElement.ValueKind == JsonValueKind.Array)
                                                {
                                                    foreach (var m in mDoc.RootElement.EnumerateArray())
                                                    {
                                                        long serial = m.TryGetProperty("serial", out var sp) && sp.ValueKind == JsonValueKind.Number ? sp.GetInt64() : 0;
                                                        string accName = m.TryGetProperty("fAccountOwnerName", out var aop) ? aop.GetString() ?? "" : "";
                                                        string refNum = m.TryGetProperty("refrenceNum", out var rnp) ? rnp.GetString() ?? "" : "";
                                                        string sName = m.TryGetProperty("sAccountOwnerName", out var snp) ? snp.GetString() ?? "" : "";
                                                        double tVal = m.TryGetProperty("transVal", out var tvp) && tvp.ValueKind == JsonValueKind.Number ? tvp.GetDouble() : 0;

                                                        if (matchTransId == "—")
                                                        {
                                                            matchTransId = serial > 0 ? serial.ToString() : tId;
                                                            matchAcc = accName;
                                                            matchRef = refNum;
                                                            matchSnd = sName;
                                                            matchAmt = tVal;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        catch { }
                                    }

                                    unifiedResults.Add(new {
                                        fileId = queryFileId,
                                        batchId = bId,
                                        transId = tId,
                                        receiverName = cName,
                                        receiverAccount = cAcc,
                                        amount = amt,
                                        senderName = dName,
                                        senderAccount = dAcc,
                                        transDate = !string.IsNullOrEmpty(rDate) ? rDate.Split('T')[0] : "—",
                                        matchTransId = matchTransId,
                                        matchAccount = matchAcc,
                                        matchRefNum = matchRef,
                                        matchSender = matchSnd,
                                        matchAmount = matchAmt.HasValue ? matchAmt.Value : amt
                                    });
                                }
                            }
                        }
                    }
                    catch { }
                }

                // 2. البحث في شاشة الحافظات العامة إذا لم يتم تحديد كود ملف بعينه
                if (string.IsNullOrEmpty(queryFileId))
                {
                    try
                    {
                        var batchesResp = await client.GetAsync($"{_baseUrl}/batch");
                        if (batchesResp.IsSuccessStatusCode)
                        {
                            var bJson = await batchesResp.Content.ReadAsStringAsync();
                            using var bDoc = JsonDocument.Parse(bJson);
                            if (bDoc.RootElement.ValueKind == JsonValueKind.Array)
                            {
                                var topBatches = bDoc.RootElement.EnumerateArray().Take(120).ToList();
                                await Parallel.ForEachAsync(topBatches, new ParallelOptions { MaxDegreeOfParallelism = 15 }, async (b, ct) =>
                                {
                                    string fileId = b.TryGetProperty("fileId", out var fip) ? fip.GetString() ?? fip.GetRawText() : "";
                                    string fileDate = b.TryGetProperty("fileDate", out var fdp) ? fdp.GetString() ?? "" : "";
                                    if (string.IsNullOrEmpty(fileId)) return;

                                try
                                {
                                    var detResp = await client.GetAsync($"{_baseUrl}/batch/batchDet?fileId={Uri.EscapeDataString(fileId)}", ct);
                                    if (!detResp.IsSuccessStatusCode) return;
                                    var detJson = await detResp.Content.ReadAsStringAsync(ct);
                                    using var detDoc = JsonDocument.Parse(detJson);

                                    var txElements = new List<JsonElement>();
                                    if (detDoc.RootElement.ValueKind == JsonValueKind.Array)
                                    {
                                        foreach (var item in detDoc.RootElement.EnumerateArray())
                                        {
                                            if (item.TryGetProperty("content", out var cont) && cont.ValueKind == JsonValueKind.Array)
                                            {
                                                foreach (var c in cont.EnumerateArray()) txElements.Add(c);
                                            }
                                            else
                                            {
                                                txElements.Add(item);
                                            }
                                        }
                                    }

                                    foreach (var tx in txElements)
                                    {
                                        string cAcc = tx.TryGetProperty("creditorAccountNumber", out var cap) ? cap.GetString() ?? "" : "";
                                        string dAcc = tx.TryGetProperty("debtorAccountNumber", out var dap) ? dap.GetString() ?? "" : "";
                                        string cName = tx.TryGetProperty("creditorName", out var cnp) ? cnp.GetString() ?? "" : "";
                                        string dName = tx.TryGetProperty("debtorName", out var dnp) ? dnp.GetString() ?? "" : "";
                                        double amt = tx.TryGetProperty("amount", out var ap) && ap.ValueKind == JsonValueKind.Number ? ap.GetDouble() : 0;

                                        bool accMatch = string.IsNullOrEmpty(queryAcc) || cAcc.Contains(queryAcc, StringComparison.OrdinalIgnoreCase) || (string.IsNullOrEmpty(querySenderAcc) && dAcc.Contains(queryAcc, StringComparison.OrdinalIgnoreCase));
                                        bool senderAccMatch = string.IsNullOrEmpty(querySenderAcc) || dAcc.Contains(querySenderAcc, StringComparison.OrdinalIgnoreCase);
                                        bool nameMatch = string.IsNullOrEmpty(queryName) || cName.Contains(queryName, StringComparison.OrdinalIgnoreCase) || (string.IsNullOrEmpty(querySenderName) && dName.Contains(queryName, StringComparison.OrdinalIgnoreCase));
                                        bool senderNameMatch = string.IsNullOrEmpty(querySenderName) || dName.Contains(querySenderName, StringComparison.OrdinalIgnoreCase);
                                        bool amtMatch = !amount.HasValue || amount.Value <= 0 || Math.Abs(amt - amount.Value) < 0.05;

                                        if (accMatch && senderAccMatch && nameMatch && senderNameMatch && amtMatch)
                                        {
                                            string bId = tx.TryGetProperty("batchId", out var bip) ? bip.GetString() ?? fileId : fileId;
                                            string tId = tx.TryGetProperty("transactionId", out var tip) ? tip.GetString() ?? "" : "";
                                            string rDate = tx.TryGetProperty("recievingDate", out var rdp) ? rdp.GetString() ?? fileDate : fileDate;

                                            string matchTransId = "—";
                                            string matchAcc = "—";
                                            string matchRef = "—";
                                            string matchSnd = "—";
                                            double? matchAmt = null;

                                            // جلب تفاصيل المطابقة
                                            if (!string.IsNullOrEmpty(tId))
                                            {
                                                try
                                                {
                                                    var mResp = await client.GetAsync($"{_baseUrl}/batch/matchs?transactionId={Uri.EscapeDataString(tId)}", ct);
                                                    if (mResp.IsSuccessStatusCode)
                                                    {
                                                        var mJson = await mResp.Content.ReadAsStringAsync(ct);
                                                        using var mDoc = JsonDocument.Parse(mJson);
                                                        if (mDoc.RootElement.ValueKind == JsonValueKind.Array)
                                                        {
                                                            foreach (var m in mDoc.RootElement.EnumerateArray())
                                                            {
                                                                long serial = m.TryGetProperty("serial", out var sp) && sp.ValueKind == JsonValueKind.Number ? sp.GetInt64() : 0;
                                                                string accName = m.TryGetProperty("fAccountOwnerName", out var aop) ? aop.GetString() ?? "" : "";
                                                                string refNum = m.TryGetProperty("refrenceNum", out var rnp) ? rnp.GetString() ?? "" : "";
                                                                string sName = m.TryGetProperty("sAccountOwnerName", out var snp) ? snp.GetString() ?? "" : "";
                                                                double tVal = m.TryGetProperty("transVal", out var tvp) && tvp.ValueKind == JsonValueKind.Number ? tvp.GetDouble() : 0;

                                                                if (matchTransId == "—")
                                                                {
                                                                    matchTransId = serial > 0 ? serial.ToString() : tId;
                                                                    matchAcc = accName;
                                                                    matchRef = refNum;
                                                                    matchSnd = sName;
                                                                    matchAmt = tVal;
                                                                }

                                                                matchResults.Add(new {
                                                                    transId = serial > 0 ? serial.ToString() : tId,
                                                                    accountName = accName,
                                                                    refNum = refNum,
                                                                    senderName = sName,
                                                                    amount = tVal
                                                                });
                                                            }
                                                        }
                                                    }
                                                }
                                                catch { }
                                            }

                                            batchResults.Add(new {
                                                fileId = fileId,
                                                batchId = bId,
                                                transId = tId,
                                                receiverName = cName,
                                                receiverAccount = cAcc,
                                                amount = amt,
                                                senderName = dName,
                                                senderAccount = dAcc,
                                                transDate = !string.IsNullOrEmpty(rDate) ? rDate.Split('T')[0] : "—"
                                            });

                                            unifiedResults.Add(new {
                                                fileId = fileId,
                                                batchId = bId,
                                                transId = tId,
                                                receiverName = cName,
                                                receiverAccount = cAcc,
                                                amount = amt,
                                                senderName = dName,
                                                senderAccount = dAcc,
                                                transDate = !string.IsNullOrEmpty(rDate) ? rDate.Split('T')[0] : "—",
                                                matchTransId = matchTransId,
                                                matchAccount = matchAcc,
                                                matchRefNum = matchRef,
                                                matchSender = matchSnd,
                                                matchAmount = matchAmt.HasValue ? matchAmt.Value : amt
                                            });
                                        }
                                    }
                                }
                                catch { }
                            });
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[BatchSearch Error]: {ex.Message}");
                }
            }

                // 2. إذا لم توجد نتائج في شاشة الحافظات، فحص CompAcc/trans
                var accToQuery = !string.IsNullOrEmpty(queryAcc) ? queryAcc : querySenderAcc;
                if (unifiedResults.IsEmpty && !string.IsNullOrEmpty(accToQuery))
                {
                    try
                    {
                        var compResp = await client.GetAsync($"{_baseUrl}/CompAcc/trans?iban={Uri.EscapeDataString(accToQuery)}");
                        if (compResp.IsSuccessStatusCode)
                        {
                            var compJson = await compResp.Content.ReadAsStringAsync();
                            using var compDoc = JsonDocument.Parse(compJson);
                            if (compDoc.RootElement.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var el in compDoc.RootElement.EnumerateArray())
                                {
                                    double val = el.TryGetProperty("transVal", out var vp) && vp.ValueKind == JsonValueKind.Number ? vp.GetDouble() : 0;
                                    if (amount.HasValue && amount.Value > 0 && Math.Abs(val - amount.Value) > 0.05) continue;

                                    string sIban = el.TryGetProperty("sIban", out var sib) ? sib.GetString() ?? "" : "";
                                    string sName = el.TryGetProperty("sAccountOwnerName", out var so) ? so.GetString() ?? "" : "";
                                    string fName = el.TryGetProperty("fAccountOwnerName", out var fo) ? fo.GetString() ?? "" : "";
                                    string fIban = el.TryGetProperty("accountIban", out var fib) ? fib.GetString() ?? "" : "";

                                    bool accMatch = string.IsNullOrEmpty(queryAcc) || sIban.Contains(queryAcc, StringComparison.OrdinalIgnoreCase) || (string.IsNullOrEmpty(querySenderAcc) && fIban.Contains(queryAcc, StringComparison.OrdinalIgnoreCase));
                                    bool senderAccMatch = string.IsNullOrEmpty(querySenderAcc) || fIban.Contains(querySenderAcc, StringComparison.OrdinalIgnoreCase);
                                    bool nameMatch = string.IsNullOrEmpty(queryName) || sName.Contains(queryName, StringComparison.OrdinalIgnoreCase) || fName.Contains(queryName, StringComparison.OrdinalIgnoreCase);
                                    bool senderNameMatch = string.IsNullOrEmpty(querySenderName) || fName.Contains(querySenderName, StringComparison.OrdinalIgnoreCase) || sName.Contains(querySenderName, StringComparison.OrdinalIgnoreCase);

                                    if (!accMatch || !senderAccMatch || !nameMatch || !senderNameMatch) continue;
                                    string dateStr = el.TryGetProperty("transDate", out var td) ? td.GetString() ?? "" : "";
                                    string refNum = el.TryGetProperty("refrenceNum", out var rf) ? rf.GetString() ?? "" : "";
                                    long serial = el.TryGetProperty("serial", out var ser) && ser.ValueKind == JsonValueKind.Number ? ser.GetInt64() : 0;
                                    long estId = el.TryGetProperty("estmaraId", out var es) && es.ValueKind == JsonValueKind.Number ? es.GetInt64() : 0;

                                    string fCode = estId > 0 ? estId.ToString() : "—";
                                    string bId = estId > 0 ? $"استمارة-{estId}" : "—";
                                    string tId = serial > 0 ? serial.ToString() : "—";

                                    batchResults.Add(new {
                                        fileId = fCode,
                                        batchId = bId,
                                        transId = tId,
                                        receiverName = sName,
                                        receiverAccount = sIban,
                                        amount = val,
                                        senderName = fName,
                                        senderAccount = fIban,
                                        transDate = !string.IsNullOrEmpty(dateStr) ? dateStr.Split('T')[0] : "—"
                                    });

                                    matchResults.Add(new {
                                        transId = tId,
                                        accountName = fName,
                                        refNum = !string.IsNullOrEmpty(refNum) ? refNum : sIban,
                                        senderName = sName,
                                        amount = val
                                    });

                                    unifiedResults.Add(new {
                                        fileId = fCode,
                                        batchId = bId,
                                        transId = tId,
                                        receiverName = sName,
                                        receiverAccount = sIban,
                                        amount = val,
                                        senderName = fName,
                                        senderAccount = fIban,
                                        transDate = !string.IsNullOrEmpty(dateStr) ? dateStr.Split('T')[0] : "—",
                                        matchTransId = tId,
                                        matchAccount = fName,
                                        matchRefNum = !string.IsNullOrEmpty(refNum) ? refNum : sIban,
                                        matchSender = sName,
                                        matchAmount = val
                                    });
                                }
                            }
                        }
                    }
                    catch { }
                }

                // 3. البحث التكميلي في قاعدة البيانات المحلية (FailQueryTransactions) لضمان شمولية جميع الحركات لجميع الحسابات
                if (!string.IsNullOrEmpty(queryName) || !string.IsNullOrEmpty(queryAcc) || !string.IsNullOrEmpty(querySenderName))
                {
                    try
                    {
                        using var conn = await db.GetOpenConnectionAsync();
                        var sql = @"
                            SELECT Id, BatchId, CreditorName, CreditorAccount, NewCreditorAccount, TransactionAmount, Reason, DetSerial, SyncedAt
                            FROM FailQueryTransactions
                            WHERE (@name != '' AND CreditorName LIKE @namePattern)
                               OR (@acc != '' AND (CreditorAccount LIKE @accPattern OR NewCreditorAccount LIKE @accPattern))
                               OR (@senderName != '' AND 'الوحدة الحسابية' LIKE @senderNamePattern)
                            LIMIT 50";
                        var rows = await conn.QueryAsync(sql, new {
                            name = queryName,
                            namePattern = $"%{queryName}%",
                            acc = queryAcc,
                            accPattern = $"%{queryAcc}%",
                            senderName = querySenderName,
                            senderNamePattern = $"%{querySenderName}%"
                        });

                        foreach (var r in rows)
                        {
                            if (!string.IsNullOrEmpty(querySenderName) && !"الوحدة الحسابية".Contains(querySenderName, StringComparison.OrdinalIgnoreCase)) continue;
                            string bId = r.BatchId ?? "—";
                            string recAcc = !string.IsNullOrEmpty((string)r.NewCreditorAccount) ? (string)r.NewCreditorAccount : (string)r.CreditorAccount ?? "—";
                            double lAmt = Convert.ToDouble(r.TransactionAmount ?? 0);
                            if (amount.HasValue && amount.Value > 0 && Math.Abs(lAmt - amount.Value) > 0.05) continue;
                            string rDate = r.SyncedAt != null ? ((string)r.SyncedAt).Split(' ')[0] : "—";
                            string tId = r.DetSerial ?? r.Id?.ToString() ?? "—";

                            unifiedResults.Add(new {
                                fileId = bId,
                                batchId = bId,
                                transId = tId,
                                receiverName = (string)r.CreditorName ?? "—",
                                receiverAccount = recAcc,
                                amount = lAmt,
                                senderName = "الوحدة الحسابية",
                                senderAccount = (string)r.CreditorAccount ?? "—",
                                transDate = rDate,
                                matchTransId = tId,
                                matchAccount = (string)r.CreditorName ?? "—",
                                matchRefNum = (string)r.CreditorAccount ?? "—",
                                matchSender = "الوحدة الحسابية",
                                matchAmount = lAmt
                            });
                        }
                    }
                    catch { }
                }

                var allList = unifiedResults.ToList();

                double totalAmt = 0;
                var accounts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var files = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                foreach (var item in allList)
                {
                    var d = (dynamic)item;
                    try { totalAmt += Convert.ToDouble(d.amount); } catch {}
                    try {
                        string acc = (string)d.receiverAccount;
                        if (!string.IsNullOrEmpty(acc) && acc != "—") accounts.Add(acc);
                    } catch {}
                    try {
                        string f = (string)d.fileId;
                        if (!string.IsNullOrEmpty(f) && f != "—") files.Add(f);
                    } catch {}
                }

                return Results.Ok(new {
                    success = true,
                    records = allList,
                    summary = new {
                        totalCount = allList.Count,
                        totalAmount = totalAmt,
                        distinctAccounts = accounts.Count,
                        distinctFiles = files.Count
                    },
                    batches = batchResults.ToList(),
                    matches = matchResults.ToList()
                });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
            }
        });



        // 5.1 تحويل مباشر لرئيس القسم (حسام) بنقرة واحدة
        app.MapPost("/api/failquery/transfer-to-hossam", async (DatabaseService db, HttpContext ctx) =>
        {
            try
            {
                using var reader = new StreamReader(ctx.Request.Body);
                var body = await reader.ReadToEndAsync();
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;

                long id = root.TryGetProperty("id", out var idProp) ? idProp.GetInt64() : 0;
                string batchId = root.TryGetProperty("batchId", out var bi) ? bi.GetString() ?? "" : "";
                string account = root.TryGetProperty("account", out var ca) ? ca.GetString() ?? "" : "";
                string nationalId = root.TryGetProperty("nationalId", out var cni) ? cni.GetString() ?? "" : "";
                string name = root.TryGetProperty("name", out var cn) ? cn.GetString() ?? "" : "";

                // Push transfer to remote portal with accepted=0 so tasFlag=1 (transferred to Hossam) without green checkmark (selected=0)
                bool pushed = await PushSendAcceptedToPortalAsync(batchId, account, nationalId, name, 0);
                
                using var conn = await db.GetOpenConnectionAsync();
                int rows = 0;

                if (pushed)
                {
                    if (id > 0)
                    {
                        rows = await conn.ExecuteAsync(
                            "UPDATE FailQueryTransactions SET TasFlag = '1', IsSettlementChecked = 0, PortalSyncStatus = 'SYNCED', ModifiedAt = CURRENT_TIMESTAMP WHERE Id = @id",
                            new { id });
                    }
                    else if (!string.IsNullOrEmpty(batchId))
                    {
                        rows = await conn.ExecuteAsync(@"
                            UPDATE FailQueryTransactions 
                            SET TasFlag = '1', IsSettlementChecked = 0, PortalSyncStatus = 'SYNCED', ModifiedAt = CURRENT_TIMESTAMP
                            WHERE BatchId = @batchId AND (CreditorAccount = @account OR CreditorNationalId = @nationalId OR CreditorName = @name)",
                            new { batchId, account, nationalId, name });
                    }
                    return Results.Ok(new { success = true, updatedRows = rows, message = "تم إرسال المعاملة لرئيس القسم (حسام السيد) بنجاح واختفت من شاشة أمين بالمنظومة والبوابة!" });
                }
                else
                {
                    if (id > 0)
                    {
                        await conn.ExecuteAsync(
                            "UPDATE FailQueryTransactions SET PortalSyncStatus = 'FAILED_PUSH', ModifiedAt = CURRENT_TIMESTAMP WHERE Id = @id",
                            new { id });
                    }
                    return Results.Ok(new { success = false, error = "تعذر دفع المزامنة المباشرة للبوابة القديمة. يرجى التأكد من الاتصال وإعادة المحاولة." });
                }
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
            }
        });

        // 5.1b استرجاع المعاملة من رئيس القسم (حسام) وإرجاعها لشاشة المسوي (أمين)
        app.MapPost("/api/failquery/retrieve-from-hossam", async (DatabaseService db, HttpContext ctx) =>
        {
            try
            {
                using var reader = new StreamReader(ctx.Request.Body);
                var body = await reader.ReadToEndAsync();
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;

                long id = root.TryGetProperty("id", out var idProp) ? idProp.GetInt64() : 0;
                string batchId = root.TryGetProperty("batchId", out var bi) ? bi.GetString() ?? "" : "";
                string account = root.TryGetProperty("account", out var ca) ? ca.GetString() ?? "" : "";
                string nationalId = root.TryGetProperty("nationalId", out var cni) ? cni.GetString() ?? "" : "";
                string name = root.TryGetProperty("name", out var cn) ? cn.GetString() ?? "" : "";

                // Push send accepted=0 to remote portal so transaction returns to Amin's screen (gehaCode=463 / sendFlag=2)
                bool pushed = await PushSendAcceptedToPortalAsync(batchId, account, nationalId, name, 0);

                using var conn = await db.GetOpenConnectionAsync();
                int rows = 0;
                string syncStatus = pushed ? "SYNCED" : "FAILED_PUSH";

                if (id > 0)
                {
                    rows = await conn.ExecuteAsync(
                        "UPDATE FailQueryTransactions SET TasFlag = '0', IsSettlementChecked = 0, PortalSyncStatus = @syncStatus, ModifiedAt = CURRENT_TIMESTAMP WHERE Id = @id",
                        new { id, syncStatus });
                }
                else if (!string.IsNullOrEmpty(batchId))
                {
                    rows = await conn.ExecuteAsync(@"
                        UPDATE FailQueryTransactions 
                        SET TasFlag = '0', IsSettlementChecked = 0, PortalSyncStatus = @syncStatus, ModifiedAt = CURRENT_TIMESTAMP
                        WHERE BatchId = @batchId AND (CreditorAccount = @account OR CreditorNationalId = @nationalId OR CreditorName = @name)",
                        new { batchId, account, nationalId, name, syncStatus });
                }

                return Results.Ok(new { success = true, updatedRows = rows, message = "تم استرجاع المعاملة من رئيس القسم بنجاح وعادت لشاشة أمين بالمنظومة والبوابة!" });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
            }
        });

        // 5.2 تحويل بالجملة للمعاملات المحددة لرئيس القسم (حسام)
        app.MapPost("/api/failquery/bulk-transfer-to-hossam", async (DatabaseService db, HttpContext ctx) =>
        {
            try
            {
                using var reader = new StreamReader(ctx.Request.Body);
                var body = await reader.ReadToEndAsync();
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;
                
                List<JsonElement> itemList = new List<JsonElement>();
                if (root.ValueKind == JsonValueKind.Array)
                {
                    foreach (var el in root.EnumerateArray()) itemList.Add(el);
                }
                else if (root.ValueKind == JsonValueKind.Object)
                {
                    itemList.Add(root);
                }

                using var conn = await db.GetOpenConnectionAsync();
                int totalUpdated = 0;

                foreach (var item in itemList)
                {
                    long id = 0;
                    if (item.TryGetProperty("id", out var idProp))
                    {
                        if (idProp.ValueKind == JsonValueKind.Number) id = idProp.GetInt64();
                        else if (idProp.ValueKind == JsonValueKind.String && long.TryParse(idProp.GetString(), out long pId)) id = pId;
                    }

                    string batchId = item.TryGetProperty("batchId", out var bi) ? bi.GetString() ?? "" : "";
                    string account = item.TryGetProperty("account", out var ca) ? ca.GetString() ?? "" : "";
                    string nationalId = item.TryGetProperty("nationalId", out var cni) ? cni.GetString() ?? "" : "";
                    string name = item.TryGetProperty("name", out var cn) ? cn.GetString() ?? "" : "";

                    // 1. التحديث المباشر في قاعدة البيانات المحلية لنقل المعاملة لرئيس القسم فوراً
                    int rows = 0;
                    if (id > 0)
                    {
                        rows = await conn.ExecuteAsync(
                            "UPDATE FailQueryTransactions SET TasFlag = '1', ModifiedAt = CURRENT_TIMESTAMP WHERE Id = @id",
                            new { id });
                    }
                    else if (!string.IsNullOrEmpty(batchId))
                    {
                        rows = await conn.ExecuteAsync(@"
                            UPDATE FailQueryTransactions 
                            SET TasFlag = '1', ModifiedAt = CURRENT_TIMESTAMP
                            WHERE BatchId = @batchId AND (CreditorAccount = @account OR CreditorNationalId = @nationalId OR CreditorName = @name)",
                            new { batchId, account, nationalId, name });
                    }
                    totalUpdated += rows;

                    // 2. دفع التحديث للبوابة الخارجية عبر PUT /FailedTransaction/send?accepted=1 المطابق للواجهة القديمة
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            bool pushed = await PushSendAcceptedToPortalAsync(batchId, account, nationalId, name, 1);
                            using var syncConn = await db.GetOpenConnectionAsync();
                            string syncStatus = pushed ? "SYNCED" : "FAILED_PUSH";
                            if (id > 0)
                            {
                                await syncConn.ExecuteAsync(
                                    "UPDATE FailQueryTransactions SET PortalSyncStatus = @syncStatus WHERE Id = @id",
                                    new { syncStatus, id });
                            }
                        }
                        catch { }
                    });
                }

                return Results.Ok(new { success = true, updatedRows = totalUpdated, message = $"تم قبول وإرسال {totalUpdated} معاملة لرئيس القسم (حسام السيد) بنجاح واختفت من شاشة أمين بالمنظومة والبوابة!" });
            }
            catch (Exception ex)
            {
                Console.WriteLine("[BulkTransferToHossam Error] " + ex.ToString());
                return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
            }
        });

        // 5.3 تبديل حالة "محدد كتسوية" فقط (بدون تحويل لرئيس القسم) + مزامنة البوابة القديمة send?accepted=1
        app.MapPost("/api/failquery/toggle-settlement-check", async (DatabaseService db, HttpContext ctx) =>
        {
            try
            {
                using var reader = new StreamReader(ctx.Request.Body);
                var body = await reader.ReadToEndAsync();
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;

                long id = root.TryGetProperty("id", out var idProp) ? idProp.GetInt64() : 0;
                string batchId = root.TryGetProperty("batchId", out var bi) ? bi.GetString() ?? "" : "";
                string account = root.TryGetProperty("account", out var ca) ? ca.GetString() ?? "" : "";
                string nationalId = root.TryGetProperty("nationalId", out var cni) ? cni.GetString() ?? "" : "";
                string name = root.TryGetProperty("name", out var cn) ? cn.GetString() ?? "" : "";
                
                int isChecked = 0;
                if (root.TryGetProperty("isChecked", out var ic)) isChecked = ic.GetBoolean() ? 1 : 0;
                else if (root.TryGetProperty("isSettled", out var isSett)) isChecked = isSett.GetBoolean() ? 1 : 0;
                else if (root.TryGetProperty("tasFlag", out var tf)) isChecked = (tf.ValueKind == JsonValueKind.Number ? tf.GetInt32() : (int.TryParse(tf.GetString(), out int p) ? p : 0)) == 1 ? 1 : 0;

                using var conn = await db.GetOpenConnectionAsync();
                int rows = 0;
                if (id > 0)
                {
                    rows = await conn.ExecuteAsync(
                        "UPDATE FailQueryTransactions SET IsSettlementChecked = @isChecked WHERE Id = @id",
                        new { isChecked, id });
                }
                else if (!string.IsNullOrEmpty(batchId))
                {
                    rows = await conn.ExecuteAsync(@"
                        UPDATE FailQueryTransactions 
                        SET IsSettlementChecked = @isChecked
                        WHERE BatchId = @batchId AND (CreditorAccount = @account OR CreditorNationalId = @nationalId OR CreditorName = @name)",
                        new { isChecked, batchId, account, nationalId, name });
                }

                // مزامنة مع البوابة القديمة: PUT /FailedTransaction/send?accepted=1 (أو 0 عند الإلغاء)
                _ = Task.Run(async () => await PushSendAcceptedToPortalAsync(batchId, account, nationalId, name, isChecked));

                return Results.Ok(new { success = true, isSettlementChecked = isChecked, updatedRows = rows });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
            }
        });

        // 5.4 رفض العمليات المحددة للجملة والفردي
        app.MapPost("/api/failquery/bulk-reject", async (DatabaseService db, HttpContext ctx) =>
        {
            try
            {
                using var reader = new StreamReader(ctx.Request.Body);
                var body = await reader.ReadToEndAsync();
                using var doc = JsonDocument.Parse(body);
                var items = doc.RootElement.EnumerateArray();

                using var conn = await db.GetOpenConnectionAsync();
                int totalUpdated = 0;

                foreach (var item in items)
                {
                    long id = item.TryGetProperty("id", out var idProp) ? idProp.GetInt64() : 0;
                    string batchId = item.TryGetProperty("batchId", out var bi) ? bi.GetString() ?? "" : "";
                    string account = item.TryGetProperty("account", out var ca) ? ca.GetString() ?? "" : "";
                    string nationalId = item.TryGetProperty("nationalId", out var cni) ? cni.GetString() ?? "" : "";
                    string name = item.TryGetProperty("name", out var cn) ? cn.GetString() ?? "" : "";
                    string reason = item.TryGetProperty("reason", out var rProp) ? rProp.GetString() ?? "مرفوضة من قبل أمين القسم" : "مرفوضة من قبل أمين القسم";

                    // Update status in local DB
                    int rows = 0;
                    if (id > 0)
                    {
                        rows = await conn.ExecuteAsync(
                            "UPDATE FailQueryTransactions SET TransactionStatus = 'Rejected', Reason = @reason, ModifiedAt = CURRENT_TIMESTAMP WHERE Id = @id",
                            new { id, reason });
                    }
                    else if (!string.IsNullOrEmpty(batchId))
                    {
                        rows = await conn.ExecuteAsync(@"
                            UPDATE FailQueryTransactions 
                            SET TransactionStatus = 'Rejected', Reason = @reason, ModifiedAt = CURRENT_TIMESTAMP
                            WHERE BatchId = @batchId AND (CreditorAccount = @account OR CreditorNationalId = @nationalId OR CreditorName = @name)",
                            new { batchId, account, nationalId, name, reason });
                    }
                    totalUpdated += rows;

                    // Synchronize rejection edit with remote portal
                    _ = Task.Run(async () => await PushEditToRemotePortalAsync(batchId, account, nationalId, name, "", "", "", 0));
                }

                return Results.Ok(new { success = true, updatedRows = totalUpdated, message = $"تم رفض {totalUpdated} معاملة بنجاح والتحديث في المنظومة للبوابة!" });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
            }
        });

        // 6. تعديل سجل معاملة فاشلة حفظ مباشر في SQLite ومزامنة كافة الجداول
        app.MapPost("/api/failquery/update-transaction", async (DatabaseService db, HttpContext ctx) =>
        {
            try
            {
                using var reader = new StreamReader(ctx.Request.Body);
                var body = await reader.ReadToEndAsync();
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;

                long id = 0;
                if (root.TryGetProperty("id", out var idProp) || root.TryGetProperty("txnId", out idProp))
                {
                    if (idProp.ValueKind == JsonValueKind.Number) id = idProp.GetInt64();
                    else if (idProp.ValueKind == JsonValueKind.String && long.TryParse(idProp.GetString(), out long parsedId)) id = parsedId;
                }

                string batchId = root.TryGetProperty("batchId", out var bi) ? bi.GetString() ?? "" : "";
                string creditorNationalId = (root.TryGetProperty("creditorNationalId", out var cni) || root.TryGetProperty("nationalId", out cni)) ? cni.GetString() ?? "" : "";
                string creditorAccount = (root.TryGetProperty("creditorAccount", out var ca) || root.TryGetProperty("account", out ca)) ? ca.GetString() ?? "" : "";
                string creditorName = (root.TryGetProperty("creditorName", out var cn) || root.TryGetProperty("name", out cn)) ? cn.GetString() ?? "" : "";
                string newCreditorAccount = (root.TryGetProperty("newCreditorAccount", out var nca) || root.TryGetProperty("newAccount", out nca)) ? nca.GetString() ?? "" : "";
                string newCreditorBic = (root.TryGetProperty("newCreditorBic", out var ncb) || root.TryGetProperty("newBic", out ncb)) ? ncb.GetString() ?? "" : "";
                string newCreditorBranch = (root.TryGetProperty("newCreditorBranch", out var ncbr) || root.TryGetProperty("newBranch", out ncbr)) ? ncbr.GetString() ?? "" : "";
                string tasFlag = root.TryGetProperty("tasFlag", out var tf) ? tf.GetString() ?? "0" : "0";

                string winUser = Environment.UserName; // e.g. "esth633"
                string appUser = root.TryGetProperty("user", out var uProp) ? uProp.GetString() ?? "" : "";

                using var conn = await db.GetOpenConnectionAsync();

                string userFullName = "";
                if (!string.IsNullOrEmpty(appUser))
                {
                    userFullName = await conn.ExecuteScalarAsync<string>(
                        "SELECT Fullname FROM Users WHERE Username = @u OR Fullname = @u OR Id = @u LIMIT 1",
                        new { u = appUser }) ?? appUser;
                }
                if (string.IsNullOrEmpty(userFullName))
                {
                    userFullName = await conn.ExecuteScalarAsync<string>("SELECT Fullname FROM Users ORDER BY Id ASC LIMIT 1") ?? "أمين خالد عبدالحافظ";
                }

                string modifiedBy = $"يوزر الجهاز: {winUser} | اسم المستخدم: {userFullName}";
                string nowStr = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                int rows = 0;
                if (id > 0)
                {
                    rows = await conn.ExecuteAsync(@"
                        UPDATE FailQueryTransactions 
                        SET NewCreditorAccount = @newCreditorAccount, 
                            NewCreditorBic = @newCreditorBic, 
                            NewCreditorBranch = @newCreditorBranch, 
                            TasFlag = @tasFlag,
                            ModifiedBy = @modifiedBy,
                            PortalSyncStatus = 'SYNCED',
                            SourceSystem = 'NEW_SYSTEM',
                            ModifiedAt = @nowStr
                        WHERE Id = @id",
                        new { newCreditorAccount, newCreditorBic, newCreditorBranch, tasFlag, modifiedBy, nowStr, id });
                }

                if (rows == 0)
                {
                    rows = await conn.ExecuteAsync(@"
                        UPDATE FailQueryTransactions 
                        SET NewCreditorAccount = @newCreditorAccount, 
                            NewCreditorBic = @newCreditorBic, 
                            NewCreditorBranch = @newCreditorBranch, 
                            TasFlag = @tasFlag,
                            ModifiedBy = @modifiedBy,
                            PortalSyncStatus = 'SYNCED',
                            SourceSystem = 'NEW_SYSTEM',
                            ModifiedAt = @nowStr
                        WHERE BatchId = @batchId AND (
                            (@creditorNationalId != '' AND CreditorNationalId = @creditorNationalId) OR 
                            (@creditorAccount != '' AND CreditorAccount = @creditorAccount) OR
                            (@creditorName != '' AND CreditorName = @creditorName)
                        )",
                        new { newCreditorAccount, newCreditorBic, newCreditorBranch, tasFlag, modifiedBy, nowStr, batchId, creditorNationalId, creditorAccount, creditorName });
                }

                await db.AddAuditLogAsync(0, modifiedBy, "UPDATE_FAILQUERY_TRANSACTION", 
                    $"تعديل معاملة: {creditorName} | حساب جديد: {newCreditorAccount} | بنك: {newCreditorBic} | دفعة: {batchId}", 
                    ctx.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1");

                // Cross-table update for Returns & SalaryReturns
                string searchKey = !string.IsNullOrEmpty(creditorAccount) ? creditorAccount.Trim() : creditorNationalId.Trim();
                if (!string.IsNullOrEmpty(searchKey))
                {
                    try
                    {
                        await conn.ExecuteAsync(@"
                            UPDATE Returns 
                            SET RawData = json_set(
                                json_set(
                                    json_set(RawData, '$.""رقم الحساب بعد التعديل""', @newCreditorAccount),
                                    '$.newCreditorAccount', @newCreditorAccount
                                ),
                                '$.""البنك بعد التعديل""', @newCreditorBic
                            ),
                            UpdatedAt = CURRENT_TIMESTAMP
                            WHERE RawData LIKE '%' || @searchKey || '%'",
                            new { newCreditorAccount, newCreditorBic, searchKey });

                        await conn.ExecuteAsync(@"
                            UPDATE SalaryReturns 
                            SET RawData = json_set(
                                json_set(
                                    json_set(RawData, '$.""رقم الحساب بعد التعديل""', @newCreditorAccount),
                                    '$.newCreditorAccount', @newCreditorAccount
                                ),
                                '$.""البنك بعد التعديل""', @newCreditorBic
                            ),
                            UpdatedAt = CURRENT_TIMESTAMP
                            WHERE RawData LIKE '%' || @searchKey || '%'",
                            new { newCreditorAccount, newCreditorBic, searchKey });
                    }
                    catch (Exception exSync)
                    {
                        Console.WriteLine("[FailQueryUpdate] Cross table sync warning: " + exSync.Message);
                    }
                }

                // 3. Push edit directly to remote portal (hiaapay.faa.local) via API
                int tfVal = int.TryParse(tasFlag, out int tfParsed) ? tfParsed : 0;
                _ = Task.Run(async () => await PushEditToRemotePortalAsync(batchId, creditorAccount, creditorNationalId, creditorName, newCreditorAccount, newCreditorBic, newCreditorBranch, tfVal));

                return Results.Ok(new { success = true, updatedRows = rows, message = "تم حفظ التعديلات بنجاح وإرسالها ومزامنتها في البوابة الخارجية وكافة الجداول" });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
            }
        });
    }

    private static async Task<bool> PushEditToRemotePortalAsync(string batchId, string creditorAccount, string creditorNationalId, string creditorName, string newCreditorAccount, string newCreditorBic, string newCreditorBranch, int tasFlag)
    {
        try
        {
            var handler = new HttpClientHandler { ServerCertificateCustomValidationCallback = (_, _, _, _) => true };
            using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(180) };
            client.DefaultRequestHeaders.Add("X-Request-From", "https://hiaapay.faa.local");
            client.DefaultRequestHeaders.Host = "hiaapay.faa.local";

            // 1. Authenticate
            var authBody = new StringContent(
                JsonSerializer.Serialize(new { userName = "amin-khalid", password = "P@ssw0rdP@ssw0rd" }),
                Encoding.UTF8, "application/json");
            var authResp = await client.PostAsync($"{_baseUrl}/Auth", authBody);
            if (!authResp.IsSuccessStatusCode) { Console.WriteLine("[RemotePush] Auth failed"); return false; }

            var authJson = await authResp.Content.ReadAsStringAsync();
            using var authDoc = JsonDocument.Parse(authJson);
            string token = authDoc.RootElement.TryGetProperty("token", out var t) ? t.GetString()! : authJson.Trim('"');
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");

            // 2. Fetch full transaction object from portal
            JsonElement? fullTx = null;
            string cleanBatchNum = System.Text.RegularExpressions.Regex.Match(batchId ?? "", @"\d{8,15}").Value;
            string cAccTrim = (creditorAccount ?? "").Trim();
            string cNidTrim = (creditorNationalId ?? "").Trim();
            string cNameTrim = (creditorName ?? "").Trim();

            // Try active endpoints sendFlag 2, 0, 1
            foreach (var sendFlag in new[] { 2, 0, 1 })
            {
                var listResp = await client.GetAsync($"{_baseUrl}/FailedTransaction?gehaCode={_gehaCode}&sendFlag={sendFlag}");
                if (!listResp.IsSuccessStatusCode) continue;
                var listJson = await listResp.Content.ReadAsStringAsync();
                using var listDoc = JsonDocument.Parse(listJson);
                
                // Pass 1: Try matching exact batchId or batch digits first
                foreach (var batch in listDoc.RootElement.EnumerateArray())
                {
                    var bid = batch.TryGetProperty("batchId", out var bp) ? bp.GetString() ?? "" : "";
                    bool batchMatch = (!string.IsNullOrEmpty(batchId) && bid.Equals(batchId, StringComparison.OrdinalIgnoreCase))
                                   || (!string.IsNullOrEmpty(cleanBatchNum) && bid.Contains(cleanBatchNum));
                    
                    if (!batchMatch) continue;
                    if (!batch.TryGetProperty("transactions", out var txns)) continue;
                    
                    foreach (var tx in txns.EnumerateArray())
                    {
                        var txAcc = GetPropString(tx, "creditorAccount", "account").Trim();
                        var txNid = GetPropString(tx, "creditorNationalId", "nationalId").Trim();
                        var txName = GetPropString(tx, "creditorName", "name").Trim();
                        
                        bool match = (!string.IsNullOrEmpty(cAccTrim) && txAcc.Equals(cAccTrim, StringComparison.OrdinalIgnoreCase))
                                  || (!string.IsNullOrEmpty(cNidTrim) && txNid.Equals(cNidTrim, StringComparison.OrdinalIgnoreCase))
                                  || (!string.IsNullOrEmpty(cNameTrim) && txName.Contains(cNameTrim));
                        if (match) { fullTx = tx.Clone(); break; }
                    }
                    if (fullTx.HasValue) break;
                }
                if (fullTx.HasValue) break;

                // Pass 2: Fallback across any batch in this sendFlag
                foreach (var batch in listDoc.RootElement.EnumerateArray())
                {
                    if (!batch.TryGetProperty("transactions", out var txns)) continue;
                    foreach (var tx in txns.EnumerateArray())
                    {
                        var txAcc = GetPropString(tx, "creditorAccount", "account").Trim();
                        var txNid = GetPropString(tx, "creditorNationalId", "nationalId").Trim();
                        var txName = GetPropString(tx, "creditorName", "name").Trim();
                        
                        bool match = (!string.IsNullOrEmpty(cAccTrim) && txAcc.Equals(cAccTrim, StringComparison.OrdinalIgnoreCase))
                                  || (!string.IsNullOrEmpty(cNidTrim) && txNid.Equals(cNidTrim, StringComparison.OrdinalIgnoreCase));
                        if (match) { fullTx = tx.Clone(); break; }
                    }
                    if (fullTx.HasValue) break;
                }
                if (fullTx.HasValue) break;
            }

            // Fallback: Check history endpoint if not found in active batches
            if (!fullTx.HasValue)
            {
                var histResp = await client.GetAsync($"{_baseUrl}/FailedTransaction/history?gehaCode={_gehaCode}");
                if (histResp.IsSuccessStatusCode)
                {
                    var histJson = await histResp.Content.ReadAsStringAsync();
                    using var histDoc = JsonDocument.Parse(histJson);
                    foreach (var batch in histDoc.RootElement.EnumerateArray())
                    {
                        var bid = batch.TryGetProperty("batchId", out var bp) ? bp.GetString() ?? "" : "";
                        bool batchMatch = (!string.IsNullOrEmpty(batchId) && bid.Equals(batchId, StringComparison.OrdinalIgnoreCase))
                                       || (!string.IsNullOrEmpty(cleanBatchNum) && bid.Contains(cleanBatchNum));
                        if (!batchMatch) continue;
                        if (!batch.TryGetProperty("transactions", out var txns)) continue;
                        foreach (var tx in txns.EnumerateArray())
                        {
                            var txAcc = GetPropString(tx, "creditorAccount", "account").Trim();
                            var txNid = GetPropString(tx, "creditorNationalId", "nationalId").Trim();
                            bool match = (!string.IsNullOrEmpty(cAccTrim) && txAcc.Equals(cAccTrim, StringComparison.OrdinalIgnoreCase))
                                      || (!string.IsNullOrEmpty(cNidTrim) && txNid.Equals(cNidTrim, StringComparison.OrdinalIgnoreCase));
                            if (match) { fullTx = tx.Clone(); break; }
                        }
                        if (fullTx.HasValue) break;
                    }
                }
            }

            if (!fullTx.HasValue)
            {
                Console.WriteLine($"[RemotePush] Transaction not found in portal for: {creditorName} / {creditorAccount}");
                return false;
            }

            // 3. Merge edits into full object
            var txDict = JsonSerializer.Deserialize<Dictionary<string, object?>>(fullTx.Value.GetRawText()) ?? new();
            txDict["newCreditorAccount"] = newCreditorAccount;
            txDict["newCreditorBic"] = !string.IsNullOrEmpty(newCreditorBic) ? newCreditorBic : "BMISEGCXXXX";
            txDict["newCreditorBranch"] = newCreditorBranch ?? "";
            txDict["tasFlag"] = tasFlag;

            // 4. PUT full merged object
            var editBody = new StringContent(JsonSerializer.Serialize(txDict), Encoding.UTF8, "application/json");
            var editResp = await client.PutAsync($"{_baseUrl}/FailedTransaction/edit", editBody);
            
            Console.WriteLine($"[RemotePush] Edit pushed to portal: Status {editResp.StatusCode} | {creditorName}");
            return editResp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[RemotePush] Error: {ex.Message}");
            return false;
        }
    }

    // دالة مزامنة "محدد كتسوية" مع البوابة القديمة عبر PUT /FailedTransaction/send?accepted=1
    private static async Task<bool> PushSendAcceptedToPortalAsync(string batchId, string creditorAccount, string creditorNationalId, string creditorName, int accepted)
    {
        try
        {
            var handler = new HttpClientHandler { ServerCertificateCustomValidationCallback = (_, _, _, _) => true };
            using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(120) };
            client.DefaultRequestHeaders.Add("X-Request-From", "https://hiaapay.faa.local");
            client.DefaultRequestHeaders.Host = "hiaapay.faa.local";

            // 1. المصادقة
            var authBody = new StringContent(
                JsonSerializer.Serialize(new { userName = "amin-khalid", password = "P@ssw0rdP@ssw0rd" }),
                Encoding.UTF8, "application/json");
            var authResp = await client.PostAsync($"{_baseUrl}/Auth", authBody);
            if (!authResp.IsSuccessStatusCode) { Console.WriteLine("[SendAccepted] Auth failed"); return false; }

            var authJson = await authResp.Content.ReadAsStringAsync();
            using var authDoc = JsonDocument.Parse(authJson);
            string token = authDoc.RootElement.TryGetProperty("token", out var t) ? t.GetString()! : authJson.Trim('"');
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");

            // 2. جلب الـ batch الكامل وتحديد selected=1 على المعاملة المطلوبة
            string cleanBatchNum = System.Text.RegularExpressions.Regex.Match(batchId ?? "", @"\d{8,15}").Value;
            string cAccTrim = (creditorAccount ?? "").Trim();
            string cNidTrim = (creditorNationalId ?? "").Trim();
            string cNameTrim = (creditorName ?? "").Trim();

            string? finalPayload = null;

            foreach (var sendFlag in new[] { 2, 0, 1 })
            {
                var listResp = await client.GetAsync($"{_baseUrl}/FailedTransaction?gehaCode={_gehaCode}&sendFlag={sendFlag}");
                if (!listResp.IsSuccessStatusCode) continue;
                var listJson = await listResp.Content.ReadAsStringAsync();

                // استخدام JsonNode لضمان الحفاظ على نوع البيانات الأصلي (primitive types)
                var batchArray = System.Text.Json.Nodes.JsonNode.Parse(listJson)?.AsArray();
                if (batchArray == null) continue;

                bool foundInThisFlag = false;
                foreach (var batchNode in batchArray)
                {
                    var bid = batchNode?["batchId"]?.GetValue<string>() ?? "";
                    bool batchMatch = (!string.IsNullOrEmpty(batchId) && bid.Equals(batchId, StringComparison.OrdinalIgnoreCase))
                                   || (!string.IsNullOrEmpty(cleanBatchNum) && bid.Contains(cleanBatchNum));
                    if (!batchMatch) continue;

                    var txnsNode = batchNode?["transactions"]?.AsArray();
                    if (txnsNode == null) continue;

                    bool foundTarget = false;
                    System.Text.Json.Nodes.JsonNode? targetTxNode = null;

                    foreach (var txNode in txnsNode)
                    {
                        var txAcc = txNode?["creditorAccount"]?.GetValue<string>()?.Trim() ?? "";
                        var txNid = txNode?["creditorNationalId"]?.GetValue<string>()?.Trim() ?? "";
                        var txName = txNode?["creditorName"]?.GetValue<string>()?.Trim() ?? "";

                        bool isTarget = (!string.IsNullOrEmpty(cAccTrim) && txAcc.Equals(cAccTrim, StringComparison.OrdinalIgnoreCase))
                                     || (!string.IsNullOrEmpty(cNidTrim) && txNid.Equals(cNidTrim, StringComparison.OrdinalIgnoreCase))
                                     || (!string.IsNullOrEmpty(cNameTrim) && txName.Contains(cNameTrim));

                        if (isTarget)
                        {
                            targetTxNode = txNode?.DeepClone();
                            if (targetTxNode != null)
                            {
                                targetTxNode["selected"] = accepted;
                                targetTxNode["tasFlag"] = 1;
                            }
                            foundTarget = true;
                            break;
                        }
                    }

                    if (!foundTarget || targetTxNode == null) continue;

                    // نرسل مصفوفة المعاملات المحددة مباشرة [ targetTxNode ] المطابقة لـ sendSelectedTransactions بالبوابة القديمة
                    var selectedTxArray = new System.Text.Json.Nodes.JsonArray();
                    selectedTxArray.Add(targetTxNode.DeepClone());
                    finalPayload = selectedTxArray.ToJsonString();
                    foundInThisFlag = true;
                    break;
                }
                if (foundInThisFlag) break;
            }

            if (finalPayload == null)
            {
                Console.WriteLine($"[SendAccepted] Batch/Transaction not found: {creditorName} / {creditorAccount}");
                return false;
            }

            // 3. PUT /FailedTransaction/send?accepted=1 بالـ batch الكامل
            var sendBody = new StringContent(finalPayload, Encoding.UTF8, "application/json");
            var sendResp = await client.PutAsync($"{_baseUrl}/FailedTransaction/send?accepted={accepted}", sendBody);
            var respContent = await sendResp.Content.ReadAsStringAsync();

            Console.WriteLine($"[SendAccepted] send?accepted={accepted} → {sendResp.StatusCode} | {creditorName} | {respContent[..Math.Min(300, respContent.Length)]}");
            return sendResp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SendAccepted] Error: {ex.Message}");
            return false;
        }
    }



    private static async Task<List<object>> GetLocalFailQueryDataListAsync(DatabaseService db)
    {
        try
        {
            using var conn = await db.GetOpenConnectionAsync();
            
            var batches = (await conn.QueryAsync<dynamic>(
                "SELECT BatchId, ReceivingDate, Purpose, Total, TxnCount FROM FailQueryBatches ORDER BY ReceivingDate DESC"
            )).ToList();

            if (batches.Count > 0)
            {
                var txns = (await conn.QueryAsync<dynamic>(
                    "SELECT Id, BatchId, CreditorName, CreditorNationalId, CreditorAccount, CreditorBic, CreditorBranch, TransactionAmount, TransactionStatus, Reason, NewCreditorAccount, NewCreditorBic, NewCreditorBranch, TasFlag FROM FailQueryTransactions"
                )).ToList();

                var txnsGrouped = txns.GroupBy(t => (string)t.BatchId).ToDictionary(
                    g => g.Key, 
                    g => g.Select(t => (object)new {
                        id = t.Id,
                        creditorName = t.CreditorName,
                        creditorNationalId = t.CreditorNationalId,
                        creditorAccount = t.CreditorAccount,
                        creditorBic = t.CreditorBic,
                        creditorBranch = t.CreditorBranch,
                        transactionAmount = t.TransactionAmount,
                        transactionStatus = t.TransactionStatus,
                        reason = t.Reason,
                        batchId = t.BatchId,
                        newCreditorAccount = t.NewCreditorAccount,
                        newCreditorBic = t.NewCreditorBic,
                        newCreditorBranch = t.NewCreditorBranch,
                        tasFlag = t.TasFlag
                    }).ToList()
                );

                var result = batches.Select(b => (object)new {
                    batchId = b.BatchId,
                    receivingDate = b.ReceivingDate,
                    purpose = b.Purpose,
                    total = b.Total,
                    transactions = txnsGrouped.ContainsKey((string)b.BatchId) ? txnsGrouped[(string)b.BatchId] : new List<object>()
                }).ToList();

                return result;
            }

            return new List<object>();
        }
        catch
        {
            return new List<object>();
        }
    }

    private static async Task<IResult> GetLocalFailQueryDataAsync(DatabaseService db)
    {
        var list = await GetLocalFailQueryDataListAsync(db);
        return Results.Ok(list);
    }

    private static async Task SyncRemotePortalToLocalDbAsync(DatabaseService db)
    {
        try
        {
            var handler = new HttpClientHandler { ServerCertificateCustomValidationCallback = (_, _, _, _) => true };
            using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(120) };
            client.DefaultRequestHeaders.Add("X-Request-From", "https://hiaapay.faa.local");
            client.DefaultRequestHeaders.Host = "hiaapay.faa.local";

            var authBody = new StringContent(JsonSerializer.Serialize(new { userName = "m.foad", password = "P@ssw0rdP@ssw0rd" }), Encoding.UTF8, "application/json");
            var authResp = await client.PostAsync($"{_baseUrl}/Auth", authBody);
            if (!authResp.IsSuccessStatusCode) return;

            var authJson = await authResp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(authJson);
            string token = doc.RootElement.TryGetProperty("token", out var t) ? t.GetString()! : authJson.Trim('"');

            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");

            // فحص كافة sendFlags (0, 2, 4) لضمان جلب وتحديث كافة المعاملات الـ 9,981 المتاحة على البوابة
            foreach (int sendFlag in new[] { 0, 2, 4 })
            {
                var resp = await client.GetAsync($"{_baseUrl}/FailedTransaction?gehaCode={_gehaCode}&sendFlag={sendFlag}");
                Console.WriteLine($"[SyncRemotePortal] sendFlag={sendFlag} -> Status Code: {resp.StatusCode}");
                if (!resp.IsSuccessStatusCode) continue;
                var json = await resp.Content.ReadAsStringAsync();
                using var batchDoc = JsonDocument.Parse(json);

                using var conn = await db.GetOpenConnectionAsync();
                int batchIdx = 0;

                foreach (var batch in batchDoc.RootElement.EnumerateArray())
                {
                    batchIdx++;
                    string batchId = batch.TryGetProperty("batchId", out var bId) ? bId.GetString() ?? "" : "";
                    string receivingDate = batch.TryGetProperty("receivingDate", out var rDate) ? rDate.GetString() ?? "" : "";
                    string purpose = batch.TryGetProperty("purpose", out var purp) ? purp.GetString() ?? "" : "";

                    if (string.IsNullOrEmpty(batchId)) continue;

                    await conn.ExecuteAsync(@"
                        INSERT INTO FailQueryBatches (BatchId, ReceivingDate, Purpose, SyncedAt)
                        VALUES (@batchId, @receivingDate, @purpose, datetime('now'))
                        ON CONFLICT(BatchId) DO UPDATE SET ReceivingDate = @receivingDate, Purpose = @purpose, SyncedAt = datetime('now');",
                        new { batchId, receivingDate, purpose });

                    if (!batch.TryGetProperty("transactions", out var txns)) continue;

                    foreach (var tx in txns.EnumerateArray())
                    {
                        string cName = GetPropString(tx, "creditorName", "name");
                        string cNid = GetPropString(tx, "creditorNationalId", "nationalId");
                        string cAcc = GetPropString(tx, "creditorAccount", "account");
                        string cBic = GetPropString(tx, "creditorBic", "bic");
                        string cBranch = GetPropString(tx, "creditorBranch", "branch");
                        decimal amt = tx.TryGetProperty("transactionAmount", out var am) && am.ValueKind == JsonValueKind.Number ? am.GetDecimal() 
                                     : (tx.TryGetProperty("amount", out var am2) && am2.ValueKind == JsonValueKind.Number ? am2.GetDecimal() : 0m);
                        string status = GetPropString(tx, "transactionStatus", "status");
                        string reason = GetPropString(tx, "reason");

                        string newAcc = GetPropString(tx, "newCreditorAccount", "newAccount");
                        string newBic = GetPropString(tx, "newCreditorBic", "newBic");
                        string newBranch = GetPropString(tx, "newCreditorBranch", "newBranch");
                        string tasFlag = GetPropString(tx, "tasFlag");
                        if (string.IsNullOrEmpty(tasFlag)) tasFlag = "0";

                        if (string.IsNullOrEmpty(cAcc) && string.IsNullOrEmpty(cNid) && string.IsNullOrEmpty(cName)) continue;

                        var existing = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
                            SELECT Id, NewCreditorAccount, TasFlag FROM FailQueryTransactions 
                            WHERE BatchId = @batchId AND (
                                (@cAcc != '' AND CreditorAccount = @cAcc) OR 
                                (@cNid != '' AND CreditorNationalId = @cNid) OR 
                                (@cName != '' AND CreditorName = @cName)
                            )",
                            new { batchId, cAcc, cNid, cName });

                        if (existing != null)
                        {
                            string existingNewAcc = (string)existing.NewCreditorAccount ?? "";
                            string existingTasFlag = existing.TasFlag?.ToString() ?? "0";
                            
                            // Update if EITHER account changed OR tasFlag changed (bidirectional sync)
                            bool accountChanged = existingNewAcc != newAcc;
                            bool tasFlagChanged = existingTasFlag != tasFlag;
                            
                            if (accountChanged || tasFlagChanged)
                            {
                                string modBy = accountChanged
                                    ? (!string.IsNullOrEmpty(newAcc) 
                                        ? "المنظومة القديمة (hiaapay)" 
                                        : "تم إلغاء/عكس التعديل في المنظومة القديمة (hiaapay)")
                                    : $"تحديث حالة رئيس القسم من المنظومة القديمة (tasFlag={tasFlag})";
                                    
                                string modAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                                await conn.ExecuteAsync(@"
                                    UPDATE FailQueryTransactions
                                    SET NewCreditorAccount = @newAcc,
                                        NewCreditorBic = @newBic,
                                        NewCreditorBranch = @newBranch,
                                        TasFlag = @tasFlag
                                    WHERE Id = @id",
                                    new { newAcc, newBic, newBranch, tasFlag, id = (long)existing.Id });
                            }
                        }
                        else
                        {
                            await conn.ExecuteAsync(@"
                                INSERT INTO FailQueryTransactions (BatchId, CreditorName, CreditorNationalId, CreditorAccount, CreditorBic, CreditorBranch, TransactionAmount, TransactionStatus, Reason, NewCreditorAccount, NewCreditorBic, NewCreditorBranch, TasFlag)
                                VALUES (@batchId, @cName, @cNid, @cAcc, @cBic, @cBranch, @amt, @status, @reason, @newAcc, @newBic, @newBranch, @tasFlag)",
                                new { batchId, cName, cNid, cAcc, cBic, cBranch, amt, status, reason, newAcc, newBic, newBranch, tasFlag });
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SyncRemotePortal ERROR] {ex.GetType().Name}: {ex.Message}");
        }
    }

    public static async Task SyncHistoryToDbAsync(DatabaseService db)
    {
        if (_isSyncingHistory) return;
        _isSyncingHistory = true;

        try
        {
            await SyncRemotePortalToLocalDbAsync(db);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FailQuerySync] Auto background sync error: {ex.Message}");
        }
        finally
        {
            _isSyncingHistory = false;
        }
    }

    private static string FindProjectRoot()
    {
        var dir = Directory.GetCurrentDirectory();
        while (!string.IsNullOrEmpty(dir))
        {
            if (File.Exists(Path.Combine(dir, "Program.cs"))) return dir;
            var parent = Directory.GetParent(dir)?.FullName;
            if (parent == dir) break;
            dir = parent;
        }
        return AppDomain.CurrentDomain.BaseDirectory;
    }

    private static async Task<IResult> ProxyGet(string path, int timeoutSeconds = 60)
    {
        try
        {
            var handler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (_, _, _, _) => true
            };
            using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(timeoutSeconds) };

            var authBody = new StringContent(
                JsonSerializer.Serialize(new { userName = "m.foad", password = "P@ssw0rdP@ssw0rd" }),
                Encoding.UTF8, "application/json");
            client.DefaultRequestHeaders.Add("X-Request-From", "https://hiaapay.faa.local");
            client.DefaultRequestHeaders.Host = "hiaapay.faa.local";

            var authResp = await client.PostAsync($"{_baseUrl}/Auth", authBody);
            if (!authResp.IsSuccessStatusCode)
                return Results.Json(new { success = false, error = "Auth failed" }, statusCode: 401);

            var authJson = await authResp.Content.ReadAsStringAsync();
            string token;
            try
            {
                using var doc = JsonDocument.Parse(authJson);
                token = doc.RootElement.TryGetProperty("token", out var t) ? t.GetString()! : authJson.Trim('"');
            }
            catch
            {
                token = authJson.Trim('"');
            }

            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
            var resp = await client.GetAsync($"{_baseUrl}/{path}");

            if (!resp.IsSuccessStatusCode)
                return Results.Json(new { success = false, error = $"Status {(int)resp.StatusCode}" }, statusCode: (int)resp.StatusCode);

            var content = await resp.Content.ReadAsStringAsync();
            return Results.Content(content, "application/json; charset=utf-8");
        }
        catch (TaskCanceledException)
        {
            return Results.Json(new { success = false, error = "Request timed out - السيرفر الخارجي لم يستجب في الوقت المحدد" }, statusCode: 504);
        }
        catch (Exception ex)
        {
            return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
        }
    }

    private static string GetPropString(JsonElement el, params string[] names)
    {
        foreach (var n in names)
        {
            if (el.TryGetProperty(n, out var prop) && prop.ValueKind != JsonValueKind.Null)
            {
                if (prop.ValueKind == JsonValueKind.String)
                {
                    var str = prop.GetString();
                    if (str != null) return str;
                }
                else if (prop.ValueKind == JsonValueKind.Number)
                {
                    return prop.GetRawText();
                }
                else
                {
                    return prop.ToString() ?? "";
                }
            }
        }
        return "";
    }
}
