# Data Model: حقل كود المرتد

## الكيانات (Entities)

### جدول `Returns` (تعديل)
- **الحقل الجديد**: `ReturnCode`
  - **النوع**: `TEXT` (أو `VARCHAR` حسب SQLite)
  - **الوصف**: الجزء الرقمي المستخرج من كود الملف.
  - **الفهرسة**: يجب إضافة INDEX على هذا الحقل لتسريع عمليات الـ Range Filtering.

## قواعد التحقق (Validation)
- الحقل يُشتق دائماً من الحقل الأساسي "كود الملف" داخل `RawData`.
- في حال تعديل السجل يدوياً (مستقبلاً)، يجب إعادة حساب هذا الحقل.

## خطة الترحيل (Migration)
```sql
-- إضافة العمود
ALTER TABLE Returns ADD COLUMN ReturnCode TEXT;

-- تحديث البيانات (سيتم تنفيذ منطق الاستخراج برمجياً عبر C# لكل سجل)
-- أو استعلام SQL مبدئي (تقريبي):
-- UPDATE Returns SET ReturnCode = json_extract(RawData, '$. "كود الملف"') ...
```
