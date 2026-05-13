using HKServer.Services;
using HKServer.Models;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text.Encodings.Web;
using System.Text.Unicode;

namespace HKServer.Endpoints;

public static class SettingsEndpoints
{
    public static void MapSettingsEndpoints(this WebApplication app)
    {
        app.MapPost("/api/settings/verify-pin", async (SettingsPinRequest request, IConfiguration configuration) => {
            await Task.CompletedTask;
            var configuredPin = configuration["SettingsPin"];
            if (string.IsNullOrWhiteSpace(configuredPin)) configuredPin = "2027";

            return Results.Ok(new {
                success = request.Pin == configuredPin,
                message = request.Pin == configuredPin ? "تم التحقق بنجاح" : "رمز غير صحيح"
            });
        });

        app.MapPost("/api/settings/change-pin", async (ChangeSettingsPinRequest request, IConfiguration configuration) => {
            var configuredPin = configuration["SettingsPin"];
            if (string.IsNullOrWhiteSpace(configuredPin)) configuredPin = "2027";

            if (request.CurrentPin != configuredPin)
            {
                return Results.Json(new { success = false, message = "رمز غير صحيح" });
            }

            if (string.IsNullOrWhiteSpace(request.NewPin) || request.NewPin.Length < 4 || request.NewPin.Length > 12 || !request.NewPin.All(char.IsDigit))
            {
                return Results.Json(new { success = false, message = "رمز الدخول الجديد يجب أن يكون أرقاما فقط من 4 إلى 12 رقم." });
            }

            var appSettingsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "appsettings.json");
            if (!File.Exists(appSettingsPath))
            {
                appSettingsPath = Path.Combine(Directory.GetCurrentDirectory(), "appsettings.json");
            }

            using var stream = File.OpenRead(appSettingsPath);
            using var document = await JsonDocument.ParseAsync(stream);
            var settings = JsonSerializer.Deserialize<Dictionary<string, object?>>(document.RootElement.GetRawText()) ?? new();
            settings["SettingsPin"] = request.NewPin;

            var json = JsonSerializer.Serialize(settings, new JsonSerializerOptions {
                WriteIndented = true,
                Encoder = JavaScriptEncoder.Create(UnicodeRanges.All)
            });
            await File.WriteAllTextAsync(appSettingsPath, json, System.Text.Encoding.UTF8);

            return Results.Ok(new { success = true, message = "تم تغيير رمز الدخول بنجاح. سيتم استخدامه في عمليات التحقق التالية بعد إعادة تشغيل التطبيق." });
        });

        app.MapGet("/api/settings/security-status", (IConfiguration configuration) => {
            var dangerousEnabled = SecurityHardening.ReadBool(configuration, "EnableDangerousAdminOperations", defaultValue: false);
            var dangerousTokenConfigured = !string.IsNullOrWhiteSpace(configuration["AdminOperationToken"] ?? configuration["DangerousAdminOperationToken"]);
            return Results.Ok(new {
                enableDangerousAdminOperations = dangerousEnabled,
                dangerousAdminOperationTokenConfigured = dangerousTokenConfigured
            });
        });

        // ----------------------------------------------------
        // Phase 3-6: Filter Management Endpoints
        // ----------------------------------------------------

        // GET: Fetch all active filters
        app.MapGet("/api/filters", async (DatabaseService db) => {
            var filters = await db.GetFiltersAsync();
            return Results.Ok(filters);
        });

        // POST: Add a new filter
        app.MapPost("/api/filters", async (HKServer.Models.FilterDefinition filter, DatabaseService db) => {
            if (string.IsNullOrEmpty(filter.Name)) return Results.BadRequest("Name is required");
            await db.AddFilterAsync(filter);
            return Results.Ok(new { success = true });
        });

        // PUT: Edit existing filter
        app.MapPut("/api/filters/{id}", async (string id, HKServer.Models.FilterDefinition filter, DatabaseService db) => {
            filter.Id = id; // Ensure ID matches
            await db.UpdateFilterAsync(filter);
            return Results.Ok(new { success = true });
        });

        // DELETE: Remove existing filter
        app.MapDelete("/api/filters/{id}", async (string id, DatabaseService db) => {
            await db.DeleteFilterAsync(id);
            return Results.Ok(new { success = true });
        });
    }

    public record SettingsPinRequest(string Pin);
    public record ChangeSettingsPinRequest(string CurrentPin, string NewPin);
}
