# Quickstart: 013-bulk-selection-deletion

## Overview
This feature introduces bulk selection and deletion for the Returns (مرتدات الحوافز) table. It allows users to manage multiple records simultaneously without the need for individual row deletion.

## Implementation Details

1. **Frontend (`app.js`)**:
   - `renderTable` modified to include `<input type="checkbox">`
   - Added logic for `selectedReturnIds` and `isAllReturnsSelected`.
   - Integrated UI prompts if filters are changed while selection is active.
   - Added `bulkDeleteReturns` to call the new endpoint.

2. **Backend (`ReturnsEndpoints.cs`)**:
   - Refactored filter logic into `BuildReturnsWhereClauseAsync`.
   - Added `POST /returns/bulk-delete` endpoint.
   
## Verification
1. Open the Returns page.
2. Select a few items and click "حذف المحدد".
3. Check the "Select All" box at the top to select all filtered items. Verify that clicking "حذف المحدد" deletes all items matching the current filter, not just the visible page.
