# hk Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-01

## Active Technologies
- C# (.NET Core/Standard), PowerShell 7+ + Microsoft.Data.Sqlite, ASP.NET Core (001-error-check)
- SQLite (`hk.db`) (001-error-check)
- JavaScript (ES6+), HTML5, CSS3 + Vanilla JS, IndexedDB (Cache), FontAwesome (Icons) (005-custom-prefix-extraction)
- IndexedDB (`hk_returns_cache`), SQL Server (Backend) (005-custom-prefix-extraction)
- [if applicable, e.g., PostgreSQL, CoreData, files or N/A] (001-smart-settlement)
- C# 12 / .NET 8, HTML/JS/CSS (Tailwind via CDN) (001-smart-settlement)

- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (003-return-code-field)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

cd src; pytest; ruff check .

## Code Style

[e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]: Follow standard conventions

## Recent Changes
- 001-smart-settlement: Added C# 12 / .NET 8, HTML/JS/CSS (Tailwind via CDN)
- 001-smart-settlement: Added [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]
- 005-custom-prefix-extraction: Added JavaScript (ES6+), HTML5, CSS3 + Vanilla JS, IndexedDB (Cache), FontAwesome (Icons)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
