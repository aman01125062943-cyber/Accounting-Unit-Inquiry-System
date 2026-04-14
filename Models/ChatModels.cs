namespace HKServer.Models.Chat;

// ========================================
// نماذج نظام المراسلة (Chat Module)
// ========================================

public class Conversation
{
    public long Id { get; set; }
    public int User1Id { get; set; }
    public int User2Id { get; set; }
    public string? LastMessageAt { get; set; }
    public string? CreatedAt { get; set; }

    // Navigation (populated manually)
    public string? OtherUserName { get; set; }
    public string? LastMessage { get; set; }
    public int UnreadCount { get; set; }
    public bool IsOnline { get; set; }
}

public class ChatMessage
{
    public long Id { get; set; }
    public long ConversationId { get; set; }
    public int SenderId { get; set; }
    public string Content { get; set; } = "";
    public string? SentAt { get; set; }
    public bool IsRead { get; set; }
    public bool IsTaskConverted { get; set; }

    // Navigation
    public string? SenderName { get; set; }
}

public class ChatTask
{
    public long Id { get; set; }
    public long? MessageId { get; set; }
    public long? ConversationId { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string? DueDate { get; set; }
    public string Priority { get; set; } = "Medium";
    public string Status { get; set; } = "New";
    public int AssignedToId { get; set; }
    public int CreatedById { get; set; }
    public string? Attachments { get; set; }
    public string? CreatedAt { get; set; }
    public string? UpdatedAt { get; set; }

    // Navigation
    public string? AssignedToName { get; set; }
    public string? CreatedByName { get; set; }
    public string? MessageContent { get; set; }
}

// ========================================
// DTOs
// ========================================

public class SendMessageRequest
{
    public long ConversationId { get; set; }
    public int SenderId { get; set; }
    public string Content { get; set; } = "";
}

public class CreateConversationRequest
{
    public int User1Id { get; set; }
    public int User2Id { get; set; }
}

public class CreateTaskFromMessageRequest
{
    public long MessageId { get; set; }
    public long ConversationId { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string? DueDate { get; set; }
    public string Priority { get; set; } = "Medium";
    public int AssignedToId { get; set; }
    public int CreatedById { get; set; }
    public string? Attachments { get; set; }
}

public class UpdateTaskStatusRequest
{
    public string Status { get; set; } = "New";
    public int UpdatedById { get; set; }
}

public class MarkMessagesAsReadRequest
{
    public int ReaderId { get; set; }
}
