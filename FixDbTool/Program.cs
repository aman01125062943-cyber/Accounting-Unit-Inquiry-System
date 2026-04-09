using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.IO;

namespace Fixer;

class Program
{
    static void Main(string[] args)
    {
        string baseDir = @"Z:\فرع الاعمال الحسابية\قسم البنوك\منظومة الجديدة";
        string sourceDb = Path.Combine(baseDir, "hk.db");
        string destDb = Path.Combine(baseDir, "hk_rebuilt.db");

        Console.WriteLine($"[DEEP REPAIR] Source: {sourceDb}");
        Console.WriteLine($"[DEEP REPAIR] Destination: {destDb}");

        if (File.Exists(destDb)) File.Delete(destDb);

        using var srcConn = new SqliteConnection($"Data Source={sourceDb};Mode=ReadOnly");
        using var destConn = new SqliteConnection($"Data Source={destDb}");

        try
        {
            srcConn.Open();
            destConn.Open();
            
            using (var cmd = destConn.CreateCommand()) {
                cmd.CommandText = "PRAGMA foreign_keys = OFF;";
                cmd.ExecuteNonQuery();
            }

            Console.WriteLine("[DEEP REPAIR] Connections opened, FK check disabled for migration.");

            // 1. Get Tables List (Non-FTS, Non-System)
            var tables = new List<string>();
            using (var cmd = srcConn.CreateCommand())
            {
                cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%' AND name NOT LIKE '%_idx%' AND name NOT LIKE '%_content%' AND name NOT LIKE '%_docsize%' AND name NOT LIKE '%_config%' AND name NOT LIKE '%_data%';";
                using var reader = cmd.ExecuteReader();
                while (reader.Read()) tables.Add(reader.GetString(0));
            }

            // 2. Create Schema for each table
            foreach (var table in tables)
            {
                using var cmd = srcConn.CreateCommand();
                cmd.CommandText = $"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table}';";
                string? sql = cmd.ExecuteScalar()?.ToString();
                if (!string.IsNullOrEmpty(sql))
                {
                    using var createCmd = destConn.CreateCommand();
                    createCmd.CommandText = sql;
                    createCmd.ExecuteNonQuery();
                    Console.WriteLine($"[DEEP REPAIR] Created Table: {table}");
                }
            }

            // 3. Copy Data
            foreach (var table in tables)
            {
                Console.WriteLine($"[DEEP REPAIR] Copying Data for: {table}...");
                int count = 0;
                int errorCount = 0;

                using var selectCmd = srcConn.CreateCommand();
                selectCmd.CommandText = $"SELECT * FROM \"{table}\";";
                
                try {
                    using var reader = selectCmd.ExecuteReader();
                    var columns = new List<string>();
                    var skipColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "FileCode", "Amount", "SettlementDate" };
                    for (int i = 0; i < reader.FieldCount; i++) 
                    {
                        string name = reader.GetName(i);
                        if (!skipColumns.Contains(name)) columns.Add(name);
                    }

                    string insertSql = $"INSERT INTO \"{table}\" ({string.Join(",", columns.ConvertAll(c => $"\"{c}\""))}) VALUES ({string.Join(",", columns.ConvertAll(c => "@" + c))});";

                    using var trans = destConn.BeginTransaction();
                    while (reader.Read())
                    {
                        try
                        {
                            using var insertCmd = destConn.CreateCommand();
                            insertCmd.CommandText = insertSql;
                            insertCmd.Transaction = trans;
                            for (int i = 0; i < reader.FieldCount; i++)
                            {
                                var val = reader.GetValue(i);
                                insertCmd.Parameters.AddWithValue("@" + columns[i], val ?? DBNull.Value);
                            }
                            insertCmd.ExecuteNonQuery();
                            count++;
                            if (count % 1000 == 0) Console.Write(".");
                        }
                        catch (Exception ex)
                        {
                            errorCount++;
                            Console.WriteLine($"\n[DEEP REPAIR] [ITEM ERROR] In {table}: {ex.Message}");
                        }
                    }
                    trans.Commit();
                    Console.WriteLine($"\n[DEEP REPAIR] Finished {table}: {count} records copied. ({errorCount} errors skipped)");
                } catch (Exception ex) {
                    Console.WriteLine($"[DEEP REPAIR] [TABLE ERROR] Failed to read {table}: {ex.Message}");
                }
            }

            // 4. Rebuild FTS and Triggers (By calling schema logic or just indices)
            Console.WriteLine("[DEEP REPAIR] Finalizing indexes and triggers...");
            // We'll copy all indexes and triggers from source as well
            using (var cmd = srcConn.CreateCommand())
            {
                cmd.CommandText = "SELECT sql FROM sqlite_master WHERE type IN ('index', 'trigger', 'view') AND name NOT LIKE 'sqlite_%';";
                using var reader = cmd.ExecuteReader();
                while (reader.Read())
                {
                    string? sql = reader.GetValue(0)?.ToString();
                    if (!string.IsNullOrEmpty(sql))
                    {
                        try {
                            using var execCmd = destConn.CreateCommand();
                            execCmd.CommandText = sql;
                            execCmd.ExecuteNonQuery();
                        } catch {}
                    }
                }
            }

            // Also handle FTS tables specifically if they weren't in the list
            // (The triggers above will handle it if they were created)

            Console.WriteLine("[DEEP REPAIR] Running Final Integrity Check on REBUILT database...");
            using (var checkCmd = destConn.CreateCommand())
            {
                checkCmd.CommandText = "PRAGMA integrity_check;";
                var result = checkCmd.ExecuteScalar();
                Console.WriteLine($"[DEEP REPAIR] Final Result: {result}");
            }

        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DEEP REPAIR] [CRITICAL ERROR] {ex.Message}");
        }
        finally
        {
            srcConn.Close();
            destConn.Close();
        }
    }
}
