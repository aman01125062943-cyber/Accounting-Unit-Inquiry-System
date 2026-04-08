# Tasks: إعدادات نافذة الفلتر في قسم الفلاتر بالكامل

**Input**: Design documents from `/specs/001-settings-filters/`
**Prerequisites**: plan.md, spec.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Setup project structure and identify required files in `hk/wwwroot/` and `hk/Endpoints/`
- [ ] T002 [P] Verify Microsoft.Data.Sqlite and SheetJS exist and are working

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Setup Filter database table (Name, Type, Values, Min, Max) in `hk/Services/DatabaseService.cs`
- [x] T004 [P] Setup base API routing configuration for Settings in `hk/Endpoints/SettingsEndpoints.cs`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Add a New Filter (Priority: P1) 🎯 MVP

**Goal**: إنشاء واجهة وخدمات تتيح للمستخدم إضافة فلاتر جديدة من نوع "قائمة" أو "نطاق رقمي" وحفظها بقاعدة البيانات.

**Independent Test**: يمكن اختبار استدعاء المربع الحواري من الواجهة، تعبئة البيانات، وحفظ الفلتر في القاعدة، ورؤيته ضمن البيانات بشكل مستقل تماماً.

### Implementation for User Story 1

- [x] T005 [P] [US1] Create Filter Entity mapping logic in `hk/Services/DatabaseService.cs`
- [x] T006 [US1] Implement `GET /api/filters` and `POST /api/filters` endpoints in `hk/Endpoints/SettingsEndpoints.cs`
- [ ] T007 [P] [US1] Create the modern filter modal HTML structure in `hk/wwwroot/index.html`
- [ ] T008 [P] [US1] Apply premium styling to the filter modal in `hk/wwwroot/css/modern.css`
- [ ] T009 [US1] Implement frontend modal display, toggle logic, and form submission in `hk/wwwroot/js/app.js`
- [ ] T010 [US1] Add save and load logic invoking Backend APIs in `hk/wwwroot/js/database.js`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Edit Existing Filter (Priority: P2)

**Goal**: السماح للمستخدمين بتعديل وتحديث بيانات الفلاتر الموجودة مسبقاً لحفظ التغييرات دون حذفها وإعادة إنشائها.

**Independent Test**: النقر على زر تعديل وتأكيد جلب البيانات بنجاح، وتعديلها ليتم تحديث نفس سجل قاعدة البيانات.

### Implementation for User Story 2

- [ ] T011 [P] [US2] Implement `PUT /api/filters/{id}` endpoint in `hk/Endpoints/SettingsEndpoints.cs`
- [ ] T012 [US2] Add edit button UI logic to populate the modal with existing data in `hk/wwwroot/js/app.js`
- [ ] T013 [US2] Add backend update logic via API call in `hk/wwwroot/js/database.js`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Import Filter Values from Excel (Priority: P2)

**Goal**: إتاحة زر رفع ملفات Excel لاستخراج الأكواد من العمود الأول وتقليل الأخطاء اليدوية.

**Independent Test**: استيراد ملف من قبل المستخدم والتأكد من إضافة النصوص إلى الحقل مفصولة بفاصلة.

### Implementation for User Story 3

- [ ] T014 [P] [US3] Add file input UI element and button within the list filter group in `hk/wwwroot/index.html`
- [ ] T015 [US3] Implement Excel parsing mapping `XLSX.read` and auto-cleanup logic in `hk/wwwroot/js/app.js`

**Checkpoint**: All features up to US3 are complete

---

## Phase 6: User Story 4 - Delete an Existing Filter (Priority: P3)

**Goal**: حذف الفلاتر غير الضرورية من القائمة.

**Independent Test**: النقر على زر حذف واختبار إزالته تماماً بعد رسالة التأكيد.

### Implementation for User Story 4

- [ ] T016 [P] [US4] Implement `DELETE /api/filters/{id}` endpoint in `hk/Endpoints/SettingsEndpoints.cs`
- [ ] T017 [US4] Add UI logic for rendering delete buttons and confirmation dialogs in `hk/wwwroot/js/app.js`
- [ ] T018 [US4] Add deletion logic calling the newly created API endpoint in `hk/wwwroot/js/database.js`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T019 [P] Ensure error styling and feedback prompts (toast messages) are universally applied in `hk/wwwroot/css/modern.css`
- [ ] T020 Refactor duplicate JS code and optimize UI re-renders in `hk/wwwroot/js/app.js`
- [ ] T021 Validate SQLite edge cases (null names, empty parameters) centrally in `hk/Services/DatabaseService.cs`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 logic.
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Extends US1 modal logic.
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Requires US1 (Save) to function properly to test deleting.

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Models within a story marked [P] can run in parallel
