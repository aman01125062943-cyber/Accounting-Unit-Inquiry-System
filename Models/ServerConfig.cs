namespace HKServer.Models;

public class ServerConfig
{
    public const string DefaultDatabasePath = @"\\128.30.200.225\esth_share\فرع الاعمال الحسابية\قسم البنوك\منظومة الجديدة\hk.db";
    public string DatabasePath { get; set; } = DefaultDatabasePath;
    public string LastSuccessfulDatabasePath { get; set; } = "";
    public string LastSuccessfulDatabaseConnection { get; set; } = "";
    public string BasePath { get; set; } = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HKServer", "Files");
    public string ArchivePath { get; set; } = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "الأرشيف"));
    public string AutoSyncPath { get; set; } = "";
    public string Naps2Path { get; set; } = @"C:\naps2_portable\App\NAPS2.Console.exe";
    public string ScannerDriver { get; set; } = "twain";
    public string ScannerDevice { get; set; } = "";
    public string ScannerSource { get; set; } = "feeder";
    public string ScannerFormat { get; set; } = "pdf";
    public bool ScannerSilent { get; set; } = true;
    public bool ScannerForce { get; set; } = true;
    public string AttachmentLinkMode { get; set; } = "Name";
    public bool AutoImportEnabled { get; set; } = false;
    public string AutoImportPath { get; set; } = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "استيراد_تلقائي"));
    public int ActiveImportId { get; set; } = 0;
    public int ActiveSalaryImportId { get; set; } = 0;
}
