using Dapper;
using HKServer.Models;
using HKServer.Services;
using System.Text.Json;

namespace HKServer.Endpoints;

public static class AdabirEndpoints
{
    public static void MapAdabirEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/adabir");

        group.MapGet("/preview", async (string dateFrom, string dateTo, string sourceTable, DatabaseService db) =>
        {
            try
            {
                using var conn = await db.GetOpenConnectionAsync();
                var tableName = NormalizeSourceTable(sourceTable);
                var dateToFull = ExpandDateTo(dateTo);

                var sql = $@"
                    SELECT COUNT(*)
                    FROM {tableName}
                    WHERE IsDeleted = 0
                      AND COALESCE(IsArchived, 0) = 0
                      AND ArchivedBatchId IS NULL
                      AND UploadDate >= @DateFrom
                      AND UploadDate <= @DateTo";

                var count = await conn.ExecuteScalarAsync<int>(sql, new { DateFrom = dateFrom, DateTo = dateToFull });
                return Results.Ok(new { success = true, recordCount = count });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        group.MapGet("/", async (DatabaseService db) =>
        {
            try
            {
                using var conn = await db.GetOpenConnectionAsync();
                var batches = await conn.QueryAsync<ArchiveBatch>("SELECT * FROM ArchiveBatches ORDER BY Id DESC");
                return Results.Ok(batches);
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        group.MapGet("/{id}/details", async (long id, string? search, DatabaseService db) =>
        {
            try
            {
                using var conn = await db.GetOpenConnectionAsync();
                var sql = "SELECT * FROM ArchiveDetails WHERE BatchId = @BatchId";
                if (!string.IsNullOrWhiteSpace(search))
                {
                    sql += " AND RawData LIKE @Search";
                }

                var details = await conn.QueryAsync<ArchiveDetail>(sql, new { BatchId = id, Search = $"%{search}%" });
                return Results.Ok(details);
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        group.MapPost("/archive", async (ArchiveBatchRequest request, DatabaseService db) =>
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 5)
                    return Results.BadRequest(new { success = false, message = "السبب يجب أن يكون 5 أحرف على الأقل." });

                var tableName = NormalizeSourceTable(request.SourceTable);
                var dateToFull = ExpandDateTo(request.DateTo);

                using var conn = await db.GetOpenConnectionAsync();
                using var trans = conn.BeginTransaction();

                var sqlSelect = $@"
                    SELECT Id, RawData, ImportId, ReturnCode, UploadDate,
                           [رقم تسوية التعلية] AS InquirySettlementNo,
                           [رقم تسوية السداد] AS PaymentSettlementNo
                    FROM {tableName}
                    WHERE IsDeleted = 0
                      AND COALESCE(IsArchived, 0) = 0
                      AND ArchivedBatchId IS NULL
                      AND UploadDate >= @DateFrom
                      AND UploadDate <= @DateTo";

                var matches = (await conn.QueryAsync<dynamic>(
                    sqlSelect,
                    new { DateFrom = request.DateFrom, DateTo = dateToFull },
                    trans)).ToList();

                if (!matches.Any())
                    return Results.BadRequest(new { success = false, message = "لا توجد سجلات غير مؤرشفة مطابقة للنقل." });

                var originalIds = matches.Select(m => (long)m.Id).ToList();
                var duplicateCount = await conn.ExecuteScalarAsync<int>(@"
                    SELECT COUNT(*)
                    FROM ArchiveDetails d
                    JOIN ArchiveBatches b ON b.Id = d.BatchId
                    WHERE COALESCE(d.SourceTable, b.SourceTable) = @SourceTable
                      AND d.OriginalId IN @OriginalIds",
                    new { SourceTable = tableName, OriginalIds = originalIds },
                    trans);

                if (duplicateCount > 0)
                    return Results.Conflict(new { success = false, message = "يوجد سجلات من هذه المجموعة منقولة مسبقاً إلى الأضابير." });

                var importIds = matches
                    .Where(m => m.ImportId != null)
                    .Select(m => (long)m.ImportId)
                    .Distinct()
                    .ToList();

                var excelNames = "";
                if (importIds.Any())
                {
                    var archivesTable = tableName == "SalaryReturns" ? "SalaryArchives" : "Archives";
                    var filenames = await conn.QueryAsync<string>(
                        $"SELECT Filename FROM {archivesTable} WHERE Id IN @Ids",
                        new { Ids = importIds },
                        trans);
                    excelNames = string.Join(", ", filenames);
                }

                var batchId = await conn.ExecuteScalarAsync<long>(@"
                    INSERT INTO ArchiveBatches (ExcelNames, RecordCount, DateFrom, DateTo, SourceTable, Reason, ArchivedAt)
                    VALUES (@ExcelNames, @RecordCount, @DateFrom, @DateTo, @SourceTable, @Reason, @ArchivedAt)
                    RETURNING Id;",
                    new
                    {
                        ExcelNames = excelNames,
                        RecordCount = matches.Count,
                        DateFrom = request.DateFrom,
                        DateTo = request.DateTo,
                        SourceTable = tableName,
                        Reason = request.Reason.Trim(),
                        ArchivedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    },
                    trans);

                var detailsToInsert = matches.Select(m =>
                {
                    string raw = m.RawData ?? "";
                    if (m.ImportId != null)
                    {
                        raw = InjectBackupImportId(raw, (long)m.ImportId);
                    }

                    return new
                    {
                        BatchId = batchId,
                        OriginalId = (long)m.Id,
                        SourceTable = tableName,
                        ReturnCode = Convert.ToString(m.ReturnCode) ?? "",
                        UploadDate = Convert.ToString(m.UploadDate) ?? "",
                        InquirySettlementNo = Convert.ToString(m.InquirySettlementNo) ?? "",
                        PaymentSettlementNo = Convert.ToString(m.PaymentSettlementNo) ?? "",
                        RawData = raw
                    };
                }).ToList();

                await conn.ExecuteAsync(@"
                    INSERT INTO ArchiveDetails
                        (BatchId, OriginalId, SourceTable, ReturnCode, UploadDate, InquirySettlementNo, PaymentSettlementNo, RawData)
                    VALUES
                        (@BatchId, @OriginalId, @SourceTable, @ReturnCode, @UploadDate, @InquirySettlementNo, @PaymentSettlementNo, @RawData)",
                    detailsToInsert,
                    trans);

                await conn.ExecuteAsync(
                    $"UPDATE {tableName} SET IsArchived = 1, ArchivedBatchId = @BatchId WHERE Id IN @Ids AND IsDeleted = 0 AND COALESCE(IsArchived, 0) = 0",
                    new { BatchId = batchId, Ids = originalIds },
                    trans);

                trans.Commit();
                return Results.Ok(new { success = true, batchId, count = matches.Count });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });

        group.MapPost("/restore/{id}", async (long id, DatabaseService db) =>
        {
            try
            {
                using var conn = await db.GetOpenConnectionAsync();
                var batch = await conn.QueryFirstOrDefaultAsync<ArchiveBatch>(
                    "SELECT * FROM ArchiveBatches WHERE Id = @Id",
                    new { Id = id });

                if (batch == null)
                    return Results.NotFound(new { success = false, message = "الدفعة غير موجودة." });

                var tableName = NormalizeSourceTable(batch.SourceTable);
                using var trans = conn.BeginTransaction();

                var details = (await conn.QueryAsync<ArchiveDetail>(
                    "SELECT * FROM ArchiveDetails WHERE BatchId = @BatchId",
                    new { BatchId = id },
                    trans)).ToList();

                foreach (var d in details)
                {
                    var existing = await conn.ExecuteScalarAsync<int>(
                        $"SELECT COUNT(*) FROM {tableName} WHERE Id = @Id",
                        new { Id = d.OriginalId },
                        trans);

                    if (existing > 0)
                    {
                        await conn.ExecuteAsync(
                            $"UPDATE {tableName} SET IsArchived = 0, ArchivedBatchId = NULL, IsDeleted = 0 WHERE Id = @Id",
                            new { Id = d.OriginalId },
                            trans);
                        continue;
                    }

                    var importId = ExtractBackupImportId(d.RawData);
                    var uploadDate = !string.IsNullOrWhiteSpace(d.UploadDate) ? d.UploadDate : ExtractUploadDate(d.RawData);
                    var returnCode = !string.IsNullOrWhiteSpace(d.ReturnCode)
                        ? d.ReturnCode
                        : DatabaseService.ExtractReturnCode(DatabaseService.ExtractFileCodeDirect(d.RawData));

                    var insertSql = $@"
                        INSERT INTO {tableName}
                            (Id, ImportId, RawData, ReturnCode, UploadDate, IsDeleted, IsArchived, ArchivedBatchId, [رقم تسوية التعلية], [رقم تسوية السداد])
                        VALUES
                            (@Id, @ImportId, @RawData, @ReturnCode, @UploadDate, 0, 0, NULL, @InquirySettlementNo, @PaymentSettlementNo)";

                    await conn.ExecuteAsync(insertSql, new
                    {
                        Id = d.OriginalId,
                        ImportId = importId,
                        RawData = d.RawData,
                        ReturnCode = returnCode,
                        UploadDate = uploadDate,
                        InquirySettlementNo = d.InquirySettlementNo ?? "",
                        PaymentSettlementNo = d.PaymentSettlementNo ?? ""
                    }, trans);
                }

                await conn.ExecuteAsync("DELETE FROM ArchiveDetails WHERE BatchId = @Id", new { Id = id }, trans);
                await conn.ExecuteAsync("DELETE FROM ArchiveBatches WHERE Id = @Id", new { Id = id }, trans);

                trans.Commit();
                return Results.Ok(new { success = true, count = details.Count });
            }
            catch (Exception ex)
            {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });
    }

    private static string NormalizeSourceTable(string? sourceTable)
        => string.Equals(sourceTable, "SalaryReturns", StringComparison.OrdinalIgnoreCase) ? "SalaryReturns" : "Returns";

    private static string ExpandDateTo(string dateTo)
        => !string.IsNullOrEmpty(dateTo) && dateTo.Length == 10 ? $"{dateTo} 23:59:59" : dateTo;

    private static string InjectBackupImportId(string raw, long importId)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var dict = JsonSerializer.Deserialize<Dictionary<string, object?>>(raw) ?? new();
            dict["_BackupImportId"] = importId;
            return JsonSerializer.Serialize(dict);
        }
        catch
        {
            var idx = raw.LastIndexOf('}');
            return idx > 0 ? raw[..idx] + $", \"_BackupImportId\": {importId}}}" : raw;
        }
    }

    private static long? ExtractBackupImportId(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.TryGetProperty("_BackupImportId", out var prop) && prop.TryGetInt64(out var id))
                return id == 0 ? null : id;
        }
        catch { }
        return null;
    }

    private static string ExtractUploadDate(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.TryGetProperty("تاريخ الرفع", out var prop))
                return prop.ToString();
        }
        catch { }
        return "";
    }
}
