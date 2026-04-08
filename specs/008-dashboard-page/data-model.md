# Data Model: لوحة التحكم

## DashboardStats (كائن محسوب - لا يُخزن)

| الحقل | النوع | الوصف |
|---|---|---|
| `totalCount` | `number` | إجمالي عدد السجلات |
| `totalAmount` | `number` | إجمالي المبلغ الكلي |
| `rejectedCount` | `number` | عدد العمليات المرفوضة |
| `rejectedAmount` | `number` | مبلغ العمليات المرفوضة |
| `returnedCount` | `number` | عدد العمليات المرتدة |
| `returnedAmount` | `number` | مبلغ العمليات المرتدة |
| `settledCount` | `number` | عدد العمليات المسواة |
| `settledAmount` | `number` | مبلغ العمليات المسواة |
| `openCount` | `number` | عدد العمليات غير المسواة |
| `openAmount` | `number` | مبلغ العمليات غير المسواة |
| `settlementRate` | `number` | نسبة التسوية (%) |

## العلاقات

- يُحسب من `ReturnRecord[]` عبر `calculateDetailedStats()`
- `settlementRate` = `(settledCount / totalCount) * 100`
- لا يتطلب جداول أو APIs جديدة
