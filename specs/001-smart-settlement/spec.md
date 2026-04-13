# Feature Specification: Smart Settlement Page

**Feature Branch**: `001-smart-settlement`  
**Created**: 2026-03-06  
**Status**: Clarified & Implemented  
**Input**: User description: إنشاء صفحة السداد الذكي واستيراد ملفات Excel ومطابقتها وتحديث قاعدة البيانات.

## Clarifications (2026-03-14)

| # | Question | Answer |
|---|----------|--------|
| 1 | ما الأعمدة الثابتة المطلوبة؟ | كود الملف؛ الاسم؛ رقم الحساب؛ البنك؛ رقم الحساب بعد التعديل؛ البنك بعد التعديل؛ تاريخ المرتدات؛ تاريخ اعتماد المرتدات؛ تاريخ التعديل؛ تاريخ اعتماد التعديل |
| 2 | تفعيل المطابقة آلي أم يدوي؟ | يدوي عبر زر "عرض المطابقة" |
| 3 | هل تُعرض السجلات غير المطابقة؟ | نعم — كل السجلات تُعرض مع تمييز بصري (أخضر = مطابق، أحمر = غير مطابق) |
| 4 | تعدد المطابقات لنفس الاسم؟ | عرض كل المطابقات في جدول DB تحت سجل المصدر |
| 5 | الأعمدة التي يتم تحديثها بالإضافة للبنك والحساب؟ | الحوافز: تواريخ (اعتماد المرتد، التعديل، اعتماد التعديل). المرتبات: يُضاف (رقم وتاريخ تسوية السداد). |
| 6 | أثر تعديل "بيانات سجل الإكسيل" يدوياً؟ | التعديل اليدوي يُعتمد نهائياً ويُحفظ في قاعدة البيانات بدلاً من قيمة الإكسيل الأصلية. |

### Session 2026-04-13

- Q: هل الأعمدة الـ14 هي الوحيدة أم تُضاف للحالية؟ → A: الأعمدة المستوردة من الإكسيل هي 17 عمود: كود الملف، الاسم، رقم الحساب، البنك، قيمة العملية، الحالة، السبب، رقم الحساب بعد التعديل، البنك بعد التعديل، كود الفرع بعد التعديل، تاريخ الرفع، رقم تسوية التعلية، تاريخ المرتد / تاريخ التعلية، تاريخ التعديل، تاريخ اعتماد التعديل، رقم تسوية السداد، تاريخ اعتماد التعديل / تاريخ السداد. بالإضافة لعمودين محسوبين: الشهر (من كود الملف) وحالة التسوية (من رقم تسوية السداد).
- Q: الأعمدة المزدوجة التسمية (تاريخ المرتد / تاريخ التعلية) — قيمة واحدة أم قيمتين؟ → A: عمود واحد بقيمة واحدة، التسمية المزدوجة للتوضيح فقط.

## User Scenarios & Testing

### User Story 1 - Import Excel Data (P1)
- **Given** valid Excel file with required columns → **When** I click "Import Excel" → **Then** stats displayed.

### User Story 2 - Filter and Match Records (P2)
- **Given** imported data → **When** I click "عرض المطابقة" → **Then** hierarchical results shown.

### User Story 3 - Execute Settlement (P1)
- **Given** displayed matched records → **When** I click "تنفيذ التسوية" → **Then** DB updated.

## Requirements

### Functional Requirements

- **FR-001**: Import Excel with 17 fixed columns (in order): `كود الملف`, `الاسم`, `رقم الحساب`, `البنك`, `قيمة العملية`, `الحالة`, `السبب`, `رقم الحساب بعد التعديل`, `البنك بعد التعديل`, `كود الفرع بعد التعديل`, `تاريخ الرفع`, `رقم تسوية التعلية`, `تاريخ المرتد / تاريخ التعلية`, `تاريخ التعديل`, `تاريخ اعتماد التعديل`, `رقم تسوية السداد`, `تاريخ اعتماد التعديل / تاريخ السداد`. Plus 2 computed columns: `الشهر` (extracted from كود الملف), `حالة التسوية` (calculated from رقم تسوية السداد).
- **FR-002**: Display post-import statistics (عدد الملفات، عدد السجلات).
- **FR-003**: Filters: Status (الكل / تم التسوية / لم يتم التسوية), Match By (الاسم / الرقم القومي), Month.
- **FR-004**: Settlement status (`حالة التسوية`) calculated dynamically: `تم التسوية` = `رقم تسوية السداد` has value; `لم يتم التسوية` = `رقم تسوية السداد` is empty.
- **FR-005**: Display all records (matched + unmatched) with visual badge differentiation.
- **FR-006**: Show all DB matches per Excel row (no limit on multiple matches).
- **FR-007**: Update DB on "تنفيذ التسوية": update account, bank, and dates (اعتماد المرتدات، التعديل، اعتماد التعديل). For Salaries, also update (رقم تسوية السداد، تاريخ تسوية السداد).
- **FR-008**: Show post-settlement report: updated count, not-updated count, unmatched count.
