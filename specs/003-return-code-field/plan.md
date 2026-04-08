# Implementation Plan: حقل كود المرتد والبحث المطور

**Branch**: `003-return-code-field` | **Date**: 2026-03-01 | **Spec**: [spec.md](file:///C:/Users/esth633/Desktop/hk/specs/003-return-code-field/spec.md)
**Input**: Feature specification from `/specs/003-return-code-field/spec.md`

## Summary

الهدف هو إضافة حقل `ReturnCode` في قاعدة البيانات وتعبئته آلياً بالجزء الرقمي الأوسط من كود الملف (بين الشرطتين). سيتم استخدام هذا الحقل كركيزة أساسية لعمليات البحث والفلترة لتحسين السرعة والدقة، مع ترحيل البيانات القديمة لضمان جاهزية السجلات التاريخية.

## Technical Context

**Language/Version**: C# (.NET 8.0)  
**Primary Dependencies**: Dapper, SQLite, Microsoft Entities  
**Storage**: SQLite (hk.db)  
**Testing**: Manual via API & Frontend UI  
**Target Platform**: Windows / Web  
**Project Type**: ASP.NET Core Web API / Vanilla JS Frontend  
**Performance Goals**: < 200ms searching 100k+ records  
**Constraints**: Keep FTS5 search stability, no data loss during schema change.  
**Scale/Scope**: ~100k existing records migration, 1 new DB field.

## Constitution Check

*GATE: Pass - All principles adhered to.*

- **استقرار السيرفر**: سيتم استخدام Migration آمن وتعامل حذر مع NULLs.
- **سرعة البحث**: استخدام الحقل الجديد المهرس (Indexed) سيقلل زمن البحث مقارنة بـ `json_extract`.
- **سلامة البيانات**: سيتم تعبئة الحقل الجديد دون المساس بـ `RawData` الأصلي.

## Project Structure

### Documentation (this feature)

```text
specs/003-return-code-field/
├── spec.md              # المواصفة الفنية
├── plan.md              # هذه الخطة
├── research.md          # أبحاث استخراج الكود
├── data-model.md        # هيكل العمود الجديد وعملية الترحيل
└── quickstart.md        # دليل التحقق السريع
```

### Source Code (repository root)

```text
HKServer/
├── Endpoints/
│   └── ReturnsEndpoints.cs   # تحديث منطق الفلترة والبحث
├── Services/
│   └── DatabaseService.cs    # تهجير قاعدة البيانات ومنطق الاستخراج
├── wwwroot/
│   └── js/
│       └── app.js           # تحديث عرض البيانات إذا لزم الأمر
```

**Structure Decision**: تم اختيار التعديل المباشر على بنية المشروع الحالية (Single Project) لضمان التوافق السريع.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Schema Change | لزيادة سرعة البحث الجذري | البحث داخل JSON بطيء جداً في العمليات الإحصائية الكبيرة |
