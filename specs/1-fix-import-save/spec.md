# Spec: 1-fix-import-save — إصلاح تدفق الحفظ في صفحة المرتدات

## الوصف
إصلاح مشكلة عدم استجابة أزرار الحفظ ("حفظ كل السجلات"، "حفظ الصحيح فقط"، "حفظ كما هو") في صفحة نتائج فحص الملف بعد الضغط على "موافق" في نافذة التأكيد.

## السبب الجذري
1. **البيانات كانت تُفقد بعد confirm**: دوال الحفظ كانت تمرر `this.pendingAllData` مباشرةً بدلاً من التقاطها في متغير محلي قبل ظهور نافذة التأكيد. أي استدعاء لـ `hideValidationModal()` أثناء انتظار المستخدم يمسح `pendingAllData` و`pendingFile`.

2. **شريط التقدم غير مرئي**: كان `save-progress-container` داخل `#validation-modal` المخفي (`display:none`). الكود كان يحاول نقله DOM-إلى-DOM أمام `val-bottom-actions` وهو `position:fixed`، فيظهر خارج نطاق الرؤية.

3. **لا معالجة واضحة للأخطاء**: أي خطأ في مسار الحفظ كان يُخبئ رسالة الخطأ دون إعادة الأزرار.

## الإصلاح المُطبَّق

### `saveValidRecords()` / `saveAllRecords()` / `saveAllAsIs()`
- التقاط `data` و`file` في متغيرات محلية **قبل** استدعاء `confirm()`
- التحقق من `file` قبل `confirm()` وليس بعده
- تمرير `file` صراحةً لـ `_saveDataToServer(data, file)`

### `_saveDataToServer(data, file)`
- استقبال `file` كمعامل صريح بدلاً من قراءة `this.pendingFile`
- إنشاء `overlay` ثابت (`position:fixed; z-index:200000`) مباشرةً على `document.body` — بدلاً من DOM manipulation معقد
- شريط تقدم واضح من 0% → 100% داخل الـ overlay
- عند النجاح: إزالة overlay، إغلاق validation page/modal، تحديث الجدول
- عند الفشل: إزالة overlay، إعادة أزرار الحفظ، عرض رسالة خطأ واضحة

## ملاحظات
- لم يُعدَّل أي جزء آخر من المنظومة
- `hideValidationModal()` يبقى كما هو (يمسح pending data عند الإغلاق اليدوي)
- الـ overlay يُزال تلقائياً سواء نجح الحفظ أو فشل (finally block)
