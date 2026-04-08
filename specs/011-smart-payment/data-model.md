# Data Model: Smart Payment (Settlement)

## Entities

### `ExcelRow` (Source Data)
- **BatchCode** (كود الملف) `string`
- **Name** (الاســــم) `string`
- **NationalId** (الرقم القومي) `string`
- **CurrentAccount** (رقم الحساب) `string`
- **CurrentBank** (البنك) `string`
- **ModifiedAccount** (رقم الحساب بعد التعديل) `string`
- **ModifiedBank** (البنك بعد التعديل) `string`
- **ReturnDate** (تاريخ المرتدات) `string`
- **ReturnApprovalDate** (تاريخ اعتماد المرتدات) `string`
- **ModDate** (تاريخ التعديل) `string`
- **ModApprovalDate** (تاريخ اعتماد التعديل) `string`
- **SettlementNo** (رقم تسوية السداد) `string`
- **SettlementDate** (تاريخ تسوية السداد) `string`

### `ExecuteUpdateItem` (State Transition to DB)
Contains the exact parsed Excel fields augmented with:
- **DbRecordId** `long`
- **Source** `string` ("incentive" or "salary")

## State Transitions
- **Pending/Partial Match**: Raw Excel parsed, displayed side-by-side with SQL rows. Modified states tracked locally (`_isModified_` flags). 
- **Settled**: On `executeSmartPayment`, rows applied to DB update their internal `RawData` (`json_set`). The `Status` dynamic field changes to "تم التسوية".
