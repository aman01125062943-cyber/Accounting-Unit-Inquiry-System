# دليل تكامل نظام المراسلة اللحظي (SignalR)

هذا الدليل يشرح كيفية تعديل إعدادات الخادم أو المتصفح مستقبلاً لإدارة نظام المراسلة اللحظي.

## 1. إعدادات الخادم (Backend)
يعتمد النظام على مكتبة **Microsoft.AspNetCore.SignalR**.

### إضافة Hub جديد
يتم تعريف Hubs في مجلد `Hubs/`. إذا أردت إضافة Hub جديد للإشعارات مثلاً:
```csharp
public class MyNewHub : Hub {
    // وظائف Hub هنا
}
```
ثم قم بتسجيله في `Program.cs`:
```csharp
app.MapHub<MyNewHub>("/myNewHub");
```

### إرسال رسائل من Endpoints
لإرسال رسالة من خارج الـ Hub (مثلاً من API Endpoint)، استخدم `IHubContext<ChatHub>`:
```csharp
app.MapPost("/my-api", async (IHubContext<ChatHub> hubContext) => {
    await hubContext.Clients.All.SendAsync("ReceiveMessage", myPayload);
});
```

## 2. إعدادات المتصفح (Frontend)
يستخدم النظام مكتبة `signalr.min.js` الموجودة في `wwwroot/lib/`.

### تعديل فترات إعادة الاتصال
في ملف `wwwroot/js/chat.js` ضمن وظيفة `initSignalR`:
```javascript
.withAutomaticReconnect({
    nextRetryDelayInMilliseconds: retryContext => {
        // يمكنك تعديل الفترات الزمنية هنا بالمللي ثانية
        return 5000; // إعادة المحاولة كل 5 ثوانٍ دوماً مثلاً
    }
})
```

### إضافة أحداث جديدة
لاستقبال حدث جديد من السيرفر:
```javascript
this.hubConnection.on("MyEventName", (data) => {
    // منطق معالجة الحدث هنا
});
```

## 3. التأثيرات البصرية والصوتية
- **الصوت**: يتم توليده برمجياً في `app.js` باستخدام `AudioContext`. لا يحتاج لملفات خارجية.
- **التظليل**: يتم التحكم به عبر كلاس CSS `.chat-message-new` في `chat.css`.

## 4. متطلبات التشغيل
- **خادم الويب**: يجب أن يدعم WebSockets (مفعل افتراضياً في Kestrel).
- **الجدار الناري (Firewall)**: يجب السماح للمنفذ 5001 (أو المنفذ المستخدم) بالمرور.
- **المتصفحات**: جميع المتصفحات التي تدعم WebSockets و ES6.
