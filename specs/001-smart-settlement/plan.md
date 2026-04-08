# Implementation Plan: Smart Settlement Page

**Branch**: `001-smart-settlement` | **Date**: 2026-03-06 | **Spec**: [specs/001-smart-settlement/spec.md](spec.md)
**Input**: Feature specification from `/specs/001-smart-settlement/spec.md`

## Summary

The feature provides a web page allowing users to upload an Excel file containing bank account modifications. The system will match these modifications against existing database records using Dapper and SQLite, present a hierarchical view of the matches on the frontend, and perform a bulk update to settle the records upon user confirmation. 

## Technical Context

**Language/Version**: C# 12 / .NET 8, HTML/JS/CSS (Tailwind via CDN)
**Primary Dependencies**:
- Backend: `Microsoft.Data.Sqlite`, `Dapper`
- Frontend: `tailwindcss` (CDN), `SheetJS` (xlsx via CDN)
**Storage**: SQLite (`hk.db`)
**Testing**: Manual testing via Browser/Swagger
**Target Platform**: Windows Desktop (Local Server & Local Browser)
**Project Type**: C# Minimal API Web Service
**Performance Goals**: Support parsing and displaying matches for up to 10k items within seconds.
**Constraints**: Avoid adding heavy .NET libraries for Excel parsing; use frontend SheetJS instead. Maintain data integrity with SQLite transactions during bulk updates.
**Scale/Scope**: ~1-3 Backend Endpoints, 1 HTML page with JS logic.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **استقرار السيرفر أولوية قصوى**: (Passes) Offloading Excel parsing to the client browser via SheetJS reduces memory and CPU load on the server.
- **البحث يجب أن يكون سريعا (FTS5)**: (Passes) Match records using batched `IN` clauses via Dapper for fast retrieval from SQLite.
- **الحفاظ على سلامة البيانات القديمة**: (Passes) Settlement updates will be wrapped in a database transaction (`BEGIN TRANSACTION`). Data validation happens before any write.

## Project Structure

### Documentation (this feature)

```text
specs/001-smart-settlement/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
hk/
├── Endpoints/
│   └── SmartSettlementEndpoints.cs   # NEW: Backend endpoints for matching & execution
├── wwwroot/
│   ├── smart-settlement.html         # NEW: The main page UI and logic
```

**Structure Decision**: A new endpoint file is placed in `Endpoints/` matching the existing Minimal API pattern (`MapReturnsEndpoints` etc). The new UI page is placed directly in `wwwroot/`.
