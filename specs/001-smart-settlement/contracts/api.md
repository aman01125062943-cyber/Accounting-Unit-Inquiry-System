# API Contracts: Smart Settlement

## 1. Match Records
**Endpoint:** `POST /api/smart-settlement/match`
**Description:** Accepts a list of parsed Excel rows and returns a hierarchical matching list based on National IDs and Names.

### Request Body (JSON)
```json
{
  "records": [
    {
      "Name": "محمد أحمد",
      "NationalId": "29801011234567",
      "ModifiedAccount": "EG123...",
      "ModifiedBank": "QNBA",
      "BatchCode": "Army-...",
      "CurrentAccount": "...",
      "CurrentBank": "..."
    }
  ],
  "filters": {
    "month": "03-2026",
    "status": "الكل", // "الكل", "تم التسوية", "لم يتم التسوية"
    "matchBy": "الاسم" // "الاسم", "الرقم القومي"
  }
}
```

### Response Body (JSON)
```json
{
  "success": true,
  "data": [
    {
      "source": { ...ExcelRow... },
      "matches": [ { ...SettlementDBRecord... } ]
    }
  ]
}
```

## 2. Execute Settlement
**Endpoint:** `POST /api/smart-settlement/execute`
**Description:** Executes a bulk update on the matched database records.

### Request Body (JSON)
Pass the list of DB Record IDs that should be updated alongside their new Account/Bank details.
```json
{
  "updates": [
    {
      "dbRecordId": 1234,
      "newAccount": "EG123...",
      "newBank": "QNBA"
    }
  ]
}
```

### Response Body (JSON)
```json
{
  "success": true,
  "report": {
    "updatedCount": 150,
    "notUpdatedCount": 0,
    "unmatchedCount": 10
  }
}
```

## 3. Get Available Months
**Endpoint:** `GET /api/smart-settlement/months`
**Description:** Returns a distinct list of months extracted from the database `BatchCode` column to populate the month filter dropdown.

### Response Body (JSON)
```json
{
  "success": true,
  "data": ["03-2026", "02-2026", "01-2026"]
}
```
