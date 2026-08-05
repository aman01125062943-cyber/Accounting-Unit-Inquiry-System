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

        // 3. جلب سجل المرتدات (استجابة فورية من SQLite مع مزامنة خلفية تلقائية)
        app.MapGet("/api/failquery/history", async (DatabaseService db) =>
        {
            _ = Task.Run(async () => {
                try { await SyncRemotePortalToLocalDbAsync(db); } catch {}
            });
            return await GetLocalFailQueryDataAsync(db);
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
                    "SELECT Id, BatchId, CreditorName, CreditorNationalId, CreditorAccount, CreditorBic, CreditorBranch, TransactionAmount, TransactionStatus, Reason, NewCreditorAccount, NewCreditorBic, NewCreditorBranch, TasFlag, IsSettlementChecked, DetSerial, ModifiedBy, PortalSyncStatus, SourceSystem, ModifiedAt FROM FailQueryTransactions"
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
                        tasFlag = t.TasFlag,
                        isSettlementChecked = (t.IsSettlementChecked == 1),
                        detSerial = t.DetSerial,
                        modifiedBy = t.ModifiedBy,
                        portalSyncStatus = (string)(t.PortalSyncStatus ?? "SYNCED"),
                        sourceSystem = (string)(t.SourceSystem ?? "NEW_SYSTEM"),
                        modifiedAt = (string)(t.ModifiedAt ?? "")
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

            var authBody = new StringContent(JsonSerializer.Serialize(new { userName = "amin-khalid", password = "P@ssw0rdP@ssw0rd" }), Encoding.UTF8, "application/json");
            var authResp = await client.PostAsync($"{_baseUrl}/Auth", authBody);
            if (!authResp.IsSuccessStatusCode) return;

            var authJson = await authResp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(authJson);
            string token = doc.RootElement.TryGetProperty("token", out var t) ? t.GetString()! : authJson.Trim('"');

            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");

            // فحص sendFlag = 2 أولاً (لأنه يحوي المعاملات المعدلة في البوابة القديمة)
            foreach (int sendFlag in new[] { 2, 0, 1 })
            {
                var resp = await client.GetAsync($"{_baseUrl}/FailedTransaction?gehaCode={_gehaCode}&sendFlag={sendFlag}");
                if (!resp.IsSuccessStatusCode) continue;
                var json = await resp.Content.ReadAsStringAsync();
                using var batchDoc = JsonDocument.Parse(json);

                using var conn = await db.GetOpenConnectionAsync();

                foreach (var batch in batchDoc.RootElement.EnumerateArray())
                {
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
                            SELECT Id, NewCreditorAccount, ModifiedBy FROM FailQueryTransactions 
                            WHERE BatchId = @batchId AND (CreditorAccount = @cAcc OR CreditorNationalId = @cNid OR CreditorName = @cName)",
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
                                        TasFlag = @tasFlag,
                                        ModifiedBy = @modBy,
                                        PortalSyncStatus = 'SYNCED',
                                        SourceSystem = 'OLD_SYSTEM',
                                        ModifiedAt = @modAt
                                    WHERE Id = @id",
                                    new { newAcc, newBic, newBranch, tasFlag, modBy, modAt, id = (long)existing.Id });
                            }
                        }
                        else
                        {
                            string modBy = !string.IsNullOrEmpty(newAcc) ? "تم التعديل في المنظومة القديمة (hiaapay)" : "";
                            string srcSys = !string.IsNullOrEmpty(newAcc) ? "OLD_SYSTEM" : "NEW_SYSTEM";
                            string modAt = !string.IsNullOrEmpty(newAcc) ? DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") : "";
                            await conn.ExecuteAsync(@"
                                INSERT INTO FailQueryTransactions (BatchId, CreditorName, CreditorNationalId, CreditorAccount, CreditorBic, CreditorBranch, TransactionAmount, TransactionStatus, Reason, NewCreditorAccount, NewCreditorBic, NewCreditorBranch, TasFlag, ModifiedBy, PortalSyncStatus, SourceSystem, ModifiedAt)
                                VALUES (@batchId, @cName, @cNid, @cAcc, @cBic, @cBranch, @amt, @status, @reason, @newAcc, @newBic, @newBranch, @tasFlag, @modBy, 'SYNCED', @srcSys, @modAt)",
                                new { batchId, cName, cNid, cAcc, cBic, cBranch, amt, status, reason, newAcc, newBic, newBranch, tasFlag, modBy, srcSys, modAt });
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SyncRemotePortal] Info: {ex.Message}");
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
                JsonSerializer.Serialize(new { userName = "amin-khalid", password = "P@ssw0rdP@ssw0rd" }),
                Encoding.UTF8, "application/json");
            client.DefaultRequestHeaders.Add("X-Request-From", "https://hiaapay.faa.local");

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
                var str = prop.GetString();
                if (str != null) return str;
            }
        }
        return "";
    }
}
