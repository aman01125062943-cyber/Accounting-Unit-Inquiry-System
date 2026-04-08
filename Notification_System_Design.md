# تصميم وتحليل نظام الإشعارات الفورية (Real-Time Notifications)

## 1. آلية المراقبة والمزامنة (Database Monitoring)
سيتم الاعتماد على **Database Triggers** (مُشغّلات قاعدة البيانات) في SQLite لمراقبة عمليات (INSERT, UPDATE, DELETE) لجميع الجداول المستهدفة، بحيث تقوم هذه المشغلات بتسجيل أي تغيير فور حدوثه في جدول تتبع مركزي دون الحاجة لتدخل أو صلاحيات إضافية من المستخدم.

## 2. هيكلة جدول التتبع (Change Tracking Table)
سيتم إنشاء جدول `ChangeLogs` لتسجيل الأحداث تلقائياً:
```sql
CREATE TABLE ChangeLogs (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    TableName NVARCHAR(100) NOT NULL,
    RecordId NVARCHAR(100) NOT NULL,
    ActionType NVARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    UserId NVARCHAR(100), -- من أجرى التعديل
    Timestamp TEXT DEFAULT (datetime('now', 'utc'))
);
```

## 3. الخدمة الخلفية (Background Service)
إنشاء `BackgroundService` في .NET 8 (الخلفية الحالية):
- **الآلية:** استعلام (Polling) من جدول `ChangeLogs` كل ثانيتين أو استخدام SqliteConnection مخصص.
- **التوزيع:** سيتم بث التغييرات المكتشفة كـ JSON خفيف عبر تقنية **SignalR / WebSockets** المتوفرة مسبقاً في النظام.
- **صيغة الحمولة (Payload):**
```json
{
  "Action": "Update",
  "Table": "Returns",
  "RecordId": "1050",
  "Timestamp": "2026-03-30T08:00:00Z",
  "User": "Mohammed"
}
```

## 4. مستمع العميل (Desktop Client Listener)
في جانب الواجهة (JavaScript ES6):
- إنشاء `SignalR Connection` يستمع لمعرف الحدث `ReceiveChangeNotification`.
- عند الاستقبال، سيتم عرض `Toast Notification` أسفل أو أعلى الشاشة يوضح (المستخدم + نوع التعديل).
- سيتم استدعاء دوال جلب البيانات (Fetch API) لتحديث الجدول المتأثر فقط في الخلفية دون عمل Refresh للصفحة لتجنب تشتيت المستخدم.

## 5. إعدادات الإشعارات (Toggle Settings)
إضافة إعدادات في واجهة المستخدم `Settings UI`:
- حفظ تفضيلات المستخدم الخاصة بالإشعارات في `localStorage` (مثال: `notificationsEnabled: true`).
- خيارات لتفعيل/تعطيل إشعارات مخصصة بناءً على الجدول المحتمل تغييره.

## 6. التخزين المؤقت المحلي (Local Cache)
- سيتم تخزين سجلات الإشعارات المستلمة في `IndexedDB` أو `localStorage` الخاصة بالمتصفح/واجهة العميل مع طابع زمني.
- سيتم محو الإشعارات التي تتجاوز أعمارها 24 ساعة برمجياً عند بدء التشغيل أو بشكل دوري (Garbage Collection).

## 7. الاختبارات التكاملية (Integration Tests)
إنشاء مشروع اختبارات (xUnit):
- **الاستجابة الزمنية:** التحقق من استلام الـ Event عبر موك (Mock) خلال أقل من 3 ثوانٍ.
- **التزامن (Concurrency):** محاكاة 50 مستخدم يقومون بتعديلات متزامنة والتحقق من أن الـ `ChangeLogs` لم يفقد أي سجل.
- **الانقطاع (Resiliency):** محاكاة فصل اتصال الـ SignalR وإعادة الاتصال للتأكد من المزامنة التلقائية.

## 8. توثيق المشروع والتركيب (README & Deployment)
- توفير ملف `README.md` يحتوي على أوامر التشغيل المباشرة `npm start` و `dotnet run`.
- توفير سكربت محمول `Installer.bat` يقوم بالآتي: تثبيت المتطلبات المسبقة، تكوين الجدار الناري المحلي، توليد قاعدة بيانات SQLite وتهيئة الجداول مباشرة بتشغيل ملف `schema.sql` في الاستدعاء الأول.

## 9. تقرير الأداء وحجم البيانات (Analytical Report)
- **حجم الإشعار:** حمولة الـ JSON لا تتجاوز 150 بايت للحدث الواحد.
- **تأثير قاعدة البيانات (SQLite):** المشغلات (Triggers) خفيفة وسريعة، وعملية الـ Polling كل ثانيتين تجلب البيانات بناءً على الـ Id الأخير، مما يشكل حملاً لا يذكر مقارنة باستعلامات النظام الاعتيادية.
- **التقنية الموصى بها:** استخدام **SignalR (WebSockets fallback to Long-Polling)** هو الخيار الأفضل بيئياً، حيث يبقي الاتصال مفتوحاً (Full-Duplex) ويمنع استهلاك موارد الشبكة المتكرر كما يحدث في الـ Short-Polling، وتخدم مكتبة SignalR في .NET هذا التوجه بشكل مثالي وبدون متطلبات سيرفر معقدة.
