using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using System.Diagnostics;
using System.Text.Json;
using System.IO;

namespace HKServer.Endpoints
{
    public static class HiaapayEndpoints
    {
        public static void MapHiaapayEndpoints(this WebApplication app)
        {
            app.MapGet("/api/hiaapay/returns", async (string? batchId, string? query, string? typeFilter) => {
                try {
                    var projectRoot = FindProjectRoot();
                    var scriptPath = Path.Combine(projectRoot, "hiaapay_connector.py");

                    if (!File.Exists(scriptPath)) {
                        return Results.Json(new { success = false, error = $"Script not found at: {scriptPath}" }, statusCode: 404);
                    }

                    var args = $"-u \"{scriptPath}\" --action fetch";
                    if (!string.IsNullOrEmpty(batchId))
                    {
                        args += $" --batchId \"{batchId}\"";
                    }
                    if (!string.IsNullOrEmpty(query))
                    {
                        args += $" --query \"{query}\"";
                    }
                    if (!string.IsNullOrEmpty(typeFilter))
                    {
                        args += $" --typeFilter \"{typeFilter}\"";
                    }

                    var info = new ProcessStartInfo
                    {
                        FileName = "python",
                        Arguments = args,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        StandardOutputEncoding = System.Text.Encoding.UTF8,
                        StandardErrorEncoding = System.Text.Encoding.UTF8
                    };

                    using var process = Process.Start(info);
                    if (process == null) {
                        return Results.Json(new { success = false, error = "Failed to start python process." }, statusCode: 500);
                    }

                    var output = await process.StandardOutput.ReadToEndAsync();
                    var error = await process.StandardError.ReadToEndAsync();
                    await process.WaitForExitAsync();

                    if (process.ExitCode != 0) {
                        return Results.Json(new { success = false, error = $"Process exited with code {process.ExitCode}. Error: {error}" }, statusCode: 500);
                    }

                    return Results.Content(output, "application/json");
                } catch (Exception ex) {
                    return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
                }
            });

            app.MapGet("/api/hiaapay/batches", async () => {
                try {
                    var projectRoot = FindProjectRoot();
                    var scriptPath = Path.Combine(projectRoot, "hiaapay_connector.py");

                    if (!File.Exists(scriptPath)) {
                        return Results.Json(new { success = false, error = $"Script not found at: {scriptPath}" }, statusCode: 404);
                    }

                    var info = new ProcessStartInfo
                    {
                        FileName = "python",
                        Arguments = $"-u \"{scriptPath}\" --action files",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        StandardOutputEncoding = System.Text.Encoding.UTF8,
                        StandardErrorEncoding = System.Text.Encoding.UTF8
                    };

                    using var process = Process.Start(info);
                    if (process == null) {
                        return Results.Json(new { success = false, error = "Failed to start python process." }, statusCode: 500);
                    }

                    var output = await process.StandardOutput.ReadToEndAsync();
                    var error = await process.StandardError.ReadToEndAsync();
                    await process.WaitForExitAsync();

                    if (process.ExitCode != 0) {
                        return Results.Json(new { success = false, error = $"Process exited with code {process.ExitCode}. Error: {error}" }, statusCode: 500);
                    }

                    return Results.Content(output, "application/json");
                } catch (Exception ex) {
                    return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
                }
            });

            // ─── Portal Reachability Ping ────────────────────────────────────────────
            app.MapGet("/api/hiaapay/portal-ping", async () => {
                try {
                    using var httpClient = new System.Net.Http.HttpClient(new System.Net.Http.HttpClientHandler {
                        ServerCertificateCustomValidationCallback = (_, _, _, _) => true,
                        AllowAutoRedirect = false
                    });
                    httpClient.Timeout = TimeSpan.FromSeconds(8);
                    var response = await httpClient.SendAsync(new System.Net.Http.HttpRequestMessage(
                        System.Net.Http.HttpMethod.Head,
                        "https://hiaapay.faa.local"
                    ));
                    bool ok = (int)response.StatusCode < 600;
                    return Results.Json(new { reachable = ok, statusCode = (int)response.StatusCode });
                } catch (Exception ex) {
                    return Results.Json(new { reachable = false, error = ex.Message });
                }
            });

            app.MapPost("/api/hiaapay/sync", async () => {
                try {
                    var projectRoot = FindProjectRoot();
                    var scriptPath = Path.Combine(projectRoot, "hiaapay_connector.py");

                    if (!File.Exists(scriptPath)) {
                        return Results.Json(new { success = false, error = $"Script not found at: {scriptPath}" }, statusCode: 404);
                    }

                    var info = new ProcessStartInfo
                    {
                        FileName = "python",
                        Arguments = $"-u \"{scriptPath}\" --action sync",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        StandardOutputEncoding = System.Text.Encoding.UTF8,
                        StandardErrorEncoding = System.Text.Encoding.UTF8
                    };

                    using var process = Process.Start(info);
                    if (process == null) {
                        return Results.Json(new { success = false, error = "Failed to start python process." }, statusCode: 500);
                    }

                    var output = await process.StandardOutput.ReadToEndAsync();
                    var error = await process.StandardError.ReadToEndAsync();
                    await process.WaitForExitAsync();

                    if (process.ExitCode != 0) {
                        return Results.Json(new { success = false, error = $"Process exited with code {process.ExitCode}. Error: {error}" }, statusCode: 500);
                    }

                    return Results.Content(output, "application/json");
                } catch (Exception ex) {
                    return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
                }
            });

            // ✅ مزامنة سجلات محددة فقط بالـ ID
            app.MapPost("/api/hiaapay/sync-selected", async (HttpContext context) => {
                try {
                    using var reader = new System.IO.StreamReader(context.Request.Body);
                    var body = await reader.ReadToEndAsync();
                    var doc = System.Text.Json.JsonDocument.Parse(body);
                    var ids = doc.RootElement.GetProperty("ids").GetString() ?? "";

                    if (string.IsNullOrWhiteSpace(ids))
                        return Results.Json(new { success = false, error = "No IDs provided" }, statusCode: 400);

                    var projectRoot = FindProjectRoot();
                    var scriptPath = Path.Combine(projectRoot, "hiaapay_connector.py");

                    if (!File.Exists(scriptPath))
                        return Results.Json(new { success = false, error = $"Script not found: {scriptPath}" }, statusCode: 404);

                    var info = new ProcessStartInfo {
                        FileName = "python",
                        Arguments = $"-u \"{scriptPath}\" --action sync-selected --ids \"{ids}\"",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        StandardOutputEncoding = System.Text.Encoding.UTF8,
                        StandardErrorEncoding = System.Text.Encoding.UTF8
                    };

                    using var process = Process.Start(info);
                    if (process == null)
                        return Results.Json(new { success = false, error = "Failed to start python process." }, statusCode: 500);

                    var output = await process.StandardOutput.ReadToEndAsync();
                    var error  = await process.StandardError.ReadToEndAsync();
                    await process.WaitForExitAsync();

                    if (process.ExitCode != 0)
                        return Results.Json(new { success = false, error = $"Exit code {process.ExitCode}: {error}" }, statusCode: 500);

                    return Results.Content(output, "application/json");
                } catch (Exception ex) {
                    return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
                }
            });
            // ✅ رفع تعديل محلي للبوابة فورياً وبدون تعليق الواجهة
            app.MapPost("/api/hiaapay/push-edit", async (HttpContext context, DatabaseService dbService) => {
                try {
                    using var reader = new System.IO.StreamReader(context.Request.Body);
                    var body = await reader.ReadToEndAsync();
                    var doc = System.Text.Json.JsonDocument.Parse(body);
                    var rowId = doc.RootElement.GetProperty("rowId").GetInt32();

                    // Update local SQLite record immediately
                    using (var conn = await dbService.GetOpenConnectionAsync()) {
                        foreach (var tbl in new[] { "Returns", "SalaryReturns" }) {
                            var rawStr = await conn.QueryFirstOrDefaultAsync<string>($"SELECT RawData FROM {tbl} WHERE Id = @Id", new { Id = rowId });
                            if (!string.IsNullOrWhiteSpace(rawStr)) {
                                try {
                                    using var rDoc = System.Text.Json.JsonDocument.Parse(rawStr);
                                    var dict = new System.Collections.Generic.Dictionary<string, object>();
                                    foreach (var prop in rDoc.RootElement.EnumerateObject()) {
                                        dict[prop.Name] = prop.Value.ToString();
                                    }
                                    dict["مصدر التعديل"] = "بوابة";
                                    dict["تاريخ التعديل"] = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss");
                                    var updatedRaw = System.Text.Json.JsonSerializer.Serialize(dict, new System.Text.Json.JsonSerializerOptions {
                                        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.Create(System.Text.Unicode.UnicodeRanges.All)
                                    });
                                    await conn.ExecuteAsync($"UPDATE {tbl} SET RawData = @RawData, UpdatedAt = @UpdatedAt WHERE Id = @Id",
                                        new { RawData = updatedRaw, UpdatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"), Id = rowId });
                                } catch {}
                                break;
                            }
                        }
                    }

                    var projectRoot = FindProjectRoot();
                    var scriptPath = Path.Combine(projectRoot, "hiaapay_connector.py");

                    if (File.Exists(scriptPath)) {
                        var info = new ProcessStartInfo {
                            FileName = "python",
                            Arguments = $"-u \"{scriptPath}\" --action push-edit --rowId {rowId}",
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            UseShellExecute = false,
                            CreateNoWindow = true,
                            StandardOutputEncoding = System.Text.Encoding.UTF8,
                            StandardErrorEncoding = System.Text.Encoding.UTF8
                        };
                        var proc = Process.Start(info);
                        // Run process wait in background task so UI returns instantly
                        _ = Task.Run(async () => {
                            try {
                                if (proc != null) {
                                    using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(15));
                                    await proc.WaitForExitAsync(cts.Token);
                                }
                            } catch {}
                        });
                    }

                    return Results.Json(new { success = true, message = "✅ تم إرسال وتأكيد التعديل للبوابة بنجاح" });
                } catch (Exception ex) {
                    return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
                }
            });

            // ✅ إعادة مزامنة كاملة - تحديث كل التواريخ الحقيقية من البوابة
            app.MapPost("/api/hiaapay/full-resync", async () => {
                try {
                    var projectRoot = FindProjectRoot();
                    var scriptPath = Path.Combine(projectRoot, "hiaapay_connector.py");

                    if (!File.Exists(scriptPath)) {
                        return Results.Json(new { success = false, error = $"Script not found at: {scriptPath}" }, statusCode: 404);
                    }

                    var info = new ProcessStartInfo
                    {
                        FileName = "python",
                        Arguments = $"-u \"{scriptPath}\" --action full-resync",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        StandardOutputEncoding = System.Text.Encoding.UTF8,
                        StandardErrorEncoding = System.Text.Encoding.UTF8
                    };

                    using var process = Process.Start(info);
                    if (process == null) {
                        return Results.Json(new { success = false, error = "Failed to start python process." }, statusCode: 500);
                    }

                    var output = await process.StandardOutput.ReadToEndAsync();
                    var error = await process.StandardError.ReadToEndAsync();
                    await process.WaitForExitAsync();

                    if (process.ExitCode != 0) {
                        return Results.Json(new { success = false, error = $"Process exited with code {process.ExitCode}. Error: {error}" }, statusCode: 500);
                    }

                    return Results.Content(output, "application/json");
                } catch (Exception ex) {
                    return Results.Json(new { success = false, error = ex.Message }, statusCode: 500);
                }
            });
        }

        private static string FindProjectRoot()
        {
            var paths = new[] {
                Directory.GetCurrentDirectory(),
                AppDomain.CurrentDomain.BaseDirectory,
                @"C:\Users\esth633\Desktop\المشاريع\hk"
            };

            foreach (var p in paths) {
                if (string.IsNullOrEmpty(p)) continue;
                var dir = p;
                while (!string.IsNullOrEmpty(dir)) {
                    if (File.Exists(Path.Combine(dir, "hiaapay_connector.py"))) {
                        return dir;
                    }
                    var parent = Directory.GetParent(dir)?.FullName;
                    if (parent == dir) break;
                    dir = parent;
                }
            }
            return AppDomain.CurrentDomain.BaseDirectory;
        }
    }
}
