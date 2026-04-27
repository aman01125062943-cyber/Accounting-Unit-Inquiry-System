---
description: "Task list for Bulk Selection and Deletion feature"
---

# Tasks: 013-bulk-selection-deletion

**Input**: Design documents from `/specs/013-bulk-selection-deletion/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure
*No specific setup tasks required as the project already exists.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T001 Refactor `GET /returns` filter logic into a shared helper method `BuildReturnsWhereClauseAsync` in `Endpoints/ReturnsEndpoints.cs`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Bulk Selection and Deletion (Priority: P1) 🎯 MVP

**Goal**: Allow users to select multiple records or all filtered records and delete them in bulk.

**Independent Test**: Verify that clicking "Select All" with a filter active, then clicking "Delete Selected", correctly deletes all matching records from the database and updates the UI.

### Implementation for User Story 1

- [x] T002 [US1] Implement `POST /returns/bulk-delete` endpoint in `Endpoints/ReturnsEndpoints.cs` (depends on T001)
- [x] T003 [US1] Add checkbox column and "Select All" header to table rendering logic in `wwwroot/js/app.js`
- [x] T004 [US1] Implement frontend selection state management (`selectedReturnIds`, `isAllReturnsSelected`) and toggle functions in `wwwroot/js/app.js`
- [x] T005 [US1] Inject "حذف المحدد" and "إلغاء التحديد" buttons into the UI in `wwwroot/js/app.js`
- [x] T006 [US1] Implement `bulkDeleteReturns` function with confirmation, loading state, and API call in `wwwroot/js/app.js`
- [x] T007 [US1] Add alert logic when changing filters while having active selections in `wwwroot/js/app.js`
- [x] T008 [P] [US1] Add CSS styles for the new checkboxes and toolbar buttons in `wwwroot/css/modern.css`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T009 Run quickstart.md validation to ensure the feature works end-to-end
- [x] T010 Code cleanup and optimization in `app.js`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A
- **Foundational (Phase 2)**: BLOCKS User Story 1 (Must extract the shared SQL builder first).
- **User Stories (Phase 3+)**: Depends on Phase 2.

### Within Each User Story

- Endpoints before Frontend integration.
- UI components before integration logic.

### Parallel Opportunities

- CSS styling (T008) can run in parallel with Backend logic (T001, T002).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (CRITICAL)
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: Test User Story 1 independently using quickstart.md
4. Deploy/demo if ready
