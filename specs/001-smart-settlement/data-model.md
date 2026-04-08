# Data Model: Smart Settlement

## Entities

### `ExcelRow`
Represents a row parsed from the imported Excel file on the frontend.
- `BatchCode` (string)
- `Name` (string)
- `NationalId` (string)
- `CurrentAccount` (string)
- `CurrentBank` (string)
- `ModifiedAccount` (string)
- `ModifiedBank` (string)
- `ReturnDate` (string)
- `ReturnApprovalDate` (string)
- `ModDate` (string)
- `ModApprovalDate` (string)

### `SettlementDBRecord`
Represents the existing record in the SQLite Database (Archive/Returns) that needs to be matched and updated.
- `Id` (integer)
- `BatchCode` (string)
- `Month` (string) - Extracted from BatchCode dynamically (e.g., "03-2026")
- `Name` (string)
- `NationalId` (string)
- `CurrentAccount` (string)
- `CurrentBank` (string)
- `ModifiedAccount` (string)
- `ModifiedBank` (string)
- `ReturnDate` (string)
- `ReturnApprovalDate` (string)
- `ModDate` (string)
- `ModApprovalDate` (string)
- `Status` (string) - Calculated: "تم التسوية" if `ReturnApprovalDate` is not null/empty, otherwise "لم يتم التسوية"

### `MatchResultItem`
Represents the hierarchical mapping shown to the user.
- `SourceExcelRow` (`ExcelRow`)
- `Matches` (`List<SettlementDBRecord>`)
- `MatchStatus` (boolean) - True if matches found, False if no matches.

### `ExecutionReport`
Response sent after bulk update.
- `UpdatedCount` (integer)
- `NotUpdatedCount` (integer)
- `UnmatchedCount` (integer)
