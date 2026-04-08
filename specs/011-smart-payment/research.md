# Research: Smart Payment (Settlement) Fixes

## Decision: Add missing columns and fix frontend fallback logic
**Rationale:**
1. **Missing Columns:** The user noted that when executing Salary updates, not all columns are updated as expected. Specifically, `رقم تسوية السداد` (SettlementNo) and `تاريخ تسوية السداد` (SettlementDate) are not extracted from the Excel file, not passed via the MatchRequest, not editable in the UI, and thus are hardcoded to empty strings in `executeSmartPayment()`. Adding these throughout the stack will fix the incomplete updates.
2. **Manual Edit Bug ("Barely Respected"):** When the user edits a field in the frontend (e.g. changing `modifiedAccount` to an empty string or manually modifying it), the `executeSmartPayment` function uses logic like `NewAccount: src.modifiedAccount || src.ModifiedAccount || ''`. The `||` operator causes empty strings (from manual erasure) to be overwritten by the fallback. Additionally, case sensitivity issues between the server's serialized JSON and local object mutations cause edits to be dropped. We will simplify property access strictly to the standard keys mapped by the frontend.

**Alternatives considered:** 
- Instead of adding UI fields, we could just read the columns implicitly. However, since the user expects manual edits to be respected and visually confirmed, adding them to the Master-Detail view brings full transparency.

## Decision: Update `SmartSettlementEndpoints.cs` to handle the new columns
**Rationale:**
The `ExcelRow` and `ExecuteUpdateItem` classes currently lack `SettlementNo` and `SettlementDate`. Adding them directly maps to the database queries defined in `salUpdateSql`.

**Alternatives considered:**
- Sending arbitrary JSON fields. Harder to maintain in statically typed C#.
