# Tasks: إضافة عمود الحالة وجدولة التسوية

**Input**: Design documents from `/specs/007-add-settlement-status/`
**Prerequisites**: plan.md (required), spec.md (required)

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [P] Ensure CSS variables for green highlight are defined in `wwwroot/index.html`

## Phase 2: User Story 1 - عرض حالة التسوية في الجدول الرئيسي (Priority: P1) 🎯 MVP

**Goal**: إضافة عمود "الحالة" وتلوين الصفوف المسواة بصرياً بناءً على تاريخ اعتماد التعديل.

**Independent Test**: فتح صفحة المرتدات والتأكد من ظهور عمود "الحالة" بجانب "كود الفرع بعد التعديل"، والتأكد من تلوين الصفوف التي تحتوي على تاريخ اعتماد باللون الأخضر.

### Implementation for User Story 1

- [x] T002 [US1] إضافة تنسيق CSS للفئة `.settled-row` في `wwwroot/index.html` (تمت الإضافة في modern.css)
- [x] T003 [US1] تحديث مصفوفة `displayHeaders` في دالة `renderTable` بملف `wwwroot/js/app.js` لإضافة "الحالة" بجانب "كود الفرع بعد التعديل".
- [x] T004 [US1] تحديث منطق إنشاء الخلايا (Cells) في دالة `renderTable` بملف `wwwroot/js/app.js` لاحتساب قيمة "الحالة" (تم التسوية / لم يتم التسوية) بناءً على قيمة عمود "تاريخ اعتماد التعديل".
- [x] T005 [US1] تحديث كود إنشاء صف الجدول `<tr>` في دالة `renderTable` بملف `wwwroot/js/app.js` لإضافة كلاس `.settled-row` برمجياً إذا كانت الحالة "تم التسوية".
- [x] T006 [US2] تحديث منطق اكتشاف عمود التاريخ في `printStatement` بملف `wwwroot/js/app.js` ليعتمد على "تاريخ اعتماد التعديل".
- [x] T007 [US2] تحديث منطق احتساب الحالة في `printStatement` بملف `wwwroot/js/app.js` ليتطابق مع الجدول الرئيسي.
- [x] T008 [US2] تحديث ترويسة الجدول في تقرير كشف الحساب لتصبح "تاريخ اعتماد التعديل" بدلاً من "تاريخ الاعتماد".
- [x] T009 [US1] التحقق من ثبات العمود واستجابة التلوين أثناء استخدام الـ Infinite Scroll والبحث في `wwwroot/js/app.js`.

**Checkpoint**: ميزة عرض حالة التسوية والتمييز البصري تعمل بشكل كامل ومستقر.

## Dependencies & Execution Order

- **Setup (Phase 1)**: لا توجد تبعات - يمكن البدء فوراً.
- **User Story 1 (Phase 2)**: تعتمد على الأساسيات، وهي الميزة الوحيدة المطلوبة حالياً (MVP).

## Implementation Strategy

1. تنفيذ تنسيقات CSS أولاً.
2. تعديل منطق رندر الجدول لإضافة العمود والقيمة.
3. تفعيل التلوين التلقائي للصفوف.
4. التحقق اليدوي من مطابقة البيانات.
