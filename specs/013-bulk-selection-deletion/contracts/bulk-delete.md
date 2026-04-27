# API Contract: Bulk Delete (Archiving)

## 1. الحذف المجمع بالمعرفات (Manual Selection)
**Endpoint**: `POST /returns/bulk-delete`
**Body**:
```json
{
  "ids": [123, 456, 789]
}
```
**Response**:
```json
{
  "success": true,
  "count": 3
}
```

## 2. الحذف المجمع بالفلاتر (Select All Filtered)
**Endpoint**: `POST /returns/bulk-delete-filtered`
**Parameters**: (نفس معايير الفلترة في GET /returns)
- `search`: string
- `filterId`: string
- `attachmentStatus`: string
- `min`: double
- `max`: double
- `uploadDateFrom`: string
- `uploadDateTo`: string
**Response**:
```json
{
  "success": true,
  "count": 5240,
  "operationId": "guid-for-tracking-progress"
}
```
