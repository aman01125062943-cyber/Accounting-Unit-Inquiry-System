# Implementation Plan: صفحة لوحة التحكم (Dashboard)

**Branch**: `008-dashboard-page`  
**Spec**: [spec.md](file:///c:/Users/esth633/Desktop/hk/specs/008-dashboard-page/spec.md)

---

## Technical Context

| العنصر | القيمة |
|---|---|
| Stack | Vanilla JS + HTML + CSS (SPA) |
| Backend | ASP.NET Minimal APIs + SQLite |
| APIs جديدة مطلوبة | لا — نعتمد على `calculateDetailedStats()` والكاش المحلي |
| الملفات المتأثرة | `index.html`, `app.js` |

---

## Proposed Changes

### Component 1: واجهة المستخدم (HTML)

#### [MODIFY] [index.html](file:///c:/Users/esth633/Desktop/hk/wwwroot/index.html)

1. **القائمة الجانبية** (سطر ~656): إضافة عنصر قائمة "لوحة التحكم" أسفل "الحوافز" مباشرة.
2. **صفحة Dashboard HTML** (بعد `page-returns` وقبل `page-archive`): إضافة `<div id="page-dashboard" class="page-content hidden">` يحتوي على:
   - **4 بطاقات إحصائية**: إجمالي السجلات، إجمالي المبلغ، عدد المرفوض/المرتد، مبلغ المرفوض/المرتد
   - **قسم الأداء/الحوافز**: شريط تقدم دائري + نسبة التسوية + عدد المنجزة + مبلغ المسواة
   - **4 أزرار اختصار**: استيراد، كشف حساب، تصدير، العمليات غير المسوية
3. **CSS مخصص**: أنماط البطاقات، الشريط الدائري، أزرار الاختصار (داخل `<style>` أو `modern.css`)

---

### Component 2: منطق التطبيق (JavaScript)

#### [MODIFY] [app.js](file:///c:/Users/esth633/Desktop/hk/wwwroot/js/app.js)

1. **تحديث `navigateTo()`** (~سطر 680): إضافة `dashboard` إلى قاموس العناوين وتحميل البيانات عند الانتقال.
2. **إضافة دالة `loadDashboard()`**: تحسب الإحصائيات من الكاش باستخدام `calculateDetailedStats()` وتملأ عناصر DOM.
3. **إضافة دالة `updateDashboardCircle(rate)`**: ترسم شريط التقدم الدائري بناءً على نسبة التسوية.
4. **أزرار الاختصار**: ربطها بالدوال الموجودة (`showImportModal()`, تصدير, كشف حساب, فلتر غير مسوية).

---

## Execution Order

```
1. تعديل index.html — إضافة عنصر القائمة الجانبية
2. تعديل index.html — إضافة HTML للصفحة + CSS
3. تعديل app.js — تحديث navigateTo()
4. تعديل app.js — إضافة loadDashboard() + updateDashboardCircle()
5. اختبار شامل
```

---

## Verification Plan

### Automated Tests
- فتح التطبيق في المتصفح والتحقق من ظهور "لوحة التحكم" في القائمة الجانبية.
- النقر على "لوحة التحكم" والتحقق من ظهور الصفحة مع بيانات صحيحة.
- التحقق من عمل أزرار الاختصار (استيراد، كشف حساب، تصدير، غير مسوية).

### Manual Verification
- مقارنة الأرقام في لوحة التحكم مع أرقام صفحة الحوافز.
- التحقق من نسبة التسوية (يدوياً).
- فحص التصميم المتجاوب على أحجام شاشات مختلفة.
