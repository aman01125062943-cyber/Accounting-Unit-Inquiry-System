namespace HKServer.Models;

public class FilterDefinition
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "list"; // list or range (Legacy: for single-criterion filters)
    public string? ValuesContent { get; set; }
    public double? MinValue { get; set; }
    public double? MaxValue { get; set; }
    public string? TargetPage { get; set; }
    public string? TargetColumn { get; set; }
    public string CreatedAt { get; set; } = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

    // New: Support for multiple criteria
    public List<FilterCriterion> Criteria { get; set; } = new();
}

public class FilterCriterion
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Type { get; set; } = "list"; // list, range
    public string? ValuesContent { get; set; }
    public double? MinValue { get; set; }
    public double? MaxValue { get; set; }
    public string? TargetColumn { get; set; }
}
