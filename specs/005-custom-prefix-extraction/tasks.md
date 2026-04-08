# Tasks: Custom Prefix Return Code Extraction

**Input**: Design documents from `/specs/005-custom-prefix-extraction/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and ensuring settings are reachable.

- [x] T001 Verify `extraction-prefixes` textarea exists in `wwwroot/index.html`
- [x] T002 Ensure FontAwesome is correctly linked in `wwwroot/index.html` for status icons

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core logic infrastructure in `app.js` before user stories.

- [x] T003 Ensure `this.extractionPrefixes` is properly initialized in `App.init()` within `wwwroot/js/app.js`
- [x] T004 Define a helper `cleanString` in `wwwroot/js/app.js` to strip leading/trailing separators
- [x] T005 [P] Improve `saveExtractionPrefixes` in `wwwroot/js/app.js` to sort prefixes by length (descending) before saving

**Checkpoint**: Foundation ready - extraction logic can now be refactored per user story.

---

## Phase 3: User Story 1 - Extraction by Exact Prefix (Priority: P1) 🎯 MVP

**Goal**: Extract the segment immediately following a user-defined prefix.

**Independent Test**: Save a prefix `Army-c` and verify that `Army-c-463` results in `463`.

### Implementation for User Story 1

- [x] T006 [US1] Modify `extractReturnCode` in `wwwroot/js/app.js` to iterate through `this.extractionPrefixes`
- [x] T007 [US1] Implement string slicing logic to find content after a matched prefix in `wwwroot/js/app.js`
- [x] T008 [US1] Apply delimiter splitting (hyphen, dot, space) to the sliced content in `wwwroot/js/app.js`
- [x] T009 [US1] Return the first valid segment found after the prefix in `wwwroot/js/app.js`
- [x] T010 [US1] Ensure `renderTable` in `wwwroot/js/app.js` correctly maps the result to the Return Code column

**Checkpoint**: User Story 1 (MVP) is functional.

---

## Phase 4: User Story 2 - Automated Numeric Extraction (Priority: P2)

**Goal**: Fallback to long numeric sequences if no prefix matches.

**Independent Test**: Verify that `8001012600651-02-2026` extracts the full numeric ID without a prefix.

### Implementation for User Story 2

- [x] T016: إضافة دالة normalizeArabic لتصفية الكشيدة والتشكيل من مسميات الحقول.
- [x] T017: ربط حقل "كود المرتد" حصرياً بحقل "كود الملف" المطبّع.
- [x] T018: تحديث رقم الإصدار إلى 7.1 وضمان تجاوز كاش المتصفح.
- [x] T019: إزالة المنطق الاحتياطي الذي يسحب من المعرفات (ID).

**Checkpoint**: All extraction scenarios are now handled.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and UI smoothness.

- [x] T013 [P] Verify performance of rendering with 18k records in `wwwroot/js/app.js`
- [x] T014 Run validation using `specs/005-custom-prefix-extraction/quickstart.md`
- [x] T015 Remove any debug `console.log` statements from `wwwroot/js/app.js`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup & Foundational**: Must complete T001-T005 first.
- **User Story 1 (P1)**: The core success condition for the user.
- **User Story 2 (P2)**: Handles edge cases and numeric-only formats.

### Parallel Opportunities

- T005 can be updated while checking UI in T001/T002.
- Polish tasks T013-T015 can be done in any order after functional completion.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Ensure the prefix sorting is correct (T005).
2. Implement the "After Prefix" extraction logic (T006-T010).
3. Verify with the user's specific example (`Army-c-463`).
