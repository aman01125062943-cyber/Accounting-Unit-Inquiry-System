# تقرير إصلاح مشاكل التسمية في ConfigEndpoints.cs

## المشكلة
كانت هناك 8 تحذيرات من نوع IDE1006 تتعلق بانتهاك قواعد التسمية في C#. المتغيرات في record types كانت تستخدم camelCase بدلاً من PascalCase المطلوب.

## التحذيرات المكتشفة

| السطر | المتغير | المشكلة |
|------|---------|---------|
| 249 | naps2Path | يجب أن يبدأ بحرف كبير |
| 250 | driver | يجب أن يبدأ بحرف كبير |
| 251 | device | يجب أن يبدأ بحرف كبير |
| 252 | source | يجب أن يبدأ بحرف كبير |
| 253 | format | يجب أن يبدأ بحرف كبير |
| 254 | silent | يجب أن يبدأ بحرف كبير |
| 255 | force | يجب أن يبدأ بحرف كبير |
| 258 | mode | يجب أن يبدأ بحرف كبير |

## الإصلاح المطبق

### 1. تحديث Record Types

**قبل الإصلاح:**
```csharp
public record ScannerSettingsRequest(
    string naps2Path,
    string driver,
    string device,
    string source,
    string format,
    bool silent,
    bool force
);

public record AttachmentLinkModeRequest(string mode);
```

**بعد الإصلاح:**
```csharp
public record ScannerSettingsRequest(
    string Naps2Path,
    string Driver,
    string Device,
    string Source,
    string Format,
    bool Silent,
    bool Force
);

public record AttachmentLinkModeRequest(string Mode);
```

### 2. تحديث الاستخدامات

تم تحديث جميع الأماكن التي تستخدم هذه المتغيرات:

**في MapPost("/config/scanner-settings"):**
```csharp
// قبل
config.Naps2Path = req.naps2Path;
config.ScannerDriver = req.driver;
config.ScannerDevice = req.device;
config.ScannerSource = req.source;
config.ScannerFormat = req.format;
config.ScannerSilent = req.silent;
config.ScannerForce = req.force;

// بعد
config.Naps2Path = req.Naps2Path;
config.ScannerDriver = req.Driver;
config.ScannerDevice = req.Device;
config.ScannerSource = req.Source;
config.ScannerFormat = req.Format;
config.ScannerSilent = req.Silent;
config.ScannerForce = req.Force;
```

**في MapPost("/config/attachment-link-mode"):**
```csharp
// قبل
if (string.IsNullOrWhiteSpace(req?.mode)) return Results.BadRequest();
config.AttachmentLinkMode = req.mode;

// بعد
if (string.IsNullOrWhiteSpace(req?.Mode)) return Results.BadRequest();
config.AttachmentLinkMode = req.Mode;
```

## معايير التسمية في C#

### PascalCase (مطلوب لـ)
- أسماء الفئات (Classes)
- أسماء الواجهات (Interfaces)
- أسماء الخصائص (Properties)
- أسماء الدوال (Methods)
- **معاملات Record Types** ✅

### camelCase (مطلوب لـ)
- المتغيرات المحلية
- معاملات الدوال العادية
- الحقول الخاصة (private fields)

## التحقق من الجودة

✅ **لا توجد أخطاء في البناء**: الكود يبنى بنجاح  
✅ **التوافق مع معايير C#**: جميع التسميات تتبع PascalCase  
✅ **عدم كسر الوظائف**: تم تحديث جميع الاستخدامات  
✅ **التوافق مع API**: الـ JSON serialization يعمل بشكل صحيح  

## ملاحظات

### JSON Serialization
عند استخدام System.Text.Json (الافتراضي في .NET)، سيتم تحويل الأسماء تلقائياً:
- `Naps2Path` → `naps2Path` في JSON
- `Driver` → `driver` في JSON
- وهكذا...

هذا يعني أن الـ API لن يتأثر والعملاء (Frontend) لن يحتاجوا لتغيير شيء.

### إذا كنت تريد الحفاظ على الأسماء كما هي في JSON
يمكنك استخدام:
```csharp
[JsonPropertyName("naps2Path")]
public string Naps2Path { get; init; }
```

لكن هذا غير ضروري في حالتنا لأن التحويل التلقائي يعمل بشكل صحيح.

## الملفات المعدلة

- ✅ `Endpoints/ConfigEndpoints.cs` (السطور 249-258)

## الحالة

✅ **مكتمل** - جميع التحذيرات تم إصلاحها بنجاح

---
**تاريخ الإصلاح**: 2025-01-XX  
**المطور**: Amazon Q Developer  
**نوع الإصلاح**: Code Quality / Naming Conventions
