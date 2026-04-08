# Implementation Plan: إضافة عمود الحالة وجدولة التسوية

**Branch**: `007-add-settlement-status` | **Date**: 2026-03-04 | **Spec**: [spec.md](file:///c:/Users/esth633/Desktop/hk/specs/007-add-settlement-status/spec.md)
**Input**: Feature specification from `/specs/007-add-settlement-status/spec.md`

## Summary

إضافة عمود "الحالة" لجدول المرتدات لتوضيح حالة التسوية (تم التسوية/لم يتم التسوية) بناءً على وجود تاريخ في عمود "تاريخ اعتماد التعديل"، مع تمييز الصفوف المسواة بصرياً باللون الأخضر. سيتم التنفيذ برمجياً في الواجهة الأمامية (app.js) لضمان السرعة وعدم الحاجة لتعديل قاعدة البيانات.

## Technical Context

**Language/Version**: C# (.NET Core), JavaScript (Vanilla ES6+)
**Primary Dependencies**: Microsoft.AspNetCore.App, Dapper, SQLite
**Storage**: SQLite (Returns table)
**Testing**: Manual Verification
**Target Platform**: Windows / Web Browser
**Project Type**: Web Service with Static Frontend
**Performance Goals**: Instant rendering during scroll (Infinite Scroll compatibility)
**Constraints**: Deep Dark Theme (Maintain readability with translucent green)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **استقرار السيرفر أولوية قصوى**: التنفيذ سيتم في الفرونت-إند (app.js)، مما يعني أن السيرفر لن يتأثر بالتغيير.
- **البحث يجب أن يكون سريعا (FTS5)**: الميزة لا تؤثر على آلية البحث الحالية.
- **الحفاظ على سلامة البيانات القديمة**: لن يتم تعديل أي سجل في قاعدة البيانات، فقط طريقة العرض.

## Project Structure

### Documentation (this feature)

```text
specs/007-add-settlement-status/
├── plan.md              # This file
├── spec.md              # Feature specification
└── tasks.md             # Generated tasks
```

### Source Code

```text
wwwroot/
├── js/
│   └── app.js           # Main logic for table rendering (renderTable)
├── index.html           # Table structure and CSS styles
```

**Structure Decision**: تعديل `app.js` لإضافة العمود ديناميكياً أثناء الرندر، وتعديل `index.html` لإضافة أنماط CSS الخاصة بالصفوف المسواة.
