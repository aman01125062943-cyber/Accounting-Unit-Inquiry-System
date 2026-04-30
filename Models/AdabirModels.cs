namespace HKServer.Models;

public class ArchiveBatch
{
    public long Id { get; set; }
    public string ExcelNames { get; set; } = "";
    public int RecordCount { get; set; }
    public string DateFrom { get; set; } = "";
    public string DateTo { get; set; } = "";
    public string SourceTable { get; set; } = "";
    public string Reason { get; set; } = "";
    public string ArchivedAt { get; set; } = "";
}

public class ArchiveDetail
{
    public long Id { get; set; }
    public long BatchId { get; set; }
    public long OriginalId { get; set; }
    public string SourceTable { get; set; } = "";
    public string ReturnCode { get; set; } = "";
    public string UploadDate { get; set; } = "";
    public string InquirySettlementNo { get; set; } = "";
    public string PaymentSettlementNo { get; set; } = "";
    public string RawData { get; set; } = "";
}

public class ArchiveBatchRequest
{
    public string DateFrom { get; set; } = "";
    public string DateTo { get; set; } = "";
    public string SourceTable { get; set; } = "";
    public string Reason { get; set; } = "";
    public List<long>? Ids { get; set; }
    public bool ArchiveAllFiltered { get; set; }
    public string? Search { get; set; }
    public string? AttachmentStatus { get; set; }
    public string? ReturnStatus { get; set; }
    public string? Settlement { get; set; }
    public string? MonthFilter { get; set; }
    public string? PaymentDateFilter { get; set; }
    public string? UploadDateFrom { get; set; }
    public string? UploadDateTo { get; set; }
}
