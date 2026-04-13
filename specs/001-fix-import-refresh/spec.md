# Feature Specification: تحديث عرض البيانات بعد الاستيراد تلقائياً

**Feature Branch**: `001-fix-import-refresh`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "بعد نجاح استيراد ملف Excel وظهور Progress Bar بالكامل، البيانات لا تظهر في الصفحة إلا بعد عمل Refresh يدوي. عدم إعادة تحميل البيانات من قاعدة البيانات بعد عملية الحفظ."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - التحديث التلقائي للجدول بعد الاستيراد الناجح (Priority: P1)

بصفتي مستخدم للنظام، أريد أن تظهر البيانات المدرجة من ملف Excel في جدول عرض المرتدات أو المرتبات بمجرد اكتمال شريط التقدم (Progress Bar) دون الحاجة لإعادة تحميل كامل الصفحة، وذلك لضمان سلاسة وسرعة العمل.

**Why this priority**: تحديث البيانات فورياً يقلل التشتت ويسرّع سير العمل ويُشعر المستخدم باستقرار النظام وتجاوبه.

**Independent Test**: استيراد ملف (أي نوع)، الانتظار حتى اكتمال شريط تقدم الحفظ إلى 100%، ملاحظة ظهوره في الجدول مباشرة دون ضغط أي زر لتحديث الصفحة أو الجدول.

**Acceptance Scenarios**:

1. **Given** أن المستخدم استورد ملف "مرتدات"، **When** تكتمل عملية الحفظ بنجاح، **Then** يختفي الـ Progress Bar ويتم استدعاء الدالة `loadReturns` لعرض البيانات الجديدة تلقائياً في الجدول.
2. **Given** أن المستخدم استورد ملف "مرتبات (حوافز)"، **When** تكتمل عملية الحفظ بنجاح، **Then** يُحدَّث جدول المرتبات ببيانات حديثة مباشرة عن طريق `loadSalaryReturns` بدون اللجوء لبيانات Cache قديمة.

---

### Edge Cases

- ماذا يحدث لو فشل جلب البيانات من الخادم (LoadData) بعد نجاح الحفظ؟ (يجب تقديم رسالة توضح نجاح الحفظ مع وجود مشكلة في جلب وعرض البيانات، وإبقاء خيار التحديث اليدوي متاحاً).
- ماذا يحدث لو هناك فلاتر نشطة (شهر محدد، أو حالة تسوية) تمنع ظهور بعض أو جزء من البيانات المدرجة تواً؟ (يجب تصفير الفلاتر كما هو معمول أو التركيز على إظهار البيانات).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST hide the exact Progress Bar or saving overlay specifically only after the backend response successfully persists the data.
- **FR-002**: System MUST invoke specific load functions (e.g., `loadReturns()` or `loadSalaryReturns()` based on import type) right after clearing the UI of the import modals/overlays.
- **FR-003**: System MUST NOT rely on cached frontend data when fetching the immediate post-import records; it should hit the backend APIs to confirm data visibility.
- **FR-004**: System MUST NOT use `window.location.reload()` under any circumstance to ensure SPA-like high-performance rendering.
- **FR-005**: System MUST refresh the active HTML table grid dynamically, reflecting the new row count matching validation results. 

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successfully imported items appear automatically in the UI grids exactly within 3 seconds of the progress bar reaching 100%.
- **SC-002**: User navigation state remains in-app (SPA pattern stays intact—no full page reload network requests except the explicit API data fetch).
- **SC-003**: The table reflects zero UI freezing/blocking when redrawing rows after the import process completes.
