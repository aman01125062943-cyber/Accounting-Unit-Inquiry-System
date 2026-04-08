
using System;
using System.IO;
using System.Data.OleDb;
using System.Text.RegularExpressions;

namespace HKServer.Utilities
{
    class AttachmentExporterUtility {
        public static void RunExport() {
        string dbPath = @"\\128.30.200.225\esth_share\فرع الاعمال الحسابية\قسم البنوك\برنامج ارشيف البنوك\deat\ارشيف قسم البنوك_be.accdb";
        string destFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "Attachments_Export");

        if (!Directory.Exists(destFolder)) Directory.CreateDirectory(destFolder);

        string connStr = $"Provider=Microsoft.ACE.OLEDB.12.0;Data Source={dbPath};";
        
        using (OleDbConnection conn = new OleDbConnection(connStr)) {
            try {
                conn.Open();
                OleDbCommand cmd = new OleDbCommand("SELECT * FROM Doc", conn);
                using (OleDbDataReader reader = cmd.ExecuteReader()) {
                    Console.WriteLine("Starting export...");
                    while (reader.Read()) {
                        string fullName = "";
                        string filePath = "";

                        for (int i = 0; i < reader.FieldCount; i++) {
                            string name = reader.GetName(i);
                            if (name.Contains("الاسم")) fullName = reader.GetValue(i).ToString();
                            if (name.Contains("مسار") || name.ToLower().Contains("path")) filePath = reader.GetValue(i).ToString();
                        }

                        if (!string.IsNullOrEmpty(fullName) && !string.IsNullOrEmpty(filePath)) {
                            filePath = filePath.Trim();
                            if (File.Exists(filePath)) {
                                string[] names = fullName.Split(new[] { " / " }, StringSplitOptions.RemoveEmptyEntries);
                                foreach (string name in names) {
                                    string cleanName = Regex.Replace(name.Trim(), @"[\\/:*?""<>|]", "");
                                    if (!string.IsNullOrEmpty(cleanName)) {
                                        string targetPath = Path.Combine(destFolder, cleanName + ".pdf");
                                        try {
                                            File.Copy(filePath, targetPath, true);
                                            Console.WriteLine($"Copied: {cleanName}");
                                        } catch (Exception ex) {
                                            Console.WriteLine($"Error copying {cleanName}: {ex.Message}");
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Console.WriteLine("Done.");
            } catch (Exception ex) {
                Console.WriteLine("Error: " + ex.Message);
            }
        }
    }
}
