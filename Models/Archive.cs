namespace HKServer.Models;

public class ArchiveEntry {
    public int id { get; set; }
    public DateTime date { get; set; }
    public string filename { get; set; } = "";
    public int recordCount { get; set; }
    public string size { get; set; } = "";
    public string headers { get; set; } = ""; // Changed from List<string> to string for SQLite storage (JSON)
    // Data will be stored in a separate table "Returns" linked by ImportId
}

public class PathRequest { public string path { get; set; } = ""; }

public class ImportData {
    public string filename { get; set; } = "";
    public string size { get; set; } = "";
    public List<string> headers { get; set; } = new();
    public List<object> data { get; set; } = new();
}
