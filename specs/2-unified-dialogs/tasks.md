# Tasks: Unified Dialog System

**Input**: Design documents from `/specs/2-unified-dialogs/`
**Prerequisites**: plan.md, spec.md

## Phase 1: Setup
**Purpose**: Project readiness for UI changes.
- [x] T001 Verify `modern.css` and `app.js` are not currently containing conflicting dialog logics.

## Phase 2: Foundational
**Purpose**: Core CSS structure and base JS that MUST be complete before ANY user story.
- [x] T002 Update `modern.css` to add the new Glassmorphism design and animations for `.floating-dialog`.
- [x] T003 Update the base `DialogSystem` class in `app.js` to support new layout generation (Title, Message, Type Icons) and smooth DOM removal.

## Phase 3: User Story 1 - Confirmations (Priority: P1)
**Goal**: Implement unified confirmation dialogs (e.g., Deletion warnings).
**Independent Test**: Trigger a deletion in the UI; verify the new dialog appears centered and functional.
- [x] T004 [P] [US1] Implement the HTML structure template inside `app.js` specifically for question/confirm types.
- [x] T005 [P] [US1] Apply the new `DialogSystem` to the delete attachment method replacing old calls.
- [x] T006 [US1] Test deletion flow end-to-end to ensure it respects the User Story.

## Phase 4: User Story 2 - Toasts/Alerts (Priority: P2)
**Goal**: Implement fast, auto-disappearing toasts for success/error messages.
**Independent Test**: Trigger a successful save or error scenario; verify toast appears and disappears.
- [x] T007 [P] [US2] Create CSS classes in `modern.css` for `.toast-notification` with slide-in/out animations.
- [x] T008 [P] [US2] Update `app.js` -> `showToast` method to use the new unified design.
- [x] T009 [US2] Verify toast stacking and auto-removal functionality.

## Phase 5: User Story 3 - Prompts / Forms (Priority: P3)
**Goal**: Replace default browser prompts with custom, styled inline forms.
**Independent Test**: Trigger a quick input action; verify custom glassmorphic prompt appears.
- [x] T010 [P] [US3] Add prompt/input specific layout handling inside `DialogSystem`.
- [x] T011 [US3] Connect the new prompt dialog to at least one action (e.g., inputting a quick setting or filter) to replace `window.prompt`.

## Phase N: Polish & Cross-Cutting Concerns
**Purpose**: Improvements that affect all dialogs.
- [x] T012 Refactor remaining ancient `alert()` or `confirm()` calls in the app to use `dialog.show()`.
- [x] T013 Responsive checks: Ensure dialogs scale properly on mobile widths.

---

## Dependencies & Execution Order
- Phase 1 & 2 must be completed first.
- US1 (Confirmations) is P1 and should be delivered as MVP.
- US2 and US3 can be done in parallel once US1 is fully stable.
