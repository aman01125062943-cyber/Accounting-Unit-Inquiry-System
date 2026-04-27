# Data Model: 013-bulk-selection-deletion

## Database Entities

No new database tables are introduced. 
We rely on the existing `IsDeleted` column in the `Returns` table for soft deletions.

```sql
-- Existing structure
CREATE TABLE Returns (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    RawData TEXT,
    ReturnCode TEXT,
    UploadDate TEXT,
    IsDeleted INTEGER DEFAULT 0
    -- other fields
);
```

## API Contracts

### `POST /returns/bulk-delete`

**Description:** Deletes multiple records either by specific IDs or by matching current filters (Select All).

**Request Body:**
```json
{
  "Ids": [1, 2, 3],
  "DeleteAllFiltered": true,
  "Search": "query",
  "Filter": "All",
  "FilterId": "some-guid",
  "AttachmentStatus": "all",
  "Min": null,
  "Max": null,
  "TargetColumn": "كود الملف",
  "UploadDateFrom": "2023-01-01",
  "UploadDateTo": "2023-12-31"
}
```

**Response:**
```json
{
  "success": true,
  "count": 500
}
```

## Frontend State (app.js)

```javascript
App.prototype.selectedReturnIds = new Set();
App.prototype.isAllReturnsSelected = false;
```
