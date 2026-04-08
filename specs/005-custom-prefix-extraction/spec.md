# Feature Specification: Custom Prefix Return Code Extraction (V2)

**Feature Branch**: `005-custom-prefix-extraction`  
**Created**: 2026-03-02  
**Status**: In Clarification  
**Input**: تحديث منطق الاستخراج ليعتمد على "كود الملف" بناءً على بادئات محددة (Army- و Army-c-) مع قواعد استخراج دقيقة لما بين الشرطتين.

## Clarifications
### Session 2026-03-02
- Q: [Pending] التعامل مع النصوص غير الرقمية بين الشرطتين؟
- Q: [Pending] مصير الاستخراج التلقائي (US2)؟
- Q: [Pending] هل الفواصل المدعومة هي الشرطة فقط؟

## User Scenarios & Testing

### User Story 1 - Extraction by Custom Rule (Priority: P1)

As a system user, I want the system to extract the numeric return code from the "File Code" column based on specific rules for prefixes like `Army-` and `Army-c-`, so that the "Return Code" column is populated correctly and automatically.

**Acceptance Scenarios**:

1. **Given** prefix `Army-` exists, **When** FileCode is `Army-8001012600626-02-2026`, **Then** Return Code should be `8001012600626` (Value between 1st and 2nd hyphen).
2. **Given** prefix `Army-c-` exists, **When** FileCode is `Army-c-463-7-02-2026`, **Then** Return Code should be `463` (Value between `Army-c-` and next hyphen).
3. **Given** no matching prefix is found, **When** processing any FileCode, **Then** Return Code should be EMPTY (No value entered).

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST use the "File Code" column as the primary source for extraction.
- **FR-002**: Extraction prefixes MUST be read from the "Extraction Prefixes" field in Settings.
- **FR-003**: For codes starting with `Army-`, the system MUST extract the content located between the first and second hyphen `-`. If this content contains any non-numeric characters, the Return Code MUST be empty.
- **FR-004**: For codes starting with `Army-c-`, the system MUST extract the first sequence immediately following `Army-c-` and before the next hyphen. If this sequence contains any non-numeric characters, the Return Code MUST be empty.
- **FR-005**: The system MUST verify that the extracted value is "Numeric Only". Any presence of letters or special symbols within the segment results in an empty Return Code.
- **FR-006**: If no specified prefix matches the start of the File Code, the Return Code column MUST remain empty (No automatic numeric fallback).
- **FR-007**: Extraction MUST happen automatically during data rendering and when saving records.

## Success Criteria

- **SC-001**: Accurate extraction for all `Army-` and `Army-c-` formats provided in the requirements.
- **SC-002**: No manual intervention required for populating the Return Code column.
- **SC-003**: Empty values for records that do not match the defined prefixes.
