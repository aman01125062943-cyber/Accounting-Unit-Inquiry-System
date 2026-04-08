# hk Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-28

## Active Technologies

- .NET 8 (C#) & JavaScript (ES6+) + Dapper, Microsoft.Data.Sqlite, XLSX.js (011-smart-payment)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test; npm run lint

## Code Style

.NET 8 (C#) & JavaScript (ES6+): Follow standard conventions

## Recent Changes

- 001-error-check: Added error checking logic for returns.
- 001-settings-filters: Implemented dynamic filter management (List/Range) in Settings.
- 001-smart-settlement: Added Smart Settlement with month filters and automatic matching.
- 003-return-code-field: Integrated return code range filtering.
- 004-fix-archive-tab: UI fixes for the Archive tab.
- 005-custom-prefix-extraction: Added regex-based attachment prefix extraction.
- 006-new-account-statement: Enhanced account statement generation (PDF/Excel).
- 007-add-settlement-status: Added settlement status tracking (Matched/Unmatched/Settled).
- 008-dashboard-page: Created a comprehensive statistics dashboard.
- 009-returns-settlement: Implemented bulk settlement for returns.
- 010-fix-archive-ui: Improved Archive UI with better filters and layout.
- 011-smart-payment: Added Smart Payment matching logic for salary/incentive Excel files.
- 011-smart-payment: Implemented exact name match for Arabic beneficiaries.
- AutoSyncService: Integrated FullReturns and SalaryReturns into automated synchronization.
- RPD: Created comprehensive Requirements & Project Documentation (RPD.md).
