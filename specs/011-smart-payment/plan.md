# Implementation Plan: Smart Payment Fixes

**Branch**: `011-smart-payment` | **Date**: 2026-03-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-smart-payment/spec.md`

## Summary

This plan outlines the specific fixes for the "Smart Payment" feature to ensure incomplete fields (e.g. `رقم تسوية السداد`, `تاريخ تسوية السداد`) are parsed, edited manually in the UI, and correctly passed to the backend for Salary settlements. Additionally, it removes a case-sensitivity/fallback bug in `executeSmartPayment()` that caused manual edits to be "barely respected" and overridden by original strings. 

## Technical Context

**Language/Version**: C# (.NET 8) & Javascript (ES6+)
**Primary Dependencies**: Dapper, Microsoft.Data.Sqlite, XLSX.js
**Storage**: SQLite (`hk.db` & JSON inside `RawData` columns)
**Project Type**: Desktop-like Server Application
**Performance Goals**: Updates 1000 records smoothly

## Project Structure

### Documentation (this feature)

```text
specs/011-smart-payment/
├── plan.md              # This file
├── research.md          # Causes and rationale for bug fixes
├── data-model.md        # Extended entities with Settlement constraints
├── quickstart.md        # Testing instructions
└── tasks.md             # (To be generated next)
```

### Source Code

```text
wwwroot/
├── js/
│   └── app.js             # Contains parsing, mapping, and executing logic.

Endpoints/
└── SmartSettlementEndpoints.cs # Handles /execute and DB Updates.
```

**Structure Decision**: Monolithic backend API + Vanilla JS frontend (Standard files structure as currently exists).

## Implementation Steps

1. In `Endpoints/SmartSettlementEndpoints.cs`, update `ExcelRow` and `ExecuteUpdateItem` to add `SettlementNo` and `SettlementDate`.
2. In `app.js` `runSmartPaymentMatch()`, extract the new columns into the `record`. Update `MatchRequest` payload inside `handleSmartPaymentFile()`.
3. In `app.js` `renderSmartPaymentResults()`, dynamically append the two new input fields to the `source-field` grid. Ensure `updateSmartExcelValue()` attaches `_isModified_` properly.
4. In `app.js` `executeSmartPayment()`, refactor the property mapping to read strictly from `src.settlementNo` and ignore PascalCase fallbacks which broke empty string clears.

