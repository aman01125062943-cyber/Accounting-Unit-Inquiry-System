# Research: صفحة لوحة التحكم (Dashboard)

## Decision 1: مصدر البيانات الإحصائية

- **Decision**: استخدام الكاش المحلي `returnsCache` ودالة `calculateDetailedStats()` الموجودة مسبقاً.
- **Rationale**: الدالة تحسب كل القيم المطلوبة (totalCount, totalAmount, rejectedCount, rejectedAmount, returnedCount, returnedAmount, settledCount, settledAmount, openCount). لا حاجة لـ API جديد.
- **Alternatives**: إنشاء endpoint جديد في الباك إند — مرفوض لأن البيانات متوفرة محلياً وأسرع.

## Decision 2: نمط إنشاء الصفحة

- **Decision**: إضافة `<div id="page-dashboard" class="page-content hidden">` في `index.html` وتحديث `navigateTo()` في `app.js`.
- **Rationale**: يتبع نفس نمط الصفحات الحالية (returns, archive, settings) ويضمن التوافق.
- **Alternatives**: إنشاء ملف HTML منفصل — مرفوض لعدم توافقه مع بنية SPA الحالية.

## Decision 3: عرض مؤشر الأداء

- **Decision**: استخدام شريط تقدم دائري (Circular Progress) بـ CSS فقط + نسبة مئوية نصية.
- **Rationale**: أداء عالي، بدون مكتبات خارجية، متوافق مع الثيم الداكن.
- **Alternatives**: مكتبة Chart.js — مرفوض لثقل الحجم مقابل احتياج بسيط.
