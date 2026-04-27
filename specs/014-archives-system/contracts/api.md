# عقود واجهة البرمجة (API Contracts) - نظام الاضابير

## 1. الحصول على قائمة الدفعات (Batches)
**GET** `/api/adabir`

**الرد (Success - 200 OK):**
```json
[
  {
    "id": 1,
    "excelNames": "file1.xlsx, file2.xlsx",
    "recordCount": 150,
    "dateFrom": "2024-01-01",
    "dateTo": "2024-01-31",
    "sourceTable": "Returns",
    "reason": "سبب الحفظ المكتوب هنا...",
    "archivedAt": "2026-04-26T09:00:00"
  }
]
```

## 2. الحصول على تفاصيل دفعة محددة (مع البحث)
**GET** `/api/adabir/{batchId}/details?q=text`

**الرد (Success - 200 OK):**
```json
[
  {
    "id": 101,
    "originalId": 500,
    "rawData": { "Name": "Ahmed", "Amount": 1000, ... }
  }
]
```

## 3. أرشفة مجموعة سجلات بناءً على التاريخ
**POST** `/api/adabir/archive`

**طلب البيانات (Request Body):**
```json
{
  "dateFrom": "2024-01-01",
  "dateTo": "2024-01-31",
  "sourceTable": "Returns",
  "reason": "السبب (يجب أن يكون > 10 أحرف)"
}
```

## 4. الحصول على عدد السجلات قبل الأرشفة (Preview)
**GET** `/api/adabir/preview?dateFrom=...&dateTo=...&sourceTable=...`

**الرد:**
```json
{
  "count": 150,
  "excelNames": ["file1.xlsx", "file2.xlsx"]
}
```

## 5. استعادة دفعة كاملة
**POST** `/api/adabir/restore/{batchId}`

**الرد (Success - 200 OK):**
```json
{
  "success": true,
  "message": "تمت استعادة 150 سجل بنجاح"
}
```
