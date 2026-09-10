namespace HKServer.Models
{
    public class StandaloneOutgoing
    {
        public int Id { get; set; }
        public string OutgoingNumber { get; set; } = "";
        public string OutgoingDate { get; set; } = "";
        public string ServiceType { get; set; } = "";
        public string Destination { get; set; } = "";
        public string Subject { get; set; } = "";
        public string ActionStatus { get; set; } = "";
        public int AttachmentsCount { get; set; } = 0;
        public string SalonLocation { get; set; } = "";
        public string CabinetLocation { get; set; } = "";
        public string ShelfLocation { get; set; } = "";
        public string FolderLocation { get; set; } = "";
        public string SerialLocation { get; set; } = "";
        public string ArchiveStatus { get; set; } = "أرشفة مكتملة";
        public string CreatedAt { get; set; } = "";
        public string UpdatedAt { get; set; } = "";
    }
}
