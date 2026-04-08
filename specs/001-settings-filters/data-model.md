# Data Model: إعدادات الفلاتر المتقدمة

## Entity: Filter (Updated)
يمثل هذا الكيان الفلتر المخصص الذي يتم حفظه في قاعدة البيانات.

| Field | Type | Description |
|-------|------|-------------|
| Id | String (UUID) | المعرف الفريد للفلتر |
| Name | String | اسم الفلتر (مثلاً: "المرتبات") |
| Type | String | نوع الفلتر: `list` أو `range` |
| ValuesContent | String | القيم النصية (Comma-separated) لنوع `list` |
| MinValue | Number | الحد الأدنى لنوع `range` |
| MaxValue | Number | الحد الأقصى لنوع `range` |
| TargetPage | String | اسم الصفحة التي سيعمل فيها الفلتر (مثلاً: "المرتدات") |
| TargetColumn | String | اسم العمود الذي سيطبق عليه الفلتر (مثلاً: "كود الملف") |
| CreatedAt | DateTime | تاريخ إنشاء الفلتر |

## Database Schema Changes
```sql
-- إضافة الأعمدة الجديدة لجدول Filters
ALTER TABLE Filters ADD COLUMN TargetPage TEXT;
ALTER TABLE Filters ADD COLUMN TargetColumn TEXT;
```

# API Contracts

## Endpoints

### 1. GET /api/filters
- **Description**: استرجاع جميع الفلاتر المحفوظة.
- **Response**: List of `Filter` objects.

### 2. POST /api/filters
- **Description**: حفظ فلتر جديد مع تحديد الصفحة والعمود.
- **Body**:
```json
{
  "name": "المرتبات",
  "type": "range",
  "minValue": 1012500000,
  "maxValue": 1012609999,
  "targetPage": "المرتدات",
  "targetColumn": "كود الملف"
}
```

### 3. PUT /api/filters/{id}
- **Description**: تعديل فلتر موجود.
