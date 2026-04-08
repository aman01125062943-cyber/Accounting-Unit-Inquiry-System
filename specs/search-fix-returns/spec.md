# Feature Specification: Fix Search for Incentive Returns

**Feature Branch**: `fix-search-returns`  
**Created**: 2026-03-16  
**Status**: Draft  
**Problem**: The "Incentive Returns" (مرتدات الحوافز) page does not correctly respond to search queries, or the search is not inclusive of this page's data.

## User Scenarios & Testing

### User Story 1 - Search in Incentive Returns (Priority: P1)
As a user, I want to type a value (e.g., beneficiary name or amount) into the search box on the Incentive Returns page and see only matching records.

**Why this priority**: Essential for data retrieval.  
**Acceptance Scenarios**:
1. **Given** I am on the "مرتدات الحوافز" page, **When** I type "أحمد" in the search box, **Then** only records containing "أحمد" should be displayed in the table.

---

## Requirements

### Functional Requirements
- **FR-001**: The search input `table-search` must trigger data re-fetching for the current page.
- **FR-002**: The search logic must support searching across all localized JSON fields in the `Returns` table.
- **FR-003**: If FTS5 is used, it must be verified/initialized; otherwise, fallback to `LIKE` over JSON-extracted fields.
- **FR-004**: Synchronize `global-search` (if present) with `table-search`.

### Technical Requirements
- Update `ReturnsEndpoints.cs` to ensure search query covers more than just `ReturnCode`.
- Update `app.js` search event listener to correctly handle debounce and data reload.

## Success Criteria
- **SC-001**: Searching "Incentive Returns" returns expected records within <500ms.
- **SC-002**: Search works even when the local cache is not yet fully populated.
