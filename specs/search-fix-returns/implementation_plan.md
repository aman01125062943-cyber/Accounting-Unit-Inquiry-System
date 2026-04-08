# Implementation Plan: Fix Search for Incentive Returns

This plan addresses the issue where the search functionality does not correctly include or trigger for the "Incentive Returns" (مرتدات الحوافز) page.

## Proposed Changes

### 1. UI: Header Search Component
- **File**: `wwwroot/index.html`
- **Change**: Add a global search input in the `.header-actions` div with `id="global-search"`. This provides a consistent search entry point visible on all pages.

### 2. Frontend: Unified Search Handler
- **File**: `wwwroot/js/app.js`
- **Change**: 
    - Update the `searchHandler` function to detect `this.currentPage`.
    - If `currentPage === 'returns'`, call `this.loadReturns()`.
    - If `currentPage === 'full-returns'`, call `this.loadFullReturns()`.
    - Ensure two-way synchronization between `global-search` and page-specific search boxes (`table-search` and `full-returns-search`).

### 3. Backend: Search Query Robustness
- **File**: `Endpoints/ReturnsEndpoints.cs`
- **Change**: Ensure the `@SearchFTS` parameter for FTS5 is properly formatted (e.g., adding wildcards if the built-in FTS doesn't handle partial matches as expected by the user). Update the `sqlWhere` to include a fallback `LIKE` search on the `RawData` column for small queries to guarantee results.

## Verification Plan

### Automated Tests
- N/A (Standard manual verification as per project style).

### Manual Verification
1. Navigate to "مرتدات الحوافز".
2. Type a known value in the header search box.
3. Verify the table filters correctly.
4. Navigate to "المرتدات كاملة".
5. Type another value.
6. Verify the table filters correctly.
