# Implementation Plan: Custom Prefix Return Code Extraction

**Branch**: `005-custom-prefix-extraction` | **Date**: 2026-03-02 | **Spec**: [spec.md](file:///C:/Users/esth633/Desktop/hk/specs/005-custom-prefix-extraction/spec.md)
**Input**: Feature specification from `/specs/005-custom-prefix-extraction/spec.md`

## Summary

The goal is to refine the `extractReturnCode` function in `app.js` to support user-defined prefixes. The system will extract the numerical or alphanumeric part immediately following a matched prefix, excluding separators like hyphens. A fallback mechanism will ensure that standard numeric codes are still captured if no prefix matches.

## Technical Context

**Language/Version**: JavaScript (ES6+), HTML5, CSS3  
**Primary Dependencies**: Vanilla JS, IndexedDB (Cache), FontAwesome (Icons)  
**Storage**: IndexedDB (`hk_returns_cache`), SQL Server (Backend)  
**Testing**: Manual UI verification + existing `test_extract.js`  
**Target Platform**: Web Browser (Desktop focus)
**Project Type**: Web Application (ASP.NET Core Backend)  
**Performance Goals**: Table processing < 500ms for 18k records  
**Constraints**: Zero impact on original database data; focus on view-layer extraction.  
**Scale/Scope**: ~18,000 records, highly customizable prefix list.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Stability**: PASS. Logic is local to the frontend. No direct DB writes.
- **Search Speed**: PASS. Extraction happens in-memory during table rendering.
- **Data Integrity**: PASS. Original `FileCode` is never modified.

## Project Structure

### Documentation (this feature)

```text
specs/005-custom-prefix-extraction/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Implementation logic research
├── data-model.md        # Extraction logic flow
├── quickstart.md        # How to use the new extraction
└── tasks.md             # Implementation tasks
```

### Source Code

```text
wwwroot/
├── js/
│   └── app.js           # Core extraction logic (extractReturnCode)
├── css/
│   └── modern.css       # UI styling for settings
└── index.html           # Settings interface for prefixes
```

**Structure Decision**: Focus on `wwwroot/js/app.js` for logic and `wwwroot/index.html` for UI.

## Complexity Tracking

*No violations detected.*
