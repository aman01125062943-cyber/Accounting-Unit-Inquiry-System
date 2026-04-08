---
description: "Task list for Smart Settlement implementation"
---

# Tasks: Smart Settlement

**Input**: Design documents from `/specs/001-smart-settlement/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize the empty page `wwwroot/smart-settlement.html` with basic layout and Tailwind CSS classes matching the user's provided HTML snippet.
- [x] T002 Import `SheetJS` via CDN to `smart-settlement.html` for Excel processing.
- [x] T003 Create backend endpoints controller shell `Endpoints/SmartSettlementEndpoints.cs`.
- [x] T004 Register the new endpoints in `Program.cs` by calling `app.MapSmartSettlementEndpoints()`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create data models `ExcelRow`, `SettlementDBRecord`, `MatchResultItem`, and `ExecutionReport` inside `Endpoints/SmartSettlementEndpoints.cs` (or `Models/` folder if it exists).

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Import Excel Data (Priority: P1) 🎯 MVP

**Goal**: As a user, I need to upload an Excel file containing updated settlement details so that I can process and match them against existing DB records.

**Independent Test**: Can be tested by uploading a valid Excel file and verifying the extracted stats (file count, record count).

### Implementation for User Story 1

- [x] T006 [US1] Implement Javascript function to read the uploaded Excel file using `SheetJS` in `smart-settlement.html`.
- [x] T007 [US1] Implement Javascript logic to map Excel rows into the `ExcelRow` JSON objects defined in the API contract.
- [x] T008 [US1] Update UI to display the "عدد الملفات المستوردة" and "عدد السجلات" statistics dynamically after processing the file.

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 3 - Execute Settlement (Priority: P1)

**Goal**: As a user, I want to execute a bulk settlement update on matched records based on the currently applied filters so that the database reflects the new bank account details.
*(Note: Placed before User Story 2 because they are both P1, but typically execution validates the data mapping end-to-end).*

**Independent Test**: Can be tested by executing settlement on a subset of filtered data and verifying the DB is updated and the result report is shown.

### Implementation for User Story 3

- [x] T009 [US3] Implement `POST /api/smart-settlement/execute` endpoint in `SmartSettlementEndpoints.cs` accepting a list of updates.
- [x] T010 [US3] Implement Dapper SQL query within an SQLite transaction to perform bulk `UPDATE` on the `Returns` or `Archive` table for the specific IDs.
- [x] T011 [US3] Implement Javascript logic to collect the matched record IDs from the UI and POST them to `/api/smart-settlement/execute`.
- [x] T012 [US3] Update UI to display the `ExecutionReport` (updated count, unmatched count) post-settlement.

**Checkpoint**: At this point, executing updates on known records works end-to-end.

---

## Phase 5: User Story 2 - Filter and Match Records (Priority: P2)

**Goal**: As a user, I want to filter records by Month, Status, and Match Type (Name or National ID) and view the hierarchical matching results to review discrepancies before settlement.

**Independent Test**: Can be tested by selecting filters and verifying the correct hierarchical data list is displayed based on mock DB data and Excel data.

### Implementation for User Story 2

- [x] T013 [US2] Implement `POST /api/smart-settlement/match` endpoint in `SmartSettlementEndpoints.cs`.
- [x] T014 [US2] Implement Dapper SQLite query to fetch matching records using `IN` clauses based on Names or National IDs provided in the payload.
- [x] T015 [US2] Implement C# algorithm to group DB records hierarchically under their corresponding `ExcelRow` source, calculating the dynamic `Status`.
- [x] T016 [US2] Implement `GET /api/smart-settlement/months` endpoint to query distinct months from the `BatchCode` column.
- [x] T017 [US2] Implement Javascript logic to populate Month filter dropdown on page load.
- [x] T018 [US2] Implement Javascript logic to send the parsed Excel JSON payload to `/api/smart-settlement/match` upon clicking "عرض المطابقة".
- [x] T019 [US2] Implement Javascript UI rendering logic to generate the hierarchical HTML displaying Excel source rows and matched DB rows.
- [x] T020 [US2] Map the frontend filtering (Status, MatchBy, Month) to correctly pass values to the backend or filter on the client side depending on UX flow.

**Checkpoint**: All user stories should now be independently functional.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T021 Code cleanup and refactoring in `smart-settlement.html` (separating JS if it gets too large).
- [x] T022 Manual testing and verification of all UI edge cases (missing required columns in Excel, empty selections, zero matches).
- [x] T023 Update `wwwroot/index.html` navigation to link to the new `smart-settlement.html` page.

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion.
- **User Stories (Phase 3+)**: 
  - US1 (Import) can be done independently.
  - US3 (Execute) depends partially on UI from US1/US2 to get real IDs, but backend can be implemented independently.
  - US2 (Match) depends on US1 providing the parsed Excel logic. US1 is a blocking prerequisite for US2 frontend testing.
- **Polish (Final Phase)**: Depends on all user stories being complete.
