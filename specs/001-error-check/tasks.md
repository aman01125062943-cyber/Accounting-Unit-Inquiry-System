# Tasks: Comprehensive Error Check

**Input**: Design documents from `/specs/001-error-check/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: US1 (System Scan), US2 (Test Verification)

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Verify environment readiness (dotnet SDK, PowerShell) in repo root

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T002 Fix encoding of all `.ps1` files to UTF-8 with BOM to support Arabic characters
- [x] T003 Verify `hk.db` file integrity using `PRAGMA integrity_check;`

---

## Phase 3: User Story 1 - Comprehensive System Scan (Priority: P1) 🎯 MVP

**Goal**: Trigger a full diagnostic scan of C# code and PowerShell scripts.

**Independent Test**: Run build and diagnostic scripts; output should show success for all components.

### Implementation for User Story 1

- [x] T004 [US1] Execute `dotnet build` and resolve any remaining warnings/errors in `HKServer.csproj`
- [x] T005 [P] [US1] Run syntax validation for all `.ps1` files using `powershell.exe`
- [x] T006 [US1] Verify database connectivity from PowerShell scripts (e.g., `GetColumns.ps1`)

**Checkpoint**: User Story 1 (Full Scan) is functional.

---

## Phase 4: User Story 2 - Automated Test Verification (Priority: P2)

**Goal**: Run existing tests to ensure no regressions.

**Independent Test**: All tests in `testsprite_tests` must pass.

### Implementation for User Story 2

- [x] T007 [US2] Execute frontend/backend tests using `testsprite` tools
- [x] T008 [US2] Document any failing tests in a new diagnostic report

**Checkpoint**: User Story 2 (Regression Testing) is complete.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T009 [P] Generate a final consolidated diagnostic report in `specs/001-error-check/diagnostic_report.md`
- [x] T010 Clean up any temporary debug logs or artifacts

---

## Dependencies & Execution Order

1. **Phase 1 & 2** are mandatory first steps.
2. **Phase 3 (US1)** is the MVP and should be completed before Phase 4.
3. **Phase 5** depends on the completion of all diagnostic tasks.

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Fix script encoding (T002).
2. Ensure build passes (T004).
3. Validate all scripts (T005, T006).
