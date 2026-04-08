# Data Model: Comprehensive Error Check

## Entities

### DiagnosticReport
Represents the result of a full system scan.
- **Timestamp**: DateTime (When the check was performed)
- **BuildStatus**: Enum (Success, Failed)
- **ScriptStatus**: Map<String, Status> (File name to its syntax/execution status)
- **DatabaseStatus**: Boolean (Connection integrity)
- **Errors**: List<String> (Specific error messages captured)

### DatabaseIntegrity
Status of the SQLite database.
- **Path**: String (Absolute path to hk.db)
- **CanConnect**: Boolean
- **IsCorrupted**: Boolean (Detected via PRAGMA integrity_check)
- **Size**: Long (File size in bytes)

## Relationships
- A **DiagnosticReport** contains one **DatabaseIntegrity** status and multiple **ScriptStatus** entries.
