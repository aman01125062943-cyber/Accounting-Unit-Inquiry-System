using System;

namespace HKServer.Models
{
    public class UserTask
    {
        public int Id { get; set; }
        public int ManagerId { get; set; }
        public int TargetUserId { get; set; }
        public string Title { get; set; } = "";
        public string Description { get; set; } = "";
        public string Priority { get; set; } = "Medium";
        public string Status { get; set; } = "New";
        public int? SourceTableId { get; set; }
        public string? SourceType { get; set; }
        public string? DueDate { get; set; }
        public string? CompletedAt { get; set; }
        public string CreatedAt { get; set; } = "";
        
        // Extended for UI
        public string? ManagerName { get; set; }
        public string? TargetUserName { get; set; }
    }

    public class UpdateUserTaskStatusReq
    {
        public int TaskId { get; set; }
        public string Status { get; set; } = "";
    }

    public class TableShare
    {
        public int Id { get; set; }
        public int TableId { get; set; }
        public string TableType { get; set; } = "";
        public int SharedById { get; set; }
        public int SharedWithId { get; set; }
        public string Message { get; set; } = "";
        public string Status { get; set; } = "Pending";
        public string CreatedAt { get; set; } = "";
        
        // Extended for UI
        public string? SharedByName { get; set; }
        public string? TableName { get; set; }
    }

    public class AuditLogEntry
    {
        public int Id { get; set; }
        public int? UserId { get; set; }
        public string Username { get; set; } = "";
        public string Action { get; set; } = "";
        public string Details { get; set; } = "";
        public string IPAddress { get; set; } = "";
        public string CreatedAt { get; set; } = "";
    }
}
