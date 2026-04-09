// ============================================
// سكريبت اختبار شامل لزر إعدادات الطوارئ
// ============================================

console.log('🔍 بدء اختبار زر إعدادات الطوارئ...\n');

// 1. التحقق من وجود العنصر في DOM
console.log('📋 الخطوة 1: التحقق من وجود العنصر');
const emergencyBtn = document.getElementById('emergency-setup-btn');
if (emergencyBtn) {
    console.log('✅ تم العثور على زر الإعدادات بنجاح');
    console.log('   - ID:', emergencyBtn.id);
    console.log('   - Class:', emergencyBtn.className);
    console.log('   - Title:', emergencyBtn.title);
} else {
    console.error('❌ خطأ: لم يتم العثور على زر الإعدادات!');
}

// 2. التحقق من معالجات الأحداث
console.log('\n📋 الخطوة 2: التحقق من معالجات الأحداث');
if (emergencyBtn) {
    const listeners = getEventListeners(emergencyBtn);
    if (listeners && listeners.dblclick && listeners.dblclick.length > 0) {
        console.log('✅ معالج حدث النقر المزدوج مرفق بنجاح');
        console.log('   - عدد المعالجات:', listeners.dblclick.length);
    } else {
        console.warn('⚠️ تحذير: لم يتم العثور على معالج النقر المزدوج');
        console.log('   - قد يكون المعالج مرفقاً ولكن غير مرئي في getEventListeners');
    }
}

// 3. اختبار محاكاة النقر المزدوج
console.log('\n📋 الخطوة 3: محاكاة النقر المزدوج');
if (emergencyBtn) {
    console.log('💡 لاختبار الوظيفة يدوياً:');
    console.log('   1. انقر نقراً مزدوجاً على الترس في صفحة تسجيل الدخول');
    console.log('   2. أدخل كلمة المرور: 2027');
    console.log('   3. يجب أن تظهر رسالة نجاح وينتقل إلى صفحة الإعدادات');
}

// 4. التحقق من دالة showToast
console.log('\n📋 الخطوة 4: التحقق من دالة showToast');
if (typeof window.app !== 'undefined' && typeof window.app.showToast === 'function') {
    console.log('✅ دالة showToast متوفرة');
} else {
    console.warn('⚠️ تحذير: دالة showToast غير متوفرة (قد تكون غير محملة بعد)');
}

// 5. التحقق من دالة navigateTo
console.log('\n📋 الخطوة 5: التحقق من دالة navigateTo');
if (typeof window.app !== 'undefined' && typeof window.app.navigateTo === 'function') {
    console.log('✅ دالة navigateTo متوفرة');
} else {
    console.warn('⚠️ تحذير: دالة navigateTo غير متوفرة (قد تكون غير محملة بعد)');
}

// 6. اختبار وظيفة prompt
console.log('\n📋 الخطوة 6: التحقق من دالة prompt');
if (typeof window.prompt === 'function') {
    console.log('✅ دالة prompt متوفرة');
} else {
    console.error('❌ خطأ: دالة prompt غير متوفرة!');
}

// 7. ملخص النتائج
console.log('\n' + '='.repeat(50));
console.log('📊 ملخص نتائج الاختبار');
console.log('='.repeat(50));

let passedTests = 0;
let totalTests = 6;

if (emergencyBtn) passedTests++;
if (emergencyBtn && getEventListeners(emergencyBtn).dblclick) passedTests++;
if (typeof window.app !== 'undefined' && typeof window.app.showToast === 'function') passedTests++;
if (typeof window.app !== 'undefined' && typeof window.app.navigateTo === 'function') passedTests++;
if (typeof window.prompt === 'function') passedTests++;

console.log(`✅ الاختبارات الناجحة: ${passedTests}/${totalTests}`);
console.log(`📈 نسبة النجاح: ${((passedTests/totalTests)*100).toFixed(1)}%`);

if (passedTests === totalTests) {
    console.log('\n🎉 جميع الاختبارات نجحت! الزر جاهز للاستخدام');
} else {
    console.log('\n⚠️ بعض الاختبارات فشلت. يرجى مراجعة الأخطاء أعلاه');
}

console.log('\n💡 نصيحة: افتح صفحة تسجيل الدخول وانقر نقراً مزدوجاً على الترس للاختبار الفعلي');
console.log('='.repeat(50) + '\n');

// دالة مساعدة للحصول على معالجات الأحداث (قد لا تعمل في جميع المتصفحات)
function getEventListeners(element) {
    if (typeof window.getEventListeners === 'function') {
        return window.getEventListeners(element);
    }
    return {};
}
