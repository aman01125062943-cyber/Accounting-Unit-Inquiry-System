using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;

namespace HKServer.Services;

public static class SecurityHardening
{
    public const string AdminOperationHeaderName = "X-HK-Admin-Token";

    public static int GetActorUserId(HttpContext context)
    {
        // TODO SECURITY Phase 2: X-User-Id is not trusted authentication and can be spoofed by clients.
        // Replace this with a server-issued authenticated principal/session before relying on permissions.
        if (int.TryParse(context.Request.Headers["X-User-Id"], out var headerId)) return headerId;
        if (int.TryParse(context.Request.Query["userId"], out var queryId)) return queryId;
        return 0;
    }

    public static IResult? RequireAdminOperationProtection(HttpContext context, IConfiguration configuration, string operationName)
    {
        if (!ReadBool(configuration, "EnableDangerousAdminOperations", defaultValue: false))
        {
            return Results.Json(new
            {
                success = false,
                message = "هذه العملية الإدارية الخطيرة غير مفعلة من الإعدادات"
            }, statusCode: StatusCodes.Status403Forbidden);
        }

        var configuredToken = configuration["AdminOperationToken"] ?? configuration["DangerousAdminOperationToken"];
        if (string.IsNullOrWhiteSpace(configuredToken))
        {
            return Results.Json(new
            {
                success = false,
                message = "رمز العمليات الإدارية الخطيرة غير مضبوط في الإعدادات"
            }, statusCode: StatusCodes.Status403Forbidden);
        }

        var providedToken = context.Request.Headers[AdminOperationHeaderName].FirstOrDefault();
        if (!FixedTimeEquals(providedToken, configuredToken))
        {
            Console.WriteLine($"[SECURITY] Blocked dangerous admin operation '{operationName}': missing or invalid admin token.");
            return Results.Json(new
            {
                success = false,
                message = "غير مصرح بتنفيذ هذه العملية الإدارية الخطيرة"
            }, statusCode: StatusCodes.Status403Forbidden);
        }

        return null;
    }

    public static bool ReadBool(IConfiguration configuration, string key, bool defaultValue)
    {
        var value = configuration[key];
        return bool.TryParse(value, out var parsed) ? parsed : defaultValue;
    }

    private static bool FixedTimeEquals(string? provided, string expected)
    {
        if (string.IsNullOrEmpty(provided)) return false;

        var providedBytes = Encoding.UTF8.GetBytes(provided);
        var expectedBytes = Encoding.UTF8.GetBytes(expected);
        return providedBytes.Length == expectedBytes.Length
            && CryptographicOperations.FixedTimeEquals(providedBytes, expectedBytes);
    }
}
