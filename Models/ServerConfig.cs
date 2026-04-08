namespace HKServer.Models;

public class ServerConfig {
    public string BasePath { get; set; } = @"\\128.30.200.225\esth_share\فرع الاعمال الحسابية\قسم البنوك\منظومة الجديدة";
    public string ArchivePath { get; set; } = @"\\128.30.200.225\esth_share\فرع الاعمال الحسابية\قسم البنوك\منظومة الجديدة\بيانات الارشيف";
    public string AutoSyncPath { get; set; } = ""; // Default empty, user must configure
    public string Naps2Path { get; set; } = @"C:\naps2_portable\App\NAPS2.Console.exe";
    public string ScannerDriver { get; set; } = "twain";
    public string ScannerDevice { get; set; } = "PaperStream IP fi-7700 #3";
    public string ScannerSource { get; set; } = "feeder";
    public string ScannerFormat { get; set; } = "pdf";
    public bool ScannerSilent { get; set; } = true;
    public bool ScannerForce { get; set; } = true;
    public string AttachmentLinkMode { get; set; } = "Name"; // Name, NID, Both
    public int ActiveImportId { get; set; } = 0; // 0 = Show All, >0 = Filter by this Archive/Import
    public int ActiveSalaryImportId { get; set; } = 0; // 0 = Show All, >0 = Filter by this Archive/Import
}
