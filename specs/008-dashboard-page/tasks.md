# Tasks: صفحة لوحة التحكم (Dashboard)

**Feature**: `008-dashboard-page`  
**Total Tasks**: 12  
**MVP Scope**: Phase 1 + Phase 2 + Phase 3 (US1)

---

## Phase 1: Setup (تهيئة)

- [x] T001 إضافة عنصر "لوحة التحكم" في القائمة الجانبية بملف `wwwroot/index.html` (بعد عنصر الحوافز مباشرة)
- [x] T002 إضافة حاوية الصفحة `<div id="page-dashboard" class="page-content hidden">` بملف `wwwroot/index.html`

---

## Phase 2: Foundational (أساسيات مطلوبة قبل قصص المستخدم)

- [x] T003 تحديث دالة `navigateTo()` لدعم صفحة `dashboard` في `wwwroot/js/app.js`
- [x] T004 إضافة دالة `loadDashboard()` في `wwwroot/js/app.js`

---

## Phase 3: User Story 1 — عرض الإحصائيات العامة (P1)

> **الهدف**: عرض 4 بطاقات إحصائية (إجمالي السجلات، إجمالي المبلغ، عدد المرفوض/المرتد، مبلغ المرفوض/المرتد)
> **اختبار مستقل**: فتح لوحة التحكم → التحقق من ظهور 4 بطاقات بقيم رقمية صحيحة تطابق بيانات النظام.

- [x] T005 [US1] تصميم HTML لـ 4 بطاقات إحصائية + CSS داخل `page-dashboard` بملف `wwwroot/index.html`
- [x] T006 [US1] تطوير دالة `loadDashboard()` لحساب الإحصائيات من الكاش وتعبئة البطاقات في `wwwroot/js/app.js`

---

## Phase 4: User Story 2 — مؤشرات الأداء / الحوافز (P1)

> **الهدف**: عرض قسم أداء يتضمن نسبة التسوية (%)، عدد المنجزة، وإجمالي المبالغ المسواة
> **اختبار مستقل**: فتح لوحة التحكم → التحقق من ظهور شريط تقدم دائري بنسبة صحيحة.

- [x] T007 [US2] تصميم HTML + CSS لقسم الأداء مع شريط تقدم دائري (Circular Progress) في `wwwroot/index.html`
- [x] T008 [US2] إضافة دالة `updateDashboardCircle(rate)` لرسم الشريط الدائري في `wwwroot/js/app.js`
- [x] T009 [US2] تحديث `loadDashboard()` لحساب نسبة التسوية وتعبئة قسم الأداء في `wwwroot/js/app.js`

---

## Phase 5: User Story 3 — الاختصارات السريعة (P2)

> **الهدف**: عرض 4 أزرار اختصار (استيراد، كشف حساب، تصدير، غير مسوية)
> **اختبار مستقل**: النقر على كل زر → التحقق من تنفيذ العملية المطلوبة.

- [x] T010 [P] [US3] تصميم HTML + CSS لقسم الاختصارات السريعة (4 أزرار) في `wwwroot/index.html`
- [x] T011 [US3] ربط أزرار الاختصار بالدوال الموجودة (showImportModal, exportToExcel, كشف حساب, فلتر غير مسوية) في `wwwroot/js/app.js`

---

## Phase 6: Polish & Cross-Cutting

- [ ] T012 اختبار شامل للصفحة: التجاوب (Responsive)، التناسق البصري، صحة الأرقام، عمل الأزرار

---

## Dependencies

```
T001 → T002 → T003 → T004 → T005/T006 (US1)
                                  ↓
                            T007/T008/T009 (US2)
                                  ↓
                            T010/T011 (US3)
                                  ↓
                              T012 (Polish)
```

> **ملاحظة**: T010 قابلة للتنفيذ بالتوازي مع Phase 4 (US2) لأنها تعمل على HTML مستقل.

---

## Implementation Strategy

1. **MVP أولاً**: Phase 1 + 2 + 3 (US1) = صفحة تعمل مع البطاقات الإحصائية
2. **التحسين**: Phase 4 (US2) = مؤشر الأداء
3. **الإكمال**: Phase 5 (US3) = الاختصارات السريعة
4. **التلميع**: Phase 6 = اختبار وتنظيف
