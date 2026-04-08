# Tasks: حقل كود المرتد والبحث المطور

**Input**: Design documents from `/specs/003-return-code-field/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

## Organization: Tasks are grouped by user story (US1: Fast Search, US2: Range Filtering).

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [P] إنشاء نسخة احتياطية من قاعدة البيانات `hk.db` قبل التعديل
- [x] T002 التحقق من توفر مساحة كافية لتحديث قاعدة البيانات

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: يجب اكتمال هذه المرحلة قبل البدء في أي قصة مستخدم.

- [x] T003 إضافة دالة `ExtractReturnCode` لاستخراج الرقم بين أول شرطتين في `Services/DatabaseService.cs`
- [x] T004 تنفيذ Migration لإضافة عمود `ReturnCode` وفهرس (Index) في جدول `Returns` عبر `Services/DatabaseService.cs`
- [x] T005 تطبيق منطق الترحيل (Data Migration) لتعبئة الحقل الجديد للبيانات التاريخية في `Services/DatabaseService.cs`
- [x] T006 [P] تحديث موديل `ReturnRecord` ليشمل الحقل الجديد في `Models/ReturnRecord.cs` (إن وجد) أو `ReturnsEndpoints.cs`

**Checkpoint**: الأساس جاهز - يمكن الآن البدء في تنفيذ ميزات البحث والفلترة.

---

## Phase 3: User Story 1 - البحث السريع بكود المرتد (Priority: P1) 🎯 MVP

**Goal**: تمكين المستخدم من العثور على الملفات باستخدام الرقم المستخرج فقط بسرعة عالية.

**Independent Test**: البحث عن الجزء الرقمي من كود ملف موجود والتأكد من ظهوره فوراً.

### Implementation for User Story 1

- [x] T007 تحديث منطق حفظ السجلات الجديدة لضمان استخراج وتعبئة `ReturnCode` آلياً في `Services/DatabaseService.cs`
- [x] T008 تعديل استعلام البحث في مسار `/returns` ليعطي الأولوية للمطابقة في عمود `ReturnCode` في `Endpoints/ReturnsEndpoints.cs`
- [x] T009 [P] التأكد من تحديث جدول FTS5 ليشمل البيانات الجديدة إذا كان البحث يعتمد عليه في `Endpoints/ReturnsEndpoints.cs`

**Checkpoint**: قصة المستخدم 1 مكتملة - البحث السريع يعمل الآن بشكل مستقل.

---

## Phase 4: User Story 2 - الفلترة المتقدمة بنطاق كود المرتد (Priority: P2)

**Goal**: تحسين دقة وسرعة فلاتر النطاق (Range) باستخدام الحقل الرقمي المخصص.

**Independent Test**: تطبيق فلتر نطاق (Min/Max) على كود الملف والتأكد من استخدام `ReturnCode` في SQL.

### Implementation for User Story 2

- [x] T010 تعديل دالة `ApplyCriterion` في `Endpoints/ReturnsEndpoints.cs` لاستبدال `json_extract` بـ `ReturnCode` عند الفلترة على "كود الملف"
- [x] T011 تحديث منطق بناء الـ SQL لنطاقات الأرقام (Range) لتكون مباشرة على العمود الجديد في `Endpoints/ReturnsEndpoints.cs`

**Checkpoint**: كافة قصص المستخدم مكتملة ومختبرة بشكل مستقل.

---

## Phase N: Polish & Cross-Cutting Concerns

- [x] T012 [P] تحديث ملف `walkthrough.md` بالنتائج المسجلة للبحث الجديد
- [x] T013 تنظيف الكود وإزالة أي استعلامات قديمة غير مستخدمة
- [x] T014 التحقق النهائي باستخدام الدليل السريع `quickstart.md`

---

## Phase 5: Frontend Integration (UI Display)

- [/] T015 تحديث نقاط النهاية (Endpoints) لإدراج `ReturnCode` في كائنات JSON المرسلة للواجهة <!-- id: 15 -->
- [ ] T016 تحديث `app.js` لضمان ظهور عمود "كود المرتد" في الجداول تلقائياً <!-- id: 16 -->
- [ ] T017 إضافة "كود المرتد" كخيار في قائمة الفلاتر السريعة في الواجهة <!-- id: 17 -->
- [ ] T018 التحقق من إمكانية الفلترة والبحث باستخدام العمود الجديد من المتصفح <!-- id: 18 -->

---

## Dependencies & Execution Order

1. **Foundational (T003-T006)**: يجب أن تكتمل أولاً لأنها تبني العمود وتعبئه بالبيانات.
2. **User Story 1 (T007-T009)**: تعتمد على وجود العمود وتخدم الهدف الأساسي (MVP).
3. **User Story 2 (T010-T011)**: تطوير إضافي للفلترة المتقدمة.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. تنفيذ الهيكل ( العمود الجديد)
2. ترحيل البيانات القديمة
3. تفعيل البحث السريع
4. **تحقق**: هل يجد النظام الملف عند كتابة الرقم فقط؟
