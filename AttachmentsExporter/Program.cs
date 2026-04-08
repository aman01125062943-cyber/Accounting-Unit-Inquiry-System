using System;
using System.IO;
using System.Data.OleDb;
using System.Text.RegularExpressions;
using System.Collections.Generic;

namespace AttachmentsExporter;

class Program
{
    static void Main(string[] args)
    {
        // إعداد المسارات مع دعم كامل للحروف العربية
        string dbPath = @"\\128.30.200.225\esth_share\" + "فرع الاعمال الحسابية" + @"\" + "قسم البنوك" + @"\" + "برنامج ارشيف البنوك" + @"\deat\" + "ارشيف قسم البنوك_be.accdb";
        string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
        string destFolder = Path.Combine(desktopPath, "Attachments_Export");

        if (Directory.Exists(destFolder))
        {
            Console.WriteLine($"[INFO] Cleaning destination folder: {destFolder}");
            foreach (string file in Directory.GetFiles(destFolder)) File.Delete(file);
        }
        else
        {
            Directory.CreateDirectory(destFolder);
            Console.WriteLine($"[INFO] Created folder: {destFolder}");
        }

        string connectionString = $"Provider=Microsoft.ACE.OLEDB.12.0;Data Source={dbPath};";

        try
        {
            using (OleDbConnection connection = new OleDbConnection(connectionString))
            {
                connection.Open();
                Console.WriteLine("[SUCCESS] Connected to database.");

                // استعلام لربط الأسماء من جدول Doc مع المسارات من جدول Images
                string query = "SELECT Doc.[اسم], Images.[Path] FROM Doc INNER JOIN Images ON Doc.[IDD] = Images.[IDD]";
                
                using (OleDbCommand command = new OleDbCommand(query, connection))
                using (OleDbDataReader reader = command.ExecuteReader())
                {
                    int totalCopied = 0;
                    int recordsFound = 0;
                    HashSet<string> exportedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    
                    Console.WriteLine("[INFO] Scanning and linking records (Unique names mode)...");

                    while (reader.Read())
                    {
                        recordsFound++;
                        string fullName = reader["اسم"]?.ToString() ?? "";
                        string filePath = reader["Path"]?.ToString() ?? "";

                        if (!string.IsNullOrEmpty(fullName) && !string.IsNullOrEmpty(filePath))
                        {
                            filePath = filePath.Trim();
                            if (File.Exists(filePath))
                            {
                                // تقسيم الأسماء بناءً على الفواصل المعروفة
                                string[] names = fullName.Split(new[] { '/', '\\', '|', '-' }, StringSplitOptions.RemoveEmptyEntries);
                                foreach (var name in names)
                                {
                                    string cleanName = Regex.Replace(name.Trim(), @"\s+", " ");
                                    if (string.IsNullOrEmpty(cleanName) || cleanName.Length < 2) continue;

                                    // التحقق مما إذا كان هذا الاسم قد تم تصديره من قبل
                                    if (exportedNames.Contains(cleanName)) continue;

                                    string safeFileName = Regex.Replace(cleanName, @"[\\/:*?""<>|]", "_").Trim();
                                    string targetPath = Path.Combine(destFolder, safeFileName + ".pdf");

                                    try
                                    {
                                        File.Copy(filePath, targetPath, true);
                                        Console.WriteLine($"[NEW] {cleanName}");
                                        exportedNames.Add(cleanName);
                                        totalCopied++;
                                    }
                                    catch (Exception ex)
                                    {
                                        Console.WriteLine($"[ERR] {cleanName}: {ex.Message}");
                                    }
                                }
                            }
                        }
                    }

                    Console.WriteLine("\n========================================");
                    Console.WriteLine($"[SUMMARY] Links found: {recordsFound}");
                    Console.WriteLine($"[SUMMARY] Unique names exported: {totalCopied}");
                    Console.WriteLine($"[LOCATION] {destFolder}");
                    Console.WriteLine("========================================");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CRITICAL ERROR] {ex.Message}");
        }
    }
}
