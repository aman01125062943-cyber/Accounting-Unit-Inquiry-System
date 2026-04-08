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

## User Scenarios & Testing

### User Story 1 - Import Excel Data (P1)
- **Given** valid Excel file with required columns → **When** I click "Import Excel" → **Then** stats displayed.

### User Story 2 - Filter and Match Records (P2)
- **Given** imported data → **When** I click "عرض المطابقة" → **Then** hierarchical results shown.

### User Story 3 - Execute Settlement (P1)
- **Given** displayed matched records → **When** I click "تنفيذ التسوية" → **Then** DB updated.

## Requirements

### Functional Requirements

- **FR-001**: Import Excel with fixed columns: `كود الملف`, `الاسم`, `رقم الحساب`, `البنك`, `رقم الحساب بعد التعديل`, `البنك بعد التعديل`, `تاريخ المرتدات`, `تاريخ اعتماد المرتدات`, `تاريخ التعديل`, `تاريخ اعتماد التعديل`.
- **FR-002**: Display post-import statistics (عدد الملفات، عدد السجلات).
- **FR-003**: Filters: Status (الكل / تم التسوية / لم يتم التسوية), Match By (الاسم / الرقم القومي), Month.
- **FR-004**: Status calculated dynamically: تم التسوية = تاريخ اعتماد التعديل has value.
- **FR-005**: Display all records (matched + unmatched) with visual badge differentiation.
- **FR-006**: Show all DB matches per Excel row (no limit on multiple matches).
- **FR-007**: Update DB on "تنفيذ التسوية": update account, bank, and dates (اعتماد المرتدات، التعديل، اعتماد التعديل). For Salaries, also update (رقم تسوية السداد، تاريخ تسوية السداد).
- **FR-008**: Show post-settlement report: updated count, not-updated count, unmatched count.
