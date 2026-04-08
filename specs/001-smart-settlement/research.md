# Outline & Research

## Technical Unknowns Resolved

### How to parse the Excel file?
- **Decision**: Read and parse the Excel file on the frontend using `SheetJS` (xlsx library via CDN), then send the extracted and normalized data as a JSON payload to the backend.
- **Rationale**: Keeps the backend lightweight without adding new NuGet dependencies for Excel parsing (like `ClosedXML` or `EPPlus`). The user's provided HTML code already relies on CDNs (`tailwindcss`), so adding another CDN script for `SheetJS` fits the project pattern and avoids increasing the backend build size.
- **Alternatives considered**: Parsing in C# using `ClosedXML`. This would require a new dependency and handling file uploads as multipart/form-data directly, which is slightly more complex in .NET Minimal APIs than just accepting a clean JSON payload.

### How to execute the matching algorithm efficiently?
- **Decision**: The backend will expose an endpoint `/api/smart-settlement/match` that accepts the JSON records from the Excel file and queries the SQLite database using `Dapper`. The query will use `IN` clauses for the provided Names and National IDs to fetch all matching DB records in a single batch, and then map them hierarchically in C#.
- **Rationale**: The `constitution.md` emphasizes server stability and performance. Fetching all matching entries in one optimized SQL query avoids the N+1 problem.

### Where to put the backend logic?
- **Decision**: Create a new file `Endpoints/SmartSettlementEndpoints.cs` to keep the settlement logic isolated and clean.
- **Rationale**: Aligns with the existing architecture which uses extensions like `MapReturnsEndpoints()` and `MapAuthEndpoints()`. It keeps `Program.cs` tidy.

## Best Practices & Patterns
- **Data Integrity**: Ensure the batch update (Settlement) is wrapped in a dedicated SQL Transaction `using (var transaction = connection.BeginTransaction())` to guarantee either all records update successfully or none do, ensuring old data integrity (Constraint from Constitution).
- **Matching Details**: The month filter dynamically extracted from `كود الملف` must be computed. We can do this extraction on the database level or application level. Application level is chosen for flexibility since string splitting in SQLite can be restrictive.
