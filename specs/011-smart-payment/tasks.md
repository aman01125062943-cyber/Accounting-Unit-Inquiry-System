# Tasks: Smart Payment Fixes

**Branch**: `011-smart-payment` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Implementation Strategy
- Fix the backend models to accept the required fields.
- Overhaul the frontend parsing logic.
- Add the UI elements needed for tracking the edits.
- Correct the bulk execution fallback behavior.

## Dependencies

- Phase 2 must complete before Phase 3.

---

## Phase 1: Setup

- [x] T001 Verify project compiles and SQLite DB `hk.db` builds properly.
- [x] T002 Switch to or ensure we are on the `011-smart-payment` branch.

## Phase 2: Backend Foundations (Models & Endpoints)

- [x] T003 Update `ExcelRow` class in `Endpoints/SmartSettlementEndpoints.cs` to include `SettlementNo` and `SettlementDate`.
- [x] T004 Update `ExecuteUpdateItem` class in `Endpoints/SmartSettlementEndpoints.cs` to include the same new properties.
- [x] T005 Review `salUpdateSql` in `SmartSettlementEndpoints.cs` to ensure mapping properties for `@SettlementNo` and `@SettlementDate` match exactly.

## Phase 3: Frontend Data Parsing & State (US1/US2)

- [x] T006 [US1] Update `findCol` logic in `app.js` (`runSmartPaymentMatch`) to extract `settlementNo` (e.g., 'رقم تسوية السداد') and `settlementDate` ('تاريخ تسوية السداد').
- [x] T007 [US1] Update `mappedRecords` in `app.js` to assign `settlementNo` and `settlementDate`.
- [x] T008 [US2] Update `MatchRequest` construction to include `SettlementNo` and `SettlementDate` for backend transmission.

## Phase 4: UI Updates (US2)

- [x] T009 [US2] In `app.js` (`renderSmartPaymentResults`), add input fields for `SettlementNo` and `SettlementDate` within the `.source-field` grid.
- [x] T010 [US2] Bind the new inputs to `app.updateSmartExcelValue(index, 'settlementNo', ...)` and `app.updateSmartExcelValue(index, 'settlementDate', ...)`.

## Phase 5: Execution Logic Fixes (US3)

- [x] T011 [US3] In `app.js` (`executeSmartPayment`), remove the fallback logic (e.g., `src.modifiedAccount || src.ModifiedAccount`). Map properties strictly utilizing `src.modifiedAccount != null ? src.modifiedAccount : src.ModifiedAccount` to preserve empty string erasions.
- [x] T012 [US3] Ensure `executeSmartPayment` passes `SettlementNo` and `SettlementDate` for Salary match arrays accurately.

## Phase 6: Polish

- [x] T013 Perform end-to-end test verifying manual edits are respected and all columns update in the `hk.db` `SalaryReturns` JSON data.
