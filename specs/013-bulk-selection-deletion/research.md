# Research: 013-bulk-selection-deletion

## Unknowns Resolution
- **Backend Filter Sharing**: Currently, filtering logic is hardcoded inside `ReturnsEndpoints.cs` inside the GET endpoint.
  - *Decision*: Refactor the query building logic into a shared helper method `BuildReturnsWhereClauseAsync` inside `ReturnsEndpoints.cs`.
  - *Rationale*: This ensures that the new `POST /returns/bulk-delete` endpoint uses the exact same logic as `GET /returns`, allowing safe "Select All" deletion across pages.
  - *Alternatives considered*: Re-implementing the logic or passing all IDs from frontend (not scalable for 50k records).

## Best Practices
- **Frontend Selection State**: 
  - *Decision*: Use a `Set` for `selectedReturnIds` to store individually selected items, and a boolean `isAllReturnsSelected` flag for "Select All".
  - *Rationale*: A Set provides O(1) lookup which is efficient for checking if a row should be checked during render. The boolean flag covers the case where the user wants to delete thousands of records without holding 50k IDs in memory.

## Scope Check
- The changes are strictly limited to the Returns UI and the backend endpoint for Returns.
- No database schema changes are required since we utilize the existing `IsDeleted` column for soft-deletion.
