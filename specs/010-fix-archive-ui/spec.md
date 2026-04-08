# Feature Specification: Fix Archive UI Overlap

**Created**: 2026-03-16  
**Status**: Planning / Clarification  
**Problem**: The Archive page content (tabs and tables) overlaps with other pages due to broken HTML structure in `index.html`.

## Identified Technical Issues
- **Premature closing tag**: The `<section id="page-archive">` on line 562 is closed early on line 564.
- **Hanging content**: Content meant for the archive (lines 636-722) is loose in the main container.
- **Interleaved sections**: The `page-validation-results` section is inserted between the start of the archive page and its content.
- **Duplicate comments**: Redundant placeholder comments for the archive page.

## Proposed Structural Fix
- Move all archive-related content (tabs and tables) inside a single `<section id="page-archive">`.
- Ensure each page section (`page-returns`, `page-full-returns`, `page-archive`, etc.) is properly encapsulated and has the `hidden` class by default.

## Clarification Needed (speckit.clarify)
1. Should the Archive page include "Salaries Log" and "Full Returns Log" tabs? (Currently partially implemented).
2. Should "Validation Results" be a sub-module of Returns or a separate page? (Currently it spans between pages).
3. Do we need to keep the "Salaries Log" tab if it's currently a placeholder?
