using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using HKServer.Services;
using HKServer.Models;
using System.Collections.Generic;

namespace HKServer.Endpoints;

public static class AdabirEndpoints
{
    public static void MapAdabirEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/adabir");
        
        group.MapGet("/preview", async (string dateFrom, string dateTo, string sourceTable, DatabaseService db) => {
            try {
                using var conn = await db.GetOpenConnectionAsync();
                var tableName = sourceTable == "SalaryReturns" ? "SalaryReturns" : "Returns";
                
                string dateToFull = dateTo;
                if (!string.IsNullOrEmpty(dateTo) && dateTo.Length == 10) {
                    dateToFull += " 23:59:59";
                }

                var sql = $"SELECT COUNT(*) FROM {tableName} WHERE IsDeleted = 0 AND UploadDate >= @DateFrom AND UploadDate <= @DateTo";
                var count = await Dapper.SqlMapper.ExecuteScalarAsync<int>(conn, sql, new { DateFrom = dateFrom, DateTo = dateToFull });
                
                return Results.Ok(new { recordCount = count });
            } catch (System.Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });
        
        group.MapGet("/", async (DatabaseService db) => {
            try {
                using var conn = await db.GetOpenConnectionAsync();
                var batches = await Dapper.SqlMapper.QueryAsync<ArchiveBatch>(conn, "SELECT * FROM ArchiveBatches ORDER BY Id DESC");
                return Results.Ok(batches);
            } catch (System.Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });
        
        group.MapGet("/{id}/details", async (long id, string search, DatabaseService db) => {
            try {
                using var conn = await db.GetOpenConnectionAsync();
                var sql = "SELECT * FROM ArchiveDetails WHERE BatchId = @BatchId";
                if (!string.IsNullOrWhiteSpace(search)) {
                    sql += " AND RawData LIKE @Search";
                }
                var details = await Dapper.SqlMapper.QueryAsync<ArchiveDetail>(conn, sql, new { BatchId = id, Search = $"%{search}%" });
                return Results.Ok(details);
            } catch (System.Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });
        
        group.MapPost("/archive", async (ArchiveBatchRequest request, DatabaseService db) => {
            try {
                if (request.Reason.Length < 5) return Results.BadRequest("السبب يجب أن يكون 5 أحرف على الأقل.");
                using var conn = await db.GetOpenConnectionAsync();
                using var trans = conn.BeginTransaction();
                
                var tableName = request.SourceTable == "SalaryReturns" ? "SalaryReturns" : "Returns";
                string dateToFull = request.DateTo;
                if (!string.IsNullOrEmpty(request.DateTo) && request.DateTo.Length == 10) dateToFull += " 23:59:59";

                var sqlSelect = $"SELECT Id, RawData, ImportId, ReturnCode, UploadDate, [رقم تسوية التعلية], [رقم تسوية السداد] FROM {tableName} WHERE IsDeleted = 0 AND UploadDate >= @DateFrom AND UploadDate <= @DateTo";
                var matches = await Dapper.SqlMapper.QueryAsync<dynamic>(conn, sqlSelect, new { DateFrom = request.DateFrom, DateTo = dateToFull }, trans);
                
                if (!matches.Any()) return Results.BadRequest("لا توجد سجلات مطابقة للأرشفة.");

                var importIds = matches.Where(m => m.ImportId != null).Select(m => (long)m.ImportId).Distinct().ToList();
                string excelNames = "";
                if (importIds.Any()) {
                    var archivesTable = request.SourceTable == "SalaryReturns" ? "SalaryArchives" : "Archives";
                    var filenames = await Dapper.SqlMapper.QueryAsync<string>(conn, $"SELECT Filename FROM {archivesTable} WHERE Id IN @Ids", new { Ids = importIds }, trans);
                    excelNames = string.Join(", ", filenames);
                }

                var batchId = await Dapper.SqlMapper.ExecuteScalarAsync<long>(conn, 
                    "INSERT INTO ArchiveBatches (ExcelNames, RecordCount, DateFrom, DateTo, SourceTable, Reason, ArchivedAt) VALUES (@ExcelNames, @RecordCount, @DateFrom, @DateTo, @SourceTable, @Reason, @ArchivedAt); SELECT last_insert_rowid();",
                    new {
                        ExcelNames = excelNames,
                        RecordCount = matches.Count(),
                        DateFrom = request.DateFrom,
                        DateTo = request.DateTo,
                        SourceTable = request.SourceTable,
                        Reason = request.Reason,
                        ArchivedAt = System.DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }, trans);

                var detailsToInsert = matches.Select(m => {
                    // Inject ImportId into RawData for restoration later
                    string raw = m.RawData;
                    if (m.ImportId != null) {
                        try {
                            raw = raw.Substring(0, raw.LastIndexOf('}')) + $", \"_BackupImportId\": {m.ImportId}}}";
                        } catch {}
                    }
                    return new {
                        BatchId = batchId,
                        OriginalId = m.Id,
                        RawData = raw
                    };
                }).ToList();
                
                await Dapper.SqlMapper.ExecuteAsync(conn, "INSERT INTO ArchiveDetails (BatchId, OriginalId, RawData) VALUES (@BatchId, @OriginalId, @RawData)", detailsToInsert, trans);

                var idsToDelete = matches.Select(m => (long)m.Id).ToList();
                await Dapper.SqlMapper.ExecuteAsync(conn, $"DELETE FROM {tableName} WHERE Id IN @Ids", new { Ids = idsToDelete }, trans);

                trans.Commit();
                return Results.Ok(new { success = true, batchId = batchId, count = matches.Count() });
            } catch (System.Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });
        
        group.MapPost("/restore/{id}", async (long id, DatabaseService db) => {
            try {
                using var conn = await db.GetOpenConnectionAsync();
                var batch = await Dapper.SqlMapper.QueryFirstOrDefaultAsync<ArchiveBatch>(conn, "SELECT * FROM ArchiveBatches WHERE Id = @Id", new { Id = id });
                if (batch == null) return Results.NotFound("الدفعة غير موجودة.");

                using var trans = conn.BeginTransaction();
                
                var tableName = batch.SourceTable == "SalaryReturns" ? "SalaryReturns" : "Returns";
                var details = await Dapper.SqlMapper.QueryAsync<dynamic>(conn, "SELECT OriginalId, RawData FROM ArchiveDetails WHERE BatchId = @BatchId", new { BatchId = id }, trans);

                string insertSql = $"INSERT INTO {tableName} (Id, ImportId, RawData, ReturnCode, UploadDate, [رقم تسوية التعلية], [رقم تسوية السداد]) VALUES (@Id, @ImportId, @RawData, @ReturnCode, @UploadDate, @InquiryNum, @PaymentNum)";
                string insertNoIdSql = $"INSERT INTO {tableName} (ImportId, RawData, ReturnCode, UploadDate, [رقم تسوية التعلية], [رقم تسوية السداد]) VALUES (@ImportId, @RawData, @ReturnCode, @UploadDate, @InquiryNum, @PaymentNum)";

                foreach (var d in details) {
                    string raw = d.RawData;
                    long? importId = null;
                    try {
                        var obj = System.Text.Json.JsonSerializer.Deserialize<System.Collections.Generic.Dictionary<string, object>>(raw);
                        if (obj != null && obj.ContainsKey("_BackupImportId")) {
                            importId = long.Parse(obj["_BackupImportId"].ToString() ?? "0");
                        }
                    } catch {}

                    string fCode = DatabaseService.ExtractFileCodeDirect(raw);
                    string rCode = DatabaseService.ExtractReturnCode(fCode);
                    string uDate = "";
                    try {
                        var je = System.Text.Json.JsonDocument.Parse(raw).RootElement;
                        if (je.TryGetProperty("تاريخ الرفع", out var ud)) uDate = ud.ToString();
                    } catch {}

                    var p = new {
                        Id = d.OriginalId,
                        ImportId = importId == 0 ? null : importId,
                        RawData = raw,
                        ReturnCode = rCode,
                        UploadDate = uDate,
                        InquiryNum = "",
                        PaymentNum = ""
                    };
                    
                    try {
                        await Dapper.SqlMapper.ExecuteAsync(conn, insertSql, p, trans);
                    } catch {
                        // If ID conflict, insert without ID
                        await Dapper.SqlMapper.ExecuteAsync(conn, insertNoIdSql, p, trans);
                    }
                }

                await Dapper.SqlMapper.ExecuteAsync(conn, "DELETE FROM ArchiveBatches WHERE Id = @Id", new { Id = id }, trans);

                trans.Commit();
                return Results.Ok(new { success = true, count = details.Count() });
            } catch (System.Exception ex) {
                return Results.Json(new { success = false, message = ex.Message });
            }
        });
    }
}
