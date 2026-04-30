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
    public string? AttachmentUrl { get; set; }
    public string? AttachmentType { get; set; } // "image", "pdf", "file"
    public int LikeCount { get; set; }

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
    public string? ReminderTime { get; set; } // وقت التنبيه المحدد
    public string? AlertSound { get; set; }    // نغمة التنبيه المختارة
    public bool IsReminderActive { get; set; } = true;
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
    public string? AttachmentUrl { get; set; }
    public string? AttachmentType { get; set; }
}

public class LikeMessageRequest
{
    public long MessageId { get; set; }
    public int UserId { get; set; }
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
    public string? ReminderTime { get; set; }
    public string? AlertSound { get; set; }
    public string Priority { get; set; } = "Medium";
    public int AssignedToId { get; set; }
    public int CreatedById { get; set; }
    public string? Attachments { get; set; }
}

public class RescheduleTaskRequest
{
    public long TaskId { get; set; }
    public string? NewDueDate { get; set; }
    public string? NewReminderTime { get; set; }
    public int UpdatedById { get; set; }
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

public class SendChatCallRequest
{
    public long ConversationId { get; set; }
    public int CurrentUserId { get; set; }
    public int TargetUserId { get; set; }
    public string? RingTone { get; set; }
}

public class RespondChatCallRequest
{
    public long RingId { get; set; }
    public int UserId { get; set; }
}

public class TimeoutChatCallRequest
{
    public long RingId { get; set; }
    public int CallerId { get; set; }
}
