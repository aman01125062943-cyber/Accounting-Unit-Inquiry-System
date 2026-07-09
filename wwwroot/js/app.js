
// Debug Global Error Handler
window.onerror = function (msg, url, lineNo, columnNo, error) {
    const string = msg.toLowerCase();
    const substring = "script error";
    if (string.indexOf(substring) > -1) {
        alert('Script Error: See Browser Console for Detail');
    } else {
        const message = [
            'Message: ' + msg,
            'URL: ' + url,
            'Line: ' + lineNo,
            'Column: ' + columnNo,
            'Error object: ' + JSON.stringify(error)
        ].join(' - ');

        console.error(message);
        // Only show alert if it's related to our app logic to avoid spam
        if (url.includes('app.js') || url.includes('database.js')) {
            alert('System Error: ' + msg + '\nLine: ' + lineNo);
        }
    }
    return false;
};



console.log('App JS Loaded Successfully version 9.27 - Performance Optimized');

/**
 * نظام إدارة المرتدات - التطبيق الرئيسي
 */

// ========================================
// Global Loading / Progress System
// ========================================
(function initGlobalLoadingSystem() {
    const TEXT = {
        loading: 'جاري تحميل البيانات...',
        database: 'جاري جلب البيانات من قاعدة البيانات...',
        processing: 'جاري المعالجة...',
        slow: 'قد يستغرق التحميل قليلا حسب حجم البيانات'
    };

    const state = {
        active: 0,
        progress: 0,
        progressTimer: null,
        slowTimer: null,
        trackedFetchInstalled: false,
        originalFetch: window.fetch ? window.fetch.bind(window) : null
    };

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));

    const ensureGlobalUi = () => {
        let bar = document.getElementById('global-progress-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'global-progress-bar';
            document.body.appendChild(bar);
        }
        bar.classList.add('global-loading-bar');

        let status = document.getElementById('global-loading-status');
        if (!status) {
            status = document.createElement('div');
            status.id = 'global-loading-status';
            status.className = 'global-loading-status';
            status.setAttribute('role', 'status');
            status.setAttribute('aria-live', 'polite');
            status.innerHTML = `
                <span class="loading-spinner" aria-hidden="true"></span>
                <span class="global-loading-message">${TEXT.loading}</span>
                <span class="global-loading-slow hidden">${TEXT.slow}</span>
            `;
            document.body.appendChild(status);
        }

        return { bar, status };
    };

    const setGlobalProgress = (value) => {
        const { bar } = ensureGlobalUi();
        state.progress = Math.max(0, Math.min(100, value));
        bar.style.width = `${state.progress}%`;
    };

    window.showGlobalLoading = function showGlobalLoading(message = TEXT.loading) {
        const { bar, status } = ensureGlobalUi();
        state.active += 1;
        status.querySelector('.global-loading-message').textContent = message;
        status.querySelector('.global-loading-slow')?.classList.add('hidden');
        // status.classList.add('show'); // Disabled
        bar.classList.add('show');
        bar.style.opacity = '1';

        if (!state.progressTimer) {
            setGlobalProgress(Math.max(state.progress, 18));
            state.progressTimer = setInterval(() => {
                const next = state.progress + Math.max(1, (92 - state.progress) * 0.08);
                setGlobalProgress(next);
            }, 450);
        }

        clearTimeout(state.slowTimer);
        state.slowTimer = setTimeout(() => {
            if (state.active > 0) status.querySelector('.global-loading-slow')?.classList.remove('hidden');
        }, 3000);
    };

    window.hideGlobalLoading = function hideGlobalLoading() {
        state.active = Math.max(0, state.active - 1);
        if (state.active > 0) return;

        const { bar, status } = ensureGlobalUi();
        clearInterval(state.progressTimer);
        clearTimeout(state.slowTimer);
        state.progressTimer = null;
        setGlobalProgress(100);

        setTimeout(() => {
            if (state.active > 0) return;
            bar.classList.remove('show');
            bar.style.opacity = '0';
            // status.classList.remove('show'); // Disabled
            status.querySelector('.global-loading-slow')?.classList.add('hidden');
            setGlobalProgress(0);
        }, 260);
    };

    const getTarget = (id) => typeof id === 'string' ? document.getElementById(id) : id;

    window.showSectionLoading = function showSectionLoading(sectionId, message = TEXT.database) {
        // Disabled to prevent screen flickering
    };

    window.hideSectionLoading = function hideSectionLoading(sectionId) {
        // Disabled
    };

    window.showTableLoading = function showTableLoading(tableId, message = TEXT.database) {
        // Disabled to prevent screen flickering
    };

    window.hideTableLoading = function hideTableLoading(tableId) {
        // Disabled
    };

    window.showErrorState = function showErrorState(sectionId, message, retryCallback) {
        const section = getTarget(sectionId);
        if (!section) return;
        window.hideSectionLoading(section);
        section.querySelectorAll(':scope > .section-error-state').forEach(el => el.remove());

        const error = document.createElement('div');
        error.className = 'section-error-state';
        error.innerHTML = `
            <div class="section-error-icon"><i class="fas fa-triangle-exclamation"></i></div>
            <div class="section-error-text">${escapeHtml(message || 'تعذر جلب البيانات')}</div>
            <button type="button" class="section-error-retry">
                <i class="fas fa-rotate-right"></i>
                <span>إعادة المحاولة</span>
            </button>
        `;
        error.querySelector('.section-error-retry').addEventListener('click', () => {
            error.remove();
            if (typeof retryCallback === 'function') retryCallback();
        });
        section.appendChild(error);
    };

    const endpointConfig = (input) => {
        const url = String(input?.url || input || '');
        if (!/(\/api\/|\/chat\/|\/tasks\/|\/returns|\/salary-returns|\/full-returns|\/settings|\/config|\/users|\/audit\/|\/shares\/)/i.test(url)) return null;
        const method = String(input?.method || 'GET').toUpperCase();
        const processing = method !== 'GET';
        let sectionId = null;
        let tableId = null;
        if (/dashboard/i.test(url)) sectionId = 'page-dashboard';
        else if (/search-index|full-returns/i.test(url)) { sectionId = 'page-full-returns'; tableId = 'full-returns-table'; }
        else if (/salary-returns/i.test(url)) { sectionId = 'page-salary-returns'; tableId = 'salary-returns-table'; }
        else if (/returns/i.test(url)) { sectionId = 'page-returns'; tableId = 'returns-table'; }
        else if (/smart-settlement|smart-payment/i.test(url)) sectionId = 'page-smart-payment';
        else if (/chat/i.test(url)) sectionId = 'page-chat';
        else if (/tasks/i.test(url)) sectionId = 'page-tasks';
        else if (/adabir|archive/i.test(url)) sectionId = 'page-adabir';
        else if (/settings|config|users|audit/i.test(url)) sectionId = 'page-settings';

        return {
            sectionId,
            tableId,
            message: processing ? TEXT.processing : TEXT.database
        };
    };
    window.__getLoadingEndpointConfig = endpointConfig;

    window.withLoading = async function withLoading(operation, options = {}) {
        const message = options.message || TEXT.database;
        const sectionId = options.sectionId;
        const tableId = options.tableId;
        window.showGlobalLoading(message);
        if (sectionId) window.showSectionLoading(sectionId, message);
        if (tableId) window.showTableLoading(tableId, message);
        try {
            return await operation();
        } catch (error) {
            if (sectionId && error?.status !== 403) {
                window.showErrorState(sectionId, error?.message || 'تعذر جلب البيانات', options.retry);
            }
            throw error;
        } finally {
            requestAnimationFrame(() => {
                if (tableId) window.hideTableLoading(tableId);
                if (sectionId) window.hideSectionLoading(sectionId);
                window.hideGlobalLoading();
            });
        }
    };

    if (state.originalFetch && !state.trackedFetchInstalled) {
        window.fetch = async function trackedFetch(input, options = {}) {
            if (options && options.__skipGlobalLoading) {
                const { __skipGlobalLoading, ...fetchOptions } = options;
                return state.originalFetch(input, fetchOptions);
            }
            const cfg = endpointConfig(typeof input === 'string' ? { url: input, method: options.method } : input);
            if (!cfg) return state.originalFetch(input, options);
            return window.withLoading(async () => {
                const response = await state.originalFetch(input, options);
                if (!response.ok && cfg.sectionId && response.status !== 403) {
                    window.showErrorState(cfg.sectionId, `تعذر جلب البيانات من الخادم (${response.status})`, () => window.fetch(input, options));
                }
                return response;
            }, {
                ...cfg,
                retry: () => window.fetch(input, options)
            });
        };
        state.trackedFetchInstalled = true;
    }
})();

// ========================================
// Custom Dialog System — Floating Card (No Overlay)
// ========================================
class DialogSystem {
    constructor() {

        this.resolvePromise = null;
        this.el = null;
    }

    show(options = {}) {
        const {
            title = 'تنبيه',
            message = '',
            type = 'info',
            showCancel = false,
            isPrompt = false,
            inputType = 'text',
            defaultValue = ''
        } = options;

        this._remove();
        const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌', question: '❓' };

        const card = document.createElement('div');
        card.className = 'floating-dialog';
        card.innerHTML = `
            <div class="fd-header">
                <span class="fd-title">${title}</span>
                <button class="fd-close">✕</button>
            </div>
            <div class="fd-body">
                <div class="fd-icon">${icons[type] || icons.info}</div>
                <p class="fd-message">${message}</p>
                ${isPrompt ? `<input class="fd-input" type="${inputType}" value="${defaultValue}">` : ''}
            </div>
            <div class="fd-footer">
                ${showCancel || isPrompt ? '<button class="fd-btn fd-btn-cancel">إلغاء</button>' : ''}
                <button class="fd-btn fd-btn-ok">موافق</button>
            </div>
        `;

        document.body.appendChild(card);
        this.el = card;

        // Key handlers
        this.keyHandler = (e) => {
            if (e.key === 'Enter') {
                const input = card.querySelector('.fd-input');
                if (input && document.activeElement === input) {
                    // Handled by input listener or we can just trigger OK here
                    e.preventDefault();
                    card.querySelector('.fd-btn-ok').click();
                } else if (!input || document.activeElement !== input) {
                    e.preventDefault();
                    card.querySelector('.fd-btn-ok').click();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                const cancelBtn = card.querySelector('.fd-btn-cancel');
                if (cancelBtn) cancelBtn.click();
                else card.querySelector('.fd-close').click();
            }
        };
        window.addEventListener('keydown', this.keyHandler);

        // Events
        card.querySelector('.fd-close').onclick = () => this._resolve(null);
        card.querySelector('.fd-btn-ok').onclick = () => {
            if (isPrompt) {
                this._resolve(card.querySelector('.fd-input').value);
            } else {
                this._resolve(true);
            }
        };

        const cancelBtn = card.querySelector('.fd-btn-cancel');
        if (cancelBtn) cancelBtn.onclick = () => this._resolve(false);

        // Focus and Enter key support (localized to input)
        if (isPrompt) {
            const inputEl = card.querySelector('.fd-input');
            if (inputEl) {
                setTimeout(() => inputEl.focus(), 100);
            }
        }

        return new Promise(resolve => { this.resolvePromise = resolve; });
    }

    _resolve(value) {
        if (!this.el) return;
        window.removeEventListener('keydown', this.keyHandler);
        this.el.classList.add('fd-hiding');
        setTimeout(() => {
            this._remove();
            if (this.resolvePromise) {
                this.resolvePromise(value);
                this.resolvePromise = null;
            }
        }, 200);
    }

    _remove() {
        if (this.el && this.el.parentElement) {
            this.el.remove();
        }
        this.el = null;
    }
}

// Override Global Functions early
window.dialog = new DialogSystem();
window.alert = async (msg) => await window.dialog.show({ message: msg, type: 'info' });
window.confirm = async (msg) => await window.dialog.show({ message: msg, type: 'question', showCancel: true });
window.prompt = async (msg, def) => await window.dialog.show({ message: msg, type: 'question', isPrompt: true, defaultValue: def });

window.openAttachments = function (id, type) {
    console.log('REBUILT TRIGGER FOR:', id);
    const modal = document.getElementById('attachments-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.removeProperty('display'); // Clear any block inline styles just in case
        modal.style.display = 'flex'; // Explicitly set it inline but without !important so .hidden can override it
    } else {
        alert('Modal element missing!');
    }

    if (window.app) {
        window.app.currentAttachmentId = id;
        window.app.currentAttachmentType = type;
        window.app.loadAttachmentsList(id);
    }
};

class App {
    constructor() {
        this.selectedReturnIds = new Set();
        this.isAllReturnsSelected = false;
        this.filteredReturns = [];
        this.returnsFilters = {};
        this.returnsArchiveDateRange = { from: '', to: '' };

        this.selectedSalaryReturnIds = new Set();
        this.isAllSalaryReturnsSelected = false;
        this.filteredSalaryReturns = [];
        this.salaryReturnsFilters = {};
        this.salaryArchiveDateRange = { from: '', to: '' };



        this.currentPage = 'dashboard';
        this.data = [];
        this.headers = [];
        this.currentPage_num = 1;
        this.rowsPerPage = 50;
        this.searchQuery = '';
        this.amountColumn = null;
        this.dateColumn = null;
        this.filterValue = '';
        this.yearFilterValue = '';
        this.monthFilterValue = '';
        this.attachmentFilterValue = 'all'; // الفلتر الجديد للمرفقات

        this.filters = []; // Store filters locally

        // Full Returns Init
        this.fullReturnsData = [];
        this.fullReturnsCurrentPage = 1;
        this.fullReturnsRowsPerPage = 50;
        this.isUnifiedExtraction = false;
        this.unifiedSettlementStatus = 'not_settled';

        // Salary Returns Init
        this.salaryReturnsCache = null;
        this.isSalaryCaching = false;
        this.salaryReturnsData = [];
        this.salaryReturnsCurrentPage = 1;
        this.salaryReturnsRowsPerPage = 50;
        this.salarySearchQuery = '';
        this.selectedUnifiedStatementQuery = '';
        this.salaryAttachmentFilterValue = 'all';
        this.salarySettlementFilterValue = 'all';
        this.salaryReturnStatusFilterValue = 'all';
        this.salaryMonthFilterValue = 'all';
        this.salaryPaymentDateFilterValue = 'all';
        this.salaryUploadDateFrom = null;
        this.salaryUploadDateTo = null;
        this.isSalaryLoadingMore = false;
        this.salaryPagination = null;
        this.salaryGlobalStats = { count: 0, amount: 0 };


        // Database Instance
        this.db = new Database();

        // New Filters
        this.monthFilterValue = 'all';
        this.settlementFilterValue = 'all';

        // Search Cache (for slow network performance)
        this.returnsCache = null;
        this.isCaching = false;

        // SignalR Connectivity
        this.hubConnection = null;

        // Smart Payment State
        this.smartPaymentStatFilter = 'notfound';
        this.smartMatchBy = 'name';
        this.smartPaymentTypeFilter = 'salary'; // Default to Salaries tab
        this.developerModeUnlocked = sessionStorage.getItem('hk_developer_mode_unlocked') === '1';
        this.developerModeAttempts = 0;
        this.developerModeLockedUntil = 0;

    }

    /**
     * تحديث واجهة مؤشر حالة الاتصال اللحظي
     */
    updateSignalRUI(status) {
        const dot = document.getElementById('signalr-status-indicator');
        if (!dot) return;

        dot.className = 'status-dot'; // Reset
        let title = '';

        switch (status) {
            case 'online':
                dot.classList.add('status-online');
                title = 'متصل بالخدمة اللحظية (Live)';
                break;
            case 'reconnecting':
                dot.classList.add('status-reconnecting');
                title = 'جاري محاولة استعادة الاتصال...';
                break;
            case 'offline':
                dot.classList.add('status-offline');
                title = 'غير متصل (التحديثات معطلة)';
                break;
        }

        dot.title = title;
    }

    /**
     * تطبيع النصوص العربية للبحث (توحيد الهمزات والتاء المربوطة)
     */
    normalizeArabic(text) {
        if (text === null || text === undefined) return "";
        let str = String(text);

        // 1. Basic cleaning and lowercase
        str = str.trim().toLowerCase();

        // 2. Remove Special Characters that might break search
        str = str.replace(/[.,\/#!$%\^&*;:{}=\-_`~()]/g, " ");

        // 3. Arabic Normalization (Comprehensive)
        // IMPORTANT: We keep Alef Maksura (ى) as is, because it's a distinct character in names
        return str
            .replace(/[\u064B-\u065F]/g, "") // Remove Tashkeel (diacritics)
            .replace(/[أإآ]/g, "ا")          // Unified Alef
            .replace(/ة/g, "ه")             // Heh/Teh Marbuta
            // .replace(/ى/g, "ي")             // Alef Maksura/Yeh - DISABLED for better name matching
            .replace(/[ؤئ]/g, "ء")           // Unified Hamza variants
            .replace(/\s+/g, " ")           // Collapse multiple spaces
            .trim();
    }

    // ========================================
    // التهيئة
    // ========================================

    async init() {
        this.setupEventListeners();
        try {
            const statusFilterSelect = document.getElementById('smart-status-filter');
            if (statusFilterSelect) {
                statusFilterSelect.innerHTML = `
                    <option value="all">كل المطابقات</option>
                    <option value="unmatched">غير مطابقة</option>
                    <option value="incentive">تم التسوية</option>
                    <option value="notfound" selected>تحت التسوية</option>
                `;
            }
        } catch (e) { }
        try { await db.init(); } catch (e) { }
        await new Promise(r => setTimeout(r, 200));
        try { await this.loadFilters(); } catch (e) { }
        await new Promise(r => setTimeout(r, 200));
        try { await db.initDefaultUsers(); } catch (e) { }
        try {
            const hasSession = await auth.checkSession();
            const user = auth.getUser();
            if (hasSession && user) {
                this.currentUser = user;
                await this.refreshCurrentUserPermissions();
                this.showApp();
                await this.loadFromOfflineStorage().catch(e => console.warn('[CACHE] initial local load failed:', e));
                this.navigateTo(this.currentPage);
                this.updateStats();
                this.initSidebar();
                this.currentArchiveTab = 'lauf';
                if (window.chatModule) window.chatModule.init();
                this.loadNotifications();
                await new Promise(r => setTimeout(r, 300));
                this.startNotificationPolling();
                this.startPermissionsPolling();
                const tabLauf = document.getElementById('tab-btn-lauf');
                if (tabLauf) tabLauf.addEventListener('click', () => this.switchArchiveTab('lauf'));
                const tabFull = document.getElementById('tab-btn-full');
                if (tabFull) tabFull.addEventListener('click', () => this.switchArchiveTab('full'));
                await db.repairSchema();
                this.loadAttachmentLinkMode();
                this.loadExtractionMonths();
            } else {
                this.showLogin();
            }
        } catch (e) {
            this.showLogin();
        }

        // Initialize Real-time Updates Connectivity
        this.initSignalR();

        try {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                let progress = 0;
                const startTime = Date.now();
                const progressInterval = setInterval(() => {
                    const elapsed = Date.now() - startTime;
                    progress = Math.min(100, (elapsed / 10000) * 100);
                    const progressBar = splash.querySelector('.loader-progress');
                    const progressText = splash.querySelector('.loader-percentage');
                    if (progressBar) progressBar.style.width = progress + '%';
                    if (progressText) progressText.textContent = Math.floor(progress) + '%';
                    if (progress >= 100) {
                        clearInterval(progressInterval);
                        setTimeout(() => {
                            splash.style.opacity = '0';
                            setTimeout(() => splash.remove(), 800);
                        }, 500);
                    }
                }, 100);
            }
        } catch (e) {
            console.error('Splash screen error:', e);
        }
    }

    async clearSystemCache() {
        const confirmed = await window.confirm('هل أنت متأكد من مسح ذاكرة التخزين المؤقت؟ سيؤدي ذلك إلى إعادة تحميل كافة البيانات من السيرفر (قد يستغرق وقتاً إذا كانت البيانات ضخمة).');
        if (!confirmed) return;

        /*
        const idsToDelete = Array.from(checkedBoxes).map(cb => cb.value);
        this._removeRowsFromMemory('returns', idsToDelete);
        this.updateSelectAllReturns?.();
        this.showToast('تم تحديث البيانات على الشاشة', 'success');
        this._deleteRowsInBackground(
            'returns',
            idsToDelete,
            deleteId => db.deleteReturn(deleteId),
            {
                label: 'أرشفة السجلات',
                progressMessage: 'جاري أرشفة السجلات في الخلفية...',
                successMessage: 'تم تحديث البيانات',
                errorMessage: 'تعذر أرشفة بعض السجلات'
            }
        );
        return;
        */
        this.showLoading();
        try {
            // 1. Clear IndexedDB
            await db.clearLocalCache();

            // 2. Clear Memory
            this.returnsCache = null;
            this.salaryReturnsCache = null;
            this.isCaching = false;
            this.isSalaryCaching = false;

            // 3. Trigger Fresh Sync
            await this.populateReturnsCache();
            await this.populateSalaryReturnsCache();

            this.showToast('تم مسح وإعادة بناء الكاش بنجاح', 'success');
        } catch (e) {
            console.error('Failed to clear cache:', e);
            this.showToast('حدث خطأ أثناء مسح الكاش', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async populateLoginUsers() {
        const select = document.getElementById('login-username');
        if (!select) return;

        try {
            const users = await db.fetchApi('/users', {
                __skipLoadingWrapper: true,
                __suppressErrorLog: true
            });
            select.innerHTML = '<option value="" disabled selected>اختر المستخدم...</option>';

            users.forEach(user => {
                if (user.active) {
                    const option = document.createElement('option');
                    option.value = user.username;
                    option.textContent = user.fullname;
                    select.appendChild(option);
                }
            });
        } catch (error) {
            console.warn('تعذر تحميل المستخدمين قبل ضبط مسار قاعدة البيانات:', error);
            select.innerHTML = '<option value="" disabled selected>اضغط على الترس لضبط مسار قاعدة البيانات</option>';
            const loginError = document.getElementById('login-error');
            if (loginError) {
                loginError.textContent = 'تعذر فتح قاعدة البيانات. اضغط على الترس لضبط أو إضافة مسار قاعدة البيانات.';
                loginError.classList.add('show');
            }
        }
    }

    // ========================================
    // إظهار/إخفاء الصفحات
    // ========================================

    showLogin() {
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('app-page').classList.add('hidden');
        this.populateLoginUsers();
    }

    showApp() {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('app-page').classList.remove('hidden');
        this.updateUserInfo();
        this.applyPermissions();
    }

    updateUserInfo() {
        const user = auth.getUser();
        if (user) {
            this.currentUser = user;
            // Update both instances to be safe
            if (this.db) this.db.currentUser = user;
            if (window.db) window.db.currentUser = user;

            document.getElementById('user-avatar').textContent = user.fullname.charAt(0);
            document.getElementById('user-display-name').textContent = user.fullname;
            document.getElementById('user-role').textContent = this.getRoleName(user.role);
        }
    }

    getRoleName(role) {
        const roles = { admin: 'مدير', editor: 'محرر', viewer: 'مشاهد' };
        return roles[role] || role;
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const mainWrapper = document.querySelector('.main-wrapper');

        sidebar?.classList.toggle('collapsed');
        mainWrapper?.classList.toggle('full-width');

        // حفظ الحالة في localStorage
        const isCollapsed = sidebar?.classList.contains('collapsed');
        localStorage.setItem('sidebarState', isCollapsed ? 'collapsed' : 'expanded');
    }

    toggleAttachmentsDropdown() {
        const dropdown = document.getElementById('attachments-dropdown');
        dropdown.classList.toggle('show');

        // Close when clicking outside
        if (!this.dropdownListenerAdded) {
            window.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target) && !e.target.matches('.btn-primary') && !e.target.matches('.btn-primary *')) {
                    dropdown.classList.remove('show');
                }
            });
            this.dropdownListenerAdded = true;
        }
    }

    initSidebar() {
        // استعادة حالة الشريط من localStorage
        const sidebarState = localStorage.getItem('sidebarState');
        if (sidebarState === 'collapsed') {
            document.querySelector('.sidebar')?.classList.add('collapsed');
            document.querySelector('.main-wrapper')?.classList.add('full-width');
        }
    }



    // --- Theme Management ---
    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const btn = document.getElementById('mode-toggle');
        if (btn) {
            btn.textContent = theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي';
        }
    }
    // ------------------------

    applyPermissions() {
        const pageMap = {
            dashboard: 'page.dashboard',
            returns: 'page.returns',
            'salary-returns': 'page.salary-returns',
            'full-returns': 'page.full-returns',
            'smart-payment': 'page.smart-payment',
            chat: 'page.chat',
            tasks: 'page.tasks',
            archive: 'page.archive',
            adabir: 'page.adabir',
            settings: 'page.settings'
        };

        Object.entries(pageMap).forEach(([page, permission]) => {
            const allowed = auth.hasPermission(permission);
            document.querySelectorAll(`.nav-item[data-page="${page}"]`).forEach(el => el.classList.toggle('hidden', !allowed));
        });

        const toggle = (selector, allowed) => document.querySelectorAll(selector).forEach(el => el.classList.toggle('hidden', !allowed));
        const canDelete = this.canDeleteReturns();
        const canDeleteAll = this.canDeleteAllReturns();
        toggle('#btn-import-returns, #empty-import-btn, [onclick*="showImportModal"], [onclick*="showSalaryImportModal"], [onclick*="showFullReturnsImportModal"]', auth.canDo('import'));
        toggle('#export-excel-btn, #export-csv-btn, [onclick*="export"], [onclick*="downloadTemplate"], [onclick*="downloadSalaryTemplate"]', auth.canDo('export'));
        toggle('.btn-delete-pro, [onclick*="delete"], [onclick*="Delete"], [onclick*="confirmDelete"]', canDelete);
        toggle('[onclick="app.confirmDeleteAll()"], [onclick="window.app.confirmDeleteAll()"], [onclick="app.confirmDeleteAllSalary()"], [onclick="window.app.confirmDeleteAllSalary()"]', canDeleteAll);
        toggle('[onclick*="showAutoSyncModal"], [onclick*="showSalaryAutoSyncModal"], [onclick*="sync"]', auth.canDo('sync'));
        toggle('[onclick*="toggleAdabirInlineFilter"], [onclick*="archive"], [onclick*="Archive"]', auth.canDo('archive'));
        toggle('[onclick*="settle"], [onclick*="Settlement"], [onclick*="smart"]', auth.canDo('smart-payment'));
    }

    canDeleteReturns() {
        return !!(
            auth?.canDo?.('delete') ||
            auth?.hasPermission?.('delete') ||
            auth?.hasPermission?.('delete_returns') ||
            auth?.hasPermission?.('returns_delete')
        );
    }

    canDeleteAllReturns() {
        return this.canDeleteReturns() && !!(
            auth?.isAdmin?.() ||
            auth?.hasPermission?.('page.settings') ||
            auth?.hasPermission?.('dangerous.admin') ||
            auth?.hasPermission?.('admin.operations')
        );
    }

    async isDangerousDeleteAllEnabled() {
        try {
            const status = await db.getSecurityStatus?.();
            return !!status?.enableDangerousAdminOperations;
        } catch {
            return false;
        }
    }

    showDeleteForbidden(error) {
        const message = error?.data?.message || error?.message || 'ليس لديك صلاحية حذف هذه البيانات';
        this.showToast(message.includes('العملية الإدارية الخطيرة') ? 'حذف كل السجلات غير مفعل من الإعدادات' : message, 'error');
    }

    async refreshCurrentUserPermissions() {
        const user = auth.getUser();
        if (!user?.id) return;
        try {
            const result = await db.fetchApi(`/permissions/${user.id}`);
            user.permissions = Array.isArray(result.permissions) ? result.permissions : [];
            auth.currentUser = user;
            localStorage.setItem(auth.sessionKey, JSON.stringify(user));
            this.currentUser = user;
        } catch (e) {
            console.warn('Failed to refresh permissions:', e);
        }
    }

    markSearchFilterIndexStale(endpoint = '') {
        const relevant = /returns|salary-returns|full-returns|smart-settlement|adabir|archive|attachment/i.test(endpoint || '');
        if (!relevant) return;
        this.searchFilterIndexStale = true;
        clearTimeout(this._searchIndexRefreshTimer);
        this._searchIndexRefreshTimer = setTimeout(() => {
            this.refreshSearchFilterIndex(true).catch(e => console.warn('[SearchIndex] refresh failed:', e));
        }, 500);
    }

    async refreshSearchFilterIndex(force = false) {
        if (this._searchIndexLoading && !force) return this.searchFilterIndex;
        this._searchIndexLoading = true;
        this.updateSearchIndexStatusUI('جاري تحديث الفهارس');
        try {
            let status = await db.fetchApi('/api/search-index/status');
            const isStale = Number(status?.isStale ?? status?.IsStale ?? 0) === 1;
            const indexedCount = Number(status?.indexedCount ?? status?.IndexedCount ?? 0);
            if (isStale || indexedCount === 0) {
                await db.fetchApi('/api/search-index/rebuild', { method: 'POST' });
                status = await db.fetchApi('/api/search-index/status');
            }
            const [returnsIndex, salaryIndex, latestStatus] = await Promise.all([
                db.fetchApi('/api/search-index/filters?sourceType=returns'),
                db.fetchApi('/api/search-index/filters?sourceType=salary'),
                db.fetchApi('/api/search-index/status')
            ]);
            this.searchFilterIndex = { returns: returnsIndex, salary: salaryIndex, status: latestStatus };
            this.searchFilterIndexStale = false;
            this.applySearchFilterIndexToCurrentPage();
            this.updateSearchIndexStatusUI(null, latestStatus);
            return this.searchFilterIndex;
        } finally {
            this._searchIndexLoading = false;
        }
    }

    async rebuildSearchFilterIndex(button = null) {
        if (button) button.disabled = true;
        this.updateSearchIndexStatusUI('جاري تحديث الفهارس');
        try {
            const result = await db.fetchApi('/api/search-index/rebuild', { method: 'POST', triggerBtn: button });
            await this.refreshSearchFilterIndex(true);
            this.showToast(`تم تحديث فهارس البحث والفلاتر (${result.indexedCount || 0} سجل)`, 'success');
        } catch (e) {
            console.error('[SearchIndex] rebuild failed:', e);
            this.showToast('تعذر تحديث فهارس البحث والفلاتر', 'error');
        } finally {
            if (button) button.disabled = false;
        }
    }

    updateSearchIndexStatusUI(message = null, status = null) {
        const el = document.getElementById('search-index-status');
        if (!el) return;
        if (message) {
            el.textContent = message;
            return;
        }
        const state = status || this.searchFilterIndex?.status || {};
        const count = state.indexedCount ?? state.IndexedCount ?? 0;
        const last = state.lastRebuiltAt || state.LastRebuiltAt || '-';
        const stale = Number(state.isStale ?? state.IsStale ?? 0) === 1 ? ' | يحتاج تحديث' : '';
        el.textContent = `آخر تحديث: ${last || '-'} | عدد السجلات المفهرسة: ${Number(count).toLocaleString('ar-EG')}${stale}`;
    }

    applySearchFilterIndexToCurrentPage() {
        if (this.currentPage === 'returns') this._populateReturnFilterOptions();
        if (this.currentPage === 'salary-returns') this._populateSalaryReturnFilterOptions();
        if (this.currentPage === 'smart-payment') this.populateSmartFiltersFromIndex?.();
    }

    populateSmartFiltersFromIndex() {
        const monthSelect = document.getElementById('smart-month-filter');
        if (monthSelect) {
            const selected = monthSelect.value || 'all';
            const months = new Set([
                ...(this.searchFilterIndex?.returns?.filters?.months || []),
                ...(this.searchFilterIndex?.salary?.filters?.months || [])
            ].filter(Boolean));
            monthSelect.innerHTML = '<option value="all">كل الأشهر</option>' + Array.from(months).sort((a, b) => String(b).localeCompare(String(a))).map(m => `<option value="${m}">${m}</option>`).join('');
            monthSelect.value = Array.from(monthSelect.options).some(o => o.value === selected) ? selected : 'all';
        }
    }

    // ========================================
    // معالجة الأحداث
    // ========================================

    setupEventListeners() {
        // زر إعدادات الاتصال (الترس) في شاشة تسجيل الدخول
        const emergencyBtn = document.getElementById('emergency-setup-btn');
        if (emergencyBtn) {
            emergencyBtn.onclick = () => this.openDatabaseSettingsFromLogin();
        }

        // تسجيل الدخول
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // تسجيل الخروج
        document.getElementById('logout-btn').addEventListener('click', () => {
            auth.logout();
            this.showLogin();
            this.showToast('تم تسجيل الخروج بنجاح', 'success');
        });

        // أزرار البحث والاستيراد والتصدير وإدارة المستخدمين
        let searchTimeout;
        const searchHandler = (e) => {
            const input = e.target;
            const val = input.value;

            // Sync all search inputs across pages
            const globalSearch = document.getElementById('global-search');
            const tableSearch = document.getElementById('table-search');
            const fullReturnsSearch = document.getElementById('full-returns-search');
            const salarySearch = document.getElementById('salary-search');
            const unifiedSearchInput = document.getElementById('unified-search-input');

            if (globalSearch) globalSearch.value = val;
            if (tableSearch) tableSearch.value = val;
            if (fullReturnsSearch) fullReturnsSearch.value = val;
            if (salarySearch) salarySearch.value = val;
            if (unifiedSearchInput) unifiedSearchInput.value = val;

            this.searchQuery = val;
            this.salarySearchQuery = val;

            clearTimeout(searchTimeout);
            const delay = this.currentPage === 'full-returns' ? 350 : (this.returnsCache ? 80 : 500);
            searchTimeout = setTimeout(() => {
                if (this.currentPage === 'returns' || !this.currentPage) {
                    this.currentPage_num = 1;
                    this.loadReturns(1, this.rowsPerPage || 50, this.searchQuery, this.filterValue);
                } else if (this.currentPage === 'full-returns') {
                    this.loadFullReturns(1, 50, this.searchQuery, true);
                } else if (this.currentPage === 'salary-returns') {
                    this.salaryCurrentPage = 1;
                    this.loadSalaryReturns(1, 50, this.salarySearchQuery);
                }
            }, delay);
        };

        const globalSearch = document.getElementById('global-search');
        const tableSearch = document.getElementById('table-search');
        const fullReturnsSearch = document.getElementById('full-returns-search');
        const salarySearch = document.getElementById('salary-search');
        const unifiedSearchInput = document.getElementById('unified-search-input');

        if (globalSearch) globalSearch.addEventListener('input', searchHandler);
        if (tableSearch) tableSearch.addEventListener('input', searchHandler);
        if (fullReturnsSearch) fullReturnsSearch.addEventListener('input', searchHandler);
        if (salarySearch) salarySearch.addEventListener('input', searchHandler);
        if (unifiedSearchInput) {
            unifiedSearchInput.addEventListener('input', searchHandler);
            unifiedSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.runUnifiedSearch();
            });
        }

        // Attachment Status Filter
        document.getElementById('attachment-status-filter')?.addEventListener('change', (e) => {
            this.handleAttachmentFilterChange();
        });

        // Salary Filters
        document.getElementById('salary-attachment-filter')?.addEventListener('change', (e) => {
            this.handleSalaryAttachmentFilterChange();
        });
        document.getElementById('salary-upload-date-filter')?.addEventListener('change', (e) => {
            this.handleSalaryUploadDateSelectChange(e.target.value);
        });
        document.getElementById('salary-return-status-filter')?.addEventListener('change', (e) => {
            if (this.handleSalaryReturnStatusFilterChange) this.handleSalaryReturnStatusFilterChange(e.target.value);
        });
        document.getElementById('salary-settlement-filter')?.addEventListener('change', (e) => {
            if (this.handleSalarySettlementFilterChange) this.handleSalarySettlementFilterChange(e.target.value);
        });
        document.getElementById('salary-month-filter')?.addEventListener('change', (e) => {
            if (this.handleSalaryMonthFilterChange) this.handleSalaryMonthFilterChange(e.target.value);
        });
        document.getElementById('salary-payment-date-filter')?.addEventListener('change', (e) => {
            if (this.handleSalaryPaymentDateFilterChange) this.handleSalaryPaymentDateFilterChange(e.target.value);
        });



        // الاستيراد





        document.getElementById('empty-import-btn')?.addEventListener('click', () => this.showImportModal());
        document.getElementById('import-modal-close')?.addEventListener('click', () => this.hideImportModal());



        // منطقة السحب والإفلات
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');

        if (dropZone && fileInput) {
            dropZone.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
                dropZone.addEventListener(event, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            ['dragenter', 'dragover'].forEach(event => {
                dropZone.addEventListener(event, () => dropZone.classList.add('dragover'));
            });

            ['dragleave', 'drop'].forEach(event => {
                dropZone.addEventListener(event, () => dropZone.classList.remove('dragover'));
            });

            dropZone.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    fileInput.files = files;
                    this.handleFileSelect({ target: fileInput });
                }
            });
        }

        // منطقة السحب والإفلات للمرتبات
        const salaryDropZone = document.getElementById('salary-drop-zone');
        const salaryFileInput = document.getElementById('salary-file-input');

        if (salaryDropZone && salaryFileInput) {
            salaryDropZone.addEventListener('click', () => salaryFileInput.click());
            salaryFileInput.addEventListener('change', (e) => this.handleSalaryFileSelect(e));

            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
                salaryDropZone.addEventListener(event, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            ['dragenter', 'dragover'].forEach(event => {
                salaryDropZone.addEventListener(event, () => salaryDropZone.classList.add('dragover'));
            });

            ['dragleave', 'drop'].forEach(event => {
                salaryDropZone.addEventListener(event, () => salaryDropZone.classList.remove('dragover'));
            });

            salaryDropZone.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    salaryFileInput.files = files;
                    this.handleSalaryFileSelect({ target: salaryFileInput });
                }
            });
        }

        // الطباعة
        document.getElementById('btn-print-returns')?.addEventListener('click', () => this.printReport());

        // التصدير
        document.getElementById('export-excel-btn')?.addEventListener('click', () => this.exportExcel());

        // إدارة المستخدمين
        document.getElementById('add-user-btn')?.addEventListener('click', () => this.showUserModal());
        document.getElementById('user-modal-close')?.addEventListener('click', () => this.hideUserModal());
        document.getElementById('user-modal-cancel')?.addEventListener('click', () => this.hideUserModal());
        document.getElementById('user-modal-save')?.addEventListener('click', () => this.saveUser());
        document.getElementById('save-db-path-btn')?.addEventListener('click', () => this.saveDbPath());
        document.getElementById('browse-db-path-btn')?.addEventListener('click', () => this.browseDbPath());

        // إغلاق المودال عند الضغط خارجه
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });


        // --- Report Search Autocomplete (Fixed Binding) ---
        const reportSearchInput = document.getElementById('report-search-name');
        if (reportSearchInput) {
            reportSearchInput.addEventListener('input', (e) => this.handleReportSearchInput(e.target.value));
            // Close suggestions when clicking outside
            document.addEventListener('click', (e) => {
                const sugg = document.getElementById('report-search-suggestions');
                if (sugg && !reportSearchInput.contains(e.target) && !sugg.contains(e.target)) {
                    sugg.classList.add('hidden');
                }
            });
        }

        // --- Global Modal Key Events (Enter/Escape) ---
        document.addEventListener('keydown', (e) => {
            // Find active/visible modals
            const activeModal = Array.from(document.querySelectorAll('.modal, .modal-overlay, .login-wrapper'))
                .find(m => !m.classList.contains('hidden') && m.style.display !== 'none' && window.getComputedStyle(m).display !== 'none');

            if (!activeModal) return;

            if (e.key === 'Enter') {
                // If focused in a textarea, let it handle Enter normally
                if (document.activeElement.tagName === 'TEXTAREA') return;

                // Find primary button in this modal
                const primaryBtn = activeModal.querySelector('.btn-primary, .btn-save, .fd-btn-ok, button[type="submit"], .btn-val-full-save');
                if (primaryBtn && !primaryBtn.disabled) {
                    e.preventDefault();
                    primaryBtn.click();
                }
            } else if (e.key === 'Escape') {
                // Find close/cancel button
                const closeBtn = activeModal.querySelector('.modal-close, .btn-close, .fd-close, .fd-btn-cancel, .btn-secondary');
                if (closeBtn && !closeBtn.disabled) {
                    e.preventDefault();
                    closeBtn.click();
                }
            }
        });
    }

    // ========================================
    // تسجيل الدخول
    // ========================================

    async handleLogin() {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');

        this.showLoading();

        const result = await auth.login(username, password);

        this.hideLoading();

        if (result.success) {
            errorDiv.classList.remove('show');
            this.databaseSetupMode = false;
            this.currentUser = result.user;
            this.showApp();
            this.navigateTo('dashboard');
            this.showToast(`مرحباً ${result.user.fullname}`, 'success');
            this.playNotificationSound();
            if (window.chatModule) window.chatModule.init();
        } else {
            errorDiv.textContent = result.error || result.message || 'خطأ في تسجيل الدخول';
            errorDiv.classList.add('show');
        }
    }

    // ========================================
    // التنقل بين الصفحات
    // ========================================

    handleAttachmentFilterChange() {
        const val = document.getElementById('attachment-status-filter').value;
        this.attachmentFilterValue = val;
        this.currentPage_num = 1;
        this.loadReturns(1, this.pagination ? this.pagination.itemsPerPage : 50, this.searchQuery, this.filterValue, val);
    }

    handleSettlementFilterChange(val) {
        console.log('[FILTER] Settlement filter changed:', val);
        this.settlementFilterValue = val;
        this.currentPage_num = 1;
        this.loadReturns(1, this.pagination ? this.pagination.itemsPerPage : 50, this.searchQuery, this.filterValue, this.attachmentFilterValue);
    }

    handleReturnStatusFilterChange(val) {
        console.log('[FILTER] Return Status filter changed:', val);
        this.returnStatusFilterValue = val;
        this.currentPage_num = 1;
        this.loadReturns(1, this.pagination ? this.pagination.itemsPerPage : 50, this.searchQuery, this.filterValue, this.attachmentFilterValue);
    }

    handleUploadDateSelectChange(val) {
        console.log('[FILTER] Upload Date Select changed:', val);
        if (val && val !== 'all') {
            this.uploadDateFrom = val;
            this.uploadDateTo = val; // Single day range
        } else {
            this.uploadDateFrom = null;
            this.uploadDateTo = null;
        }
        this.currentPage_num = 1;
        this.loadReturns(1, this.pagination ? this.pagination.itemsPerPage : 50, this.searchQuery, this.filterValue, this.attachmentFilterValue);
    }

    handlePaymentDateFilterChange(val) {
        console.log('[FILTER] Payment Date filter changed:', val);
        this.paymentDateFilterValue = val;
        this.currentPage_num = 1;
        this.loadReturns(1, this.pagination ? this.pagination.itemsPerPage : 50, this.searchQuery, this.filterValue, this.attachmentFilterValue);
    }

    openTasksPanel() {
        const panel = document.getElementById('tasks-panel');
        if (panel) {
            panel.classList.remove('hidden');
            if (window.chatModule && typeof window.chatModule.loadTasks === 'function') {
                window.chatModule.loadTasks();
            }
        }
    }

    closeTasksPanel() {
        const panel = document.getElementById('tasks-panel');
        if (panel) {
            panel.classList.add('hidden');
        }
    }

    async ensureDeveloperMode() {
        if (this.developerModeUnlocked) return true;

        const now = Date.now();
        if (this.developerModeLockedUntil && now < this.developerModeLockedUntil) {
            const seconds = Math.ceil((this.developerModeLockedUntil - now) / 1000);
            this.showToast(`تم تعطيل المحاولة مؤقتا. حاول بعد ${seconds} ثانية`, 'warning');
            return false;
        }

        const pin = await window.dialog.show({
            title: 'الإعدادات المتقدمة',
            message: 'أدخل رمز الدخول للإعدادات المتقدمة',
            type: 'question',
            isPrompt: true,
            inputType: 'password',
            defaultValue: ''
        });

        if (pin === null || pin === false || pin === '') return false;

        try {
            const result = await db.fetchApi('/api/settings/verify-pin', {
                method: 'POST',
                body: JSON.stringify({ pin })
            });

            if (result.success) {
                this.developerModeUnlocked = true;
                this.developerModeAttempts = 0;
                this.developerModeLockedUntil = 0;
                sessionStorage.setItem('hk_developer_mode_unlocked', '1');
                return true;
            }
        } catch (error) {
            this.showToast('تعذر التحقق من رمز الدخول', 'error');
            return false;
        }

        this.developerModeAttempts += 1;
        if (this.developerModeAttempts >= 3) {
            this.developerModeLockedUntil = Date.now() + 30000;
            this.developerModeAttempts = 0;
            this.showToast('رمز غير صحيح. تم تعطيل المحاولة لمدة 30 ثانية', 'error');
        } else {
            this.showToast('رمز غير صحيح', 'error');
        }
        return false;
    }

    async openDatabaseSettingsFromLogin() {
        const unlocked = await this.ensureDeveloperMode();
        if (!unlocked) return;

        this.databaseSetupMode = true;
        this.showApp();
        document.getElementById('nav-settings')?.classList.remove('hidden');
        document.getElementById('tab-settings-users')?.classList.add('hidden');
        await this.navigateTo('settings', true);
        this.switchSettingsTab('db');
        await this.loadDbPath();
        if (typeof this.loadArchivePath === 'function') {
            await this.loadArchivePath();
        }
        this.showToast('تم فتح إعدادات قاعدة البيانات', 'success');
    }

    async navigateTo(page, preventLoad = false, chatUserId = null, chatUserName = null) {
        console.log('Navigating to:', page, preventLoad); // Debug log
        this.initTheme();
        if (!page) return;
        const developerSettingsAccess = page === 'settings' && this.developerModeUnlocked;
        if (page === 'settings') {
            const unlocked = await this.ensureDeveloperMode();
            if (!unlocked) return;
        }
        if (!developerSettingsAccess && !auth.canAccessPage(page)) {
            this.showToast('ليس لديك صلاحية الوصول لهذه الصفحة', 'error');
            const fallback = ['dashboard', 'returns', 'salary-returns', 'chat', 'tasks'].find(p => auth.canAccessPage(p));
            if (fallback && fallback !== page) {
                this.navigateTo(fallback, preventLoad);
            }
            return;
        }

        this.currentPage = page;

        // تحديث حالة الأزرار في القائمة
        document.querySelectorAll('.nav-item').forEach(item => {
            const isMatch = item.dataset.page === page;
            item.classList.toggle('active', isMatch);
        });

        // إظهار الصفحة المطلوبة وإخفاء الباقي
        document.querySelectorAll('.page-content').forEach(content => {
            const isMatch = (content.id === `page-${page}`);
            content.classList.toggle('hidden', !isMatch);
        });

        // تحديث عنوان الصفحة في الهيدر
        const titles = {
            dashboard: { icon: '🏠', text: 'لوحة التحكم' },
            returns: { icon: '📊', text: 'مرتدات الحوافز' },
            'salary-returns': { icon: '💰', text: 'مرتدات المرتبات' },
            'full-returns': { icon: '📚', text: 'البحث الشامل' },
            'smart-payment': { icon: '💸', text: 'السداد الذكي' },
            tasks: { icon: '📝', text: 'مهام اليوم' },
            chat: { icon: '💬', text: 'المراسلة' },
            archive: { icon: '🗄️', text: 'الأرشيف' },
            adabir: { icon: '📁', text: 'نظام الإضابير' },
            settings: { icon: '⚙️', text: 'الإعدادات' }
        };

        const title = titles[page];
        if (title) {
            const iconEl = document.getElementById('page-icon');
            const titleEl = document.getElementById('page-title');
            if (iconEl) iconEl.textContent = title.icon;
            if (titleEl) titleEl.textContent = title.text;
        }

        // تحميل بيانات الصفحة إذا لزم الأمر
        if (!preventLoad) {
            if (page === 'archive') this.loadArchive();

            if (page === 'settings') {
                if (this.databaseSetupMode || developerSettingsAccess) {
                    this.loadDbPath();
                    if (typeof this.loadArchivePath === 'function') this.loadArchivePath();
                } else {
                    this.loadUsers();
                    this.loadDeletePassword();
                    this.loadAttachmentLinkMode();
                    this.initPermissionsSettings();
                    this.refreshSearchFilterIndex();
                }
            }
            if (page === 'returns') {
                this.refreshSearchFilterIndex();
                this.loadReturns();
            }
            if (page === 'dashboard') this.loadDashboard();
            if (page === 'adabir') this.loadAdabir();
            if (page === 'full-returns') this.loadFullReturns();
            if (page === 'salary-returns') {
                this.refreshSearchFilterIndex();
                this.loadSalaryReturns();
            }
            if (page === 'smart-payment') this.refreshSearchFilterIndex();
            if (page === 'tasks') this.loadTasksPage();
            if (page === 'chat' && window.chatModule) {
                window.chatModule.loadConversations().then(() => {
                    if (chatUserId && chatUserName) {
                        window.chatModule.startNewConversation(chatUserId, chatUserName);
                    }
                });
            }
        }


        // إغلاق الشريط الجانبي في الشاشات الصغيرة بعد الاختيار (اختياري)
        if (window.innerWidth < 1024) {
            document.querySelector('.sidebar')?.classList.add('collapsed');
        }
    }

    /**
     * التبديل بين تبويبات الإعدادات
     */
    switchSettingsTab(tabId) {
        console.log('Switching settings tab to:', tabId);

        if (this.databaseSetupMode) {
            document.querySelectorAll('#page-settings .btn-tab').forEach(btn => {
                btn.classList.toggle('hidden', btn.id !== 'tab-settings-db');
            });
            if (tabId !== 'db') tabId = 'db';
        } else {
            document.querySelectorAll('#page-settings .btn-tab').forEach(btn => {
                btn.classList.remove('hidden');
            });
        }

        let targetTab = document.getElementById(`settings-tab-${tabId}`);
        let targetBtn = document.getElementById(`tab-settings-${tabId}`);
        if (!targetTab) {
            console.warn(`Settings tab not found: ${tabId}. Falling back to db tab.`);
            tabId = 'db';
            targetTab = document.getElementById('settings-tab-db');
            targetBtn = document.getElementById('tab-settings-db');
        }

        if (!targetTab) return;

        // إخفاء جميع محتويات التبويبات
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        // إزالة الحالة النشطة من جميع أزرار التبويبات
        document.querySelectorAll('#page-settings .btn-tab').forEach(btn => {
            btn.classList.remove('active');
        });

        // إظهار التبويب المطلوب وتنشيط الزر الخاص به
        targetTab.classList.remove('hidden');
        if (targetBtn) targetBtn.classList.add('active');

        this.currentSettingsTab = tabId;
        if (tabId === 'general' && typeof this.fillHubUrlField === 'function') this.fillHubUrlField();
        if (tabId === 'db') this.loadDbPath();
        if (tabId === 'users') this.initPermissionsSettings();
        if (tabId === 'advanced') {
            if (typeof this.loadArchivePath === 'function') this.loadArchivePath();
            if (typeof this.loadAttachmentLinkMode === 'function') this.loadAttachmentLinkMode();
        }
        if (tabId === 'maintenance' && typeof this.refreshSearchFilterIndex === 'function') this.refreshSearchFilterIndex();
    }

    getPermissionGroups() {
        return [
            { title: 'الصفحات', items: [
                ['page.dashboard', 'Dashboard reports'], ['page.returns', 'مرتدات الحوافز'], ['page.salary-returns', 'مرتدات المرتبات'],
                ['page.full-returns', 'البحث الشامل'], ['page.smart-payment', 'السداد الذكي'], ['page.chat', 'المراسلة'],
                ['page.tasks', 'مهام اليوم'], ['page.archive', 'Archive / الأرشيف'], ['page.adabir', 'الأضابير'], ['page.settings', 'الإعدادات']
            ]},
            { title: 'الإجراءات العامة', items: [
                ['action.import', 'Import / استيراد'], ['action.export', 'Export / تصدير'], ['action.delete', 'Delete / حذف'],
                ['action.edit', 'Edit / تعديل'], ['action.archive', 'Archive / الأضابير'], ['action.account-statement', 'كشف حساب'],
                ['action.validation', 'فحص'], ['action.sync', 'مزامنة']
            ]},
            { title: 'الميزات والتفاصيل', items: [
                ['action.message', 'مراسلة'], ['action.tasks', 'مهام اليوم'], ['action.smart-payment', 'السداد الذكي'],
                ['action.dashboard-reports', 'Dashboard reports'], ['action.row-actions', 'Row actions'], ['action.bulk-actions', 'Bulk actions']
            ]}
        ];
    }

    async initPermissionsSettings() {
        if (!auth.hasPermission('page.settings')) return;
        try {
            if (!this.permissionsUsers?.length) {
                this.permissionsUsers = await db.fetchApi('/users');
            }
            this.renderPermissionsUsers(document.getElementById('permissions-user-search')?.value || '');
            const select = document.getElementById('permissions-user-select');
            if (select?.value) await this.loadSelectedUserPermissions();
        } catch (e) {
            this.showPermissionsStatus('تعذر تحميل المستخدمين والصلاحيات', 'error');
        }
    }

    renderPermissionsUsers(filter = '') {
        const select = document.getElementById('permissions-user-select');
        if (!select) return;
        const currentValue = select.value;
        const term = String(filter || '').trim().toLowerCase();
        const users = (this.permissionsUsers || []).filter(u => {
            const haystack = `${u.username || ''} ${u.fullname || ''}`.toLowerCase();
            return !term || haystack.includes(term);
        });
        select.innerHTML = users.map(u => `<option value="${u.id}">${this.escapeHtml?.(u.fullname || u.username) || (u.fullname || u.username)} - ${u.role || ''}</option>`).join('');
        if (currentValue && users.some(u => String(u.id) === String(currentValue))) select.value = currentValue;
        if (select.value) this.loadSelectedUserPermissions();
    }

    async loadSelectedUserPermissions() {
        const select = document.getElementById('permissions-user-select');
        const editor = document.getElementById('permissions-editor');
        if (!select || !editor || !select.value) return;
        editor.innerHTML = '<div class="permissions-loading"><i class="fas fa-spinner fa-spin"></i> جاري تحميل الصلاحيات...</div>';
        try {
            const result = await db.fetchApi(`/permissions/${select.value}`);
            const allowed = new Set(result.permissions || []);
            editor.innerHTML = this.getPermissionGroups().map(group => `
                <div class="permission-group-card">
                    <div class="permission-group-title">${group.title}</div>
                    <div class="permission-grid">
                        ${group.items.map(([key, label]) => `
                            <label class="permission-toggle">
                                <input type="checkbox" value="${key}" ${allowed.has(key) ? 'checked' : ''}>
                                <span class="permission-switch"></span>
                                <span class="permission-label">${label}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `).join('');
            this.showPermissionsStatus('', 'clear');
        } catch (e) {
            editor.innerHTML = '';
            this.showPermissionsStatus('تعذر تحميل صلاحيات المستخدم', 'error');
        }
    }

    async saveSelectedUserPermissions() {
        const select = document.getElementById('permissions-user-select');
        if (!select?.value) return;
        const permissions = Array.from(document.querySelectorAll('#permissions-editor input[type="checkbox"]:checked')).map(x => x.value);
        try {
            this.showPermissionsStatus('جاري حفظ الصلاحيات...', 'loading');
            await db.fetchApi('/permissions/save', {
                method: 'POST',
                body: JSON.stringify({
                    adminUserId: this.currentUser?.id || auth.getUser()?.id,
                    userId: parseInt(select.value),
                    permissions
                })
            });
            this.showPermissionsStatus('تم حفظ الصلاحيات بنجاح. سيتم تطبيقها بعد تحديث الصفحة أو تسجيل الدخول.', 'success');
        } catch (e) {
            this.showPermissionsStatus(e.message || 'فشل حفظ الصلاحيات', 'error');
        }
    }

    showPermissionsStatus(message, type) {
        const status = document.getElementById('permissions-status');
        if (!status) return;
        if (type === 'clear' || !message) {
            status.className = 'permissions-status hidden';
            status.textContent = '';
            return;
        }
        status.className = `permissions-status ${type}`;
        status.textContent = message;
    }

    /**
     * تحميل وعرض البيانات
     */
    async loadReturns(page = 1, pageSize = 50, search = null, filter = null, attachmentStatus = null, append = false) {
        if ((this.selectedReturnIds.size > 0 || this.isAllReturnsSelected) &&
            (search !== null && search !== this.searchQuery || filter !== null && filter !== this.filterValue)) {
            if (!confirm('لديك سجلات محددة، هل تريد مسح التحديد أم الإبقاء عليه؟\n(موافق لمسح التحديد، إلغاء للإبقاء عليه)')) {
                // Keep selection
            } else {
                this.clearSelection();
            }
        }

        console.log('[LOAD] loadReturns called:', { page, pageSize, search, filter, attachmentStatus, append });
        // تحديث الحالات المحلية لضمان التزامن
        if (search !== null) this.searchQuery = search;
        if (filter !== null) this.filterValue = filter;
        if (attachmentStatus !== null) this.attachmentFilterValue = attachmentStatus;

        // Use document value if local state is null (safety sync)
        if (this.searchQuery === null) {
        this.searchQuery = document.getElementById('table-search')?.value || "";
        }

        // Ensure filter values are always synced with UI if null
        this.monthFilterValue = document.getElementById('month-filter')?.value || this.monthFilterValue || 'all';
        this.settlementFilterValue = document.getElementById('settlement-filter')?.value || this.settlementFilterValue || 'all';
        this.returnStatusFilterValue = document.getElementById('return-status-filter')?.value || this.returnStatusFilterValue || 'all';
        this.paymentDateFilterValue = document.getElementById('payment-date-filter')?.value || this.paymentDateFilterValue || 'all';
        this.returnsFilters = {
            search: this.searchQuery || '',
            attachment: this.attachmentFilterValue || 'all',
            month: this.monthFilterValue || 'all',
            settlement: this.settlementFilterValue || 'all',
            returnStatus: this.returnStatusFilterValue || 'all',
            paymentDate: this.paymentDateFilterValue || 'all',
            uploadDateFrom: this.uploadDateFrom || null,
            uploadDateTo: this.uploadDateTo || null
        };

        const uploadDateFilterVal = document.getElementById('upload-date-filter')?.value;
        if (uploadDateFilterVal && uploadDateFilterVal !== 'all') {
            let actualUploadDate = String(row['تاريخ الرفع'] || row.UploadDate || '').trim();
            if (actualUploadDate.length >= 10) actualUploadDate = actualUploadDate.substring(0, 10);
            if (actualUploadDate !== uploadDateFilterVal) return false;
        }

        if (false && uploadDateFilterVal && uploadDateFilterVal !== 'all') {
            this.uploadDateFrom = uploadDateFilterVal;
            this.uploadDateTo = uploadDateFilterVal;
        }

        const hasSearch = this.searchQuery && String(this.searchQuery).trim() !== '';
        console.log('[LOAD] Filtering Status:', { hasSearch, query: this.searchQuery });

        const isFiltering = hasSearch ||
            (this.filterValue && this.filterValue !== 'all' && this.filterValue !== 'الكل') ||
            (this.attachmentFilterValue && this.attachmentFilterValue !== 'all') ||
            (String(this.monthFilterValue) !== 'all') ||
            (this.settlementFilterValue && this.settlementFilterValue !== 'all' && this.settlementFilterValue !== 'الكل') ||
            (this.returnStatusFilterValue && this.returnStatusFilterValue !== 'all' && this.returnStatusFilterValue !== 'الكل') ||
            (this.paymentDateFilterValue && this.paymentDateFilterValue !== 'all') ||
            (this.uploadDateFrom || this.uploadDateTo);

        // --- Smart Live Cache Logic ---
        // استخدام الكاش المحلي فقط إذا كان محملاً فعلياً لضمان عدم ظهور "لا توجد بيانات" فارغة
        const hasCache = this.returnsCache && Array.isArray(this.returnsCache) && this.returnsCache.length > 0;

        // Efficient Local Cache Search
        if (hasCache) {
            console.log('[SPEED] Using Instant Cache Search');
            const localResults = this.handleLocalSearch(this.searchQuery, this.filterValue, this.attachmentFilterValue, page, pageSize, append);
            // إذا كان هناك بحث محلي ولم يجد شئ، نلجأ للسيرفر كاحتياطي
            if (!hasSearch || (localResults && localResults > 0)) {
                return;
            }
            console.log('[FALLBACK] Local search returned 0, trying server...');
        }

        // Background Cache Population disabled for 1M records performance
        // if (!this.returnsCache && !this.isCaching) {
        //     this.populateReturnsCache();
        // }

        try {
            // Check for Active Archive (Restore mode)
            const config = await db.fetchApi('/config');

            // Incentive Archive Button
            const clearBtn = document.getElementById('clear-archive-btn');
            if (clearBtn) {
                if (config && config.activeImportId > 0) {
                    clearBtn.classList.remove('hidden');
                    clearBtn.style.display = 'inline-block';
                } else {
                    clearBtn.classList.add('hidden');
                    clearBtn.style.display = 'none';
                }
            }

            // Salary Archive Button (Always hide when in Incentive page)
            const clearSalaryBtn = document.getElementById('clear-salary-archive-btn');
            if (clearSalaryBtn) {
                clearSalaryBtn.classList.add('hidden');
                clearSalaryBtn.style.display = 'none';
            }

            console.log('[LOAD] Fetching returns (Server Fallback)...', {
                page,
                pageSize,
                search: this.searchQuery,
                filter: this.filterValue,
                attachmentStatus: this.attachmentFilterValue,
                monthFilter: this.monthFilterValue,
                settlementFilter: this.settlementFilterValue,
                uploadDateFrom: this.uploadDateFrom,
                uploadDateTo: this.uploadDateTo,
                paymentDateFilter: this.paymentDateFilterValue,
                append
            });
            const response = await db.getReturns(
                page,
                pageSize,
                this.searchQuery,
                this.filterValue,
                this.attachmentFilterValue,
                null, // min
                null, // max
                null, // targetColumn
                this.returnStatusFilterValue, // Actual status filter
                this.monthFilterValue,        // Actual month filter
                this.settlementFilterValue,
                this.uploadDateFrom,
                this.uploadDateTo,
                this.paymentDateFilterValue
            );

            let appendedRows = null;
            if (response.data && response.data.length > 0) {
                let dataToUse = response.data;

                dataToUse = dataToUse.map(row => {
                    const val = row['رقم تسوية السداد'];
                    const hasSettlement = val !== null && val !== undefined && String(val).trim() !== '';
                    row['حالة التسوية'] = hasSettlement ? 'تم التسوية' : 'لم يتم التسوية';
                    return row;
                });

                // FORCE client-side filtering (Professional Safety Layer)
                // Filter by Settlement first
                if (this.settlementFilterValue && this.settlementFilterValue !== 'all' && this.settlementFilterValue !== 'الكل') {
                    const mode = this.settlementFilterValue.trim();
                    dataToUse = dataToUse.filter(row => {
                        const actualVal = (row['حالة التسوية'] || '').trim();
                        if (actualVal === mode) return true;
                        if (mode === 'تمت التسوية' && actualVal === 'تم التسوية') return true;
                        if (mode === 'تم التسوية' && actualVal === 'تمت التسوية') return true;
                        return false;
                    });
                }

                // Filter by Return Status — يبحث في كل المسميات المعروفة للحالة
                if (this.returnStatusFilterValue && this.returnStatusFilterValue !== 'all' && this.returnStatusFilterValue !== 'الكل') {
                    const mode = this.returnStatusFilterValue.toLowerCase();
                    dataToUse = dataToUse.filter(row => {
                        const status = (
                            row['الحالة'] ||
                            row['حالة الارتداد'] ||
                            row['Status'] ||
                            row['ReturnStatus'] ||
                            ''
                        ).toLowerCase();
                        return status.includes(mode);
                    });
                }

                // Filter by Month next
                if (this.monthFilterValue && this.monthFilterValue !== 'all') {
                    const selectedMonth = this.monthFilterValue; // e.g. "01-2026" or "فارغ"
                    dataToUse = dataToUse.filter(row => {
                        return this._getMonthFilterValue(row) === selectedMonth;
                    });
                }

                dataToUse = this.applyAdabirDateRangeToRows(dataToUse);

                if (append) {
                    this.data = [...this.data, ...dataToUse];
                    appendedRows = dataToUse;
                } else {
                    this.data = dataToUse;
                    this.extractHeaders(this.data);
                }

                this.pagination = response.pagination;
                this.currentSearch = this.searchQuery;
                this.currentFilter = this.filterValue;
            } else {
                if (!append) {
                    this.data = [];
                    if (this.pagination) {
                        this.pagination.total = 0;
                        this.pagination.currentPage = 1;
                    }
                    this.currentSearch = this.searchQuery;
                }
            }

            console.log('[DATA-SYNC] Records returned from server:', response.data ? response.data.length : 0);
            console.log('[STATS-SYNC] Server Stats:', response.stats);

            const dataToRender = append ? appendedRows : null;
            this.filteredReturns = Array.isArray(this.data) ? [...this.data] : [];
            this.renderTable(dataToRender, append);
            this.updateStats(response.stats);
            if (this.getAdabirDateRangeFilter().active) {
                this.calculateLocalStats(this.data);
            }
            this._populateReturnFilterOptions(this.returnsCache || this.data);
            this.updateAdabirDateRangeCount(this.data);
        } catch (error) {
            console.error('[LOAD] Error loading data:', error);
            this.showToast('حدث خطأ في تحميل البيانات: ' + error.message, 'error');
        }
    }

    extractHeaders(data) {
        if (!data || data.length === 0) return;
        const allKeys = new Set();

        // تحسين: فحص كافة البيانات المتاحة في الذاكرة (Cache) لضمان الحصول على كافة الحقول الممكنة
        // إذا لم توجد الذاكرة بعد، نكتفي بالبيانات الحالية
        const sourceData = (this.returnsCache && this.returnsCache.length > 0) ? this.returnsCache : data;

        // فحص عينة أكبر لضمان الشمولية دون التأثير على الأداء (حتى 500 سجل)
        const sampleSize = Math.min(sourceData.length, 500);
        for (let i = 0; i < sampleSize; i++) {
            Object.keys(sourceData[i]).forEach(k => allKeys.add(k));
        }

        this.headers = Array.from(allKeys).filter(k =>
            k !== 'id' && k !== 'Id' && k !== 'AttachmentCount' &&
            k !== 'importId' && k !== '_conflictDetailsMultiAccOriginal' &&
            k !== 'رقم التسوية' && // استبعاد العمود المطلوب حذفه
            !k.startsWith('_') // تجاهل الحقول البرمجية المخفية
        );

        this.detectAmountColumn();
        this.detectDateColumn();
    }

    async populateReturnsCache() {
        if (this.isCaching) return;
        this.isCaching = true;

        const container = document.getElementById('sync-progress-container');
        const bar = document.getElementById('sync-bar-inner');
        const perc = document.getElementById('sync-percentage');
        const status = document.getElementById('sync-status-text');

        if (container) container.classList.remove('hidden');
        if (status) status.textContent = 'جاري الاتصال بقاعدة البيانات...';
        if (bar) bar.style.width = '10%';
        if (perc) perc.textContent = '10%';

        console.log('[CACHE] Starting background data synchronization...');
        try {
            if (bar) bar.style.width = '30%';
            if (perc) perc.textContent = '30%';
            if (status) status.textContent = 'جاري تنزيل نسخة البيانات...';

            const allData = await db.getAllReturns();

            if (bar) bar.style.width = '80%';
            if (perc) perc.textContent = '80%';
            if (status) status.textContent = 'جاري معالجة السجلات...';

            // تحسين: فهرسة البيانات مسبقاً لسرعة البحث وتلقائية الإحصائيات
            this.returnsCache = allData.map(row => {
                // مسبقاً: المبالغ
                const amountVal = row['قيمة العملية'] || row[' قيمة العملية'] || row['ProcessValue'] || row['المبلغ'] || row['Amount'];
                row._amount = this.parseAmount(amountVal);

                // مسبقاً: الحالة والتسوية
                row._normStatus = this.normalizeArabic(row['الحالة'] || row['Status'] || row['حالة الارتداد'] || '');
                {
                    const val = row['رقم تسوية السداد'];
                    const hasSettlement = val !== null && val !== undefined && String(val).trim() !== '';
                    row['حالة التسوية'] = hasSettlement ? 'تم التسوية' : 'لم يتم التسوية';
                    row._isSettled = hasSettlement;
                }

                // مسبقاً: الفهرس النصي الموحد (مفتاح السرعة الفائقة)
                // نجمع كافة القيم بشكل أعمق ليشمل حتى الرقم القومي وغيره
                const originalValues = Object.entries(row)
                    .filter(([k, v]) => !k.startsWith('_') && v !== null && v !== undefined)
                    .map(([k, v]) => String(v).toLowerCase());

                const normalizedValues = originalValues.map(v => this.normalizeArabic(v));

                row._searchStr = [...new Set([...originalValues, ...normalizedValues])].join(' ');

                return row;
            });

            if (bar) bar.style.width = '100%';
            if (perc) perc.textContent = '100%';
            if (status) status.textContent = 'تمت المزامنة بنجاح';

            console.log(`[CACHE] Successfully cached ${allData.length} records for instant search.`);

            // Hide after success
            setTimeout(() => {
                if (container) container.classList.add('hidden');
            }, 2000);

            return allData;
        } catch (e) {
            console.error('[CACHE] Cache population failed:', e);
            if (status) status.textContent = 'فشلت المزامنة!';
            if (bar) bar.style.background = '#ef4444';
            throw e;
        } finally {
            this.isCaching = false;
        }
    }

    async populateSalaryReturnsCache() {
        if (this.isSalaryCaching) return;
        this.isSalaryCaching = true;

        const container = document.getElementById('sync-progress-container');
        const bar = document.getElementById('sync-bar-inner');
        const perc = document.getElementById('sync-percentage');
        const status = document.getElementById('sync-status-text');

        if (container) container.classList.remove('hidden');
        if (status) status.textContent = 'جاري مزامنة بيانات المرتبات...';
        if (bar) bar.style.width = '10%';
        if (perc) perc.textContent = '10%';

        console.log('[CACHE-SALARY] Starting background salary data synchronization...');
        try {
            if (bar) bar.style.width = '30%';
            if (perc) perc.textContent = '30%';

            const allData = await db.getAllSalaryReturns();

            if (bar) bar.style.width = '80%';
            if (perc) perc.textContent = '80%';
            if (status) status.textContent = 'جاري معالجة سجلات المرتبات...';

            this.salaryReturnsCache = allData.map(row => {
                const amountVal = this.getUnifiedSalaryAmountValue(row);
                row._amount = this.parseAmount(amountVal);
                row._normStatus = this.normalizeArabic(row['الحالة'] || row['Status'] || '');

                const val = row['رقم تسوية السداد'];
                const hasSettlement = val !== null && val !== undefined && String(val).trim() !== '';
                row['حالة التسوية'] = hasSettlement ? 'تم التسوية' : 'لم يتم التسوية';
                row._isSettled = hasSettlement;

                const originalValues = Object.entries(row)
                    .filter(([k, v]) => !k.startsWith('_') && v !== null && v !== undefined)
                    .map(([k, v]) => String(v).toLowerCase());

                const normalizedValues = originalValues.map(v => this.normalizeArabic(v));
                row._searchStr = [...new Set([...originalValues, ...normalizedValues])].join(' ');

                return row;
            });

            if (bar) bar.style.width = '100%';
            if (perc) perc.textContent = '100%';
            if (status) status.textContent = 'تمت مزامنة المرتبات بنجاح';

            console.log(`[CACHE-SALARY] Successfully cached ${allData.length} records.`);

            setTimeout(() => {
                if (container) container.classList.add('hidden');
            }, 2000);

            return allData;
        } catch (e) {
            console.error('[CACHE-SALARY] Failed:', e);
            if (status) status.textContent = 'فشلت مزامنة المرتبات!';
            throw e;
        } finally {
            this.isSalaryCaching = false;
        }
    }

    async triggerNameSearch(name) {
        if (!name) return;

        console.log(`[QUICK-SEARCH] Triggering search for: ${name} on page: ${this.currentPage}`);
        let targetSearch = null;

        if (this.currentPage === 'smart-payment' || this.currentPage === 'page-smart-payment') {
            const activeType = this.smartPaymentTypeFilter || 'salary';
            if (activeType === 'salary') {
                await this.navigateTo('salary-returns');
                targetSearch = document.getElementById('salary-search');
            } else {
                await this.navigateTo('returns');
                targetSearch = document.getElementById('table-search');
            }
        } else if (this.currentPage === 'salary-returns' || this.currentPage === 'page-salary-returns') {
            targetSearch = document.getElementById('salary-search');
        } else if (this.currentPage === 'full-returns' || this.currentPage === 'page-full-returns') {
            targetSearch = document.getElementById('unified-search-input');
        } else {
            targetSearch = document.getElementById('table-search');
        }

        if (targetSearch) {
            targetSearch.value = name;
            // إطلاق حدث التغيير والفرز
            targetSearch.dispatchEvent(new Event('input', { bubbles: true }));
            targetSearch.dispatchEvent(new Event('change', { bubbles: true }));

            // تمرير إلى أعلى الصفحة لرؤية النتائج
            window.scrollTo({top: 0, behavior: 'smooth'});

            if (this.currentPage === 'full-returns' || this.currentPage === 'page-full-returns') {
                this.runUnifiedSearch();
            }
        } else {
            console.warn('[QUICK-SEARCH] Target search input not found for page:', this.currentPage);
        }
    }


    async handleLocalSearch(search, filter, attachmentStatus, page, pageSize, append) {
        if (!this.returnsCache) return;

        console.time('[PERF] Local Search');

        const searchQuery = search && String(search).trim() !== '' ? this.normalizeArabic(search) : null;
        console.log('[LOCAL SEARCH] Logic Start:', { search, searchQuery });
        const searchWords = searchQuery ? searchQuery.split(/\s+/).filter(w => w.length > 0) : [];

        const catFilter = filter && filter !== 'All' && filter !== 'الكل' ? filter.toLowerCase() : null;
        const selectedMonth = this.monthFilterValue && this.monthFilterValue !== 'all' ? this.monthFilterValue : null;
        const settlementMode = this.settlementFilterValue && this.settlementFilterValue !== 'all' && this.settlementFilterValue !== 'الكل' ? this.settlementFilterValue.trim() : null;
        const returnStatusMode = this.returnStatusFilterValue && this.returnStatusFilterValue !== 'all' && this.returnStatusFilterValue !== 'الكل' ? this.returnStatusFilterValue : null;
        const attachMode = attachmentStatus && attachmentStatus !== 'all' ? attachmentStatus : null;
        const uploadDateFrom = this.uploadDateFrom;
        const uploadDateTo = this.uploadDateTo;
        const paymentDateFilter = this.paymentDateFilterValue && this.paymentDateFilterValue !== 'all' ? this.paymentDateFilterValue : null;
        const adabirRange = this.getAdabirDateRangeFilter();

        // Optimized Field Discovery Keys
        const fileCodeKeys = ['كـــود الملف', 'كود الملف', 'كُـــود المـلف', 'كـــود المـلف', 'FileCode', 'كود_الملف'];

        const filtered = this.returnsCache.filter(row => {
            // 1. Search Logic
            if (searchWords.length > 0) {
                const rowStr = row._searchStr || "";
                const originalSearchWords = (search || "").toLowerCase().split(/\s+/).filter(w => w.length > 0);
                const searchTotal = (search || "").toLowerCase().trim();

                // High Priority: Exact phrase match (Normalized or Original)
                const matchPhrase = rowStr.includes(searchQuery) || rowStr.includes(searchTotal);

                if (!matchPhrase) {
                    // Fallback Priority: Word-by-word matching
                    // We restrict this for long queries (> 2 words) to avoid broad results in name searches
                    if (searchWords.length > 2) return false;

                    const matchNormalized = searchWords.every(word => rowStr.includes(word));
                    const matchOriginal = originalSearchWords.every(word => rowStr.includes(word));
                    if (!matchNormalized && !matchOriginal) return false;
                }
            }

            // 2. Category Logic
            if (catFilter) {
                const isMatch = Object.values(row).some(val => String(val).toLowerCase().includes(catFilter));
                if (!isMatch) return false;
            }

            // 3. Month Logic (High Accuracy)
            if (selectedMonth) {
                const monthVal = this._getMonthFilterValue(row);
                if (monthVal !== selectedMonth) return false;
            }

            // 4. Settlement Logic (Literal Match)
            if (settlementMode) {
                const actualVal = (row['حالة التسوية'] || '').trim();
                const matched = (actualVal === settlementMode) ||
                                (settlementMode === 'تمت التسوية' && actualVal === 'تم التسوية') ||
                                (settlementMode === 'تم التسوية' && actualVal === 'تمت التسوية');
                if (!matched) return false;
            }

            // 5. Return Status Logic
            if (returnStatusMode) {
                const status = (row['الحالة'] || row['Status'] || '').toLowerCase();
                if (!status.includes(returnStatusMode.toLowerCase())) return false;
            }

            // 6. Attachment Logic
            if (attachMode) {
                const hasAttach = (row.AttachmentCount || 0) > 0;
                if (attachMode === 'yes' && !hasAttach) return false;
                if (attachMode === 'no' && hasAttach) return false;
            }

            // 7. Upload Date Logic
            if (uploadDateFrom || uploadDateTo) {
                const uploadDate = row['تاريخ الرفع'];
                if (!uploadDate) return false;

                if (uploadDateFrom && uploadDate < uploadDateFrom) return false;
                if (uploadDateTo) {
                    let toLimit = uploadDateTo;
                    if (toLimit.length === 10) toLimit += " 23:59:59";
                    if (uploadDate > toLimit) return false;
                }
            }

// 8. Payment Date Logic (تاريخ اعتماد التعديل / تاريخ السداد)
            if (paymentDateFilter && paymentDateFilter !== 'all') {
                 const pDate = this._getPaymentDateFilterValue(row);
                 const formattedPayment = pDate.length >= 10 ? pDate.substring(0, 10) : pDate;
                 if (formattedPayment !== paymentDateFilter) return false;
             }
            if (adabirRange.active && !this.isMonthWithinDateRange(this._getMonthFilterValue(row), adabirRange.from, adabirRange.to)) {
                return false;
            }
            return true;
        });

        // Priority Sorting: Bring exact phrase matches to the top
        const sortQ = searchQuery || (search || "").toLowerCase().trim();
        if (sortQ) {
            filtered.sort((a, b) => {
                const aExact = (a._searchStr || "").includes(sortQ);
                const bExact = (b._searchStr || "").includes(sortQ);
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                return 0;
            });
        }

        console.timeEnd('[PERF] Local Search');
        console.log(`[LOCAL SEARCH] Found ${filtered.length} matches.`);

        // 6. Local Pagination
        const total = filtered.length;
        const totalPages = Math.ceil(total / pageSize);
        const start = (page - 1) * pageSize;
        const pagedData = filtered.slice(start, start + pageSize);

        if (!append) {
            this.data = pagedData;
            this.filteredReturns = filtered;
            this.extractHeaders(this.data);
            this.pagination = {
                currentPage: page,
                totalPages: totalPages,
                itemsPerPage: pageSize,
                total: total,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            };
            this.currentSearch = search;
            this.currentFilter = filter;
        }

        this.renderTable(append ? pagedData : null, append);
        this.calculateLocalStats(filtered);
        this._populateReturnFilterOptions(this.returnsCache || filtered);
        this.updateAdabirDateRangeCount(filtered);

        return filtered.length;
    }


    calculateLocalStats(filtered) {

        let totalAmount = 0;
        let rejectedAmount = 0;
        let returnedAmount = 0;
        let openAmount = 0;
        let settledAmount = 0;

        let rejectedCount = 0;
        let returnedCount = 0;
        let successCount = 0;
        let pendingCount = 0;
        let openCount = 0;
        let settledCount = 0;

        if (!filtered || filtered.length === 0) {
            this.updateStats({ systemTotalCount: this.returnsCache ? this.returnsCache.length : 0 });
            return;
        }

        filtered.forEach(obj => {
            const rowAmount = obj._amount || 0;
            totalAmount += rowAmount;

            const status = obj._normStatus || '';

            // Literal Match for Stats
            const isSettled = ((obj['حالة التسوية'] || '').trim() === 'تم التسوية');

            // Logic for Rejected vs Returned vs Others
            if (status.includes('مرفوض') || status.includes('reject')) {
                rejectedCount++;
                rejectedAmount += rowAmount;
            } else if (status.includes('مرتد') || status.includes('return')) {
                returnedCount++;
                returnedAmount += rowAmount;
            } else if (status.includes('ناجح') || status.includes('success')) {
                successCount++;
            } else if (status.includes('انتظار') || status.includes('pending')) {
                pendingCount++;
            }

            if (isSettled) {
                settledCount++;
                settledAmount += rowAmount;
            } else {
                openCount++;
                openAmount += rowAmount;
            }
        });

        // Update UI Elements (Matching the 6-Card Pro Grid)
        const updateText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        const formatCurr = (val) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        updateText('search-count', filtered.length.toLocaleString());
        updateText('search-amount', formatCurr(totalAmount));

        updateText('search-open-count', openCount.toLocaleString());
        updateText('search-open-amount', formatCurr(openAmount));

        updateText('search-settled-count', settledCount.toLocaleString());
        updateText('search-settled-amount', formatCurr(settledAmount));

        // Update stats summary object if needed for other parts of the app
        this.currentStats = {
            total: filtered.length,
            amount: totalAmount,
            open: openCount,
            openAmount: openAmount,
            settled: settledCount,
            settledAmount: settledAmount,
            rejected: rejectedCount,
            rejectedAmount: rejectedAmount,
            returned: returnedCount,
            returnedAmount: returnedAmount
        };

        // Update stats
        this.updateStats({
            systemTotalCount: this.returnsCache ? this.returnsCache.length : filtered.length,
            filteredCount: filtered.length,
            totalAmount,
            settledAmount,
            pendingAmount: openAmount, // Mapping openAmount to pendingAmount for uniformity
            returnedCount,
            rejectedCount,
            successCount: settledCount, // Mapping settled to success for uniformity
            pendingCount: openCount     // Mapping open to pending for uniformity
        });
    }

    detectAmountColumn() {
        // محاولة اكتشاف عمود المبلغ
        const amountKeywords = ['مبلغ', 'المبلغ', 'amount', 'total', 'قيمة', 'صافي'];

        for (const header of this.headers) {
            const lowerHeader = header.toLowerCase();
            if (amountKeywords.some(k => lowerHeader.includes(k))) {
                this.amountColumn = header;
                break;
            }
        }

        // إذا لم يتم العثور، استخدم أول عمود رقمي
        if (!this.amountColumn && this.data.length > 0) {
            for (const header of this.headers) {
                const value = this.data[0][header];
                if (typeof value === 'number' || !isNaN(parseFloat(value))) {
                    this.amountColumn = header;
                    break;
                }
            }
        }
    }

    detectDateColumn() {
        const dateKeywords = ['تاريخ', 'date', 'time', 'وقت', 'created', 'added'];

        for (const header of this.headers) {
            const lowerHeader = header.toLowerCase();
            if (dateKeywords.some(k => lowerHeader.includes(k))) {
                this.dateColumn = header;
                return; // Found it
            }
        }

        // Fallback: Check data for date-like strings
        if (this.data.length > 0) {
            for (const header of this.headers) {
                const val = this.data[0][header];
                if (val && !isNaN(Date.parse(val))) {
                    this.dateColumn = header;
                    return;
                }
            }
        }
    }



    /* Filter Management */
    async loadFilters() {
        // فلاتر افتراضية
        const defaultFilters = [
            { Name: 'المرتبات', Values: '10126,10125' },
            { Name: 'معاشات', Values: '10127' },
            { Name: 'الضمان', Values: '10128' },
            { Name: 'بدون غرض', Values: 'Army-c-434-61-06-2025,Army-c-434-62-07-2025,Army-c-434-64-07-2025,Army-c-434-260-11-2025,Army-c-434-261-11-2025,Army-c-434-170-09-2025,Army-c-434-94-08-2025,Army-c-434-182-10-2025,Army-c-434-184-10-2025,Army-c-434-179-10-2025,Army-c-434-223-10-2025,Army-c-434-263-11-2025,Army-c-434-222-10-2025,Army-c-434-221-10-2025,Army-c-434-92-07-2025,Army-c-434-90-07-2025,Army-c-434-95-08-2025,Army-c-434-109-08-2025,Army-c-434-181-10-2025,Army-c-434-178-10-2025,Army-c-434-365-01-2026,Army-c-448-103-01-2026,Army-c-434-232-11-2025,Army-c-434-234-11-2025,Army-c-448-90-12-2025,Army-c-434-330-12-2025,Army-c-448-91-12-2025,Army-c-434-364-01-2026,Army-c-448-153-01-2026' }
        ];

        try {
            // تحميل من localStorage
            const saved = localStorage.getItem('hk_filters');
            if (saved) {
                const parsed = JSON.parse(saved);
                // التحقق من صحة البيانات
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].Name !== undefined) {
                    this.filters = parsed;
                } else {
                    this.filters = defaultFilters;
                    localStorage.setItem('hk_filters', JSON.stringify(defaultFilters));
                }
            } else {
                this.filters = defaultFilters;
                localStorage.setItem('hk_filters', JSON.stringify(defaultFilters));
            }
            this.renderFilterDropdown();
            this.renderSettingsFilters();
        } catch (e) {
            console.error('Failed to load filters:', e);
            this.filters = defaultFilters;
            localStorage.setItem('hk_filters', JSON.stringify(defaultFilters));
        }
    }

    renderSettingsFilters() {
        const tbody = document.getElementById('filters-table-body');
        if (!tbody) return;

        tbody.innerHTML = this.filters.map((f, i) => {
            const displayValue = f.Type === 'range' ? `من ${f.Min} إلى ${f.Max}` : (f.Values || '');
            return `
                <tr>
                    <td>${f.Name}</td>
                    <td>${displayValue}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="app.editFilter(${i})">??</button>
                        <button class="btn btn-error btn-sm" onclick="app.deleteFilter(${i})">???</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    showFilterModal(filter = null, index = null) {
        const modal = document.getElementById('filter-modal');
        const title = document.getElementById('filter-modal-title');

        if (filter) {
            title.textContent = 'تعديل فلتر';
            document.getElementById('filter-name').value = filter.Name || '';
            document.getElementById('filter-type').value = filter.Type || 'list';
            document.getElementById('filter-values').value = filter.Values || '';
            document.getElementById('filter-min').value = filter.Min || '';
            document.getElementById('filter-max').value = filter.Max || '';
            document.getElementById('filter-edit-index').value = index;

            this.toggleFilterTypeFields();
        } else {
            title.textContent = 'إضافة فلتر جديد';
            document.getElementById('filter-form').reset();
            document.getElementById('filter-edit-index').value = '';
            this.toggleFilterTypeFields();
        }

        modal?.classList.remove('hidden');
    }

    toggleFilterTypeFields() {
        const type = document.getElementById('filter-type').value;
        const listGroup = document.getElementById('filter-list-group');
        const rangeGroup = document.getElementById('filter-range-group');

        if (type === 'range') {
            listGroup.classList.add('hidden');
            rangeGroup.classList.remove('hidden');
        } else {
            listGroup.classList.remove('hidden');
            rangeGroup.classList.add('hidden');
        }
    }

    // استيراد قيم الفلتر من ملف Excel
    importFilterValues(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                // استخراج القيم من العمود الأول (تجاهل الصف الأول إذا كان عنوان)
                const values = [];
                for (let i = 0; i < jsonData.length; i++) {
                    if (jsonData[i] && jsonData[i][0]) {
                        const val = String(jsonData[i][0]).trim();
                        if (val && val !== '') {
                            values.push(val);
                        }
                    }
                }

                // إضافة القيم للحقل (دمج مع القيم الموجودة)
                const currentValues = document.getElementById('filter-values').value;
                const newValues = currentValues ? currentValues + ',' + values.join(',') : values.join(',');
                document.getElementById('filter-values').value = newValues;

                this.showToast(`تم استيراد ${values.length} قيمة من الملف`, 'success');
            } catch (err) {
                console.error('Error importing filter values:', err);
                this.showToast('خطأ في قراءة الملف', 'error');
            }
        };
        reader.readAsArrayBuffer(file);

        // مسح الـ input للسماح باختيار نفس الملف مرة أخرى
        event.target.value = '';
    }

    editFilter(index) {
        const filter = this.filters[index];
        if (filter) this.showFilterModal(filter, index);
    }

    async deleteFilter(index) {
        const confirmed = await dialog.show({
            title: 'حذف فلتر',
            message: 'هل أنت متأكد من حذف هذا الفلتر؟',
            type: 'question',
            showCancel: true,
            liteMode: true
        });
        if (!confirmed) return;

        const newFilters = [...this.filters];
        newFilters.splice(index, 1);

        await this.saveFilters(newFilters);
    }

    hideFilterModal() {
        document.getElementById('filter-modal')?.classList.add('hidden');
    }

    async handleFilterSubmit(event) {
        if (event) event.preventDefault();

        const index = document.getElementById('filter-edit-index').value;
        const name = document.getElementById('filter-name').value;
        const type = document.getElementById('filter-type').value;
        const values = document.getElementById('filter-values').value;
        const min = document.getElementById('filter-min').value;
        const max = document.getElementById('filter-max').value;

        if (!name) {
            this.showToast('يرجى إدخال اسم الفلتر', 'warning');
            return;
        }

        if (type === 'list' && !values) {
            this.showToast('يرجى إدخال القيم المطلوبة', 'warning');
            return;
        }

        if (type === 'range' && (min === '' || max === '')) {
            this.showToast('يرجى إدخال النطاق الرقمي كاملاً', 'warning');
            return;
        }

        const newFilters = [...this.filters];
        const filterData = {
            Name: name,
            Type: type,
            Values: type === 'list' ? values : '',
            Min: type === 'range' ? parseFloat(min) : '',
            Max: type === 'range' ? parseFloat(max) : ''
        };

        if (index !== '') {
            newFilters[parseInt(index)] = filterData;
        } else {
            newFilters.push(filterData);
        }

        const success = await this.saveFilters(newFilters);
        if (success) {
            this.hideFilterModal();
        }
    }

    async saveFilters(newFilters) {
        try {
            // حفظ محلياً في localStorage
            this.filters = newFilters;
            localStorage.setItem('hk_filters', JSON.stringify(newFilters));

            this.renderFilterDropdown();
            this.renderSettingsFilters();
            document.getElementById('filter-modal').classList.remove('show');
            this.showToast('تم حفظ الفلاتر بنجاح', 'success');
            return true;
        } catch (e) {
            this.showToast('فشل حفظ الفلاتر', 'error');
        }
        return false;
    }

    renderFilterDropdown() {
        const select = document.getElementById('table-filter');
        if (!select) return;

        // Save current selection if possible
        const currentVal = select.value;

        let html = '<option value="">All / الكل</option>';
        this.filters.forEach((f, i) => {
            html += `<option value="idx_${i}">${f.Name}</option>`;
        });
        select.innerHTML = html;

        // Restore selection or default to empty
        if (currentVal && (currentVal.startsWith('idx_') || currentVal === "")) {
            select.value = currentVal;
        } else {
            select.value = "";
            this.filterValue = "";
        }
    }

    filterAndRenderTable() {
        // العودة دائماً لـ loadReturns لضمان البحث الصحيح من السيرفر أو الكاش المحدث
        this.loadReturns(1, this.rowsPerPage, this.searchQuery, this.filterValue);
    }

    toggleSelectReturn(id) {
        if (this.isAllReturnsSelected) {
            alert("تم تحديد كافة سجلات الفلتر من خلال البانر. لإجراء تحديد يدوي، يرجى النقر على زر 'إلغاء التحديد' أولاً.");
            const cb = document.querySelector(`.return-row-checkbox[value="${id}"]`);
            if (cb) cb.checked = true;
            return;
        }

        if (this.selectedReturnIds.has(String(id))) {
            this.selectedReturnIds.delete(String(id));
        } else {
            this.selectedReturnIds.add(String(id));
        }
        this.updateBulkDeleteToolbar();

        const headerCheck = document.getElementById('select-all-returns');
        const checkboxes = document.querySelectorAll('.return-row-checkbox');
        const checkedBoxes = document.querySelectorAll('.return-row-checkbox:checked');
        if (headerCheck) {
             headerCheck.checked = (checkboxes.length > 0 && checkboxes.length === checkedBoxes.length);
        }
    }

    toggleSelectAllReturns(checked) {
        document.getElementById('select-all-filtered-banner')?.remove();

        this.isAllReturnsSelected = false;
        this.selectedReturnIds.clear();

        const checkboxes = document.querySelectorAll('.return-row-checkbox');
        checkboxes.forEach(cb => cb.checked = checked);

        if (checked) {
            checkboxes.forEach(cb => this.selectedReturnIds.add(String(cb.value)));

            const visibleCount = checkboxes.length;
            const totalCount = this.totalFilteredCount || 0;

            if (totalCount > visibleCount) {
                this._showSelectAllFilteredBanner(visibleCount, totalCount);
            } else {
                this.isAllReturnsSelected = true;
            }
        }

        this.updateBulkDeleteToolbar();

        const selectAllCb = document.getElementById('select-all-returns');
        if (selectAllCb) selectAllCb.checked = checked;
    }

    updateBulkDeleteToolbar() {
        const totalFiltered = this.totalFilteredCount || 0;
        const count = this.isAllReturnsSelected
            ? `كافة (${totalFiltered.toLocaleString()})`
            : this.selectedReturnIds.size;

        const btnDeleteSelected = document.getElementById('btn-delete-selected');
        const countBadge = document.getElementById('selected-count-badge');

        let btnExportSelected = document.getElementById('btn-export-selected');
        let btnArchiveSelected = document.getElementById('btn-archive-selected');
        let btnClearSelection = document.getElementById('btn-clear-selection');
        const exportExcelBtn = document.getElementById('export-excel-btn');

        // إنشاء زر تصدير المحدد في الشريط العلوي إن لم يكن موجوداً
        if (!btnExportSelected && exportExcelBtn) {
            btnExportSelected = document.createElement('button');
            btnExportSelected.className = 'btn-pro-action btn-export-pro';
            btnExportSelected.id = 'btn-export-selected';
            btnExportSelected.style.background = 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)';
            btnExportSelected.style.borderColor = 'rgba(14, 165, 233, 0.5)';
            btnExportSelected.innerHTML = '<i class="fas fa-file-export"></i> تصدير المحدد <span id="export-selected-badge" style="background:#0284c7; color:white; border-radius:10px; padding:2px 6px; font-size:12px; margin-right:5px;">0</span>';
            btnExportSelected.onclick = () => window.app.exportSelectedReturns();
            exportExcelBtn.parentNode.insertBefore(btnExportSelected, exportExcelBtn.nextSibling);
        }

        if (!btnArchiveSelected && exportExcelBtn) {
            btnArchiveSelected = document.createElement('button');
            btnArchiveSelected.className = 'btn-pro-action';
            btnArchiveSelected.id = 'btn-archive-selected';
            btnArchiveSelected.style.background = 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)';
            btnArchiveSelected.style.borderColor = 'rgba(124, 58, 237, 0.5)';
            btnArchiveSelected.style.color = '#fff';
            btnArchiveSelected.innerHTML = '<i class="fas fa-archive"></i> نقل للأضابير <span id="archive-selected-badge" style="background:#4f46e5; color:white; border-radius:10px; padding:2px 6px; font-size:12px; margin-right:5px;">0</span>';
            btnArchiveSelected.onclick = () => window.app.archiveCurrentSelectionToAdabir();
            exportExcelBtn.parentNode.insertBefore(btnArchiveSelected, btnExportSelected ? btnExportSelected.nextSibling : exportExcelBtn.nextSibling);
        }

        // إنشاء زر إلغاء التحديد في الشريط العلوي إن لم يكن موجوداً
        if (!btnClearSelection && exportExcelBtn) {
            btnClearSelection = document.createElement('button');
            btnClearSelection.className = 'btn-pro-action';
            btnClearSelection.id = 'btn-clear-selection';
            btnClearSelection.style.background = 'linear-gradient(135deg, #475569 0%, #334155 100%)';
            btnClearSelection.style.borderColor = 'rgba(71, 85, 105, 0.5)';
            btnClearSelection.style.color = '#fff';
            btnClearSelection.innerHTML = '<i class="fas fa-times-circle"></i> إلغاء التحديد';
            btnClearSelection.onclick = () => window.app.clearSelection();
            exportExcelBtn.parentNode.insertBefore(btnClearSelection, exportExcelBtn.nextSibling);
        }

        const exportBadge = document.getElementById('export-selected-badge');
        const archiveBadge = document.getElementById('archive-selected-badge');

        if (this.isAllReturnsSelected || this.selectedReturnIds.size > 0) {
            // إظهار أزرار الإجراءات على المحدد في الشريط العلوي
            if (btnDeleteSelected) {
                btnDeleteSelected.style.display = 'inline-flex';
                btnDeleteSelected.onclick = () => window.app.bulkDeleteReturns();
            }
            if (countBadge) countBadge.innerText = count;

            if (btnExportSelected) {
                btnExportSelected.style.display = 'inline-flex';
                if (exportBadge) exportBadge.innerText = count;
            }
            if (btnArchiveSelected) {
                btnArchiveSelected.style.display = 'inline-flex';
                if (archiveBadge) archiveBadge.innerText = count;
            }

            if (btnClearSelection) {
                btnClearSelection.style.display = 'inline-flex';
            }

            if (exportExcelBtn) exportExcelBtn.style.display = 'none'; // إخفاء زر التصدير العادي

            // إزالة أي شريط سفلي عائم إن وجد
            const oldToolbar = document.getElementById('bulk-delete-toolbar');
            if (oldToolbar) oldToolbar.remove();

        } else {
            // إخفاء أزرار المحدد وإعادة الزر العادي
            if (btnDeleteSelected) btnDeleteSelected.style.display = 'none';
            if (btnExportSelected) btnExportSelected.style.display = 'none';
            if (btnArchiveSelected) btnArchiveSelected.style.display = 'none';
            if (btnClearSelection) btnClearSelection.style.display = 'none';
            if (exportExcelBtn) exportExcelBtn.style.display = 'inline-flex';
        }
    }

    exportSelectedReturns() {
        if (!this.isAllReturnsSelected && this.selectedReturnIds.size === 0) {
            this.showToast('لم يتم تحديد أي سجل للتصدير', 'warning');
            return;
        }

        this.showToast('جاري تحضير ملف التصدير...', 'info');

        // إذا كان التحديد للكل عبر الفلتر
        if (this.isAllReturnsSelected) {
            this.exportExcel();
            return;
        }

        // إذا كان التحديد جزئياً
        const selectedIdsArray = Array.from(this.selectedReturnIds).map(id => String(id));
        const selectedData = this.data.filter(row => selectedIdsArray.includes(String(row.id || row.Id)));

        if (selectedData.length === 0) {
             this.showToast('تعذر العثور على بيانات العناصر المحددة محلياً، تأكد من عرضها في الصفحة الحالية', 'error');
             return;
        }

        const worksheet = XLSX.utils.json_to_sheet(selectedData.map(row => {
            const cleanRow = {};
            this.headers.forEach(h => cleanRow[h] = row[h]);
            return cleanRow;
        }));

        const workbook = XLSX.utils.book_new();
        if (!worksheet['!views']) worksheet['!views'] = [];
        worksheet['!views'].push({ RTL: true });

        XLSX.utils.book_append_sheet(workbook, worksheet, 'المحدد');

        const filename = `المحدد_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(workbook, filename);

        this.showToast('تم تصدير المحدد بنجاح', 'success');
        this.clearSelection();
    }

    clearSelection() {
        this.selectedReturnIds.clear();
        this.isAllReturnsSelected = false;
        document.getElementById('select-all-filtered-banner')?.remove();
        const headerCheck = document.getElementById('select-all-returns');
        if (headerCheck) headerCheck.checked = false;

        const checkboxes = document.querySelectorAll('.return-row-checkbox');
        checkboxes.forEach(cb => cb.checked = false);

        this.updateBulkDeleteToolbar();
    }

    resetAllFilters() {
        console.log('[RESET] Resetting all filters...');

        // 1. Reset Incentive Filters
        this.searchQuery = '';
        this.filterValue = '';
        this.monthFilterValue = 'all';
        this.settlementFilterValue = 'all';
        this.returnStatusFilterValue = 'all';
        this.attachmentFilterValue = 'all';
        this.uploadDateFrom = '';
        this.uploadDateTo = '';
        this.paymentDateFilterValue = 'all';

        const els = {
            'table-search': '',
            'attachment-status-filter': 'all',
            'return-status-filter': 'all',
            'settlement-filter': 'all',
            'upload-date-filter': 'all',
            'month-filter': 'all',
            'payment-date-filter': 'all'
        };
        for (const [id, val] of Object.entries(els)) {
            const el = document.getElementById(id);
            if (el) el.value = val;
        }

        // 2. Reset Salary Filters
        this.salarySearchQuery = '';
        this.salaryMonthFilterValue = 'all';
        this.salarySettlementFilterValue = 'all';
        this.salaryReturnStatusFilterValue = 'all';
        this.salaryAttachmentFilterValue = 'all';
        this.salaryUploadDateFrom = '';
        this.salaryUploadDateTo = '';

        const sEls = {
            'salary-search': '',
            'salary-attachment-filter': 'all',
            'salary-return-status-filter': 'all',
            'salary-settlement-filter': 'all',
            'salary-upload-date-filter': 'all',
            'salary-month-filter': 'all'
        };
        for (const [id, val] of Object.entries(sEls)) {
            const el = document.getElementById(id);
            if (el) el.value = val;
        }

        this.clearSelection();
        this.clearSalarySelection();

        // Refresh based on current page
        if (this.currentPage === 'returns') this.loadReturns(1);
        if (this.currentPage === 'salary-returns') this.loadSalaryReturns(1);
    }

    // Salary Returns Selection Methods
    toggleSalaryReturnSelection(id, checked) {
        if (checked) {
            this.selectedSalaryReturnIds.add(String(id));
        } else {
            this.selectedSalaryReturnIds.delete(String(id));
            this.isAllSalaryReturnsSelected = false;
        }
        this.updateBulkSalaryDeleteToolbar();

        const headerCheck = document.getElementById('select-all-salary-returns');
        const checkboxes = document.querySelectorAll('.salary-row-checkbox');
        const checkedBoxes = document.querySelectorAll('.salary-row-checkbox:checked');
        if (headerCheck) {
             headerCheck.checked = (checkboxes.length > 0 && checkboxes.length === checkedBoxes.length);
        }
    }

    toggleSelectAllSalaryReturns(checked) {
        document.getElementById('select-all-salary-filtered-banner')?.remove();

        this.isAllSalaryReturnsSelected = false;
        this.selectedSalaryReturnIds.clear();

        const checkboxes = document.querySelectorAll('.salary-row-checkbox');
        checkboxes.forEach(cb => cb.checked = checked);

        if (checked) {
            checkboxes.forEach(cb => this.selectedSalaryReturnIds.add(String(cb.value)));

            const visibleCount = checkboxes.length;
            const totalCount = this.salaryPagination?.total || 0;

            if (totalCount > visibleCount) {
                this._showSelectAllSalaryFilteredBanner(visibleCount, totalCount);
            } else {
                this.isAllSalaryReturnsSelected = true;
            }
        }

        this.updateBulkSalaryDeleteToolbar();

        const selectAllCb = document.getElementById('select-all-salary-returns');
        if (selectAllCb) selectAllCb.checked = checked;
    }

    _showSelectAllSalaryFilteredBanner(visibleCount, totalCount) {
        document.getElementById('select-all-salary-filtered-banner')?.remove();

        const banner = document.createElement('div');
        banner.id = 'select-all-salary-filtered-banner';
        banner.className = 'selection-banner animated slideInDown';
        banner.style.cssText = `
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(0, 240, 255, 0.2);
            padding: 12px 20px;
            margin: 10px 0;
            border-radius: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #fff;
            font-size: 0.9rem;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        `;

        banner.innerHTML = `
            <div>
                <i class="fas fa-info-circle" style="color: #00f0ff; margin-left: 8px;"></i>
                تم تحديد <strong>${visibleCount}</strong> سجل في هذه الصفحة.
                <button onclick="app.selectAllSalaryFiltered(${totalCount})" style="background: none; border: none; color: #00f0ff; font-weight: bold; cursor: pointer; text-decoration: underline; margin-right: 10px;">
                    تحديد كافة الـ ${totalCount.toLocaleString()} سجل المطابقة للفلتر؟
                </button>
            </div>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: #94a3b8; cursor: pointer;">✕</button>
        `;

        const salaryControls = document.querySelector('#page-salary-returns .dashboard-controls-row-pro');
        if (salaryControls) {
            salaryControls.after(banner);
        }
    }

    selectAllSalaryFiltered(total) {
        this.isAllSalaryReturnsSelected = true;
        const banner = document.getElementById('select-all-salary-filtered-banner');
        if (banner) {
            banner.innerHTML = `
                <div style="width: 100%; text-align: center;">
                    <i class="fas fa-check-circle" style="color: #10b981; margin-left: 8px;"></i>
                    تم تحديد كافة الـ <strong>${total.toLocaleString()}</strong> سجل بنجاح.
                    <button onclick="app.clearSalarySelection()" style="background: none; border: none; color: #f87171; font-weight: bold; cursor: pointer; text-decoration: underline; margin-right: 15px;">
                        إلغاء التحديد
                    </button>
                </div>
            `;
        }
        this.updateBulkSalaryDeleteToolbar();
    }

    clearSalarySelection() {
        this.selectedSalaryReturnIds.clear();
        this.isAllSalaryReturnsSelected = false;
        this.updateBulkSalaryDeleteToolbar();

        const selectAllCb = document.getElementById('select-all-salary-returns');
        if (selectAllCb) selectAllCb.checked = false;

        const checkboxes = document.querySelectorAll('.salary-row-checkbox');
        checkboxes.forEach(cb => cb.checked = false);

        document.getElementById('select-all-salary-filtered-banner')?.remove();
    }

    updateBulkSalaryDeleteToolbar() {
        const totalFiltered = this.salaryPagination?.total || 0;
        const count = this.isAllSalaryReturnsSelected
            ? `كافة (${totalFiltered.toLocaleString()})`
            : this.selectedSalaryReturnIds.size;

        const btnDeleteSelected = document.getElementById('btn-salary-delete-selected');
        const btnSettleSelected = document.getElementById('btn-salary-settle-selected');
        const countBadge = document.getElementById('salary-selected-count-badge');
        const settleBadge = document.getElementById('salary-settle-selected-count-badge');

        let btnExportSelected = document.getElementById('btn-salary-export-selected');
        let btnArchiveSelected = document.getElementById('btn-salary-archive-selected');
        let btnClearSelection = document.getElementById('btn-salary-clear-selection');
        const exportExcelBtn = document.querySelector('#page-salary-returns .btn-export-pro[onclick="app.exportSalaryToExcel()"]');

        // إنشاء زر تصدير المحدد إن لم يكن موجوداً
        if (!btnExportSelected && exportExcelBtn) {
            btnExportSelected = document.createElement('button');
            btnExportSelected.className = 'btn-pro-action btn-export-pro';
            btnExportSelected.id = 'btn-salary-export-selected';
            btnExportSelected.style.background = 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)';
            btnExportSelected.style.borderColor = 'rgba(14, 165, 233, 0.5)';
            btnExportSelected.innerHTML = '<i class="fas fa-file-export"></i> تصدير المحدد <span id="salary-export-selected-badge" style="background:#0284c7; color:white; border-radius:10px; padding:2px 6px; font-size:12px; margin-right:5px;">0</span>';
            btnExportSelected.onclick = () => window.app.exportSelectedSalaryReturns();
            exportExcelBtn.parentNode.insertBefore(btnExportSelected, exportExcelBtn.nextSibling);
        }

        if (!btnArchiveSelected && exportExcelBtn) {
            btnArchiveSelected = document.createElement('button');
            btnArchiveSelected.className = 'btn-pro-action';
            btnArchiveSelected.id = 'btn-salary-archive-selected';
            btnArchiveSelected.style.background = 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)';
            btnArchiveSelected.style.borderColor = 'rgba(124, 58, 237, 0.5)';
            btnArchiveSelected.style.color = '#fff';
            btnArchiveSelected.innerHTML = '<i class="fas fa-archive"></i> نقل للأضابير <span id="salary-archive-selected-badge" style="background:#4f46e5; color:white; border-radius:10px; padding:2px 6px; font-size:12px; margin-right:5px;">0</span>';
            btnArchiveSelected.onclick = () => window.app.archiveCurrentSelectionToAdabir();
            exportExcelBtn.parentNode.insertBefore(btnArchiveSelected, btnExportSelected ? btnExportSelected.nextSibling : exportExcelBtn.nextSibling);
        }

        // إنشاء زر إلغاء التحديد إن لم يكن موجوداً
        if (!btnClearSelection && exportExcelBtn) {
            btnClearSelection = document.createElement('button');
            btnClearSelection.className = 'btn-pro-action';
            btnClearSelection.id = 'btn-salary-clear-selection';
            btnClearSelection.style.background = 'linear-gradient(135deg, #475569 0%, #334155 100%)';
            btnClearSelection.style.borderColor = 'rgba(71, 85, 105, 0.5)';
            btnClearSelection.style.color = '#fff';
            btnClearSelection.innerHTML = '<i class="fas fa-times-circle"></i> إلغاء التحديد';
            btnClearSelection.onclick = () => window.app.clearSalarySelection();
            exportExcelBtn.parentNode.insertBefore(btnClearSelection, exportExcelBtn.nextSibling);
        }

        const exportBadge = document.getElementById('salary-export-selected-badge');
        const archiveBadge = document.getElementById('salary-archive-selected-badge');

        if (this.isAllSalaryReturnsSelected || this.selectedSalaryReturnIds.size > 0) {
            if (btnDeleteSelected) {
                btnDeleteSelected.style.display = 'inline-flex';
                btnDeleteSelected.onclick = () => window.app.confirmBulkDeleteSalary();
            }
            if (btnSettleSelected) {
                btnSettleSelected.style.display = 'inline-flex';
            }
            if (countBadge) countBadge.innerText = count;
            if (settleBadge) settleBadge.innerText = count;

            if (btnExportSelected) {
                btnExportSelected.style.display = 'inline-flex';
                if (exportBadge) exportBadge.innerText = count;
            }
            if (btnArchiveSelected) {
                btnArchiveSelected.style.display = 'inline-flex';
                if (archiveBadge) archiveBadge.innerText = count;
            }

            if (btnClearSelection) btnClearSelection.style.display = 'inline-flex';
            if (exportExcelBtn) exportExcelBtn.style.display = 'none';

        } else {
            if (btnDeleteSelected) btnDeleteSelected.style.display = 'none';
            if (btnSettleSelected) btnSettleSelected.style.display = 'none';
            if (btnExportSelected) btnExportSelected.style.display = 'none';
            if (btnArchiveSelected) btnArchiveSelected.style.display = 'none';
            if (btnClearSelection) btnClearSelection.style.display = 'none';
            if (exportExcelBtn) exportExcelBtn.style.display = 'inline-flex';
        }
    }

    async confirmBulkDeleteSalary() {
        const count = this.isAllSalaryReturnsSelected ? 'كافة السجلات المطابقة للفلتر' : `${this.selectedSalaryReturnIds.size} سجل`;
        if (!await confirm(`هل أنت متأكد من حذف ${count} من مرتجعات المرتبات؟ هذه العملية لا يمكن التراجع عنها.`)) return;

        await this.bulkDeleteSalaryReturns();
    }

    async bulkDeleteSalaryReturns() {
        this.showLoading();
        try {
            const request = {
                ids: this.isAllSalaryReturnsSelected ? null : Array.from(this.selectedSalaryReturnIds),
                deleteAllFiltered: this.isAllSalaryReturnsSelected,
                search: this.salarySearchQuery,
                attachmentStatus: this.salaryAttachmentFilterValue,
                uploadFrom: this.salaryUploadDateFrom,
                uploadTo: this.salaryUploadDateTo,
                settlementFilter: this.salarySettlementFilterValue,
                returnStatus: this.salaryReturnStatusFilterValue,
                monthFilter: this.salaryMonthFilterValue,
                paymentDateFilter: this.salaryPaymentDateFilterValue
            };

            const response = await db.fetchApi('/salary-returns/bulk-delete', {
                method: 'POST',
                body: JSON.stringify(request)
            });

            if (response.success) {
                this.showToast('تم حذف السجلات بنجاح', 'success');
                this.clearSalarySelection();
                await this.loadSalaryReturns(1);
            } else {
                throw new Error(response.message || 'فشل حذف السجلات');
            }
        } catch (e) {
            console.error('Bulk Delete Salary Error:', e);
            this.showToast(e.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    exportSelectedSalaryReturns() {
        if (!this.isAllSalaryReturnsSelected && this.selectedSalaryReturnIds.size === 0) {
            this.showToast('لم يتم تحديد أي سجل للتصدير', 'warning');
            return;
        }

        this.showToast('جاري تحضير ملف التصدير...', 'info');

        if (this.isAllSalaryReturnsSelected) {
            this.exportSalaryToExcel();
            return;
        }

        const selectedIdsArray = Array.from(this.selectedSalaryReturnIds).map(id => String(id));
        const selectedData = this.salaryReturnsData.filter(row => selectedIdsArray.includes(String(row.id || row.Id)));

        if (selectedData.length === 0) {
             this.showToast('تعذر العثور على بيانات العناصر المحددة محلياً، تأكد من عرضها في الصفحة الحالية', 'error');
             return;
        }

        const headersToExport = this._displaySalaryHeaders || this.salaryHeaders;
        const worksheetData = [headersToExport];
        selectedData.forEach(row => {
            const rowArray = headersToExport.map(h => row[h] === null || row[h] === undefined ? '' : row[h]);
            worksheetData.push(rowArray);
        });

        const ws = XLSX.utils.aoa_to_sheet(worksheetData);
        if (!ws['!views']) ws['!views'] = [];
        ws['!views'].push({ RTL: true });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "المرتبات_المحددة");

        const fileName = `مرتادات_مرتبات_محددة_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);

        this.showToast('تم تصدير البيانات بنجاح', 'success');
    }

    _showSelectAllFilteredBanner(visibleCount, totalCount) {
        document.getElementById('select-all-filtered-banner')?.remove();

        const banner = document.createElement('div');
        banner.id = 'select-all-filtered-banner';
        banner.className = 'select-all-filtered-banner';
        banner.innerHTML = `
            <div class="safb-content">
                <span class="safb-icon">☑️</span>
                <span class="safb-text">
                    تم تحديد <strong>${visibleCount.toLocaleString()}</strong> سجل من الصفحة الحالية.
                    يوجد <strong>${totalCount.toLocaleString()}</strong> سجل مطابق للفلتر.
                </span>
                <button class="safb-btn-select-all" onclick="window.app.selectAllFiltered()">
                    ✅ تحديد كافة ${totalCount.toLocaleString()} سجل
                </button>
                <button class="safb-btn-close" onclick="document.getElementById('select-all-filtered-banner')?.remove()" title="إغلاق">✖</button>
            </div>
        `;

        // إدراج البنر في body مباشرة بـ position fixed لضمان الظهور
        document.body.appendChild(banner);
    }

    selectAllFiltered() {
        this.isAllReturnsSelected = true;
        this.selectedReturnIds.clear();
        document.getElementById('select-all-filtered-banner')?.remove();

        // تحديث checkboxes المرئية
        document.querySelectorAll('.return-row-checkbox').forEach(cb => cb.checked = true);
        const headerCheck = document.getElementById('select-all-returns');
        if (headerCheck) headerCheck.checked = true;

        this.updateBulkDeleteToolbar();
        const total = (this.totalFilteredCount || 0).toLocaleString();
        this.showToast(`✅ تم تحديد كافة ${total} سجل المطابقة للفلتر`, 'success');
    }

    async bulkDeleteReturns() {
        if (!this.canDeleteReturns()) {
            this.showToast('ليس لديك صلاحية حذف هذه البيانات', 'error');
            return;
        }
        const count = this.isAllReturnsSelected ? 'كافة السجلات المطابقة للفلاتر' : this.selectedReturnIds.size + ' سجل';
        if (!await confirm(`هل أنت متأكد من رغبتك في حذف ${count}؟ لا يمكن التراجع عن هذه العملية.`)) return;

        try {
            this.showLoading();
            const payload = {
                Ids: Array.from(this.selectedReturnIds).map(id => parseInt(id)),
                DeleteAllFiltered: this.isAllReturnsSelected,
                Search: this.searchQuery,
                Filter: this.filterValue,
                FilterId: this.currentFilterId,
                AttachmentStatus: this.attachmentFilterValue,
                ReturnStatus: this.returnStatusFilterValue !== 'all' ? this.returnStatusFilterValue : null,
                Settlement: this.settlementFilterValue !== 'all' ? this.settlementFilterValue : null,
                MonthFilter: this.monthFilterValue !== 'all' ? this.monthFilterValue : null,
                UploadDateFrom: this.uploadDateFrom || document.getElementById('upload-date-filter')?.value,
                UploadDateTo: this.uploadDateTo || document.getElementById('upload-date-filter')?.value,
                Min: this.minAmount,
                Max: this.maxAmount,
                TargetColumn: this.targetColumn
            };

            const result = await db.fetchApi('/returns/bulk-delete', {
                method: 'POST',
                __skipLoadingWrapper: true,
                __suppressErrorLog: true,
                body: JSON.stringify(payload)
            });

            if (result.success) {
                this.showToast(`تم حذف ${result.count} سجل بنجاح`, 'success');
                this.clearSelection();
                this.loadReturns(); // Refresh table
            } else {
                this.showToast('حدث خطأ أثناء الحذف المجمع', 'error');
            }
        } catch (error) {
            if (error?.status === 403) this.showDeleteForbidden(error);
            else {
                console.error('Bulk Delete Error:', error);
                this.showToast('فشل الاتصال بالخادم', 'error');
            }
        } finally {
            this.hideLoading();
        }
    }

renderTable(dataToRender = null, append = false) {
        const data = dataToRender || this.data;
        const tableHeaders = document.getElementById('table-headers');
        const tableBody = document.getElementById('table-body');
        const emptyState = document.getElementById('empty-state');

        if (!append) {
            if (this.data.length === 0) {
                tableHeaders.innerHTML = '';
                tableBody.innerHTML = '';
                emptyState.classList.remove('hidden');
                return;
            }
            emptyState.classList.add('hidden');

            // الترتيب الصارم والنهائي للأعمدة ليتطابق مع الصورة تماماً
            const finalOrder = [
                'CHECKBOX',
                '#',
                'كود الملف',
                'الشهر',
                'الاسم',
                'الرقم القومي',
                'رقم الحساب',
                'البنك',
                'قيمة العملية',
                'الحالة',
                'السبب',
                'رقم الحساب بعد التعديل',
                'البنك بعد التعديل',
                'كود الفرع بعد التعديل',
                'تاريخ الرفع',
                'رقم تسوية التعلية',
                'تاريخ المرتد / تاريخ التعلية',
                'تاريخ اعتماد المرتدات',
                'تاريخ التعديل',
                'تاريخ اعتماد التعديل',
                'رقم تسوية السداد',
                'تاريخ اعتماد التعديل / تاريخ السداد',
                'حالة التسوية'
            ];

            this._displayHeaders = finalOrder;


            tableHeaders.innerHTML = finalOrder.map((h, idx) => {
                if (h === 'CHECKBOX') {
                    return `<th class="sticky-seq" style="text-align: center !important;"><input type="checkbox" id="select-all-returns" onclick="window.app.toggleSelectAllReturns(this.checked)"></th>`;
                }

                const hNorm = h.replace(/ـ/g, '').replace(/[أإآ]/g, 'ا').toLowerCase();
                const isNameCol = hNorm.includes('الاسم') || hNorm.includes('name') || hNorm.includes('fullname');

                let isSticky = '';
                let extraStyles = h === '#' ? 'text-align: center !important;' : '';

                // التثبيت الدقيق للأعمدة كي لا تكون شفافة وتكون مصفوفة صحيحة
                if (h === '#') isSticky = 'sticky-seq';
                else if (isNameCol) isSticky = 'sticky-name';
                else if (h.includes('قيمة العملية') || h.includes('المبلغ')) isSticky = 'sticky-amount';

                let dynamicClass = '';
                if (h.includes('تاريخ') || h.includes('Date')) dynamicClass = 'col-date';
                if (h.includes('قيمة') || h.includes('المبلغ')) dynamicClass = 'col-amount';
                if (isNameCol) dynamicClass = 'col-name';

                return `<th class="${isSticky} ${dynamicClass}" style="${extraStyles}">${h}</th>`;
            }).join('') + '<th class="col-actions" style="text-align:center;">الإجراءات</th>';
            tableBody.innerHTML = '';

            // Re-attach scroll listener on fresh render
            this.setupInfiniteScroll();
        }

        // تحسين الأداء: تجهيز التعبير النمطي مرة واحدة للرندر بالكامل
        let searchRegex = null;
        if (this.currentSearch && String(this.currentSearch).trim().length > 0) {
            const normalizedQuery = this.normalizeArabic(this.currentSearch);
            const words = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
            if (words.length > 0) {
                // Escape special regex chars and join with OR
                const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                searchRegex = new RegExp(`(${pattern})`, 'gi');
            }
        }

        const previousRowCount = append ? (document.getElementById('table-body')?.querySelectorAll('tr').length || 0) : 0;
        const rowsHTML = data.map((row, rowIndex) => {
            const rowId = row.id || row.Id;

            const cells = (this._displayHeaders || this.headers).map((h, i) => {
                if (h === 'CHECKBOX') {
                    const isChecked = this.isAllReturnsSelected || this.selectedReturnIds.has(String(rowId));
                    return `<td class="sticky-seq col-checkbox" style="text-align: center !important;"><input type="checkbox" class="return-row-checkbox" value="${rowId}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); window.app.toggleSelectReturn('${rowId}')"></td>`;
                }

                const cell = this.getSalaryCellValue(row, h, rowIndex, { offset: previousRowCount });
                let val = cell.html;
                let rawVal = cell.raw;

                // تحسين أداء تمييز النص (Highlighting): فقط للنصوص التي لا تحتوي على وسوم HTML مسبقاً
                if (searchRegex && h !== '#' && !h.includes('<input') && h !== 'حالة التسوية') {
                    if (rawVal && rawVal.length < 500 && !String(val).includes('<')) {
                        val = String(rawVal).replace(searchRegex, '<span class="search-highlight">$1</span>');
                    }
                }

                const hNorm = h.replace(/ـ/g, '').replace(/[أإآ]/g, 'ا').toLowerCase();
                const isNameCol = hNorm.includes('الاسم') || hNorm.includes('name') || hNorm.includes('fullname');

                let isSticky = '';
                let extraStyles = h === '#' ? 'text-align: center !important;' : '';
                let dblclickEvent = '';

                if (h === '#') isSticky = 'sticky-seq';
                else if (isNameCol) {
                    isSticky = 'sticky-name';
                    if (rawVal && rawVal.trim() !== '') {
                        const escapedVal = String(rawVal).replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        dblclickEvent = ` ondblclick="window.app.triggerNameSearch('${escapedVal}')" title="انقر مرتين للبحث السريع عن هذا الاسم" style="cursor: pointer;"`;
                    }
                }
                else if (h.includes('قيمة العملية') || h.includes('المبلغ')) isSticky = 'sticky-amount';

                // Smart Dynamic Sizing Class
                let dynamicClass = '';
                if (rawVal.length > 50) dynamicClass = 'wrap-content';
                if (h.includes('تاريخ') || h.includes('Date')) dynamicClass += ' col-date';
                if (h.includes('قيمة') || h.includes('المبلغ')) dynamicClass += ' col-amount';
                if (h.includes('<input')) dynamicClass += ' col-checkbox';
                if (h === '#') dynamicClass += ' col-id';
                if (isNameCol) {
                    dynamicClass += ' col-name clickable-name';
                }

                return `<td class="${isSticky} ${dynamicClass}" style="${extraStyles}"${dblclickEvent}>${val}</td>`;
            }).join('');

            const hasAttachments = row.AttachmentCount > 0;
            const btnClass = hasAttachments ? 'btn-primary' : 'btn-secondary';
            const icon = hasAttachments ? '🖼️' : '📎';
            // Badge: always visible red circle if count > 0 with pulse animation
            const badge = hasAttachments ? `<span class="badge-count" style="background:#ef4444; color:white; border-radius:12px; padding:2px 8px; font-size:0.75em; position:absolute; top:-12px; right:-12px; font-weight:bold; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4); border: 1.5px solid #fff;">${row.AttachmentCount}</span>` : '';
            // Style: Cyan Glow for buttons with attachments
            const style = hasAttachments ? 'position: relative; border: 1px solid #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.5); transform: scale(1.05); transition: all 0.2s ease;' : 'position: relative; opacity: 0.6;';

            const deleteButton = this.canDeleteReturns()
                ? `<button class="btn-icon" style="color: #f87171;" onclick="window.app.deleteReturn('${rowId}')" title="حذف السجل">🗑️</button>`
                : '';
            const actions = `<td class="col-actions" style="text-align:center; white-space: nowrap;">
            <button class="btn-icon ${btnClass}" style="margin-left:5px; ${style}" onclick="window.app.openAttachmentsModal('${rowId}', 'returns')" title="${hasAttachments ? 'عرض ' + row.AttachmentCount + ' مرفقات' : 'إضافة مرفق'}">
                ${icon} ${badge}
            </button>
            <button class="btn-icon" style="margin-left:5px;" onclick="window.app.editReturn('${rowId}')" title="تعديل السجل">✏️</button>
            <button class="btn-icon" style="margin-left:5px;" onclick="window.app.openReturnFolder('${rowId}')" title="فتح مجلد المرفقات">📂</button>
            ${deleteButton}
        </td>`;

            return `<tr>${cells}${actions}</tr>`;
        }).join('');

        if (append) {
            tableBody.insertAdjacentHTML('beforeend', rowsHTML);
        } else {
            tableBody.innerHTML = rowsHTML;
        }
    }

    setupInfiniteScroll(selector = '.table-wrapper-scroll') {
        const tableScroll = document.querySelector(selector);
        if (!tableScroll || tableScroll.dataset.listenerAttached) return;

        console.log(`Infinite Scroll: Listener attached to ${selector}`);
        let lastScrollTop = 0;

        tableScroll.addEventListener('scroll', () => {
            const scrollTop = tableScroll.scrollTop;

            if (Math.abs(scrollTop - lastScrollTop) < 2) return;
            lastScrollTop = scrollTop;

            if (this.isLoadingMore) return;

            if (scrollTop + tableScroll.clientHeight >= tableScroll.scrollHeight - 150) {
                if (this.pagination && this.pagination.currentPage < this.pagination.totalPages) {
                    console.log('Infinite Scroll: Loading next page...');
                    this.isLoadingMore = true;
                    this.loadReturns(this.pagination.currentPage + 1, 100, this.currentSearch, this.currentFilter, null, true)
                        .finally(() => {
                            this.isLoadingMore = false;
                        });
                }
            }
        });
        tableScroll.dataset.listenerAttached = 'true';
    }

    setupSalaryInfiniteScroll() {
        const selector = '#page-salary-returns .table-wrapper-scroll';
        const tableScroll = document.querySelector(selector);
        if (!tableScroll || tableScroll.dataset.listenerAttached) return;

        console.log('Salary Infinite Scroll: Listener attached');
        let lastScrollTop = 0;

        tableScroll.addEventListener('scroll', () => {
            const scrollTop = tableScroll.scrollTop;
            if (Math.abs(scrollTop - lastScrollTop) < 2) return;
            lastScrollTop = scrollTop;

            if (this.isSalaryLoadingMore) return;

            if (scrollTop + tableScroll.clientHeight >= tableScroll.scrollHeight - 200) {
                if (this.salaryPagination && this.salaryPagination.currentPage < this.salaryPagination.totalPages) {
                    console.log('Salary Infinite Scroll: Loading next page...');
                    this.isSalaryLoadingMore = true;
                    this.loadSalaryReturns(this.salaryPagination.currentPage + 1, 200, this.salarySearchQuery, true)
                        .finally(() => {
                            this.isSalaryLoadingMore = false;
                        });
                }
            }
        });
        tableScroll.dataset.listenerAttached = 'true';
    }

    getDashboardFilters() {
        const value = id => document.getElementById(id)?.value?.trim() || '';
        return {
            fromDate: value('dash-filter-from'),
            toDate: value('dash-filter-to'),
            month: value('dash-filter-month'),
            source: value('dash-filter-source') || 'all',
            status: value('dash-filter-status') || 'all'
        };
    }

    dashboardQuery(extra = {}) {
        const params = new URLSearchParams();
        const filters = { ...this.getDashboardFilters(), ...extra };
        Object.entries(filters).forEach(([key, value]) => {
            if (value && value !== 'all') params.set(key, value);
        });
        return params.toString();
    }

    setDashboardState(type, message) {
        const state = document.getElementById('dashboard-state');
        if (!state) return;
        state.className = `dashboard-state ${type || ''}`;
        state.textContent = message || '';
        state.classList.toggle('hidden', !message);
    }

    async loadDashboard() {
        if (this._dashboardLoading) return;
        this._dashboardLoading = true;
        const localDashboard = this.buildLocalDashboardData?.();
        if (localDashboard) {
            this.dashboardSummary = localDashboard.summary || {};
            this.dashboardCharts = localDashboard.charts || {};
            this.renderDashboardSummary(this.dashboardSummary);
            this.renderDashboardCharts(this.dashboardCharts);
            this.setDashboardState('info', 'تم عرض لوحة التحكم من النسخة المحلية، ويتم تحديثها في الخلفية.');
            this._dashboardLoading = false;
            this.refreshDashboardFromServer?.();
            return;
        }
        this.setDashboardState('loading', 'جاري تحميل بيانات لوحة التحكم...');
        try {
            const query = this.dashboardQuery();
            const [summaryResponse, chartsResponse] = await Promise.all([
                db.fetchApi(`/api/dashboard/summary?${query}`, { timeout: 6000, __suppressErrorLog: true }),
                db.fetchApi(`/api/dashboard/charts?${query}`, { timeout: 6000, __suppressErrorLog: true })
            ]);
            this.dashboardSummary = summaryResponse.summary || {};
            this.dashboardCharts = chartsResponse.charts || {};
            this.renderDashboardSummary(this.dashboardSummary);
            this.renderDashboardCharts(this.dashboardCharts);
            this.setDashboardState('', '');
        } catch (e) {
            console.error('[Dashboard] Failed to load:', e);
            this.setDashboardState('error', 'تعذر تحميل لوحة التحكم. تحقق من اتصال قاعدة البيانات.');
        } finally {
            this._dashboardLoading = false;
        }
    }

    renderDashboardSummary(summary) {
        const container = document.getElementById('dashboard-summary-cards');
        if (!container) return;
        const cards = [
            { title: 'إجمالي سجلات المرتبات', value: summary.salaryCount, metric: 'salary', icon: 'fa-money-check-alt' },
            { title: 'إجمالي سجلات الحوافز', value: summary.incentiveCount, metric: 'incentive', icon: 'fa-file-invoice' },
            { title: 'إجمالي المبالغ', value: this.formatDashboardAmount(summary.totalAmount), metric: 'all', icon: 'fa-coins' },
            { title: 'إجمالي المسدد', value: this.formatDashboardAmount(summary.paidAmount), metric: 'paid', icon: 'fa-check-circle' },
            { title: 'إجمالي المعلّى', value: this.formatDashboardAmount(summary.accruedAmount), metric: 'accrued', icon: 'fa-level-up-alt' },
            { title: 'تحت التسوية', value: this.formatDashboardAmount(summary.pendingAmount), sub: `${this.formatDashboardNumber(summary.pendingCount)} سجل`, metric: 'unsettled', icon: 'fa-hourglass-half' },
            { title: 'تم التسوية', value: this.formatDashboardNumber(summary.settledCount), metric: 'settled', icon: 'fa-clipboard-check' },
            { title: 'Returned', value: this.formatDashboardNumber(summary.returnedCount), metric: 'returned', icon: 'fa-undo-alt' },
            { title: 'Rejected', value: this.formatDashboardNumber(summary.rejectedCount), metric: 'rejected', icon: 'fa-ban' },
            { title: 'إجمالي الأضابير', value: this.formatDashboardNumber(summary.archiveCount), metric: 'archives', icon: 'fa-archive' },
            { title: 'عدد سجلات اليوم', value: this.formatDashboardNumber(summary.todayCount), metric: 'today', icon: 'fa-calendar-day' },
            { title: 'عدد سجلات هذا الشهر', value: this.formatDashboardNumber(summary.thisMonthCount), metric: 'thismonth', icon: 'fa-calendar-alt' }
        ];

        container.innerHTML = cards.map(card => `
            <button class="dashboard-card" type="button" onclick="app.openDashboardReport('${card.metric}')">
                <span class="dashboard-card-icon"><i class="fas ${card.icon}"></i></span>
                <span class="dashboard-card-body">
                    <span class="dashboard-card-title">${card.title}</span>
                    <span class="dashboard-card-value">${card.value ?? 0}</span>
                    ${card.sub ? `<span class="dashboard-card-sub">${card.sub}</span>` : ''}
                </span>
            </button>
        `).join('');
    }

    renderDashboardCharts(charts) {
        const container = document.getElementById('dashboard-charts');
        if (!container) return;
        container.innerHTML = `
            ${this.renderDonutChart('Returned vs Rejected', charts.returnedRejected || [])}
            ${this.renderGroupedBarsChart('المرتبات vs الحوافز حسب الشهر', charts.sourceByMonth || [])}
            ${this.renderLineChart('إجمالي المبالغ حسب الشهر', charts.amountByMonth || [])}
            ${this.renderSimpleBarsChart('المسدد / المعلّى / تحت التسوية', charts.settlement || [], true)}
            ${this.renderSimpleBarsChart('الأضابير حسب المصدر', charts.archives || [], false)}
        `;
    }

    renderDonutChart(title, data) {
        const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
        const returned = Number(data.find(x => x.metric === 'returned')?.value || 0);
        const rejected = Number(data.find(x => x.metric === 'rejected')?.value || 0);
        const returnedPct = total ? Math.round((returned / total) * 100) : 0;
        return `
            <div class="dashboard-chart-card">
                <div class="dashboard-chart-title">${title}</div>
                <div class="dashboard-donut-wrap">
                    <button class="dashboard-donut" style="--returned:${returnedPct};" onclick="app.openDashboardReport('returned')" title="Returned">
                        <span>${this.formatDashboardNumber(total)}</span>
                        <small>سجل</small>
                    </button>
                    <div class="dashboard-chart-legend">
                        <button onclick="app.openDashboardReport('returned')"><span class="legend-dot returned"></span>Returned: ${this.formatDashboardNumber(returned)}</button>
                        <button onclick="app.openDashboardReport('rejected')"><span class="legend-dot rejected"></span>Rejected: ${this.formatDashboardNumber(rejected)}</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderGroupedBarsChart(title, data) {
        const max = Math.max(1, ...data.map(x => Math.max(Number(x.salary || 0), Number(x.incentive || 0))));
        const items = data.length ? data : [{ month: 'لا توجد بيانات', salary: 0, incentive: 0 }];
        return `
            <div class="dashboard-chart-card">
                <div class="dashboard-chart-title">${title}</div>
                <div class="dashboard-group-bars">
                    ${items.map(item => `
                        <div class="dashboard-group-item">
                            <div class="dashboard-group-columns">
                                <button class="bar salary" style="height:${Math.max(4, (Number(item.salary || 0) / max) * 120)}px" onclick="app.openDashboardReport('salary')" title="المرتبات: ${item.salary || 0}"></button>
                                <button class="bar incentive" style="height:${Math.max(4, (Number(item.incentive || 0) / max) * 120)}px" onclick="app.openDashboardReport('incentive')" title="الحوافز: ${item.incentive || 0}"></button>
                            </div>
                            <span>${item.month}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="dashboard-chart-legend inline">
                    <button onclick="app.openDashboardReport('salary')"><span class="legend-dot salary"></span>المرتبات</button>
                    <button onclick="app.openDashboardReport('incentive')"><span class="legend-dot incentive"></span>الحوافز</button>
                </div>
            </div>
        `;
    }

    renderLineChart(title, data) {
        const width = 520;
        const height = 180;
        const values = data.map(x => Number(x.value || 0));
        const max = Math.max(1, ...values);
        const points = data.length ? data.map((item, index) => {
            const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
            const y = height - ((Number(item.value || 0) / max) * (height - 20)) - 10;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ') : '';
        return `
            <div class="dashboard-chart-card wide">
                <div class="dashboard-chart-title">${title}</div>
                <svg class="dashboard-line-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" onclick="app.openDashboardReport('all')">
                    <polyline points="${points}" fill="none" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
                    ${data.map((item, index) => {
                        const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
                        const y = height - ((Number(item.value || 0) / max) * (height - 20)) - 10;
                        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#22c55e"><title>${item.month}: ${this.formatDashboardAmount(item.value)}</title></circle>`;
                    }).join('')}
                </svg>
                <div class="dashboard-axis-labels">${data.slice(-8).map(x => `<span>${x.month}</span>`).join('')}</div>
            </div>
        `;
    }

    renderSimpleBarsChart(title, data, showAmount) {
        const max = Math.max(1, ...data.map(x => Number(showAmount ? (x.amount || x.value || 0) : (x.value || 0))));
        const items = data.length ? data : [{ label: 'لا توجد بيانات', value: 0, amount: 0, metric: 'all' }];
        return `
            <div class="dashboard-chart-card">
                <div class="dashboard-chart-title">${title}</div>
                <div class="dashboard-simple-bars">
                    ${items.map(item => {
                        const raw = Number(showAmount ? (item.amount || item.value || 0) : (item.value || 0));
                        const metric = item.metric || 'all';
                        return `
                            <button class="dashboard-simple-bar" onclick="app.openDashboardReport('${metric}')">
                                <span class="bar-label">${item.label}</span>
                                <span class="bar-track"><span style="width:${Math.max(3, (raw / max) * 100)}%"></span></span>
                                <span class="bar-value">${showAmount ? this.formatDashboardAmount(raw) : this.formatDashboardNumber(raw)}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    async openDashboardReport(metric) {
        try {
            this.setDashboardState('loading', 'جاري تجهيز التقرير...');
            const report = await db.fetchApi(`/api/dashboard/report?${this.dashboardQuery({ metric })}`, { timeout: 6000, __suppressErrorLog: true });
            this.currentDashboardReport = report;
            this.renderDashboardReportModal(report);
            this.setDashboardState('', '');
        } catch (e) {
            console.error('[Dashboard] Report failed:', e);
            this.setDashboardState('error', 'تعذر فتح التقرير المطلوب.');
        }
    }

    renderDashboardReportModal(report) {
        document.getElementById('dashboard-report-modal')?.remove();
        const rows = Array.isArray(report.records) ? report.records : [];
        const headers = [...new Set(rows.flatMap(row => Object.keys(row || {})))].slice(0, 14);
        const modal = document.createElement('div');
        modal.id = 'dashboard-report-modal';
        modal.className = 'dashboard-report-modal';
        modal.innerHTML = `
            <div class="dashboard-report-dialog">
                <div class="dashboard-report-header">
                    <div>
                        <h3>${this.escapeHtml(report.title || 'تقرير لوحة التحكم')}</h3>
                        <p>العدد: ${this.formatDashboardNumber(report.totalCount)} | الإجمالي: ${this.formatDashboardAmount(report.totalAmount)}</p>
                    </div>
                    <button class="dashboard-report-close" onclick="document.getElementById('dashboard-report-modal')?.remove()">×</button>
                </div>
                <div class="dashboard-report-actions">
                    <span>النطاق: ${this.escapeHtml(this.formatDashboardDateRange(report.dateRange))}</span>
                    <button onclick="app.exportDashboardReport()">تصدير Excel</button>
                    <button onclick="app.printDashboardReport()">طباعة</button>
                </div>
                <div class="dashboard-report-table-wrap">
                    ${rows.length ? `
                        <table class="dashboard-report-table">
                            <thead><tr>${headers.map(h => `<th>${this.escapeHtml(h)}</th>`).join('')}</tr></thead>
                            <tbody>${rows.map(row => `<tr>${headers.map(h => `<td>${this.escapeHtml(row[h] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
                        </table>
                    ` : '<div class="dashboard-empty">لا توجد سجلات مطابقة.</div>'}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    exportDashboardReport() {
        const report = this.currentDashboardReport;
        const rows = report?.records || [];
        if (!rows.length) return this.showToast?.('لا توجد بيانات للتصدير', 'warning');
        if (!window.XLSX) return this.showToast?.('مكتبة Excel غير متاحة', 'error');
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!views'] = [{ RTL: true }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Dashboard Report');
        XLSX.writeFile(wb, `${report.title || 'dashboard-report'}.xlsx`);
    }

    printDashboardReport() {
        const modal = document.getElementById('dashboard-report-modal');
        if (!modal) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <html dir="rtl"><head><title>تقرير لوحة التحكم</title>
            <style>body{font-family:Arial,sans-serif;padding:20px;direction:rtl}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;font-size:12px}th{background:#eee}</style>
            </head><body>${modal.querySelector('.dashboard-report-dialog').innerHTML}</body></html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    formatDashboardDateRange(range) {
        if (!range) return 'كل البيانات';
        const parts = [];
        if (range.from) parts.push(`من ${range.from}`);
        if (range.to) parts.push(`إلى ${range.to}`);
        if (range.month) parts.push(`الشهر ${range.month}`);
        return parts.join(' - ') || 'كل البيانات';
    }

    formatDashboardNumber(value) {
        return Number(value || 0).toLocaleString('ar-EG');
    }

    formatDashboardAmount(value) {
        return Number(value || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    updateStats(serverStats = null) {
        if (!serverStats) return;
        // حفظ العدد الكلي المطابق للفلتر لميزة "تحديد الكل"
        this.totalFilteredCount = serverStats.filteredCount || serverStats.total || serverStats.systemTotalCount || 0;

        // Helper functions for formatting
        const formatNum = (val) => (val || 0).toLocaleString();
        const formatCurr = (val) => (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const updateText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        // 1. Update Legacy IDs (for backward compatibility if any)
        updateText('stat-total-count', formatNum(serverStats.systemTotalCount || serverStats.totalCount));
        updateText('stat-total-amount', formatCurr(serverStats.totalAmount));
        updateText('stat-pending', formatNum(serverStats.pendingCount));
        updateText('stat-returned', formatNum(serverStats.returnedCount));

        // 2. Update NEW IDs for the 3-Card Pro Grid
        // IDs: search-count, search-amount, search-open-count, search-open-amount, search-settled-count, search-settled-amount
        updateText('search-count', formatNum(serverStats.filteredCount || serverStats.total));
        updateText('search-amount', formatCurr(serverStats.totalAmount || serverStats.amount));

        updateText('search-open-count', formatNum(serverStats.pendingCount || serverStats.open));
        updateText('search-open-amount', formatCurr(serverStats.pendingAmount || serverStats.openAmount));

        updateText('search-settled-count', formatNum(serverStats.successCount || serverStats.settled));
        updateText('search-settled-amount', formatCurr(serverStats.settledAmount));

        // Update table info text
        const infoEl = document.getElementById('table-info');
        if (infoEl && this.pagination) {
            const start = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage + 1;
            const end = Math.min(this.pagination.currentPage * this.pagination.itemsPerPage, this.pagination.total);
            infoEl.textContent = `عرض ${start.toLocaleString('ar-EG')} - ${end.toLocaleString('ar-EG')} من أصل ${this.pagination.total.toLocaleString('ar-EG')} سجل مطابق للبحث`;
        }
    }

    // ========================================
    // استيراد الملفات
    // ========================================

    showImportModal() {
        this.isSalaryImport = false; // مرتدات الحوافز فقط
        document.getElementById('import-modal')?.classList.remove('hidden');
    }

    // ========================================
    // التصدير والطباعة
    // ========================================

    async exportToExcel() {
        this.showLoading();
        try {
            // Fetch ALL data matching current search/filter/attachmentStatus
            const allData = await db.getAllReturns(this.currentSearch, this.currentFilter, this.attachmentFilterValue);

            if (!allData || allData.length === 0) {
                this.showToast('لا توجد بيانات لتصديرها', 'warning');
                return;
            }

            // تحضير البيانات لـ XLSX (قائمة المصفوفات)
            const headersToExport = this.headers;
            const worksheetData = [headersToExport]; // الصف الأول هو الهيدرز

            allData.forEach(row => {
                const rowArray = headersToExport.map(header => row[header] === null || row[header] === undefined ? '' : row[header]);
                worksheetData.push(rowArray);
            });

            // إنشاء ورقة العمل (Worksheet)
            const ws = XLSX.utils.aoa_to_sheet(worksheetData);

            // ضبط اتجاه الورقة من اليمين لليسار (RTL) لدعم العربية
            if (!ws['!views']) ws['!views'] = [];
            ws['!views'].push({ RTL: true });

            // إنشاء كتاب العمل (Workbook)
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "المرتدات");

            // توليد الملف وتحميله
            const fileName = `تقرير_المرتدات_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, fileName);

            this.showToast('تم تصدير البيانات بنجاح بصيغة Excel', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showToast('فشل تصدير البيانات', 'error');
        } finally {
            this.hideLoading();
        }
    }

    downloadTemplate() {
        try {
            const headers = ['كود الملف', 'الشهر', 'الاسم', 'رقم الحساب', 'البنك', 'قيمة العملية', 'الحالة', 'السبب', 'رقم الحساب بعد التعديل', 'البنك بعد التعديل', 'كود الفرع بعد التعديل', 'رقم تسوية التعلية', 'تاريخ المرتد / تاريخ التعلية', 'تاريخ اعتماد المرتدات', 'تاريخ التعديل', 'تاريخ اعتماد التعديل', 'رقم تسوية السداد', 'تاريخ اعتماد التعديل / تاريخ السداد'];
            const ws = XLSX.utils.aoa_to_sheet([headers]);
            ws['!views'] = [{ RTL: true }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "نموذج مرتدات الحوافز");
            XLSX.writeFile(wb, "نموذج_استيراد_مرتدات_الحوافز.xlsx");
            this.showToast('تم تنزيل النموذج بنجاح', 'success');
        } catch (error) {
            console.error('Error downloading template:', error);
            this.showToast('فشل تنزيل النموذج', 'error');
        }
    }

    downloadSalaryTemplate() {
        try {
            const headers = [
                'كود الملف',
                'الشهر',
                'الاسم',
                'الرقم القومي',
                'رقم الحساب',
                'البنك',
                'قيمة العملية',
                'الحالة',
                'السبب',
                'رقم الحساب بعد التعديل',
                'البنك بعد التعديل',
                'كود الفرع بعد التعديل',
                'رقم تسوية التعلية',
                'تاريخ المرتد / تاريخ التعلية',
                'تاريخ اعتماد المرتدات',
                'تاريخ التعديل',
                'تاريخ اعتماد التعديل',
                'رقم تسوية السداد',
                'تاريخ اعتماد التعديل / تاريخ السداد'
            ];
            const ws = XLSX.utils.aoa_to_sheet([headers]);
            ws['!views'] = [{ RTL: true }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "نموذج مرتادات المرتبات");
            XLSX.writeFile(wb, "نموذج_استيراد_مرتادات_المرتبات.xlsx");
            this.showToast('تم تنزيل النموذج بنجاح', 'success');
        } catch (error) {
            console.error('Error downloading template:', error);
            this.showToast('فشل تنزيل النموذج', 'error');
        }
    }

    printReport() {
        window.print();
    }

    // إخفاء مودال استيراد مرتدات الحوافز
    hideImportModal() {
        document.getElementById('import-modal')?.classList.add('hidden');
        // لا نلمس isSalaryImport هنا — كل مودال يتحكم في نفسه
    }

    // إخفاء مودال استيراد مرتادات المرتبات
    hideSalaryImportModal() {
        document.getElementById('salary-import-modal')?.classList.add('hidden');
        const fileInput = document.getElementById('salary-file-input');
        if (fileInput) fileInput.value = '';
    }

    // معالجة اختيار ملف مرتدات الحوافز — لا يستدعي salary أبداً
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.pendingImportType = 'incentive'; // تثبيت النوع
            this.isSalaryImport = false;
            this.processFile(file);
        }
    }

    // معالجة اختيار ملف مرتادات المرتبات — منفصل تماماً
    handleSalaryFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.pendingImportType = 'salary'; // تثبيت النوع
            this.isSalaryImport = true;
            this.processSalaryFile(file);
        }
    }

    normalizeIncentiveImportHeader(header) {
        return String(header || '')
            .replace(/^\uFEFF/, '')
            .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
            .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
            .replace(/\u0640/g, '')
            .replace(/[أإآٱ]/g, 'ا')
            .replace(/ى/g, 'ي')
            .replace(/ة/g, 'ه')
            .replace(/[\\\/\-\u2010-\u2015\u2212\uFF0F\u2044\u2215]/g, '/')
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\s*\/\s*/g, '/')
            .toLowerCase();
    }

    getIncentiveImportSchema() {
        return [
            { name: 'كود الملف', required: true, aliases: ['كودالملف', 'كود_الملف', 'FileCode', 'Code', 'Batch ID', 'BatchCode'] },
            { name: 'الاسم', required: true, aliases: ['Name', 'FullName', 'CREDITOR_NAME', 'Beneficiary Name', 'اسم المستفيد'] },
            { name: 'الرقم القومي', required: true, aliases: ['الرقم  القومي', 'الرقم القومى', 'الرقم_القومي', 'NationalID', 'National Id', 'National ID', 'NID', 'رقم قومي'] },
            { name: 'رقم الحساب', required: true, aliases: ['رقمالحساب', 'AccountNumber', 'Account No', 'CurrentAccount', 'ACCOUNT_NUMBER'] },
            { name: 'البنك', required: true, aliases: ['Bank', 'CurrentBank', 'اسم البنك'] },
            { name: 'قيمة العملية', required: true, aliases: ['المبلغ', 'القيمة', 'Amount', 'Transaction Value', 'Value'] },
            { name: 'الحالة', required: true, aliases: ['Status', 'ReturnStatus', 'حالة الارتداد'] },
            { name: 'السبب', required: false, aliases: ['Reason'] },
            { name: 'رقم الحساب بعد التعديل', required: false, aliases: ['EditedAccountNumber', 'NewAccountNumber', 'ModifiedAccount', 'رقم الحساب الجديد', 'الحساب الجديد', 'تعديل رقم الحساب'] },
            { name: 'البنك بعد التعديل', required: false, aliases: ['ModifiedBank', 'البنك الجديد', 'اسم البنك الجديد'] },
            { name: 'كود الفرع بعد التعديل', required: false, aliases: ['BranchCode', 'ModifiedBranchCode'] },
            { name: 'رقم تسوية التعلية', required: false, aliases: ['رقم تسوية تعلية', 'تسوية تعلية', 'ElevationSettlementNo', 'AccrualSettlementNo'] },
            { name: 'تاريخ المرتد / تاريخ التعلية', required: false, aliases: ['تاريخ المرتد/تاريخ التعلية', 'تاريخ المرتد \\ تاريخ التعلية', 'تاريخ المرتد - تاريخ التعلية', 'تاريخ المرتد', 'تاريخ المرتدات', 'تاريخ التعلية', 'ReturnDate'] },
            { name: 'تاريخ اعتماد المرتدات', required: false, aliases: ['ReturnApprovalDate'] },
            { name: 'تاريخ التعديل', required: false, aliases: ['ModDate', 'ModificationDate'] },
            { name: 'تاريخ اعتماد التعديل', required: false, aliases: ['ModApprovalDate'] },
            { name: 'رقم تسوية السداد', required: false, aliases: ['رقم تسوية سداد', 'رقم التسوية', 'SettlementNo', 'Settlement No', 'PaymentSettlementNo'] },
            { name: 'تاريخ اعتماد التعديل / تاريخ السداد', required: false, aliases: ['تاريخ اعتماد التعديل/تاريخ السداد', 'تاريخ اعتماد التعديل \\ تاريخ السداد', 'تاريخ اعتماد التعديل - تاريخ السداد', 'تاريخ السداد', 'تاريخ التسوية', 'تاريخ السداد الفعلي', 'SettlementDate', 'Settlement Date'] },
            { name: 'حالة التسوية', required: false, aliases: ['SettlementStatus'] },
            { name: 'الشهر', required: false, aliases: ['Month', 'ExtractedMonth'] }
        ];
    }

    canonicalizeIncentiveImportRows(rows) {
        const schema = this.getIncentiveImportSchema();
        const normalizedToColumn = new Map();
        schema.forEach(col => [col.name, ...(col.aliases || [])].forEach(alias => {
            normalizedToColumn.set(this.normalizeIncentiveImportHeader(alias), col.name);
        }));

        return (rows || []).map(row => {
            const canonical = {};
            Object.entries(row || {}).forEach(([key, value]) => {
                const mappedKey = normalizedToColumn.get(this.normalizeIncentiveImportHeader(key)) || key;
                const existing = canonical[mappedKey];
                const hasExisting = existing !== undefined && existing !== null && String(existing).trim() !== '';
                const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
                if (!hasExisting || hasValue) canonical[mappedKey] = value;
            });

            schema.forEach(col => {
                if (!Object.prototype.hasOwnProperty.call(canonical, col.name)) {
                    canonical[col.name] = '';
                }
            });

            const paymentNo = canonical['رقم تسوية السداد'];
            if (!canonical['حالة التسوية']) {
                canonical['حالة التسوية'] = paymentNo !== undefined && paymentNo !== null && String(paymentNo).trim() !== ''
                    ? 'تم التسوية'
                    : 'لم يتم التسوية';
            }
            return canonical;
        });
    }

    analyzeIncentiveImportColumns(rows) {
        const schema = this.getIncentiveImportSchema();
        const known = new Map();
        schema.forEach(col => [col.name, ...(col.aliases || [])].forEach(alias => {
            known.set(this.normalizeIncentiveImportHeader(alias), col.name);
        }));

        const seen = new Map();
        (rows || []).forEach(row => Object.keys(row || {}).forEach(key => {
            const normalized = this.normalizeIncentiveImportHeader(key);
            if (!seen.has(normalized)) seen.set(normalized, { original: key, canonical: known.get(normalized) || null });
        }));

        const presentCanonical = new Set(Array.from(seen.values()).map(v => v.canonical).filter(Boolean));
        const missingRequired = schema.filter(col => col.required && !presentCanonical.has(col.name)).map(col => col.name);
        const unknown = Array.from(seen.values()).filter(v => !v.canonical).map(v => v.original);

        return {
            present: Array.from(presentCanonical),
            missingRequired,
            unknown,
            hasBlockingIssues: missingRequired.length > 0 || unknown.length > 0,
            officialCount: schema.length
        };
    }

    async processFile(file) {
        this.showLoading();
        this.hideImportModal();
        this.pendingImportType = 'incentive'; // تثبيت النوع
        try {
            const rawRows = await this.readExcelFile(file);
            const columnDiagnostics = this.analyzeIncentiveImportColumns(rawRows);
            const data = this.canonicalizeIncentiveImportRows(rawRows);

            if (!data || data.length === 0) {
                throw new Error('الملف فارغ أو غير صالح');
            }

            // 1. تشغيل الفحص (Validation)
            this._validationService = new ValidationService();
            const validationResult = this._validationService.validate(data, this.returnsCache || []);

            // 2. تحديث واجهة الفحص
            this.populateValidationModal(validationResult);
            this.showValidationResultsPage(validationResult);
            this._showColumnCoverage(data, columnDiagnostics);

            // تخزين البيانات مؤقتاً
            this.pendingAllData = data;
            this.pendingValidData = columnDiagnostics.hasBlockingIssues ? [] : validationResult.validRecords;
            this.pendingFile = file;
            this._incentiveImportColumnDiagnostics = columnDiagnostics;
            this._setImportSaveButtonsEnabled(!columnDiagnostics.hasBlockingIssues);

        } catch (error) {
            console.error('خطأ في الاستيراد:', error);
            this.showToast('عذراً، حدث خطأ أثناء معالجة الملف: ' + error.message, 'error');
        } finally {
            this.hideLoading();
            // مسح قيمة الـ input للسماح بإعادة اختيار نفس الملف إذا لزم الأمر
            const fileInput = document.getElementById('file-input');
            if (fileInput) fileInput.value = '';
        }
    }

    /**
     * تشغيل الفحص على البيانات الحالية المعروضة
     */
    async runValidationOnCurrentData() {
        // إظهار شريط التقدم العام
        const progressContainer = document.getElementById('print-prep-progress');
        const progressText = progressContainer?.querySelector('.print-progress-text');

        if (progressContainer) {
            progressContainer.classList.remove('hidden');
            if (progressText) progressText.textContent = 'جاري جلب جميع البيانات من الخادم...';
            setTimeout(() => progressContainer.classList.add('animating'), 10);
        }

        try {
            // 1. Fetch ALL data matching current search/filter
            const allData = await this.db.getAllReturns(this.currentSearch, this.currentFilter);

            if (!allData || allData.length === 0) {
                this.showToast('لا توجد بيانات للفحص', 'warning');
                if (progressContainer) {
                    progressContainer.classList.remove('animating');
                    progressContainer.classList.add('hidden');
                }
                return;
            }

            if (progressText) progressText.textContent = `جاري فحص ${allData.length} سجل...`;

            await new Promise(resolve => setTimeout(resolve, 500)); // UI update

            // 2. Run Validation on ALL data
            if (progressText) progressText.textContent = 'تطبيق قواعد التحقق...';

            await new Promise(resolve => setTimeout(resolve, 100)); // Allow UI flush

            this._validationService = new ValidationService();
            const validationResult = this._validationService.validate(allData, this.returnsCache || []);

            if (progressText) progressText.textContent = 'تجميع الإحصائيات...';
            await new Promise(resolve => setTimeout(resolve, 300));

            // 3. Update UI
            this.populateValidationModal(validationResult);
            this.showValidationResultsPage(validationResult);

            // 4. SHOW Save Buttons (Fixed logic)

            // Store for Export
            this.pendingAllData = allData;
            this.pendingValidData = validationResult.validRecords;
            this.pendingFile = { name: `Full_Report_${new Date().toISOString().slice(0, 10)}.xlsx`, size: 0 };

        } catch (error) {
            console.error('Validation Error:', error);
            this.showToast('حدث خطأ أثناء فحص البيانات', 'error');
            if (progressContainer) {
                progressContainer.classList.remove('animating');
                progressContainer.classList.add('hidden');
            }
        }
    }



    populateValidationModal(validationResult) {
        document.getElementById('val-total-count').textContent = validationResult.stats.total || 0;
        document.getElementById('val-valid-count').textContent = validationResult.stats.valid || 0;
        document.getElementById('val-invalid-count').textContent = validationResult.stats.invalid || 0;

        // تحديث أعداد الأخطاء كملصقات
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val || 0;
        };

        // عرض العدد الفريد + المتأثر (مثلاً: "3 مشكلة / 15 سجل")
        const setValWithUnique = (id, affected, unique) => {
            const el = document.getElementById(id);
            if (el) {
                if (unique > 0 && unique !== affected) {
                    el.textContent = `${affected} سجل (${unique} فريد)`;
                } else {
                    el.textContent = affected || 0;
                }
            }
        };

        setValWithUnique('count-nid-conflict', validationResult.stats.nidConflictCount, validationResult.stats.uniqueNidConflicts);
        setValWithUnique('count-acc-conflict-original', validationResult.stats.accConflictOriginalCount, validationResult.stats.uniqueAccConflictsOriginal);
        setValWithUnique('count-acc-conflict-edited', validationResult.stats.accConflictEditedCount, validationResult.stats.uniqueAccConflictsEdited);
        setValWithUnique('count-multi-acc-original', validationResult.stats.multiAccOriginalCount, validationResult.stats.uniqueMultiAccOriginal);
        setValWithUnique('count-multi-acc-edited', validationResult.stats.multiAccEditedCount, validationResult.stats.uniqueMultiAccEdited);
        setVal('count-nid-format', validationResult.stats.nidFormatCount);
        setVal('count-acc-format-original', validationResult.stats.accFormatOriginalCount);
        setVal('count-acc-format-edited', validationResult.stats.accFormatEditedCount);
        setVal('count-missing-code', validationResult.stats.emptyCodes);
        setVal('count-zero-acc-original', validationResult.stats.zeroAccOriginalCount);
        setVal('count-zero-acc-edited', validationResult.stats.zeroAccEditedCount);
        setVal('count-duplicate-row', validationResult.stats.duplicateRowCount);

        // عرض عدد التنبيهات
        setVal('val-warning-count', validationResult.stats.warningCount);

        // إظهار/إخفاء قسم الأخطاء
        const errorsSection = document.getElementById('val-errors-section');
        if (validationResult.stats.invalid > 0 || validationResult.stats.warningCount > 0) {
            errorsSection?.style.setProperty('display', 'block');
        } else {
            errorsSection?.style.setProperty('display', 'none');
        }

        // إعادة إظهار أزرار الحفظ الافتراضية (للاستيراد)
        const footerBtns = document.getElementById('validation-modal-footer');
        if (footerBtns) {
            ['btn-save-valid', 'btn-save-as-is'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.style.display = 'inline-block';
            });
        }
    }

    showValidationModal() {
        document.getElementById('validation-modal')?.classList.remove('hidden');
    }

    showValidationResultsPage(validationResult) {
        // Hide all pages
        document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));

        // Show validation results page
        const valPage = document.getElementById('page-validation-results');
        if (valPage) {
            valPage.classList.remove('hidden');

            // Populate Sidebar Stats
            document.getElementById('val-full-total').textContent = validationResult.stats.total.toLocaleString();
            document.getElementById('val-full-valid').textContent = validationResult.stats.valid.toLocaleString();
            document.getElementById('val-full-errors').textContent = validationResult.stats.invalid.toLocaleString();
            document.getElementById('val-full-warnings').textContent = validationResult.stats.warningCount.toLocaleString();

            // Render Cards
            this.renderValidationErrorCards(validationResult);
        }
    }

    hideValidationResultsPage() {
        document.getElementById('page-validation-results')?.classList.add('hidden');

        // العودة للصفحة الصحيحة بناءً على النوع المثبت
        if (this.pendingImportType === 'salary') {
            this.navigateTo('salary-returns');
        } else {
            this.navigateTo('returns');
        }
    }


    renderValidationErrorCards(validationResult) {
        const container = document.getElementById('val-cards-list');
        if (!container) return;

        const errorDefinitions = [
            { id: 'missing_field', title: 'بيانات مفقودة', badge: 'danger', icon: '⚠️', text: 'سجلات تفتقد لبيانات أساسية (الاسم أو الرقم القومي).' },
            { id: 'nidConflict', title: 'تكرار الرقم القومي', badge: 'danger', icon: '🆔', text: 'تكرار الرقم القومي مع أسماء مختلفة في الملف.' },
            { id: 'accConflictOriginal', title: 'تكرار حساب (أصلي)', badge: 'danger', icon: '🏦', text: 'تكرار رقم حساب البنك الأصلي مع أسماء مستفيدين مختلفة.' },
            { id: 'accConflictEdited', title: 'تكرار حساب (معدل)', badge: 'danger', icon: '✏️', text: 'تكرار رقم حساب البنك المعدل مع أسماء مستفيدين مختلفة.' },
            { id: 'duplicateRow', title: 'تكرار السجلات', badge: 'danger', icon: '🔄', text: 'صفوف مكررة بالكامل (جميع البيانات متطابقة تماماً).' },
            { id: 'multiAccOriginal', title: 'تعدد حسابات (أصلي)', badge: 'warning', icon: '📁', text: 'نفس الشخص لديه أكثر من رقم حساب بنكي أصلي في الملف.' },
            { id: 'multiAccEdited', title: 'تعدد حسابات (معدل)', badge: 'warning', icon: '📂', text: 'نفس الشخص لديه أكثر من رقم حساب بنكي معدل في الملف.' },
            { id: 'nidFormat', title: 'تنسيق الرقم القومي', badge: 'info', icon: '📏', text: 'أرقام قومية لا تطابق الطول القياسي (14 رقم).' },
            { id: 'accFormatOriginal', title: 'تنسيق الحساب (أصلي)', badge: 'info', icon: '🔢', text: 'أرقام حسابات أصلية غير صحيحة الطول.' },
            { id: 'accFormatEdited', title: 'تنسيق الحساب (معدل)', badge: 'info', icon: '📝', text: 'أرقام حسابات معدلة غير صحيحة الطول.' },
            { id: 'missingCode', title: 'كود الملف مفقود', badge: 'warning', icon: '❓', text: 'سجلات تفتقد لكود الملف التعريفي.' },
            { id: 'zeroAccOriginal', title: 'حسابات صفرية (أصلي)', badge: 'warning', icon: '0️⃣', text: 'سجلات تحتوي على رقم حساب أصلي قيمته صفر.' },
            { id: 'zeroAccEdited', title: 'حسابات صفرية (معدل)', badge: 'warning', icon: '⏺️', text: 'سجلات تحتوي على رقم حساب معدل قيمته صفر.' }
        ];

        let html = '';
        errorDefinitions.forEach(def => {
            const count = validationResult.stats[def.id + 'Count'] || validationResult.stats[def.id] || 0;
            const uniqueCount = validationResult.stats['unique' + def.id.charAt(0).toUpperCase() + def.id.slice(1)];
            let countDisplay = count.toLocaleString();

            if (uniqueCount && uniqueCount > 0 && uniqueCount !== count) {
                countDisplay = `${count.toLocaleString()} سجل (${uniqueCount.toLocaleString()} فريد)`;
            }

            const isWarning = def.badge === 'warning' || def.badge === 'info';
            const cardClass = count > 0 ? (def.badge === 'danger' ? 'critical' : 'warning') : 'success-muted';
            const badgeText = count > 0 ? (def.badge === 'danger' ? 'حرجة' : 'تنبيه') : 'سليم';

            html += `
                <div class="val-error-card animated fadeIn ${count === 0 ? 'muted-card' : ''}">
                    <span class="val-card-badge ${count > 0 ? def.badge : 'success'}">${badgeText}</span>
                    <div class="val-card-icon-small" style="${count === 0 ? 'filter: grayscale(1); opacity: 0.5;' : ''}">${def.icon}</div>
                    <div class="val-card-content">
                        <h4 class="val-card-title" style="${count === 0 ? 'color: #94a3b8;' : ''}">${def.title}</h4>
                        <p class="val-card-text">${def.text}</p>
                        <div class="val-card-stat ${count > 0 ? def.badge : 'success'}">
                            <span class="count-label">العدد:</span>
                            <span class="count-value">${countDisplay}</span>
                        </div>
                        ${count > 0 ? `
                        <button class="btn-download-report" onclick="app.downloadSpecificError('${def.id}')">
                            <i class="fas fa-file-download"></i> تنزيل التقرير
                        </button>` : `
                        <button class="btn-download-report disabled" disabled style="opacity: 0.3; cursor: not-allowed;">
                            <i class="fas fa-check-circle"></i> لا توجد أخطاء
                        </button>`}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    _showColumnCoverage(data, diagnostics = null) {
        if (!data || data.length === 0) return;
        const OFFICIAL_COLUMNS = [
            'كود الملف', 'الاسم', 'الرقم القومي', 'رقم الحساب', 'البنك',
            'قيمة العملية', 'الحالة', 'السبب',
            'رقم الحساب بعد التعديل', 'البنك بعد التعديل', 'كود الفرع بعد التعديل',
            'رقم تسوية التعلية', 'تاريخ المرتد / تاريخ التعلية',
            'تاريخ اعتماد المرتدات', 'تاريخ التعديل', 'تاريخ اعتماد التعديل',
            'رقم تسوية السداد', 'تاريخ اعتماد التعديل / تاريخ السداد', 'حالة التسوية'
        ];
        const normHeader = s => this.normalizeIncentiveImportHeader
            ? this.normalizeIncentiveImportHeader(s)
            : String(s || '').replace(/\s+/g, ' ').trim();

        const fileHeaders = Object.keys(data[0]).map(h => normHeader(h));

        let present = [], missing = [];
        OFFICIAL_COLUMNS.forEach(col => {
            const normCol = normHeader(col);
            // البحث عن تطابق تام أو تطابق بعد إزالة المسافات (Fuzzy)
            const found = fileHeaders.some(h => h === normCol || h.replace(/\s/g, '') === normCol.replace(/\s/g, ''));
            if (found) present.push(col);
            else missing.push(col);
        });

        const extra = diagnostics?.unknown?.length ? diagnostics.unknown : fileHeaders.filter(h => {
            const compactH = h.replace(/\s/g, '');
            return !OFFICIAL_COLUMNS.some(c => {
                const nc = normHeader(c);
                return nc === h || nc.replace(/\s/g, '') === compactH;
            });
        });
        const missingRequired = diagnostics?.missingRequired || [];
        const hasBlockingIssues = diagnostics?.hasBlockingIssues || false;

        const container = document.getElementById('val-cards-list');
        if (!container) return;

        const missingHtml = missing.length
            ? missing.map(c => `<span style="background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:3px 9px;margin:3px;display:inline-block;font-size:0.82rem;">✗ ${c}</span>`).join('')
            : '<span style="color:#4ade80;font-size:0.85rem;">لا توجد أعمدة مفقودة</span>';
        const missingRequiredHtml = missingRequired.length
            ? `<div style="margin-top:8px"><strong style="color:#f87171;font-size:0.85rem;">أعمدة مطلوبة مفقودة تمنع الحفظ:</strong><div style="margin-top:4px">${missingRequired.map(c => `<span style="background:rgba(239,68,68,0.16);color:#f87171;border:1px solid rgba(239,68,68,0.35);border-radius:6px;padding:3px 9px;margin:3px;display:inline-block;font-size:0.82rem;">${c}</span>`).join('')}</div></div>`
            : '';
        const presentHtml = present.map(c => `<span style="background:rgba(74,222,128,0.1);color:#4ade80;border:1px solid rgba(74,222,128,0.25);border-radius:6px;padding:3px 9px;margin:3px;display:inline-block;font-size:0.82rem;">✓ ${c}</span>`).join('');
        const extraHtml = extra.length
            ? extra.map(c => `<span style="background:rgba(251,191,36,0.1);color:#fbbf24;border:1px solid rgba(251,191,36,0.25);border-radius:6px;padding:3px 9px;margin:3px;display:inline-block;font-size:0.82rem;">+ ${c}</span>`).join('')
            : '';

        const coverageCard = `
            <div class="val-error-card animated fadeIn" style="grid-column:1/-1;border-color:${missing.length ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.3)'}">
                <span class="val-card-badge ${hasBlockingIssues ? 'danger' : (missing.length ? 'warning' : 'success')}">${hasBlockingIssues ? 'يحتاج مراجعة' : (missing.length ? `${missing.length} مفقود` : 'مكتمل')}</span>
                <div class="val-card-icon-small">📋</div>
                <div class="val-card-content" style="width:100%">
                    <h4 class="val-card-title">تغطية الأعمدة الرسمية (${present.length} / ${OFFICIAL_COLUMNS.length})</h4>
                    ${hasBlockingIssues ? '<p style="color:#f87171;font-size:0.9rem;margin:6px 0;">تم إيقاف أزرار الحفظ حتى يتم تصحيح الأعمدة المطلوبة أو الأعمدة غير المعروفة.</p>' : ''}
                    <div style="margin:8px 0">${presentHtml}</div>
                    ${missingRequiredHtml}
                    ${missing.length ? `<div style="margin-top:8px"><strong style="color:#f87171;font-size:0.85rem;">أعمدة مفقودة:</strong><div style="margin-top:4px">${missingHtml}</div></div>` : ''}
                    ${extra.length ? `<div style="margin-top:8px"><strong style="color:#fbbf24;font-size:0.85rem;">أعمدة إضافية في الملف:</strong><div style="margin-top:4px">${extraHtml}</div></div>` : ''}
                </div>
            </div>`;
        container.insertAdjacentHTML('afterbegin', coverageCard);
    }

    _setImportSaveButtonsEnabled(enabled) {
        ['btn-save-valid', 'btn-save-as-is'].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.disabled = !enabled;
            btn.style.opacity = enabled ? '' : '0.45';
            btn.style.pointerEvents = enabled ? '' : 'none';
            if (!enabled) btn.title = 'يجب تصحيح أعمدة ملف الحوافز قبل الحفظ';
            else btn.removeAttribute('title');
        });
    }

    hideValidationModal() {
        document.getElementById('validation-modal')?.classList.add('hidden');
        // Do NOT clear pending data here if we are about to save it.
        // But if called by close button, we should clear it.
        // Let's create a separate clearPendingData method or assume closing modal means cancel.

        // If we clear pending data here, saving logic must use data before calling hide.
        // For simplicity: We will clear pending data ONLY if explicitly asked, or let GC handle it.
        // Better: Clear it after successful save or explicit cancel.
        // For now, let's keep it but ensure save functions grab data FIRST.
        this.pendingValidData = null;
        this.pendingAllData = null;
        this.pendingFile = null;
        this._validationService = null;
        this._incentiveImportColumnDiagnostics = null;
        this._setImportSaveButtonsEnabled(true);
    }

    async saveValidRecords() {
        if (!this.pendingValidData || this.pendingValidData.length === 0) {
            this.showToast('لا توجد سجلات صحيحة للحفظ', 'warning');
            return;
        }
        // [FIX] Capture data BEFORE confirm dialog (prevents pendingData clear mid-flow)
        const dataToSave = this.pendingValidData;
        const file = this.pendingFile;
        if (!file) { this.showToast('تعذر الوصول لبيانات الملف', 'error'); return; }
        const confirmed = await confirm(`سيتم حفظ ${dataToSave.length} سجل سليم وتجاهل السجلات الخاطئة. هل أنت متأكد؟`);
        if (!confirmed) return;
        await this._saveDataToServer(dataToSave, file);
    }

    async saveAllRecords() {
        if (this.pendingImportType === 'incentive' && this._incentiveImportColumnDiagnostics?.hasBlockingIssues) {
            this.showToast('يجب تصحيح أعمدة ملف الحوافز قبل الحفظ', 'error');
            return;
        }
        if (!this.pendingAllData || this.pendingAllData.length === 0) {
            this.showToast('لا توجد سجلات للحفظ', 'warning');
            return;
        }
        // [FIX] Capture data BEFORE confirm dialog
        const dataToSave = this.pendingAllData;
        const file = this.pendingFile;
        if (!file) { this.showToast('تعذر الوصول لبيانات الملف', 'error'); return; }
        const confirmed = await confirm(`سيتم حفظ ${dataToSave.length} سجل. هل أنت متأكد؟`);
        if (!confirmed) return;
        await this._saveDataToServer(dataToSave, file);
    }

    async saveAllAsIs() {
        if (this.pendingImportType === 'incentive' && this._incentiveImportColumnDiagnostics?.hasBlockingIssues) {
            this.showToast('يجب تصحيح أعمدة ملف الحوافز قبل الحفظ', 'error');
            return;
        }
        if (!this.pendingAllData || this.pendingAllData.length === 0) {
            this.showToast('لا توجد سجلات للحفظ', 'warning');
            return;
        }
        // [FIX] Capture data BEFORE confirm dialog
        const dataToSave = this.pendingAllData;
        const file = this.pendingFile;
        if (!file) { this.showToast('تعذر الوصول لبيانات الملف', 'error'); return; }
        const confirmed = await confirm(`سيتم حفظ كل ${dataToSave.length} سجل كما هو بما فيها السجلات التي بها أخطاء. هل أنت متأكد؟`);
        if (!confirmed) return;
        await this._saveDataToServer(dataToSave, file);
    }

    // [FIX] file is now passed explicitly to avoid pendingFile null issues
    async _saveDataToServer(data, file) {
        if (!file) {
            console.error('[SAVE] file param is null!');
            this.showToast('عذراً، تعذر الوصول لبيانات الملف الأصلية', 'error');
            return;
        }

        // إخراج headers من البيانات نفسها
        const allKeys = new Set();
        data.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
        const headers = Array.from(allKeys).filter(k => k !== 'id' && k !== 'importId');

        console.log('[SAVE] Starting save process...', {
            recordCount: data.length,
            fileName: file.name,
            type: this.pendingImportType === 'salary' ? 'Salary' : 'Incentive'
        });

        // Keep browser cache alive; a targeted incremental sync below merges the new import.
        this.isCaching = false;

        // [FIX] إخفاء صفحة الـ validation وأزرارها أولاً
        this.hideLoading();

        // [FIX] إنشاء progress overlay ثابت بدلاً من DOM manipulation معقد
        const overlay = document.createElement('div');
        overlay.id = 'save-overlay-progress';
        console.log('[SAVE] Applying SQL filter:', `json_extract(RawData, '$.\"تاريخ اعتماد التعديل / تاريخ السداد\"')`);
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 200000;
            background: rgba(6, 11, 19, 0.92);
            backdrop-filter: blur(10px);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 20px; direction: rtl;
        `;
        overlay.innerHTML = `
            <div style="text-align:center; color:#00f0ff; font-family:'Cairo',sans-serif;">
                <div style="font-size:2.5rem; margin-bottom:10px;">💾</div>
                <div style="font-size:1.2rem; font-weight:700; margin-bottom:5px;">جاري حفظ البيانات...</div>
                <div id="_save_overlay_msg" style="font-size:0.9rem; color:#94a3b8;">تهيئة عملية الحفظ</div>
            </div>
            <div style="width:380px; max-width:90vw;">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.85rem; color:#64748b;">
                    <span>التقدم</span>
                    <span id="_save_overlay_pct">0%</span>
                </div>
                <div style="height:8px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden;">
                    <div id="_save_overlay_bar" style="height:100%; width:0%; background:linear-gradient(90deg,#00f0ff,#bd00ff); transition:width 0.3s ease; border-radius:10px;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const overlayMsg = overlay.querySelector('#_save_overlay_msg');
        const overlayPct = overlay.querySelector('#_save_overlay_pct');
        const overlayBar = overlay.querySelector('#_save_overlay_bar');

        const setProgress = (pct, msg) => {
            if (overlayBar) overlayBar.style.width = pct + '%';
            if (overlayPct) overlayPct.textContent = Math.floor(pct) + '%';
            if (msg && overlayMsg) overlayMsg.textContent = msg;
        };

        const removeOverlay = () => {
            const el = document.getElementById('save-overlay-progress');
            if (el) el.remove();
        };

        // السماح للمتصفح برسم الـ overlay
        await new Promise(r => setTimeout(r, 80));
        setProgress(5, 'جاري تجهيز البيانات...');

        const startTime = Date.now();
        try {
            const importInfo = {
                filename: file.name,
                size: this.formatFileSize(file.size),
                headers: headers
            };

            // شريط التقدم المتحرك
            let currentProgress = 5;
            setProgress(5, 'جاري إرسال البيانات إلى الخادم...');

            const interval = setInterval(() => {
                currentProgress += Math.random() * 4;
                if (currentProgress > 88) {
                    clearInterval(interval);
                    currentProgress = 88;
                }
                setProgress(currentProgress);
            }, 200);

            const isSalary = this.pendingImportType === 'salary';
            const response = isSalary
                ? await this.db.saveSalaryReturns(data, importInfo)
                : await this.db.saveReturns(data, importInfo);

            clearInterval(interval);

            if (response && response.success !== false) {
                console.log('[SAVE] API Success:', response);
                setProgress(95, 'تم الحفظ بنجاح، جاري تحديث البيانات...');

                await new Promise(r => setTimeout(r, 800));
                setProgress(100, 'اكتمل الحفظ!');
                await new Promise(r => setTimeout(r, 400));

                await this._syncDataset?.(isSalary ? 'salary' : 'returns', { force: true, skipCheck: true });

                // إغلاق واجهة الـ validation
                this.pendingAllData = null;
                this.pendingValidData = null;
                this.pendingFile = null;
                this.pendingImportType = null; // إعادة تعيين
                this._validationService = null;

                // إغلاق صفحة النتائج والمودال
                document.getElementById('validation-modal')?.classList.add('hidden');
                document.getElementById('page-validation-results')?.classList.add('hidden');

                removeOverlay();

                if (isSalary) {
                    this.navigateTo('salary-returns', true);

                    // Reset all salary filters rigorously
                    this.salarySearchQuery = '';
                    this.salaryAttachmentFilterValue = 'all';
                    this.salarySettlementFilterValue = 'all';
                    this.salaryReturnStatusFilterValue = 'all';
                    this.salaryMonthFilterValue = 'all';
                    this.salaryUploadDateFrom = null;
                    this.salaryUploadDateTo = null;

                    ['salary-table-search', 'salary-attachment-filter', 'salary-settlement-filter',
                     'salary-return-status-filter', 'salary-month-filter', 'salary-upload-date-filter'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.value = (id === 'salary-table-search' ? '' : 'all');
                    });

                    await this.loadSalaryReturns(1, 50, '');
                    this.showToast(`✅ تم حفظ ${data.length} سجل مرتبات بنجاح`, 'success');
                } else {
                    this.navigateTo('returns', true);

                    // Reset all return filters rigorously
                    this.searchQuery = '';
                    this.monthFilterValue = 'all';
                    this.attachmentFilterValue = 'all';
                    this.returnStatusFilterValue = 'all';
                    this.uploadDateFrom = null;
                    this.uploadDateTo = null;
                    this.settlementFilterValue = 'all';

                    ['table-search', 'month-filter', 'settlement-filter',
                     'return-status-filter', 'attachment-filter', 'upload-date-filter'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.value = (id === 'table-search' ? '' : 'all');
                    });

                    console.log('[SAVE] Reloading returns table...');
                    await this.loadReturns(1, 50, '', '', 'all', false);
                    this.showToast(`✅ تم حفظ ${data.length} سجل بنجاح`, 'success');
                    setTimeout(() => this.populateReturnsCache(), 1500);
                }

            } else {
                throw new Error(response?.message || 'فشل السيرفر في تأكيد عملية الحفظ');
            }
        } catch (error) {
            console.error('[SAVE] Critical Error:', error);
            removeOverlay();
            // إعادة إظهار أزرار الحفظ عند الفشل
            const vPage = document.getElementById('page-validation-results');
            const vFooter = vPage?.querySelector('.val-bottom-actions');
            if (vFooter) vFooter.style.display = '';
            const mFooter = document.getElementById('validation-modal-footer');
            if (mFooter) mFooter.style.display = '';
            this.showToast(`❌ فشل الحفظ: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    formatFileSize(bytes) {
        if (!bytes && bytes !== 0) return '0 Bytes';
        if (typeof bytes === 'string' && (bytes.includes(' ') || isNaN(Number(bytes)))) {
            return bytes; // Already formatted string
        }
        const numBytes = Number(bytes);
        if (isNaN(numBytes) || numBytes === 0 || numBytes < 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(numBytes) / Math.log(k));
        return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ========================================
    // Smart Payment Logic (Bulk Update via Excel)
    // ========================================

    downloadSmartPaymentTemplate() {
        if (typeof XLSX === 'undefined') {
            this.showToast('مكتبة Excel غير متوفرة', 'error');
            return;
        }

        const headers = [
            "الاسم",
            "الرقم القومي",
            "البنك",
            "رقم الحساب",
            "رقم الحساب بعد التعديل",
            "البنك بعد التعديل",
            "تاريخ اعتماد المرتدات",
            "تاريخ التعديل",
            "تاريخ اعتماد التعديل",
            "رقم تسوية السداد",
            "تاريخ اعتماد التعديل / تاريخ السداد"
        ];

        const wb = XLSX.utils.book_new();
        const ws_data = [
            headers,
            ["جمال عادل عبدالنظور حفنى", "28010101234567", "NBEGEGCXXXX", "EG000317070250", "0000000017070250", "NBEGEGCXXX", "16/03/2026", "02/04/2026", "02/04/2026", "10552", "02/04/2026"]
        ];

        const ws = XLSX.utils.aoa_to_sheet(ws_data);

        // ضبط التنسيق من اليمين إلى اليسار
        ws['!views'] = [{ RTL: true }];

        // Auto-size columns slightly
        const wscols = headers.map(h => ({wch: Math.max(h.length + 5, 20)}));
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "اسطمبة السداد الذكي");
        XLSX.writeFile(wb, "نموذج السداد.xlsx");

        this.showToast('تم تنزيل إسطمبة الإكسيل بنجاح', 'success');
    }

    async handleSmartPaymentFile(input) {
        const file = input.files[0];
        if (!file) return;

        this.smartExcelFileName = file.name;
        this.showSmartPaymentProgress(8, '\u062c\u0627\u0631\u064a \u0642\u0631\u0627\u0621\u0629 \u0645\u0644\u0641 \u0627\u0644\u0625\u0643\u0633\u064a\u0644...');

        // UI Updates for Compact Card
        const dropZone = document.getElementById('smart-payment-drop-zone');
        const changeBtn = document.getElementById('btn-change-smart-file');
        const uploadText = document.getElementById('smart-upload-text');

        if (dropZone) dropZone.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        if (changeBtn) {
            changeBtn.classList.remove('hidden');
            changeBtn.innerHTML = `<i class="fas fa-sync-alt"></i> (تغيير)`;
        }

        const statusFooter = document.getElementById('smart-payment-status-footer');
        const statusHeader = document.getElementById('smart-payment-status-header');
        if (statusFooter) statusFooter.textContent = 'جاري القراءة...';
        if (statusHeader) statusHeader.textContent = 'جاري القراءة...';

        // Show relevant buttons
        document.getElementById('btn-smart-match')?.classList.remove('hidden');
        document.getElementById('btn-change-smart-file')?.classList.remove('hidden');

        try {
            this.showSmartPaymentProgress(22, '\u062a\u062d\u0644\u064a\u0644 \u0623\u0639\u0645\u062f\u0629 \u0627\u0644\u0645\u0644\u0641...');
            await this.nextFrame();
            const data = await this.readExcelFile(file);
            this.smartExcelData = data;
            this.showSmartPaymentProgress(42, `\u062a\u0645 \u0642\u0631\u0627\u0621\u0629 ${data.length} \u0633\u062c\u0644. \u062c\u0627\u0631\u064a \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629...`);

            const statusMsg = `تم تحميل ${data.length} سجل.`;
            if (statusFooter) statusFooter.textContent = statusMsg;
            if (statusHeader) statusHeader.textContent = statusMsg;

            document.getElementById('btn-smart-match').disabled = false;
            
            // تشغيل المطابقة تلقائياً بمجرد رفع الملف
            await this.runSmartPaymentMatch();


        } catch (e) {
            console.error('[SMART] File Read Error:', e);
            this.showSmartPaymentProgress(100, '\u062a\u0639\u0630\u0631\u062a \u0642\u0631\u0627\u0621\u0629 \u0645\u0644\u0641 \u0627\u0644\u0625\u0643\u0633\u064a\u0644', { error: true, autoHide: true });
            if (statusFooter) statusFooter.textContent = 'خطأ في القراءة!';
            if (statusHeader) statusHeader.textContent = 'خطأ في القراءة!';
            this.showToast('فشل قراءة ملف الإكسيل', 'error');
        }
    }


    nextFrame() {
        return new Promise(resolve => requestAnimationFrame(() => resolve()));
    }

    showSmartPaymentProgress(percent, text, options = {}) {
        const container = document.getElementById('smart-payment-progress');
        const bar = document.getElementById('smart-payment-bar');
        const footer = document.getElementById('smart-payment-status-footer');
        const header = document.getElementById('smart-payment-status-header');
        if (!container || !bar) return;

        container.classList.remove('hidden');
        container.style.display = 'block';
        bar.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
        bar.style.background = options.error
            ? 'linear-gradient(90deg, #ef4444, #f59e0b)'
            : options.success
                ? 'linear-gradient(90deg, #10b981, #00f0ff)'
                : 'linear-gradient(90deg, #00f0ff, #6366f1)';

        if (footer) {
            footer.style.display = 'block';
            footer.style.margin = '-8px 0 12px';
            footer.style.color = options.error ? '#f87171' : '#94a3b8';
            footer.style.fontSize = '12px';
            footer.style.fontWeight = '700';
            footer.textContent = text || '';
        }
        if (header && text) header.textContent = text;

        if (options.autoHide) {
            clearTimeout(this._smartProgressHideTimer);
            this._smartProgressHideTimer = setTimeout(() => this.hideSmartPaymentProgress(), options.hideAfter || 1200);
        }
    }

    hideSmartPaymentProgress() {
        const container = document.getElementById('smart-payment-progress');
        const bar = document.getElementById('smart-payment-bar');
        if (!container || !bar) return;
        container.classList.add('hidden');
        container.style.display = '';
        bar.style.width = '0%';
    }


    async runSmartPaymentMatch() {
        if (!this.smartExcelData || this.smartExcelData.length === 0) return;

        const loading = document.getElementById('smart-payment-loading');
        const results = document.getElementById('smart-payment-results');
        const btnMatch = document.getElementById('btn-smart-match');

        // --- VISUAL FEEDBACK LOGIC (100-300ms responsive) ---
        if (btnMatch) {
            btnMatch.classList.add('btn-loading');
            btnMatch.disabled = true;
        }

        if (loading) loading.classList.add('hidden');
        if (results) results.style.display = 'none';

        try {
            this.showSmartPaymentProgress(52, '\u062a\u062c\u0647\u064a\u0632 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629...');
            await this.nextFrame();
            // Read match method from active chip or property
            const matchBy = this.smartMatchBy ||
                            document.querySelector('.match-mode-chip.active')?.getAttribute('data-value') ||
                            'الاسم';

            // Ensure Stat Filter matches the current UI control.
            if (!this.smartPaymentStatFilter) {
                this.smartPaymentStatFilter = this.getSmartSelectedStatusKey();
            }

            console.log('[SMART] Running match by:', matchBy, 'with filter:', this.smartPaymentStatFilter);

            // --- PERSISTENCE LOGIC ---
            // If we already have results, create a map of manual modifications
            const modificationsMap = new Map();
            if (this.smartMatchResults && this.smartMatchResults.length > 0) {
                this.smartMatchResults.forEach(item => {
                    const row = item.sourceExcelRow;
                    const mods = {};
                    let hasMod = false;

                    Object.keys(row).forEach(key => {
                        if (key.startsWith('_isModified_') && row[key] === true) {
                            const field = key.replace('_isModified_', '');
                            mods[field] = row[field];
                            hasMod = true;
                        }
                    });

                    if (hasMod) {
                        // Use name+currentAccount as key for persistence
                        const key = `${row.name}_${row.currentAccount}`;
                        modificationsMap.set(key, mods);
                    }
                });
            }

            // 1. Map Excel headers to model properties (Robust Kashida-Stripped Matching)
            const stripKashida = (s) => (s || '').replace(/ـ/g, '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();

            const findCol = (row, ...candidates) => {
                // Pass 1: Exact match
                for (const c of candidates) {
                    if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== '') return String(row[c]);
                }
                // Pass 2: Kashida-stripped match (handles hidden kashida in Excel headers)
                const keys = Object.keys(row);
                for (const c of candidates) {
                    const cleanC = stripKashida(c);
                    for (const k of keys) {
                        if (stripKashida(k) === cleanC) {
                            const val = row[k];
                            if (val !== undefined && val !== null && String(val).trim() !== '') return String(val);
                        }
                    }
                }
                return '';
            };

            const mappedRecords = this.smartExcelData.map((row, idx) => {
                // Debug: Log first row's actual column names
                if (idx === 0) {
                    const colNames = Object.keys(row);
                    console.log('[SMART] ===== Excel Column Names (Raw) =====');
                    colNames.forEach((c, i) => console.log(`  [${i}] "${c}" (stripped: "${stripKashida(c)}")`));
                    console.log('[SMART] ===== Excel First Row Values =====');
                    colNames.forEach(c => console.log(`  "${c}" => "${row[c]}"`));
                }

                const fileCodeKeys = ['كـــود الملف', 'كود الملف', 'FileCode', 'كُـــود المـلف', 'كود_الملف', 'BatchCode', 'Batch ID'];
                const rawFileCode = this.findValue(row, fileCodeKeys) || '';

                // User specifically requested to ONLY extract from file code
                const extractedMonth = this.extractMonthFromFileCode(rawFileCode);

                const record = {
                    name: findCol(row, 'الاسم', 'الاســــم', 'CREDITOR_NAME', 'Name', 'الاسم ', 'اسم المستفيد'),
                    nationalId: findCol(row, 'الرقم القومي', 'NationalId', 'National ID', 'NID', 'الرقم_القومي', 'رقم قومي'),
                    batchCode: rawFileCode,
                    month: extractedMonth,
                    currentAccount: findCol(row, 'رقم الحساب', 'رقم الحساب الحالي', 'CurrentAccount', 'ACCOUNT_NUMBER'),
                    currentBank: findCol(row, 'البنك', 'اسم البنك', 'CurrentBank'),
                    amount: findCol(row, 'قيمة العملية', 'Amount', 'Value'),
                    status: findCol(row, 'الحالة', 'Status'),
                    reason: findCol(row, 'السبب', 'Reason'),
                    modifiedAccount: findCol(row, 'رقم الحساب بعد التعديل', 'رقم الحساب الجديد', 'الحساب الجديد', 'ModifiedAccount'),
                    modifiedBank: findCol(row, 'البنك بعد التعديل', 'البنك الجديد', 'اسم البنك الجديد', 'ModifiedBank'),
                    modifiedBranchCode: findCol(row, 'كود الفرع بعد التعديل', 'BranchCode', 'ModifiedBranchCode'),
                    settlementElevationNo: findCol(row, 'رقم تسوية التعلية', 'ElevationSettlementNo'),
                    returnDate: findCol(row, 'تاريخ المرتد / تاريخ التعلية', 'تاريخ المرتدات', 'تاريخ المرتد', 'ReturnDate'),
                    returnApprovalDate: findCol(row, 'تاريخ اعتماد المرتدات', 'ReturnApprovalDate'),
                    modDate: findCol(row, 'تاريخ التعديل', 'ModDate'),
                    modApprovalDate: findCol(row, 'تاريخ اعتماد التعديل', 'ModApprovalDate'),
                    settlementNo: findCol(row, 'رقم تسوية السداد', 'SettlementNo'),
                    settlementDate: findCol(row, 'تاريخ اعتماد التعديل / تاريخ السداد', 'تاريخ تسوية السداد', 'تاريخ التسوية', 'SettlementDate')
                };

                ['returnDate', 'returnApprovalDate', 'modDate', 'modApprovalDate', 'settlementDate'].forEach(field => {
                    const formatted = this.formatDate(record[field]);
                    if (formatted) record[field] = formatted;
                });

                // Debug: Log first mapped record
                if (idx === 0) {
                    console.log('[SMART] ===== First Mapped Record =====');
                    Object.entries(record).forEach(([k, v]) => console.log(`  ${k}: "${v}"`));
                }

                // Re-apply modifications if this record was previously edited
                const modKey = `${record.name}_${record.currentAccount}`;
                if (modificationsMap.has(modKey)) {
                    const mods = modificationsMap.get(modKey);
                    Object.keys(mods).forEach(f => {
                        if (!f.startsWith('_')) {
                            const currentVal = String(record[f] || '').trim();
                            // Always respect the intentional manual override
                            record[f] = mods[f];
                            record[`_isModified_${f}`] = true;
                            record[`_original_${f}`] = currentVal;
                        }
                    });
                }

                return record;
            });

            // 2. Wrap into MatchRequest
            const request = {
                Records: mappedRecords.map(r => ({
                    Name: r.name,
                    NationalId: r.nationalId,
                    BatchCode: r.batchCode,
                    CurrentAccount: r.currentAccount,
                    CurrentBank: r.currentBank,
                    Amount: r.amount,
                    Status: r.status,
                    Reason: r.reason,
                    ModifiedAccount: r.modifiedAccount,
                    ModifiedBank: r.modifiedBank,
                    ModifiedBranchCode: r.modifiedBranchCode,
                    SettlementElevationNo: r.settlementElevationNo,
                    ReturnDate: r.returnDate,
                    ReturnApprovalDate: r.returnApprovalDate,
                    ModDate: r.modDate,
                    ModApprovalDate: r.modApprovalDate,
                    SettlementNo: r.settlementNo,
                    SettlementDate: r.settlementDate
                })),
                Filters: {
                    Month: document.getElementById('smart-month-filter')?.value || '',
                    FileCode: document.getElementById('smart-file-code-filter')?.value || '',
                    Status: '\u0627\u0644\u0643\u0644',
                    MatchBy: matchBy,
                    DataType: this.smartPaymentTypeFilter || 'salary'
                }
            };

            this.showSmartPaymentProgress(68, '\u062c\u0627\u0631\u064a \u062c\u0644\u0628 \u0646\u062a\u0627\u0626\u062c \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629...');
            const response = await fetch('/api/smart-settlement/match', {
                method: 'POST',
                __skipGlobalLoading: true,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                const err = await response.json();
                if (btnMatch) {
                    btnMatch.classList.remove('btn-loading');
                    btnMatch.classList.add('btn-error-feedback');
                    setTimeout(() => btnMatch.classList.remove('btn-error-feedback'), 1500);
                }
                throw new Error(err.message || 'فشل الاتصال بخدمة المطابقة');
            }

            const json = await response.json();
            if(!json.success) {
                if (btnMatch) {
                    btnMatch.classList.remove('btn-loading');
                    btnMatch.classList.add('btn-error-feedback');
                    setTimeout(() => btnMatch.classList.remove('btn-error-feedback'), 1500);
                }
                throw new Error(json.message || 'فشل في جلب النتائج');
            }

            // Visual Success for Match Button
            if (btnMatch) {
                btnMatch.classList.remove('btn-loading');
                btnMatch.classList.add('btn-success-feedback');
                setTimeout(() => btnMatch.classList.remove('btn-success-feedback'), 1000);
            }

            // --- RE-APPLY LOCAL METADATA TO NEW RESULTS ---
            const currentModifications = new Map();
            if (this.smartMatchResults) {
                this.smartMatchResults.forEach(item => {
                    const row = item.sourceExcelRow;
                    const mods = {};
                    let hasMetadata = false;
                    Object.keys(row).forEach(k => {
                        if (k.startsWith('_isModified_') || k.startsWith('_original_')) {
                            mods[k] = row[k];
                            hasMetadata = true;
                        }
                    });
                    if (hasMetadata) {
                        const key = `${row.name}_${row.currentAccount}`;
                        currentModifications.set(key, mods);
                    }
                });
            }
            this.smartMatchResults = json.data; // List<MatchResultItem>
            this.showSmartPaymentProgress(86, '\u062c\u0627\u0631\u064a \u0639\u0631\u0636 \u0627\u0644\u0646\u062a\u0627\u0626\u062c...');

            // Re-inject metadata into fresh results
            if (currentModifications.size > 0) {
                this.smartMatchResults.forEach(item => {
                    const key = `${item.sourceExcelRow.name}_${item.sourceExcelRow.currentAccount}`;
                    if (currentModifications.has(key)) {
                        Object.assign(item.sourceExcelRow, currentModifications.get(key));
                    }
                });
            }

            // Redundant early render removed - we render after stats are computed below

            if (results) results.style.display = 'block';



            const totalMatches = json.data.reduce((acc, curr) => acc + ((curr.matches?.length || 0) + (curr.salaryMatches?.length || 0)), 0);

            if (this.smartMatchResults && this.smartMatchResults.length > 0) {
                const execBtn = document.getElementById('btn-smart-execute-active-tab');
                if (execBtn) execBtn.disabled = false;


                // Keep the status selected by the user after rematching.
                const selectedStatus = this.getSmartSelectedStatusKey();
                this.setSmartStatFilter(selectedStatus, false);
                const statusSelect = document.getElementById('smart-status-filter');
                if (statusSelect && statusSelect.value !== selectedStatus) statusSelect.value = selectedStatus;

                // Populate month filter from actual matches only
                this.populateSmartMonthFilter(this.smartMatchResults);

                this.renderSmartPaymentResults();
                this.showSmartPaymentProgress(100, '\u062a\u0645\u062a \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 \u0628\u0646\u062c\u0627\u062d', { success: true, autoHide: true, hideAfter: 900 });


                // Show Execution Group
                document.getElementById('smart-execute-group')?.classList.remove('hidden');
            } else {
                this.showToast('لم يتم العثور على أي بيانات في الملف المرفوع', 'warning');
            }

        } catch (e) {
            console.error('[SMART] Match Error:', e);
            this.showSmartPaymentProgress(100, '\u062a\u0639\u0630\u0631\u062a \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629', { error: true, autoHide: true });
            this.showToast('حدث خطأ أثناء مطابقة البيانات: ' + e.message, 'error');
        } finally {
            if (loading) loading.classList.add('hidden');
            if (btnMatch) btnMatch.disabled = false;
        }
    }

    handleSmartStatusFilterChange(value) {
        if (value === 'تم التسوية') {
            this.showToast('تنبيه: لقد اخترت عرض السجلات المسواة فقط. يرجى العلم أن هذه السجلات قد اكتملت إجرائياً.', 'warning');
        }

        // إعادة تشغيل المطابقة تلقائياً لتحديث النتائج بناءً على الفلتر الجديد
        if (this.smartExcelData && this.smartExcelData.length > 0) {
            this.runSmartPaymentMatch();
        }
    }

    updateSmartStatusFilter(element) {
        if (!element) return;
        const parent = element.parentElement;
        parent.querySelectorAll('.smart-filter-card').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        const value = element.getAttribute('data-value');
        this.handleSmartStatusFilterChange(value);
    }

    switchSmartTab(type, element) {
        if (!element) return;

        // UI Updates for Tabs
        const parent = element.parentElement;
        parent.querySelectorAll('.smart-tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.color = '#94a3b8';
            btn.style.background = 'rgba(255,255,255,0.05)';
            btn.style.border = '1px solid rgba(255,255,255,0.1)';
            btn.style.fontWeight = '600';
            btn.style.boxShadow = 'none';
        });

        const activeColor = type === 'incentive' ? '#fbbf24' : '#10b981';
        element.classList.add('active');
        element.style.color = '#000';
        element.style.background = activeColor;
        element.style.border = 'none';
        element.style.fontWeight = '800';
        element.style.boxShadow = `0 4px 15px ${activeColor}66`;

        // Update Logic State
        this.smartPaymentTypeFilter = type; // 'salary' or 'incentive'
        console.log('[SMART] Tab switched to:', type);

        // Refresh Current View
        if (this.smartExcelData && this.smartExcelData.length > 0) {
            // إعادة المطابقة تلقائياً للتحديث من قاعدة البيانات للنوع الجديد
            this.runSmartPaymentMatch();
        } else if (this.smartMatchResults && this.smartMatchResults.length > 0) {
            // Update month filter options based on the new tab context
            this.populateSmartMonthFilter(this.smartMatchResults);
            this.renderSmartPaymentResults();
        } else {
            // Optional: reset upload UI if not processed
            const statusHeader = document.getElementById('smart-payment-status-header');
            if (statusHeader) statusHeader.textContent = `جاهز لرفع ملف ${type === 'salary' ? 'المرتبات' : 'الحوافز'}`;
        }
    }

    updateSmartTypeFilter(element) {
        // Redundant with new Tabs, but keeping for compatibility if ever needed
        if (!element) return;
        this.switchSmartTab(element.getAttribute('data-value'), element);
    }


    updateSmartStatusFilter(element) {
        if (!element) return;
        const color = '#00f0ff';
        const parent = element.parentElement;

        parent.querySelectorAll('.smart-filter-card').forEach(el => {
            el.classList.remove('active');
            el.style.background = 'transparent';
            el.style.boxShadow = 'none';
            el.style.border = `1px solid rgba(255,255,255,0.05)`;
            el.style.color = '#94a3b8';
        });

        element.classList.add('active');
        element.style.background = `linear-gradient(135deg, rgba(0, 240, 255, 0.4) 0%, rgba(0, 240, 255, 0.6) 100%)`;
        element.style.boxShadow = `0 4px 12px rgba(0, 240, 255, 0.2)`;
        element.style.color = '#fff';
        element.style.border = `1px solid rgba(0, 240, 255, 0.4)`;

        const filterValue = element.getAttribute('data-value') || 'الكل';
        this.setSmartStatFilter(this._mapStatusToKey(filterValue));
    }

    populateSmartMonthFilter(results) {
        const select = document.getElementById('smart-month-filter');
        const fileSelect = document.getElementById('smart-file-code-filter');
        if (!select) return;

        const months = new Set();
        const fileCodes = new Set();
        const activeType = this.smartPaymentTypeFilter || 'salary';

        (results || []).forEach(item => {
            const processMatches = (matches) => {
                (matches || []).forEach(m => {
                    const fCode = m.batchCode || m.BatchCode || m.fileCode || m.FileCode || '';
                    const month = m.month || m.Month || this.extractMonthFromFileCode(fCode) || 'فارغ';
                    if (month) months.add(month);
                    if (fCode) fileCodes.add(fCode);
                });
            };

            // Process based on active tab preference but keep all available months for better UX
            processMatches(item.salaryMatches);
            processMatches(item.matches);

            // Also check source row
            const srcFCode = item.sourceExcelRow.batchCode || item.sourceExcelRow.BatchCode || item.sourceExcelRow.fileCode || '';
            const srcMonth = item.sourceExcelRow.month || item.sourceExcelRow.Month || this.extractMonthFromFileCode(srcFCode) || 'فارغ';
            if (srcMonth && srcMonth !== 'فارغ') months.add(srcMonth);
            if (srcFCode) fileCodes.add(srcFCode);
        });

        // --- Populate Months ---
        const sortedMonths = Array.from(months).sort();
        const currentVal = select.value;
        select.innerHTML = `<option value="">كل الأشهر (${activeType === 'incentive' ? 'الحوافز' : 'المرتبات'})</option>`;
        sortedMonths.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            select.appendChild(opt);
        });
        if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
            select.value = currentVal;
        }

        // --- Populate File Codes ---
        if (fileSelect) {
            const sortedFiles = Array.from(fileCodes).sort();
            const currentFileVal = fileSelect.value;
            fileSelect.innerHTML = `<option value="">-- كل أكواد الملفات (${sortedFiles.length}) --</option>`;
            sortedFiles.forEach(fc => {
                const opt = document.createElement('option');
                opt.value = fc;
                opt.textContent = fc;
                fileSelect.appendChild(opt);
            });
            if (currentFileVal && Array.from(fileSelect.options).some(o => o.value === currentFileVal)) {
                fileSelect.value = currentFileVal;
            }
        }
    }


    setSmartMatchMethod(method, element) {
        if (!element) return;
        const color = '#00f0ff';
        const parent = element.parentElement;

        parent.querySelectorAll('.match-mode-chip').forEach(el => {
            el.classList.remove('active');
            el.style.background = 'transparent';
            el.style.boxShadow = 'none';
            el.style.border = '1px solid transparent';
            el.style.color = '#94a3b8';
        });

        element.classList.add('active');
        element.style.background = `linear-gradient(135deg, rgba(0, 240, 255, 0.5) 0%, rgba(0, 240, 255, 0.7) 100%)`;
        element.style.boxShadow = `0 0 15px rgba(0, 240, 255, 0.3)`;
        element.style.color = '#fff';
        element.style.border = `1px solid rgba(0, 240, 255, 0.4)`;

        this.smartMatchBy = method;
        console.log('[SMART] Match method set to:', method);
        
        // تشغيل المطابقة التلقائية فور تغيير الفلتر إذا كان هناك بيانات مرفوعة
        if (this.smartExcelData && this.smartExcelData.length > 0) {
            this.runSmartPaymentMatch();
        }
    }

    getSmartSelectedStatusKey() {
        const select = document.getElementById('smart-status-filter');
        if (select && select.value) return this._mapStatusToKey(select.value);

        const activeStatusChip = document.querySelector('.smart-filter-card.active');
        if (activeStatusChip) return this._mapStatusToKey(activeStatusChip.getAttribute('data-value'));

        return this.smartPaymentStatFilter || 'all';
    }

    _mapStatusToKey(val) {
        const normalized = String(val || '').trim();
        if (['all', 'matched', 'unmatched', 'incentive', 'notfound'].includes(normalized)) return normalized;
        if (/\u062a\u0645/.test(normalized) && !/\u0644\u0645/.test(normalized)) return 'incentive';
        if (/\u0644\u0645|\u062a\u062d\u062a/.test(normalized)) return 'notfound';
        if (val === 'تم التسوية') return 'incentive'; // Mapping for internal logic
        if (val === 'لم يتم التسوية') return 'notfound';
        return 'all';
    }

    applySmartLocalFilters() {
        if (!this.smartMatchResults) return;
        // Determine search values based on what's visible
        const nameInp = document.getElementById('smart-filter-name');
        const nidInp = document.getElementById('smart-filter-nid');

        const nameVal = (nameInp?.value || '').trim();
        const nidVal = (nidInp?.value || '').trim();

        // Local Filter Logic
        const results = this.smartMatchResults.filter(item => {
            const row = item.sourceExcelRow || {};
            const rowName = String(row.name || '').toLowerCase();
            const rowNid = String(row.nationalId || '').toLowerCase();

            const matchName = !nameVal || rowName.includes(nameVal.toLowerCase());
            const matchNid = !nidVal || rowNid.includes(nidVal.toLowerCase());

            return matchName && matchNid;
        });

        this.renderSmartPaymentResults(results);
    }

    setSmartStatFilter(filterType, triggerRender = true) {
        this.smartPaymentStatFilter = filterType;
        console.log('[SMART] Active Stat Filter:', filterType);



        if (triggerRender) {
            this.renderSmartPaymentResults();
        }
    }

    isSmartPaymentMatchSettled(m) {
        if (!m) return false;
        const status = String(m.status || m.Status || m['حالة التسوية'] || '').trim();
        if (status && /تم/.test(status) && !/لم/.test(status)) return true;
        if (status && /لم|تحت/.test(status)) return false;

        const dbSNo = m.settlementNo || m['رقم تسوية السداد'] || m.SettlementNo || '';
        return String(dbSNo).trim() !== '' && String(dbSNo).trim() !== '---' && String(dbSNo).trim() !== '0';
    }

    smartPaymentMatchPassesFilters(item, match) {
        const activeType = this.smartPaymentTypeFilter || 'salary';
        const selectedMonth = document.getElementById('smart-month-filter')?.value || 'all';
        const selectedFileCode = document.getElementById('smart-file-code-filter')?.value || '';
        const sf = this.smartPaymentStatFilter || 'all';
        const row = item?.sourceExcelRow || {};

        const fCode = match
            ? (match.batchCode || match.BatchCode || match.fileCode || match.FileCode || '')
            : (row.batchCode || row.BatchCode || row.fileCode || '');
        const month =
            (match ? (match.month || match.Month) : (row.month || row.Month)) ||
            this.extractMonthFromFileCode(fCode) ||
            'فارغ';

        if (selectedMonth !== 'all' && selectedMonth !== '' && month !== selectedMonth) return false;
        if (selectedFileCode !== '' && fCode !== selectedFileCode) return false;

        if (!match) return sf === 'all' || sf === 'unmatched';

        const settled = this.isSmartPaymentMatchSettled(match);
        if (sf === 'unmatched') return false;
        if (sf === 'matched') return true;
        if (sf === 'incentive') return settled;
        if (sf === 'notfound') return !settled;
        return true;
    }

    getSmartPaymentFilteredItems(sourceData = this.smartMatchResults) {
        const activeType = this.smartPaymentTypeFilter || 'salary';
        const relevantMatches = (item) => activeType === 'incentive'
            ? (item.matches || [])
            : (item.salaryMatches || []);

        return (sourceData || []).filter(item => {
            const matches = relevantMatches(item);
            if (matches.length === 0) return this.smartPaymentMatchPassesFilters(item, null);
            return matches.some(match => this.smartPaymentMatchPassesFilters(item, match));
        });
    }

    getSmartPaymentStatusText(record) {
        const rawStatus = String(record?.status || record?.Status || record?.['حالة التسوية'] || '').trim();
        if (rawStatus) return rawStatus;
        return this.isSmartPaymentMatchSettled(record) ? 'تم السداد' : 'لم يتم السداد';
    }

    getSmartPaymentExecutableValues(row) {
        const cleanValue = (val) => {
            if (val === undefined || val === null) return '';
            const s = String(val).trim();
            if (!s || s === '---' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '';
            return s;
        };
        const firstAvailable = (...keys) => {
            for (const key of keys) {
                const value = cleanValue(row?.[key]);
                if (value) return value;
            }
            return '';
        };

        return {
            settlementNo: firstAvailable('settlementNo', 'SettlementNo', '\u0631\u0642\u0645 \u062a\u0633\u0648\u064a\u0629 \u0627\u0644\u0633\u062f\u0627\u062f'),
            settlementDate: firstAvailable('settlementDate', 'SettlementDate', '\u062a\u0627\u0631\u064a\u062e \u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u062a\u0639\u062f\u064a\u0644 / \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0633\u062f\u0627\u062f'),
            modifiedAccount: firstAvailable('modifiedAccount', 'ModifiedAccount', '\u0631\u0642\u0645 \u0627\u0644\u062d\u0633\u0627\u0628 \u0628\u0639\u062f \u0627\u0644\u062a\u0639\u062f\u064a\u0644'),
            modifiedBank: firstAvailable('modifiedBank', 'ModifiedBank', '\u0627\u0644\u0628\u0646\u0643 \u0628\u0639\u062f \u0627\u0644\u062a\u0639\u062f\u064a\u0644'),
            modDate: firstAvailable('modDate', 'ModDate', '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0639\u062f\u064a\u0644'),
            modApprovalDate: firstAvailable('modApprovalDate', 'ModApprovalDate', '\u062a\u0627\u0631\u064a\u062e \u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u062a\u0639\u062f\u064a\u0644'),
            returnApprovalDate: firstAvailable('returnApprovalDate', 'ReturnApprovalDate', '\u062a\u0627\u0631\u064a\u062e \u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u0645\u0631\u062a\u062f\u0627\u062a')
        };
    }

    smartPaymentRowHasExecutableValues(row) {
        const values = this.getSmartPaymentExecutableValues(row);
        return Object.values(values).some(Boolean);
    }

    showSmartSettlementProgress(total) {
        let box = document.getElementById('smart-settlement-progress');
        if (!box) {
            box = document.createElement('div');
            box.id = 'smart-settlement-progress';
            box.style.cssText = 'direction:rtl;margin:12px 0;padding:14px 16px;border:1px solid rgba(0,240,255,.28);border-radius:10px;background:rgba(15,23,42,.78);box-shadow:0 10px 24px rgba(0,0,0,.22);';
            box.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">
                    <strong id="smart-settlement-progress-title" style="color:#e5faff;font-size:.92rem;">جاري تنفيذ السداد</strong>
                    <span id="smart-settlement-progress-count" style="color:#00f0ff;font-weight:800;font-size:.82rem;">0 / ${total}</span>
                </div>
                <div style="height:10px;border-radius:999px;background:rgba(148,163,184,.18);overflow:hidden;">
                    <div id="smart-settlement-progress-bar" style="width:0%;height:100%;border-radius:999px;background:linear-gradient(90deg,#00f0ff,#10b981);transition:width .22s ease;"></div>
                </div>
                <div id="smart-settlement-progress-text" style="margin-top:8px;color:#94a3b8;font-size:.78rem;">تجهيز السجلات...</div>
            `;
            const anchor = document.getElementById('smart-payment-results') || document.getElementById('smart-execute-group');
            if (anchor?.parentNode) anchor.parentNode.insertBefore(box, anchor);
        }
        box.style.display = 'block';
        const title = document.getElementById('smart-settlement-progress-title');
        if (title) title.textContent = 'جاري تنفيذ السداد';
        this.updateSmartSettlementProgress(0, total, 'تجهيز السجلات...');
    }

    updateSmartSettlementProgress(done, total, text) {
        const safeTotal = Math.max(1, Number(total) || 1);
        const safeDone = Math.min(safeTotal, Math.max(0, Number(done) || 0));
        const percent = Math.round((safeDone / safeTotal) * 100);
        const bar = document.getElementById('smart-settlement-progress-bar');
        const count = document.getElementById('smart-settlement-progress-count');
        const label = document.getElementById('smart-settlement-progress-text');
        if (bar) bar.style.width = `${percent}%`;
        if (count) count.textContent = `${safeDone} / ${safeTotal}`;
        if (label) label.textContent = text || `تم تحديث ${safeDone} من ${safeTotal}`;
    }

    completeSmartSettlementProgress(total, text) {
        this.updateSmartSettlementProgress(total, total, text || 'تم تنفيذ السداد بنجاح');
        const title = document.getElementById('smart-settlement-progress-title');
        if (title) title.textContent = 'تم تنفيذ السداد';
    }

    hideSmartSettlementProgress(delay = 2500) {
        const box = document.getElementById('smart-settlement-progress');
        if (!box) return;
        setTimeout(() => {
            const current = document.getElementById('smart-settlement-progress');
            if (current) current.style.display = 'none';
        }, delay);
    }

    renderSmartPaymentResults(data) {
        const resultsContainer = document.getElementById('smart-payment-results');
        if (!resultsContainer) return;

        // Fallback to internal results if no data provided
        const sourceData = data || this.smartMatchResults;
        if (!sourceData || sourceData.length === 0) {
            resultsContainer.innerHTML = '<div class="unified-table-empty">لا توجد نتائج مطابقة</div>';
            return;
        }

        // Apply Stat Filter (Settled / Not Settled / All)
        const isMatchSettled = (m) => {
            if (!m) return false;
            const dbSNo = m.settlementNo || m['رقم تسوية السداد'] || m.SettlementNo || '';
            return String(dbSNo).trim() !== '' && String(dbSNo).trim() !== '---';
        };

        let filtered = sourceData;
        const sf = this.smartPaymentStatFilter || 'all';

        if (sf === 'incentive') {
            filtered = sourceData.filter(r => (r.matches && r.matches.some(m => isMatchSettled(m, r.sourceExcelRow))) ||
                                             (r.salaryMatches && r.salaryMatches.some(m => isMatchSettled(m, r.sourceExcelRow))));
        } else if (sf === 'notfound') {
            filtered = sourceData.filter(r => {
                const noIncentiveMatch = !r.matches || r.matches.length === 0 || r.matches.every(m => !isMatchSettled(m, r.sourceExcelRow));
                const noSalaryMatch = !r.salaryMatches || r.salaryMatches.length === 0 || r.salaryMatches.every(m => !isMatchSettled(m, r.sourceExcelRow));
                return noIncentiveMatch && noSalaryMatch;
            });
        } else if (sf === 'matched') {
            filtered = sourceData.filter(r => (r.matches && r.matches.length > 0) || (r.salaryMatches && r.salaryMatches.length > 0));
        } else if (sf === 'unmatched') {
            filtered = sourceData.filter(r => (!r.matches || r.matches.length === 0) && (!r.salaryMatches || r.salaryMatches.length === 0));
        }

        const selectedMonth = document.getElementById('smart-month-filter')?.value || 'all';
        const selectedFileCode = document.getElementById('smart-file-code-filter')?.value || '';
        const activeType = this.smartPaymentTypeFilter || 'salary';

        filtered = this.getSmartPaymentFilteredItems(sourceData);
        console.log(`[SMART-RENDER] Starting with filters: Month=${selectedMonth}, FileCode=${selectedFileCode}, Type=${activeType}`);

        // Final frontend filtering before render
        if (selectedMonth !== 'all' && selectedMonth !== '') {
            filtered = filtered.filter(item => {
                const fCode = item.sourceExcelRow.batchCode || item.sourceExcelRow.BatchCode || item.sourceExcelRow.fileCode || '';
                const mMonth = item.sourceExcelRow.month || item.sourceExcelRow.Month || this.extractMonthFromFileCode(fCode) || 'فارغ';
                if (mMonth === selectedMonth) return true;

                const relevantMatches = activeType === 'incentive' ? (item.matches || []) : (item.salaryMatches || []);
                return relevantMatches.some(m => {
                    const mfCode = m.batchCode || m.BatchCode || m.fileCode || m.FileCode || '';
                    const mmMonth = m.month || m.Month || this.extractMonthFromFileCode(mfCode) || 'فارغ';
                    return mmMonth === selectedMonth;
                });
            });
        }

        if (selectedFileCode !== '') {
            filtered = filtered.filter(item => {
                const fCode = item.sourceExcelRow.batchCode || item.sourceExcelRow.BatchCode || item.sourceExcelRow.fileCode || '';
                if (fCode === selectedFileCode) return true;

                const relevantMatches = activeType === 'incentive' ? (item.matches || []) : (item.salaryMatches || []);
                return relevantMatches.some(m => {
                    const mfCode = m.batchCode || m.BatchCode || m.fileCode || m.FileCode || '';
                    return mfCode === selectedFileCode;
                });
            });
        }

        console.log(`[SMART-RENDER] Groups after top-level filtering: ${filtered.length}`);

        // Calculate statistics based on source file
        const totalLoadedCount = this.smartMatchResults ? this.smartMatchResults.length : 0;
        let matchedCount = 0;
        let missingCount = 0;
        
        if (this.smartMatchResults) {
            this.smartMatchResults.forEach(item => {
                const matches = activeType === 'incentive' ? (item.matches || []) : (item.salaryMatches || []);
                if (matches.length > 0) {
                    matchedCount++;
                } else {
                    missingCount++;
                }
            });
        }

        const statsHtml = `
            <!-- Summary Bar -->
            <div class="summary-bar" style="direction: rtl;">
                <div class="summary-item blue">
                <span class="summary-icon"><i class="fas fa-list"></i></span>
                <div>
                    <small>إجمالي النتائج</small>
                    <strong>${totalLoadedCount}</strong>
                </div>
                </div>

                <div class="summary-item green">
                <span class="summary-icon"><i class="fas fa-check"></i></span>
                <div>
                    <small>سجلات مطابقة</small>
                    <strong>${matchedCount}</strong>
                </div>
                </div>

                <div class="summary-item red">
                <span class="summary-icon"><i class="fas fa-times"></i></span>
                <div>
                    <small>غير مطابقة</small>
                    <strong>${missingCount}</strong>
                </div>
                </div>

            </div>
        `;

        resultsContainer.innerHTML = statsHtml;

        if (filtered.length === 0) {
            resultsContainer.innerHTML += '<div class="unified-table-empty">لا توجد نتائج تطابق هذا التصنيف</div>';
            return;
        }

        // Generate one row for every actual DB match. Unmatched Excel rows stay visible in red.
        let rowsHtml = '';
        let rowCount = 1;
        let renderedRowCount = 0;
        const cleanVal = (val) => {
            if (val === undefined || val === null) return '';
            const s = String(val).trim();
            return (!s || s === '---' || s === 'null' || s === 'undefined') ? '' : s;
        };
        const dbVal = (record, ...keys) => {
            if (!record) return '';
            for (const key of keys) {
                const value = cleanVal(record[key]);
                if (value) return value;
            }
            return '';
        };
        const sourceButton = (origIdx) => `<button class="source-btn" style="background: rgba(0, 240, 255, 0.15); border: 1px solid #00f0ff; padding: 6px 12px; border-radius: 6px; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.background='#00f0ff'; this.style.color='#000';" onmouseout="this.style.background='rgba(0, 240, 255, 0.15)'; this.style.color='#fff';" onclick="app.showSmartSourceDetails(${origIdx})">عرض المصدر</button>`;
        
        filtered.forEach((item, index) => {
            const row = item.sourceExcelRow;
            const rawMatches = activeType === 'incentive' ? (item.matches || []) : (item.salaryMatches || []);
            const matchesToRender = rawMatches.filter(match => this.smartPaymentMatchPassesFilters(item, match));
            const hasMatches = matchesToRender.length > 0;
            const origIdx = this.smartMatchResults.indexOf(item);

            if (!hasMatches && rawMatches.length > 0) return;

            if (!hasMatches) {
                const batchCode = cleanVal(row.batchCode || row.BatchCode || row.fileCode || row.FileCode) || '---';
                const month = cleanVal(row.month || row.Month) || this.extractMonthFromFileCode(batchCode) || '---';
                const excelAmount = cleanVal(row.amount || row.Amount || row['المبلغ'] || row['قيمة العملية']) || '---';
                renderedRowCount++;
                rowsHtml += `
                    <tr style="background: rgba(239, 68, 68, 0.08);">
                        <td>${rowCount++}</td>
                        <td>${batchCode}</td>
                        <td class="month">${month}</td>
                        <td class="name" style="color:#f87171;">${cleanVal(row.name || row.Name || row['الاسم']) || '---'}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td>${excelAmount}</td>
                        <td><span class="smart-badge danger">غير مطابق</span></td>
                        <td>${sourceButton(origIdx)}</td>
                    </tr>
                `;
                return;
            }

            matchesToRender.forEach(dbRecord => {
                const batchCode = dbVal(dbRecord, 'batchCode', 'BatchCode', 'fileCode', 'FileCode') || '---';
                const month = dbVal(dbRecord, 'month', 'Month') || this.extractMonthFromFileCode(batchCode) || '---';
                const name = dbVal(dbRecord, 'name', 'Name', 'الاسم') || '---';
                const modifiedAcc = dbVal(dbRecord, 'رقم الحساب بعد التعديل', 'modifiedAccount', 'ModifiedAccount', 'newAccountNumber', 'newAccount');
                const modifiedBankName = dbVal(dbRecord, 'البنك بعد التعديل', 'modifiedBank', 'ModifiedBank', 'newBankName', 'newBank');
                const settlementNo = dbVal(dbRecord, 'رقم تسوية السداد', 'settlementNo', 'SettlementNo');
                const rawSettlementDate = dbVal(dbRecord, 'تاريخ اعتماد التعديل / تاريخ السداد', 'settlementDate', 'SettlementDate', 'تاريخ السداد', 'تاريخ التسوية');
                const settlementDate = this.formatDate(rawSettlementDate) || rawSettlementDate || '---';
                const amount = dbVal(dbRecord, 'amount', 'Amount', 'قيمة العملية', 'المبلغ') || '---';
                const statusText = this.getSmartPaymentStatusText(dbRecord);
                const statusBadge = this.isSmartPaymentMatchSettled(dbRecord)
                    ? `<span class="smart-badge settled">${statusText}</span>`
                    : `<span class="smart-badge pending">${statusText}</span>`;

                renderedRowCount++;
                rowsHtml += `
                    <tr>
                        <td>${rowCount++}</td>
                        <td>${batchCode}</td>
                        <td class="month">${month}</td>
                        <td class="name">${name}</td>
                        <td><div style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; font-weight: bold; color: #10B981;" title="${modifiedAcc}">${modifiedAcc}</div></td>
                        <td style="font-weight: bold; color: #10B981;">${modifiedBankName}</td>
                        <td style="font-family: monospace;">${settlementNo}</td>
                        <td>${settlementDate}</td>
                        <td>${amount}</td>
                        <td>${statusBadge}</td>
                        <td>${sourceButton(origIdx)}</td>
                    </tr>
                `;
            });
        });

        const tableHtml = `
            <!-- Results Table -->
            <div class="table-section" style="direction: rtl;">
                <div class="table-header">
                <span class="count-pill">${renderedRowCount} سجل</span>
                <h3>${activeType === 'incentive' ? 'مطابقات الحوافز' : 'مطابقات المرتبات'} 🧾</h3>
                </div>

                <div style="overflow-x: auto;">
                    <table class="settlement-table">
                    <thead>
                        <tr>
                        <th>#</th>
                        <th>كود الملف</th>
                        <th>الشهر</th>
                        <th>الاسم</th>
                        <th>رقم الحساب بعد التعديل</th>
                        <th>البنك بعد التعديل</th>
                        <th>رقم تسوية السداد</th>
                        <th>تاريخ اعتماد التعديل / تاريخ السداد</th>
                        <th>المبلغ</th>
                        <th>حالة السداد الحالية</th>
                        <th>عرض المصدر</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    </table>
                </div>
            </div>
        `;

        resultsContainer.innerHTML += tableHtml;

    }

    updateSmartExcelValue(index, field, value) {
        if (!this.smartMatchResults || !this.smartMatchResults[index]) return;
        const row = this.smartMatchResults[index].sourceExcelRow;
        const oKey = `_original_${field}`;
        if (row[oKey] === undefined) row[oKey] = row[field];
        row[field] = value;
        row[`_isModified_${field}`] = (String(value).trim() !== String(row[oKey]).trim());
    }

    showSmartSourceDetails(index) {
        if (!this.smartMatchResults || !this.smartMatchResults[index]) return;
        const item = this.smartMatchResults[index];
        const row = item.sourceExcelRow;
        const activeType = this.smartPaymentTypeFilter || 'salary';
        const matchesToRender = activeType === 'incentive' ? (item.matches || []) : (item.salaryMatches || []);
        const dbRecord = matchesToRender.length > 0 ? matchesToRender[0] : null;
        
        document.getElementById('smart-source-modal')?.remove();
        
        const modal = document.createElement('div');
        modal.id = 'smart-source-modal';
        modal.className = 'modal-overlay show';
        modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100000; display: flex; align-items: center; justify-content: center; direction: rtl; padding: 20px;';
        
        // استبعاد الحقول الداخلية التي تبدأ بـ _
        const keys = Object.keys(row).filter(k => !k.startsWith('_'));
        let fieldsHtml = '';
        const arabicNames = {
            'name': 'الاسم',
            'nationalId': 'الرقم القومي',
            'batchCode': 'كود الملف',
            'BatchCode': 'كود الملف',
            'fileCode': 'كود الملف',
            'FileCode': 'كود الملف',
            'month': 'الشهر',
            'Month': 'الشهر',
            'currentBank': 'البنك الحالي',
            'currentAccount': 'الحساب الحالي',
            'modifiedAccount': 'الحساب المعدل',
            'modifiedBank': 'البنك المعدل',
            'amount': 'المبلغ',
            'returnDate': 'تاريخ المرتجع',
            'modDate': 'تاريخ التعديل',
            'returnApprovalDate': 'تاريخ اعتماد المرتجع',
            'modApprovalDate': 'تاريخ اعتماد التعديل',
            'settlementNo': 'رقم التسوية',
            'settlementDate': 'تاريخ التسوية',
            'status': 'الحالة',
            'notes': 'ملاحظات'
        };

        keys.forEach(key => {
            const val = row[key] !== undefined && row[key] !== null ? row[key] : '';
            const labelText = arabicNames[key] || key;
            fieldsHtml += `
                <div style="display: flex; flex-direction: column; align-items: flex-start; width: 100%;">
                    <label style="color: #cbd5e1; font-size: 0.95rem; font-weight: 500; display: block; margin-bottom: 8px; text-align: right; width: 100%;">${labelText}</label>
                    <input type="text" data-field="${key}" value="${val}" class="smart-edit-field" style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; color: #fff; font-family: inherit; font-size: 1rem; transition: border-color 0.2s; outline: none; text-align: right;" onfocus="this.style.borderColor='#00f0ff'" onblur="this.style.borderColor='rgba(255,255,255,0.15)'">
                </div>
            `;
        });

        modal.innerHTML = `
            <div style="background: #1e293b; border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 16px; width: 820px; max-width: 95vw; padding: 30px; box-shadow: 0 10px 50px rgba(0,0,0,0.7); display: flex; flex-direction: column; max-height: 90vh; position: relative; z-index: 100001; margin: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 25px; flex-shrink: 0;">
                    <h3 style="color: #fff; margin: 0; font-size: 1.25rem; font-weight: 600;">بيانات ملف Excel المصدر</h3>
                    <button onclick="document.getElementById('smart-source-modal').remove()" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; width: 36px; height: 36px; border-radius: 8px; font-size: 1.4rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
                </div>
                <div style="overflow-y: auto; padding-right: 10px; flex-grow: 1; text-align: right;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        ${fieldsHtml}
                    </div>
                </div>
                <div style="margin-top: 30px; display: flex; justify-content: flex-end; gap: 15px; flex-shrink: 0; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <button onclick="document.getElementById('smart-source-modal').remove()" style="padding: 12px 24px; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem;">إغلاق</button>
                    <button onclick="app.saveSmartSourceDetails(${index})" style="padding: 12px 24px; background: linear-gradient(135deg, #00f0ff, #0284c7); color: #000; font-weight: 700; font-size: 1rem; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 15px rgba(0, 240, 255, 0.3);">حفظ تعديلات المصدر</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (false) {

        let dbRecordHtml = '';
        if (dbRecord) {
            dbRecordHtml = `
                <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 15px; height: fit-content; text-align: right; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.1);">
                    <div style="display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid rgba(16, 185, 129, 0.2); padding-bottom: 12px; margin-bottom: 5px;">
                        <h4 style="color: #10b981; margin: 0; font-size: 1.15rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">🟢 السجل المطابق في قاعدة البيانات</h4>
                        <button class="source-btn" style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; padding: 8px 14px; border-radius: 8px; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600; transition: all 0.2s; font-size: 0.9rem;" onmouseover="this.style.background='#f59e0b'; this.style.color='#000';" onmouseout="this.style.background='rgba(245, 158, 11, 0.15)'; this.style.color='#fff';" onclick="app.openAttachmentsModal(${dbRecord.id || dbRecord.Id}, '${activeType === 'incentive' ? 'returns' : 'salary'}')">🖼️ عرض المرفقات (وجه/ظهر)</button>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.95rem; line-height: 1.5;">
                        <div><strong style="color: #94a3b8; display: inline-block; width: 120px;">الاسم بالكامل:</strong> <span style="color: #fff; font-weight: 600;">${dbRecord.name || '---'}</span></div>
                        <div><strong style="color: #94a3b8; display: inline-block; width: 120px;">الرقم القومي:</strong> <span style="color: #fff; font-family: monospace; letter-spacing: 0.5px;">${dbRecord.nationalId || '---'}</span></div>
                        <div><strong style="color: #94a3b8; display: inline-block; width: 120px;">رقم الحساب:</strong> <span style="color: #fff; font-family: monospace; letter-spacing: 0.5px;">${dbRecord.currentAccount || '---'}</span></div>
                        <div><strong style="color: #94a3b8; display: inline-block; width: 120px;">اسم البنك:</strong> <span style="color: #fff;">${dbRecord.currentBank || '---'}</span></div>
                        <div><strong style="color: #94a3b8; display: inline-block; width: 120px;">كود الملف:</strong> <span style="color: #fff; font-family: monospace;">${dbRecord.batchCode || '---'}</span></div>
                        <div><strong style="color: #94a3b8; display: inline-block; width: 120px;">المبلغ:</strong> <span style="color: #fbbf24; font-weight: 700; font-size: 1.05rem;">${dbRecord.amount !== undefined && dbRecord.amount !== null ? dbRecord.amount : (dbRecord.Amount !== undefined ? dbRecord.Amount : '---')}</span></div>
                        <div><strong style="color: #94a3b8; display: inline-block; width: 120px;">الحالة الحالية:</strong> <span class="smart-badge success" style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #10b981;">${dbRecord.status || 'لم يتم التسوية'}</span></div>
                    </div>
                </div>
            `;
        } else {
            dbRecordHtml = `
                <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 25px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 15px; color: #ef4444; height: 260px; text-align: center;">
                    <div style="font-size: 3rem;">⚠️</div>
                    <strong style="font-size: 1.15rem;">لا يوجد سجل مطابق بقاعدة البيانات</strong>
                    <span style="font-size: 0.85rem; color: #94a3b8; line-height: 1.4;">لم نتمكن من العثور على أي تطابق للاسم أو الرقم القومي في جدول ${activeType === 'incentive' ? 'المرتدات' : 'المرتبات'}. يرجى التحقق من صحة البيانات المرفوعة.</span>
                </div>
            `;
        }

        const html = `
            <div style="background: #1e293b; border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 16px; width: 1050px; max-width: 95vw; padding: 30px; box-shadow: 0 10px 50px rgba(0,0,0,0.7); display: flex; flex-direction: column; max-height: 90vh; position: relative; z-index: 100001; margin: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 25px; flex-shrink: 0;">
                    <h3 style="color: #fff; margin: 0; font-size: 1.4rem; font-weight: 600;">مطابقة ومراجعة السجل مع قاعدة البيانات 🔍</h3>
                    <button onclick="document.getElementById('smart-source-modal').remove()" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; width: 36px; height: 36px; border-radius: 8px; font-size: 1.4rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#ef4444'; this.style.color='#fff';" onmouseout="this.style.background='rgba(239, 68, 68, 0.15)'; this.style.color='#ef4444';">&times;</button>
                </div>
                <div style="display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 30px; overflow-y: auto; padding-right: 10px; flex-grow: 1;">
                    <!-- Right Column: Excel Fields -->
                    <div style="text-align: right;">
                        <h4 style="color: #00f0ff; margin-top: 0; margin-bottom: 20px; font-size: 1.1rem; border-bottom: 1px solid rgba(0, 240, 255, 0.2); padding-bottom: 8px; font-weight: 700;">📝 تعديل قيم ملف Excel المرفوع</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            ${fieldsHtml}
                        </div>
                    </div>
                    <!-- Left Column: Database Record & Actions -->
                    <div>
                        ${dbRecordHtml}
                    </div>
                </div>
                <div style="margin-top: 30px; display: flex; justify-content: flex-end; gap: 15px; flex-shrink: 0; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <button onclick="document.getElementById('smart-source-modal').remove()" style="padding: 12px 24px; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">إلغاء</button>
                    <button onclick="app.saveSmartSourceDetails(${index})" style="padding: 12px 24px; background: linear-gradient(135deg, #00f0ff, #0284c7); color: #000; font-weight: 700; font-size: 1rem; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 15px rgba(0, 240, 255, 0.3); transition: all 0.2s;" onmouseover="this.style.boxShadow='0 6px 20px rgba(0, 240, 255, 0.5)'" onmouseout="this.style.boxShadow='0 4px 15px rgba(0, 240, 255, 0.3)'">حفظ التعديلات</button>
                </div>
            </div>
        `;
        modal.innerHTML = html;
        document.body.appendChild(modal);
        }
    }

    saveSmartSourceDetails(index) {
        const inputs = document.querySelectorAll('#smart-source-modal .smart-edit-field');
        inputs.forEach(input => {
            const field = input.getAttribute('data-field');
            const value = input.value;
            this.updateSmartExcelValue(index, field, value);
        });
        
        document.getElementById('smart-source-modal')?.remove();
        if (this.showToast) this.showToast('تم حفظ التعديلات لجميع الحقول بنجاح', 'success');
        this.renderSmartPaymentResults();
    }

    async executeSmartPaymentSettlement() {
        console.log('[SMART-SETTLEMENT] Execute clicked', {
            results: this.smartMatchResults?.length || 0,
            type: this.smartPaymentTypeFilter || 'salary',
            status: this.smartPaymentStatFilter || 'all'
        });

        if (!this.smartMatchResults || this.smartMatchResults.length === 0) {
            if (this.showToast) this.showToast('لا توجد بيانات مطابقة لتسويتها', 'warning');
            return;
        }

        const activeType = this.smartPaymentTypeFilter || 'salary';
        const filteredItems = this.getSmartPaymentFilteredItems(this.smartMatchResults);
        const workItems = filteredItems
            .map(item => {
                const rawMatches = activeType === 'incentive' ? (item.matches || []) : (item.salaryMatches || []);
                return {
                    item,
                    row: item.sourceExcelRow || {},
                    matches: rawMatches.filter(match => this.smartPaymentMatchPassesFilters(item, match))
                };
            })
            .filter(x => x.matches.length > 0);

        if (workItems.length === 0) {
            if (this.showToast) this.showToast('لا توجد سجلات مطابقة داخل الفلاتر الحالية لتنفيذ السداد', 'warning');
            alert('\u0644\u0627 \u062a\u0648\u062c\u062f \u0633\u062c\u0644\u0627\u062a \u0645\u0637\u0627\u0628\u0642\u0629 \u062f\u0627\u062e\u0644 \u0627\u0644\u0641\u0644\u0627\u062a\u0631 \u0627\u0644\u062d\u0627\u0644\u064a\u0629 \u0644\u062a\u0646\u0641\u064a\u0630 \u0627\u0644\u0633\u062f\u0627\u062f.');
            console.warn('[SMART-SETTLEMENT] No executable matched rows for current filters.');
            return;
        }

        const rowsWithValues = workItems.filter(x => this.smartPaymentRowHasExecutableValues(x.row));
        if (rowsWithValues.length === 0) {
            const msg = '\u0645\u0644\u0641 Excel \u0627\u0644\u062d\u0627\u0644\u064a \u0644\u0627 \u064a\u062d\u062a\u0648\u064a \u0639\u0644\u0649 \u0642\u064a\u0645 \u0644\u0644\u062a\u062d\u062f\u064a\u062b. \u0627\u0644\u062d\u0642\u0648\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u0645\u062b\u0644 \u0631\u0642\u0645 \u062a\u0633\u0648\u064a\u0629 \u0627\u0644\u0633\u062f\u0627\u062f \u0648\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0633\u062f\u0627\u062f \u0641\u0627\u0631\u063a\u0629.';
            if (this.showToast) this.showToast(msg, 'warning');
            alert(msg);
            console.warn('[SMART-SETTLEMENT] Matched rows found but Excel update values are empty.', workItems.map(x => x.row));
            return;
        }

        const settledTargetsCount = workItems.reduce((count, x) => {
            return count + x.matches.filter(m => this.isSmartPaymentMatchSettled(m)).length;
        }, 0);

        let overwriteSettled = true;
        if (settledTargetsCount > 0) {
            const pass = await prompt(`يوجد ${settledTargetsCount} سجل مسدد سابقاً داخل الفلاتر الحالية. اكتب 1994 لتحديثها مع باقي الصفوف.\nاتركها فارغة لتحديث الصفوف غير المسددة فقط.`);
            overwriteSettled = pass === '1994';
            if (!overwriteSettled && this.showToast) {
                this.showToast('سيتم تحديث الصفوف غير المسددة فقط', 'info');
            }
        }

        let successCount = 0;
        let processedCount = 0;
        const totalUpdates = rowsWithValues.reduce((count, x) => {
            const targets = overwriteSettled
                ? x.matches
                : x.matches.filter(match => !this.isSmartPaymentMatchSettled(match));
            return count + targets.length;
        }, 0);
        if (totalUpdates === 0) {
            if (this.showToast) this.showToast('لا توجد صفوف تحتاج إلى تحديث داخل الفلاتر الحالية', 'info');
            return;
        }
        const executeBtn = document.getElementById('btn-smart-execute-active-tab');
        if (executeBtn) executeBtn.disabled = true;
        this.showSmartSettlementProgress(totalUpdates);
        this.updateSmartSettlementProgress(0, totalUpdates, 'بدء تحديث السجلات...');

        if (this.showGlobalLoading) this.showGlobalLoading('جاري تنفيذ السداد حسب الفلاتر الحالية...');
        
        try {
            const targetCacheType = activeType === 'incentive' ? 'returns' : 'salary';
            const FIELD_SETTLEMENT_NO = '\u0631\u0642\u0645 \u062a\u0633\u0648\u064a\u0629 \u0627\u0644\u0633\u062f\u0627\u062f';
            const FIELD_SETTLEMENT_DATE = '\u062a\u0627\u0631\u064a\u062e \u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u062a\u0639\u062f\u064a\u0644 / \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0633\u062f\u0627\u062f';
            const FIELD_MODIFIED_ACCOUNT = '\u0631\u0642\u0645 \u0627\u0644\u062d\u0633\u0627\u0628 \u0628\u0639\u062f \u0627\u0644\u062a\u0639\u062f\u064a\u0644';
            const FIELD_MODIFIED_BANK = '\u0627\u0644\u0628\u0646\u0643 \u0628\u0639\u062f \u0627\u0644\u062a\u0639\u062f\u064a\u0644';
            const FIELD_MOD_DATE = '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0639\u062f\u064a\u0644';
            const FIELD_MOD_APPROVAL_DATE = '\u062a\u0627\u0631\u064a\u062e \u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u062a\u0639\u062f\u064a\u0644';
            const FIELD_RETURN_APPROVAL_DATE = '\u062a\u0627\u0631\u064a\u062e \u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u0645\u0631\u062a\u062f\u0627\u062a';
            const FIELD_STATUS = '\u062d\u0627\u0644\u0629 \u0627\u0644\u062a\u0633\u0648\u064a\u0629';
            const VALUE_SETTLED = '\u062a\u0645 \u0627\u0644\u062a\u0633\u0648\u064a\u0629';
            const DATE_MARKER = '\u062a\u0627\u0631\u064a\u062e';
            const cleanValue = (val) => {
                if (val === undefined || val === null) return '';
                const s = String(val).trim();
                if (!s || s === '---' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '';
                return s;
            };

            const firstAvailable = (row, ...keys) => {
                for (const key of keys) {
                    const value = cleanValue(row[key]);
                    if (value) return value;
                }
                return '';
            };

            for (const { row, matches } of rowsWithValues) {
                const updateData = {};
                const localValues = {};
                const executableValues = this.getSmartPaymentExecutableValues(row);

                const addIfAvailable = (patchKey, localKeys, value) => {
                    if (!value) return;
                    const formatted = patchKey.includes(DATE_MARKER) ? (this.formatDate(value) || value) : value;
                    updateData[patchKey] = formatted;
                    localKeys.forEach(k => { localValues[k] = value; });
                    localKeys.forEach(k => { localValues[k] = formatted; });
                };

                addIfAvailable(FIELD_SETTLEMENT_NO, ['settlementNo', 'SettlementNo', FIELD_SETTLEMENT_NO], executableValues.settlementNo);
                addIfAvailable(FIELD_SETTLEMENT_DATE, ['settlementDate', 'SettlementDate', FIELD_SETTLEMENT_DATE], executableValues.settlementDate);
                addIfAvailable(FIELD_MODIFIED_ACCOUNT, ['modifiedAccount', 'ModifiedAccount', FIELD_MODIFIED_ACCOUNT], executableValues.modifiedAccount);
                addIfAvailable(FIELD_MODIFIED_BANK, ['modifiedBank', 'ModifiedBank', FIELD_MODIFIED_BANK], executableValues.modifiedBank);
                addIfAvailable(FIELD_MOD_DATE, ['modDate', 'ModDate', FIELD_MOD_DATE], executableValues.modDate);
                addIfAvailable(FIELD_MOD_APPROVAL_DATE, ['modApprovalDate', 'ModApprovalDate', FIELD_MOD_APPROVAL_DATE], executableValues.modApprovalDate);
                addIfAvailable(FIELD_RETURN_APPROVAL_DATE, ['returnApprovalDate', 'ReturnApprovalDate', FIELD_RETURN_APPROVAL_DATE], executableValues.returnApprovalDate);

                if (Object.keys(updateData).length === 0) continue;

                const matchesToUpdate = overwriteSettled
                    ? matches
                    : matches.filter(match => !this.isSmartPaymentMatchSettled(match));
                if (matchesToUpdate.length === 0) continue;

                for (const match of matchesToUpdate) {
                    const matchId = match.id || match.Id;
                    let response;
                    console.log('[SMART-SETTLEMENT] Updating row', {
                        id: matchId,
                        type: activeType,
                        updateData
                    });
                    if (activeType === 'incentive') {
                        response = await window.db.updateReturn(matchId, updateData);
                    } else {
                        response = await window.db.updateSalaryReturn(matchId, updateData);
                    }
                    
                    // تحديث الكائن محلياً لتسريع العرض
                    const updatedRecord = response?.record || {
                        ...match,
                        ...updateData,
                        ...localValues,
                        id: matchId
                    };
                    match.id = matchId;
                    match.Id = matchId;
                    Object.assign(match, updatedRecord);
                    Object.assign(match, localValues);
                    if (updateData[FIELD_SETTLEMENT_NO]) {
                        match.status = VALUE_SETTLED;
                        match._isSettled = true;
                        match[FIELD_STATUS] = VALUE_SETTLED;
                    }
                    try {
                        await this._upsertEditedCachedRow?.(targetCacheType, matchId, {
                            ...updatedRecord,
                            ...localValues,
                            id: matchId
                        }, { changedKeys: Object.keys(updateData), deferRender: true });
                    } catch (cacheError) {
                        console.warn('[SMART] Local cache update skipped:', cacheError);
                    }
                    successCount++;
                    processedCount++;
                    this.updateSmartSettlementProgress(
                        processedCount,
                        totalUpdates,
                        `تم تحديث ${processedCount} من ${totalUpdates} سجل`
                    );
                }
            }

            if (this.hideGlobalLoading) this.hideGlobalLoading();
            
            if (successCount > 0) {
                if (this.showToast) this.showToast(`تم تسوية ${successCount} سجل بنجاح.`, 'success');
                this.completeSmartSettlementProgress(totalUpdates, `تم تحديث ${successCount} سجل بنجاح`);
                if (this.smartPaymentStatFilter === 'notfound') {
                    this.smartPaymentStatFilter = 'incentive';
                    const statusSelect = document.getElementById('smart-status-filter');
                    if (statusSelect) statusSelect.value = 'incentive';
                }
                this.renderSmartPaymentResults();
                this.hideSmartSettlementProgress();
                this._syncDataset?.(targetCacheType, { force: true }).catch(() => {});
            } else {
                const msg = '\u0644\u0627 \u062a\u0648\u062c\u062f \u0642\u064a\u0645 \u0645\u062a\u0627\u062d\u0629 \u0645\u0646 Excel \u0644\u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0633\u062c\u0644\u0627\u062a \u062f\u0627\u062e\u0644 \u0627\u0644\u0641\u0644\u0627\u062a\u0631 \u0627\u0644\u062d\u0627\u0644\u064a\u0629.';
                if (this.showToast) this.showToast(msg, 'info');
                alert(msg);
                this.updateSmartSettlementProgress(processedCount, totalUpdates, 'لم يتم تحديث أي سجل');
            }
            
        } catch (error) {
            console.error('[SMART] Error executing settlement:', error);
            if (this.hideGlobalLoading) this.hideGlobalLoading();
            if (this.showToast) this.showToast('حدث خطأ أثناء تنفيذ التسوية', 'error');
            this.updateSmartSettlementProgress(processedCount, totalUpdates || 1, 'حدث خطأ أثناء التنفيذ');
        } finally {
            if (executeBtn) executeBtn.disabled = false;
        }
    }

    _renderSmartSubTable(items, head, body, badge, empty) {
        if (badge) badge.textContent = items.length;

        if (!items || items.length === 0) {
            if (body) body.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
            return;
        }

        if (empty) empty.classList.add('hidden');

        // Headers
        const headers = ['الاسم (ملف الرفع)', 'الاسم (قاعدة البيانات)', 'رقم الحساب الجديد', 'البنك الجديد', 'الحالة (قاعدة البيانات)'];
        if (head) head.innerHTML = headers.map(h => `<th>${h}</th>`).join('');

        // Rows
        if (body) {
            body.innerHTML = items.map(item => `
                <tr>
                    <td style="cursor: pointer;" ondblclick="window.app.triggerNameSearch('${item.excelName}')" title="انقر مرتين للبحث السريع عن هذا الاسم">${item.excelName}</td>
                    <td style="font-weight: bold; color: #00f0ff; cursor: pointer;" ondblclick="window.app.triggerNameSearch('${item.dbName}')" title="انقر مرتين للبحث السريع عن هذا الاسم">${item.dbName}</td>
                    <td>${item.newAccountNumber || '---'}</td>
                    <td>${item.newBankName || '---'}</td>
                    <td><span class="badge-status success">${item.currentStatus || 'غير محدد'}</span></td>
                </tr>
            `).join('');
        }
    }

    async executeSmartPayment(targetType = 'salary') {
        if (targetType === 'active') {
            targetType = this.smartPaymentTypeFilter || 'salary';
        }

        if (!this.smartMatchResults || this.smartMatchResults.length === 0) {
            this.showToast('لا توجد نتائج مطابقة. قم بعرض المطابقة أولاً', 'warning');
            return;
        }

        console.log('[SMART-EXEC] ===== Starting Execute =====');
        console.log('[SMART-EXEC] Target Type:', targetType);
        console.log('[SMART-EXEC] Total match results:', this.smartMatchResults.length);


        // 1. Prepare updates list
        const updatesList = [];

        // Helper to safely get value favoring the camelCase field representing frontend edits/JSON data.
        const getVal = (val1, val2) => (val1 !== undefined ? val1 : (val2 !== undefined ? val2 : ''));

        this.smartMatchResults.forEach((item, idx) => {
            const src = item.sourceExcelRow;

            // Debug: Log source data for first item
            if (idx === 0) {
                console.log('[SMART-EXEC] ===== First sourceExcelRow =====');
                Object.entries(src).forEach(([k, v]) => {
                    if (!k.startsWith('_')) console.log(`  ${k}: "${v}"`);
                });
            }

            // Target fields setup exactly as they are sent to backend
            const returnDate = getVal(src.returnDate, src.ReturnDate);
            const returnApprovalDate = getVal(src.returnApprovalDate, src.ReturnApprovalDate);
            const modDate = getVal(src.modDate, src.ModDate);
            const modApprovalDate = getVal(src.modApprovalDate, src.ModApprovalDate);
            const settlementDate = getVal(src.settlementDate, src.SettlementDate);
            const updatePayload = {
                BatchCode: getVal(src.batchCode, src.BatchCode),
                NationalId: getVal(src.nationalId, src.NationalId),
                NewAccount: getVal(src.modifiedAccount, src.ModifiedAccount),
                NewBank: getVal(src.modifiedBank, src.ModifiedBank),
                ReturnDate: this.formatDate(returnDate) || returnDate,
                ReturnApprovalDate: this.formatDate(returnApprovalDate) || returnApprovalDate,
                ModDate: this.formatDate(modDate) || modDate,
                ModApprovalDate: this.formatDate(modApprovalDate) || modApprovalDate,
                SettlementNo: getVal(src.settlementNo, src.SettlementNo),
                SettlementDate: this.formatDate(settlementDate) || settlementDate
            };

            // Incentive matches
            if (targetType === 'all' || targetType === 'incentive') {
                (item.matches || []).forEach(m => {
                    const update = {
                        DbRecordId: m.id,
                        Source: m.source || 'incentive',
                        ...updatePayload
                    };
                    console.log(`[SMART-EXEC] Incentive Update ID=${m.id}:`, JSON.stringify(update));
                    updatesList.push(update);
                });
            }
            // Salary matches
            if (targetType === 'all' || targetType === 'salary') {
                (item.salaryMatches || []).forEach(m => {
                    const update = {
                        DbRecordId: m.id,
                        Source: m.source || 'salary',
                        ...updatePayload
                    };
                    console.log(`[SMART-EXEC] Salary Update ID=${m.id}:`, JSON.stringify(update));
                    updatesList.push(update);
                });
            }
        });

        if (updatesList.length === 0) {
            this.showToast(`لا توجد سجلات (${targetType === 'incentive' ? 'حوافز' : targetType === 'salary' ? 'مرتبات' : 'مطابقة'}) للتنفيذ`, 'warning');
            return;
        }

        console.log('[SMART-EXEC] Total updates to send:', updatesList.length);

        const typeText = targetType === 'incentive' ? 'الحوافز' : targetType === 'salary' ? 'المرتبات' : 'الكل';
        const triggerBtn = document.getElementById('btn-smart-execute-active-tab');


        const confirmed = confirm(`هل أنت متأكد من تنفيذ تحديث بيانات (${typeText}) لعدد (${updatesList.length}) سجل مطابق؟`);
        if (!confirmed) return;

        // Progress UI
        const progContainer = document.getElementById('smart-progress-container');
        const buttons = ['btn-smart-execute-active-tab', 'btn-smart-match'];


        if (progContainer) progContainer.style.display = 'block';
        buttons.forEach(id => { const b = document.getElementById(id); if(b) b.disabled = true; });
        this.updateSmartProgress(10, 'جاري معالجة البيانات...');

        try {
            this.updateSmartProgress(30, 'جاري إرسال البيانات للخادم...');

            const payload = { Updates: updatesList };
            console.log('[SMART-EXEC] Sending payload:', JSON.stringify(payload).substring(0, 500) + '...');

            const result = await db.fetchApi('/api/smart-settlement/execute', {
                method: 'POST',
                body: JSON.stringify(payload),
                triggerBtn: triggerBtn // Pass the button for visual feedback
            });
            this.updateSmartProgress(100, 'تم التحديث بنجاح!');

            // Force clear local caches
            this.returnsCache = null;
            this.salaryReturnsCache = null;
            this.isCaching = false;
            this.isSalaryCaching = false;

            await db.clearLocalCache('returns_data_v2');
            await db.clearLocalCache('salary_returns_data_v1');

            alert(`تم تنفيذ التحديث بنجاح!\n- السجلات المحدثة: ${result.report.updatedCount}\n- سجلات لم يتم تحديثها: ${result.report.notUpdatedCount}`);

            // Refresh caches
            this.updateSmartProgress(50, 'جاري مزامنة البيانات المحدثة...');
            try {
                await this.populateReturnsCache();
                await this.populateSalaryReturnsCache();
            } catch (cacheErr) {
                console.warn('[SMART-EXEC] Cache refresh failed:', cacheErr);
            }

            // Reset UI
            if (progContainer) progContainer.style.display = 'none';
            buttons.forEach(id => { const b = document.getElementById(id); if(b) b.disabled = false; });

            if (targetType === 'all') {
                document.getElementById('smart-payment-results').style.display = 'none';
                const successMsg = 'تم تنفيذ العملية بنجاح وتحديث كافة السجلات.';
                const statusF = document.getElementById('smart-payment-status-footer');
                const statusH = document.getElementById('smart-payment-status-header');
                if (statusF) statusF.textContent = successMsg;
                if (statusH) statusH.textContent = successMsg;
                this.showToast('تم تحديث كافة البيانات بنجاح', 'success');
            } else {
                // Re-run match to show updated status
                this.runSmartPaymentMatch();
            }

        } catch (e) {
            console.error('[SMART-EXEC] Execute Error:', e);
            this.showToast('حدث خطأ أثناء تنفيذ التحديث: ' + e.message, 'error');
            if (progContainer) progContainer.style.display = 'none';
            buttons.forEach(id => { const b = document.getElementById(id); if(b) b.disabled = false; });
        }
    }

    updateSmartProgress(percent, text) {
        const progBar = document.getElementById('smart-progress-bar');
        const progPercent = document.getElementById('smart-progress-percent');
        const progText = document.getElementById('smart-progress-text');

        if (progBar) progBar.style.width = `${percent}%`;
        if (progPercent) progPercent.textContent = `${percent}%`;
        if (progText) progText.textContent = text;
    }


    async loadAttachmentLinkMode() {
        try {
            const config = await db.getServerConfig();
            const mode = config.attachmentLinkMode || 'Both';
            const select = document.getElementById('link-mode');
            if (select) select.value = mode;
        } catch (e) { console.warn('Failed to load link mode', e); }
    }

    async saveLinkMode() {
        const select = document.getElementById('link-mode');
        if (!select) return;

        const mode = select.value;
        const triggerBtn = document.querySelector('#settings-tab-attachments .btn-primary');

        try {
            const success = await db.saveAttachmentLinkMode(mode, { triggerBtn: triggerBtn });
            if (success) {
                this.showToast('تم حفظ آلية الربط بنجاح', 'success');
            } else {
                this.showToast('فشل حفظ آلية الربط', 'error');
            }
        } catch (e) {
            this.showToast('خطأ في الاتصال: ' + e.message, 'error');
        }
    }

    // ==========================================
    // Multiple Selection and Deletion Logic
    // ==========================================

    // تم دمج ونقل منطق تحديد الكل (toggleSelectAllReturns و updateSelectAllReturns)
    // إلى أعلى الملف لضمان التوافق مع البانر والـ Toolbar الجديد.

    async deleteSelectedReturns() {
        if (!this.canDeleteReturns()) {
            this.showToast('ليس لديك صلاحية حذف هذه البيانات', 'error');
            return;
        }
        const checkedBoxes = document.querySelectorAll('#table-body .return-row-checkbox:checked');
        if (checkedBoxes.length === 0) {
            this.showToast('الرجاء تحديد سجل واحد على الأقل', 'warning');
            return;
        }

        const confirmed = await dialog.show({
            title: 'أرشفة سجلات',
            message: `هل أنت متأكد من نقل ${checkedBoxes.length} سجل محدد إلى الأرشيف؟ سيتم إخفاؤها من هذه الصفحة ولكنها ستظل متاحة في الأرشيف.`,
            type: 'warning',
            showCancel: true
        });

        if (!confirmed) return;

        const idsToDelete = Array.from(checkedBoxes).map(cb => cb.value);
        this._removeRowsFromMemory('returns', idsToDelete);
        this.updateSelectAllReturns?.();
        this.showToast('تم تحديث البيانات على الشاشة', 'success');
        this._deleteRowsInBackground(
            'returns',
            idsToDelete,
            deleteId => db.deleteReturn(deleteId),
            {
                label: 'أرشفة السجلات',
                progressMessage: 'جاري أرشفة السجلات في الخلفية...',
                successMessage: 'تم تحديث البيانات',
                errorMessage: 'تعذر أرشفة بعض السجلات'
            }
        );
        return;

        /*
        this.showLoading();
        try {
            const idsToDelete = Array.from(checkedBoxes).map(cb => cb.value);
            let successCount = 0;

            for (const id of idsToDelete) {
                const success = await db.deleteReturn(id);
                if (success) successCount++;
            }

            this.showToast(`تم نقل ${successCount} سجل للأرشيف بنجاح`, 'success');

            const selectAllCb = document.getElementById('selectAllCheckbox');
            if (selectAllCb) selectAllCb.checked = false;

            this.filterAndRenderTable();
        } catch (error) {
            if (error?.status === 403) this.showDeleteForbidden(error);
            else {
                console.error('Error in multi delete:', error);
                this.showToast('حدث خطأ أثناء الحذف المتعدد', 'error');
            }
        } finally {
            this.hideLoading();
            this.updateSelectAllReturns();
        }
        */
    }

    async deleteReturn(id) {
        if (!this.canDeleteReturns()) {
            this.showToast('ليس لديك صلاحية حذف هذه البيانات', 'error');
            return;
        }
        const confirmed = await dialog.show({
            title: 'أرشفة سجل',
            message: 'هل أنت متأكد من نقل هذا السجل للأرشيف؟',
            type: 'question',
            showCancel: true,
            liteMode: true
        });
        if (!confirmed) return;
        this._removeRowsFromMemory('returns', [id]);
        this.showToast('تم تحديث البيانات على الشاشة', 'success');
        this._deleteRowsInBackground(
            'returns',
            [id],
            deleteId => db.deleteReturn(deleteId),
            {
                label: 'أرشفة السجل',
                progressMessage: 'جاري أرشفة السجل في الخلفية...',
                successMessage: 'تم تحديث البيانات',
                errorMessage: 'تعذر أرشفة السجل'
            }
        );
        return;
        /*
        try {
            const success = await db.deleteReturn(id);
            if (success) {
                this.returnsCache = null; // Invalidate cache
                this.showToast('تم نقل السجل للأرشيف بنجاح', 'success');
                await this.loadReturns(this.pagination?.currentPage || 1);
            } else {
                this.showToast('فشل حذف السجل', 'error');
            }
        } catch (error) {
            if (error?.status === 403) this.showDeleteForbidden(error);
            else this.showToast('خطأ: ' + error.message, 'error');
        }
        */
    }

    async editReturn(id) {
        const currentRow = (this.data || []).find(r => String(r.id || r.Id) === String(id)) || (this.returnsCache || []).find(r => String(r.id || r.Id) === String(id));
        if (!currentRow) {
            this.showToast('تعذر العثور على السجل', 'error');
            return;
        }

        const existingModal = document.getElementById('dynamic-edit-main-return-modal');
        if (existingModal) existingModal.remove();

        this.editingMainReturnId = id;
        this.editingMainReturnOriginal = currentRow;

        // Overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'dynamic-edit-main-return-modal';
        modalOverlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 999999;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'IBM Plex Sans Arabic', 'ui-sans-serif', 'system-ui';
            padding: 1rem;
        `;

        // Modal Content Container
        const modalContent = document.createElement('main');
        modalContent.className = 'modal-container';
        modalContent.style.cssText = `
            width: 100%;
            max-width: 56rem;
            max-height: 90vh;
            background: #1e293b;
            border-radius: 1rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            border: 1px solid #334155;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            direction: rtl;
            position: relative;
        `;

        // Header
        const header = document.createElement('header');
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #334155;
            background: rgba(30, 41, 59, 0.5);
            backdrop-filter: blur(4px);
            position: sticky;
            top: 0;
            z-index: 10;
        `;

        const headerTitleContainer = document.createElement('div');
        headerTitleContainer.style.cssText = 'display: flex; align-items: center; gap: 0.75rem;';

        const iconWrapper = document.createElement('div');
        iconWrapper.style.cssText = `
            padding: 0.5rem;
            background: rgba(14, 165, 233, 0.1);
            border-radius: 0.5rem;
        `;
        iconWrapper.innerHTML = `<svg style="width: 1.25rem; height: 1.25rem; color: #38bdf8;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>`;

        const title = document.createElement('h1');
        title.style.cssText = `
            font-size: 1.25rem;
            font-weight: 700;
            letter-spacing: -0.025em;
            color: #e2e8f0;
            margin: 0;
        `;
        title.innerHTML = `تعديل السجل <span style="color: #38bdf8; margin-right: 0.25rem;">#${id}</span>`;

        headerTitleContainer.appendChild(iconWrapper);
        headerTitleContainer.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = `<svg style="width: 1.5rem; height: 1.5rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>`;
        closeBtn.style.cssText = `
            padding: 0.5rem;
            color: #94a3b8;
            border-radius: 9999px;
            background: transparent;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        `;
        closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(51, 65, 85, 0.5)';
        closeBtn.onmouseout = () => closeBtn.style.background = 'transparent';
        closeBtn.onclick = () => this.closeEditMainReturnModal();

        header.appendChild(headerTitleContainer);
        header.appendChild(closeBtn);
        modalContent.appendChild(header);

        // Body Form
        const form = document.createElement('form');
        form.id = 'dynamic-edit-main-return-form';
        form.style.cssText = `
            padding: 1.5rem;
            overflow-y: auto;
            flex: 1;
        `;
        if (window.innerWidth >= 1024) form.style.padding = '2rem';

        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: ${window.innerWidth >= 768 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(1, minmax(0, 1fr))'};
            column-gap: 2rem;
            row-gap: 1.5rem;
        `;

        // Define a set of keys to show in order
        const standardFields = [
            'كود الملف', 'الاسم', 'رقم الحساب', 'البنك', 'قيمة العملية',
            'الحالة', 'السبب', 'رقم الحساب بعد التعديل', 'البنك بعد التعديل', 'كود الفرع بعد التعديل',
            'تاريخ الرفع', 'رقم تسوية التعلية', 'تاريخ المرتد', 'تاريخ المرتدات', 'تاريخ اعتماد المرتدات',
            'تاريخ التعديل', 'تاريخ اعتماد التعديل', 'رقم تسوية السداد', 'حالة التسوية'
        ];

        // Combine standard fields with any extra keys in the record
        const allKeys = new Set([...standardFields, '\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0639\u062a\u0645\u0627\u062f\u0020\u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0020\u002f\u0020\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0644\u0633\u062f\u0627\u062f', ...Object.keys(currentRow)]);

        allKeys.forEach(key => {
            // Ignore technical and internal keys
            if (key === '#' || key === 'id' || key === 'Id' || key === 'AttachmentCount' || key.startsWith('_')) return;

            // Handle composite labels from the table to avoid confusion (don't show empty combined labels as inputs)
            if ((key.includes('/') || key.includes(' / ')) && key !== '\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0639\u062a\u0645\u0627\u062f\u0020\u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0020\u002f\u0020\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0644\u0633\u062f\u0627\u062f') {
                // Skip combined labels like "تاريخ المرتد / تاريخ التعلية" if we already show the individual fields
                return;
            }

            const group = document.createElement('div');
            group.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem;';

            const label = document.createElement('label');
            label.textContent = key;
            label.style.cssText = `
                font-size: 0.875rem;
                font-weight: 500;
                color: #94a3b8;
            `;

            const input = document.createElement('input');
            input.type = 'text';
            input.name = key;
            input.value = currentRow[key] ?? '';
            input.placeholder = `بيانات ${key}...`;
            input.style.cssText = `
                width: 100%;
                background: #0f172a;
                border: 1px solid #334155;
                border-radius: 0.5rem;
                padding: 0.625rem 1rem;
                color: #f1f5f9;
                font-size: 1rem;
                outline: none;
                transition: all 0.2s ease-in-out;
            `;

            input.onfocus = () => {
                input.style.boxShadow = '0 0 0 2px rgba(14, 165, 233, 0.2)';
                input.style.borderColor = '#38bdf8';
            };
            input.onblur = () => {
                input.style.boxShadow = 'none';
                input.style.borderColor = '#334155';
            };

            group.appendChild(label);
            group.appendChild(input);
            grid.appendChild(group);
        });

        form.appendChild(grid);

        // Footer
        const footer = document.createElement('footer');
        footer.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 1rem;
            margin-top: 2.5rem;
            padding-top: 1.5rem;
            border-top: 1px solid #334155;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'إلغاء';
        cancelBtn.style.cssText = `
            padding: 0.625rem 1.5rem;
            font-size: 0.875rem;
            font-weight: 600;
            color: #cbd5e1;
            background: transparent;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: all 0.2s;
        `;
        cancelBtn.onmouseover = () => { cancelBtn.style.color = '#ffffff'; cancelBtn.style.background = '#1e293b'; };
        cancelBtn.onmouseout = () => { cancelBtn.style.color = '#cbd5e1'; cancelBtn.style.background = 'transparent'; };
        cancelBtn.onclick = () => this.closeEditMainReturnModal();

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.innerHTML = `
            <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
            حفظ التغييرات
        `;
        saveBtn.style.cssText = `
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.625rem 2rem;
            font-size: 0.875rem;
            font-weight: 600;
            background: #0ea5e9;
            color: #ffffff;
            border: none;
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgba(14, 165, 233, 0.2);
            cursor: pointer;
            transition: all 0.2s;
        `;
        saveBtn.onmouseover = () => saveBtn.style.background = 'rgba(14, 165, 233, 0.8)';
        saveBtn.onmouseout = () => saveBtn.style.background = '#0ea5e9';
        saveBtn.onclick = () => this.saveMainReturnChanges();

        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);
        form.appendChild(footer);

        modalContent.appendChild(form);
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) this.closeEditMainReturnModal();
        };

        // Resize Listener
        const resizeHandler = () => {
            if (!document.body.contains(modalOverlay)) {
                window.removeEventListener('resize', resizeHandler);
                return;
            }
            grid.style.gridTemplateColumns = window.innerWidth >= 768 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(1, minmax(0, 1fr))';
            // Re-apply col-span logic if needed
            const inputs = grid.querySelectorAll('input');
            inputs.forEach(inp => {
                if (false) { // Removed كود المرتد check
                    inp.parentElement.style.gridColumn = window.innerWidth >= 768 ? 'span 2 / span 2' : 'span 1 / span 1';
                }
            });
            if (window.innerWidth >= 1024) form.style.padding = '2rem';
            else form.style.padding = '1.5rem';
        };
        window.addEventListener('resize', resizeHandler);
    }

    closeEditMainReturnModal() {
        const modal = document.getElementById('dynamic-edit-main-return-modal');
        if (modal) modal.remove();
        this.editingMainReturnId = null;
        this.editingMainReturnOriginal = null;
    }

    async saveMainReturnChanges() {
        if (!this.editingMainReturnId || !this.editingMainReturnOriginal) return;
        const formContainer = document.getElementById('dynamic-edit-main-return-form');
        if (!formContainer) return;

        const data = {};
        const inputs = formContainer.querySelectorAll('input');
        inputs.forEach(input => {
            data[input.name] = input.value;
        });

        const merged = this._stripEditableTechnicalFields({ ...this.editingMainReturnOriginal, ...data });
        const changed = this._getChangedFields(this.editingMainReturnOriginal, data);
        const editId = this.editingMainReturnId;
        if (Object.keys(changed).length === 0) {
            this.showToast('\u0644\u0627 \u062a\u0648\u062c\u062f \u062a\u0639\u062f\u064a\u0644\u0627\u062a \u0644\u0644\u062d\u0641\u0638', 'info');
            this.closeEditMainReturnModal();
            return;
        }
        const saveButton = formContainer.querySelector('footer button:last-child');
        const previousSaveHtml = saveButton?.innerHTML;
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.classList.add('btn-loading');
        }
        this.isSavingReturns = true;
        const optimisticRow = { ...merged, id: editId };
        this._applyEditedRowInMemory('returns', editId, optimisticRow);
        this.renderTable?.();
        this.closeEditMainReturnModal();
        this.showToast('\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0641\u0648\u0631\u0627\u064b', 'success');
        this.showToast('تم تحديث السجل على الشاشة، جاري الحفظ في الخلفية', 'success');
        this.isSavingReturns = false;

        const bg = this.beginBackgroundMutation('جاري حفظ التعديل في الخلفية...');
        db.updateReturn(editId, changed)
            .then(async result => {
                if (result && result.success) {
                    const updatedRow = result.record || optimisticRow;
                    await this._upsertEditedCachedRow('returns', editId, updatedRow, { changedKeys: Object.keys(changed), deferRender: true });
                    bg.success('تم تحديث البيانات');
                    this.showToast('تم حفظ التعديل نهائياً', 'success');
                } else {
                    bg.error('تعذر حفظ التعديل في قاعدة البيانات: ' + (result?.message || ''));
                    this.showToast('فشل حفظ التعديل في قاعدة البيانات: ' + (result?.message || ''), 'error');
                }
            })
            .catch(error => {
                bg.error('تعذر حفظ التعديل في الخلفية: ' + error.message);
                this._syncDataset?.('returns', { force: true, full: true, skipCheck: true }).catch(() => {});
                this.showToast('فشل حفظ التعديل في الخلفية: ' + error.message, 'error');
            });
    }

    async deleteAllReturns() {
        const confirmed = await dialog.show({
            title: 'تحذير حذف الكل',
            message: 'هل أنت متأكد من حذف كافة السجلات؟ لا يمكن التراجع عن هذه الخطوة.',
            type: 'error',
            showCancel: true,
            liteMode: true
        });
        if (!confirmed) return;
        this.showLoading();
        try {
            const success = await db.deleteAllReturns();
            if (success) {
                this.returnsCache = null; // Invalidate cache
                this.showToast('تم حذف جميع السجلات بنجاح', 'success');
                await this.loadData(1);
            } else {
                this.showToast('فشل حذف السجلات', 'error');
            }
        } catch (error) {
            this.showToast('خطأ: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // ========================================
    // أزرار التنزيل
    // ========================================

    downloadErrorReport() {
        if (!this._validationService) return;
        this._validationService.exportErrorsExcel();
        this.showToast('تم تنزيل تقرير الأخطاء', 'success');
    }

    downloadValidReport() {
        if (!this._validationService) return;
        this._validationService.exportValidExcel();
        this.showToast('تم تنزيل السجلات الصالحة', 'success');
    }

    // Missing Error Download Functions for Rates Modal (if used)
    downloadNationalIdErrors() {
        if (!this._validationService) return;
        const success = this._validationService.exportNidErrors();
        if (success) this.showToast('تم تنزيل أخطاء الرقم القومي', 'success');
        else this.showToast('لا توجد أخطاء في الرقم القومي', 'info');
    }

    downloadAccountErrors() {
        if (!this._validationService) return;
        const success = this._validationService.exportAccountErrors();
        if (success) this.showToast('تم تنزيل أخطاء الحسابات', 'success');
        else this.showToast('لا توجد أخطاء في الحسابات', 'info');
    }

    downloadConflictErrors() {
        if (!this._validationService) return;
        const success = this._validationService.exportConflictErrors();
        if (success) this.showToast('تم تنزيل تقرير التضارب', 'success');
        else this.showToast('لا توجد تضاربات', 'info');
    }


    applyFullReturnsFilter() {
        const search = document.getElementById('full-returns-search').value;
        this.loadFullReturns(1, 50, search);
        this.showToast('تم تطبيق الفلتر', 'success');
    }

    // ========================================
    // إدارة المرفقات (Attachments)
    // ========================================





    downloadFullReport() {
        if (!this._validationService) return;
        this._validationService.exportFullWithStatus();
        this.showToast('تم تنزيل الملف الكامل مع نتيجة الفحص', 'success');
    }

    downloadEmptyCodesReport() {
        if (!this._validationService) return;
        this._validationService.exportEmptyCodesExcel();
        this.showToast('تم تنزيل سجلات الأكواد الفارغة', 'success');
    }

    // دوال التصدير الجديدة
    downloadSpecificError(type) {
        if (!this._validationService) return;
        const success = this._validationService.exportSpecificError(type, `${type}_errors.xlsx`);
        if (success) {
            this.showToast('تم تنزيل تقرير الأخطاء', 'success');
        } else {
            this.showToast('لا توجد بيانات لهذا النوع من الأخطاء', 'info');
        }
    }

    downloadRepetitionReport() {
        // تنزيل تقرير التكرار (Unique & Frequency)
        if (!this._validationService) return; // Corrected to _validationService

        const success = this._validationService.exportRepetitionStats('تقرير_التكرار_والسجلات_الفريدة.xlsx');
        if (!success) {
            this.showToast('لا توجد بيانات متاحة للتكرار', 'info');
        } else {
            this.showToast('تم تنزيل تقرير التكرار بنجاح ?', 'success');
        }
    }

    downloadAllErrorsMultiSheet() {
        if (!this._validationService) return;
        const success = this._validationService.exportAllErrorsMultiSheet('جميع_الأخطاء_مفصلة.xlsx');
        if (success) {
            this.showToast('تم تنزيل جميع الأخطاء في ملف واحد', 'success');
        } else {
            this.showToast('لا توجد أخطاء لتصديرها', 'warning');
        }
    }

    // ========================================
    // تقارير البيانات الحالية
    // ========================================

    showCurrentDataReport() {
        if (!this.data || this.data.length === 0) {
            this.showToast('لا توجد بيانات لعرض التقارير', 'warning');
            return;
        }

        this.showLoading();

        try {
            this._validationService = new ValidationService();
            const headers = this.headers;
            const dataAsArrays = [
                headers,
                ...this.data.map(row => headers.map(h => row[h]))
            ];

            const validationResult = this._validationService.validate(dataAsArrays, this.returnsCache || []);

            this.populateValidationModal(validationResult);
            this.showValidationResultsPage(validationResult);

            const modalFooter = document.getElementById('validation-modal-footer');
            if (modalFooter) modalFooter.style.display = 'none';

            const restoreFooter = () => {
                if (modalFooter) modalFooter.style.display = 'flex';
                document.getElementById('import-modal-close')?.removeEventListener('click', restoreFooter);
            };
            document.getElementById('import-modal-close')?.addEventListener('click', restoreFooter);

        } catch (e) {
            console.error('Report Error:', e);
            this.showToast('حدث خطأ أثناء إعداد التقرير', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // ========================================
    // خيارات الحفظ
    // ========================================




    // ========================================
    // التصدير
    // ========================================

    exportExcel() {
        if (this.data.length === 0) {
            this.showToast('لا توجد بيانات للتصدير', 'warning');
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(this.data.map(row => {
            const cleanRow = {};
            this.headers.forEach(h => cleanRow[h] = row[h]);
            return cleanRow;
        }));

        const workbook = XLSX.utils.book_new();

        // ضبط اتجاه الورقة من اليمين لليسار (RTL) لدعم العربية
        if (!worksheet['!views']) worksheet['!views'] = [];
        worksheet['!views'].push({ RTL: true });

        XLSX.utils.book_append_sheet(workbook, worksheet, 'المرتدات');

        const filename = `مرتدات_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(workbook, filename);

        this.showToast('تم تصدير الملف بنجاح', 'success');
    }

    exportCSV() {
        if (this.data.length === 0) {
            this.showToast('لا توجد بيانات للتصدير', 'warning');
            return;
        }

        const csvContent = [
            this.headers.join(','),
            ...this.data.map(row => this.headers.map(h => `"${row[h] ?? ''}"`).join(','))
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `مرتدات_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.csv`;
        link.click();

        URL.revokeObjectURL(url);
        this.showToast('تم تصدير الملف بنجاح', 'success');
        this.playNotificationSound();
    }

    // ========================================
    // أرشيف المرتدات (Archive)
    // ========================================

    async loadArchive() {
        try {
            const archive = await db.getArchive();
            const tbody = document.getElementById('archive-table-body');
            const emptyState = document.getElementById('archive-empty');

            if (archive.length === 0) {
                tbody.innerHTML = '';
                emptyState.classList.remove('hidden');
                return;
            }

            emptyState.classList.add('hidden');

            tbody.innerHTML = archive.reverse().map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${new Date(item.date).toLocaleString('ar-EG')}</td>
          <td>${item.filename}</td>
          <td>${item.recordCount}</td>
          <td>${item.size}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="app.restoreArchive(${item.id})">
              استعادة
            </button>
            <button class="btn btn-sm btn-error" onclick="app.deleteArchive(${item.id})">
              حذف
            </button>
          </td>
        </tr>
      `).join('');

        } catch (error) {
            console.error('خطأ في تحميل الأرشيف:', error);
        }
    }

    async restoreArchive(archiveId) {
        const confirmed = await dialog.show({
            title: 'استعادة نسخة',
            message: 'هل تريد استعادة هذه النسخة؟ سيتم استبدال البيانات الحالية.',
            type: 'question',
            showCancel: true,
            liteMode: true
        });
        if (!confirmed) return;

        this.showLoading();

        try {
            await db.restoreFromArchive(archiveId);
            this.returnsCache = null; // Invalidate cache
            await this.loadReturns();
            this.navigateTo('returns');
            this.showToast('تم استعادة البيانات بنجاح', 'success');
        } catch (error) {
            console.error('خطأ في الاستعادة:', error);
            this.showToast('خطأ في استعادة البيانات', 'error');
        }

        this.hideLoading();
    }

    async deleteArchive(archiveId) {
        const confirmed = await dialog.show({
            title: 'حذف نسخة',
            message: 'هل تريد حذف هذه النسخة من الأرشيف؟',
            type: 'question',
            showCancel: true,
            liteMode: true
        });
        if (!confirmed) return;

        try {
            await db.deleteArchive(archiveId);
            await this.loadArchive();
            this.showToast('تم حذف النسخة بنجاح', 'success');
        } catch (error) {
            console.error('خطأ في الحذف:', error);
            this.showToast('خطأ في حذف النسخة', 'error');
        }
    }

    // ========================================
    // إدارة الأرشيف
    // ========================================

    async switchArchiveTab(tabId) {
        this.currentArchiveTab = tabId;

        // Buttons
        document.querySelectorAll('.btn-tab').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`tab-btn-${tabId}`);
        if (activeBtn) activeBtn.classList.add('active');

        // Content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
        const activeTab = document.getElementById(`archive-tab-${tabId}`);
        if (activeTab) activeTab.classList.remove('hidden');

        // Load Data
        if (tabId === 'lauf') {
            await this.loadArchive();
        } else if (tabId === 'full') {
            await this.loadFullReturnsHistory();
        } else if (tabId === 'salaries') {
            await this.loadSalaryArchive();
        }
    }

    async loadFullReturnsHistory() {
        const tbody = document.getElementById('full-history-body');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="5" class="text-center">جاري التحميل...</td></tr>';

        try {
            const data = await db.fetchApi('/full-returns/history');
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا يوجد سجلات</td></tr>';
                return;
            }

            tbody.innerHTML = data.map((item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${new Date(item.ImportDate || item.importDate).toLocaleString('ar-EG')}</td>
                    <td>${item.Filename || item.filename}</td>
                    <td>${item.RecordCount || item.recordCount}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary" onclick="app.openFullReturnFolderByDate('${item.ImportDate || item.importDate}')">
                            📁 فتح
                        </button>
                    </td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('Error loading full returns archive:', error);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-error">خطأ في التحميل</td></tr>';
        }
    }

    async loadArchive() {
        const tbody = document.getElementById('archive-table-body');
        const emptyState = document.getElementById('archive-empty');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="6" class="text-center">جاري التحميل...</td></tr>';

        try {
            const data = await db.fetchApi('/archive');
            if (!data || data.length === 0) {
                tbody.innerHTML = '';
                emptyState?.classList.remove('hidden');
                return;
            }

            emptyState?.classList.add('hidden');
            this.renderArchive(data);
        } catch (error) {
            console.error('Error loading archive:', error);
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-error">خطأ في التحميل</td></tr>';
        }
    }

    renderArchive(data) {
        const tbody = document.getElementById('archive-table-body');
        if (!tbody) return;

        tbody.innerHTML = data.map((item, index) => {
            const isExclusive = !!(item.exclusiveUserId || item.ExclusiveUserId);
            const statusIcon = isExclusive ? '<i class="fas fa-lock" title="جدول حصري" style="color: #fbbf24; margin-right: 5px;"></i>' : '<i class="fas fa-globe-americas" title="جدول عام" style="color: #10b981; margin-right: 5px;"></i>';
            const shareBtn = (this.currentUser && this.currentUser.role === 'admin')
                ? `<button class="btn btn-sm btn-outline-info" onclick="app.showShareTableModal(${item.id || item.Id}, 'Archives')" title="مشاركة مع مستخدم">🔗 مشاركة</button>`
                : '';

            return `
            <tr>
                <td>${index + 1}</td>
                <td dir="ltr">${new Date(item.date || item.Date).toLocaleString('ar-EG')}</td>
                <td>${statusIcon} ${item.filename || item.Filename}</td>
                <td>${(item.recordCount || item.RecordCount || 0).toLocaleString()} سجل</td>
                <td>${((item.size || item.Size || 0) / 1024 / 1024).toFixed(2)} MB</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        ${shareBtn}
                        <button class="btn btn-sm btn-primary" onclick="app.restoreArchive(${item.id || item.Id})">
                            🔄 استعادة
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="app.deleteArchive(${item.id || item.Id})">
                            🗑️ حذف
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');
    }

    async restoreArchive(id) {
        if (!confirm('هل أنت متأكد من استعادة هذه النسخة؟ سيتم عرض بيانات هذا الأرشيف فقط في صفحة المرتدات.')) return;

        try {
            this.showLoading();
            const res = await db.fetchApi(`/archive/restore/${id}`, { method: 'POST' });
            if (res && res.success) {
                this.showToast('تمت الاستعادة بنجاح. يمكنك الآن مراجعة البيانات في صفحة مرتدات الحوافز.', 'success');
                this.navigateTo('returns');
            } else {
                this.showToast(res?.message || 'فشلت عملية الاستعادة', 'error');
            }
        } catch (error) {
            console.error('Restore Error:', error);
            this.showToast('حدث خطأ أثناء الاستعادة', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async clearRestore() {
        try {
            this.showLoading();
            const res = await db.fetchApi('/archive/clear-restore', { method: 'POST' });
            if (res && res.success) {
                this.showToast('تم إلغاء الاستعادة والعودة لعرض كافة البيانات', 'success');
                this.loadReturns(1); // Reload first page
            }
        } catch (error) {
            this.showToast('خطأ في إلغاء الاستعادة', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteArchive(id) {
        if (!confirm('هل أنت متأكد من حذف هذا الأرشيف نهائياً من سجلات النظام؟')) return;

        try {
            this.showLoading();
            const res = await db.fetchApi(`/archive/${id}`, { method: 'DELETE' });
            if (res && res.success) {
                this.showToast('تم الحذف بنجاح', 'success');
                this.loadArchive();
            } else {
                this.showToast('فشل الحذف', 'error');
            }
        } catch (error) {
            this.showToast('خطأ في الحذف', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // ==========================================
    // Salary Archive Management
    // ==========================================

    async loadSalaryArchive() {
        try {
            this.showLoading();
            const archive = await db.fetchApi('/salary-archive');
            this.renderSalaryArchive(archive);
        } catch (error) {
            this.showToast('خطأ في تحميل أرشيف المرتبات', 'error');
        } finally {
            this.hideLoading();
        }
    }

    renderSalaryArchive(data) {
        const tbody = document.getElementById('salary-archive-table-body');
        const emptyState = document.getElementById('salary-archive-empty');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '';
            emptyState?.classList.remove('hidden');
            return;
        }

        emptyState?.classList.add('hidden');
        tbody.innerHTML = data.map((item, index) => {
            const dateVal = item.date || item.Date || '';
            let dateStr = 'غير متوفر';
            if (dateVal) {
                dateStr = new Date(dateVal).toLocaleString('ar-EG');
            }

            const isExclusive = !!(item.exclusiveUserId || item.ExclusiveUserId);
            const statusIcon = isExclusive ? '<i class="fas fa-lock" title="جدول حصري" style="color: #fbbf24; margin-right: 5px;"></i>' : '<i class="fas fa-globe-americas" title="جدول عام" style="color: #10b981; margin-right: 5px;"></i>';
            const shareBtn = (this.currentUser && this.currentUser.role === 'admin')
                ? `<button class="btn btn-sm btn-outline-info" onclick="app.showShareTableModal(${item.id || item.Id}, 'SalaryArchives')" title="مشاركة مع مستخدم">🔗 مشاركة</button>`
                : '';

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td dir="ltr">${dateStr}</td>
                    <td>${statusIcon} <code>${item.filename || item.Filename}</code></td>
                    <td>${(item.recordCount || item.RecordCount || 0).toLocaleString()} سجل</td>
                    <td>${this.formatFileSize(item.size || item.Size || 0)}</td>
                    <td>
                        <div style="display: flex; gap: 8px;">
                            ${shareBtn}
                            <button class="btn btn-sm btn-primary" onclick="app.restoreSalaryArchive(${item.id || item.Id})" title="استعادة هذا الأرشيف">
                                🔄 استعادة
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="app.deleteSalaryArchive(${item.id || item.Id})" title="حذف الأرشيف">
                                🗑️ حذف
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async restoreSalaryArchive(id) {
        try {
            this.showLoading();
            const res = await db.fetchApi(`/salary-archive/restore/${id}`, { method: 'POST' });
            if (res && res.success) {
                this.showToast('تم تفعيل أرشيف المرتبات بنجاح', 'success');
                this.salaryReturnsData = [];
                this.navigateTo('salary-returns');
                this.loadSalaryReturns(1);
            }
        } catch (error) {
            this.showToast('خطأ في استعادة أرشيف المرتبات', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async clearSalaryRestore() {
        try {
            this.showLoading();
            const res = await db.fetchApi('/salary-archive/clear-restore', { method: 'POST' });
            if (res && res.success) {
                this.showToast('تم إلغاء الاستعادة والعودة لعرض كافة بيانات المرتبات', 'success');
                this.loadSalaryReturns(1);
            }
        } catch (error) {
            this.showToast('خطأ في إلغاء استعادة المرتبات', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteSalaryArchive(id) {
        if (!confirm('هل أنت متأكد من حذف هذا الأرشيف للمرتبات نهائياً؟')) return;

        try {
            this.showLoading();
            const res = await db.fetchApi(`/salary-archive/${id}`, { method: 'DELETE' });
            if (res && res.success) {
                this.showToast('تم حذف أرشيف المرتبات بنجاح', 'success');
                this.loadSalaryArchive();
            } else {
                this.showToast('فشل حذف أرشيف المرتبات', 'error');
            }
        } catch (error) {
            this.showToast('خطأ في الحذف', 'error');
        } finally {
            this.hideLoading();
        }
    }





    // ========================================
    // إدارة المستخدمين
    // ========================================

    async loadUsers() {
        // تحميل مسار قاعدة البيانات أيضاً
        await this.loadDbPath();

        try {
            const users = await db.getUsers();
            const tbody = document.getElementById('users-table-body');

            tbody.innerHTML = users.map((user, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${user.username}</td>
          <td>${user.fullname}</td>
          <td><span class="badge badge-${this.getRoleBadge(user.role)}">${this.getRoleName(user.role)}</span></td>
          <td><span class="badge badge-${user.active ? 'success' : 'error'}">${user.active ? 'مفعل' : 'معطل'}</span></td>
          <td>
            <div style="display: flex; gap: 5px;">
                <button class="btn btn-sm btn-outline-primary" onclick="app.showAssignTaskModal(${user.id}, '${user.fullname}')" title="إسناد مهمة مباشرة">
                    📋 مهمة
                </button>
                <button class="btn btn-sm btn-secondary" onclick="app.editUser(${user.id})">
                    تعديل
                </button>
                ${user.username !== 'admin' ? `
                <button class="btn btn-sm btn-error" onclick="app.deleteUser(${user.id})">
                    حذف
                </button>
                ` : ''}
            </div>
          </td>
        </tr>
      `).join('');

        } catch (error) {
            console.error('خطأ في تحميل المستخدمين:', error);
        }
    }

    getRoleBadge(role) {
        const badges = { admin: 'error', editor: 'warning', viewer: 'primary' };
        return badges[role] || 'primary';
    }

    showUserModal(user = null) {
        const modal = document.getElementById('user-modal');
        const title = document.getElementById('user-modal-title');

        if (user) {
            title.textContent = 'تعديل مستخدم';
            document.getElementById('user-edit-id').value = user.id;
            document.getElementById('user-username').value = user.username;
            document.getElementById('user-fullname').value = user.fullname;
            document.getElementById('user-password').value = '';
            document.getElementById('user-role').value = user.role;
        } else {
            title.textContent = 'إضافة مستخدم';
            document.getElementById('user-form').reset();
            document.getElementById('user-edit-id').value = '';
        }

        modal?.classList.remove('hidden');
    }

    hideUserModal() {
        document.getElementById('user-modal')?.classList.add('hidden');
    }



    async editUser(userId) {
        const users = await db.getUsers();
        const user = users.find(u => u.id === userId);
        if (user) this.showUserModal(user);
    }

    async saveUser() {
        const editId = document.getElementById('user-edit-id').value;
        const username = document.getElementById('user-username').value;
        const fullname = document.getElementById('user-fullname').value;
        const password = document.getElementById('user-password').value;
        const role = document.getElementById('user-role').value;

        if (!username || !fullname) {
            this.showToast('يرجى ملء جميع الحقول المطلوبة', 'warning');
            return;
        }

        try {
            let userData = {
                username,
                fullname,
                role,
                active: true
            };

            if (editId) {
                const users = await db.getUsers();
                const existingUser = users.find(u => u.id === parseInt(editId));

                if (!existingUser) throw new Error("المستخدم غير موجود");

                userData.id = parseInt(editId);
                userData.password = password || existingUser.password;
                userData.createdAt = existingUser.createdAt;
            } else {
                if (!password) {
                    this.showToast('كلمة المرور مطلوبة للمستخدم الجديد', 'warning');
                    return;
                }
                userData.password = password;
                userData.createdAt = new Date().toISOString();
            }

            const result = await db.saveUser(userData);
            if (result.success) {
                this.hideUserModal();
                await this.loadUsers();
                this.showToast(editId ? 'تم تحديث المستخدم بنجاح' : 'تم إضافة المستخدم بنجاح', 'success');
            } else {
                this.showToast(result.message || 'فشل حفظ المستخدم', 'error');
            }

        } catch (error) {
            console.error('خطأ في حفظ المستخدم:', error);
            this.showToast('خطأ: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteUser(userId) {
        const confirmed = await dialog.show({
            title: 'حذف مستخدم',
            message: 'هل تريد حذف هذا المستخدم؟',
            type: 'question',
            showCancel: true,
            liteMode: true
        });
        if (!confirmed) return;

        try {
            await db.deleteUser(userId);
            await this.loadUsers();
            this.showToast('تم حذف المستخدم بنجاح', 'success');
        } catch (error) {
            console.error('خطأ في حذف المستخدم:', error);
            this.showToast('خطأ في حذف المستخدم', 'error');
        }
    }

    // ========================================
    // إدارة مسار قاعدة البيانات
    // ========================================

    renderDbConnectionStatus(result) {
        const path = result?.activePath || result?.path || '-';
        const isNetwork = !!result?.isNetworkPath || result?.connectionKind === 'network';
        const kindEl = document.getElementById('db-path-kind');
        if (kindEl) kindEl.textContent = isNetwork ? 'شبكة' : 'محلي';

        const lastErrorEl = document.getElementById('db-last-error');
        if (lastErrorEl) {
            const status = result?.status || result || {};
            lastErrorEl.textContent = status.success === false ? (result?.lastError || status.rawMessage || status.message || '-') : '-';
        }

        const activePathEl = document.getElementById('db-active-path');
        if (activePathEl) activePathEl.textContent = path;

        const statusEl = document.getElementById('db-connection-status');
        if (statusEl) {
            const status = result?.status || result || {};
            const ok = status.success !== false && result?.success !== false;
            const badge = ok ? 'badge-success' : 'badge-error';
            const message = status.message || result?.message || (ok ? 'متصل' : 'فشل الاتصال');
            const raw = result?.lastError || status.rawMessage || '';
            const escape = this.escapeHtml ? this.escapeHtml.bind(this) : (value) => String(value ?? '');
            const detail = raw && raw !== message ? `<br><small>${escape(raw)}</small>` : '';
            statusEl.innerHTML = `حالة الاتصال: <span class="badge ${badge}">${escape(message)}</span>${detail}<br><small dir="ltr">${escape(path)}</small>`;
        }
    }

    async loadDbPath() {
        try {
            const result = await db.fetchApi('/config/path');
            const pathInput = document.getElementById('db-path');
            if (pathInput) {
                pathInput.value = result.selectedPath || result.path || '';
                pathInput.readOnly = false; // Force editable
                pathInput.disabled = false; // Force enabled
            }
            const activePathEl = document.getElementById('db-active-path');
            if (activePathEl) activePathEl.textContent = result.activePath || result.path || '-';
            const lastSuccessEl = document.getElementById('db-last-success');
            if (lastSuccessEl) {
                const last = result.lastSuccessfulConnection || '-';
                const lastPath = result.lastSuccessfulPath ? ` | ${result.lastSuccessfulPath}` : '';
                lastSuccessEl.textContent = `${last}${lastPath}`;
            }
            this.renderDbConnectionStatus(result);

            const statusEl = document.getElementById('db-connection-status');
            if (statusEl) {
                const status = result.status || {};
                const badge = status.success === false ? 'badge-error' : 'badge-success';
                const text = status.message || 'متصل';
                statusEl.innerHTML = `حالة الاتصال: <span class="badge ${badge}">${this.escapeHtml ? this.escapeHtml(text) : text}</span><br><small dir="ltr">${result.activePath || result.path || ''}</small>`;
            }
        } catch (error) {
            document.getElementById('db-connection-status').innerHTML = 'حالة الاتصال: <span class="badge badge-error">غير متصل</span>';
        }
    }

    async testDbConnection() {
        const statusEl = document.getElementById('db-connection-status');
        try {
            if (statusEl) {
                statusEl.innerHTML = 'حالة الاتصال: <span class="badge badge-warning">جاري الاختبار...</span>';
            }
            const path = document.getElementById('db-path')?.value?.trim() || '';
            const result = await db.fetchApi('/config/test-connection', {
                method: 'POST',
                body: JSON.stringify({ path })
            });
            const badge = result.success ? 'badge-success' : 'badge-error';
            const message = result.message || (result.success ? 'تم الاتصال' : 'فشل الاتصال');
            if (statusEl) {
                statusEl.innerHTML = `حالة الاتصال: <span class="badge ${badge}">${message}</span><br><small dir="ltr">${result.path || ''}</small>`;
            }
            this.renderDbConnectionStatus(result);
            this.showToast(message, result.success ? 'success' : 'error');
        } catch (error) {
            if (statusEl) {
                statusEl.innerHTML = 'حالة الاتصال: <span class="badge badge-error">فشل اختبار الاتصال</span>';
            }
            this.showToast('فشل اختبار الاتصال بقاعدة البيانات', 'error');
        }
    }

    async saveDbPath() {
        const path = document.getElementById('db-path').value.trim();
        if (!path) return;

        this.showLoading();
        try {
            let result = await db.fetchApi('/config/path', {
                method: 'POST',
                body: JSON.stringify({ path, createIfMissing: false })
            });

            if (!result.success && result.requiresCreateConfirmation) {
                this.hideLoading();
                const confirmed = await this.showConfirm(result.message || 'لم يتم العثور على hk.db داخل هذا المجلد. هل تريد إنشاء قاعدة جديدة', {
                    title: 'إنشاء قاعدة بيانات جديدة',
                    type: 'warning',
                    showCancel: true,
                    confirmText: 'إنشاء وحفظ',
                    cancelText: 'إلغاء'
                });
                if (!confirmed) {
                    document.getElementById('db-connection-status').innerHTML = `حالة الاتصال: <span class="badge badge-error">${result.message}</span><br><small dir="ltr">${result.path || ''}</small>`;
                    return;
                }
                this.showLoading();
                result = await db.fetchApi('/config/path', {
                    method: 'POST',
                    body: JSON.stringify({ path, createIfMissing: true })
                });
            }

            if (result.success) {
                this.showToast(result.message, 'success');
                document.getElementById('db-connection-status').innerHTML = `حالة الاتصال: <span class="badge badge-success">متصل بنجاح</span><br><small dir="ltr">${result.activePath || result.path || ''}</small>`;
                const activePathEl = document.getElementById('db-active-path');
                if (activePathEl) activePathEl.textContent = result.activePath || result.path || '-';
                const lastSuccessEl = document.getElementById('db-last-success');
                if (lastSuccessEl) lastSuccessEl.textContent = result.lastSuccessfulConnection || '-';
                setTimeout(() => location.reload(), 1500);
            } else {
                this.showToast(result.message, 'error');
                document.getElementById('db-connection-status').innerHTML = `حالة الاتصال: <span class="badge badge-error">${result.message || 'خطأ في المسار'}</span><br><small dir="ltr">${result.path || ''}</small>`;
            }
        } catch (error) {
            this.showToast('فشل الاتصال بالسيرفر', 'error');
        }
        this.hideLoading();
    }

    async browseDbPath() {
        this.showToast('جاري فتح نافذة اختيار المجلد على جهازك (السيرفر)...', 'info');
        try {
            // إظهار مؤشر تحميل لأن النافذة قد تأخذ وقتاً
            this.showLoading();

            const result = await db.fetchApi('/config/browse-db-file', { method: 'POST' });

            this.hideLoading();

            if (result && result.path) {
                document.getElementById('db-path').value = result.path;
                this.showToast('تم اختيار المجلد بنجاح', 'success');
            } else {
                this.showToast('تم إلغاء اختيار المجلد أو حدث خطأ', 'warning');
            }
        } catch (error) {
            this.hideLoading();
            console.error('Browse Error:', error);
            this.showToast('فشل فتح نافذة الاختيار - تأكد أن السيرفر يعمل على جهازك', 'error');
        }
    }

    async changeSettingsPin() {
        const currentPin = await window.dialog.show({
            title: 'تغيير رمز الدخول',
            message: 'أدخل رمز الدخول الحالي',
            type: 'question',
            isPrompt: true,
            inputType: 'password',
            defaultValue: ''
        });
        if (!currentPin) return;

        const newPin = await window.dialog.show({
            title: 'تغيير رمز الدخول',
            message: 'أدخل رمز الدخول الجديد',
            type: 'question',
            isPrompt: true,
            inputType: 'password',
            defaultValue: ''
        });
        if (!newPin) return;

        const statusEl = document.getElementById('settings-pin-status');
        try {
            const result = await db.fetchApi('/api/settings/change-pin', {
                method: 'POST',
                body: JSON.stringify({ currentPin, newPin })
            });
            if (statusEl) {
                statusEl.textContent = result.message || (result.success ? 'تم الحفظ' : 'فشل الحفظ');
            }
            this.showToast(result.message || (result.success ? 'تم تغيير رمز الدخول' : 'فشل تغيير الرمز'), result.success ? 'success' : 'error');
            if (result.success) {
                this.developerModeUnlocked = false;
                sessionStorage.removeItem('hk_developer_mode_unlocked');
            }
        } catch (error) {
            if (statusEl) statusEl.textContent = 'تعذر حفظ رمز الدخول الجديد';
            this.showToast('تعذر حفظ رمز الدخول الجديد', 'error');
        }
    }

    // ========================================
    // أدوات مساعدة
    // ========================================






    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        // إزالة أي تنبيهات سابقة لضمان ظهور رسالة واحدة فقط
        container.querySelectorAll('.toast').forEach(t => t.remove());

        const labels = { success: 'نجاح', error: 'خطأ', warning: 'تنبيه', info: 'معلومة' };
        const icons = { success: '✓', error: '✕', warning: '!', info: 'i' };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.style.setProperty('--toast-duration', `${duration}ms`);
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-body">
                <div class="toast-title">${labels[type] || labels.info}</div>
                <div class="toast-content">${message}</div>
            </div>
            <button class="toast-close" aria-label="إغلاق">✕</button>
            <div class="toast-progress"></div>
        `;

        toast.querySelector('.toast-close').onclick = () => this._dismissToast(toast);

        container.appendChild(toast);
        requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

        toast._dismissTimer = setTimeout(() => this._dismissToast(toast), duration);
    }

    _dismissToast(toast) {
        if (!toast || !toast.parentElement) return;
        clearTimeout(toast._dismissTimer);
        toast.classList.add('hiding');
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 220);
    }


    // ========================================
    // المعاملات الفاشلة من hiaapay
    // ========================================

    async loadFailedTransactions() {
        const tbody = document.getElementById('failed-table-body');
        const thead = document.getElementById('failed-table-headers');

        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px;">? جاري التحميل من hiaapay...</td></tr>`;

        try {
            // الاتصال المباشر من المتصفح (يحمل الـcookies تلقائياً)
            const response = await fetch('https://hiaapay.faa.local/tahseel-api/api/FailedTransaction', {
                method: 'GET',
                credentials: 'include', // إرسال الـcookies
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`خطأ في الاتصال ${response.status}`);
            }

            const data = await response.json();

            this.failedData = data;

            // تحديث الإحصائيات
            document.getElementById('failed-total').textContent = data.length.toLocaleString('ar-EG');
            document.getElementById('failed-last-update').textContent = new Date().toLocaleTimeString('ar-EG');

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px;">لا توجد معاملات فاشلة</td></tr>`;
                return;
            }

            // استخراج الأعمدة
            const columns = Object.keys(data[0]);

            // بناء الهيدر
            thead.innerHTML = `<tr>${columns.map(col => `<th>${col}</th>`).join('')}</tr>`;

            // بناء الصفوف (أول 100 فقط)
            const displayData = data.slice(0, 100);
            tbody.innerHTML = displayData.map(row => {
                return `<tr>${columns.map(col => {
                    let val = row[col];
                    if (val === null || val === undefined) val = '-';
                    if (typeof val === 'object') val = JSON.stringify(val);
                    return `<td>${val}</td>`;
                }).join('')}</tr>`;
            }).join('');

            this.showToast(`تم تحميل ${data.length} معاملة`, 'success');

        } catch (error) {
            console.error('Failed to load failed transactions:', error);

            let errorMsg = error.message;
            if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                errorMsg = 'لا يمكن الاتصال بـ hiaapay. تأكد من أنك متصل بالشبكة.';
            } else if (error.message.includes('401')) {
                errorMsg = 'يجب تسجيل الدخول إلى hiaapay أولاً';
            }

            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: #ef4444;">
                ?? ${errorMsg}<br>
                <small style="margin-top: 10px; display: block;">
                    <a href="https://hiaapay.faa.local/#/aftersarf" target="_blank" style="color: #3b82f6;">
                        افتح hiaapay وسجل دخولك ?
                    </a>
                </small>
            </td></tr>`;
        }
    }

    exportFailedToCSV() {
        if (!this.failedData || this.failedData.length === 0) {
            this.showToast('لا توجد بيانات للتصدير', 'warning');
            return;
        }

        const columns = Object.keys(this.failedData[0]);
        const csv = [
            columns.join(','),
            ...this.failedData.map(row =>
                columns.map(col => {
                    let val = row[col];
                    if (val === null || val === undefined) val = '';
                    val = String(val).replace(/"/g, '""');
                    return `"${val}"`;
                }).join(',')
            )
        ].join('\n');

        const bom = '\uFEFF';
        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `FailedTransactions_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();

        URL.revokeObjectURL(url);
        this.showToast('تم تصدير البيانات', 'success');
    }




    // Old loadFullReturns removed to prevent conflict with prototype version
    async _deprecated_loadFullReturns() { return; }

    async _ignore_this_block() {

        try {
            const tableBody = document.getElementById('full-returns-body');

            if (!silent) {
                this.showLoading();
            } else {
                // Subtle loading indication for search
                if (tableBody) tableBody.style.opacity = '0.5';
            }

            const query = search || document.getElementById('full-returns-search')?.value || '';
            const res = await fetch(`/full-returns?page=${page}&pageSize=${pageSize}&search=${query}`);
            const result = await res.json();
            this.currentFullReturnsData = result.data; // Store for edit access

            // Populate Table
            const thead = document.querySelector('#full-returns-table thead tr');
            const pagination = document.querySelector('.pagination-controls');
            const info = document.getElementById('full-returns-info');

            if (!thead) {
                console.warn('loadFullReturns: Table header not found');
                return;
            }

            if (result.data && result.data.length > 0) {
                // Dynamic Headers with Preferred Order
                const allKeys = new Set();
                result.data.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));

                const preferredOrder = [
                    "Batch ID",
                    "Transaction Amount",
                    "Creditor Name",
                    "Creditor National ID",
                    "رقم الحساب",
                    "السويفت كود",
                    "رقم الحساب الصحيح",
                    "السويفت كود الصحيح",
                    "حالة المدفوعة",
                    "سبب الارتداد",
                    "تسوية التعلية",
                    "تاريخ تسوية التعلية",
                    "تسوية السداد",
                    "تاريخ تسوية السداد",
                    "مرتدات الارسال"
                ];

                // Sort: Preferred keys first (in order), then others alphabetically
                const headers = Array.from(allKeys)
                    .filter(k => k !== 'id' && k !== 'ID' && k !== 'Id' && k !== '_conflictDetailsMultiAccOriginal')
                    .sort((a, b) => {
                        const idxA = preferredOrder.indexOf(a);
                        const idxB = preferredOrder.indexOf(b);

                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                        return a.localeCompare(b);
                    });

                // Add Image Actions Column (At the end for RTL Left alignment)
                let headersHtml = headers.map(h => `< th > ${h}</th > `).join('') + ` < th > الإجراءات</th > `;

                if (thead) {
                    thead.innerHTML = headersHtml;
                }

                if (tableBody) {
                    tableBody.innerHTML = result.data.map(row => {
                        // Assuming 'ID' is the unique identifier for the record.
                        const id = row['ID'] || row['Id'] || row['id'];
                        const count = row['AttachmentCount'] || 0;

                        return `< tr >
            ${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}
        <td id="actions-${id}" style="white-space: nowrap;">
            ${id ? this.getFullReturnsActionsHtml(id, count) : '-'}
        </td>
                        </tr > `;
                    }).join('');
                }

                // Pagination
                if (info) {
                    info.textContent = `عرض ${result.pagination.currentPage} من ${result.pagination.totalPages} (إجمالي ${result.pagination.total})`;
                }
                this.renderFullReturnsPagination(result.pagination);

                // Update Stats
                if (result.stats) {
                    const countEl = document.getElementById('fr-total-count');
                    const amountEl = document.getElementById('fr-total-amount');
                    if (countEl) countEl.textContent = result.stats.totalCount.toLocaleString();
                    if (amountEl) amountEl.textContent = result.stats.totalAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });
                }
            } else {
                if (tableBody) {
                    tableBody.innerHTML = '<tr><td colspan="100" class="text-center">لا توجد بيانات</td></tr>';
                }
                if (info) {
                    info.textContent = 'عرض 0 من 0';
                }
                if (pagination) {
                    pagination.innerHTML = '';
                }
            }

        } catch (e) {
            console.error(e);
            this.showToast('خطأ في تحميل البيانات', 'error');
        } finally {
            if (!silent) {
                this.hideLoading();
            } else {
                const tableBody = document.getElementById('full-returns-body');
                if (tableBody) tableBody.style.opacity = '1';
            }
        }
    }

    renderFullReturnsPagination(pagination) {
        const container = document.getElementById('full-returns-pagination');
        if (!container) return;

        let html = '';
        if (pagination.hasPreviousPage) {
            html += `<button class="btn btn-sm btn-secondary" onclick="app.loadFullReturns(${pagination.currentPage - 1})">السابق</button>`;
        }
        html += `<span class="mx-2">صفحة ${pagination.currentPage}</span>`;
        if (pagination.hasNextPage) {
            html += `<button class="btn btn-sm btn-secondary" onclick="app.loadFullReturns(${pagination.currentPage + 1})">التالي</button>`;
        }
        container.innerHTML = html;
    }

    showFullReturnsImportModal() {
        document.getElementById('full-returns-import-modal')?.classList.remove('hidden');
    }

    hideFullReturnsImportModal() {
        document.getElementById('full-returns-import-modal')?.classList.add('hidden');
    }

    async handleFullReturnsFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.showLoading();
        this.hideFullReturnsImportModal();

        try {
            const formData = new FormData(); // Not used currently as we send JSON
            // We need to parse Excel client-side first to send JSON, OR send file to server.
            // Existing logic uses Client-side parsing (common in this app).

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                    // Send to Server
                    const payload = {
                        filename: file.name,
                        size: (file.size / 1024).toFixed(2) + ' KB',
                        headers: [], // Optional
                        data: jsonData
                    };

                    const result = await db.fetchApi('/full-returns/import', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });

                    if (result.success) {
                        this.showToast(`تم استيراد ${result.count} سجل بنجاح`, 'success');
                        this.loadFullReturns();
                    } else {
                        this.showToast('فشل الاستيراد: ' + result.message, 'error');
                    }
                } catch (err) {
                    console.error(err);
                    this.showToast('خطأ في معالجة الملف', 'error');
                } finally {
                    this.hideLoading();
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (e) {
            this.hideLoading();
            console.error(e);
        }
    }

    async clearFullReturns() {
        const confirmed = await dialog.show({
            title: 'حذف المرتدات الكاملة',
            message: 'تحذير: هل أنت متأكد من حذف كافة بيانات البحث الشامل؟ لا يمكن التراجع.',
            type: 'error',
            showCancel: true,
            liteMode: true
        });
        if (!confirmed) return;

        try {
            const result = await db.fetchApi('/full-returns', { method: 'DELETE' });
            if (result.success) {
                this.showToast('تم حذف البيانات بنجاح', 'success');
                this.loadFullReturns();
            }
        } catch (e) {
            this.showToast('خطأ أثناء الحذف', 'error');
        }
    }

    // ========================================
    // Full Returns Attachment Management
    // ========================================

    async openAttachmentsModal(returnId, type = 'full') {
        this.currentReturnId = returnId;
        this.currentAttachmentType = type; // 'full' or 'returns'
        const modal = document.getElementById('attachments-modal');
        if (modal) modal.classList.remove('hidden');
        this.loadAttachments(returnId);
    }

    hideAttachmentsModal() {
        const modal = document.getElementById('attachments-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.removeProperty('display'); // Necessary to let .hidden work or prevent ghost display
        }
        this.currentReturnId = null;
    }

    async loadAttachments(returnId) {
        const tbody = document.getElementById('attachments-list-body');
        const msg = document.getElementById('no-attachments-msg');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">جاري التحميل...</td></tr>';
        msg.style.display = 'none';

        let baseUrl = '/full-returns';
        if (this.currentAttachmentType === 'returns') baseUrl = '/returns';
        else if (this.currentAttachmentType === 'salary') baseUrl = '/salary-returns';

        try {
            const res = await fetch(`${baseUrl}/attachments/${returnId}`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const files = await res.json();
            console.log('Attachments loaded:', files); // Debug log

            if (files && Array.isArray(files) && files.length > 0) {
                tbody.innerHTML = files.map(f => {
                    const id = f.Id ?? f.id ?? f.ID;
                    let name = f.Filename ?? f.filename ?? f.FILENAME ?? 'Unknown';
                    const date = f.CreatedAt ?? f.createdAt ?? f.CREATEDAT ?? new Date();

                    // Modern path handling: get filename from path regardless of slash type
                    let displayName = name;
                    const lastSlash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
                    if (lastSlash !== -1) {
                        displayName = name.substring(lastSlash + 1);
                    }

                    // Remove timestamp prefix (ticks_) if present
                    if (displayName.includes('_')) {
                        const parts = displayName.split('_');
                        if (parts.length > 1 && /^\d+$/.test(parts[0])) {
                            displayName = parts.slice(1).join('_');
                        }
                    }

                    const sourceLabel = f.Source === 'returns' ? ' <span style="color:#666; font-size:0.8em;">(حوافز)</span>' : (f.Source === 'salary' ? ' <span style="color:#666; font-size:0.8em;">(مرتبات)</span>' : '');

                    if (id === undefined) console.error("Attachment ID is undefined for object:", f);

                    return `
                    <tr>
                        <td style="direction: ltr; text-align: right;">${displayName}${sourceLabel}</td>
                        <td>${new Date(date).toLocaleString('ar-EG')}</td>
                        <td>
                            <button class="btn btn-sm btn-secondary" onclick="window.app.viewAttachment('${id}')" title="فتح">👁️</button>
                            <button class="btn btn-sm btn-danger" onclick="window.app.deleteAttachment('${id}')" title="حذف">🗑️</button>
                        </td>
                    </tr>`;
                }).join('');
            } else {
                tbody.innerHTML = '';
                msg.style.display = 'block';
            }
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:red;">فشل التحميل</td></tr>';
        }
    }

    async uploadAttachment(input) {
        if (!this.currentReturnId) return;

        const files = input.files;
        if (!files || files.length === 0) return;

        this.showLoading();
        let baseUrl = '/full-returns';
        if (this.currentAttachmentType === 'returns') baseUrl = '/returns';
        else if (this.currentAttachmentType === 'salary') baseUrl = '/salary-returns';

        try {
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append('file', file);

                try {
                    const result = await db.fetchApi(`${baseUrl}/attachments/${this.currentReturnId}`, {
                        method: 'POST',
                        body: formData
                    });
                    if (result.success) {
                        successCount++;
                        // Immediate feedback: refresh list after each success
                        await this.loadAttachments(this.currentReturnId);
                    } else {
                        failCount++;
                        console.error(`Failed to upload ${file.name}: ${result.message}`);
                    }
                } catch (e) {
                    failCount++;
                    console.error(`Network error for ${file.name}`, e);
                }
            }

            if (successCount > 0) {
                let msg = `تم رفع ${successCount} ملفات بنجاح`;
                if (failCount > 0) msg += ` وفشل ${failCount} ملفات`;
                this.showToast(msg, failCount > 0 ? 'warning' : 'success');

                await this.loadAttachments(this.currentReturnId);

                // Refresh the correct table
                if (this.currentAttachmentType === 'returns') {
                    this.returnsCache = null; // Invalidate cache to force fresh count display
                    this.loadReturns(this.pagination?.currentPage || 1, this.pagination?.itemsPerPage || 50, this.currentSearch, this.currentFilter);
                }
                else if (this.currentAttachmentType === 'salary') {
                    this.salaryReturnsCache = null;
                    this.loadSalaryReturns(this.paginationSalary?.currentPage || 1);
                    if (document.getElementById('unified-results')?.style.display !== 'none') {
                        this.loadFullReturns(1, 100, document.getElementById('unified-search-input')?.value, true);
                    }
                }
                else {
                    this.loadFullReturns(this.pagination?.currentPage || 1, this.pagination?.itemsPerPage || 50, null, true);
                }

                input.value = '';
            } else {
                this.showToast('فشل رفع جميع الملفات المختارة', 'error');
            }

        } catch (err) {
            console.error(err);
            this.showToast('خطأ غير متوقع', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteAttachment(id) {
        const confirmed = await dialog.show({
            title: 'حذف مرفق',
            message: 'هل أنت متأكد من رغبتك في حذف هذا الملف نهائياً؟',
            type: 'question',
            showCancel: true,
            liteMode: true
        });

        if (!confirmed) return;

        this.showLoading();
        let baseUrl = '/full-returns';
        if (this.currentAttachmentType === 'returns') baseUrl = '/returns';
        else if (this.currentAttachmentType === 'salary') baseUrl = '/salary-returns';

        try {
            console.log(`[DELETE] Attempting to delete attachment: ${id} via ${baseUrl}`);
            const result = await db.fetchApi(`${baseUrl}/attachment/${id}`, { method: 'DELETE' });
            console.log('[DELETE] Result:', result);

            if (result && (result.success || result.status === 'success')) {
                this.showToast('تم حذف الملف بنجاح', 'success');
                if (this.currentReturnId) {
                    // Wait 500ms to ensure DB transaction is completed and visible before reload
                    await new Promise(r => setTimeout(r, 500));
                    await this.loadAttachments(this.currentReturnId);

                    // Refresh the correct table
                    if (this.currentAttachmentType === 'returns') {
                        this.returnsCache = null; // Invalidate cache
                        this.loadReturns(this.pagination?.currentPage || 1, this.pagination?.itemsPerPage || 50, this.currentSearch, this.currentFilter);
                    }
                    else if (this.currentAttachmentType === 'salary') {
                        this.salaryReturnsCache = null;
                        this.loadSalaryReturns(this.paginationSalary?.currentPage || 1);
                        if (document.getElementById('unified-results')?.style.display !== 'none') {
                            this.loadFullReturns(1, 100, document.getElementById('unified-search-input')?.value, true);
                        }
                    }
                    else {
                        this.loadFullReturns(this.pagination?.currentPage || 1, this.pagination?.itemsPerPage || 50, null, true);
                    }
                }
            }
        } catch (err) {
            this.showToast('خطأ أثناء الحذف', 'error');
        } finally {
            this.hideLoading();
        }
    }

    viewAttachment(id) {
        let baseUrl = '/full-returns';
        if (this.currentAttachmentType === 'returns') baseUrl = '/returns';
        else if (this.currentAttachmentType === 'salary') baseUrl = '/salary-returns';
        window.open(`${baseUrl}/attachment/${id}`, '_blank');
    }

    getFullReturnsActionsHtml(id, count) {
        // Generic Attachment Button
        const hasAttachments = count > 0;
        const btnClass = hasAttachments ? 'btn-primary' : 'btn-secondary';
        const icon = hasAttachments ? '🖼️' : '📎';
        // Badge: Premium red badge with shadow and border
        const badge = hasAttachments ? `<span class="badge-count" style="background:#ef4444; color:white; border-radius:12px; padding:2px 8px; font-size:0.75em; position:absolute; top:-12px; right:-12px; font-weight:bold; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4); border: 1.5px solid #fff;">${count}</span>` : '';
        const title = hasAttachments ? `إدارة المرفقات (${count})` : 'إضافة مرفق';
        // Style: Cyan Glow for buttons with attachments
        const style = hasAttachments ? 'position: relative; border: 1px solid #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.5); transform: scale(1.05); transition: all 0.2s ease;' : 'position: relative; opacity: 0.6;';

        return `
        <div style="display: flex; gap: 5px;">
            <button class="btn btn-sm btn-secondary" onclick="window.app.openFullReturnFolder(${id})" title="فتح المجلد">
                📂
            </button>
            <button class="btn btn-sm btn-primary" onclick="window.app.editFullReturn(${id})" title="تعديل">
                ✏️
            </button>
            <button class="btn btn-sm ${btnClass}" onclick="window.app.openAttachmentsModal(${id}, 'full')" title="${title}" style="${style}">
                ${icon} ${badge}
            </button>
            <button class="btn btn-sm btn-danger" onclick="app.deleteFullReturn(${id})" title="حذف">
                🗑️
            </button>
        </div>
        `;
    }

    // --- Folder Opening Logic ---
    async openReturnFolder(id) {
        try {
            // إرسال طلب بـ Body فارغ لتجنب أخطاء السيرفر في قراءة JSON
            const res = await fetch(`/returns/open-folder/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const result = await res.json();
            if (result.success) {
                this.showToast('تم فتح مجلد المرفقات بنجاح', 'success');
            } else {
                this.showToast(result.message || 'فشل فتح المجلد', 'error');
            }
        } catch (e) {
            this.showToast('خطأ في الاتصال بالسيرفر', 'error');
        }
    }

    async openFullReturnFolder(id) {
        try {
            const res = await fetch(`/full-returns/open-folder/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const result = await res.json();
            if (result.success) {
                this.showToast('تم فتح مجلد المرفقات بنجاح', 'success');
            } else {
                this.showToast(result.message || 'فشل فتح المجلد', 'error');
            }
        } catch (e) {
            this.showToast('خطأ في الاتصال بالسيرفر', 'error');
        }
    }

    async openFullReturnFolderByDate(date) {
        try {
            const res = await fetch(`/full-returns/open-folder-by-date?date=${encodeURIComponent(date)}`, { method: 'POST' });
            const result = await res.json();
            if (result.success) {
                this.showToast('تم طلب فتح مجلد الأرشيف', 'success');
            } else {
                this.showToast(result.message || 'فشل فتح المجلد', 'error');
            }
        } catch (e) {
            this.showToast('خطأ في الاتصال بالسيرفر', 'error');
        }
    }

    async scanFullReturn(id) {
        this.scanProfileId = id;

        try {
            // Check for available profiles
            const res = await fetch('/full-returns/scan/profiles');
            const data = await res.json();

            if (data.success && data.profiles && data.profiles.length > 0) {
                // Show profile selector
                const select = document.getElementById('scan-profile-select');
                select.innerHTML = '<option value="">(الافتراضي)</option>';
                data.profiles.forEach(p => {
                    select.innerHTML += `< option value = "${p}" > ${p}</option > `;
                });

                document.getElementById('scan-profile-modal').classList.add('show');
            } else {
                // No profiles or error, just scan with default
                this.confirmScanWithProfile();
            }
        } catch (e) {
            // Fallback to default scan
            this.confirmScanWithProfile();
        }
    }

    closeScanProfileModal() {
        document.getElementById('scan-profile-modal').classList.remove('show');
        this.scanProfileId = null;
    }

    async confirmScanWithProfile() {
        const id = this.scanProfileId;
        const profile = document.getElementById('scan-profile-select').value;
        this.closeScanProfileModal();

        if (!id) return;

        this.showLoading();
        this.showToast('جاري الاتصال بالماسح الضوئي... ???', 'info');

        try {
            let url = `/ hk / full - returns / scan / ${id} `;
            if (profile) url += `? profileName = ${encodeURIComponent(profile)} `;

            const res = await fetch(url, { method: 'POST' });
            const result = await res.json();

            if (result.success) {
                this.showToast('تم المسح بنجاح! ?', 'success');
                // Refresh attachments
                this.loadAttachments(id);
                // Refresh list to update counts
                this.loadFullReturns(this.pagination?.currentPage || 1, this.pagination?.itemsPerPage || 50, null, true);
            } else {
                if (result.message.includes('NAPS2')) {
                    if (await confirm('فشل المسح: ' + result.message + '\n\nهل تريد فتح إعدادات الماسح (NAPS2)؟')) {
                        this.openScannerSetup();
                    }
                } else {
                    this.showToast('خطأ: ' + result.message, 'error');
                }
            }
        } catch (error) {
            console.error(error);
            this.showToast('خطأ في الاتصال بالخادم', 'error');
        } finally {
            this.hideLoading();
        }
    }


    editFullReturn(id) {
        // Remove any existing dynamic modal
        const existingModal = document.getElementById('dynamic-edit-modal');
        if (existingModal) existingModal.remove();

        const record = this.currentFullReturnsData.find(r => {
            return r.Id == id || r.id == id || r.ID == id;
        });

        if (!record) {
            this.showToast('لم يتم العثور على السجل', 'error');
            return;
        }

        this.editingRecordId = id;

        // 1. Create Modal Container
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'dynamic-edit-modal';
        modalOverlay.className = 'modal-overlay show'; // Use CSS class
        // Inline styles removed, relying on main.css

        // 2. Create Modal Content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal'; // Use CSS class
        // Inline styles removed

        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `< h3 class="modal-title" > تعديل المرتجع #${id}</h3 > `;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '?';
        closeBtn.className = 'modal-close';
        closeBtn.onclick = () => this.closeEditReturnModal();
        header.appendChild(closeBtn);
        modalContent.appendChild(header);

        // Body
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';

        // Form Container
        const formContainer = document.createElement('div');
        formContainer.id = 'dynamic-edit-form';
        formContainer.className = 'grid-form'; // Use grid layout

        const excludeKeys = ['Id', 'id', 'ID', 'AttachmentCount', 'attachmentCount', 'ImportDate', 'Filename', 'RawData'];

        Object.keys(record).forEach(key => {
            if (excludeKeys.includes(key)) return;

            const group = document.createElement('div');
            group.className = 'form-group';

            const label = document.createElement('label');
            label.textContent = key;

            const input = document.createElement('input');
            input.type = 'text';
            input.name = key;
            input.value = record[key] || '';
            input.className = 'form-input';

            group.appendChild(label);
            group.appendChild(input);
            formContainer.appendChild(group);
        });
        modalBody.appendChild(formContainer);
        modalContent.appendChild(modalBody);

        // Footer (Buttons)
        const footer = document.createElement('div');
        footer.className = 'modal-footer';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'حفظ التغييرات';
        saveBtn.className = 'btn btn-primary';
        saveBtn.onclick = () => this.saveFullReturnChanges();

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'إلغاء';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.onclick = () => this.closeEditReturnModal();

        footer.appendChild(saveBtn);
        footer.appendChild(cancelBtn);
        modalContent.appendChild(footer);

        // Append to body
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        // Close on outside click
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) this.closeEditReturnModal();
        };
    }

    closeEditReturnModal() {
        const modal = document.getElementById('dynamic-edit-modal');
        if (modal) {
            modal.remove();
        }
        this.editingRecordId = null;
    }

    async saveFullReturnChanges() {
        if (!this.editingRecordId) return;

        const formContainer = document.getElementById('dynamic-edit-form');
        if (!formContainer) return;

        const data = {};
        const inputs = formContainer.querySelectorAll('input');
        inputs.forEach(input => {
            data[input.name] = input.value;
        });

        // Find original to merge
        const original = this.currentFullReturnsData.find(r => r.Id == this.editingRecordId || r.id == this.editingRecordId);

        // Merge updates into original
        const merged = { ...original, ...data };

        // Clean up internal fields
        delete merged.Id;
        delete merged.id;
        delete merged.ID;
        delete merged.AttachmentCount;
        delete merged.attachmentCount;

        this.showLoading();
        try {
            const res = await fetch(`/ hk / full - returns / ${this.editingRecordId} `, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(merged)
            });
            const result = await res.json();

            if (result.success) {
                this.showToast('تم حفظ التعديلات بنجاح', 'success');
            this.playNotificationSound();
                this.closeEditReturnModal();
                // Refresh data
                this.loadFullReturns(this.pagination?.currentPage || 1, this.pagination?.itemsPerPage || 50, null, true);
            } else {
                this.showToast('فشل الحفظ: ' + result.message, 'error');
            }
        } catch (error) {
            console.error(error);
            this.showToast('خطأ في الاتصال', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteFullReturn(id) {
        const confirmed = await dialog.show({
            title: 'حذف سجل',
            message: 'هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع.',
            type: 'question',
            showCancel: true,
            liteMode: true
        });
        if (!confirmed) return;

        this.showLoading();
        try {
            const res = await fetch(`/ hk / full - returns / ${id} `, { method: 'DELETE' });
            const result = await res.json();
            if (result.success) {
                this.showToast('تم حذف السجل بنجاح', 'success');
                this.loadFullReturns(this.pagination?.currentPage || 1, this.pagination?.itemsPerPage || 50, null, true);
            } else {
                this.showToast('فشل الحذف: ' + result.message, 'error');
            }
        } catch (error) {
            console.error(error);
            this.showToast('خطأ في الاتصال', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async openFullReturnFolder(id) {
        // Extract folder name from already-loaded data (no DB needed)
        let folderName = null;
        const record = this.currentFullReturnsData?.find(r => (r.Id || r.id || r.ID) == id);
        if (record) {
            const nameKeys = ['CREDITOR_NAME', 'Creditor Name', 'CreditorName', 'الاسم', 'Beneficiary Name', 'اسم المستفيد', 'Name'];
            for (const key of nameKeys) {
                const match = Object.keys(record).find(k => k.toLowerCase() === key.toLowerCase());
                if (match && record[match]) {
                    folderName = record[match];
                    break;
                }
            }
        }

        try {
            const res = await fetch(`/ hk / full - returns / open - folder / ${id} `, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderName: folderName || '' })
            });
            const result = await res.json();
            if (!result.success) {
                this.showToast('فشل فتح المجلد: ' + result.message, 'error');
            }
        } catch (error) {
            console.error(error);
            this.showToast('خطأ في فتح المجلد', 'error');
        }
    }

    // ========================================
    // Archive Configuration
    // ========================================

    async loadArchivePath() {
        try {
            const res = await fetch('/config/archive-path');
            const data = await res.json();
            const input = document.getElementById('archive-path');
            if (input && data.path) {
                input.value = data.path;
            }
            // Auto Sync Path
            if (this.loadAutoSyncPath) this.loadAutoSyncPath();

            // Fetch Auto Import Config
            const cfgRes = await fetch('/config');
            const config = await cfgRes.json();
            const autoImportInput = document.getElementById('auto-import-path-input');
            if (autoImportInput && config.autoImportPath) {
                autoImportInput.value = config.autoImportPath;
            }
        } catch (e) {
            console.error(e);
        }
    }

    async saveArchivePath() {
        const path = document.getElementById('archive-path').value;
        if (!path) return;

        this.showLoading();
        try {
            const res = await fetch('/config/archive-path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            const result = await res.json();
            if (result.success) {
                this.showToast(result.message, 'success');
            } else {
                this.showToast('فشل الحفظ: ' + result.message, 'error');
            }
        } catch (e) {
            this.showToast('خطأ في الاتصال', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async browseAutoImportPath() {
        try {
            const result = await db.fetchApi('/config/browse', { method: 'POST' });
            if (result.path) {
                document.getElementById('auto-import-path-input').value = result.path;
            }
        } catch (error) {
            console.error('Browse failed:', error);
        }
    }

    async saveAutoImportPath() {
        const path = document.getElementById('auto-import-path-input').value;
        this.showLoading();
        try {
            const res = await db.fetchApi('/config/auto-import', {
                method: 'POST',
                body: JSON.stringify({ enabled: true, path })
            });
            if (res.success) {
                this.showToast('تم حفظ مسار الاستيراد التلقائي وتفعيله بنجاح', 'success');
            } else {
                this.showToast('فشل حفظ المسار: ' + res.message, 'error');
            }
        } catch (err) {
            console.error(err);
            this.showToast('خطأ في الاتصال بالخادم', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async createAutoImportFolders() {
        const path = document.getElementById('auto-import-path-input').value;
        if (!path) {
            this.showToast('يرجى تحديد مسار أولاً', 'warning');
            return;
        }
        this.showLoading();
        try {
            const res = await db.fetchApi('/config/create-auto-import-folders', {
                method: 'POST',
                body: JSON.stringify({ path })
            });
            if (res.success) {
                this.showToast(res.message, 'success');
            } else {
                this.showToast('فشل إنشاء المجلدات: ' + res.message, 'error');
            }
        } catch (err) {
            console.error(err);
            this.showToast('خطأ في الاتصال بالخادم', 'error');
        } finally {
            this.hideLoading();
        }
    }


    loadDeletePassword() {
        const pwd = localStorage.getItem('delete_password') || '1994';
        const input = document.getElementById('setting-delete-password-main');
        if (input) input.value = pwd;
    }

    saveDeletePassword() {
        const input = document.getElementById('setting-delete-password-main');
        if (!input) return;

        const pwd = input.value;
        if (!pwd) {
            this.showToast('يرجى إدخال كلمة مرور صالحة', 'error');
            return;
        }
        localStorage.setItem('delete_password', pwd);
        this.showToast('تم حفظ كلمة مرور الحذف بنجاح', 'success');
    }



    /**
     * طباعة التقرير المالي بشكل احترافي مع تحليل البيانات
     */
    async printReport() {
        const progressContainer = document.getElementById('print-prep-progress');
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
            setTimeout(() => progressContainer.classList.add('animating'), 10);
        }

        // محاكاة وقت التحضير
        await new Promise(resolve => setTimeout(resolve, 500));

        // 1. تحليل البيانات وتحديد الأعمدة
        const data = this.data || [];
        const totalCount = data.length;
        let totalAmount = 0;

        // اكتشاف الأعمدة المطلوبة
        const normalize = (str) => str ? String(str).toLowerCase().trim() : '';

        const findCol = (keywords) => {
            return this.headers.find(h => keywords.some(k => normalize(h).includes(k)));
        };

        const colName = findCol(['اسم', 'name', 'beneficiary', 'مستفيد']);
        const colAcc = findCol(['حساب', 'account', 'acc']);
        const colAmount = this.amountColumn || findCol(['مبلغ', 'amount', 'value', 'صافي']);
        const colReason = findCol(['سبب', 'reason', 'note', 'ملاحظات']);
        const colDate = this.dateColumn || findCol(['تاريخ', 'date']);
        const colNationalId = findCol(['قومي', 'national', 'id', 'هوية']);

        // حساب الإجمالي
        if (colAmount && totalCount > 0) {
            for (let i = 0; i < totalCount; i++) {
                // تنظيف الرقم من أي فواصل أو رموز عملة
                let valStr = String(data[i][colAmount] || '0').replace(/[^0-9.-]/g, '');
                const val = parseFloat(valStr);
                if (!isNaN(val)) totalAmount += val;
            }
        }

        // 2. تحديث أو إنشاء حاوية الترويسة
        let printContainer = document.querySelector('.print-report-container');
        if (printContainer) printContainer.remove(); // إعادة إنشاء لضمان النظافة

        printContainer = document.createElement('div');
        printContainer.className = 'print-report-container';
        document.querySelector('.main-content').prepend(printContainer);

        // 3. بناء صفوف الجدول
        let tableRows = '';
        if (totalCount > 0) {
            tableRows = data.map((row, index) => {
                const name = row[colName] || '-';
                const acc = row[colAcc] || '-';
                let amount = row[colAmount] || 0;

                // تنسيق المبلغ
                // إذا كان رقم
                if (typeof amount === 'number') {
                    amount = amount.toLocaleString(undefined, { minimumFractionDigits: 2 });
                }

                const reason = row[colReason] || '';
                const date = row[colDate] ? new Date(row[colDate]).toLocaleDateString('ar-EG') : '-';

                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${name}</td>
                        <td style="direction: ltr; text-align: right;">${acc}</td>
                        <td>${amount}</td>
                        <td>${reason}</td>
                        <td>${date}</td>
                    </tr>
                `;
            }).join('');
        }

        // 4. حقن المحتوى الكامل
        printContainer.innerHTML = `
            <div class="report-header">
                <div class="header-logo-section">
                    <h2>بنك القاهرة</h2>
                    <p>قطاع العمليات المركزية</p>
                    <p>وحدة معالجة المرتدات</p>
                </div>
                <div class="report-title-section">
                    <h1>تقرير المرتدات المالية</h1>
                </div>
                <div class="report-meta-section">
                    <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
                    <p>المستخدم: ${this.currentUser?.fullname || 'مسؤول النظام'}</p>
                </div>
            </div>

            <div class="report-summary-box">
                <div class="summary-item">
                    <span class="summary-label">عدد الحالات</span>
                    <span class="summary-value">${totalCount}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">إجمالي القيمة</span>
                    <span class="summary-value">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} جم</span>
                </div>
            </div>

            <div class="report-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px">#</th>
                            <th>اسم المستفيد</th>
                            <th>رقم الحساب</th>
                            <th>المبلغ</th>
                            <th>سبب الرفض</th>
                            <th>التاريخ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>

            <div class="report-signatures">
                <div class="signature-box">
                    <p>إعداد</p>
                    <div class="sig-line"></div>
                </div>
                <div class="signature-box">
                    <p>مراجعة</p>
                    <div class="sig-line"></div>
                </div>
                <div class="signature-box">
                    <p>اعتماد</p>
                    <div class="sig-line"></div>
                </div>
            </div>
        `;

        // إخفاء الشريط وعرض الطباعة
        if (progressContainer) {
            progressContainer.classList.remove('animating');
            progressContainer.classList.add('hidden');
        }

        window.print();
    }
    // ========================================
    // Extraction Feature (New)
    // ========================================

    showExtractionModal() {
        console.log('Debug: Extract button clicked');
        const modal = document.getElementById('extraction-modal');
        if (modal) {
            // Update title based on mode
            const titleEl = modal.querySelector('.modal-header h3');
            if (titleEl) {
                if (this.isUnifiedExtraction) {
                    titleEl.textContent = '🔍 استخلاص ومعالجة البحث الشامل (Excel)';
                } else {
                    titleEl.textContent = this.isSalaryExtraction ?
                        '🔍 استخلاص ومعالجة بيانات المرتبات (Excel)' :
                        '🔍 استخلاص ومعالجة بيانات الحوافز (Excel)';
                }
            }

            modal.classList.remove('hidden');
            this.resetExtractionModal();
            console.log('Debug: extraction-modal revealed');
        } else {
            console.error('Debug: extraction-modal NOT FOUND in DOM');
            this.showToast('Error loading extraction modal', 'error');
        }
    }

    showUnifiedExtractionModal() {
        this.isUnifiedExtraction = true;
        this.isSalaryExtraction = false;
        this.showExtractionModal();
    }

    closeExtractionModal() {
        const modal = document.getElementById('extraction-modal');
        if (modal) modal.classList.add('hidden');
        this.isSalaryExtraction = false;
        this.isUnifiedExtraction = false;
    }

    resetExtractionModal(keepFile = false) {
        if (!keepFile) {
            const fileName = document.getElementById('extract-file-name');
            if (fileName) {
                if (this.isUnifiedExtraction) {
                    fileName.textContent = '📥 انقر هنا لاختيار ملف البحث الشامل (.xlsx)';
                } else {
                    fileName.textContent = this.isSalaryExtraction ?
                        '📥 انقر هنا لاختيار ملف المرتبات (.xlsx)' :
                        '📥 انقر هنا لاختيار ملف الحوافز (.xlsx)';
                }
            }
            const fileInput = document.getElementById('extract-file-input');
            if (fileInput) fileInput.value = '';

            const fileInfo = document.getElementById('extract-file-info');
            if (fileInfo) fileInfo.classList.add('hidden');

            this.currentExcelData = null;
            this.extractFile = null;
        }

        const typeSelect = document.getElementById('extract-type');
        if (typeSelect) typeSelect.value = 'both';

        const dateFilter = document.getElementById('extract-date-filter');
        if (dateFilter) dateFilter.value = 'all';

        const monthFilter = document.getElementById('extract-month-filter');
        if (monthFilter) monthFilter.value = '';

        const exactMatch = document.getElementById('extract-exact-match');
        if (exactMatch) exactMatch.checked = false;

        const progress = document.getElementById('extract-progress-section');
        if (progress) progress.classList.add('hidden');

        const bar = document.getElementById('extract-progress-bar');
        if (bar) bar.style.width = '0%';

        const footer = document.getElementById('extract-modal-footer');
        if (footer) {
            footer.classList.remove('hidden');
            footer.innerHTML = `
                <button class="btn btn-secondary" onclick="app.closeExtractionModal()">إلغاء</button>
                <button class="btn btn-primary" id="extract-start-btn" onclick="app.startExtraction()">موافق (بدء)</button>
            `;
        }
    }

    async handleExtractFileSelect(input) {
        const fileInfo = document.getElementById('extract-file-info');
        const rowsCount = document.getElementById('extract-rows-count');
        const fileName = document.getElementById('extract-file-name');

        if (input.files && input.files[0]) {
            const file = input.files[0];
            if (fileName) fileName.textContent = file.name;

            try {
                this.showLoading();
                this.currentExcelData = await this.readExcelFile(file);
                this.hideLoading();

                if (this.currentExcelData && this.currentExcelData.length > 0) {
                    if (rowsCount) rowsCount.textContent = `${this.currentExcelData.length} سجل`;
                    if (fileInfo) fileInfo.classList.remove('hidden');
                    this.showToast(`تم تحميل ${this.currentExcelData.length} سجل بنجاح`, 'success');
                } else {
                    this.showToast('الملف فارغ أو لا يحتوي على بيانات', 'warning');
                }
            } catch (e) {
                console.error(e);
                this.showToast('فشل قراءة ملف الإكسيل', 'error');
                this.hideLoading();
            }
        }
    }


    formatDate(val) {
        if (!val) return '';

        let dateObj;
        const raw = String(val).trim();

        if (!raw) return '';

        // Handle Excel Serial Numbers if they still come through as numbers
        const numericVal = typeof val === 'number'
            ? val
            : (/^\d{5}(\.\d+)?$/.test(raw) ? Number(raw) : NaN);
        if (Number.isFinite(numericVal) && numericVal > 20000 && numericVal < 60000) {
            dateObj = new Date(Math.round((numericVal - 25569) * 86400 * 1000));
        } else if (val instanceof Date) {
            dateObj = val;
        } else {
            const dateParts = raw.match(/^(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
            if (dateParts) {
                let d, m, y;
                if (dateParts[1].length === 4) {
                    y = Number(dateParts[1]);
                    m = Number(dateParts[2]);
                    d = Number(dateParts[3]);
                } else {
                    d = Number(dateParts[1]);
                    m = Number(dateParts[2]);
                    y = Number(dateParts[3]);
                }
                dateObj = new Date(y, m - 1, d);
            }
        }

        if (!dateObj) {
            dateObj = new Date(raw);
        } else {
            const validParts = dateObj.getFullYear() >= 1900 && dateObj.getFullYear() <= 2100;
            if (!validParts) return val;
        }

        if (isNaN(dateObj.getTime())) {
            return val;
        }

        const d = String(dateObj.getDate()).padStart(2, '0');
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const y = dateObj.getFullYear();

        return `${d}/${m}/${y}`;
    }

    async startExtraction() {
        const typeSelect = document.getElementById('extract-type');
        const dateFilter = document.getElementById('extract-date-filter');
        const progressSection = document.getElementById('extract-progress-section');
        const progressBar = document.getElementById('extract-progress-bar');
        const statusText = document.getElementById('extract-status-text');
        const counterText = document.getElementById('extract-counter');
        const startBtn = document.getElementById('extract-start-btn');
        const footer = document.getElementById('extract-modal-footer');

        // التحميل التلقائي للشهور عند فتح المودال
        this.loadExtractionMonths();

        if (!this.currentExcelData || this.currentExcelData.length === 0) {
            this.showToast('الرجاء اختيار ملف إكسيل يحتوي على بيانات أولاً', 'warning');
            return;
        }

        // 2. Setup processing state
        startBtn.disabled = true;
        footer.classList.add('hidden');
        progressSection.classList.remove('hidden');
        progressBar.style.width = '10%';
        statusText.textContent = 'جاري البحث في قاعدة البيانات...';

        await new Promise(r => setTimeout(r, 300));

        try {
            // 3. Perform Match using relevant Cache
            statusText.textContent = 'جاري تحديث ذاكرة البيانات...';
            if (this.isUnifiedExtraction) {
                await Promise.all([
                    this.populateReturnsCache(),
                    this.populateSalaryReturnsCache()
                ]);
            } else if (this.isSalaryExtraction) {
                await this.populateSalaryReturnsCache();
            } else {
                await this.populateReturnsCache();
            }

            const monthFilter = document.getElementById('extract-month-filter').value;
            const isExactMatch = document.getElementById('extract-exact-match')?.checked || false;
            const result = this.processAdvancedExtraction(this.currentExcelData, typeSelect.value, dateFilter.value, monthFilter, isExactMatch);

            // 4. Update UI with results
            progressBar.style.width = '100%';

            const dateMode = dateFilter.value;
            let conditionText = '';
            if (dateMode === 'empty') conditionText = ' (تحت التسوية)';
            else if (dateMode === 'filled') conditionText = ' (تمت التسوية)';
            else conditionText = ' (كل السجلات)';

            statusText.textContent = `تم الانتهاء! وجدنا ${result.matches.length} سجل ${conditionText}`;
            statusText.style.color = '#10b981';
            counterText.textContent = `المطابقات: ${result.matches.length} | غير موجود: ${result.noMatches.length}`;

            this.currentExtractionResult = result;

            // 5. Upgrade footer for Export
            footer.classList.remove('hidden');
            footer.innerHTML = `
                <button class="btn btn-warning" id="extract-new-btn">🔄 بحث جديد</button>
                <button class="btn btn-success" id="extract-export-btn">💾 تحميل النتائج (Excel)</button>
                <button class="btn btn-secondary" onclick="app.closeExtractionModal()">إغلاق</button>
            `;

            document.getElementById('extract-new-btn').onclick = () => this.resetExtractionModal(true);
            document.getElementById('extract-export-btn').onclick = () => this.exportExtractionResults(result);

            this.showToast(`تم العثور على ${result.matches.length} سجل مطابق`, 'success');

        } catch (error) {
            console.error(error);
            statusText.textContent = 'حدث خطأ أثناء المعالجة';
            statusText.style.color = '#ef4444';
            footer.classList.remove('hidden');
        } finally {
            startBtn.disabled = false;
            startBtn.textContent = 'إعادة البحث 🔄';
        }
    }

    normalizeArabic(text) {
        if (!text) return '';
        let str = String(text).trim().toLowerCase();
        // Normalize Alif
        str = str.replace(/[أإآ]/g, 'ا');
        // Normalize Ta Marbuta
        str = str.replace(/ة/g, 'ه');
        // Normalize Ya/Alef Maksura
        str = str.replace(/[ىي]/g, 'ي');
        // Remove Tashkeel
        str = str.replace(/[\u064B-\u0652]/g, '');
        return str;
    }

    processAdvancedExtraction(searchCriteria, type, dateMode, monthFilter, isExactMatch = false) {
        const matches = [];
        const noMatches = [];
        const reportData = [];

        let cache = [];
        if (this.isUnifiedExtraction) {
            cache = [
                ...(this.returnsCache || []).map(r => ({ ...r, _src: 'incentive' })),
                ...(this.salaryReturnsCache || []).map(r => ({ ...r, _src: 'salary' }))
            ];
        } else {
            const currentSrc = this.isSalaryExtraction ? 'salary' : 'incentive';
            cache = ((this.isSalaryExtraction ? this.salaryReturnsCache : this.returnsCache) || [])
                .map(r => ({ ...r, _src: currentSrc }));
        }

        const nidKeys = ['NationalID', 'NID', 'الرقم القومي', 'الرقم_القومي', 'رقم قومي', 'الرقم', 'National ID', 'الرقم_التعريفي', 'الرقم القومى'];
        const nameKeys = ['Name', 'FullName', 'الاسم', 'الإسم', 'اسم العميل', 'الاسم بالكامل', 'Full Name', 'اسم الموظف', 'اسم_العميل', 'الاســــم'];
        const origAccKeys = ['رقم الحساب', 'حساب', 'Account', 'Acc', 'رقم الحساب المرتد عليه', 'OldAccount', 'رقم الحساب القديم', 'تاريخ المرتدات'];
        const modAccKeys = ['رقم الحساب بعد التعديل', 'الحساب المعدل', 'NewAccount', 'ModifiedAccount', 'رقم الحساب الجديد'];
        const returnDateKeys = ['تاريخ المرتدات', 'تاريخ الارتداد', 'تاريخ الارتدات', 'تاريخ', 'Date', 'ReturnDate', 'تاريخ_الارتداد'];
        const settledDateKeys = ['تاريخ اعتماد التعديل', 'تاريخ الاعتماد', 'تاريخ التعديل', 'ModificationDate', 'SettledDate', 'تاريخ_التعديل'];

        // Helper to clean NID
        const cleanNID = (val) => {
            if (!val) return '';
            let s = String(val).trim();
            if (s.includes('E') || s.includes('e')) {
                const num = Number(s);
                if (!isNaN(num)) s = BigInt(Math.round(num)).toString();
            }
            return s.replace(/[^\d]/g, '');
        };

        // 1. Identify all UNIQUE search keys from the uploaded file
        const summaryMaps = {
            nid: new Map(),
            nameNorm: new Map(),
            nameExact: new Map()
        };

        searchCriteria.forEach(criteria => {
            let sNID = '';
            let sNameNorm = '';
            let sNameOrig = '';

            const val = criteria.SearchValue ? String(criteria.SearchValue).trim() : '';
            if (val) {
                const cleaned = cleanNID(val);
                if (cleaned.length >= 10 && /^\d+$/.test(cleaned)) sNID = cleaned;
                else {
                    sNameNorm = this.normalizeArabic(val);
                    sNameOrig = val;
                }
            } else {
                const rawNID = this.findValue(criteria, nidKeys);
                if (rawNID) sNID = cleanNID(rawNID);
                const rawName = this.findValue(criteria, nameKeys);
                if (rawName) {
                    sNameNorm = this.normalizeArabic(rawName);
                    sNameOrig = String(rawName).trim();
                }
            }

            const displayValue = val || sNameOrig || sNID;
            const summaryObj = {
                Name: displayValue,
                NID: sNID,
                salary: { Total: 0, Settled: 0, UnderSettlement: 0 },
                incentive: { Total: 0, Settled: 0, UnderSettlement: 0 }
            };

            if (sNID) {
                if (!summaryMaps.nid.has(sNID)) summaryMaps.nid.set(sNID, summaryObj);
            } else if (sNameNorm) {
                if (isExactMatch) {
                    if (!summaryMaps.nameExact.has(sNameOrig)) summaryMaps.nameExact.set(sNameOrig, summaryObj);
                } else {
                    if (!summaryMaps.nameNorm.has(sNameNorm)) summaryMaps.nameNorm.set(sNameNorm, summaryObj);
                }
            }
        });

        // 2. Single Pass over Cache to Compute ALL summaries accurately
        cache.forEach(record => {
            const recNID = cleanNID(this.findValue(record, nidKeys));
            const recNameRaw = String(this.findValue(record, nameKeys) || '').trim();
            const recNameNorm = this.normalizeArabic(recNameRaw);
            const isDateEmpty = !record._isSettled;
            const src = record._src;

            let summaryObj = null;
            if (recNID && summaryMaps.nid.has(recNID)) {
                summaryObj = summaryMaps.nid.get(recNID);
            } else if (isExactMatch && summaryMaps.nameExact.has(recNameRaw)) {
                summaryObj = summaryMaps.nameExact.get(recNameRaw);
            } else if (!isExactMatch && summaryMaps.nameNorm.has(recNameNorm)) {
                summaryObj = summaryMaps.nameNorm.get(recNameNorm);
            }

            if (summaryObj) {
                const target = summaryObj[src];
                target.Total++;
                if (isDateEmpty) target.UnderSettlement++;
                else target.Settled++;

                if (!summaryObj.NID && recNID) summaryObj.NID = recNID;

                let passFilter = true;
                if (monthFilter && monthFilter !== 'all') {
                    const fileCodeKeys = ['كـــود الملف', 'كود الملف', 'كُـــود المـلف', 'كـــود المـلف', 'FileCode', 'كود_الملف'];
                    const fc = this.findValue(record, fileCodeKeys) || "";
                    const raw = record.RawData || "";
                    if (!String(fc).includes(monthFilter) && !String(raw).includes(monthFilter)) passFilter = false;
                }
                if (passFilter) {
                    if (dateMode === 'empty' && !isDateEmpty) passFilter = false;
                    if (dateMode === 'filled' && isDateEmpty) passFilter = false;
                }
                if (passFilter) {
                    matches.push(record);
                }
            }
        });

        // 3. Pass over searchCriteria rows to build the "Report" sheet
        const finalSummaries = new Set([...summaryMaps.nid.values(), ...summaryMaps.nameNorm.values(), ...summaryMaps.nameExact.values()]);

        searchCriteria.forEach(criteria => {
            let sNID = '';
            let sNameNorm = '';
            let sNameOrig = '';
            const criteriaAcc = String(this.findValue(criteria, modAccKeys) || '').trim();

            const val = criteria.SearchValue ? String(criteria.SearchValue).trim() : '';
            if (val) {
                const cleaned = cleanNID(val);
                if (cleaned.length >= 10 && /^\d+$/.test(cleaned)) sNID = cleaned;
                else { sNameNorm = this.normalizeArabic(val); sNameOrig = val; }
            } else {
                const rawNID = this.findValue(criteria, nidKeys);
                if (rawNID) sNID = cleanNID(rawNID);
                const rawName = this.findValue(criteria, nameKeys);
                if (rawName) { sNameNorm = this.normalizeArabic(rawName); sNameOrig = String(rawName).trim(); }
            }

            let summary = null;
            if (sNID) summary = summaryMaps.nid.get(sNID);
            else if (isExactMatch) summary = summaryMaps.nameExact.get(sNameOrig);
            else summary = summaryMaps.nameNorm.get(sNameNorm);

            if (!summary) {
                reportData.push({ ...criteria, 'ملاحظات': '' });
                return;
            }

            const totalGlobal = summary.salary.Total + summary.incentive.Total;
            const underSettlementGlobal = summary.salary.UnderSettlement + summary.incentive.UnderSettlement;

            let notes = '';
            if (totalGlobal > 0) {
                let recordForLatestDate = null;
                let recordForLatestSettled = null;
                let latestIncentiveDate = -1;
                let latestSalaryDate = -1;
                let latestSettledDate = -1;

                cache.forEach(record => {
                    let isMatch = false;
                    const rNID = cleanNID(this.findValue(record, nidKeys));
                    const rNameRaw = String(this.findValue(record, nameKeys) || '').trim();
                    const rNameNorm = this.normalizeArabic(rNameRaw);

                    if (sNID && rNID === sNID) isMatch = true;
                    else if (isExactMatch && rNameRaw === sNameOrig) isMatch = true;
                    else if (!isExactMatch && rNameNorm === sNameNorm) isMatch = true;

                    if (isMatch) {
                        const rawReturnDate = this.findValue(record, returnDateKeys);
                        const parsedReturnDate = this.parseDate(rawReturnDate);
                        const src = record._src;

                        if (src === 'incentive') {
                            if (parsedReturnDate > latestIncentiveDate) { latestIncentiveDate = parsedReturnDate; if (!recordForLatestDate || src==='incentive') recordForLatestDate = record; }
                        } else {
                            if (parsedReturnDate > latestSalaryDate) { latestSalaryDate = parsedReturnDate; if (!recordForLatestDate) recordForLatestDate = record; }
                        }

                        if (record._isSettled) {
                            const rawSettledDate = this.findValue(record, settledDateKeys) || rawReturnDate;
                            const parsedSettledDate = this.parseDate(rawSettledDate);
                            if (parsedSettledDate > latestSettledDate) { latestSettledDate = parsedSettledDate; recordForLatestSettled = record; }
                        }
                    }
                });

                const latestReturnAcc = recordForLatestDate ? String(this.findValue(recordForLatestDate, origAccKeys) || '').trim() : '';
                const isAccountMatch = criteriaAcc && latestReturnAcc && criteriaAcc === latestReturnAcc;

                if (isAccountMatch && !recordForLatestDate._isSettled) {
                    const lastReturnDate = this.formatDate(this.findValue(recordForLatestDate, returnDateKeys));
                    notes = `رقم الحساب نفس اللي ارتدات عليه المستفيد باخر تاريخ (${lastReturnDate}) رقم الحساب (${latestReturnAcc}) يجب تفعيل رقم الحساب`;
                } else if (underSettlementGlobal > 0) {
                    notes = 'جاري تسويه حاله المذكور وتعديل بياناته';
                } else {
                    const rec = recordForLatestSettled || recordForLatestDate;
                    const dateKeys = recordForLatestSettled ? settledDateKeys : returnDateKeys;
                    const accKeys = recordForLatestSettled ? modAccKeys : origAccKeys;
                    const lastDate = this.formatDate(this.findValue(rec, dateKeys));
                    const recordAcc = String(this.findValue(rec, accKeys) || '').trim();
                    notes = `تم تسوية حالة الفرد ورقم اخر سحب (${recordAcc}) وتاريخه (${lastDate})`;
                }
            } else {
                notes = 'المذكور لا توجد مرتدات خاصة به طرفنا الرجاء مراجعه الفرع المالي في هذا الشان';
                noMatches.push({ Name: sNameOrig || sNID, NID: sNID || '' });
            }

            reportData.push({
                ...criteria,
                'المرتب': `إجمالي: ${summary.salary.Total} (تم: ${summary.salary.Settled}، تحت: ${summary.salary.UnderSettlement})`,
                'الحوافز': `إجمالي: ${summary.incentive.Total} (تم: ${summary.incentive.Settled}، تحت: ${summary.incentive.UnderSettlement})`,
                'ملاحظات': notes
            });
        });

        const uniqueMatches = [...new Map(matches.map(item => [JSON.stringify(item), item])).values()];

        const summarySalaryArr = Array.from(finalSummaries).map(s => ({ ...s, ...s.salary }));
        const summaryIncentiveArr = Array.from(finalSummaries).map(s => ({ ...s, ...s.incentive }));

        return {
            matches: uniqueMatches,
            noMatches,
            summarySalary: summarySalaryArr,
            summaryIncentive: summaryIncentiveArr,
            fullReport: reportData
        };
    }

    exportExtractionResults(result) {
        if (!result.matches.length && !result.summarySalary?.length && !result.summaryIncentive?.length && !result.fullReport.length) {
            this.showToast('لا توجد نتائج لتصديرها', 'warning');
            return;
        }

        const wb = XLSX.utils.book_new();
        // Global RTL hint
        if (!wb.Workbook) wb.Workbook = {};
        wb.Workbook.Views = [{ RTL: true }];

        const summaryRows = [];

        const addTable = (title, data) => {
            if (!data || data.length === 0) return;
            // Only add table if there's any record with Total > 0 or if we want to show all (currently showing all matching criteria)
            const hasData = data.some(item => item.Total > 0);
            if (!hasData) return;

            // source title row (e.g. المرتبات or الحوافز)
            summaryRows.push([title, '', '', '', '']);

            // header row
            summaryRows.push(['الاسم', 'الرقم القومي', 'إجمالي السجلات', 'تمت التسوية', 'تحت التسوية']);

            let tTotal = 0, tSettled = 0, tUnder = 0;

            // Sort data to show people with records first
            const sortedData = [...data].sort((a,b) => (b.Total || 0) - (a.Total || 0));

            sortedData.forEach(item => {
                summaryRows.push([
                    item.Name || '',
                    item.NID || '',
                    item.Total || 0,
                    item.Settled || 0,
                    item.UnderSettlement || 0
                ]);
                tTotal += (item.Total || 0);
                tSettled += (item.Settled || 0);
                tUnder += (item.UnderSettlement || 0);
            });

            // Total row
            summaryRows.push(['الإجمالي', '', tTotal, tSettled, tUnder]);

            // spacer row
            summaryRows.push(['', '', '', '', '']);
        };

        addTable('المرتبات', result.summarySalary);
        addTable('الحوافز', result.summaryIncentive);

        if (summaryRows.length > 0) {
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
            wsSummary['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
            if (!wsSummary['!views']) wsSummary['!views'] = [];
            wsSummary['!views'].push({ RTL: true });

            XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص البحث (Summary)");
        }

        // Sheet 1: Full Report (Uploaded Data + Notes)
        if (result.fullReport && result.fullReport.length > 0) {
            const wsReport = XLSX.utils.json_to_sheet(result.fullReport);
            // Auto-width adjustments
            wsReport['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 40 }];
            if (!wsReport['!views']) wsReport['!views'] = [];
            wsReport['!views'].push({ RTL: true });
            XLSX.utils.book_append_sheet(wb, wsReport, "تقرير الاستخراج (Report)");
        }

        // New Sheets: "الحافز" and "المراتب" for non-settled records
        const nonSettledMatches = result.matches.filter(r => !r._isSettled);

        const incentiveNonSettled = nonSettledMatches.filter(r => r._src === 'incentive');
        if (incentiveNonSettled.length > 0) {
            const wsIncentive = XLSX.utils.json_to_sheet(incentiveNonSettled.map(r => {
                const clean = { ...r };
                delete clean._src;
                delete clean._isSettled;
                delete clean._amount;
                delete clean._searchStr;
                return clean;
            }));
            if (!wsIncentive['!views']) wsIncentive['!views'] = [];
            wsIncentive['!views'].push({ RTL: true });
            XLSX.utils.book_append_sheet(wb, wsIncentive, "الحافز");
        }

        const salaryNonSettled = nonSettledMatches.filter(r => r._src === 'salary');
        if (salaryNonSettled.length > 0) {
            const wsSalary = XLSX.utils.json_to_sheet(salaryNonSettled.map(r => {
                const clean = { ...r };
                delete clean._src;
                delete clean._isSettled;
                delete clean._amount;
                delete clean._searchStr;
                return clean;
            }));
            if (!wsSalary['!views']) wsSalary['!views'] = [];
            wsSalary['!views'].push({ RTL: true });
            XLSX.utils.book_append_sheet(wb, wsSalary, "المراتب");
        }

        /* Match Records sheet removed as per user request (Excel should have 2 sheets only) */

        /* Not Found sheet removed as per user request (Excel should have 2 sheets only) */

        const fileName = this.isUnifiedExtraction ?
            `Unified_Extraction_${new Date().toISOString().slice(0, 10)}.xlsx` :
            `Extraction_Results_${new Date().toISOString().slice(0, 10)}.xlsx`;

        XLSX.writeFile(wb, fileName);
        this.showToast('تم بدء تحميل ملف الإكسيل', 'success');
    }

    // ========================================
    // البحث الموحد (Unified Search Logic)
    // ========================================

    runUnifiedSearch() {
        const input = document.getElementById('unified-search-input');
        const query = input ? input.value : '';
        this.unifiedSettlementStatus = document.getElementById('unified-settlement-status')?.value || this.unifiedSettlementStatus || 'not_settled';
        this.searchQuery = query;
        this.selectedUnifiedStatementQuery = '';
        this.selectedUnifiedStatementRow = null;
        this.updateUnifiedAccountStatementButton(false);
        this.loadFullReturns(1, 50, query, true);
    }

    handleUnifiedSettlementStatusChange(value) {
        this.unifiedSettlementStatus = value || 'not_settled';
        this.runUnifiedSearch();
    }

    showUnifiedLightProgress(percent = 25) {
        const container = document.getElementById('unified-sync-progress');
        const bar = document.getElementById('unified-sync-bar');
        if (!container || !bar) return;
        container.classList.remove('hidden');
        container.classList.add('is-light-sync');
        bar.style.width = `${Math.max(5, Math.min(100, percent))}%`;
    }

    hideUnifiedLightProgress(delay = 450) {
        const container = document.getElementById('unified-sync-progress');
        const bar = document.getElementById('unified-sync-bar');
        if (!container || !bar) return;
        bar.style.width = '100%';
        window.clearTimeout(this._unifiedLightProgressTimer);
        this._unifiedLightProgressTimer = window.setTimeout(() => {
            container.classList.add('hidden');
            container.classList.remove('is-light-sync');
            bar.style.width = '0%';
        }, delay);
    }

    // ========================================
    async loadFullReturns(page = 1, pageSize = 50, query = '', isSearch = false) {
        try {
            db.fetchApi('/config', { __skipLoadingWrapper: true }).then(config => {
                const autoImportToggle = document.getElementById('auto-import-toggle-input');
                if (autoImportToggle) {
                    autoImportToggle.checked = !!config.autoImportEnabled;
                }
            }).catch(cfgErr => console.error('Error fetching config for auto import:', cfgErr));
        } catch (e) {}

        if (isSearch) this.selectedUnifiedStatementQuery = '';
        if (query === null || query === undefined) {
            query = document.getElementById('unified-search-input')?.value || '';
        }
        this.unifiedSettlementStatus = document.getElementById('unified-settlement-status')?.value || this.unifiedSettlementStatus || 'not_settled';

        const loadingEl = document.getElementById('unified-loading');
        const resultsEl = document.getElementById('unified-results');
        const statsRow = document.getElementById('unified-stats-row');

        if (loadingEl) loadingEl.classList.add('hidden');
        this.showUnifiedLightProgress(28);
        this.showUnifiedSearchState('');
        this.updateUnifiedAccountStatementButton(false);

        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: String(pageSize),
                settlementStatus: this.unifiedSettlementStatus || 'not_settled'
            });
            if (query && query.trim()) params.set('q', query.trim());
            const response = await db.fetchApi(`/api/search/comprehensive?${params.toString()}`, { __skipLoadingWrapper: true });
            this.showUnifiedLightProgress(72);
            const incentiveRows = response.incentiveRecords || [];
            const salaryRows = await this.ensureUnifiedSalaryRowsFromSalaryEndpoint(response.salaryRecords || []);
            const totalRows = (response.data || []).length;

            this.unifiedIncentiveData = incentiveRows;
            this.unifiedSalaryData = salaryRows;

            this.updateUnifiedStats(
                {
                    filteredCount: response.stats?.incentiveCount ?? incentiveRows.length,
                    totalAmount: response.stats?.incentiveAmount ?? this.sumUnifiedAmounts(incentiveRows)
                },
                {
                    totalCount: response.stats?.salaryCount ?? salaryRows.length,
                    totalAmount: response.stats?.salaryAmount ?? this.sumUnifiedSalaryAmounts(salaryRows)
                }
            );

            this.renderUnifiedTable('incentive', incentiveRows);
            this.renderUnifiedTable('salary', salaryRows);

            if (loadingEl) loadingEl.classList.add('hidden');
            this.hideUnifiedLightProgress();
            if (resultsEl) resultsEl.style.display = 'block';
            if (statsRow) statsRow.style.display = 'grid';

            if (totalRows === 0) {
                const message = query && query.trim()
                    ? 'لا توجد نتائج مطابقة للبحث'
                    : 'اكتب اسم أو رقم قومي أو رقم حساب للبحث، أو راجع أحدث السجلات المعروضة عند توفرها';
                this.showUnifiedSearchState(message, 'empty');
            } else {
                this.showUnifiedSearchState('', '');
            }

            if (totalRows === 1) {
                const only = (response.data || [])[0];
                this.selectedUnifiedStatementRow = only;
                this.selectedUnifiedStatementQuery = this.buildUnifiedStatementQuery(only);
                this.updateUnifiedAccountStatementButton(true);
            }

        } catch (error) {
            console.error('[UNIFIED] Search failed:', error);
            this.showToast('فشل البحث الموحد: ' + error.message, 'error');
            this.showUnifiedSearchState('حدث خطأ أثناء تحميل نتائج البحث الشامل', 'error');
            if (loadingEl) loadingEl.classList.add('hidden');
            this.hideUnifiedLightProgress();
        }
    }

    async toggleAutoImport(checked) {
        try {
            const res = await db.fetchApi('/config/auto-import', {
                method: 'POST',
                body: JSON.stringify({ enabled: checked, path: "" })
            });
            if (res.success) {
                this.showToast(checked ? 'تم تفعيل الاستيراد التلقائي من المجلد المخصص' : 'تم إيقاف الاستيراد التلقائي', 'success');
            } else {
                this.showToast('فشل تحديث الإعدادات: ' + res.message, 'error');
                const autoImportToggle = document.getElementById('auto-import-toggle-input');
                if (autoImportToggle) autoImportToggle.checked = !checked;
            }
        } catch (err) {
            console.error('Error toggling auto import:', err);
            this.showToast('خطأ في الاتصال بالخادم', 'error');
            const autoImportToggle = document.getElementById('auto-import-toggle-input');
            if (autoImportToggle) autoImportToggle.checked = !checked;
        }
    }

    showUnifiedSearchState(message = '', type = '') {
        let stateEl = document.getElementById('unified-search-state');
        const resultsEl = document.getElementById('unified-results');
        if (!stateEl && resultsEl) {
            stateEl = document.createElement('div');
            stateEl.id = 'unified-search-state';
            stateEl.className = 'unified-table-empty';
            stateEl.style.cssText = 'margin: 18px 0; padding: 18px; border-radius: 10px; text-align: center; color: #cbd5e1; background: rgba(15,23,42,0.72); border: 1px solid rgba(148,163,184,0.18);';
            resultsEl.parentNode.insertBefore(stateEl, resultsEl);
        }
        if (!stateEl) return;
        if (!message) {
            stateEl.classList.add('hidden');
            stateEl.textContent = '';
            return;
        }
        stateEl.classList.remove('hidden');
        stateEl.style.borderColor = type === 'error' ? 'rgba(239,68,68,0.45)' : 'rgba(148,163,184,0.18)';
        stateEl.textContent = message;
    }

    updateUnifiedStats(incStats, salStats) {
        const incCount = incStats?.filteredCount || incStats?.totalCount || 0;
        const incAmount = incStats?.totalAmount || 0;

        const salCount = salStats?.totalCount || 0;
        const salAmount = salStats?.totalAmount || 0;

        const totalCount = incCount + salCount;
        const totalAmount = incAmount + salAmount;

        const el = (id) => document.getElementById(id);
        const format = (val) => typeof val === 'number' ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : val;

        // Update Big Amounts
        if (el('unified-total-amount')) el('unified-total-amount').textContent = format(totalAmount);
        if (el('unified-salary-amount')) el('unified-salary-amount').textContent = format(salAmount);
        if (el('unified-incentive-amount')) el('unified-incentive-amount').textContent = format(incAmount);

        // Update Small Counts
        if (el('unified-total-count')) el('unified-total-count').textContent = `العدد: ${totalCount.toLocaleString()}`;
        if (el('unified-salary-count')) el('unified-salary-count').textContent = `العدد: ${salCount.toLocaleString()}`;
        if (el('unified-incentive-count')) el('unified-incentive-count').textContent = `العدد: ${incCount.toLocaleString()}`;

        // Update Badges
        if (el('unified-incentive-badge')) el('unified-incentive-badge').textContent = incCount.toLocaleString();
        if (el('unified-salary-badge')) el('unified-salary-badge').textContent = salCount.toLocaleString();
    }

    getUnifiedAmountValue(row = {}) {
        const keys = [
            'قيمة العملية',
            ' قيمة العملية',
            'OperationAmount',
            'operationAmount',
            'operationValue',
            'OperationValue',
            'amount',
            'Amount',
            'Value',
            'value',
            'ProcessValue',
            'Transaction Amount',
            'Transaction Value',
            'transactionAmount',
            'salaryAmount',
            'المبلغ',
            'مبلغ',
            'صافي المبلغ'
        ];

        for (const key of keys) {
            if (row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== '') {
                return row[key];
            }
        }

        const dynamicKey = Object.keys(row).find(key => {
            const normalized = String(key)
                .replace(/ـ/g, '')
                .replace(/[أإآ]/g, 'ا')
                .replace(/ة/g, 'ه')
                .replace(/ى/g, 'ي')
                .replace(/\s+/g, '')
                .trim()
                .toLowerCase();
            const isAmountKey = (
                normalized.includes('قيمهالعمليه') ||
                normalized.includes('مبلغ') ||
                normalized.includes('amount') ||
                normalized.includes('operationvalue') ||
                normalized.includes('operationamount') ||
                normalized.includes('transactionamount') ||
                normalized.includes('transactionvalue') ||
                normalized.includes('salaryamount') ||
                normalized === 'value'
            );
            const isNonAmountKey = (
                normalized.includes('تسويه') ||
                normalized.includes('settlement') ||
                normalized.includes('حساب') ||
                normalized.includes('account') ||
                normalized.includes('قومي') ||
                normalized.includes('national') ||
                normalized.includes('id')
            );
            return isAmountKey && !isNonAmountKey && row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== '';
        });

        return dynamicKey ? row[dynamicKey] : 0;
    }

    async ensureUnifiedSalaryRowsFromSalaryEndpoint(rows = []) {
        if (!Array.isArray(rows) || rows.length === 0) return rows;

        let sourceRows = Array.isArray(this.salaryReturnsCache) && this.salaryReturnsCache.length > 0
            ? this.salaryReturnsCache
            : [];

        if (sourceRows.length === 0 && window.db?.getAllSalaryReturns) {
            try {
                sourceRows = await db.getAllSalaryReturns();
                if (Array.isArray(sourceRows)) this.salaryReturnsCache = sourceRows;
            } catch (error) {
                console.warn('[UNIFIED] Unable to enrich salary amounts from salary returns endpoint:', error);
                sourceRows = [];
            }
        }

        if (!Array.isArray(sourceRows) || sourceRows.length === 0) return rows;

        const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
        const byId = new Map();
        const byComposite = new Map();

        sourceRows.forEach(source => {
            const id = source.id || source.Id;
            if (id !== null && id !== undefined && String(id).trim() !== '') {
                byId.set(String(id), source);
            }
            const composite = [
                source['كود الملف'] || source['كـــود الملف'] || source.FileCode,
                source['الاسم'] || source.Name,
                source['رقم الحساب'] || source.AccountNumber,
                source['الرقم القومي'] || source.NationalId || source.NID
            ].map(normalize).join('|');
            if (composite.replace(/\|/g, '')) byComposite.set(composite, source);
        });

        return rows.map(row => {
            const currentAmount = this.parseAmount(this.getUnifiedSalaryAmountValue(row));
            if (currentAmount !== 0) return row;

            const rowId = row.id || row.Id || row.RecordId || row.OriginalId;
            let source = rowId !== null && rowId !== undefined ? byId.get(String(rowId)) : null;
            if (!source) {
                const composite = [
                    row['كود الملف'] || row['كـــود الملف'] || row.FileCode,
                    row['الاسم'] || row.Name,
                    row['رقم الحساب'] || row.AccountNumber,
                    row['الرقم القومي'] || row.NationalId || row.NID
                ].map(normalize).join('|');
                source = byComposite.get(composite);
            }

            if (!source) return row;

            const merged = {
                ...row,
                ...source,
                id: row.id || row.Id || source.id || source.Id,
                Id: row.Id || row.id || source.Id || source.id,
                AttachmentCount: row.AttachmentCount ?? source.AttachmentCount ?? 0,
                _src: 'salary'
            };
            const amount = this.getUnifiedSalaryAmountValue(merged);
            merged._amount = this.parseAmount(amount);
            return merged;
        });
    }

    sumUnifiedAmounts(rows = []) {
        if (!Array.isArray(rows)) return 0;
        return rows.reduce((sum, row) => sum + this.parseAmount(this.getUnifiedAmountValue(row)), 0);
    }

    getUnifiedSalaryAmountValue(row = {}) {
        const keys = [
            'قيمة العملية',
            ' قيمة العملية',
            'OperationAmount',
            'operationAmount',
            'OperationValue',
            'operationValue',
            'ProcessValue',
            'processValue',
            'Amount',
            'amount',
            'Value',
            'value',
            'Transaction Amount',
            'Transaction Value',
            'transactionAmount',
            'transactionValue',
            'salaryAmount',
            'المبلغ',
            'مبلغ',
            'صافي المبلغ'
        ];

        for (const key of keys) {
            if (row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== '') {
                return row[key];
            }
        }

        return '';
    }

    sumUnifiedSalaryAmounts(rows = []) {
        if (!Array.isArray(rows)) return 0;
        return rows.reduce((sum, row) => sum + this.parseAmount(this.getUnifiedSalaryAmountValue(row)), 0);
    }

    toggleUnifiedSection(type) {
        const wrapper = document.getElementById(`section-${type}`);
        if (wrapper) {
            wrapper.classList.toggle('collapsed');
        }
    }

    getUnifiedTableHeaders(type) {
        const base = [
            '#',
            'كود الملف',
            'الشهر',
            'الاسم',
            'الرقم القومي',
            'رقم الحساب',
            'البنك',
            'قيمة العملية',
            'الحالة',
            'السبب',
            'رقم الحساب بعد التعديل',
            'البنك بعد التعديل',
            'كود الفرع بعد التعديل',
            'تاريخ الرفع',
            'رقم تسوية التعلية',
            'تاريخ المرتد / تاريخ التعلية',
            'تاريخ اعتماد المرتدات',
            'تاريخ التعديل',
            'تاريخ اعتماد التعديل',
            'رقم تسوية السداد',
            'تاريخ اعتماد التعديل / تاريخ السداد',
            'حالة التسوية'
        ];
        return base;
    }

    getUnifiedCellValue(type, row, header, rowIndex) {
        let val = row[header] ?? '';

        if (header === 'قيمة العملية') {
            val = this.getUnifiedAmountValue(row);
        }

        if (val === '') {
            if (header === 'تاريخ المرتد / تاريخ التعلية') {
                val = row['تاريخ المرتد'] || row['تاريخ المرتدات'] || '';
            }
            if (header === 'تاريخ اعتماد التعديل / تاريخ السداد') {
                val = row['تاريخ اعتماد التعديل / تاريخ السداد'] || row['تاريخ السداد'] || row['تاريخ التسوية'] || row['تاريخ السداد الفعلي'] || row['SettlementDate'] || '';
            }
        }

        if (header === '#') {
            return { html: String(rowIndex + 1), raw: String(rowIndex + 1) };
        }

        if (header === 'كود الملف') {
            const fileCode = this.findValue(row, ['كـــود الملف', 'كود الملف', 'كُـــود المـلف', ' FileCode', 'كود_الملف', 'FileCode', 'Instruction Identification', 'InstructionIdentification', 'Batch ID', 'BatchID']) || '';
            return { html: this.escapeHtml(fileCode), raw: String(fileCode) };
        }

        if (header === 'الاسم') {
            val = row['الاسم'] || row['الاسم '] || row['Name'] || row['FullName'] || row['Creditor Name'] || row['CreditorName'] || row['Beneficiary Name'] || row['BeneficiaryName'] || '';
        } else if (header === 'الرقم القومي') {
            val = row['الرقم القومي'] || row['الرقم_القومي'] || row['NationalId'] || row['NID'] || row['Creditor National ID'] || row['CreditorNationalID'] || row['National ID'] || '';
            if (!val) {
                for (const key in row) {
                    const lowKey = key.toLowerCase();
                    if ((lowKey.includes('national') || lowKey.includes('nid') || key.includes('قومي')) && row[key]) {
                        val = row[key];
                        break;
                    }
                }
            }
        } else if (header === 'الشهر') {
            if (type === 'salary') {
                const fileCode = this.findValue(row, ['كـــود الملف', 'كود الملف', 'FileCode', 'كُـــود المـلف', 'كود_الملف', 'Instruction Identification', 'InstructionIdentification', 'Batch ID', 'BatchID']) || '';
                val = row['الشهر'] || this.extractMonthFromFileCode(fileCode);
            } else {
                val = row['الشهر'] || this._getMonthFilterValue(row);
            }
        } else if (header === 'رقم الحساب') {
            val = row['رقم الحساب'] || row['رقم الحساب القديم'] || row['AccountNumber'] || row['Account'] || row['OldAccount'] || row['Creditor Account Number'] || row['CreditorAccountNumber'] || row['Account Number'] || '';
        } else if (header === 'البنك') {
            val = row['البنك'] || row['اسم البنك'] || row['Bank'] || row['BankName'] || row['Creditor Party Bic'] || row['CreditorPartyBic'] || row['BIC'] || row['BankCode'] || row['كود البنك'] || '';
        } else if (header === 'الحالة') {
            val = row['الحالة'] || row['حالة الارتداد'] || row['Status'] || row['ReturnStatus'] || row['Transaction Status'] || row['TransactionStatus'] || row['ISOStatus Description'] || row['ISOStatusDescription'] || '';
        } else if (header === 'السبب') {
            val = row['السبب'] || row['سبب الارتجاع'] || row['Reason'] || row['RejectReason'] || row['Transaction ISoStatus Reason'] || row['TransactionISoStatusReason'] || '';
        } else if (header === 'تاريخ الرفع') {
            val = row['تاريخ الرفع'] || row['UploadDate'] || row['uploadDate'] || row['CreatedAt'] || '';
        } else if (header === 'حالة التسوية') {
            const actualVal = String(row[header] || '').trim();
            if (actualVal === 'تم التسوية' || actualVal === 'تمت التسوية') {
                return { html: '<span class="badge-status success">تم التسوية ✅</span>', raw: 'تم التسوية' };
            }
            if (actualVal === 'لم يتم التسوية') {
                return { html: '<span class="badge-status pending">لم يتم التسوية ⏳</span>', raw: 'لم يتم التسوية' };
            }
            return { html: this.escapeHtml(actualVal), raw: actualVal };
        }

        if ((header.includes('تاريخ') || header.includes('Date')) && val) {
            val = this.formatDate(val);
        }

        if ((header.includes('قيمة') || header.includes('المبلغ') || header.includes('Amount')) && val) {
            const num = this.parseAmount(val);
            if (!isNaN(num)) {
                return {
                    html: `<span class="${num >= 0 ? 'amount-positive' : 'amount-negative'}">${num.toLocaleString()}</span>`,
                    raw: num.toLocaleString()
                };
            }
        }

        const raw = String(val ?? '');
        return { html: this.escapeHtml(raw), raw };
    }

    renderUnifiedRowActions(type, row) {
        const rowId = row.id || row.Id;
        const attachmentType = type === 'salary' ? 'salary' : 'returns';
        const hasAttachments = Number(row.AttachmentCount || row.attachmentCount || 0) > 0;
        const btnClass = hasAttachments ? 'btn-primary' : 'btn-secondary';
        const icon = hasAttachments ? '🖼️' : '📎';
        const badge = hasAttachments ? `<span class="badge-count" style="background:#ef4444; color:white; border-radius:12px; padding:2px 8px; font-size:0.75em; position:absolute; top:-12px; right:-12px; font-weight:bold; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4); border: 1.5px solid #fff;">${row.AttachmentCount}</span>` : '';
        const style = hasAttachments ? 'position: relative; border: 1px solid #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.5); transform: scale(1.05); transition: all 0.2s ease;' : 'position: relative; opacity: 0.6;';
        const editAction = type === 'salary' ? `window.app.editSalaryReturn('${rowId}')` : `window.app.editReturn('${rowId}')`;
        const folderAction = type === 'salary' ? `window.app.openSalaryReturnFolder('${rowId}')` : `window.app.openReturnFolder('${rowId}')`;
        const deleteAction = type === 'salary' ? `window.app.deleteSalaryReturn('${rowId}')` : `window.app.deleteReturn('${rowId}')`;

        return `<td class="col-actions" style="text-align:center; white-space: nowrap;">
            <button class="btn-icon ${btnClass}" style="margin-left:5px; ${style}" onclick="event.stopPropagation(); window.app.openAttachmentsModal('${rowId}', '${attachmentType}')" title="${hasAttachments ? 'عرض ' + row.AttachmentCount + ' مرفقات' : 'إضافة مرفق'}">
                ${icon} ${badge}
            </button>
            <button class="btn-icon" style="margin-left:5px;" onclick="event.stopPropagation(); ${editAction}" title="تعديل السجل">✏️</button>
            <button class="btn-icon" style="margin-left:5px;" onclick="event.stopPropagation(); ${folderAction}" title="فتح مجلد المرفقات">📂</button>
            <button class="btn-icon" style="color: #f87171;" onclick="event.stopPropagation(); ${deleteAction}" title="حذف السجل">🗑️</button>
        </td>`;
    }

    renderUnifiedSalaryTable(data) {
        const tableBody = document.getElementById('unified-salary-body');
        const tableHead = document.getElementById('unified-salary-head');
        const emptyEl = document.getElementById('unified-salary-empty');

        if (!tableBody || !tableHead) return;
        tableBody.innerHTML = '';
        tableHead.innerHTML = '';

        if (!data || data.length === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }

        if (emptyEl) emptyEl.classList.add('hidden');

        const salaryHeaders = this.getSalaryTableHeaders({ includeActions: true });

        tableHead.innerHTML = salaryHeaders.map(h => {
            let cls = 'sci-fi-th';
            if (h === 'الإجراءات') cls += ' col-actions';
            else cls += ` ${this.getSalaryColumnClasses(h).classes.join(' ')}`;
            return `<th class="${cls}"${h === 'الإجراءات' ? ' style="text-align:center;"' : ''}>${h}</th>`;
        }).join('');

        const query = document.getElementById('unified-search-input')?.value || '';
        let searchRegex = null;
        if (query.trim()) {
            const words = this.normalizeArabic(query).split(/\s+/).filter(Boolean);
            if (words.length) {
                searchRegex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
            }
        }

        data.slice(0, 100).forEach((row, rowIndex) => {
            const tr = document.createElement('tr');
            tr.className = 'unified-result-row';
            tr.addEventListener('click', () => this.selectUnifiedResult(row, tr));

            salaryHeaders.forEach(h => {
                if (h === 'الإجراءات') {
                    tr.insertAdjacentHTML('beforeend', this.renderUnifiedRowActions('salary', row));
                    return;
                }

                const td = document.createElement('td');
                const cell = this.getSalaryCellValue(row, h, rowIndex);
                let val = cell.html;
                const rawVal = cell.raw;
                if (searchRegex && h !== '#' && h !== 'حالة التسوية' && rawVal.length < 500 && !String(val).includes('<')) {
                    val = this.escapeHtml(rawVal).replace(searchRegex, '<span class="search-highlight">$1</span>');
                } else if (!String(val).includes('<')) {
                    val = this.escapeHtml(val);
                }

                const { classes, isNameCol } = this.getSalaryColumnClasses(h);
                td.classList.add('sci-fi-td', ...classes);
                if (isNameCol) {
                    td.classList.add('clickable-name');
                    td.title = 'انقر مرتين لفلترة هذا الاسم';
                    td.ondblclick = () => this.triggerNameSearch(rawVal.trim());
                }

                td.innerHTML = val;
                tr.appendChild(td);
            });

            tableBody.appendChild(tr);
        });
    }

    renderUnifiedTable(type, data) {
        if (type === 'salary') {
            this.renderUnifiedSalaryTable(data);
            return;
        }

        const tableBody = document.getElementById(`unified-${type}-body`);
        const tableHead = document.getElementById(`unified-${type}-head`);
        const emptyEl = document.getElementById(`unified-${type}-empty`);

        if (!tableBody || !tableHead) return;

        tableBody.innerHTML = '';
        tableHead.innerHTML = '';

        if (!data || data.length === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }

        if (emptyEl) emptyEl.classList.add('hidden');

        const headers = [...this.getUnifiedTableHeaders(type), 'الإجراءات'];

        headers.forEach((h, index) => {
            const th = document.createElement('th');
            th.textContent = h;
            const hNorm = h.replace(/ـ/g, '').replace(/[أإآ]/g, 'ا').toLowerCase();
            if (h === '#') th.classList.add('sticky-seq', 'col-id');
            else if (hNorm.includes('الاسم') || hNorm.includes('name')) th.classList.add('sticky-name', 'col-name');
            else if (h.includes('قيمة العملية') || h.includes('المبلغ')) th.classList.add('sticky-amount', 'col-amount');
            if (type === 'salary') th.classList.add('sci-fi-th');
            tableHead.appendChild(th);
        });

        let searchRegex = null;
        const searchInput = document.getElementById('unified-search-input');
        if (searchInput && searchInput.value.trim().length > 0) {
            const normalizedQuery = this.normalizeArabic(searchInput.value);
            const words = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
            if (words.length > 0) {
                const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                searchRegex = new RegExp(`(${pattern})`, 'gi');
            }
        }

        data.slice(0, 100).forEach((row, rowIndex) => {
            const tr = document.createElement('tr');
            tr.className = 'unified-result-row';
            tr.addEventListener('click', () => this.selectUnifiedResult(row, tr));
            headers.forEach((h, index) => {
                if (h === 'الإجراءات') {
                    tr.insertAdjacentHTML('beforeend', this.renderUnifiedRowActions(type, row));
                    return;
                }

                const td = document.createElement('td');
                const cell = this.getUnifiedCellValue(type, row, h, rowIndex);
                let html = cell.html;
                if (searchRegex && h !== '#' && h !== 'حالة التسوية' && cell.raw && cell.raw.length < 500 && !html.includes('<span class="badge-status')) {
                    html = this.escapeHtml(cell.raw).replace(searchRegex, '<span class="search-highlight">$1</span>');
                }
                td.innerHTML = html;

                const hNorm = h.replace(/ـ/g, '').replace(/[أإآ]/g, 'ا').toLowerCase();
                const isNameCol = hNorm.includes('الاسم') || hNorm.includes('name');
                if (h === '#') td.classList.add('sticky-seq', 'col-id');
                else if (isNameCol) {
                    td.classList.add('sticky-name', 'col-name', 'clickable-name');
                    td.title = 'انقر مرتين لفلترة هذا الاسم';
                    td.ondblclick = () => this.triggerNameSearch(cell.raw.trim());
                } else if (h.includes('قيمة العملية') || h.includes('المبلغ')) {
                    td.classList.add('sticky-amount', 'col-amount');
                }
                if (type === 'salary') td.classList.add('sci-fi-td');
                tr.appendChild(td);
            });
            tableBody.appendChild(tr);
        });
    }

    exportUnifiedTable(type) {
        const data = type === 'incentive' ? this.unifiedIncentiveData : this.unifiedSalaryData;
        if (!data || data.length === 0) {
            this.showToast('لا توجد بيانات للتصدير', 'warning');
            return;
        }

        try {
            this.showLoading();
            const headers = Object.keys(data[0]).filter(k => !k.startsWith('_') && k.toLowerCase() !== 'id');
            const worksheetData = [headers];
            data.forEach(row => {
                worksheetData.push(headers.map(h => row[h] || ''));
            });

            const ws = XLSX.utils.aoa_to_sheet(worksheetData);
            if (!ws['!views']) ws['!views'] = [];
            ws['!views'].push({ RTL: true });

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, type === 'incentive' ? "مرتدات الحوافز" : "مرتدات المرتبات");

            const fileName = `بحث_موحد_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, fileName);
            this.showToast('تم تصدير البيانات بنجاح', 'success');
        } catch (error) {
            console.error('Unified Export Error:', error);
            this.showToast('فشل تصدير البيانات', 'error');
        } finally {
            this.hideLoading();
        }
    }

    selectUnifiedResult(row, tr) {
        document.querySelectorAll('.unified-result-row.selected').forEach(el => el.classList.remove('selected'));
        tr?.classList.add('selected');
        this.selectedUnifiedStatementRow = row;
        this.selectedUnifiedStatementQuery = this.buildUnifiedStatementQuery(row);
        this.updateUnifiedAccountStatementButton(true);
    }

    updateUnifiedAccountStatementButton(visible = false) {
        const btn = document.getElementById('unified-account-statement-btn');
        if (!btn) return;
        btn.classList.remove('hidden');
        btn.classList.toggle('disabled', !visible);
        btn.style.opacity = visible ? '1' : '0.72';
    }

    buildUnifiedStatementQuery(row = {}) {
        const values = Object.entries(row)
            .filter(([key]) => !String(key).startsWith('_'))
            .map(([key, value]) => ({ key: String(key).toLowerCase(), value: String(value ?? '').trim() }))
            .filter(x => x.value);

        const nationalId = values
            .filter(x => /national|nid|قومي|قومى|بطاق/.test(x.key))
            .map(x => x.value.replace(/\D/g, ''))
            .find(v => v.length >= 10);
        if (nationalId) return nationalId;

        const account = values
            .filter(x => /account|حساب/.test(x.key))
            .map(x => x.value.replace(/\D/g, ''))
            .find(v => v.length >= 6);
        if (account) return account;

        return values.find(x => /name|اسم|مستفيد|موظف|عميل/.test(x.key))?.value || '';
    }

    async openUnifiedAccountStatement(personKey = '') {
        const typedQuery = document.getElementById('unified-search-input')?.value?.trim() || '';
        const query = personKey ? '' : (this.selectedUnifiedStatementQuery || this.buildUnifiedStatementQuery(this.selectedUnifiedStatementRow || {}) || typedQuery);
        if (!query && !personKey) {
            if (this.showUnifiedToast) this.showUnifiedToast('اختر سجلا أولا لعرض كشف الحساب', 'warning', 'كشف الحساب');
            else this.showToast('اختر سجلا أولا لعرض كشف الحساب', 'warning');
            return;
        }

        const loadingEl = document.getElementById('unified-loading');
        if (loadingEl) loadingEl.classList.remove('hidden');

        try {
            const params = new URLSearchParams();
            if (query) params.set('q', query);
            if (personKey) params.set('personKey', personKey);
            params.set('combineAll', 'true');
            const result = await db.fetchApi(`/api/search/account-statement?${params}`);

            this.currentUnifiedStatement = result;
            this.printUnifiedStatementDirect(result);
        } catch (error) {
            console.error('[UNIFIED STATEMENT] Failed:', error);
            this.showUnifiedToast?.('فشل تجهيز كشف الحساب الموحد', 'error', 'كشف الحساب');
        } finally {
            if (loadingEl) loadingEl.classList.add('hidden');
        }
    }

    printUnifiedStatementDirect(statement) {
        document.getElementById('unified-statement-modal')?.remove();

        const person   = statement.personInfo || {};
        const incentives = (statement.incentiveRecords || []);
        const salaries   = (statement.salaryRecords   || []);

        const now = new Date();
        const dateStr = now.toLocaleDateString('ar-EG');
        document.getElementById('print-beneficiary-name').textContent = person.name || '-';
        document.getElementById('current-date-print').textContent = dateStr;
        document.getElementById('current-time-print').textContent = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('print-date-label').textContent = `كشف حساب مالي - ${dateStr}`;

        const tbody = document.getElementById('print-table-body');
        tbody.innerHTML = '';

        let totalSettled = 0, countSettled = 0, totalUnsettled = 0, countUnsettled = 0;
        let incentiveTotal = 0, salaryTotal = 0;
        let rowIdx = 0;

        const addSectionHeader = (label, count) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="10" style="background:#1e3a5f;color:#fff;font-weight:bold;text-align:center;padding:6px 4px;font-size:0.95em;">
                ◀ ${label} — (${count} سجل)
            </td>`;
            tbody.appendChild(tr);
        };

        const addRows = (records) => {
            records.forEach(r => {
                rowIdx++;
                const amount    = typeof r.amount === 'number' ? r.amount : parseFloat(r.amount || 0) || 0;
                const isSettled = r.settlementStatus === 'تم التسوية' || (r.paymentSettlementNo || '').trim() !== '';
                const paymentRef   = r.paymentSettlementNo || '';
                const statusText   = isSettled ? 'تم السداد' : 'لم يتم التسوية';
                const statusColor  = isSettled ? '#059669' : '#dc2626';

                if (isSettled) { totalSettled   += amount; countSettled++;   }
                else            { totalUnsettled += amount; countUnsettled++; }

                const monthLabel = r.month || r.fileCode || '-';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${rowIdx}</td>
                    <td style="white-space:nowrap;">${this.escapeHtml(monthLabel)}</td>
                    <td style="font-family:monospace;white-space:nowrap;">${this.escapeHtml(r.accountNumber || '-')}</td>
                    <td style="font-family:monospace;white-space:nowrap;">-</td>
                    <td>${this.escapeHtml(r.uploadDate || '-')}</td>
                    <td style="font-weight:bold;">${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td>-</td>
                    <td>${this.escapeHtml(r.settlementDate || '-')}</td>
                    <td>${this.escapeHtml(paymentRef || '-')}</td>
                    <td style="color:${statusColor};">${statusText}</td>
                `;
                tbody.appendChild(tr);
                return amount;
            });
        };

        const addSubtotalRow = (label, count, total) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td colspan="5" style="font-weight:bold;background:#f0f4f8;text-align:right;padding:5px 8px;">${label}</td>
                <td style="font-weight:bold;background:#f0f4f8;">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td colspan="4" style="background:#f0f4f8;text-align:center;color:#555;">${count} سجل</td>
            `;
            tbody.appendChild(tr);
        };

        // قسم الحوافز
        if (incentives.length > 0) {
            addSectionHeader('سجلات الحوافز', incentives.length);
            const before = totalSettled + totalUnsettled;
            addRows(incentives);
            incentiveTotal = (totalSettled + totalUnsettled) - before;
            addSubtotalRow('إجمالي الحوافز', incentives.length, incentiveTotal);
        }

        // قسم المرتبات
        if (salaries.length > 0) {
            addSectionHeader('سجلات المرتبات', salaries.length);
            const before = totalSettled + totalUnsettled;
            addRows(salaries);
            salaryTotal = (totalSettled + totalUnsettled) - before;
            addSubtotalRow('إجمالي المرتبات', salaries.length, salaryTotal);
        }

        const grandTotal = incentiveTotal + salaryTotal;
        const fmt = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' ج.م';

        document.getElementById('print-incentive-count').textContent  = incentives.length;
        document.getElementById('print-incentive-amount').textContent = fmt(incentiveTotal);
        document.getElementById('print-salary-count').textContent     = salaries.length;
        document.getElementById('print-salary-amount').textContent    = fmt(salaryTotal);
        document.getElementById('print-settled-count').textContent    = countSettled;
        document.getElementById('print-settled-amount').textContent   = fmt(totalSettled);
        document.getElementById('print-unsettled-count').textContent  = countUnsettled;
        document.getElementById('print-unsettled-amount').textContent = fmt(totalUnsettled);
        document.getElementById('print-total-count').textContent      = incentives.length + salaries.length;
        document.getElementById('print-total-amount').textContent     = fmt(grandTotal);
        document.getElementById('print-amount-words').textContent     = this.tafqeel ? this.tafqeel(grandTotal) : '';

        setTimeout(() => window.print(), 300);
    }

    renderUnifiedStatementMatches(matches) {
        document.getElementById('unified-statement-modal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'unified-statement-modal';
        modal.className = 'unified-statement-modal';
        modal.innerHTML = `
            <div class="unified-statement-dialog compact">
                <div class="unified-statement-header">
                    <div>
                        <h3>اختر الشخص المطلوب</h3>
                        <p>وجد النظام أكثر من نتيجة متشابهة. اختر السجل الصحيح لفتح كشف الحساب.</p>
                    </div>
                    <button onclick="document.getElementById('unified-statement-modal')?.remove()">×</button>
                </div>
                <div class="unified-match-list">
                    ${matches.map(match => `
                        <button class="unified-match-card" onclick="app.openUnifiedAccountStatement('${this.escapeHtml(match.personKey).replace(/'/g, "\\'")}')">
                            <strong>${this.escapeHtml(match.personInfo?.name || 'بدون اسم')}</strong>
                            <span>رقم قومي: ${this.escapeHtml(match.personInfo?.nationalId || '-')}</span>
                            <span>حساب: ${this.escapeHtml(match.personInfo?.accountNumber || '-')} | بنك: ${this.escapeHtml(match.personInfo?.bank || '-')}</span>
                            <small>الحوافز: ${match.incentiveCount || 0} | المرتبات: ${match.salaryCount || 0} | الإجمالي: ${this.formatDashboardAmount(match.totalAmount || 0)}</small>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    renderUnifiedAccountStatement(statement) {
        document.getElementById('unified-statement-modal')?.remove();
        const person = statement.personInfo || {};
        const summary = statement.summary || {};
        const incentive = statement.incentiveRecords || [];
        const salary = statement.salaryRecords || [];
        const modal = document.createElement('div');
        modal.id = 'unified-statement-modal';
        modal.className = 'unified-statement-modal';
        modal.innerHTML = `
            <div class="unified-statement-dialog">
                <div class="unified-statement-header">
                    <div>
                        <h3>كشف حساب موحد</h3>
                        <p>${this.escapeHtml(person.name || 'بدون اسم')}</p>
                    </div>
                    <button onclick="document.getElementById('unified-statement-modal')?.remove()">×</button>
                </div>
                <div class="unified-statement-actions">
                    <button onclick="app.printUnifiedAccountStatement()"><i class="fas fa-print"></i> طباعة</button>
                    <button onclick="app.exportUnifiedAccountStatementExcel()"><i class="fas fa-file-excel"></i> Excel</button>
                    <button onclick="app.exportUnifiedAccountStatementPdf()"><i class="fas fa-file-pdf"></i> PDF</button>
                </div>
                <div class="unified-person-grid">
                    ${this.renderStatementInfo('الاسم', person.name)}
                    ${this.renderStatementInfo('الرقم القومي', person.nationalId)}
                    ${this.renderStatementInfo('رقم الحساب', person.accountNumber)}
                    ${this.renderStatementInfo('البنك', person.bank)}
                </div>
                <div class="unified-summary-grid">
                    ${this.renderStatementInfo('عدد الحوافز', summary.incentiveCount)}
                    ${this.renderStatementInfo('مبلغ الحوافز', this.formatDashboardAmount(summary.incentiveAmount))}
                    ${this.renderStatementInfo('عدد المرتبات', summary.salaryCount)}
                    ${this.renderStatementInfo('مبلغ المرتبات', this.formatDashboardAmount(summary.salaryAmount))}
                    ${this.renderStatementInfo('Returned', summary.returnedCount)}
                    ${this.renderStatementInfo('Rejected', summary.rejectedCount)}
                    ${this.renderStatementInfo('تم التسوية', summary.settledCount)}
                    ${this.renderStatementInfo('لم يتم التسوية', summary.unsettledCount)}
                </div>
                <div class="unified-statement-tabs">
                    <button class="active" onclick="app.switchUnifiedStatementTab('incentive', this)">سجلات الحوافز (${incentive.length})</button>
                    <button onclick="app.switchUnifiedStatementTab('salary', this)">سجلات المرتبات (${salary.length})</button>
                </div>
                <div id="unified-statement-incentive" class="unified-statement-section">
                    ${this.renderStatementRecordsTable(incentive, 'incentive')}
                </div>
                <div id="unified-statement-salary" class="unified-statement-section hidden">
                    ${this.renderStatementRecordsTable(salary, 'salary')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    renderStatementInfo(label, value) {
        return `<div class="unified-info-card"><span>${this.escapeHtml(label)}</span><strong>${this.escapeHtml(value ?? '-')}</strong></div>`;
    }

    renderStatementRecordsTable(records, type) {
        if (!records.length) return '<div class="unified-statement-empty">لا توجد سجلات مطابقة.</div>';
        return `
            <div class="unified-statement-table-wrap">
                <table class="unified-statement-table">
                    <thead>
                        <tr>
                            <th>كود الملف</th><th>الشهر</th><th>الحالة</th><th>قيمة العملية</th><th>تاريخ الرفع</th>
                            <th>تاريخ اعتماد التعديل / السداد</th><th>رقم تسوية السداد</th><th>حالة التسوية</th><th>السبب</th><th>المرفقات</th><th>فتح</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${records.map(row => `
                            <tr>
                                <td>${this.escapeHtml(row.fileCode || '-')}</td>
                                <td>${this.escapeHtml(row.month || '-')}</td>
                                <td><span class="statement-status ${row.status === 'Rejected' ? 'rejected' : 'returned'}">${this.escapeHtml(row.status || '-')}</span></td>
                                <td>${this.formatDashboardAmount(row.amount || 0)}</td>
                                <td>${this.escapeHtml(row.uploadDate || '-')}</td>
                                <td>${this.escapeHtml(row.settlementDate || '-')}</td>
                                <td>${this.escapeHtml(row.paymentSettlementNo || '-')}</td>
                                <td>${this.escapeHtml(row.settlementStatus || '-')}</td>
                                <td>${this.escapeHtml(row.reason || '-')}</td>
                                <td>${Number(row.attachmentCount || 0) > 0 ? `<button onclick="app.openAttachmentsModal('${row.id}', '${type === 'salary' ? 'salary' : 'returns'}')">${row.attachmentCount}</button>` : '-'}</td>
                                <td><button onclick="app.openUnifiedStatementOriginal('${row.id}', '${type}')">فتح</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    switchUnifiedStatementTab(tab, btn) {
        document.querySelectorAll('.unified-statement-tabs button').forEach(b => b.classList.remove('active'));
        btn?.classList.add('active');
        document.getElementById('unified-statement-incentive')?.classList.toggle('hidden', tab !== 'incentive');
        document.getElementById('unified-statement-salary')?.classList.toggle('hidden', tab !== 'salary');
    }

    openUnifiedStatementOriginal(id, type) {
        document.getElementById('unified-statement-modal')?.remove();
        this.openUnifiedFolder(id, type);
    }

    exportUnifiedAccountStatementExcel() {
        const statement = this.currentUnifiedStatement;
        if (!statement) return;
        if (!window.XLSX) return this.showUnifiedToast?.('مكتبة Excel غير متاحة', 'error', 'تصدير');

        const rows = [
            ...(statement.incentiveRecords || []).map(r => ({ المصدر: 'الحوافز', ...r })),
            ...(statement.salaryRecords || []).map(r => ({ المصدر: 'المرتبات', ...r }))
        ];
        if (!rows.length) return this.showUnifiedToast?.('لا توجد بيانات للتصدير', 'warning', 'تصدير');
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!views'] = [{ RTL: true }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'كشف حساب موحد');
        XLSX.writeFile(wb, `كشف_حساب_موحد_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    exportUnifiedAccountStatementPdf() {
        if (window.html2pdf) {
            window.html2pdf().from(document.querySelector('#unified-statement-modal .unified-statement-dialog')).save('كشف_حساب_موحد.pdf');
            return;
        }
        this.printUnifiedAccountStatement();
    }

    printUnifiedAccountStatement() {
        const dialog = document.querySelector('#unified-statement-modal .unified-statement-dialog');
        if (!dialog) return;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`
            <html dir="rtl"><head><title>كشف حساب موحد</title>
            <style>body{font-family:Arial,sans-serif;padding:20px;direction:rtl;color:#111}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ccc;padding:7px;font-size:12px}th{background:#eee}.unified-statement-actions,.unified-statement-tabs button{display:none}.unified-person-grid,.unified-summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.unified-info-card{border:1px solid #ccc;padding:8px}.hidden{display:none!important}</style>
            </head><body>${dialog.innerHTML}</body></html>
        `);
        win.document.close();
        win.focus();
        win.print();
    }

    async syncUnifiedData() {
        const container = document.getElementById('unified-sync-progress');
        const bar = document.getElementById('unified-sync-bar');
        const perc = document.getElementById('unified-sync-perc');
        const status = document.getElementById('unified-sync-status');

        if (container) container.classList.remove('hidden');

        try {
            const updateUI = (p, text) => {
                if (bar) bar.style.width = p + '%';
                if (perc) perc.textContent = p + '%';
                if (status) status.textContent = text;
            };

            updateUI(10, 'جاري مزامنة مرتدات الحوافز...');
            await this.populateReturnsCache();
            updateUI(50, 'تمت مزامنة الحوافز، جاري مزامنة المرتبات...');

            await this.populateSalaryReturnsCache();
            updateUI(100, 'تمت المزامنة بنجاح!');

            this.showUnifiedToast('تم تحديث كافة البيانات للبحث السريع', 'success', 'تحديث مكتمل');

            if (this.searchQuery) {
                this.loadFullReturns(1, 50, this.searchQuery, true);
            }

            setTimeout(() => {
                if (container) container.classList.add('hidden');
            }, 3000);

        } catch (error) {
            console.error('Unified Sync Error:', error);
            if (status) status.textContent = 'فشلت المزامنة!';
            this.showUnifiedToast('فشل تحديث البياناʡ يرجى المحاولة لاحقاً', 'error', 'خطأ في المزامنة');
        }
    }

    async handleUnifiedLocalSearch(query) {
        const normalizedQuery = this.normalizeArabic(query).toLowerCase();
        const words = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
        const settlementMode = document.getElementById('unified-settlement-status')?.value || this.unifiedSettlementStatus || 'not_settled';

        const filterData = (data) => {
            if (!data) return [];
            return data.filter(row => {
                if (settlementMode && settlementMode !== 'all') {
                    const settlementNo = row['رقم تسوية السداد'] || row['ط±ظ‚ظ… طھط³ظˆظٹط© ط§ظ„ط³ط¯ط§ط¯'];
                    const hasSettlement = settlementNo !== null && settlementNo !== undefined && String(settlementNo).trim() !== '';
                    if (settlementMode === 'settled' && !hasSettlement) return false;
                    if (settlementMode === 'not_settled' && hasSettlement) return false;
                }

                if (!query || !String(query).trim()) return true;

                const searchStr = row._searchStr || '';
                const searchTotal = (query || "").toLowerCase().trim();

                // High Priority: Exact phrase match
                const matchPhrase = searchStr.includes(normalizedQuery) || searchStr.includes(searchTotal);
                if (matchPhrase) return true;

                // Fallback: Word-by-word (only for short queries)
                if (words.length > 2) return false;
                return words.every(word => searchStr.includes(word));
            });
        };

        const sortQ = normalizedQuery || (query || "").toLowerCase().trim();
        const incentiveResults = filterData(this.returnsCache);
        const salaryResults = filterData(this.salaryReturnsCache);

        // Priority Sorting: Bring exact phrase matches to the top
        const prioritizedSort = (results) => {
            if (!sortQ) return results;
            return results.sort((a, b) => {
                const aExact = (a._searchStr || "").includes(sortQ);
                const bExact = (b._searchStr || "").includes(sortQ);
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                return 0;
            });
        };

        this.unifiedIncentiveData = prioritizedSort(incentiveResults);
        this.unifiedSalaryData = prioritizedSort(salaryResults);

        // Update Stats (Mimic the API stats structure)
        const incStats = { totalCount: incentiveResults.length, totalAmount: incentiveResults.reduce((s, r) => s + (r._amount || 0), 0) };
        const salStats = { totalCount: salaryResults.length, totalAmount: salaryResults.reduce((s, r) => s + (r._amount || 0), 0) };

        this.updateUnifiedStats(incStats, salStats);

        const resultsEl = document.getElementById('unified-results');
        const statsRow = document.getElementById('unified-stats-row');

        // Always render tables and show results (even if query is empty)
        this.renderUnifiedTable('incentive', incentiveResults);
        this.renderUnifiedTable('salary', salaryResults);

        if (resultsEl) {
            resultsEl.style.display = 'block';
            // Only force expand if there is search query, else keep as is
            if (query && query.trim() !== '') {
                document.getElementById('section-incentive')?.classList.remove('collapsed');
                document.getElementById('section-salary')?.classList.remove('collapsed');
            }
        }

        if (statsRow) statsRow.style.display = 'grid';
    }

}

/**
 * Premium Toast Notification System V2
 */
App.prototype.showUnifiedToast = function(message, type = 'info', title = '') {
    const container = document.getElementById('unified-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `u-toast ${type}`;

    const iconMap = {
        success: '✅',
        error: '❌',
        info: '🔔'
    };

    toast.innerHTML = `
        <div class="u-toast-icon">${iconMap[type] || '🔔'}</div>
        <div class="u-toast-content">
            ${title ? `<h4>${title}</h4>` : ''}
            <p>${message}</p>
        </div>
    `;

    container.appendChild(toast);

    // Trigger Animation
    setTimeout(() => toast.classList.add('active'), 100);

    // Auto Remove
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
};



// New Method
App.prototype.saveExtractionResults = async function (results) {
    const matches = results.matches || [];
    if (matches.length === 0) return;

    const confirmed = await dialog.show({
        title: 'استيراد السجلات',
        message: `هل أنت متأكد من استيراد ${matches.length} سجل مطابق كبيانات مالية كاملة؟`,
        type: 'question',
        showCancel: true
    });
    if (!confirmed) return;

    this.showLoading();
    try {
        const payload = {
            filename: `Extraction_Import_${new Date().getTime()}.xlsx`,
            size: 0,
            headers: Object.keys(matches[0] || {}),
            data: matches
        };

        const result = await db.fetchApi('/full-returns/import', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (result.success) {
            this.showToast('تم استيراد السجلات المختارة بنجاح!', 'success');
            this.closeExtractionModal();
            if (this.currentPage === 'full-returns') this.loadFullReturns(1, 50, null, true);
        } else {
            this.showToast('فشل الاستيراد: ' + result.message, 'error');
        }
    } catch (e) {
        console.error(e);
        this.showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        this.hideLoading();
    }
};

App.prototype.performActualSettlement = async function (selection) {
    if (!selection || selection.length === 0) {
        this.showToast('يرجى اختيار سجلات للتسوية', 'warning');
        return;
    }

    const settledDate = new Date().toISOString().split('T')[0];
    const bankDetails = await dialog.show({
        title: 'إتمام التسوية',
        message: 'يرجى إدخال تفاصيل البنك أو المرجعية:',
        type: 'question',
        isPrompt: true
    });

    if (bankDetails === null || bankDetails === false) return;

    this.showLoading();
    try {
        const results = await Promise.all(selection.map(id => {
            return db.updateReturn(id, {
                'تاريخ اعتماد التعديل': settledDate,
                'ملاحظات التسوية': bankDetails
            });
        }));

        const successCount = results.filter(r => r.success).length;
        this.showToast(`تمت تسوية ${successCount} سجل بنجاح`, 'success');
        this.loadReturns(1, this.rowsPerPage, this.currentSearch, this.currentFilter);
    } catch (e) {
        console.error('Settlement Failed:', e);
        this.showToast('فشل في عملية التسوية', 'error');
    } finally {
        this.hideLoading();
    }
};








App.prototype.deleteAll = async function () {
    this.showLoading();
    try {
        const result = await db.fetchApi('/returns', { method: 'DELETE' });

        if (result.success) {
            this.returnsCache = null; // Invalidate cache
            this.showToast('تم حذف جميع البيانات بنجاح', 'success');
            this.loadReturns(1); // Reload first page
        } else {
            this.showToast('فشل الحذف: ' + result.message, 'error');
        }
    } catch (e) {
        console.error(e);
        this.showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        this.hideLoading();
    }
};


// ==========================================
// Auto Sync Logic (Prototype Extensions)
// ==========================================

App.prototype.loadAutoSyncPath = async function () {
    try {
        const result = await db.fetchApi('/config/autosync-path');
        if (document.getElementById('autosync-path')) {
            document.getElementById('autosync-path').value = result.path || '';
        }
    } catch (error) {
        console.error(error);
    }
};

App.prototype.saveAutoSyncPath = async function () {
    const path = document.getElementById('autosync-path').value;
    this.showLoading();
    try {
        const result = await db.fetchApi('/config/autosync-path', {
            method: 'POST',
            body: JSON.stringify({ path })
        });
        if (result.success) {
            this.showToast(result.message, 'success');
        } else {
            this.showToast(result.message, 'error');
        }
    } catch (error) {
        this.showToast('فشل حفظ المسار', 'error');
    }
    this.hideLoading();
};

App.prototype.browseAutoSyncPath = async function () {
    try {
        const result = await db.fetchApi('/config/browse', { method: 'POST' });
        if (result.path) {
            document.getElementById('autosync-path').value = result.path;
        }
    } catch (error) {
        console.error('Browse failed:', error);
    }
};

App.prototype.showUnifiedCollectiveSync = function () {
    this.isCollectiveSync = true;
    this.isSalarySync = false;
    this.showAutoSyncModal();
};

App.prototype.showAutoSyncModal = async function () {
    const modal = document.getElementById('autosync-modal');
    if (!modal) return;

    // Update title based on context
    const titleEl = modal.querySelector('.modal-header h3');
    if (titleEl) {
        if (this.isCollectiveSync) {
            titleEl.textContent = '🔄 المزامنة المجمعة للمرفقات (حوافز + مرتبات)';
        } else {
            titleEl.textContent = this.isSalarySync ?
                '🔄 المزامنة التلقائية لمرتجع مرتبات الموظفين' :
                '🔄 المزامنة التلقائية للملفات (الحوافز)';
        }
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex'; // Ensure visible if it was hidden by display: none

    // Reset View
    document.getElementById('autosync-start-view').classList.remove('hidden');
    document.getElementById('autosync-progress-view').classList.add('hidden');
    document.getElementById('autosync-result-view').classList.add('hidden');

    // Check path
    try {
        const result = await db.fetchApi('/config/autosync-path');
        const path = result.path;
        const pathDisplay = document.getElementById('autosync-current-path-display');

        if (!path) {
            pathDisplay.textContent = 'لم يتم تحديد مسار! يرجى الذهاب للإعدادات وتحديد مجلد.';
            pathDisplay.style.color = 'red';
        } else {
            pathDisplay.textContent = path;
            pathDisplay.style.color = 'inherit';
        }
    } catch (e) {
        console.error(e);
    }
};

App.prototype.hideAutoSyncModal = async function () {
    if (this.isSyncing) {
        if (!await confirm('العملية جارية في الخلفية، هل أنت متأكد من إغلاق النافذة؟ (ستستمر العملية)')) return;
    }
    document.getElementById('autosync-modal').classList.add('hidden');
    this.isSyncing = false;
    this.isSalarySync = false;
    this.isCollectiveSync = false;
};

App.prototype.startAutoSync = async function () {
    try {
        const startBtn = document.querySelector('#autosync-start-view button');
        if (startBtn) startBtn.disabled = true;

        const endpoint = this.isSalarySync ? '/salary-returns/sync/start' : '/returns/sync/start';
        const result = await db.fetchApi(endpoint, { method: 'POST' });

        if (result.success) {
            // Switch to progress view
            document.getElementById('autosync-start-view').classList.add('hidden');
            document.getElementById('autosync-progress-view').classList.remove('hidden');

            this.isSyncing = true;
            this.pollSyncProgress();
        } else {
            this.showToast(result.message || 'فشل بدء المزامنة', 'error');
            if (startBtn) startBtn.disabled = false;
        }
    } catch (error) {
        const errorMsg = error.message.includes('HTTP error') ? 'خطأ في الاتصال بالسيرفر' : error.message;
        this.showToast(errorMsg || 'فشل بدء المزامنة', 'error');
        console.error(error);
        const startBtn = document.querySelector('#autosync-start-view button');
        if (startBtn) startBtn.disabled = false;
    }
};
App.prototype.pollSyncProgress = async function () {
    if (!this.isSyncing) return;

    try {
        const endpoint = this.isSalarySync ? '/salary-returns/sync/progress' : '/returns/sync/progress';
        const stats = await db.fetchApi(endpoint);

        if (document.getElementById('autosync-percent')) {
            document.getElementById('autosync-percent').textContent = stats.percent + '%';
            document.getElementById('autosync-progress-bar').style.width = stats.percent + '%';
            document.getElementById('autosync-processed').textContent = stats.processed;
            document.getElementById('autosync-matched').textContent = stats.matched;
            document.getElementById('autosync-unmatched').textContent = stats.unmatched;
            document.getElementById('autosync-current-file').textContent = stats.currentFile;
        }

        if (!stats.isRunning && stats.total > 0 && stats.percent >= 100) {
            this.isSyncing = false;

            // 1. Show Success Result
            document.getElementById('autosync-progress-view').classList.add('hidden');
            document.getElementById('autosync-result-view').classList.remove('hidden');
            document.getElementById('autosync-final-moved').textContent = stats.matched; // Correcting label to 'Matched'
            document.getElementById('autosync-final-unmatched').textContent = stats.unmatched;

            this.showToast('اكتملت عملية المزامنة بنجاح، جاري تحديث البيانات...', 'success');

            // 2. IMPORTANT: Clear local caches first to force fresh fetch
            this.returnsCache = null;
            this.salaryReturnsCache = null;

            // 3. Update main UI and rebuild caches
            if (this.populateReturnsCache) this.populateReturnsCache();
            if (this.populateSalaryReturnsCache) this.populateSalaryReturnsCache();

            this.refreshCurrentPage();
        } else if (!stats.isRunning && stats.total === 0 && stats.percent === 0) {
            // Case where nothing was processed (stopped or no files)
            this.isSyncing = false;
            this.showToast('توقفت العملية أو لم يتم العثور على ملفات', 'warning');
            this.hideAutoSyncModal();
        } else {
            setTimeout(() => this.pollSyncProgress(), 1000);
        }
    } catch (error) {
        console.error('Sync progress error:', error);
        setTimeout(() => this.pollSyncProgress(), 2000);
    }
};

// --- Attachment Link Mode ---
App.prototype.loadAttachmentLinkMode = async function () {
    try {
        const res = await fetch('/config/attachment-link-mode');
        const data = await res.json();
        const select = document.getElementById('attachment-link-mode');
        if (select) select.value = data.mode || 'Name';
    } catch (e) {
        console.error('Failed to load attachment link mode:', e);
    }
};

App.prototype.saveAttachmentLinkMode = async function () {
    const mode = document.getElementById('attachment-link-mode').value;
    this.showLoading();
    try {
        const res = await fetch('/config/attachment-link-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode })
        });
        const result = await res.json();
        if (result.success) {
            this.showToast(result.message, 'success');
        } else {
            this.showToast(result.message, 'error');
        }
    } catch (e) {
        console.error(e);
        this.showToast('فشل حفظ الإعداد', 'error');
    } finally {
        this.hideLoading();
    }
};

App.prototype.downloadSyncReport = async function () {
    console.log('[SYNC REPORT] بدء تحميل التقرير...');
    try {
        this.showLoading();
        const endpoint = this.isSalarySync ? '/salary-returns/sync/report' : '/returns/sync/report';
        const result = await db.fetchApi(endpoint);
        console.log('[SYNC REPORT] تم استلام البيانات');

        const matchedData = [];
        const unmatchedData = [];

        let unmatched = result.unmatched || [];
        let matched = result.matched || [];

        // 1. معالجة الملفات غير المطابقة
        if (unmatched.length > 0) {
            unmatched.forEach(f => {
                unmatchedData.push({
                    "اسم الملف": f,
                    "الحالة": "غير مطابق"
                });
            });
        }

        // 2. معالجة الملفات المطابقة
        if (matched.length > 0) {
            matched.forEach(m => {
                matchedData.push({
                    "الاسم": m.linkedName || m.LinkedName || "Unknown",
                    "الرقم القومي": m.linkedNID || m.LinkedNID || "",
                    "الحالة": "تم النقل بنجاح"
                });
            });
        }

        // التأكد من وجود مكتبة XLSX
        if (typeof XLSX === 'undefined') {
            throw new Error('مكتبة Excel غير متوفرة');
        }

        const wb = XLSX.utils.book_new();

        // ورقة 1: المنقولين
        const wsMatched = XLSX.utils.json_to_sheet(matchedData.length > 0 ? matchedData : [{ "الاسم": "لا توجد ملفات", "الرقم القومي": "", "الحالة": "" }]);
        wsMatched['!cols'] = [{ wch: 40 }, { wch: 25 }, { wch: 20 }];
        if (!wsMatched['!views']) wsMatched['!views'] = [];
        wsMatched['!views'].push({ RTL: true });
        XLSX.utils.book_append_sheet(wb, wsMatched, "المنقولين");

        // ورقة 2: غير موجودين
        const wsUnmatched = XLSX.utils.json_to_sheet(unmatchedData.length > 0 ? unmatchedData : [{ "اسم الملف": "لا توجد ملفات", "الحالة": "" }]);
        wsUnmatched['!cols'] = [{ wch: 40 }, { wch: 30 }];
        if (!wsUnmatched['!views']) wsUnmatched['!views'] = [];
        wsUnmatched['!views'].push({ RTL: true });
        XLSX.utils.book_append_sheet(wb, wsUnmatched, "غير موجودين");

        // اسم الملف المطلوب
        const filename = `تقرير ربط المرفقات_${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}.xlsx`;

        XLSX.writeFile(wb, filename);
        this.showToast('تم تحميل التقرير بنجاح', 'success');

    } catch (e) {
        console.error('[SYNC REPORT] Error:', e);
        this.showToast('فشل تحميل التقرير: ' + e.message, 'error');
    } finally {
        this.hideLoading();
    }
};



App.prototype.printReport = function () {
    // فتح نافذة خيارات التقرير الاحترافي
    const modal = document.getElementById('report-options-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('report-search-name')?.focus();
    }
};

App.prototype.printSalaryReport = function () {
    this.printReport();
};

App.prototype.handleReportSearchInput = async function (query) {
    const suggestionsContainer = document.getElementById('report-search-suggestions');
    if (!suggestionsContainer) return;

    if (!query || query.length < 1) {
        suggestionsContainer.classList.add('hidden');
        return;
    }

    const nameKeys = ['Name', 'FullName', 'الاسم', 'الإسم', 'اسم العميل', 'الاسم بالكامل', 'Full Name', 'اسم الموظف', 'اسم_العميل', 'الاســــم'];
    const renderMatches = (records) => {
        const normQuery = this.normalizeArabic(query);
        const compactQuery = normQuery.replace(/\s+/g, '');
        const uniqueNames = new Set();
        (records || []).forEach(record => {
            const rawName = this.findValue(record, nameKeys);
            if (rawName) {
                const normName = this.normalizeArabic(rawName);
                const compactName = normName.replace(/\s+/g, '');
                if (normName.includes(normQuery) || compactName.includes(compactQuery) || compactQuery.includes(compactName)) {
                    uniqueNames.add(rawName);
                }
            }
        });

        const matches = Array.from(uniqueNames).slice(0, 10);
        if (matches.length > 0) {
            suggestionsContainer.innerHTML = matches.map(name => `
                <div class="autocomplete-suggestion" onclick="app.selectReportSuggestion('${name.replace(/'/g, "\\'")}')">
                    ${name}
                </div>
            `).join('');
            suggestionsContainer.classList.remove('hidden');
            return true;
        }
        return false;
    };

    try {
        const params = new URLSearchParams({ q: query, page: '1', pageSize: '20' });
        const response = await db.fetchApi(`/api/search/comprehensive?${params.toString()}`);
        const records = this.currentPage === 'salary-returns'
            ? (response.salaryRecords || [])
            : (response.incentiveRecords || []);
        if (renderMatches(records)) return;
    } catch (error) {
        console.warn('[REPORT] API suggestions unavailable, falling back to cache:', error);
    }

    // Determine cache and populate function based on current page
    let cache = this.returnsCache;
    let populateFunc = () => this.populateReturnsCache();

    if (this.currentPage === 'salary-returns') {
        cache = this.salaryReturnsCache;
        populateFunc = () => this.populateSalaryReturnsCache();
    }

    // فلترة الأسماء الفريدة من الكاش
    if (!cache) {
        suggestionsContainer.innerHTML = '<div class="autocomplete-suggestion">جاري تحميل الأسماء...</div>';
        suggestionsContainer.classList.remove('hidden');
        try {
            cache = await populateFunc();
            if (this.currentPage === 'salary-returns') {
                this.salaryReturnsCache = cache || this.salaryReturnsCache || [];
                cache = this.salaryReturnsCache;
            } else {
                this.returnsCache = cache || this.returnsCache || [];
                cache = this.returnsCache;
            }
        } catch (error) {
            console.error('[REPORT] Failed to load suggestions cache:', error);
            suggestionsContainer.classList.add('hidden');
            return;
        }
    }

    if (!renderMatches(cache)) {
        suggestionsContainer.classList.add('hidden');
    }
};

App.prototype.selectReportSuggestion = function (name) {
    const input = document.getElementById('report-search-name');
    if (input) input.value = name;
    document.getElementById('report-search-suggestions')?.classList.add('hidden');
};

App.prototype.isReportNameMatch = function (rowName, queryName) {
    const normalizedRowName = this.normalizeArabic(rowName || '');
    const normalizedQuery = this.normalizeArabic(queryName || '');
    if (!normalizedRowName || !normalizedQuery) return false;

    const compactRowName = normalizedRowName.replace(/\s+/g, '');
    const compactQuery = normalizedQuery.replace(/\s+/g, '');
    return normalizedRowName.includes(normalizedQuery)
        || normalizedQuery.includes(normalizedRowName)
        || compactRowName.includes(compactQuery)
        || compactQuery.includes(compactRowName);
};

App.prototype.generateProfessionalReport = async function () {
    const nameInput = document.getElementById('report-search-name');
    const name = nameInput?.value.trim() || '';
    const status = document.getElementById('report-status-filter')?.value || 'all';

    if (!name) {
        this.showToast('يرجى إدخال اسم للبحث عنه', 'warning');
        return;
    }

    console.log('[REPORT] Starting Professional Report for:', name, 'Status:', status);
    this.showLoading();

    try {
        let sourceData = [];
        // Always query the backend for the requested name. Page caches can be partial
        // because tables are paginated, so relying on them can miss valid records.
        console.log('[REPORT] Fetching report data from API...');
        try {
            let apiResponse;
            if (this.currentPage === 'salary-returns') {
                apiResponse = await db.getSalaryReturns(1, 5000, name, 'all');
            } else {
                apiResponse = await db.getReturns(1, 5000, name, null);
            }
            sourceData = apiResponse?.data || [];
        } catch (apiError) {
            console.warn('[REPORT] API fetch failed, using available cache:', apiError);
            sourceData = this.currentPage === 'salary-returns'
                ? (this.salaryReturnsCache || [])
                : (this.returnsCache || []);
        }

        // 3. Filter data locally with Case-Insensitive Arabic Normalization
        let filtered = sourceData.filter(r => {
            const nameKeys = ['الاسم', 'الاســــم', 'Name', 'FullName', 'المستفيد', 'اسم الموظف', 'الإسم'];
            const rawName = this.findValue(r, nameKeys) || '';

            // Match if row name includes the query
            if (!this.isReportNameMatch(rawName, name)) return false;

            // Filter by Settlement Status
            const settlementStatusKeys = ['حالة التسوية', 'Status', 'SettlementStatus'];
            let settlementVal = String(this.findValue(r, settlementStatusKeys) || '').trim();

            const elevationRefKeys = ['رقم تسوية التعلية', 'تسوية التعلية'];
            const paymentRefKeys = ['رقم تسوية السداد', 'تسوية السداد'];
            const filterElevationRef = this.findValue(r, elevationRefKeys) || '';
            const filterPaymentRef = this.findValue(r, paymentRefKeys) || '';

            if (filterPaymentRef && filterPaymentRef.toString().trim() !== '') {
                settlementVal = 'تمت التسوية';
            } else if (filterElevationRef && filterElevationRef.toString().trim() !== '') {
                settlementVal = 'تم التعلية';
            }

            const modDateKeys = ['تاريخ اعتماد التعديل', 'تاريخ التسوية', 'ModificationDate', 'تاريخ التعديل', 'تاريخ اعتماد المرتدات', 'SettlementDate'];
            const modDate = this.findValue(r, modDateKeys);
            const hasModDate = modDate && String(modDate).trim() !== '' && String(modDate) !== '-';

            let isSettled = filterPaymentRef || filterElevationRef || hasModDate || settlementVal.includes('تمت') || settlementVal.includes('سداد');

            if (status === 'settled') return isSettled;
            if (status === 'unsettled') return !isSettled;
            return true;
        });

        console.log('[REPORT] Matches found:', filtered.length);

        if (filtered.length === 0) {
            this.showToast('لم يتم العثور على بيانات مطابقة لهذا الاسم والحالة', 'info');
            this.hideLoading();
            return;
        }

        // 4. Update UI Template
        document.getElementById('report-options-modal')?.classList.add('hidden');
        document.getElementById('print-beneficiary-name').textContent = name;

        const now = new Date();
        const dateStr = now.toLocaleDateString('ar-EG');
        document.getElementById('current-date-print').textContent = dateStr;
        document.getElementById('current-time-print').textContent = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('print-date-label').textContent = `كشف حساب مالي - ${dateStr}`;

        const tbody = document.getElementById('print-table-body');
        tbody.innerHTML = '';

        let totalSettled = 0;
        let countSettled = 0;
        let totalUnsettled = 0;
        let countUnsettled = 0;

        filtered.forEach((r, idx) => {
            const amountKeys = ['المبلغ', 'قيمة العملية', ' قيمة العملية', 'ProcessValue', 'Amount'];
            const amount = this.parseAmount(this.findValue(r, amountKeys));

            const settlementStatusKeys = ['حالة التسوية', 'Status', 'SettlementStatus'];
            let rowSettlementVal = String(this.findValue(r, settlementStatusKeys) || '').trim();

            const elevationRefKeys = ['رقم تسوية التعلية', 'تسوية التعلية'];
            const paymentRefKeys = ['رقم تسوية السداد', 'تسوية السداد'];
            const elevationRef = this.findValue(r, elevationRefKeys) || '';
            const paymentRef = this.findValue(r, paymentRefKeys) || '';

            if (paymentRef && paymentRef.toString().trim() !== '') {
                rowSettlementVal = 'تمت التسوية';
            } else if (elevationRef && elevationRef.toString().trim() !== '') {
                rowSettlementVal = 'تم التعلية';
            }

            const modDateKeys = ['تاريخ اعتماد التعديل', 'تاريخ التسوية', 'ModificationDate', 'تاريخ التعديل', 'تاريخ اعتماد المرتدات', 'SettlementDate'];
            const modDateVal = this.findValue(r, modDateKeys);
            const isSettled = paymentRef || elevationRef || (modDateVal && String(modDateVal).trim() !== '' && String(modDateVal) !== '-') || rowSettlementVal.includes('تمت') || rowSettlementVal.includes('سداد');

            let rowStatusText = 'تحت التسوية';
            let rowStatusColor = '#dc2626';
            if (isSettled) {
                rowStatusText = paymentRef ? 'تم السداد' : (elevationRef ? 'تم التعلية' : 'تمت التسوية');
                rowStatusColor = '#059669';
                totalSettled += amount;
                countSettled++;
            } else {
                totalUnsettled += amount;
                countUnsettled++;
            }

            const oldAccKeys = ['رقم الحساب القديم', 'OldAccount', 'رقم_الحساب_القديم', 'رقم الحساب'];
            const newAccKeys = ['رقم الحساب الجديد', 'NewAccount', 'رقم_الحساب_الجديد', 'رقم الحساب المعدل'];
            const returnDateKeys = ['ت. المرتد', 'ReturnDate', 'تاريخ_المرتد', 'تاريخ المرتد', 'تاريخ المرتد / تاريخ التعلية', 'تاريخ المرتدات'];
            const fileCodeKeys = ['كود الملف', 'FileCode', 'الشهر', 'كـــود الملف', 'كُـــود المـلف', 'كود_الملف'];

            const returnDateStr = this.formatDate(this.findValue(r, returnDateKeys));
            const modDateStr = this.formatDate(modDateVal);

            const fileCodeStr = String(this.findValue(r, fileCodeKeys) || '').trim();
            let monthLabel = 'فارغ';
            if (fileCodeStr && fileCodeStr !== '-') {
                const parts = fileCodeStr.split('/');
                if (parts.length >= 2) {
                    monthLabel = `${parts[0].padStart(2, '0')}-${parts[1]}`;
                } else {
                    const match = String(fileCodeStr).match(/-(\d{1,2})-(\d{4})/);
                    if (match) {
                        monthLabel = `${match[1].padStart(2, '0')}-${match[2]}`;
                    } else {
                        monthLabel = fileCodeStr;
                    }
                }
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td style="white-space: nowrap;">${monthLabel}</td>
                <td style="font-family: monospace; white-space: nowrap;">${this.findValue(r, oldAccKeys) || '-'}</td>
                <td style="font-family: monospace; white-space: nowrap;">${this.findValue(r, newAccKeys) || '-'}</td>
                <td>${returnDateStr || '-'}</td>
                <td style="font-weight: bold;">${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td>${elevationRef || '-'}</td>
                <td>${modDateStr || '-'}</td>
                <td>${paymentRef || '-'}</td>
                <td style="color: ${rowStatusColor};">${rowStatusText}</td>
            `;
            tbody.appendChild(tr);
        });

        // 5. Totals Map
        document.getElementById('print-settled-count').textContent = countSettled;
        document.getElementById('print-settled-amount').textContent = totalSettled.toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' ج.م';
        document.getElementById('print-unsettled-count').textContent = countUnsettled;
        document.getElementById('print-unsettled-amount').textContent = totalUnsettled.toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' ج.م';

        const grandTotal = totalSettled + totalUnsettled;
        document.getElementById('print-total-count').textContent = filtered.length;
        document.getElementById('print-total-amount').textContent = grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' ج.م';
        document.getElementById('print-amount-words').textContent = this.tafqeel(grandTotal);

        this.hideLoading();
        console.log('[REPORT] Generation success. Opening print dialog...');
        setTimeout(() => window.print(), 500);

    } catch (e) {
        console.error('[REPORT ERROR] Full Exception:', e);
        this.showToast('عفواً، حدث خطأ أثناء إعداد التقرير', 'error');
        this.hideLoading();
    }
};

// وظيفة تفقيط العملة بشكل مبسط
App.prototype.tafqeel = function (n) {
    if (!n || isNaN(n) || n === 0) return "صفر";
    try {
        const formatter = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' });
        let result = formatter.format(n);
        // Clean up currency symbols safely (some browsers vary)
        return result.replace(/[A-Z]|[a-z]|\.|\$|\s|ج|م/g, '').trim() + " جنيهاً مصرياً لا غير";
    } catch (err) {
        return n.toLocaleString('en-US', { minimumFractionDigits: 2 }) + " جنيه";
    }
};

App.prototype.showLoading = function () {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.remove('hidden');
};

App.prototype.hideLoading = function () {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.add('hidden');
};

App.prototype.showToast = function (message, type = 'info', options = {}) {
    const text = String(message || '');
    let container = document.getElementById('app-toast-center');
    if (!container) {
        container = document.createElement('div');
        container.id = 'app-toast-center';
        container.style.cssText = `
            position: fixed;
            top: 18px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            pointer-events: none;
            width: min(460px, calc(100vw - 28px));
        `;
        document.body.appendChild(container);
    }

    const colors = {
        success: { bg: '#063f32', border: '#10b981', icon: '✓' },
        error: { bg: '#4a1015', border: '#ef4444', icon: '!' },
        warning: { bg: '#452b09', border: '#f59e0b', icon: '!' },
        info: { bg: '#0b2d55', border: '#3b82f6', icon: 'i' }
    };
    const theme = colors[type] || colors.info;
    const toast = document.createElement('div');
    toast.setAttribute('role', 'status');
    toast.style.cssText = `
        direction: rtl;
        width: 100%;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 11px 14px;
        border-radius: 10px;
        border: 1px solid ${theme.border};
        background: ${theme.bg};
        color: #f8fafc;
        box-shadow: 0 16px 35px rgba(0,0,0,.35);
        font: 700 13px/1.5 Cairo, Tahoma, sans-serif;
        opacity: 0;
        transform: translateY(-10px) scale(.98);
        transition: opacity .18s ease, transform .18s ease;
        pointer-events: auto;
    `;
    toast.innerHTML = `
        <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:${theme.border};color:#06111f;font-weight:900;flex:0 0 auto;">${theme.icon}</span>
        <span style="flex:1;min-width:0;overflow-wrap:anywhere;">${this.escapeHtml ? this.escapeHtml(text) : text}</span>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0) scale(1)';
    });

    const duration = Number(options.duration || (type === 'error' ? 5200 : 2600));
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px) scale(.98)';
        setTimeout(() => toast.remove(), 220);
    }, duration);
};

App.prototype.beginBackgroundMutation = function (message = 'جاري تحديث البيانات في الخلفية...') {
    window.showGlobalLoading?.(message);
    let finished = false;
    const finish = () => {
        if (finished) return false;
        finished = true;
        window.hideGlobalLoading?.();
        return true;
    };

    return {
        success: (successMessage = 'تم تحديث البيانات') => {
            if (!finish()) return;
            this.showToast(successMessage, 'success');
        },
        error: (errorMessage = 'تعذر تحديث البيانات') => {
            if (!finish()) return;
            this.showToast(errorMessage, 'error');
        }
    };
};

App.prototype.normalizeArabic = function (text) {
    if (!text) return '';
    return text.toString()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u0652]/g, '') // Remove Harakat
        .trim();
};

App.prototype.findValue = function (obj, keys) {
    if (!obj || !keys) return null;
    const lowerKeys = keys.map(k => String(k).toLowerCase().trim());
    for (const key of lowerKeys) {
        const foundKey = Object.keys(obj).find(k => k.toLowerCase().trim() === key);
        if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== null) {
            return obj[foundKey];
        }
    }
    return null;
};

App.prototype.parseAmount = function (val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
    let text = String(val).trim()
        .replace(/[٠-٩]/g, d => String(arabicDigits.indexOf(d)))
        .replace(/[۰-۹]/g, d => String(persianDigits.indexOf(d)))
        .replace(/٬/g, ',')
        .replace(/٫/g, '.');
    // Remove non-numeric characters except dot and minus after dropping thousands separators.
    const cleaned = text.replace(/,/g, '').replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
};

App.prototype.parseDate = function (val) {
    if (!val) return -1;
    if (val instanceof Date) return val.getTime();
    let s = String(val).trim();
    if (!s) return -1;

    // Handle Excel serial date (e.g. 45000)
    if (/^\d{5}(\.\d+)?$/.test(s)) {
        const date = new Date((Number(s) - 25569) * 86400 * 1000);
        return date.getTime();
    }

    // Handle DD/MM/YYYY or YYYY-MM-DD
    const parts = s.split(/[\/\-]/);
    if (parts.length === 3) {
        let d, m, y;
        if (parts[0].length === 4) { // YYYY-MM-DD
            y = parseInt(parts[0]);
            m = parseInt(parts[1]) - 1;
            d = parseInt(parts[2]);
        } else { // DD/MM/YYYY
            d = parseInt(parts[0]);
            m = parseInt(parts[1]) - 1;
            y = parseInt(parts[2]);
        }
        const date = new Date(y, m, d);
        return isNaN(date.getTime()) ? -1 : date.getTime();
    }

    const ts = Date.parse(s);
    return isNaN(ts) ? -1 : ts;
};

App.prototype.readExcelFile = function (file, options = {}) {
    // أسماء الأعمدة التي يجب التعامل مع قيمها كنصوص (أرقام طويلة)
    const LONG_NUMBER_COLUMNS = [
        'الرقم القومي', 'رقم الحساب', 'رقم الحساب بعد التعديل',
        'كود الفرع بعد التعديل', 'رقم تسوية التعلية', 'رقم تسوية السداد'
    ];

    // دالة تطبيع اسم العمود (إزالة BOM + كشيدة + تشكيل + دمج مسافات + توحيد /)
    const normalizeHeader = (h) => {
        if (!h) return '';
        return h.toString()
            .replace(/^\uFEFF/, '')          // إزالة BOM
            .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '') // إزالة المحارف المخفية واتجاه النص
            .replace(/\u0640/g, '')           // إزالة الكشيدة ـ
            .replace(/[\u064B-\u0652\u06D6-\u06ED]/g, '') // إزالة التشكيل (الحركات)
            .replace(/[\/\uFF0F\u2044\u2215]/g, '/') // توحيد كل أشكال الشرطة المائلة
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')             // دمج المسافات المتعددة
            .trim()
            .replace(/\s*\/\s*/g, ' / ');     // توحيد المسافات حول /
    };

    const CANONICAL_HEADER_ALIASES = {
        'تاريخ اعتماد التعديل / تاريخ السداد': [
            'تاريخ اعتماد التعديل/تاريخ السداد',
            'تاريخ السداد',
            'تاريخ التسوية',
            'تاريخ السداد الفعلي',
            'SettlementDate',
            'Settlement Date'
        ],
        'تاريخ المرتد / تاريخ التعلية': [
            'تاريخ المرتد/تاريخ التعلية'
        ]
    };

    const getCanonicalHeader = (normalizedHeader) => {
        for (const [targetHeader, aliases] of Object.entries(CANONICAL_HEADER_ALIASES)) {
            const normalizedTarget = normalizeHeader(targetHeader);
            if (normalizedHeader === normalizedTarget) return normalizedTarget;
            if (aliases.some(alias => normalizeHeader(alias) === normalizedHeader)) return normalizedTarget;
        }
        return normalizedHeader;
    };

    // دالة تنسيق التاريخ بشكل موحد
    const formatDateValue = (val) => {
        if (val instanceof Date) {
            if (isNaN(val.getTime())) return '';
            const d = val.getDate().toString().padStart(2, '0');
            const m = (val.getMonth() + 1).toString().padStart(2, '0');
            const y = val.getFullYear();
            if (y < 1900 || y > 2100) return '';
            return `${d}/${m}/${y}`;
        }
        return null; // ليس تاريخ
    };

    // دالة تحويل الرقم الطويل لنص مع الحفاظ على الأصفار
    const ensureStringNumber = (val) => {
        if (val === null || val === undefined || val === '') return '';
        if (typeof val === 'number' && isFinite(val)) {
            // تحويل لنص مع الحفاظ على الدقة
            if (Number.isInteger(val)) return val.toFixed(0);
            return val.toString();
        }
        if (typeof val === 'string') {
            const trimmed = val.trim();
            // إصلاح الصيغة العلمية (مثل 2.9E+13)
            if (/^-?\d+\.?\d*[eE][+\-]?\d+$/.test(trimmed)) {
                const num = parseFloat(trimmed);
                if (!isNaN(num) && isFinite(num)) return Math.round(num).toFixed(0);
            }
            return trimmed;
        }
        return String(val);
    };

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const isCSV = file.name.toLowerCase().endsWith('.csv');

        reader.onload = (e) => {
            try {
                let workbook;
                if (isCSV) {
                    const codes = new Uint8Array(e.target.result);
                    const decoder = new TextDecoder('windows-1256');
                    const csvText = decoder.decode(codes);
                    workbook = XLSX.read(csvText, { type: 'string' });
                } else {
                    const data = new Uint8Array(e.target.result);
                    workbook = XLSX.read(data, {
                        type: 'array',
                        cellDates: options.cellDates !== undefined ? options.cellDates : true,
                        dateNF: options.dateNF || 'dd/mm/yyyy'
                    });
                }

                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                    raw: options.raw !== undefined ? options.raw : false,
                    defval: options.defval !== undefined ? options.defval : ""
                });

                // بناء خريطة الأعمدة المطبعة → الأصلية لتحديد أعمدة الأرقام الطويلة
                const longNumColsNorm = LONG_NUMBER_COLUMNS.map(c => normalizeHeader(c));

                // Normalize column names and fix values
                const normalizedData = jsonData.map(row => {
                    const newRow = {};
                    for (const [key, val] of Object.entries(row)) {
                        const rawNormalizedKey = normalizeHeader(key);
                        const normKey = getCanonicalHeader(rawNormalizedKey);
                        let normVal = val;

                        // 1. تنسيق التواريخ (Date objects من XLSX)
                        const dateFormatted = formatDateValue(val);
                        if (dateFormatted !== null) {
                            normVal = dateFormatted;
                        }
                        // 2. أعمدة الأرقام الطويلة → نص دائماً
                        else if (longNumColsNorm.includes(normKey)) {
                            normVal = ensureStringNumber(val);
                        }
                        // 3. أي رقم بصيغة علمية (string) → تحويل
                        else if (typeof val === 'string' && /^-?\d+\.?\d*[eE][+\-]?\d+$/.test(val.trim())) {
                            const num = parseFloat(val);
                            if (!isNaN(num) && isFinite(num)) normVal = Math.round(num).toFixed(0);
                        }
                        // 4. أي رقم صحيح كبير (>= 1e10) → نص
                        else if (typeof val === 'number' && isFinite(val) && Math.abs(val) >= 1e10 && Number.isInteger(val)) {
                            normVal = val.toFixed(0);
                        }

                        const existingValue = newRow[normKey];
                        const hasExistingValue = existingValue !== undefined && existingValue !== null && String(existingValue).trim() !== '';
                        const hasNewValue = normVal !== undefined && normVal !== null && String(normVal).trim() !== '';

                        // لو وجدنا عمودا بديلا لنفس المعنى، نملأ المفتاح القياسي فقط دون أن نمسح قيمة صحيحة موجودة.
                        if (!hasExistingValue || (hasNewValue && rawNormalizedKey === normKey)) {
                            newRow[normKey] = normVal;
                        }
                    }
                    return newRow;
                });
                resolve(normalizedData);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
};

App.prototype.harmonizeImportedRows = function (rows) {
    const mappings = {
        'الرقم القومي': ['الرقم القومى', 'الرقم_القومي', 'NationalID', 'National Id', 'NID'],
        'قيمة العملية': ['المبلغ', 'القيمة', 'Amount', 'Transaction Value'],
        'رقم تسوية السداد': ['رقم التسوية', 'رقم تسوية سداد', 'SettlementNo', 'Settlement No'],
        'رقم تسوية التعلية': ['رقم تسوية تعلية', 'تسوية تعلية', 'AccrualSettlementNo'],
        'تاريخ المرتد / تاريخ التعلية': ['تاريخ المرتد/تاريخ التعلية', 'تاريخ المرتد', 'تاريخ المرتدات', 'تاريخ التعلية', 'ReturnDate'],
        'تاريخ اعتماد التعديل / تاريخ السداد': ['تاريخ اعتماد التعديل/تاريخ السداد', 'تاريخ السداد', 'تاريخ التسوية', 'تاريخ السداد الفعلي', 'SettlementDate', 'Settlement Date']
    };

    return (rows || []).map(row => {
        const normalizedRow = { ...(row || {}) };

        for (const [targetKey, synonyms] of Object.entries(mappings)) {
            const currentValue = normalizedRow[targetKey];
            if (currentValue !== undefined && currentValue !== null && String(currentValue).trim() !== '') {
                continue;
            }

            for (const synonym of synonyms) {
                const synonymValue = normalizedRow[synonym];
                if (synonymValue !== undefined && synonymValue !== null && String(synonymValue).trim() !== '') {
                    normalizedRow[targetKey] = synonymValue;
                    break;
                }
            }
        }

        return normalizedRow;
    });
};

App.prototype.buildLocalDashboardData = function () {
    const salaryRows = Array.isArray(this.salaryReturnsCache) ? this.salaryReturnsCache : [];
    const returnRows = Array.isArray(this.returnsCache) ? this.returnsCache : [];
    if (!salaryRows.length && !returnRows.length) return null;

    const filters = this.getDashboardFilters?.() || {};
    const selectedMonth = filters.month && filters.month !== 'all' ? filters.month : null;
    const selectedSource = filters.source && filters.source !== 'all' ? filters.source : 'all';
    const selectedStatus = filters.status && filters.status !== 'all' ? String(filters.status).toLowerCase() : null;

    const amountOf = (row, type) => {
        if (Number.isFinite(Number(row?._amount))) return Number(row._amount);
        const value = type === 'salary'
            ? this.getUnifiedSalaryAmountValue?.(row)
            : this.findValue?.(row, ['قيمة العملية', 'المبلغ', 'ProcessValue', 'Amount', 'amount', 'Transaction Amount', 'Transaction Value']);
        return this.parseAmount ? this.parseAmount(value) : Number(value || 0);
    };
    const monthOf = (row, type) => type === 'salary'
        ? (this._extractMonthFromRow?.(row) || 'فارغ')
        : (this._getMonthFilterValue?.(row) || 'فارغ');
    const isSettled = row => {
        if (row?._isSettled === true) return true;
        const val = row?.['رقم تسوية السداد'] ?? row?.SettlementNo ?? row?.settlementNo ?? row?.['حالة التسوية'];
        return val !== null && val !== undefined && String(val).trim() !== '' && !/لم|not/i.test(String(val));
    };
    const statusOf = row => String(row?._normStatus || row?.['الحالة'] || row?.Status || row?.ReturnStatus || '').toLowerCase();
    const includeRow = (row, type) => {
        if (selectedSource === 'salary' && type !== 'salary') return false;
        if ((selectedSource === 'incentive' || selectedSource === 'returns') && type !== 'returns') return false;
        if (selectedMonth && monthOf(row, type) !== selectedMonth) return false;
        if (selectedStatus) {
            const settled = isSettled(row);
            const status = statusOf(row);
            if (selectedStatus.includes('unsettled') && settled) return false;
            else if (selectedStatus.includes('settled') && !settled) return false;
            if (selectedStatus.includes('returned') && !/مرتد|return/.test(status)) return false;
            if (selectedStatus.includes('rejected') && !/مرفوض|reject/.test(status)) return false;
        }
        return true;
    };

    const typedRows = [
        ...salaryRows.filter(row => includeRow(row, 'salary')).map(row => ({ row, type: 'salary' })),
        ...returnRows.filter(row => includeRow(row, 'returns')).map(row => ({ row, type: 'returns' }))
    ];
    const summary = {
        salaryCount: typedRows.filter(x => x.type === 'salary').length,
        incentiveCount: typedRows.filter(x => x.type === 'returns').length,
        totalAmount: 0,
        paidAmount: 0,
        accruedAmount: 0,
        pendingAmount: 0,
        pendingCount: 0,
        settledCount: 0,
        returnedCount: 0,
        rejectedCount: 0,
        archiveCount: 0,
        todayCount: 0,
        thisMonthCount: 0
    };

    const byMonth = new Map();
    const amountByMonth = new Map();
    typedRows.forEach(({ row, type }) => {
        const amount = amountOf(row, type);
        const settled = isSettled(row);
        const status = statusOf(row);
        const month = monthOf(row, type) || 'فارغ';
        summary.totalAmount += amount;
        if (settled) {
            summary.settledCount++;
            summary.paidAmount += amount;
        } else {
            summary.pendingCount++;
            summary.pendingAmount += amount;
        }
        if (/مرتد|return/.test(status)) summary.returnedCount++;
        if (/مرفوض|reject/.test(status)) summary.rejectedCount++;
        if (!byMonth.has(month)) byMonth.set(month, { month, salary: 0, incentive: 0 });
        byMonth.get(month)[type === 'salary' ? 'salary' : 'incentive']++;
        amountByMonth.set(month, (amountByMonth.get(month) || 0) + amount);
    });

    const sortByMonth = (a, b) => String(a.month || a[0]).localeCompare(String(b.month || b[0]));
    return {
        summary,
        charts: {
            returnedRejected: [
                { metric: 'returned', label: 'Returned', value: summary.returnedCount },
                { metric: 'rejected', label: 'Rejected', value: summary.rejectedCount }
            ],
            sourceByMonth: Array.from(byMonth.values()).sort(sortByMonth).slice(-12),
            amountByMonth: Array.from(amountByMonth.entries()).map(([month, value]) => ({ month, value })).sort(sortByMonth).slice(-12),
            settlement: [
                { metric: 'paid', label: 'تم التسوية', value: summary.settledCount, amount: summary.paidAmount },
                { metric: 'unsettled', label: 'تحت التسوية', value: summary.pendingCount, amount: summary.pendingAmount }
            ],
            archives: []
        }
    };
};

App.prototype.refreshDashboardFromServer = function () {
    const now = Date.now();
    if (this._dashboardServerRefreshAt && now - this._dashboardServerRefreshAt < 60000) return;
    this._dashboardServerRefreshAt = now;
    setTimeout(async () => {
        if (this.currentPage !== 'dashboard') return;
        try {
            const query = this.dashboardQuery?.() || '';
            const [summaryResponse, chartsResponse] = await Promise.all([
                db.fetchApi(`/api/dashboard/summary?${query}`, { timeout: 5000, __skipLoadingWrapper: true, __suppressErrorLog: true }),
                db.fetchApi(`/api/dashboard/charts?${query}`, { timeout: 5000, __skipLoadingWrapper: true, __suppressErrorLog: true })
            ]);
            this.dashboardSummary = summaryResponse.summary || this.dashboardSummary || {};
            this.dashboardCharts = chartsResponse.charts || this.dashboardCharts || {};
            this.renderDashboardSummary(this.dashboardSummary);
            this.renderDashboardCharts(this.dashboardCharts);
            this.setDashboardState?.('', '');
        } catch (error) {
            console.warn('[Dashboard] Background refresh skipped:', error?.message || error);
        }
    }, 8000);
};

App.prototype.loadFromOfflineStorage = async function () {
    if (this._offlineStorageLoadedPromise) return this._offlineStorageLoadedPromise;

    this._offlineStorageLoadedPromise = (async () => {
        console.log('[CACHE] Loading IndexedDB snapshot first...');
        await Promise.all([
            this._loadCachedDataset?.('returns'),
            this._loadCachedDataset?.('salary')
        ]);
        this._offlineStorageLoaded = true;

        this.ensureOfflineCacheIdentity()
            .catch(e => console.warn('[CACHE] identity check deferred/failed:', e))
            .finally(() => {
                this.startBackgroundSync();
                this.refreshSearchFilterIndex?.().catch(e => console.warn('[SearchIndex] background refresh failed:', e));
            });

        return true;
    })();

    return this._offlineStorageLoadedPromise;
};

const AUTO_SYNC_INTERVAL_MS = 120000;
const HK_CACHE_IDENTITY_KEY = 'hk_cache_identity_v1';
const HK_SYNC_CACHE = {
    returns: {
        dataKey: 'returns_data_v4',
        metaKey: 'returns_last_sync_v4',
        cacheProp: 'returnsCache',
        page: 'returns',
        changes: since => db.getReturnChanges(since),
        sync: since => db.syncReturns(since)
    },
    salary: {
        dataKey: 'salary_returns_data_v4',
        metaKey: 'salary_returns_last_sync_v4',
        cacheProp: 'salaryReturnsCache',
        page: 'salary-returns',
        changes: since => db.getSalaryReturnChanges(since),
        sync: since => db.syncSalaryReturns(since)
    },
    full: {
        dataKey: 'full_returns_data_v1',
        metaKey: 'full_returns_last_sync_v1',
        cacheProp: 'fullReturnsCache',
        page: 'full-returns',
        changes: since => db.getFullReturnChanges(since),
        sync: since => db.syncFullReturns(since)
    }
};

App.prototype.ensureOfflineCacheIdentity = async function () {
    try {
        const config = await db.fetchApi('/config', {
            __skipLoadingWrapper: true,
            __suppressErrorLog: true
        });
        const identity = [
            window.location.origin,
            config?.DatabasePath || config?.databasePath || '',
            config?.ActiveImportId ?? config?.activeImportId ?? '',
            config?.ActiveSalaryImportId ?? config?.activeSalaryImportId ?? ''
        ].join('|');
        if (!identity.trim()) return;

        const previous = await db.getLocalCache(HK_CACHE_IDENTITY_KEY).catch(() => null);
        let hasLegacyRows = false;
        if (!previous) {
            for (const cfg of Object.values(HK_SYNC_CACHE)) {
                const cachedRows = await db.getLocalCache(cfg.dataKey).catch(() => null);
                if (Array.isArray(cachedRows) && cachedRows.length > 0) {
                    hasLegacyRows = true;
                    break;
                }
            }
        }
        if ((previous && previous !== identity) || hasLegacyRows) {
            console.warn('[CACHE] Database identity changed. Clearing stale offline rows.');
            for (const cfg of Object.values(HK_SYNC_CACHE)) {
                await db.clearLocalCache(cfg.dataKey).catch(() => {});
                await db.clearLocalCache(cfg.metaKey).catch(() => {});
                await db.clearLocalCacheRowPatches?.(cfg.dataKey).catch(() => {});
            }
            this.returnsCache = null;
            this.salaryReturnsCache = null;
            this.fullReturnsCache = null;
            this.data = [];
            this.salaryReturnsData = [];
            this._returnsLastSyncAttemptAt = 0;
            this._salaryLastSyncAttemptAt = 0;
            this._fullLastSyncAttemptAt = 0;
        }
        await db.setLocalCache(HK_CACHE_IDENTITY_KEY, identity).catch(() => {});
    } catch (error) {
        console.warn('[CACHE] Unable to verify database identity:', error);
    }
};

App.prototype._applyDerivedSettlementStatus = function (row) {
    if (!row) return row;
    const settlementKeys = [
        '\u0631\u0642\u0645 \u062a\u0633\u0648\u064a\u0629 \u0627\u0644\u0633\u062f\u0627\u062f',
        '\u0631\u0642\u0645 \u0627\u0633\u062a\u0645\u0627\u0631\u0629 \u0627\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u062d\u0648\u064a\u0644 / \u0627\u0644\u062a\u0633\u0648\u064a\u0629',
        'SettlementNo',
        'settlementNo',
        'PaymentSettlementNo'
    ];
    const statusKeys = [
        '\u062d\u0627\u0644\u0629 \u0627\u0644\u062a\u0633\u0648\u064a\u0629',
        'SettlementStatus',
        'settlementStatus'
    ];

    const settlementNo = this.findValue ? this.findValue(row, settlementKeys) : settlementKeys.map(k => row[k]).find(Boolean);
    const hasSettlement = settlementNo !== null && settlementNo !== undefined && String(settlementNo).trim() !== '';
    const status = hasSettlement ? '\u062a\u0645 \u0627\u0644\u062a\u0633\u0648\u064a\u0629' : '\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u062a\u0633\u0648\u064a\u0629';

    row['\u062d\u0627\u0644\u0629 \u0627\u0644\u062a\u0633\u0648\u064a\u0629'] = status;
    row.SettlementStatus = status;
    row.settlementStatus = status;
    row._isSettled = hasSettlement;

    const standardSettlementKey = '\u0631\u0642\u0645 \u062a\u0633\u0648\u064a\u0629 \u0627\u0644\u0633\u062f\u0627\u062f';
    if ((row[standardSettlementKey] === undefined || row[standardSettlementKey] === null || String(row[standardSettlementKey]).trim() === '') && hasSettlement) {
        row[standardSettlementKey] = settlementNo;
    }

    return row;
};

App.prototype._preprocessReturnCacheRows = function (rows) {
    return (Array.isArray(rows) ? rows : []).filter(Boolean).map(row => {
        const amountVal = row['قيمة العملية'] || row[' قيمة العملية'] || row['ظ‚ظٹظ…ط© ط§ظ„ط¹ظ…ظ„ظٹط©'] || row[' ظ‚ظٹظ…ط© ط§ظ„ط¹ظ…ظ„ظٹط©'] || row.ProcessValue || row.Amount || row['المبلغ'];
        row._amount = this.parseAmount(amountVal);
        row._normStatus = this.normalizeArabic(row['الحالة'] || row['ط§ظ„ط­ط§ظ„ط©'] || row.Status || row.ReturnStatus || row['حالة الارتداد'] || row['ط­ط§ظ„ط© ط§ظ„ط§ط±طھط¯ط§ط¯'] || '');

        const settlementNo = row['رقم تسوية السداد'] || row['ط±ظ‚ظ… طھط³ظˆظٹط© ط§ظ„ط³ط¯ط§ط¯'];
        const hasSettlement = settlementNo !== null && settlementNo !== undefined && String(settlementNo).trim() !== '';
        row['حالة التسوية'] = row['حالة التسوية'] || row['ط­ط§ظ„ط© ط§ظ„طھط³ظˆظٹط©'] || (hasSettlement ? 'تمت التسوية' : 'لم يتم التسوية');
        row['ط­ط§ظ„ط© ط§ظ„طھط³ظˆظٹط©'] = row['ط­ط§ظ„ط© ط§ظ„طھط³ظˆظٹط©'] || row['حالة التسوية'];
        row._isSettled = hasSettlement || String(row['حالة التسوية'] || '').includes('تم');

        const originalValues = Object.entries(row)
            .filter(([k, v]) => !String(k).startsWith('_') && v !== null && v !== undefined)
            .map(([, v]) => String(v).toLowerCase());
        const normalizedValues = originalValues.map(v => this.normalizeArabic(v));
        row._searchStr = [...new Set([...originalValues, ...normalizedValues])].join(' ');
        return row;
    });
};

App.prototype._preprocessSalaryCacheRows = function (rows) {
    return (Array.isArray(rows) ? rows : []).filter(Boolean).map(row => {
        const amountVal = row['قيمة العملية'] || row['ظ‚ظٹظ…ط© ط§ظ„ط¹ظ…ظ„ظٹط©'] || row.ProcessValue || row.Amount || row['المبلغ'];
        row._amount = this.parseAmount(amountVal);
        const settlementNo = row['رقم تسوية السداد'] || row['ط±ظ‚ظ… طھط³ظˆظٹط© ط§ظ„ط³ط¯ط§ط¯'];
        const hasSettlement = settlementNo !== null && settlementNo !== undefined && String(settlementNo).trim() !== '';
        row['حالة التسوية'] = row['حالة التسوية'] || row['ط­ط§ظ„ط© ط§ظ„طھط³ظˆظٹط©'] || (hasSettlement ? 'تمت التسوية' : 'لم يتم التسوية');
        row['ط­ط§ظ„ط© ط§ظ„طھط³ظˆظٹط©'] = row['ط­ط§ظ„ط© ط§ظ„طھط³ظˆظٹط©'] || row['حالة التسوية'];

        const fileCodeKeys = ['كود الملف', 'ظƒظˆط¯ ط§ظ„ظ…ظ„ظپ', 'FileCode', 'كود_الملف', 'Instruction Identification', 'InstructionIdentification', 'Batch ID', 'BatchID'];
        row._monthExtracted = row._monthExtracted || this._getSalaryMonthFilterValue?.(row) || this.extractMonthFromFileCode?.(this.findValue(row, fileCodeKeys));
        const originalValues = Object.entries(row)
            .filter(([k, v]) => !String(k).startsWith('_') && v !== null && v !== undefined)
            .map(([, v]) => String(v).toLowerCase());
        const normalizedValues = originalValues.map(v => this.normalizeArabic(v));
        row._searchStr = [...new Set([...originalValues, ...normalizedValues])].join(' ');
        return row;
    });
};

App.prototype._preprocessCachedRows = function (type, rows) {
    if (type === 'full') {
        return (Array.isArray(rows) ? rows : []).filter(Boolean).map(row => {
            const originalValues = Object.entries(row)
                .filter(([k, v]) => !String(k).startsWith('_') && v !== null && v !== undefined)
                .map(([, v]) => String(v).toLowerCase());
            const normalizedValues = originalValues.map(v => this.normalizeArabic(v));
            row._searchStr = [...new Set([...originalValues, ...normalizedValues])].join(' ');
            row._amount = this.parseAmount(row['Transaction Amount'] || row['Transaction Value'] || row.Amount || row.amount || row['قيمة العملية'] || row['ظ‚ظٹظ…ط© ط§ظ„ط¹ظ…ظ„ظٹط©']);
            return row;
        });
    }
    const processedRows = type === 'salary' ? this._preprocessSalaryCacheRows(rows) : this._preprocessReturnCacheRows(rows);
    return processedRows.map(row => this._applyDerivedSettlementStatus(row));
};

App.prototype._stripEditableTechnicalFields = function (row) {
    const clean = { ...(row || {}) };
    delete clean.id;
    delete clean.Id;
    delete clean.AttachmentCount;
    Object.keys(clean).forEach(key => {
        if (String(key).startsWith('_')) delete clean[key];
    });
    return clean;
};

App.prototype._getChangedFields = function (original, edited) {
    const changed = {};
    const before = original || {};
    Object.entries(edited || {}).forEach(([key, value]) => {
        if (key === 'id' || key === 'Id' || key === 'AttachmentCount' || String(key).startsWith('_')) return;
        const previous = before[key] === undefined || before[key] === null ? '' : String(before[key]);
        const next = value === undefined || value === null ? '' : String(value);
        if (previous !== next) changed[key] = value;
    });
    return changed;
};

App.prototype._rowEditAffectsFilters = function (changedKeys = []) {
    const needles = [
        'status', 'returnstatus', 'settlement', 'attachment', 'upload', 'payment',
        'month', 'date', 'filecode', 'returncode',
        'حالة', 'تسوية', 'تاريخ', 'شهر', 'كود', 'رفع', 'سداد'
    ];
    return (changedKeys || []).some(key => {
        const normalized = String(key || '').toLowerCase().replace(/\s+/g, '');
        return needles.some(needle => normalized.includes(needle));
    });
};

App.prototype._applyEditedRowInMemory = function (type, id, updatedRow) {
    const processed = this._preprocessCachedRows(type, [{ ...(updatedRow || {}), id }])[0];
    if (!processed) return null;

    const updateArray = (rows) => {
        if (!Array.isArray(rows)) return;
        const idx = rows.findIndex(row => String(row?.id ?? row?.Id) === String(id));
        if (idx >= 0) {
            if (processed.AttachmentCount === undefined && rows[idx].AttachmentCount !== undefined) {
                processed.AttachmentCount = rows[idx].AttachmentCount;
            }
            rows[idx] = processed;
        } else {
            rows.push(processed);
        }
    };

    const cfg = HK_SYNC_CACHE[type];
    if (cfg && Array.isArray(this[cfg.cacheProp])) updateArray(this[cfg.cacheProp]);

    if (type === 'salary') {
        updateArray(this.salaryReturnsData);
        updateArray(this.filteredSalaryReturns);
    } else {
        updateArray(this.data);
        updateArray(this.filteredReturns);
    }

    return processed;
};

App.prototype._removeRowsFromMemory = function (type, ids, options = {}) {
    const idSet = new Set((Array.isArray(ids) ? ids : [ids]).map(id => String(id)));
    const cfg = HK_SYNC_CACHE[type];
    let removed = 0;

    const removeFrom = (rows) => {
        if (!Array.isArray(rows)) return 0;
        let count = 0;
        for (let i = rows.length - 1; i >= 0; i--) {
            const rowId = rows[i]?.id ?? rows[i]?.Id ?? rows[i]?.ID;
            if (idSet.has(String(rowId))) {
                rows.splice(i, 1);
                count++;
            }
        }
        return count;
    };

    if (cfg) removed += removeFrom(this[cfg.cacheProp]);

    if (type === 'salary') {
        removeFrom(this.salaryReturnsData);
        removeFrom(this.filteredSalaryReturns);
        idSet.forEach(id => this.selectedSalaryReturns?.delete?.(id));
        if (!options.deferRender) {
            if (this.handleLocalSalarySearch) {
                this.handleLocalSalarySearch(
                    this.salarySearchQuery || '',
                    this.salaryAttachmentFilterValue || 'all',
                    this.salaryPagination?.currentPage || this.paginationSalary?.currentPage || 1,
                    this.rowsPerPage || 50,
                    false
                );
            } else {
                this.renderSalaryTable?.();
            }
        }
    } else {
        removeFrom(this.data);
        removeFrom(this.filteredReturns);
        idSet.forEach(id => this.selectedReturns?.delete?.(id));
        if (!options.deferRender) {
            if (this.handleLocalSearch) {
                this.handleLocalSearch(
                    this.searchQuery || '',
                    this.filterValue || '',
                    this.attachmentFilterValue || 'all',
                    this.pagination?.currentPage || 1,
                    this.rowsPerPage || 50,
                    false
                );
            } else {
                this.filterAndRenderTable?.();
            }
        }
    }

    if (cfg && Array.isArray(this[cfg.cacheProp])) {
        db.setLocalCache(cfg.dataKey, this[cfg.cacheProp]).catch(e => console.warn(`[CACHE][${type}] local delete save failed`, e));
        idSet.forEach(id => {
            db.setLocalCacheRowPatch?.(cfg.dataKey, id, { id, _deleted: true }).catch(() => {});
        });
    }

    return removed;
};

App.prototype._deleteRowsInBackground = function (type, ids, deleteFn, options = {}) {
    const idList = (Array.isArray(ids) ? ids : [ids]).filter(id => id !== undefined && id !== null);
    if (!idList.length) return;

    const label = options.label || 'تحديث البيانات';
    const bg = this.beginBackgroundMutation(options.progressMessage || `جاري ${label} في الخلفية...`);

    (async () => {
        let successCount = 0;
        for (const id of idList) {
            const result = await deleteFn(id);
            if (result !== false) successCount++;
        }
        if (successCount === idList.length) {
            bg.success(options.successMessage || 'تم تحديث البيانات');
        } else {
            throw new Error(`تم تنفيذ ${successCount} من ${idList.length}`);
        }
    })().catch(error => {
        console.error(`[BACKGROUND][${type}] delete failed:`, error);
        bg.error(options.errorMessage || 'تعذر تحديث البيانات، جاري إعادة المزامنة');
        this._syncDataset?.(type, { force: true, full: true, skipCheck: true }).catch(() => {});
    });
};

App.prototype._hasActiveRowFilters = function (type) {
    if (type === 'salary') {
        return !!(
            (this.salarySearchQuery && String(this.salarySearchQuery).trim()) ||
            (this.salaryAttachmentFilterValue && this.salaryAttachmentFilterValue !== 'all') ||
            (this.salarySettlementFilterValue && this.salarySettlementFilterValue !== 'all') ||
            (this.salaryReturnStatusFilterValue && this.salaryReturnStatusFilterValue !== 'all') ||
            (this.salaryMonthFilterValue && this.salaryMonthFilterValue !== 'all') ||
            (this.salaryPaymentDateFilterValue && this.salaryPaymentDateFilterValue !== 'all') ||
            (document.getElementById('salary-upload-date-filter')?.value || 'all') !== 'all'
        );
    }

    return !!(
        (this.searchQuery && String(this.searchQuery).trim()) ||
        (this.filterValue && this.filterValue !== 'all' && this.filterValue !== 'All') ||
        (this.attachmentFilterValue && this.attachmentFilterValue !== 'all') ||
        (this.settlementFilterValue && this.settlementFilterValue !== 'all') ||
        (this.returnStatusFilterValue && this.returnStatusFilterValue !== 'all') ||
        (this.monthFilterValue && this.monthFilterValue !== 'all') ||
        (this.paymentDateFilterValue && this.paymentDateFilterValue !== 'all') ||
        this.uploadDateFrom ||
        this.uploadDateTo
    );
};

App.prototype._upsertEditedCachedRow = async function (type, id, updatedRow, options = {}) {
    const cfg = HK_SYNC_CACHE[type];
    if (!cfg) return null;

    const processed = this._preprocessCachedRows(type, [{ ...(updatedRow || {}), id }])[0];
    if (!processed) return null;
    const changedKeys = options.changedKeys || [];
    const filtersAffected = this._rowEditAffectsFilters(changedKeys);
    const shouldRequeryCurrentView = filtersAffected || this._hasActiveRowFilters(type);
    const deferRender = options.deferRender === true;

    const updateArray = (rows) => {
        if (!Array.isArray(rows)) return false;
        const idx = rows.findIndex(row => String(row?.id ?? row?.Id) === String(id));
        if (idx >= 0) {
            if (processed.AttachmentCount === undefined && rows[idx].AttachmentCount !== undefined) {
                processed.AttachmentCount = rows[idx].AttachmentCount;
            }
            rows[idx] = processed;
        } else {
            rows.push(processed);
        }
        return true;
    };

    const cacheRows = Array.isArray(this[cfg.cacheProp]) ? this[cfg.cacheProp] : null;
    if (cacheRows) {
        if (type === 'returns') console.time('[SAVE PERF][returns] update returnsCache');
        updateArray(cacheRows);
        if (type === 'returns') console.timeEnd('[SAVE PERF][returns] update returnsCache');
        if (type === 'returns') console.time('[SAVE PERF][returns] indexeddb-row');
        await db.setLocalCacheRowPatch(cfg.dataKey, id, processed).catch(e => console.warn('[SAVE][' + type + '] IndexedDB row update failed:', e));
        if (type === 'returns') console.timeEnd('[SAVE PERF][returns] indexeddb-row');
    }

    if (type === 'salary') {
        updateArray(this.salaryReturnsData);
        updateArray(this.filteredSalaryReturns);
        if (deferRender) return processed;
        if (filtersAffected) this._populateSalaryReturnFilterOptions(cacheRows || this.salaryReturnsData || []);
        if (cacheRows && this.handleLocalSalarySearch && shouldRequeryCurrentView) {
            this.handleLocalSalarySearch(
                this.salarySearchQuery || '',
                this.salaryAttachmentFilterValue || 'all',
                this.salaryPagination?.currentPage || this.paginationSalary?.currentPage || 1,
                this.rowsPerPage || 50,
                false
            );
        } else {
            this.renderSalaryTable?.();
        }
        return processed;
    }

    updateArray(this.data);
    updateArray(this.filteredReturns);
    if (type === 'returns') console.log('[SAVE FLOW][returns] before render');
    if (deferRender) return processed;
    if (type === 'returns') console.time('[SAVE PERF][returns] filters+render');
    if (filtersAffected) this._populateReturnFilterOptions(cacheRows || this.data || []);
    if (cacheRows && this.handleLocalSearch && shouldRequeryCurrentView) {
        this.handleLocalSearch(
            this.searchQuery || '',
            this.filterValue || '',
            this.attachmentFilterValue || 'all',
            this.pagination?.currentPage || 1,
            this.rowsPerPage || 50,
            false
        );
    } else {
        this.renderTable?.();
    }
    if (type === 'returns') console.timeEnd('[SAVE PERF][returns] filters+render');
    if (type === 'returns') console.log('[SAVE FLOW][returns] after render');
    return processed;
};

App.prototype._loadCachedDataset = async function (type) {
    const cfg = HK_SYNC_CACHE[type];
    if (!cfg) return false;
    try {
        const cached = await db.getLocalCache(cfg.dataKey);
        if (!Array.isArray(cached) || cached.length === 0) return false;
        const patches = await db.getLocalCacheRowPatches(cfg.dataKey).catch(() => []);
        const byId = new Map(cached.map(row => [String(row?.id ?? row?.Id), row]));
        patches.forEach(row => {
            const rowId = String(row?.id ?? row?.Id ?? '');
            if (!rowId) return;
            if (row._deleted) byId.delete(rowId);
            else byId.set(rowId, row);
        });
        this[cfg.cacheProp] = this._preprocessCachedRows(type, Array.from(byId.values()));
        console.log(`[SYNC][${type}] Loaded from cache: ${this[cfg.cacheProp].length}`);
        if (this.currentPage === cfg.page) this._refreshSyncedDatasetView(type);
        return true;
    } catch (e) {
        console.warn(`[SYNC][${type}] IndexedDB read failed:`, e);
        return false;
    }
};

App.prototype._saveCachedDataset = async function (type, latestSyncAt) {
    const cfg = HK_SYNC_CACHE[type];
    if (!cfg) return;
    await db.setLocalCache(cfg.dataKey, this[cfg.cacheProp] || []).catch(e => console.warn(`[SYNC][${type}] cache save failed`, e));
    await db.clearLocalCacheRowPatches?.(cfg.dataKey).catch(() => {});
    if (latestSyncAt) await db.setLocalCache(cfg.metaKey, latestSyncAt).catch(() => {});
};

App.prototype._mergeSyncedDataset = function (type, insertedOrUpdated, archivedOrDeletedIds) {
    const cfg = HK_SYNC_CACHE[type];
    const currentRows = Array.isArray(this[cfg.cacheProp]) ? this[cfg.cacheProp] : [];
    const byId = new Map(currentRows.map(row => [String(row.id ?? row.Id), row]));
    const deleted = new Set((archivedOrDeletedIds || []).map(id => String(id)));
    deleted.forEach(id => byId.delete(id));

    let inserted = 0;
    let updated = 0;
    (insertedOrUpdated || []).forEach(row => {
        const id = String(row?.id ?? row?.Id ?? '');
        if (!id) return;
        if (byId.has(id)) updated++;
        else inserted++;
        byId.set(id, row);
    });

    this[cfg.cacheProp] = this._preprocessCachedRows(type, Array.from(byId.values()));
    return { inserted, updated, archived: deleted.size };
};

App.prototype._refreshSyncedDatasetView = function (type) {
    if (this.currentPage === 'full-returns') {
        const query = document.getElementById('unified-search-input')?.value || this.searchQuery || '';
        this.handleUnifiedLocalSearch?.(query);
        return;
    }

    if (type === 'salary') {
        if (this.currentPage !== 'salary-returns') return;
        this.handleLocalSalarySearch(this.salarySearchQuery || '', this.salaryAttachmentFilterValue || 'all', 1, this.rowsPerPage || 50, false);
        this._populateSalaryReturnFilterOptions(this.salaryReturnsCache || []);
        return;
    }

    if (this.currentPage !== 'returns') return;
    this.handleLocalSearch(this.searchQuery || '', this.filterValue || '', this.attachmentFilterValue || 'all', 1, this.rowsPerPage || 50, false);
    this._populateReturnFilterOptions(this.returnsCache || []);
};

App.prototype._syncDataset = async function (type, options = {}) {
    const cfg = HK_SYNC_CACHE[type];
    if (!cfg) return;
    if (type === 'returns' && this.isSavingReturns && !options.forceSave) {
        console.log(`[SYNC][${type}] Skipped while returns save is in progress`);
        return;
    }
    if (this[`_${type}Syncing`] && !options.force) return;

    if (!options.force && !options.full && !options.forceSave) {
        const throttleKey = `_${type}LastSyncAttemptAt`;
        const now = Date.now();
        if (this[throttleKey] && now - this[throttleKey] < 15000) {
            return;
        }
        this[throttleKey] = now;
    }

    this[`_${type}Syncing`] = true;

    try {
        let hasLocalRows = Array.isArray(this[cfg.cacheProp]) && this[cfg.cacheProp].length > 0;
        if (!hasLocalRows) {
            await this._loadCachedDataset(type);
            hasLocalRows = Array.isArray(this[cfg.cacheProp]) && this[cfg.cacheProp].length > 0;
        }
        const since = options.full || !hasLocalRows ? null : await db.getLocalCache(cfg.metaKey).catch(() => null);
        console.log(`[SYNC][${type}] Checking updates`, since || '(initial)');

        if (!options.skipCheck) {
            const changes = await cfg.changes(since);
            if (since && changes && changes.hasChanges === false) {
                console.log(`[SYNC][${type}] No changes`);
                return;
            }
        }

        const payload = await cfg.sync(since);
        const beforeCount = Array.isArray(this[cfg.cacheProp]) ? this[cfg.cacheProp].length : 0;
        let result;
        if (!since || payload?.reset) {
            const snapshot = payload?.insertedOrUpdated || [];
            this[cfg.cacheProp] = this._preprocessCachedRows(type, snapshot);
            result = { inserted: snapshot.length, updated: 0, archived: Math.max(0, beforeCount - snapshot.length) };
        } else {
            result = this._mergeSyncedDataset(type, payload?.insertedOrUpdated || [], payload?.archivedOrDeletedIds || []);
        }
        await this._saveCachedDataset(type, payload?.latestSyncAt || payload?.serverTime || new Date().toISOString());
        console.log(`[SYNC][${type}] Synced ${result.inserted} new / ${result.updated} updated / ${result.archived} archived`);

        const afterCount = Array.isArray(this[cfg.cacheProp]) ? this[cfg.cacheProp].length : 0;
        if (this.currentPage === cfg.page && (result.inserted || result.updated || result.archived || beforeCount !== afterCount)) {
            this._refreshSyncedDatasetView(type);
            this.refreshSearchFilterIndex?.(true).catch(e => console.warn('[SearchIndex] refresh failed:', e));
        }
    } catch (e) {
        if (e?.isTimeout) {
            this[`_${type}LastSyncAttemptAt`] = Date.now() + 45000;
            console.info(`[SYNC][${type}] Background sync postponed: server is busy`);
        } else {
            console.warn(`[SYNC][${type}] Background sync skipped:`, e?.message || e);
        }
    } finally {
        this[`_${type}Syncing`] = false;
    }
};

App.prototype.runBackgroundSyncCycle = async function () {
    if (this._backgroundSyncCycleRunning) return;
    this._backgroundSyncCycleRunning = true;
    try {
        await this._syncDataset('returns').catch(() => {});
        await this._syncDataset('salary').catch(() => {});
        if (this.currentPage === 'full-returns') {
            await this._syncDataset('full').catch(() => {});
        }
    } finally {
        this._backgroundSyncCycleRunning = false;
    }
};

App.prototype.startBackgroundSync = async function () {
    if (!this._initialBackgroundSyncTimer) {
        this._initialBackgroundSyncTimer = setTimeout(() => {
            this.runBackgroundSyncCycle?.();
        }, 12000);
    }
    if (this._autoSyncTimer) return;
    this._autoSyncTimer = setInterval(() => {
        if (document.hidden) return;
        this.runBackgroundSyncCycle?.();
    }, AUTO_SYNC_INTERVAL_MS);
};

App.prototype.startNotificationPolling = function () {
    if (this.notificationPollingTimer) return;
    // زيادة الوقت لتقليل الضغط على قاعدة البيانات في الشبكة المشتركة
    this.notificationPollingTimer = setInterval(() => {
        if (this.currentUser?.id && !document.hidden) {
            this.loadNotifications();
        }
    }, 15000); // 15 ثانية بدلاً من 5
};

App.prototype.populateReturnsCache = async function () {
    await this._syncDataset('returns', { force: true, skipCheck: true });
};

App.prototype.loadExtractionMonths = async function () {
    try {
        const res = await fetch('/api/smart-settlement/months');
        const result = await res.json();
        if (result.success) {
            const extractSelect = document.getElementById('extract-month-filter');
            const mainSelect = document.getElementById('month-filter');
            const settlementSelect = document.getElementById('settlement-month-filter');
            const smartSelect = document.getElementById('smart-month-filter');

            const options = '<option value="all">كل الشهور ▼</option>' + result.data.map(m => `<option value="${m}">${m}</option>`).join('');

            if (extractSelect) extractSelect.innerHTML = options;
            if (mainSelect) mainSelect.innerHTML = options;
            if (settlementSelect) settlementSelect.innerHTML = options;
            // Removed automatic population of smart-month-filter with ALL months
            // as it's now populated dynamically from matching results only.

        }
    } catch (e) {
        console.error('Failed to load months:', e);
    }
};

App.prototype.handleAttachmentFilterChange = async function () {
    const val = document.getElementById('attachment-status-filter')?.value || 'all';
    console.log('[FILTER] Attachment filter changed:', val);
    this.attachmentFilterValue = val;
    this.currentPage_num = 1;
    await this.loadReturns(1, this.rowsPerPage, this.searchQuery, this.filterValue, val);
};

/**
 * استخراج قيم الشهور من البيانات المحلية (cache) وملء فلتر الشهر ديناميكياً
 * @param {string} type - 'returns' or 'salary'
 */
/**
 * استخراج قيمة الشهر من السجل بشكل موحد
 */
App.prototype._extractMonthFromRow = function(row) {
    if (!row) return 'فارغ';

    // الأولوية لعمود "الشهر" الصريح كما هو مطلوب
    const monthKeys = ['الشهر', ' الشهر', 'الشهر ', 'شهر', 'Month', 'month'];
    for (const k of monthKeys) {
        if (row[k] !== null && row[k] !== undefined && String(row[k]).trim() !== '') {
            const normalized = this.normalizeMonthText(String(row[k]).trim());
            if (normalized !== 'فارغ') return normalized;
        }
    }

    // احتياطي للمرتبات من كود الملف إذا كان الشهر فارغاً
    const fileCodeKeys = ['كـــود الملف', 'كود الملف', 'كُـــود المـلف', 'كـــود المـلف', 'FileCode', 'كود_الملف'];
    let fileCode = '';
    for (const k of fileCodeKeys) {
        if (row[k]) { fileCode = String(row[k]); break; }
    }

    if (fileCode) {
        const extracted = this.extractMonthFromFileCode(fileCode);
        if (extracted && extracted !== 'فارغ') return extracted;
    }

    return 'فارغ';
};

App.prototype._getMonthFilterValue = function(row) {
    if (!row) return 'فارغ';
    const fileCodeKeys = ['كـــود الملف', 'كود الملف', 'كُـــود المـلف', 'كـــود المـلف', 'FileCode', 'كود_الملف', 'Instruction Identification', 'InstructionIdentification', 'Batch ID', 'BatchID'];
    const fileCode = this.findValue ? (this.findValue(row, fileCodeKeys) || '') : '';
    return this.extractMonthFromFileCode(fileCode);
};

App.prototype.normalizeMonthText = function(value) {
    const raw = value === null || value === undefined ? '' : String(value).trim();
    if (!raw || raw === 'فارغ') return 'فارغ';
    return this.extractMonthFromFileCode(raw);
};

App.prototype.parseFlexibleDate = function(value, endOfDay = false) {
    const raw = value === null || value === undefined ? '' : String(value).trim();
    if (!raw) return null;
    let year, month, day;
    let match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
        year = Number(match[1]);
        month = Number(match[2]);
        day = Number(match[3]);
    } else {
        match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (!match) return null;
        day = Number(match[1]);
        month = Number(match[2]);
        year = Number(match[3]);
    }
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
    return endOfDay
        ? new Date(year, month - 1, day, 23, 59, 59, 999)
        : new Date(year, month - 1, day, 0, 0, 0, 0);
};

App.prototype.monthTextToDateRange = function(monthText) {
    const normalized = this.normalizeMonthText(monthText);
    if (normalized === 'فارغ') return null;
    const [month, year] = normalized.split('-').map(Number);
    return {
        start: new Date(year, month - 1, 1, 0, 0, 0, 0),
        end: new Date(year, month, 0, 23, 59, 59, 999)
    };
};

App.prototype.isMonthWithinDateRange = function(monthText, fromDate, toDate) {
    const monthRange = this.monthTextToDateRange(monthText);
    if (!monthRange) return false;
    const from = this.parseFlexibleDate(fromDate, false);
    const to = this.parseFlexibleDate(toDate, true);
    if (!from && !to) return true;
    if (from && monthRange.end < from) return false;
    if (to && monthRange.start > to) return false;
    return true;
};

App.prototype.getAdabirDateRangeFilter = function() {
    const from = document.getElementById('adabir-date-from')?.value || '';
    const to = document.getElementById('adabir-date-to')?.value || '';
    this.returnsArchiveDateRange = { from, to };
    return { from, to, active: Boolean(from || to) };
};

App.prototype.getSalaryAdabirDateRangeFilter = function() {
    const from = document.getElementById('salary-adabir-date-from')?.value || '';
    const to = document.getElementById('salary-adabir-date-to')?.value || '';
    this.salaryArchiveDateRange = { from, to };
    return { from, to, active: Boolean(from || to) };
};

App.prototype.applyAdabirDateRangeToRows = function(rows) {
    const range = this.getAdabirDateRangeFilter();
    if (!range.active) return Array.isArray(rows) ? rows : [];
    return (Array.isArray(rows) ? rows : []).filter(row =>
        this.isMonthWithinDateRange(this._getMonthFilterValue(row), range.from, range.to)
    );
};

App.prototype.applySalaryAdabirDateRangeToRows = function(rows) {
    const range = this.getSalaryAdabirDateRangeFilter();
    if (!range.active) return Array.isArray(rows) ? rows : [];
    return (Array.isArray(rows) ? rows : []).filter(row =>
        this.isMonthWithinDateRange(this._getSalaryMonthFilterValue(row), range.from, range.to)
    );
};

App.prototype.updateAdabirDateRangeCount = function(rows = null) {
    const el = document.getElementById('adabir-date-range-count');
    if (!el) return;
    const source = Array.isArray(rows) ? rows : (Array.isArray(this.data) ? this.data : []);
    const range = this.getAdabirDateRangeFilter();
    if (!range.active) {
        el.textContent = `عدد السجلات داخل الفترة: ${source.length}`;
        return;
    }
    const count = this.applyAdabirDateRangeToRows(source).length;
    el.textContent = count > 0 ? `عدد السجلات داخل الفترة: ${count}` : 'لا توجد سجلات داخل الفترة المحددة';
};

App.prototype.updateSalaryAdabirDateRangeCount = function(rows = null) {
    const el = document.getElementById('salary-adabir-date-range-count');
    if (!el) return;
    const source = Array.isArray(rows) ? rows : (Array.isArray(this.salaryReturnsData) ? this.salaryReturnsData : []);
    const range = this.getSalaryAdabirDateRangeFilter();
    if (!range.active) {
        el.textContent = `عدد السجلات داخل الفترة: ${source.length}`;
        return;
    }
    const count = this.applySalaryAdabirDateRangeToRows(source).length;
    el.textContent = count > 0 ? `عدد السجلات داخل الفترة: ${count}` : 'لا توجد سجلات داخل الفترة المحددة';
};

App.prototype._setSelectOptionsFromRows = function(selectId, options, currentValue) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const selected = currentValue || select.value || 'all';
    select.innerHTML = '';

    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'الكل';
    select.appendChild(allOpt);

    options.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.value;
        opt.textContent = item.label;
        select.appendChild(opt);
    });

    select.value = options.some(item => item.value === selected) ? selected : 'all';
};

App.prototype._populateReturnFilterOptions = function(rows = null) {
    const cacheRows = Array.isArray(this.returnsCache) && this.returnsCache.length ? this.returnsCache : null;
    // ✅ دائماً نفضّل الـ index لأنه أدق وأسرع
    const indexFilters = this.searchFilterIndex?.returns?.filters;
    if (indexFilters && (indexFilters.statuses?.length || indexFilters.months?.length)) {
        const has = (indexFilters.hasAttachments || []).map(Number);
        this._setSelectOptionsFromRows('attachment-status-filter', [
            ...(has.includes(1) ? [{ value: 'yes', label: 'بها مرفقات ✅' }] : []),
            ...(has.includes(0) ? [{ value: 'no', label: 'بدون مرفقات ❌' }] : [])
        ], this.attachmentFilterValue);
        this._setSelectOptionsFromRows('return-status-filter', (indexFilters.statuses || []).map(value => ({ value, label: value })), this.returnStatusFilterValue);
        this._setSelectOptionsFromRows('settlement-filter', [
            { value: 'تمت التسوية', label: 'تمت التسوية' },
            { value: 'لم يتم التسوية', label: 'لم يتم التسوية' }
        ], this.settlementFilterValue);
        this._setSelectOptionsFromRows('month-filter', (indexFilters.months || []).map(value => ({ value, label: value })), this.monthFilterValue);
        this._setSelectOptionsFromRows('upload-date-filter', (indexFilters.uploadDates || []).map(value => ({ value, label: value })), document.getElementById('upload-date-filter')?.value || 'all');
        this._setSelectOptionsFromRows('payment-date-filter', (indexFilters.paymentDates || []).map(value => ({ value, label: value })), this.paymentDateFilterValue);
        return;
    }
    const data = cacheRows || (Array.isArray(rows) ? rows : (Array.isArray(this.data) ? this.data : []));

    if (data.length === 0) {
        this._setSelectOptionsFromRows('attachment-status-filter', [], this.attachmentFilterValue);
        this._setSelectOptionsFromRows('return-status-filter', [], this.returnStatusFilterValue);
        this._setSelectOptionsFromRows('settlement-filter', [], this.settlementFilterValue);
        this._setSelectOptionsFromRows('month-filter', [], this.monthFilterValue);
        this._setSelectOptionsFromRows('upload-date-filter', [], document.getElementById('upload-date-filter')?.value || 'all');
        this._setSelectOptionsFromRows('payment-date-filter', [], this.paymentDateFilterValue);
        return;
    }

    const hasAttachments = data.some(row => (Number(row.AttachmentCount || row.attachmentCount || 0) > 0));
    const hasNoAttachments = data.some(row => !(Number(row.AttachmentCount || row.attachmentCount || 0) > 0));
    const attachmentOptions = [];
    if (hasAttachments) attachmentOptions.push({ value: 'yes', label: 'بها مرفقات ✅' });
    if (hasNoAttachments) attachmentOptions.push({ value: 'no', label: 'بدون مرفقات ❌' });
    this._setSelectOptionsFromRows('attachment-status-filter', attachmentOptions, this.attachmentFilterValue);

    const statusSet = new Set();
    const settlementSet = new Set();
    data.forEach(row => {
        const status = String(this.getSalaryField(row, 'الحالة', ['حالة الارتداد', 'Status', 'ReturnStatus', 'Transaction Status', 'TransactionStatus', 'ISOStatus Description', 'ISOStatusDescription']) || '').trim();
        if (status) statusSet.add(status);

        let settlement = String(row['حالة التسوية'] || '').trim();
        if (!settlement) {
            const settlementNo = row['رقم تسوية السداد'];
            settlement = settlementNo !== null && settlementNo !== undefined && String(settlementNo).trim() !== '' ? 'تم التسوية' : 'لم يتم التسوية';
        }
        if (settlement === 'تم التسوية') settlement = 'تمت التسوية';
        if (settlement) settlementSet.add(settlement);
    });
    this._setSelectOptionsFromRows(
        'return-status-filter',
        Array.from(statusSet).sort().map(value => ({ value, label: value })),
        this.returnStatusFilterValue
    );
    this._setSelectOptionsFromRows(
        'settlement-filter',
        Array.from(settlementSet).sort().map(value => ({ value, label: value })),
        this.settlementFilterValue
    );

    this._populateMonthFilter('returns', data);
    this._populateDateFilters(data);
};

App.prototype._populateMonthFilter = async function (type, rows = null) {
    const selectId = type === 'salary' ? 'salary-month-filter' : 'month-filter';
    const select = document.getElementById(selectId);
    if (!select) return;

    let data = type === 'salary'
        ? (this.salaryReturnsCache || this.salaryReturnsData || [])
        : (Array.isArray(rows) ? rows : (this.data || []));

    const monthSet = new Set();
    let hasEmpty = false;

    if (data && data.length > 0) {
        // استخراج الشهور من البيانات الفعلية
        const sampleSize = Math.min(data.length, 10000); // زيادة العينة لضمان دقة الفلتر
        for (let i = 0; i < sampleSize; i++) {
            const m = type === 'salary' ? this._extractMonthFromRow(data[i]) : this._getMonthFilterValue(data[i]);
            if (m === 'فارغ') hasEmpty = true;
            else monthSet.add(m);
        }
    }

    const currentVal = select.value || 'all';
    select.innerHTML = '<option value="all">الكل</option>';

    if (hasEmpty) {
        const emptyOpt = document.createElement('option');
        emptyOpt.value = 'فارغ';
        emptyOpt.textContent = 'فارغ';
        select.appendChild(emptyOpt);
    }

    // ترتيب الشهور تنازلياً
    const sorted = Array.from(monthSet).sort((a, b) => {
        const partsA = String(a).split('-');
        const partsB = String(b).split('-');
        if (partsA.length === 2 && partsB.length === 2) {
            const [mA, yA] = partsA.map(Number);
            const [mB, yB] = partsB.map(Number);
            if (yA !== yB) return yB - yA;
            return mB - mA;
        }
        return String(b).localeCompare(String(a));
    });

    sorted.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        select.appendChild(opt);
    });

    if (currentVal && [...select.options].some(o => o.value === currentVal)) {
        select.value = currentVal;
    }
};


App.prototype._getPaymentDateFilterValue = function(row) {
    if (!row) return '';
    const val = row['تاريخ اعتماد التعديل / تاريخ السداد'] ||
        row['SettlementDate'] ||
        row['تاريخ السداد'] ||
        row['تاريخ التسوية'] ||
        row['تاريخ السداد الفعلي'] ||
        '';
    const raw = String(val).trim();
    return raw ? this.formatDate(raw) : '';
};

App.prototype._populateDateFilters = function(rows = null) {
    const data = Array.isArray(rows) ? rows : (Array.isArray(this.data) ? this.data : []);

    const uploadDates = new Set();
    data.forEach(row => {
        const d = String(row['تاريخ الرفع'] || '').trim();
        if (d) uploadDates.add(d.length >= 10 ? d.substring(0, 10) : d);
    });
    this._setSelectOptionsFromRows(
        'upload-date-filter',
        Array.from(uploadDates).sort((a, b) => b.localeCompare(a)).map(value => ({ value, label: value })),
        document.getElementById('upload-date-filter')?.value || 'all'
    );

    const paymentDates = new Set();
    data.forEach(row => {
        const d = this._getPaymentDateFilterValue(row);
        if (d) paymentDates.add(d.length >= 10 ? d.substring(0, 10) : d);
    });
    this._setSelectOptionsFromRows(
        'payment-date-filter',
        Array.from(paymentDates).sort((a, b) => b.localeCompare(a)).map(value => ({ value, label: value })),
        this.paymentDateFilterValue
    );
};

App.prototype._getPaymentDateFilterValue = function(row) {
    if (!row) return '';
    const val =
        row['\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0639\u062a\u0645\u0627\u062f\u0020\u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0020\u002f\u0020\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0644\u0633\u062f\u0627\u062f'] ||
        row['\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0644\u0633\u062f\u0627\u062f'] ||
        row['\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0644\u062a\u0633\u0648\u064a\u0629'] ||
        row['\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0644\u0633\u062f\u0627\u062f\u0020\u0627\u0644\u0641\u0639\u0644\u064a'] ||
        row.SettlementDate ||
        row['Settlement Date'] ||
        '';
    const raw = String(val).trim();
    return raw ? this.formatDate(raw) : '';
};

App.prototype.handleMonthFilterChange = async function (val) {
    console.log('[FILTER] Month changed to:', val);
    this.monthFilterValue = val || 'all';
    this.currentPage_num = 1;
    await this.loadReturns(1, this.rowsPerPage || 50);
};

App.prototype.handlePaymentDateFilterChange = async function (val) {
    console.log('[FILTER] Payment Date changed to:', val);
    this.paymentDateFilterValue = val || 'all';
    this.currentPage_num = 1;
    await this.loadReturns(1, this.rowsPerPage || 50);
};

App.prototype.handleAdabirDateRangeChange = async function () {
    if (this.currentPage && this.currentPage !== 'returns') {
        this.updateAdabirDateRangeCount(this.data);
        return;
    }
    if (!this.returnsCache || !Array.isArray(this.returnsCache) || this.returnsCache.length === 0) {
        try {
            const allData = await db.getAllReturns(this.searchQuery, this.filterValue, this.attachmentFilterValue);
            this.returnsCache = (Array.isArray(allData) ? allData : []).map(row => {
                const amountVal = row['قيمة العملية'] || row[' قيمة العملية'] || row['ProcessValue'] || row['المبلغ'] || row['Amount'];
                row._amount = this.parseAmount(amountVal);
                row._normStatus = this.normalizeArabic(row['الحالة'] || row['Status'] || row['حالة الارتداد'] || '');
                const settlementNo = row['رقم تسوية السداد'];
                row['حالة التسوية'] = settlementNo !== null && settlementNo !== undefined && String(settlementNo).trim() !== '' ? 'تم التسوية' : 'لم يتم التسوية';
                row._searchStr = Object.entries(row)
                    .filter(([k, v]) => !String(k).startsWith('_') && v !== null && v !== undefined)
                    .map(([, v]) => String(v).toLowerCase())
                    .join(' ');
                return row;
            });
        } catch (e) {
            console.warn('[ADABIR-RANGE] Could not hydrate returns cache, falling back to current page data', e);
        }
    }
    this.currentPage_num = 1;
    await this.loadReturns(1, this.rowsPerPage || 50);
    this.updateSelectedCount?.();
};

App.prototype.handleSalaryAdabirDateRangeChange = async function () {
    if (this.currentPage && this.currentPage !== 'salary-returns') {
        this.updateSalaryAdabirDateRangeCount(this.salaryReturnsData);
        return;
    }
    if (!this.salaryReturnsCache || !Array.isArray(this.salaryReturnsCache) || this.salaryReturnsCache.length === 0) {
        try {
            const allData = await db.getAllSalaryReturns(
                this.salarySearchQuery,
                this.salaryAttachmentFilterValue,
                this.salaryUploadDateFrom,
                this.salaryUploadDateTo,
                this.salarySettlementFilterValue,
                this.salaryReturnStatusFilterValue,
                this.salaryMonthFilterValue,
                this.salaryPaymentDateFilterValue
            );
            this.salaryReturnsCache = (Array.isArray(allData) ? allData : []).map(row => {
                const amountVal = this.getUnifiedSalaryAmountValue(row);
                row._amount = this.parseAmount(amountVal);
                row._normStatus = this.normalizeArabic(row['الحالة'] || row['Status'] || row['حالة الارتداد'] || '');
                const settlementNo = row['رقم تسوية السداد'];
                row['حالة التسوية'] = settlementNo !== null && settlementNo !== undefined && String(settlementNo).trim() !== '' ? 'تم التسوية' : 'لم يتم التسوية';
                row._searchStr = Object.entries(row)
                    .filter(([k, v]) => !String(k).startsWith('_') && v !== null && v !== undefined)
                    .map(([, v]) => String(v).toLowerCase())
                    .join(' ');
                return row;
            });
        } catch (e) {
            console.warn('[SALARY-ADABIR-RANGE] Could not hydrate salary cache, falling back to current page data', e);
        }
    }
    this.salaryReturnsCurrentPage = 1;
    await this.loadSalaryReturns(1, this.salaryReturnsRowsPerPage || 200);
    this.updateBulkSalaryDeleteToolbar?.();
};

App.prototype.handleUploadDateSelectChange = async function (val) {
    console.log('[FILTER] Upload Date changed to:', val);
    if (val && val !== 'all') {
        this.uploadDateFrom = val;
        this.uploadDateTo = val;
    } else {
        this.uploadDateFrom = null;
        this.uploadDateTo = null;
    }
    this.currentPage_num = 1;
    await this.loadReturns(1, this.rowsPerPage || 50);
};

App.prototype.togglePasswordVisibility = function (inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // Toggle the type attribute
    input.type = input.type === 'password' ? 'text' : 'password';

    // Find the icon and update it if possible (Optional but good UX)
    const icon = input.nextElementSibling;
    if (icon && icon.classList.contains('password-toggle-icon')) {
        icon.textContent = input.type === 'password' ? '👁️' : '🙈';
    }
};

// ========================================
// 💰 Salary Returns - مرتادات المرتبات
// ========================================

App.prototype.loadSalaryReturns = async function (page = 1, pageSize = 200, search = null, append = false) {
    if (search !== null) this.salarySearchQuery = search;

    // Fallback search connection
    if (this.salarySearchQuery === null) {
        this.salarySearchQuery = document.getElementById('salary-search')?.value || "";
    }

    // Ensure filters sync from UI if not set by handler
    this.salaryAttachmentFilterValue = document.getElementById('salary-attachment-filter')?.value || this.salaryAttachmentFilterValue || 'all';
    this.salarySettlementFilterValue = document.getElementById('salary-settlement-filter')?.value || this.salarySettlementFilterValue || 'all';
    this.salaryReturnStatusFilterValue = document.getElementById('salary-return-status-filter')?.value || this.salaryReturnStatusFilterValue || 'all';
    this.salaryMonthFilterValue = document.getElementById('salary-month-filter')?.value || this.salaryMonthFilterValue || 'all';
    this.salaryPaymentDateFilterValue = this._normalizeSalaryPaymentDateFilterValue(document.getElementById('salary-payment-date-filter')?.value || this.salaryPaymentDateFilterValue) || 'all';

    const uploadDateFilter = document.getElementById('salary-upload-date-filter')?.value || 'all';
    if (uploadDateFilter && uploadDateFilter !== 'all' && uploadDateFilter !== 'فارغ') {
        this.salaryUploadDateFrom = uploadDateFilter;
        this.salaryUploadDateTo = uploadDateFilter;
    } else {
        this.salaryUploadDateFrom = null;
        this.salaryUploadDateTo = null;
    }

    this.salaryReturnsFilters = {
        search: this.salarySearchQuery || '',
        attachment: this.salaryAttachmentFilterValue || 'all',
        settlement: this.salarySettlementFilterValue || 'all',
        returnStatus: this.salaryReturnStatusFilterValue || 'all',
        month: this.salaryMonthFilterValue || 'all',
        paymentDate: this.salaryPaymentDateFilterValue || 'all',
        uploadDateFrom: this.salaryUploadDateFrom || null,
        uploadDateTo: this.salaryUploadDateTo || null
    };


    // Populate Upload Date Filter from Server
    const salaryUploadSelect = document.getElementById('salary-upload-date-filter');
    if (salaryUploadSelect && salaryUploadSelect.options.length <= 1) {
        try {
            const dates = await db.getSalaryUploadDates();
            if (dates && Array.isArray(dates) && dates.length > 0) {
                const currentVal = salaryUploadSelect.value;
                salaryUploadSelect.innerHTML = '<option value="all">الكل</option>';
                dates.forEach(d => {
                    if (d) {
                        const opt = document.createElement('option');
                        opt.value = d;
                        opt.textContent = d;
                        salaryUploadSelect.appendChild(opt);
                    }
                });
                if (currentVal) salaryUploadSelect.value = currentVal;
            }
        } catch (e) {
            console.warn('Failed to load salary upload dates', e);
        }
    }

    if (!append) {
        const tableBody = document.getElementById('salary-returns-body');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="24" style="text-align:center; padding: 20px;">جاري تحميل بيانات المرتبات...</td></tr>';
        }
    }

    const hasSearch = this.salarySearchQuery && String(this.salarySearchQuery).trim() !== '';
    const hasCache = this.salaryReturnsCache && Array.isArray(this.salaryReturnsCache) && this.salaryReturnsCache.length > 0;

    if (hasCache) {
        console.log('[SPEED] Using Instant Salary Cache Search');
        const localResults = this.handleLocalSalarySearch(this.salarySearchQuery, this.salaryAttachmentFilterValue, page, pageSize, append);
        if (!hasSearch || (localResults && localResults > 0)) {
            return;
        }
        console.log('[FALLBACK] Local salary search returned 0, trying server...');
    }

    // Background Cache Population disabled for 1M records performance
    // if (!this.salaryReturnsCache && !this.isSalaryCaching) {
    //     this.populateSalaryReturnsCache();
    // }

    try {
        // Check for Active Archive (Restore mode)
        const config = await db.fetchApi('/config');

        // Salary Archive Button
        const clearBtn = document.getElementById('clear-salary-archive-btn');
        if (clearBtn) {
            if (config && config.activeSalaryImportId > 0) {
                clearBtn.classList.remove('hidden');
                clearBtn.style.display = 'inline-block';
            } else {
                clearBtn.classList.add('hidden');
                clearBtn.style.display = 'none';
            }
        }

        // Incentive Archive Button (Always hide when in Salary page)
        const clearIncentiveBtn = document.getElementById('clear-archive-btn');
        if (clearIncentiveBtn) {
            clearIncentiveBtn.classList.add('hidden');
            clearIncentiveBtn.style.display = 'none';
        }

        const response = await db.getSalaryReturns(
            page,
            pageSize,
            this.salarySearchQuery,
            this.salaryAttachmentFilterValue,
            this.salaryUploadDateFrom,
            this.salaryUploadDateTo,
            this.salarySettlementFilterValue,
            this.salaryReturnStatusFilterValue,
            this.salaryMonthFilterValue,
            this.salaryPaymentDateFilterValue
        );

        let appendedSalaryRows = null;
        if (response.data && response.data.length > 0) {
            let dataToUse = response.data.filter(row => row !== null);
            let displayStats = response.stats;

            // Normalize Settlement Status
            dataToUse = dataToUse.map(row => {
                const val = row['رقم تسوية السداد'];
                const hasSettlement = val !== null && val !== undefined && String(val).trim() !== '';
                row['حالة التسوية'] = hasSettlement ? 'تم التسوية' : 'لم يتم التسوية';
                return row;
            });

            dataToUse = this.applySalaryAdabirDateRangeToRows(dataToUse);

            if (append) {
                this.salaryReturnsData = [...this.salaryReturnsData, ...dataToUse];
                appendedSalaryRows = dataToUse;
            } else {
                this.salaryReturnsData = dataToUse;
                this.salaryHeaders = this.extractSalaryHeaders(this.salaryReturnsData);
            }
            this.salaryPagination = response.pagination;
            this.currentDisplayStats = displayStats;
        } else {
            if (!append) {
                this.salaryReturnsData = [];
                if (this.salaryPagination) {
                    this.salaryPagination.total = 0;
                    this.salaryPagination.currentPage = 1;
                }
            }
            this.currentDisplayStats = null;
        }


        const dataToRender = append ? appendedSalaryRows : null;
        this.filteredSalaryReturns = Array.isArray(this.salaryReturnsData) ? [...this.salaryReturnsData] : [];
        this.renderSalaryTable(dataToRender, append);

        // Update Global Stats if this is the initial non-filtered load
        const isFiltered = this.salarySearchQuery || (this.salaryAttachmentFilterValue !== 'all') || (this.salarySettlementFilterValue !== 'all');
        if (!isFiltered && response.stats) {
            this.salaryGlobalStats.count = response.stats.total || response.stats.totalCount || response.stats.filteredCount;
            this.salaryGlobalStats.amount = response.stats.totalAmount;
        }

        this.updateSalaryStats(this.currentDisplayStats || response.stats);
        if (this.getSalaryAdabirDateRangeFilter().active) {
            this.calculateSalaryLocalStats?.(this.salaryReturnsData);
        }
        // ملء فلتر الشهر من البيانات المحملة
        this._populateSalaryReturnFilterOptions(this.salaryReturnsCache || this.salaryReturnsData);
        this.updateSalaryAdabirDateRangeCount(this.salaryReturnsData);
        this.updateBulkSalaryDeleteToolbar();

    } catch (e) {
        console.error('Error loading salary returns:', e);
        this.showToast('خطأ في جلب بيانات المرتبات', 'error');
    }
};

App.prototype.extractSalaryHeaders = function (data) {
    if (!data || data.length === 0) return [];
    const allKeys = new Set();
    const sampleSize = Math.min(data.length, 50);
    for (let i = 0; i < sampleSize; i++) {
        Object.keys(data[i]).forEach(k => {
            allKeys.add(k);
        });
    }
    return Array.from(allKeys).filter(k =>
        k !== 'id' && k !== 'Id' && k !== 'AttachmentCount' &&
        k !== 'importId' && !k.startsWith('_')
    );
};

App.prototype.getSalaryTableHeaders = function (options = {}) {
    const headers = [
        '#',
        'كود الملف',
        'الشهر',
        'الاسم',
        'الرقم القومي',
        'رقم الحساب',
        'البنك',
        'قيمة العملية',
        'الحالة',
        'السبب',
        'رقم الحساب بعد التعديل',
        'البنك بعد التعديل',
        'كود الفرع بعد التعديل',
        'تاريخ الرفع',
        'رقم تسوية التعلية',
        'تاريخ المرتد / تاريخ التعلية',
        'تاريخ اعتماد المرتدات',
        'تاريخ التعديل',
        'تاريخ اعتماد التعديل',
        'رقم تسوية السداد',
        'تاريخ اعتماد التعديل / تاريخ السداد',
        'حالة التسوية'
    ];
    if (options.includeSelection) headers.unshift('_selection_');
    if (options.includeActions) headers.push('الإجراءات');
    return headers;
};

App.prototype.getSalaryField = function (row, fieldName, fallbacks = []) {
    if (!row) return '';
    const keys = [fieldName, ...fallbacks].filter(Boolean).map(k => String(k).toLowerCase().trim());
    for (const key of keys) {
        const foundKey = Object.keys(row).find(k => k.toLowerCase().trim() === key);
        if (foundKey) {
            const value = row[foundKey];
            if (value !== null && value !== undefined && String(value).trim() !== '') {
                return value;
            }
        }
    }
    return '';
};

App.prototype.getSalaryCellValue = function (row, header, rowIndex = 0, options = {}) {
    if (row && this._applyDerivedSettlementStatus) this._applyDerivedSettlementStatus(row);
    const offset = Number(options.offset || 0);
    let val = this.getSalaryField(row, header);

    if (header === '#') {
        const seq = offset + rowIndex + 1;
        return { html: String(seq), raw: String(seq) };
    }

    if (header === 'كود الملف') {
        val = this.getSalaryField(row, 'كود الملف', ['كـــود الملف', 'كُـــود المـلف', 'كود_الملف', 'FileCode', 'ReturnCode', 'Instruction Identification', 'InstructionIdentification', 'Batch ID', 'BatchID']);
    } else if (header === 'الشهر') {
        const fileCode = this.getSalaryField(row, 'كود الملف', ['كـــود الملف', 'كُـــود المـلف', 'كود_الملف', 'FileCode', 'ReturnCode', 'Instruction Identification', 'InstructionIdentification', 'Batch ID', 'BatchID']);
        val = this.extractMonthFromFileCode(fileCode || '');
    } else if (header === 'الاسم') {
        val = this.getSalaryField(row, 'الاسم', ['الاسم ', 'الإسم', 'Name', 'FullName', 'Creditor Name', 'CreditorName', 'Beneficiary Name', 'BeneficiaryName']);
    } else if (header === 'الرقم القومي') {
        val = this.getSalaryField(row, 'الرقم القومي', ['الرقم_القومي', 'رقم قومي', 'NationalId', 'NID', 'Creditor National ID', 'CreditorNationalID', 'National ID']);
        if (!val) {
            for (const key in row) {
                const lowKey = key.toLowerCase();
                if ((lowKey.includes('national') || lowKey.includes('nid') || key.includes('قومي')) && row[key]) {
                    val = row[key];
                    break;
                }
            }
        }
    } else if (header === 'رقم الحساب') {
        val = this.getSalaryField(row, 'رقم الحساب', ['رقم الحساب القديم', 'AccountNumber', 'Account', 'OldAccount', 'Creditor Account Number', 'CreditorAccountNumber', 'Account Number']);
    } else if (header === 'البنك') {
        val = this.getSalaryField(row, 'البنك', ['اسم البنك', 'Bank', 'BankName', 'Creditor Party Bic', 'CreditorPartyBic', 'BIC', 'BankCode', 'كود البنك']);
    } else if (header === 'قيمة العملية') {
        val = this.getSalaryField(row, 'قيمة العملية', ['المبلغ', 'القيمة', 'Amount', 'Transaction Amount', 'TransactionAmount', 'Value', 'Transaction Value']);
    } else if (header === 'الحالة') {
        val = this.getSalaryField(row, 'الحالة', ['حالة الارتداد', 'Status', 'ReturnStatus', 'Transaction Status', 'TransactionStatus', 'ISOStatus Description', 'ISOStatusDescription']);
    } else if (header === 'السبب') {
        val = this.getSalaryField(row, 'السبب', ['سبب الارتجاع', 'Reason', 'RejectReason', 'Transaction ISoStatus Reason', 'TransactionISoStatusReason']);
    } else if (header === 'تاريخ الرفع') {
        val = this.getSalaryField(row, 'UploadDate', ['تاريخ الرفع', 'uploadDate', 'CreatedAt']);
    } else if (header === 'تاريخ المرتد / تاريخ التعلية') {
        val = this.getSalaryField(row, 'تاريخ المرتد / تاريخ التعلية', ['تاريخ المرتد', 'تاريخ المرتدات', 'Batch Settlement Date', 'BatchSettlementDate', 'تاريخ التعلية', 'ReturnDate']);
    } else if (header === 'تاريخ اعتماد التعديل / تاريخ السداد') {
        val = this.getSalaryField(row, 'تاريخ اعتماد التعديل / تاريخ السداد', ['تاريخ السداد', 'تاريخ اعتماد التعديل', 'تاريخ اعتماد المرتدات', 'SettlementDate']);
    } else if (header === 'حالة التسوية') {
        const actualVal = String(this.getSalaryField(row, 'حالة التسوية') || '').trim();
        if (actualVal === 'تم التسوية' || actualVal === 'تمت التسوية') {
            return { html: '<span class="badge-status success">تم التسوية ✅</span>', raw: 'تم التسوية' };
        }
        if (actualVal === 'لم يتم التسوية') {
            return { html: '<span class="badge-status pending">لم يتم التسوية ⏳</span>', raw: 'لم يتم التسوية' };
        }
        return { html: this.escapeHtml(actualVal), raw: actualVal };
    }

    if ((header.includes('تاريخ') || header.includes('Date')) && val) {
        val = this.formatDate(val);
    }

    if (header === 'قيمة العملية' && val !== null && val !== undefined && String(val).trim() !== '') {
        const num = this.parseAmount(val);
        if (!isNaN(num)) {
            return {
                html: `<span class="${num >= 0 ? 'amount-positive' : 'amount-negative'}">${num.toLocaleString()}</span>`,
                raw: num.toLocaleString()
            };
        }
    }

    const raw = String(val ?? '');
    return { html: this.escapeHtml(raw), raw };
};

App.prototype.getSalaryColumnClasses = function (header) {
    const hNorm = String(header || '').replace(/ـ/g, '').replace(/[أإآ]/g, 'ا').toLowerCase();
    const isNameCol = hNorm.includes('الاسم') || hNorm.includes('name') || hNorm.includes('fullname');
    let classes = [];
    if (header === '#') classes.push('sticky-seq', 'col-id');
    else if (isNameCol) classes.push('sticky-name', 'col-name');
    else if (String(header).includes('قيمة العملية') || String(header).includes('المبلغ')) classes.push('sticky-amount', 'col-amount');
    return { classes, isNameCol };
};

App.prototype.renderSalaryTable = function (dataToRender = null, append = false) {
    const data = dataToRender || this.salaryReturnsData;
    const tableHeaders = document.getElementById('salary-returns-head');
    const tableBody = document.getElementById('salary-returns-body');

    if (!append) {
        if (!data || data.length === 0) {
            tableHeaders.innerHTML = '';
            tableBody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding: 20px;">لا توجد بيانات بمرتادات المرتبات</td></tr>';
            return;
        }

        const finalSalaryOrder = this.getSalaryTableHeaders({ includeSelection: true });

        tableHeaders.innerHTML = '<tr>' + finalSalaryOrder.map(h => {
            if (h === '_selection_') {
                const isAllSelected = this.isAllSalaryReturnsSelected || (this.salaryReturnsData && this.salaryReturnsData.length > 0 && this.salaryReturnsData.every(r => this.selectedSalaryReturnIds.has(String(r.id || r.Id))));
                return `<th class="sci-fi-th sticky-seq" style="width: 40px; text-align: center;">
                            <input type="checkbox" id="select-all-salary-returns"
                                class="custom-checkbox-pro"
                                ${isAllSelected ? 'checked' : ''}
                                onchange="app.toggleSelectAllSalaryReturns(this.checked)">
                        </th>`;
            }

            const { classes } = this.getSalaryColumnClasses(h);
            return `<th class="sci-fi-th ${classes.join(' ')}">${h}</th>`;
        }).join('') + '<th class="sci-fi-th col-actions" style="text-align:center;">الإجراءات</th></tr>';
        tableBody.innerHTML = '';
        this._displaySalaryHeaders = finalSalaryOrder;
    }

    const previousRowCount = append ? (document.getElementById('salary-returns-body')?.querySelectorAll('tr').length || 0) : 0;

    // تحسين الأداء: تجهيز التعبير النمطي مرة واحدة للرندر بالكامل
    let searchRegex = null;
    if (this.salarySearchQuery && String(this.salarySearchQuery).trim().length > 0) {
        const normalizedQuery = this.normalizeArabic(this.salarySearchQuery);
        const words = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
        if (words.length > 0) {
            const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
            searchRegex = new RegExp(`(${pattern})`, 'gi');
        }
    }

    const rowsHTML = data.map((row, rowIndex) => {
        try {
            if (!row) return '';
            const rowId = row.id || row.Id;
            const cells = (this._displaySalaryHeaders || this.salaryHeaders).map(h => {
                if (h === '_selection_') {
                    const isChecked = this.isAllSalaryReturnsSelected || this.selectedSalaryReturnIds.has(String(rowId));
                    return `<td class="sci-fi-td sticky-seq" style="text-align:center;">
                                <input type="checkbox" class="salary-row-checkbox custom-checkbox-pro"
                                    value="${rowId}" ${isChecked ? 'checked' : ''}
                                    onchange="app.toggleSalaryReturnSelection('${rowId}', this.checked)">
                            </td>`;
                }

                const cell = this.getSalaryCellValue(row, h, rowIndex, { offset: previousRowCount });
                let val = cell.html;
                let rawVal = cell.raw;

                // تطبيق التلوين على كل الحقول النصية (بما فيها الاسم) إذا تطابقت مع البحث
                if (searchRegex && h !== '#' && h !== '_selection_' && !h.includes('<input') && h !== 'حالة التسوية') {
                    if (rawVal && String(rawVal).length < 500 && !String(val).includes('<')) {
                        val = String(rawVal).replace(searchRegex, '<span class="search-highlight">$1</span>');
                    }
                }

                const { classes, isNameCol } = this.getSalaryColumnClasses(h);
                if (isNameCol) classes.push('clickable-name');

                let dblclickEvent = '';
                if (isNameCol && rawVal && rawVal.trim() !== '') {
                    const escapedVal = String(rawVal).replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    dblclickEvent = ` ondblclick="window.app.triggerNameSearch('${escapedVal}')" title="انقر مرتين للبحث السريع عن هذا الاسم" style="cursor: pointer;"`;
                }

                return `<td class="${classes.join(' ')}"${dblclickEvent}>${val}</td>`;
            }).join('');

            const hasAttachments = row.AttachmentCount > 0;
            const btnClass = hasAttachments ? 'btn-primary' : 'btn-secondary';
            const icon = hasAttachments ? '🖼️' : '📎';
            const badge = hasAttachments ? `<span class="badge-count" style="background:#ef4444; color:white; border-radius:12px; padding:2px 8px; font-size:0.75em; position:absolute; top:-12px; right:-12px; font-weight:bold; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4); border: 1.5px solid #fff;">${row.AttachmentCount}</span>` : '';
            const style = hasAttachments ? 'position: relative; border: 1px solid #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.5); transform: scale(1.05); transition: all 0.2s ease;' : 'position: relative; opacity: 0.6;';

            const actions = `<td class="col-actions" style="text-align:center; white-space: nowrap;">
                <button class="btn-icon ${btnClass}" style="margin-left:5px; ${style}" onclick="window.app.openAttachmentsModal('${rowId}', 'salary')" title="${hasAttachments ? 'عرض ' + row.AttachmentCount + ' مرفقات' : 'إضافة مرفق'}">
                    ${icon} ${badge}
                </button>
                <button class="btn-icon" style="margin-left:5px;" onclick="window.app.editSalaryReturn('${rowId}')" title="تعديل السجل">✏️</button>
                <button class="btn-icon" style="margin-left:5px;" onclick="window.app.openSalaryReturnFolder('${rowId}')" title="فتح مجلد المرفقات">📂</button>
                <button class="btn-icon" style="color: #f87171;" onclick="window.app.deleteSalaryReturn('${rowId}')" title="حذف السجل">🗑️</button>
            </td>`;

            return `<tr>${cells}${actions}</tr>`;
        } catch (err) {
            console.error('Error rendering salary row:', err);
            return '<tr><td colspan="12" style="color:red;">خطأ في عرض هذا السجل</td></tr>';
        }
    }).join('');

    if (append) {
        tableBody.insertAdjacentHTML('beforeend', rowsHTML);
    } else {
        tableBody.innerHTML = rowsHTML;
    }

    // Setup pagination UI
    if (!append && this.salaryPagination) {
        const pElem = document.getElementById('salary-pagination');
        if (pElem) {
            const p = this.salaryPagination;
            let html = '';
            if (p.hasPreviousPage) html += `<button class="btn btn-secondary btn-sm" onclick="app.loadSalaryReturns(${p.currentPage - 1})">السابق</button>`;
            html += `<span style="margin:0 15px;">صفحة ${p.currentPage} من ${p.totalPages}</span>`;
            if (p.hasNextPage) html += `<button class="btn btn-secondary btn-sm" onclick="app.loadSalaryReturns(${p.currentPage + 1})">التالي</button>`;
            pElem.innerHTML = html;
        }
    }

    // Always ensure infinite scroll listener is attached after rendering
    this.setupSalaryInfiniteScroll();
};

App.prototype.toggleSelectAllSalaryReturns = function (checked) {
    document.querySelectorAll('.salary-row-checkbox').forEach(cb => cb.checked = checked);
    this.updateSelectAllSalaryReturns();
};

App.prototype.updateSelectAllSalaryReturns = function () {
    const total = document.querySelectorAll('.salary-row-checkbox').length;
    const checked = document.querySelectorAll('.salary-row-checkbox:checked').length;

    const selectAllCb = document.getElementById('selectAllSalaryCheckbox');
    if (selectAllCb) {
        selectAllCb.checked = (total > 0 && total === checked);
        selectAllCb.indeterminate = (checked > 0 && checked < total);
    }

    const deleteBtn = document.getElementById('btn-salary-delete-selected');
    const deleteBadge = document.getElementById('salary-selected-count-badge');
    const settleBtn = document.getElementById('btn-salary-settle-selected');
    const settleBadge = document.getElementById('salary-settle-selected-count-badge');

    if (checked > 0) {
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
        if (deleteBadge) deleteBadge.textContent = checked;
        if (settleBtn) settleBtn.style.display = 'inline-block';
        if (settleBadge) settleBadge.textContent = checked;
    } else {
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (settleBtn) settleBtn.style.display = 'none';
    }
};

App.prototype.settleSelectedSalaryReturns = async function () {
    const checkedBoxes = document.querySelectorAll('.salary-row-checkbox:checked');
    if (checkedBoxes.length === 0) return;

    const date = new Date().toLocaleDateString('en-GB').split('/').reverse().join('-'); // yyyy-mm-dd
    const promptDate = await this.dialog.show({
        title: 'تأكيد التسوية الجماعية',
        message: `سيتم تسوية عدد (${checkedBoxes.length}) سجل من المرتبات بتاريخ اليوم (${date}). هل تريد المتابعة؟`,
        type: 'question',
        showCancel: true
    });

    if (promptDate) {
        this.showLoading();
        try {
            const ids = Array.from(checkedBoxes).map(cb => parseInt(cb.value));

            const result = await db.fetchApi('/salary-returns/settle', {
                method: 'POST',
                body: JSON.stringify({
                    ids: ids,
                    settlementDate: date
                })
            });

            if (result.success) {
                this.showToast(`تم تسوية ${result.count} سجل بنجاح`, 'success');
                await this.loadSalaryReturns();
            } else {
                this.showToast(result.error || 'فشل تنفيذ عملية التسوية', 'error');
            }
        } catch (err) {
            console.error('Settlement Error:', err);
            this.showToast('حدث خطأ أثناء الاتصال بالسيرفر', 'error');
        } finally {
            this.hideLoading();
        }
    }
};

App.prototype.deleteSelectedSalaryReturns = async function () {
    const checkedBoxes = document.querySelectorAll('.salary-row-checkbox:checked');
    if (checkedBoxes.length === 0) return;

    const isConfirm = await window.confirm(`هل أنت متأكد من أرشفة ${checkedBoxes.length} سجل من المرتبات؟ سيتم إخفاؤها من هنا وبقاؤها في الأرشيف.`);
    if (isConfirm) {
        const ids = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
        this._removeRowsFromMemory('salary', ids);
        const btn = document.getElementById('btn-salary-delete-selected');
        if (btn) btn.style.display = 'none';
        this.showToast('تم تحديث البيانات على الشاشة', 'success');
        this._deleteRowsInBackground(
            'salary',
            ids,
            deleteId => db.deleteSalaryReturn(deleteId),
            {
                label: 'أرشفة سجلات المرتبات',
                progressMessage: 'جاري أرشفة سجلات المرتبات في الخلفية...',
                successMessage: 'تم تحديث البيانات',
                errorMessage: 'تعذر أرشفة بعض سجلات المرتبات'
            }
        );
        return;

        /*
        this.showLoading();
        try {
            const ids = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
            for (const id of ids) {
                await db.deleteSalaryReturn(id);
            }
            this.showToast('تم نقل السجلات للأرشيف بنجاح', 'success');
            await this.loadSalaryReturns();

            const btn = document.getElementById('btn-salary-delete-selected');
            if (btn) btn.style.display = 'none';
        } catch (e) {
            this.showToast('حدث خطأ أثناء الحذف', 'error');
        } finally {
            this.hideLoading();
        }
        */
    }
};

App.prototype.showSalaryAutoSyncModal = function () {
    this.isSalarySync = true;
    this.showAutoSyncModal();
};

// تم حذف النسخة المكررة لضمان استخدام النسخة الموحدة في بداية الملف

App.prototype.printSalaryReport = function () {
    // فتح نفس نافذة الخيارات لتوحيد التجربة
    const modal = document.getElementById('report-options-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('report-search-name')?.focus();
    }
};


App.prototype.showSalaryExtractionModal = function () {
    this.isSalaryExtraction = true;
    this.showExtractionModal();
};


App.prototype.runSalaryValidationOnCurrentData = async function () {
    const progressContainer = document.getElementById('salary-print-prep-progress');
    const progressText = progressContainer?.querySelector('.print-progress-text');

    if (progressContainer) {
        progressContainer.classList.remove('hidden');
        if (progressText) progressText.textContent = 'جاري جلب بيانات المرتبات للفحص...';
        setTimeout(() => progressContainer.classList.add('animating'), 10);
    }

    try {
        this.isSalaryImport = true;
        const allData = await db.getAllSalaryReturns(this.salarySearchQuery, this.salaryAttachmentFilterValue);

        if (!allData || allData.length === 0) {
            this.showToast('لا توجد بيانات مرتبات للفحص', 'warning');
            if (progressContainer) {
                progressContainer.classList.remove('animating');
                progressContainer.classList.add('hidden');
            }
            return;
        }

        if (progressText) progressText.textContent = `جاري فحص ${allData.length} سجل مرتبات...`;
        await new Promise(r => setTimeout(r, 500));

        this._validationService = new ValidationService();
        const validationResult = this._validationService.validate(allData, this.salaryReturnsCache || []);

        this.populateValidationModal(validationResult);
        this.showValidationResultsPage(validationResult);

        this.pendingAllData = allData;
        this.pendingValidData = validationResult.validRecords;
        this.pendingFile = { name: `فحص_المرتبات_${new Date().toISOString().slice(0, 10)}.xlsx`, size: 0 };

    } catch (error) {
        console.error('Salary Validation Error:', error);
        this.showToast('حدث خطأ أثناء فحص المرتبات', 'error');
        if (progressContainer) {
            progressContainer.classList.remove('animating');
            progressContainer.classList.add('hidden');
        }
    }
};

App.prototype.handleSalaryAttachmentFilterChange = async function () {
    const val = document.getElementById('salary-attachment-filter')?.value || 'all';
    this.salaryAttachmentFilterValue = val;
    this.salaryCurrentPage = 1;
    await this.loadSalaryReturns(1, 200, this.salarySearchQuery);
};

App.prototype.handleSalaryUploadDateSelectChange = async function (val) {
    this.salaryCurrentPage = 1;
    await this.loadSalaryReturns();
};

App.prototype.handleSalaryReturnStatusFilterChange = async function (val) {
    this.salaryReturnStatusFilterValue = val;
    this.salaryCurrentPage = 1;
    await this.loadSalaryReturns(1, 50, this.salarySearchQuery);
};

App.prototype.handleSalarySettlementFilterChange = async function (val) {
    this.salarySettlementFilterValue = val;
    this.salaryCurrentPage = 1;
    await this.loadSalaryReturns(1, 50, this.salarySearchQuery);
};

App.prototype.handleSalaryMonthFilterChange = async function (val) {
    this.salaryMonthFilterValue = val;
    this.salaryCurrentPage = 1;
    await this.loadSalaryReturns(1, 50, this.salarySearchQuery);
};

App.prototype.updateSalaryStats = function (stats) {
    if (!stats) return;

    const formatNum = (val) => (val || 0).toLocaleString();
    const formatCurr = (val) => (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const updateText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    const hasActiveFilter = Boolean(
        (this.salarySearchQuery && String(this.salarySearchQuery).trim()) ||
        (this.salaryAttachmentFilterValue && this.salaryAttachmentFilterValue !== 'all') ||
        (this.salarySettlementFilterValue && this.salarySettlementFilterValue !== 'all') ||
        (this.salaryReturnStatusFilterValue && this.salaryReturnStatusFilterValue !== 'all') ||
        (this.salaryMonthFilterValue && this.salaryMonthFilterValue !== 'all') ||
        (this.salaryPaymentDateFilterValue && this.salaryPaymentDateFilterValue !== 'all') ||
        this.salaryUploadDateFrom ||
        this.salaryUploadDateTo
    );

    updateText('salary-count', formatNum(hasActiveFilter ? (stats.filteredCount || stats.totalCount || stats.total) : (this.salaryGlobalStats.count || stats.systemTotalCount || stats.totalCount || stats.total)));
    updateText('salary-amount', formatCurr(hasActiveFilter ? stats.totalAmount : (this.salaryGlobalStats.amount || stats.totalAmount)));
    updateText('salary-settled-count', formatNum(stats.successCount || stats.settled));
    updateText('salary-settled-amount', formatCurr(stats.settledAmount));
    updateText('salary-open-count', formatNum(stats.pendingCount || stats.pending));
    updateText('salary-open-amount', formatCurr(stats.pendingAmount));

    const infoEl = document.getElementById('salary-showing');
    if (infoEl && this.salaryPagination) {
        const start = (this.salaryPagination.currentPage - 1) * this.salaryPagination.itemsPerPage + 1;
        const total = this.salaryPagination.total || 0;
        const end = Math.min(this.salaryPagination.currentPage * this.salaryPagination.itemsPerPage, total);
        infoEl.textContent = total > 0 ? `يعرض ${start.toLocaleString()} - ${end.toLocaleString()} من أصل ${total.toLocaleString()}` : 'يعرض 0 من 0';
    }
};

App.prototype.applySalaryFilter = function () {
    this.salaryCurrentPage = 1;
    this.salarySearchQuery = document.getElementById('salary-search')?.value || '';
    this.loadSalaryReturns();
};

App.prototype.populateSalaryReturnsCache = async function () {
    await this._syncDataset('salary', { force: true, skipCheck: true });
};

/**
 * دالة مساعدة لاستخراج الشهر من كود الملف (تدعم مختلف التنسيقات)
 */
App.prototype.extractMonthFromFileCode = function (fileCode) {
    if (!fileCode) return 'فارغ';
    const cleanCode = String(fileCode).replace(/\/+$/, '').trim();
    if (!cleanCode || cleanCode === '---') return 'فارغ';

    const format = (month, year) => {
        const m = Number(month);
        const y = String(year || '').trim();
        if (!Number.isInteger(m) || m < 1 || m > 12 || !/^\d{4}$/.test(y)) return null;
        return `${String(m).padStart(2, '0')}-${y}`;
    };
    const collect = (regex, mapper) => {
        const items = [];
        for (const match of cleanCode.matchAll(regex)) {
            const value = mapper(match);
            if (value) items.push({ index: match.index ?? 0, value });
        }
        return items;
    };

    const fullDates = [
        ...collect(/(?:^|[^\d])(\d{4})\d*[-/](\d{1,2})[-/](\d{1,2})(?=$|[^\d])/g, m => format(m[2], m[1])),
        ...collect(/(?:^|[^\d])(\d{1,2})[-/](\d{1,2})[-/](\d{4})\d*(?=$|[^\d])/g, m => format(m[2], m[3]))
    ].sort((a, b) => a.index - b.index);
    if (fullDates.length) return fullDates[fullDates.length - 1].value;

    const monthYears = [
        ...collect(/(?:^|[^\d])(\d{4})\d*[-/](\d{1,2})(?=$|[^\d])/g, m => format(m[2], m[1])),
        ...collect(/(?:^|[^\d])(0?[1-9]|1[0-2])[-/](\d{4})\d*(?=$|[^\d])/g, m => format(m[1], m[2]))
    ].sort((a, b) => a.index - b.index);
    return monthYears.length ? monthYears[monthYears.length - 1].value : 'فارغ';
};

App.prototype.handleLocalSalarySearch = function (search, attachmentStatus, page, pageSize = 200, append) {
    if (!this.salaryReturnsCache) return;

    console.time('[PERF] Local Salary Search');

    const searchQuery = search && String(search).trim() !== '' ? this.normalizeArabic(search) : null;
    console.log('[LOCAL SALARY SEARCH] Logic Start:', { search, searchQuery });
    const searchWords = searchQuery ? searchQuery.split(/\s+/).filter(w => w.length > 0) : [];

    const selectedMonth = this.salaryMonthFilterValue && this.salaryMonthFilterValue !== 'all' ? this.salaryMonthFilterValue : null;
    const settlementMode = this.salarySettlementFilterValue && this.salarySettlementFilterValue !== 'all' && this.salarySettlementFilterValue !== 'الكل' ? this.salarySettlementFilterValue.trim() : null;
    const returnStatusMode = this.salaryReturnStatusFilterValue && this.salaryReturnStatusFilterValue !== 'all' && this.salaryReturnStatusFilterValue !== 'الكل' ? this.salaryReturnStatusFilterValue : null;
    const attachMode = attachmentStatus && attachmentStatus !== 'all' ? attachmentStatus : null;
    const uploadDateFilterVal = document.getElementById('salary-upload-date-filter')?.value || 'all';
    const paymentDateMode = this.salaryPaymentDateFilterValue && this.salaryPaymentDateFilterValue !== 'all' ? this.salaryPaymentDateFilterValue : null;
    const salaryAdabirRange = this.getSalaryAdabirDateRangeFilter();

    const fileCodeKeys = ['كـــود الملف', 'كود الملف', 'كُـــود المـلف', 'كـــود المـلف', 'FileCode', 'كود_الملف'];

    const filtered = this.salaryReturnsCache.filter(row => {
        if (searchWords.length > 0) {
            const rowStr = row._searchStr || "";
            const originalSearchWords = (search || "").toLowerCase().split(/\s+/).filter(w => w.length > 0);
            const searchTotal = (search || "").toLowerCase().trim();

            // High Priority: Exact phrase match (Normalized or Original)
            const matchPhrase = rowStr.includes(searchQuery) || rowStr.includes(searchTotal);

            if (!matchPhrase) {
                // Fallback Priority: Word-by-word matching
                // We restrict this for long queries (> 2 words) to avoid broad results in name searches
                if (searchWords.length > 2) return false;

                const matchNormalized = searchWords.every(word => rowStr.includes(word));
                const matchOriginal = originalSearchWords.every(word => rowStr.includes(word));
                if (!matchNormalized && !matchOriginal) return false;
            }
        }

        if (selectedMonth && this._getSalaryMonthFilterValue(row) !== selectedMonth) return false;

        if (false && selectedMonth) {
            let monthVal = 'فارغ';
            // 1. البحث في أعمدة البيانات الأصلية
            for (const k of Object.keys(row)) {
                if (k.includes('شهر') || k.includes('الشهر') || k.toLowerCase().includes('month')) {
                    if (row[k] !== null && row[k] !== undefined && String(row[k]).trim() !== '') {
                        monthVal = String(row[k]).trim();
                        break;
                    }
                }
            }
            // 2. استخدام القيمة المستخرجة مسبقاً أو الاستخراج الفوري
            if (monthVal === 'فارغ') {
                monthVal = row._monthExtracted || this.extractMonthFromFileCode(this.findValue(row, fileCodeKeys));
            }

            if (monthVal !== selectedMonth) return false;
        }

        if (settlementMode) {
            const actualVal = (row['حالة التسوية'] || '').trim();
            const matched = (actualVal === settlementMode) ||
                            (settlementMode === 'تمت التسوية' && actualVal === 'تم التسوية') ||
                            (settlementMode === 'تم التسوية' && actualVal === 'تمت التسوية');
            if (!matched) return false;
        }

        if (returnStatusMode) {
            const status = (row['الحالة'] || row['Status'] || '').toLowerCase();
            if (!status.includes(returnStatusMode.toLowerCase())) return false;
        }

        if (attachMode) {
            const hasAttach = (row.AttachmentCount || 0) > 0;
            if (attachMode === 'yes' && !hasAttach) return false;
            if (attachMode === 'no' && hasAttach) return false;
        }

        if (uploadDateFilterVal && uploadDateFilterVal !== 'all') {
            let dateVal = String(row['تاريخ الرفع'] || row.UploadDate || '').trim();
            if (dateVal.length >= 10) dateVal = dateVal.substring(0, 10);
            if (uploadDateFilterVal === 'فارغ') {
                if (dateVal) return false;
            } else {
                if (dateVal !== uploadDateFilterVal) return false;
            }
        }

        if (paymentDateMode) {
            const selectedPaymentDate = this._normalizeSalaryPaymentDateFilterValue(paymentDateMode);
            const paymentVal = this._getSalaryPaymentDateFilterValue(row);
            if (selectedPaymentDate === 'فارغ') {
                if (paymentVal) return false;
            } else if (paymentVal !== selectedPaymentDate) {
                return false;
            }
        }

        if (salaryAdabirRange.active && !this.isMonthWithinDateRange(this._getSalaryMonthFilterValue(row), salaryAdabirRange.from, salaryAdabirRange.to)) {
            return false;
        }

        return true;
    });

        // Priority Sorting: Bring exact phrase matches to the top
        const sortQ = searchQuery || (search || "").toLowerCase().trim();
        if (sortQ) {
            filtered.sort((a, b) => {
                const aExact = (a._searchStr || "").includes(sortQ);
                const bExact = (b._searchStr || "").includes(sortQ);
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                return 0;
            });
        }

        console.timeEnd('[PERF] Local Salary Search');
        console.log(`[LOCAL SALARY SEARCH] Found ${filtered.length} matches.`);

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const pagedData = filtered.slice(start, start + pageSize);

    if (!append) {
        this.salaryReturnsData = pagedData;
        this.filteredSalaryReturns = filtered;
        this.salaryHeaders = this.extractSalaryHeaders(this.salaryReturnsData);
        this.salaryPagination = {
            currentPage: page,
            totalPages: totalPages,
            itemsPerPage: pageSize,
            total: total,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
        };
        this.salarySearchQuery = search;
    }

    this.renderSalaryTable(append ? pagedData : null, append);
    this.calculateLocalSalaryStats(filtered);
        this._populateSalaryReturnFilterOptions(this.salaryReturnsCache || filtered);
    this.updateSalaryAdabirDateRangeCount(filtered);

    return filtered.length;
};

App.prototype.calculateLocalSalaryStats = function (filtered) {
    let totalAmount = 0;
    let rejectedAmount = 0;
    let returnedAmount = 0;
    let openAmount = 0;
    let settledAmount = 0;

    let rejectedCount = 0;
    let returnedCount = 0;
    let successCount = 0;
    let pendingCount = 0;
    let openCount = 0;
    let settledCount = 0;

    if (!filtered || filtered.length === 0) {
        this.updateSalaryStats({ systemTotalCount: this.salaryReturnsCache ? this.salaryReturnsCache.length : 0 });
        return;
    }

    filtered.forEach(obj => {
        const rowAmount = obj._amount || 0;
        totalAmount += rowAmount;

        const status = obj._normStatus || '';
        const actualSettle = (obj['حالة التسوية'] || '').trim();
        const isSettled = actualSettle === 'تم التسوية' || actualSettle === 'تمت التسوية';

        if (status.includes('مرفوض') || status.includes('reject')) {
            rejectedCount++;
            rejectedAmount += rowAmount;
        } else if (status.includes('مرتد') || status.includes('return')) {
            returnedCount++;
            returnedAmount += rowAmount;
        } else if (status.includes('ناجح') || status.includes('success')) {
            successCount++;
        } else if (status.includes('انتظار') || status.includes('pending')) {
            pendingCount++;
        }

        if (isSettled) {
            settledCount++;
            settledAmount += rowAmount;
        } else {
            openCount++;
            openAmount += rowAmount;
        }
    });

    this.updateSalaryStats({
        systemTotalCount: this.salaryReturnsCache ? this.salaryReturnsCache.length : filtered.length,
        filteredCount: filtered.length,
        totalAmount,
        settledAmount,
        pendingAmount: openAmount,
        returnedCount,
        rejectedCount,
        successCount: settledCount,
        pendingCount: openCount
    });
};

App.prototype._getSalaryMonthFilterValue = function(row) {
    if (!row) return 'فارغ';
    const raw = row['الشهر'] ?? row['شهر'] ?? row.Month ?? row.month ?? '';
    const direct = String(raw ?? '').trim();
    if (direct) {
        const normalized = this.normalizeMonthText(direct);
        if (normalized !== 'فارغ') return normalized;
    }

    const fileCode = this.findValue
        ? (this.findValue(row, ['كود الملف', 'كـــود الملف', 'FileCode', 'كود_الملف', 'ReturnCode', 'Instruction Identification', 'InstructionIdentification', 'Batch ID', 'BatchID']) || row.ReturnCode || '')
        : (row['كود الملف'] || row.ReturnCode || '');
    const extracted = this.extractMonthFromFileCode ? this.extractMonthFromFileCode(fileCode) : '';
    const value = String(extracted || '').trim();
    return value && value !== 'فارغ' ? value : 'فارغ';
};

App.prototype._normalizeSalaryPaymentDateFilterValue = function(value) {
    const raw = value === null || value === undefined ? '' : String(value).trim();
    if (!raw || raw === 'all') return '';
    if (raw === 'فارغ') return 'فارغ';

    const parsed = this.parseFlexibleDate ? this.parseFlexibleDate(raw) : null;
    if (parsed instanceof Date && !isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const formatted = this.formatDate ? this.formatDate(raw) : raw;
    if (formatted && formatted !== raw) {
        const parsedFormatted = this.parseFlexibleDate ? this.parseFlexibleDate(formatted) : null;
        if (parsedFormatted instanceof Date && !isNaN(parsedFormatted.getTime())) {
            const y = parsedFormatted.getFullYear();
            const m = String(parsedFormatted.getMonth() + 1).padStart(2, '0');
            const d = String(parsedFormatted.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    }

    return raw.length >= 10 ? raw.substring(0, 10) : raw;
};

App.prototype._getSalaryPaymentDateFilterValue = function(row) {
    if (!row) return '';
    const val = row['تاريخ اعتماد التعديل / تاريخ السداد'] ||
        row['تاريخ السداد'] ||
        row['تاريخ اعتماد التعديل'] ||
        row['تاريخ اعتماد المرتدات'] ||
        row.SettlementDate ||
        '';
    return this._normalizeSalaryPaymentDateFilterValue(val);
};

App.prototype._getSalaryPaymentDateFilterValue = function(row) {
    if (!row) return "";
    const val =
        row['\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0639\u062a\u0645\u0627\u062f\u0020\u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0020\u002f\u0020\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0644\u0633\u062f\u0627\u062f'] ||
        row['\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0644\u0633\u062f\u0627\u062f'] ||
        row['\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0639\u062a\u0645\u0627\u062f\u0020\u0627\u0644\u062a\u0639\u062f\u064a\u0644'] ||
        row['\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0639\u062a\u0645\u0627\u062f\u0020\u0627\u0644\u0645\u0631\u062a\u062f\u0627\u062a'] ||
        row.SettlementDate ||
        row['Settlement Date'] ||
        "";
    return this._normalizeSalaryPaymentDateFilterValue(val);
};

App.prototype._populateSalaryReturnFilterOptions = function(rows = null) {
    const cacheRows = Array.isArray(this.salaryReturnsCache) && this.salaryReturnsCache.length ? this.salaryReturnsCache : null;
    // ✅ دائماً نفضّل الـ index لأنه أدق وأسرع
    const indexFilters = this.searchFilterIndex?.salary?.filters;
    if (indexFilters && (indexFilters.statuses?.length || indexFilters.months?.length)) {
        const setOptions = (selectId, options, currentValue) => this._setSelectOptionsFromRows(selectId, options, currentValue);
        const has = (indexFilters.hasAttachments || []).map(Number);
        setOptions('salary-attachment-filter', [
            ...(has.includes(1) ? [{ value: 'yes', label: 'بها مرفقات ✅' }] : []),
            ...(has.includes(0) ? [{ value: 'no', label: 'بدون مرفقات ❌' }] : [])
        ], this.salaryAttachmentFilterValue);
        setOptions('salary-return-status-filter', (indexFilters.statuses || []).map(value => ({ value, label: value })), this.salaryReturnStatusFilterValue);
        setOptions('salary-settlement-filter', [
            { value: 'تمت التسوية', label: 'تمت التسوية' },
            { value: 'لم يتم التسوية', label: 'لم يتم التسوية' }
        ], this.salarySettlementFilterValue);
        setOptions('salary-upload-date-filter', (indexFilters.uploadDates || []).map(value => ({ value, label: value })), document.getElementById('salary-upload-date-filter')?.value || 'all');
        setOptions('salary-month-filter', (indexFilters.months || []).map(value => ({ value, label: value })), this.salaryMonthFilterValue);
        const paymentOptions = [];
        const seenPaymentDates = new Set();
        (indexFilters.paymentDates || []).forEach(value => {
            const normalized = this._normalizeSalaryPaymentDateFilterValue(value);
            if (!normalized || seenPaymentDates.has(normalized)) return;
            seenPaymentDates.add(normalized);
            paymentOptions.push({ value: normalized, label: normalized });
        });
        setOptions('salary-payment-date-filter', paymentOptions.sort((a, b) => b.value.localeCompare(a.value)), this._normalizeSalaryPaymentDateFilterValue(this.salaryPaymentDateFilterValue) || this.salaryPaymentDateFilterValue);
        return;
    }
    const data = cacheRows || (Array.isArray(rows) ? rows : (Array.isArray(this.salaryReturnsData) ? this.salaryReturnsData : []));

    const setOptions = (selectId, options, currentValue) => {
        const select = document.getElementById(selectId);
        if (!select) return;
        const selected = currentValue || select.value || 'all';
        select.innerHTML = '<option value="all">الكل</option>';
        options.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.value;
            opt.textContent = item.label;
            select.appendChild(opt);
        });
        select.value = options.some(item => item.value === selected) ? selected : 'all';
    };

    if (data.length === 0) {
        setOptions('salary-attachment-filter', [], this.salaryAttachmentFilterValue);
        setOptions('salary-return-status-filter', [], this.salaryReturnStatusFilterValue);
        setOptions('salary-settlement-filter', [], this.salarySettlementFilterValue);
        setOptions('salary-upload-date-filter', [], document.getElementById('salary-upload-date-filter')?.value || 'all');
        setOptions('salary-month-filter', [], this.salaryMonthFilterValue);
        setOptions('salary-payment-date-filter', [], this._normalizeSalaryPaymentDateFilterValue(this.salaryPaymentDateFilterValue) || this.salaryPaymentDateFilterValue);
        return;
    }

    const hasAttachments = data.some(row => Number(row.AttachmentCount || row.attachmentCount || 0) > 0);
    const hasNoAttachments = data.some(row => !(Number(row.AttachmentCount || row.attachmentCount || 0) > 0));
    const attachmentOptions = [];
    if (hasAttachments) attachmentOptions.push({ value: 'yes', label: 'بها مرفقات ✅' });
    if (hasNoAttachments) attachmentOptions.push({ value: 'no', label: 'بدون مرفقات ❌' });
    setOptions('salary-attachment-filter', attachmentOptions, this.salaryAttachmentFilterValue);

    const statusSet = new Set();
    const settlementSet = new Set();
    const uploadDateSet = new Set();
    const monthSet = new Set();
    const paymentDateSet = new Set();
    let hasEmptyMonth = false;

    data.forEach(row => {
        const status = String(this.getSalaryField(row, 'الحالة', ['حالة الارتداد', 'Status', 'ReturnStatus', 'Transaction Status', 'TransactionStatus', 'ISOStatus Description', 'ISOStatusDescription']) || '').trim();
        if (status) statusSet.add(status);

        let settlement = String(row['حالة التسوية'] || '').trim();
        if (!settlement) {
            const settlementNo = row['رقم تسوية السداد'];
            settlement = settlementNo !== null && settlementNo !== undefined && String(settlementNo).trim() !== '' ? 'تمت التسوية' : 'لم يتم التسوية';
        }
        if (settlement === 'تم التسوية') settlement = 'تمت التسوية';
        if (settlement) settlementSet.add(settlement);

        const upload = String(this.getSalaryField(row, 'تاريخ الرفع', ['UploadDate', 'uploadDate', 'CreatedAt']) || '').trim();
        if (upload) uploadDateSet.add(upload.length >= 10 ? upload.substring(0, 10) : upload);

        const month = this._getSalaryMonthFilterValue(row);
        if (month === 'فارغ') hasEmptyMonth = true;
        else monthSet.add(month);

        const payment = this._getSalaryPaymentDateFilterValue(row);
        if (payment) paymentDateSet.add(payment);
    });

    setOptions('salary-return-status-filter', Array.from(statusSet).sort().map(value => ({ value, label: value })), this.salaryReturnStatusFilterValue);
    setOptions('salary-settlement-filter', Array.from(settlementSet).sort().map(value => ({ value, label: value })), this.salarySettlementFilterValue);
    setOptions('salary-upload-date-filter', Array.from(uploadDateSet).sort((a, b) => b.localeCompare(a)).map(value => ({ value, label: value })), document.getElementById('salary-upload-date-filter')?.value || 'all');

    const monthOptions = Array.from(monthSet).sort((a, b) => String(b).localeCompare(String(a))).map(value => ({ value, label: value }));
    if (hasEmptyMonth) monthOptions.unshift({ value: 'فارغ', label: 'فارغ' });
    setOptions('salary-month-filter', monthOptions, this.salaryMonthFilterValue);

    setOptions('salary-payment-date-filter', Array.from(paymentDateSet).sort((a, b) => b.localeCompare(a)).map(value => ({ value, label: value })), this._normalizeSalaryPaymentDateFilterValue(this.salaryPaymentDateFilterValue) || this.salaryPaymentDateFilterValue);
};

App.prototype.clearSalaryFilter = function () {
    const search = document.getElementById('salary-search');
    if (search) search.value = '';

    const attachFilter = document.getElementById('salary-attachment-filter');
    if (attachFilter) attachFilter.value = 'all';

    const dateFilter = document.getElementById('salary-upload-date-filter');
    if (dateFilter) dateFilter.value = 'all';

    const statusFilter = document.getElementById('salary-return-status-filter');
    if (statusFilter) statusFilter.value = 'all';

    const settleFilter = document.getElementById('salary-settlement-filter');
    if (settleFilter) settleFilter.value = 'all';

    const monthFilter = document.getElementById('salary-month-filter');
    if (monthFilter) monthFilter.value = 'all';

    const paymentDateFilter = document.getElementById('salary-payment-date-filter');
    if (paymentDateFilter) paymentDateFilter.value = 'all';

    this.salarySearchQuery = '';
    this.salaryAttachmentFilterValue = 'all';
    this.salaryReturnStatusFilterValue = 'all';
    this.salarySettlementFilterValue = 'all';
    this.salaryMonthFilterValue = 'all';
    this.salaryPaymentDateFilterValue = 'all';
    this.salaryCurrentPage = 1;

    this.loadSalaryReturns();
};

App.prototype.handleSalaryAttachmentFilterChange = async function () {
    const val = document.getElementById('salary-attachment-filter')?.value || 'all';
    this.salaryAttachmentFilterValue = val;
    this.salaryCurrentPage = 1;
    await this.loadSalaryReturns();
};

App.prototype.handleSalaryUploadDateSelectChange = async function (val) {
    this.salaryCurrentPage = 1;
    await this.loadSalaryReturns();
};

App.prototype.handleSalaryMonthFilterChange = async function (val) {
    this.salaryMonthFilterValue = val;
    this.salaryCurrentPage = 1;
    await this.loadSalaryReturns();
};

App.prototype.handleSalaryPaymentDateFilterChange = async function (val) {
    this.salaryPaymentDateFilterValue = this._normalizeSalaryPaymentDateFilterValue(val) || 'all';
    this.salaryCurrentPage = 1;
    await this.loadSalaryReturns();
};

App.prototype.handleSalarySettlementFilterChange = async function (val) {
    this.salarySettlementFilterValue = val;
    this.salaryCurrentPage = 1;
    await this.loadSalaryReturns();
};

App.prototype.handleSalaryReturnStatusFilterChange = async function (val) {
    this.salaryReturnStatusFilterValue = val;
    this.salaryCurrentPage = 1;
    await this.loadSalaryReturns();
};

App.prototype.exportSalaryToExcel = async function () {
    this.showLoading();
    try {
        const allData = await db.getAllSalaryReturns(
            this.salarySearchQuery,
            this.salaryAttachmentFilterValue,
            this.salaryUploadDateFrom,
            this.salaryUploadDateTo,
            this.salarySettlementFilterValue,
            this.salaryReturnStatusFilterValue,
            this.salaryMonthFilterValue,
            this.salaryPaymentDateFilterValue
        );

        if (!allData || allData.length === 0) {
            this.showToast('لا توجد بيانات لتصديرها', 'warning');
            return;
        }

        const headersToExport = this.extractSalaryHeaders(allData);
        const worksheetData = [headersToExport];

        allData.forEach(row => {
            const rowArray = headersToExport.map(header => {
                // قراءة القيمة من المفتاح الأصلي إذا كان الرأس معرب للعرض
                let originalH = header;
                if (header === 'رقم تسوية التعلية') originalH = 'محدد كتسوية';
                else if (header === 'رقم تسوية السداد') originalH = 'رقم استمارة اعادة التحويل / التسوية';
                else if (header === 'تاريخ تسوية التعلية') originalH = 'تاريخ المرتدات';

                const val = row[originalH] ?? row[header] ?? '';
                return val === null || val === undefined ? '' : val;
            });
            worksheetData.push(rowArray);
        });

        const ws = XLSX.utils.aoa_to_sheet(worksheetData);
        if (!ws['!views']) ws['!views'] = [];
        ws['!views'].push({ RTL: true });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "المرتبات");

        const fileName = `تقرير_المرتبات_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);

        this.showToast('تم تصدير البيانات بنجاح بصيغة Excel', 'success');
    } catch (error) {
        console.error('Error exporting salary data:', error);
        this.showToast('فشل تصدير البيانات', 'error');
    } finally {
        this.hideLoading();
    }
};



App.prototype.deleteSalaryReturn = async function (id) {
    const isConfirm = await window.confirm("هل أنت متأكد من حذف هذا السجل للمرتبات؟");
    if (isConfirm) {
        this._removeRowsFromMemory('salary', [id]);
        this.showToast('تم تحديث البيانات على الشاشة', 'success');
        this._deleteRowsInBackground(
            'salary',
            [id],
            deleteId => db.deleteSalaryReturn(deleteId),
            {
                label: 'أرشفة سجل المرتبات',
                progressMessage: 'جاري أرشفة سجل المرتبات في الخلفية...',
                successMessage: 'تم تحديث البيانات',
                errorMessage: 'تعذر أرشفة سجل المرتبات'
            }
        );
        return;

        /*
        this.showLoading();
        try {
            await db.deleteSalaryReturn(id);
            this.showToast('تم حذف السجل بنجاح', 'success');
            await this.loadSalaryReturns();
        } catch (e) {
            this.showToast('خطأ أثناء الحذف', 'error');
        } finally {
            this.hideLoading();
        }
        */
    }
};

App.prototype.openSalaryReturnFolder = async function(id) {
    try {
        const res = await fetch(`/salary-returns/open-folder/${id}`, { method: 'POST' });
        const result = await res.json();
        if (result.success) {
            this.showToast('تم فتح مجلد المرفقات بنجاح', 'success');
        } else {
            this.showToast(result.message || 'فشل فتح المجلد', 'error');
        }
    } catch (e) {
        this.showToast('خطأ في الاتصال بالسيرفر', 'error');
    }
};

App.prototype.editSalaryReturn = async function(id) {
    this.showLoading();
    try {
        const record = this.salaryReturnsData.find(r => (r.id || r.Id) == id) || this.salaryReturnsCache?.find(r => (r.id || r.Id) == id);
        if (!record) throw new Error('السجل غير موجود');

        this.currentSalaryEditId = id;
        this.currentSalaryEditOriginal = record;
        this.showEditSalaryModal(record);
    } catch (e) {
        this.showToast(e.message, 'error');
    } finally {
        this.hideLoading();
    }
};

App.prototype.showEditSalaryModal = function(row) {
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'salary-edit-modal-overlay';
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center; z-index: 10000;
        animation: fadeIn 0.3s ease-out;
    `;

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content futuristic-card';
    modalContent.style.cssText = `
        width: 90%; max-width: 800px; max-height: 90vh; overflow-y: auto; padding: 2rem;
        background: #0f172a; border: 1px solid #1e293b; border-radius: 1rem;
        box-shadow: 0 0 30px rgba(0,0,0,0.5); position: relative;
    `;

    modalContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid #1e293b; padding-bottom:1rem;">
            <h3 style="color:#38bdf8; margin:0; font-size:1.5rem;">تعديل سجل المرتبات</h3>
            <button onclick="window.app.closeEditSalaryModal()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:1.5rem;">✕</button>
        </div>
    `;

    const form = document.createElement('div');
    form.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;';

    // تضمين كافة الحقول المستوردة بالإضافة للمسميات الرسمية
    const standardFields = [
        'كود الملف', 'الاسم', 'رقم الحساب', 'البنك', 'قيمة العملية',
        'الحالة', 'السبب', 'رقم الحساب بعد التعديل', 'البنك بعد التعديل', 'كود الفرع بعد التعديل',
        'تاريخ الرفع', 'رقم تسوية التعلية', 'رقم تسوية السداد', 'تاريخ تسوية التعلية', 'حالة التسوية'
    ];

    const allKeys = new Set([...standardFields, '\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0639\u062a\u0645\u0627\u062f\u0020\u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0020\u002f\u0020\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0644\u0633\u062f\u0627\u062f', ...Object.keys(row)]);

    allKeys.forEach(key => {
        if (key === 'id' || key === 'Id' || key === 'AttachmentCount' || key.startsWith('_')) return;
        if ((key.includes('/') || key.includes(' / ')) && key !== '\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0639\u062a\u0645\u0627\u062f\u0020\u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0020\u002f\u0020\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0644\u0633\u062f\u0627\u062f') return; // تجاهل المسميات المدمجة في الجدول (مثل تاريخ المرتد / تاريخ التعلية)

        const group = document.createElement('div');
        group.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem;';

        const label = document.createElement('label');
        label.textContent = key;
        label.style.color = '#94a3b8';
        label.style.fontSize = '0.9rem';

        // جلب القيمة من المفتاح الأصلي إذا كان الحقل معاد تسميته أو له مسمى تقني مخلف
        let originalKey = key;
        if (key === 'رقم تسوية التعلية') originalKey = (row['محدد كتسوية'] !== undefined) ? 'محدد كتسوية' : 'رقم تسوية التعلية';
        else if (key === 'رقم تسوية السداد') originalKey = (row['رقم استمارة اعادة التحويل / التسوية'] !== undefined) ? 'رقم استمارة اعادة التحويل / التسوية' : 'رقم تسوية السداد';
        else if (key === 'تاريخ تسوية التعلية') originalKey = (row['تاريخ المرتدات'] !== undefined) ? 'تاريخ المرتدات' : 'تاريخ تسوية التعلية';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = row[originalKey] ?? row[key] ?? '';
        input.dataset.key = originalKey;
        input.style.cssText = `
            background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem;
            color: #f1f5f9; padding: 0.75rem; font-size: 1rem; outline: none; transition: border-color 0.2s;
        `;

        group.appendChild(label);
        group.appendChild(input);
        form.appendChild(group);
    });

    const footer = document.createElement('div');
    footer.style.cssText = 'grid-column: span 2; display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #1e293b;';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'حفظ التعديلات';
    saveBtn.onclick = () => this.saveEditSalaryReturn();

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'إلغاء';
    cancelBtn.onclick = () => this.closeEditSalaryModal();

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    form.appendChild(footer);

    modalContent.appendChild(form);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
};

App.prototype.closeEditSalaryModal = function() {
    document.getElementById('salary-edit-modal-overlay')?.remove();
    this.currentSalaryEditId = null;
    this.currentSalaryEditOriginal = null;
};

App.prototype.saveEditSalaryReturn = async function() {
    const id = this.currentSalaryEditId;
    if (!id) return;

    const overlay = document.getElementById('salary-edit-modal-overlay');
    const inputs = overlay.querySelectorAll('input[data-key]');
    const updatedData = {};
    inputs.forEach(input => {
        updatedData[input.dataset.key] = input.value;
    });
    const mergedData = this._stripEditableTechnicalFields({ ...(this.currentSalaryEditOriginal || {}), ...updatedData });
    const changedData = this._getChangedFields(this.currentSalaryEditOriginal || {}, updatedData);
    if (Object.keys(changedData).length === 0) {
        this.showToast('\u0644\u0627 \u062a\u0648\u062c\u062f \u062a\u0639\u062f\u064a\u0644\u0627\u062a \u0644\u0644\u062d\u0641\u0638', 'info');
        this.closeEditSalaryModal();
        return;
    }

    const saveBtn = overlay.querySelector('button.btn-primary');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.add('btn-loading');
        saveBtn.textContent = 'جاري الحفظ...';
    }

    const optimisticRow = { ...mergedData, id };
    this._applyEditedRowInMemory('salary', id, optimisticRow);
    this.renderSalaryTable?.();
    this.closeEditSalaryModal();
    this.showToast('\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0641\u0648\u0631\u0627\u064b', 'success');
    this.showToast('تم تحديث السجل على الشاشة، جاري الحفظ في الخلفية', 'success');

    const bg = this.beginBackgroundMutation('جاري حفظ التعديل في الخلفية...');
    db.updateSalaryReturn(id, changedData)
        .then(async result => {
            if (result && result.success) {
                const updatedRow = result.record || optimisticRow;
                await this._upsertEditedCachedRow('salary', id, updatedRow, { changedKeys: Object.keys(changedData), deferRender: true });
                bg.success('تم تحديث البيانات');
                this.showToast('تم حفظ التعديل نهائياً', 'success');
            } else {
                bg.error('تعذر حفظ التعديل في قاعدة البيانات: ' + (result?.message || ''));
                throw new Error(result?.message || '\u0641\u0634\u0644 \u0627\u0644\u062a\u062d\u062f\u064a\u062b');
            }
        })
        .catch(e => {
            bg.error('تعذر حفظ التعديل في الخلفية: ' + e.message);
            this._syncDataset?.('salary', { force: true, full: true, skipCheck: true }).catch(() => {});
            this.showToast('فشل حفظ التعديل في الخلفية: ' + e.message, 'error');
        });
};

App.prototype.showSalaryImportModal = function () {
    this.isSalaryImport = true; // تأكيد: هذا مرتبات
    // فتح المودال المنفصل للمرتبات
    document.getElementById('salary-import-modal')?.classList.remove('hidden');
};

// الـ override الموجود هنا لـ hideImportModal أصبح غير ضروري بعد الفصل
// ولكن نحتفظ به ليُصحّح السلوك القديم في حال استُدعي
App.prototype.hideImportModal = function () {
    document.getElementById('import-modal')?.classList.add('hidden');
    // لا نلمس isSalaryImport — كل مودال يتحكم في نفسه
};

App.prototype.processSalaryFile = async function (file) {
    this.showLoading();
    this.hideSalaryImportModal(); // أغلق المودال الصحيح
    this.pendingImportType = 'salary'; // تثبيت النوع
    this.isSalaryImport = true;  // تأكيد صريح قبل أي عملية async
    try {
        const data = this.harmonizeImportedRows(await this.readExcelFile(file));
        if (!data || data.length === 0) throw new Error('الملف فارغ أو غير صالح');

        this.pendingAllData = data;
        this.pendingFile = file;
        this.isSalaryImport = true;

        // تشغيل نظام الفحص
        this._validationService = new ValidationService();
        const validationResult = this._validationService.validate(data, this.salaryReturnsCache || []);

        // عرض النتائج
        this.populateValidationModal(validationResult);
        this.showValidationResultsPage(validationResult);

    } catch (error) {
        console.error('خطأ في استيراد المرتبات:', error);
        this.showToast('عذراً، حدث خطأ أثناء معالجة الملف: ' + error.message, 'error');
    } finally {
        this.hideLoading();
        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.value = '';
    }
};


App.prototype.confirmDeleteAll = async function () {
    if (!this.canDeleteReturns()) {
        this.showToast('ليس لديك صلاحية حذف هذه البيانات', 'error');
        return;
    }
    if (!this.canDeleteAllReturns()) {
        this.showToast('ليس لديك صلاحية حذف هذه البيانات', 'error');
        return;
    }
    if (!await this.isDangerousDeleteAllEnabled()) {
        this.showToast('حذف كل السجلات غير مفعل من الإعدادات', 'error');
        return;
    }
    const correctPwd = localStorage.getItem('delete_password') || '1994';
    const inputPwd = await window.dialog.show({
        message: 'يرجى إدخال كلمة المرور لتأكيد حذف جميع البيانات:',
        type: 'question',
        isPrompt: true,
        inputType: 'password'
    });

    if (inputPwd === null || inputPwd === false) return;

    if (inputPwd !== correctPwd) {
        this.showToast('كلمة المرور غير صحيحة!', 'error');
        return;
    }

    const confirmed = await dialog.show({
        title: 'أرشفة جميع بيانات الحوافز',
        message: 'هل أنت متأكد من نقل جميع بيانات مرتدات الحوافز الحالية إلى الأرشيف؟ سيتم إخفاؤها من هذه الصفحة وبقاؤها في الأرشيف.',
        type: 'warning',
        showCancel: true
    });

    if (!confirmed) return;

    this.showLoading();
    try {
        const success = await db.deleteAllReturns(inputPwd);
        if (success) {
            this.showToast('تم نقل جميع سجلات الحوافز للأرشيف بنجاح', 'success');
            this.returnsCache = null;
            await this.loadReturns(1);
        } else {
            this.showToast('فشل حذف البيانات', 'error');
        }
    } catch (e) {
        if (e?.status === 403) this.showDeleteForbidden(e);
        else this.showToast('خطأ في الاتصال: ' + e.message, 'error');
    } finally {
        this.hideLoading();
    }
};

App.prototype.confirmDeleteAllSalary = async function () {
    if (!this.canDeleteReturns()) {
        this.showToast('ليس لديك صلاحية حذف هذه البيانات', 'error');
        return;
    }
    if (!this.canDeleteAllReturns()) {
        this.showToast('ليس لديك صلاحية حذف هذه البيانات', 'error');
        return;
    }
    if (!await this.isDangerousDeleteAllEnabled()) {
        this.showToast('حذف كل السجلات غير مفعل من الإعدادات', 'error');
        return;
    }
    const correctPwd = localStorage.getItem('delete_password') || '1994';
    const inputPwd = await window.dialog.show({
        message: 'يرجى إدخال كلمة المرور لتأكيد حذف جميع بيانات المرتبات:',
        type: 'question',
        isPrompt: true,
        inputType: 'password'
    });

    if (inputPwd === null || inputPwd === false) return;

    if (inputPwd !== correctPwd) {
        this.showToast('كلمة المرور غير صحيحة!', 'error');
        return;
    }

    const confirmed = await dialog.show({
        title: 'أرشفة جميع بيانات المرتبات',
        message: 'هل أنت متأكد من نقل جميع بيانات مرتادات المرتبات الحالية إلى الأرشيف؟ سيتم إخفاؤها من هذه الصفحة وبقاؤها في الأرشيف.',
        type: 'warning',
        showCancel: true
    });

    if (!confirmed) return;

    this.showLoading();
    try {
        const success = await db.deleteAllSalaryReturns(inputPwd);
        if (success) {
            this.showToast('تم نقل جميع سجلات المرتبات للأرشيف بنجاح', 'success');
            this.salaryReturnsCache = null;
            await this.loadSalaryReturns(1);
        } else {
            this.showToast('فشل حذف البيانات', 'error');
        }
    } catch (e) {
        if (e?.status === 403) this.showDeleteForbidden(e);
        else this.showToast('خطأ في الاتصال: ' + e.message, 'error');
    } finally {
        this.hideLoading();
    }
};


App.prototype.refreshCurrentPage = async function () {
    console.log('[REFRESH] Refreshing current page with cache invalidation (Async):', this.currentPage);

    // Invalidate local caches to force fresh fetch from DB
    if (this.currentPage === 'returns') {
        this.returnsCache = null;
        const page = (this.pagination && this.pagination.currentPage) ? this.pagination.currentPage : 1;
        const itemsPerPage = (this.pagination && this.pagination.itemsPerPage) ? this.pagination.itemsPerPage : 50;
        await this.loadReturns(page, itemsPerPage, this.currentSearch, this.currentFilter);
    } else if (this.currentPage === 'salary-returns') {
        this.salaryReturnsCache = null;
        const page = (this.salaryPagination && this.salaryPagination.currentPage) ? this.salaryPagination.currentPage : 1;
        const itemsPerPage = (this.salaryPagination && this.salaryPagination.itemsPerPage) ? this.salaryPagination.itemsPerPage : 200;
        await this.loadSalaryReturns(page, itemsPerPage, this.salarySearchQuery);
    } else if (this.currentPage === 'full-returns') {
        await this.loadFullReturns(1, 100, this.searchQuery, true);
    } else if (this.currentPage === 'dashboard') {
        if (this.loadDashboardStats) await this.loadDashboardStats();
    }
};




/**
 * فتح مجلد المرفقات في البحث الموحد
 */
App.prototype.openUnifiedFolder = function(id, type, name) {
    const endpoint = type === 'incentive' ? `/full-returns/open-folder/${id}` : `/salary-returns/open-folder/${id}`;
    fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName: name })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            this.showUnifiedToast('تم فتح مجلد المرفقات بنجاح', 'success', 'مجلد المرفقات');
        } else {
            this.showUnifiedToast('فشل فتح المجلد: ' + (res.message || 'خطأ غير معروف'), 'error');
        }
    })
    .catch(err => {
        console.error('Open Folder Error:', err);
        this.showUnifiedToast('تعذر الوصول لخادم الملفات', 'error');
    });
};

/**
 * SignalR Real-time Updates Core
 */
App.prototype.getHubUrl = function () {
    const stored = localStorage.getItem('hk_hub_url');
    if (stored && stored.trim()) return stored.trim();
    return "/notificationHub";
};

App.prototype.computeAutoHubUrl = async function () {
    try {
        const res = await fetch('/config', { method: 'GET' });
        if (!res.ok) return null;
        const cfg = await res.json();
        const basePath = (cfg?.BasePath || '').toString();
        if (basePath.startsWith('\\\\')) {
            const withoutPrefix = basePath.slice(2);
            const parts = withoutPrefix.split('\\').filter(Boolean);
            const host = parts.length ? parts[0] : '';
            if (host) return `http://${host}:5001/notificationHub`;
        }
        return null;
    } catch {
        return null;
    }
};

App.prototype.fillHubUrlField = function () {
    const input = document.getElementById('hub-server-url');
    if (input) input.value = localStorage.getItem('hk_hub_url') || '';
};

App.prototype.saveHubUrl = function () {
    const input = document.getElementById('hub-server-url');
    if (!input) return;
    const val = input.value.trim();
    if (val) localStorage.setItem('hk_hub_url', val);
    else localStorage.removeItem('hk_hub_url');
    try {
        if (this.hubConnection) this.hubConnection.stop();
    } catch {}
    this.initSignalR();
    if (this.showUnifiedToast) this.showUnifiedToast('تم حفظ إعداد خادم الإشعارات', 'success', 'الإشعارات');
};

App.prototype.escapeHtml = function (value) {
    return String(value ?? '').replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
};

App.prototype.formatNotificationTime = function (value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return this.escapeHtml(String(value).substring(0, 16));

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'الآن';
    if (diffMinutes < 60) return `منذ ${diffMinutes} د`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `منذ ${diffHours} س`;

    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

App.prototype.getNotificationIcon = function (type) {
    const icons = {
        chat: 'fa-comment-dots',
        message: 'fa-comment-dots',
        task: 'fa-tasks',
        share: 'fa-share-alt',
        system: 'fa-info-circle'
    };
    return icons[String(type || '').toLowerCase()] || 'fa-bell';
};

App.prototype.renderNotifications = function () {
    const list = document.getElementById('notifications-list');
    const badge = document.getElementById('notifications-badge');
    if (!list || !badge) return;

    const notifications = Array.isArray(this.notifications) ? this.notifications : [];
    const unreadCount = notifications.filter(n => !n.isRead).length;

    badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    badge.classList.toggle('hidden', unreadCount === 0);

    if (!notifications.length) {
        list.innerHTML = '<div class="notifications-empty">لا توجد إشعارات</div>';
        return;
    }

    list.innerHTML = '';
    notifications.forEach(notification => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `notification-item ${notification.isRead ? '' : 'unread'}`;
        item.addEventListener('click', () => this.openNotification(notification));
        item.innerHTML = `
            <span class="notification-item-icon"><i class="fas ${this.getNotificationIcon(notification.type)}"></i></span>
            <span class="notification-item-body">
                <span class="notification-item-title">${this.escapeHtml(notification.title || 'إشعار جديد')}</span>
                <span class="notification-item-message">${this.escapeHtml(notification.message || '')}</span>
                <span class="notification-item-time">${this.escapeHtml(this.formatNotificationTime(notification.createdAt))}</span>
            </span>
        `;
        list.appendChild(item);
    });
};

App.prototype.loadNotifications = async function () {
    if (!this.currentUser?.id) return;

    try {
        const notifications = await db.fetchApi(`/api/notifications?userId=${this.currentUser.id}&limit=50`);
        const previousUnread = Array.isArray(this.notifications) ? this.notifications.filter(n => !n.isRead).length : 0;
        this.notifications = Array.isArray(notifications) ? notifications : [];
        const nextUnread = this.notifications.filter(n => !n.isRead).length;
        if (previousUnread > 0 && nextUnread > previousUnread && !document.hidden) {
            this.playNotificationSound?.();
        }
        this.renderNotifications();
    } catch (e) {
        console.error('[Notifications] Failed to load notifications:', e);
    }
};


// Removed duplicate startNotificationPolling

App.prototype.startPermissionsPolling = function () {
    if (this._permissionsPoller) return;
    this._permissionsPoller = setInterval(async () => {
        const user = auth.getUser();
        if (!user?.id) return;
        try {
            const result = await db.fetchApi(`/permissions/${user.id}`);
            const serverPerms = Array.isArray(result?.permissions)
                ? result.permissions.slice().sort().join(',')
                : null;
            if (serverPerms === null) return;
            const localPerms = (user.permissions || []).slice().sort().join(',');
            if (serverPerms !== localPerms) {
                user.permissions = result.permissions;
                auth.currentUser = user;
                localStorage.setItem(auth.sessionKey, JSON.stringify(user));
                this.currentUser = user;
                this.applyPermissions();
                this.showToast('تم تحديث صلاحياتك', 'info');
                const pageKey = `page.${this.currentPage}`;
                if (this.currentPage && !auth.hasPermission(pageKey) && !auth.isAdmin()) {
                    this.navigateTo('dashboard');
                }
            }
        } catch (e) { /* silent */ }
    }, 8000);
};

App.prototype.toggleNotificationsPanel = function () {
    const panel = document.getElementById('notifications-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
};

App.prototype.closeNotificationsPanel = function () {
    document.getElementById('notifications-panel')?.classList.add('hidden');
};

App.prototype.markNotificationRead = async function (notificationId) {
    if (!this.currentUser?.id || !notificationId) return;
    try {
        await db.fetchApi(`/api/notifications/${notificationId}/read?userId=${this.currentUser.id}`, { method: 'POST' });
        const item = this.notifications?.find(n => n.id == notificationId);
        if (item) item.isRead = true;
        this.renderNotifications();
    } catch (e) {
        console.error('[Notifications] Failed to mark notification as read:', e);
    }
};

App.prototype.markAllNotificationsRead = async function () {
    if (!this.currentUser?.id) return;
    try {
        await db.fetchApi(`/api/notifications/mark-all-read?userId=${this.currentUser.id}`, { method: 'POST' });
        (this.notifications || []).forEach(n => n.isRead = true);
        this.renderNotifications();
    } catch (e) {
        console.error('[Notifications] Failed to mark all notifications as read:', e);
    }
};

App.prototype.openNotification = async function (notification) {
    if (!notification) return;
    await this.markNotificationRead(notification.id);
    this.closeNotificationsPanel();

    const type = String(notification.type || '').toLowerCase();
    const entityType = String(notification.relatedEntityType || '').toLowerCase();

    if (type === 'chat' || type === 'message' || entityType.includes('chat')) {
        this.navigateTo('chat');
        return;
    }

    if (type === 'task' || entityType.includes('task')) {
        this.navigateTo('tasks');
        return;
    }

    if (type === 'share') {
        this.navigateTo('dashboard');
    }
};

App.prototype.initSignalR = function () {
    try {
        if (!window.signalR) {
            console.warn('[RealTime] SignalR library not loaded. Auto-updates disabled.');
            return;
        }

        this.fillHubUrlField();
        const customUrl = this.getHubUrl();
        const buildConnection = (url) => {
            this.hubConnection = new signalR.HubConnectionBuilder()
                .withUrl(url)
                .withAutomaticReconnect()
                .build();

            this.hubConnection.on("DbChange", (e) => {
                const opMap = {
                    "INSERT": "إضافة", "UPDATE": "تعديل", "DELETE": "حذف",
                    "حذف": "حذف", "تعديل": "تعديل", "استيراد": "استيراد",
                    "تسوية": "تسوية", "رفع مرفق": "رفع مرفق", "حذف مرفق": "حذف مرفق"
                };
                const tableMap = {
                    "Returns": "مرتدات الحوافز",
                    "SalaryReturns": "مرتدات المرتبات",
                    "Archives": "الأرشيف",
                    "SalaryArchives": "أرشيف المرتبات",
                    "FullReturns": "البحث الشامل"
                };

                const user = e?.user || "مستخدم آخر";
                const op = opMap[e?.operation] || e?.operation || "تحديث";
                const table = tableMap[e?.table] || e?.table || e?.table || "البيانات";

                // إخفاء إشعارات الدردشة لأن ChatModule يتكفل بها بشكل احترافي
                if (e?.table === "ChatMessages") {
                    return;
                }

                // Robust Name Comparison
                const currentName = (this.currentUser?.fullname || this.currentUser?.FullName || "").trim();
                const eventUser = (user || "").trim();

                if (currentName && eventUser && currentName === eventUser) {
                    if (this.showUnifiedToast) {
                        this.showUnifiedToast(`تم تنفيذ عملية (${op}) بنجاح`, 'success', 'تأكيد العملية');
                    }
                    return;
                }

                // الآخرون تظهر لهم البطاقة التفاعلية
                this.playNotificationSound();
                this.showSignalRNotification(table, user, op);

                // تحديث البيانات تلقائياً في الخلفية لضمان "الاستقرار" و "التحديث أول بأول"
                if (["Returns", "SalaryReturns", "FullReturns"].includes(e?.table)) {
                    this.startBackgroundSync();
                }
            });

            this.hubConnection.on("UpdateData", (source, user, op) => {
                console.info(`[RealTime] Data update signal received from: ${source} by ${user}`);

                const sourceMap = {
                    'Returns': 'مرتادات الحوافز',
                    'SalaryReturns': 'مرتادات المرتبات',
                    'SmartSettlement': 'السداد الذكي',
                    'Archive': 'الأرشيف',
                    'SalaryArchive': 'أرشيف المرتبات'
                };
                const sourceName = sourceMap[source] || source;
                const operation = op || "تحديث البيانات";

                // Robust Name Comparison
                const currentName = (this.currentUser?.fullname || this.currentUser?.FullName || "").trim();
                const eventUser = (user || "").trim();

                if (currentName && eventUser && currentName === eventUser) {
                    if (this.showUnifiedToast) {
                        this.showUnifiedToast(`اكتملت عملية (${operation}) بنجاح`, 'success', sourceName);
                    }
                    return;
                }

                this.playNotificationSound();
                this.showSignalRNotification(sourceName, user, operation);
            });

            this.hubConnection.on("ReceiveNotification", (data) => {
                console.log("[SignalR] Notification Received:", data);
                this.loadNotifications();
            });

            this.hubConnection.on("NotificationsChanged", (data) => {
                console.log("[SignalR] Notifications changed:", data);
                this.loadNotifications();
            });

            this.hubConnection.onreconnecting(() => this.updateSignalRUI('reconnecting'));
            this.hubConnection.onreconnected(() => this.updateSignalRUI('online'));
            this.hubConnection.onclose(() => this.updateSignalRUI('offline'));

            this.hubConnection.start()
                .then(async () => {
                    const urlInfo = this.hubConnection.connection.baseUrl || url;
                    console.log(`[RealTime] Connected to SignalR Hub at: ${urlInfo}`);
                    this.updateSignalRUI('online');

                    // Join user group for private notifications
                    if (this.currentUser && this.currentUser.id) {
                        try {
                            await this.hubConnection.invoke("JoinGroup", this.currentUser.id.toString());
                            console.log(`[RealTime] Joined personal group: ${this.currentUser.id}`);
                        } catch (e) { console.warn("Failed to join group", e); }
                    }
                })
                .catch(err => {
                    console.warn("[RealTime] Initial connection failed. System will retry in 5s...", err);
                    this.updateSignalRUI('offline');

                    setTimeout(() => {
                        this.hubConnection.start()
                            .then(() => {
                                console.log("[RealTime] Reconnected successfully.");
                                this.updateSignalRUI('online');
                            })
                            .catch(err2 => console.error("[RealTime] Retry failed again. Manual refresh might be needed.", err2));
                    }, 5000);
                });
        };

        if (customUrl === "/notificationHub") {
            this.computeAutoHubUrl()
                .then(autoUrl => {
                    buildConnection(autoUrl || customUrl);
                })
                .catch(() => buildConnection(customUrl));
        } else {
            buildConnection(customUrl);
        }

    } catch (e) {
        console.error('[RealTime] Init failed:', e);
    }
};

/**
 * Show a pleasant, modern, non-intrusive floating notification card (WhatsApp Style)
 */
App.prototype.showSignalRNotification = function (sourceName, user, operation = "تعديل") {
    const cardId = 'signalr-notification-card';
    let card = document.getElementById(cardId);

    // Remove existing notification if any to prevent stacking
    if (card) card.remove();

    card = document.createElement('div');
    card.id = cardId;
    card.className = 'noti-v2-card';
    card.innerHTML = `
        <div class="noti-v2-header">
            <span class="noti-v2-badge">تحديث لحظي</span>
            <span class="noti-v2-time">الآن</span>
        </div>
        <div class="noti-v2-body">
            <div class="noti-v2-icon-wrapper">
                <i class="fas fa-satellite-dish"></i>
                <div class="noti-v2-pulse-dot"></div>
            </div>
            <div class="noti-v2-content">
                <span class="noti-v2-user">${user}</span>
                <div class="noti-v2-msg">
                    قام بـ <strong>${operation}</strong> في <strong>${sourceName}</strong>
                </div>
            </div>
        </div>
        <div class="noti-v2-footer">
            <button id="noti-accept" class="noti-v2-btn noti-v2-btn-primary">
                <i class="fas fa-sync-alt"></i> تحديث الآن
            </button>
            <button id="noti-close" class="noti-v2-btn noti-v2-btn-secondary">
                تجاهل
            </button>
        </div>
    `;

    document.body.appendChild(card);

    const acceptBtn = document.getElementById('noti-accept');
    const closeBtn = document.getElementById('noti-close');

    const removeCard = (delay = 0) => {
        card.classList.add('hiding');
        setTimeout(() => {
            if (card && card.parentElement) card.remove();
        }, delay || 600);
    };

    acceptBtn.onclick = async () => {
        acceptBtn.disabled = true;
        closeBtn.disabled = true;

        // Visual processing state
        const originalHtml = acceptBtn.innerHTML;
        acceptBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري المزامنة...';
        acceptBtn.style.background = '#10b981';
        acceptBtn.style.color = 'white';

        try {
            await this.refreshCurrentPage();

            // Success indicator
            acceptBtn.innerHTML = '<i class="fas fa-check-circle"></i> تم التحديث';
            setTimeout(() => removeCard(600), 1000);
        } catch (e) {
            console.error('[SignalR] Refresh failed:', e);
            acceptBtn.style.background = '#ef4444';
            acceptBtn.innerHTML = '<i class="fas fa-times-circle"></i> فشل التحديث';
            setTimeout(() => {
                acceptBtn.disabled = false;
                closeBtn.disabled = false;
                acceptBtn.innerHTML = originalHtml;
                acceptBtn.style.removeProperty('background');
                acceptBtn.style.removeProperty('color');
            }, 2000);
        }
    };

    closeBtn.onclick = () => removeCard();

    // Auto-remove after 30 seconds
    const autoRemoveTimeout = setTimeout(() => {
        if (document.getElementById(cardId) && !acceptBtn.disabled) {
            removeCard();
        }
    }, 30000);

    // Cancel auto-remove if user interacts
    card.onmouseover = () => clearTimeout(autoRemoveTimeout);
};


/**
 * Play a professional soft notification chime using Web Audio API (No files needed)
 */
App.prototype.playNotificationSound = function () {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Use two oscillators for a 'chime' effect
        const playTone = (freq, startTime, duration) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            osc.type = 'sine'; // Clean bell-like tone
            osc.frequency.setValueAtTime(freq, startTime);

            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.02); // Fade in
            gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Fade out

            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const now = audioCtx.currentTime;
        // Chime sequence (E5 -> A5)
        playTone(659.25, now, 1.0);     // E5
        playTone(880.00, now + 0.1, 1.2); // A5

    } catch (e) {
        console.warn('[Audio] Failed to play notification sound:', e);
    }
};

// ==========================================
// Advanced Features Logic (Tasks & Sharing)
// ==========================================

App.prototype.showShareRequest = function(data) {
    this.playNotificationSound();
    const modal = document.createElement('div');
    modal.className = 'glass-modal-overlay show';
    modal.innerHTML = `
        <div class="glass-modal-content share-modal-content">
            <div class="share-modal-icon"><i class="fas fa-handshake"></i></div>
            <h2 style="color: white; margin-bottom: 15px;">🔍 دعوة مشاركة جدول</h2>
            <p style="font-size: 1.1rem; color: #94a3b8; margin: 15px 0;">${data.message}</p>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 30px;">
                <button class="btn btn-primary" onclick="app.respondToShare(${data.shareId}, 'Accepted', this.parentElement.parentElement.parentElement)">قبول المشاركة</button>
                <button class="btn btn-secondary" onclick="app.respondToShare(${data.shareId}, 'Rejected', this.parentElement.parentElement.parentElement)">تجاهل</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

App.prototype.respondToShare = async function(shareId, status, modalElement) {
    try {
        const resp = await fetch('/shares/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shareId, status, userId: this.currentUser.id })
        });
        const result = await resp.json();
        if (result.success) {
            if (status === 'Accepted') {
                this.showToast("تم القبول", "يمكنك الآن الوصول إلى الجدول من قائمة الأرشيف", "success");
                this.loadArchive();
            }
            modalElement.remove();
        }
    } catch (e) {
        console.error(e);
        this.showToast("خطأ في الاتصال", "error");
    }
};

App.prototype.showManagerTask = function(data) {
    this.playNotificationSound();
    const toast = document.createElement('div');
    toast.className = `signalr-notification-v2 task-v2-card task-v2-priority-${data.priority || 'Medium'}`;
    toast.style.cssText = `
        position: fixed; bottom: 20px; left: 20px; width: 350px; z-index: 10001;
        background: #1e293b; border-radius: 1rem; padding: 1.5rem;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5); border-right: 5px solid ${data.priority === 'High' ? '#ef4444' : '#f59e0b'};
        animation: slideInLeft 0.5s ease-out;
    `;

    toast.innerHTML = `
        <div class="task-v2-header" style="display:flex; justify-content:space-between; margin-bottom:1rem;">
            <span class="task-v2-badge-manager"><i class="fas fa-tasks"></i> مهمة جديدة</span>
            <span style="font-size: 0.75rem; color: #64748b;">الآن</span>
        </div>
        <h4 style="margin: 0 0 0.5rem 0; color: white; font-size: 1.1rem;">${data.title}</h4>
        <p style="font-size: 0.9rem; color: #94a3b8; margin: 0 0 1.5rem 0; line-height: 1.4;">${data.message}</p>
        <div style="display: flex; justify-content: flex-end;">
            <button class="btn btn-sm btn-primary" onclick="this.parentElement.parentElement.remove()">فهمت</button>
        </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease-in forwards';
        setTimeout(() => toast.remove(), 500);
    }, 60000);
};

App.prototype.loadAuditLogs = async function() {
    try {
        const resp = await fetch('/audit/logs');
        const logs = await resp.json();
        const container = document.getElementById('audit-log-container');
        if (!container) return;

        let html = `
            <div class="table-container">
                <table class="audit-log-table">
                    <thead>
                        <tr>
                            <th>التوقيت</th>
                            <th>المستخدم</th>
                            <th>العملية</th>
                            <th>التفاصيل</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        logs.forEach(log => {
            html += `
                <tr>
                    <td style="font-family: monospace; font-size: 0.8rem; color: #64748b;">${log.createdAt}</td>
                    <td style="font-weight: 600; color: #f1f5f9;">${log.username}</td>
                    <td><span class="badge badge-info" style="font-size: 0.75rem;">${log.action}</span></td>
                    <td style="color: #94a3b8; font-size: 0.85rem;">${log.details}</td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    } catch (e) {
        console.error("Error loading audit logs:", e);
    }
};

App.prototype.showShareTableModal = async function(tableId, tableType) {
    const users = await db.getUsers();
    const otherUsers = users.filter(u => u.id !== this.currentUser.id);

    const userOptions = otherUsers.map(u => `<option value="${u.id}">${u.fullname} (@${u.username})</option>`).join('');

    const modal = document.createElement('div');
    modal.className = 'glass-modal-overlay show';
    modal.innerHTML = `
        <div class="glass-modal-content" style="width: 400px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
                <h3 style="color:white; margin:0;"><i class="fas fa-share-alt"></i> مشاركة الجدول</h3>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:1.2rem;">&times;</button>
            </div>
            <div class="form-group">
                <label style="color:#94a3b8; display:block; margin-bottom:8px;">اختر المستخدم للمشاركة معه:</label>
                <select id="share-user-id" class="form-control" style="background:#0f172a; border-color:#334155; color:white;">
                    ${userOptions}
                </select>
            </div>
            <div class="form-group" style="margin-top:20px;">
                <label style="color:#94a3b8; display:block; margin-bottom:8px;">رسالة (اختياري):</label>
                <input type="text" id="share-message" class="form-control" placeholder="يرجى مراجعة هذا الجدول..." style="background:#0f172a; border-color:#334155; color:white;">
            </div>
            <div style="margin-top:30px; display:flex; gap:10px; justify-content:flex-end;">
                <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">إلغاء</button>
                <button class="btn btn-primary" onclick="app.executeShare(${tableId}, '${tableType}')">تأكيد المشاركة</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

App.prototype.executeShare = async function(tableId, tableType) {
    const userId = document.getElementById('share-user-id').value;
    const message = document.getElementById('share-message').value;

    try {
        const resp = await fetch('/shares/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tableId,
                tableType,
                targetUserId: parseInt(userId),
                fromUserId: this.currentUser.id,
                message: message || "لديك طلب مشاركة جديد"
            })
        });
        const result = await resp.json();
        if (result.success) {
            this.showToast("تم إرسال طلب المشاركة بنجاح", "success");
            document.querySelector('.glass-modal-overlay.show').remove();
        } else {
            this.showToast(result.error || "فشلت المشاركة", "error");
        }
    } catch (e) {
        this.showToast("خطأ في الاتصال", "error");
    }
};

App.prototype.showAssignTaskModal = function(userId, fullname) {
    const modal = document.createElement('div');
    modal.className = 'glass-modal-overlay show';
    modal.innerHTML = `
        <div class="glass-modal-content" style="width: 450px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
                <h3 style="color:white; margin:0;"><i class="fas fa-tasks"></i> إسناد مهمة لـ ${fullname}</h3>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:1.2rem;">&times;</button>
            </div>
            <div class="form-group">
                <label style="color:#94a3b8; display:block; margin-bottom:8px;">عنوان المهمة:</label>
                <input type="text" id="task-title" class="form-control" placeholder="مثال: مراجعة أرشيف مرتبات شهر 3" style="background:#0f172a; border-color:#334155; color:white;">
            </div>
            <div class="form-group" style="margin-top:15px;">
                <label style="color:#94a3b8; display:block; margin-bottom:8px;">التفاصيل:</label>
                <textarea id="task-message" class="form-control" rows="3" placeholder="اكتب تفاصيل المهمة هنا..." style="background:#0f172a; border-color:#334155; color:white;"></textarea>
            </div>
            <div class="form-group" style="margin-top:15px;">
                <label style="color:#94a3b8; display:block; margin-bottom:8px;">الأولوية:</label>
                <select id="task-priority" class="form-control" style="background:#0f172a; border-color:#334155; color:white;">
                    <option value="Low">منخفضة</option>
                    <option value="Medium" selected>متوسطة</option>
                    <option value="High">عاجلة جداً</option>
                </select>
            </div>
            <div style="margin-top:30px; display:flex; gap:10px; justify-content:flex-end;">
                <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">إلغاء</button>
                <button class="btn btn-primary" onclick="app.executeAssignTask(${userId})">إرسال المهمة</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

App.prototype.executeAssignTask = async function(userId) {
    const title = document.getElementById('task-title').value;
    const message = document.getElementById('task-message').value;
    const priority = document.getElementById('task-priority').value;

    if (!title || !message) {
        this.showToast("يرجى إدخال العنوان والتفاصيل", "warning");
        return;
    }

    try {
        const resp = await fetch('/tasks/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targetUserId: userId,
                managerId: this.currentUser.id,
                title,
                message,
                priority
            })
        });
        const result = await resp.json();
        if (result.success) {
            this.showToast("تم إرسال المهمة بنجاح", "success");
            document.querySelector('.glass-modal-overlay.show').remove();
        } else {
            this.showToast(result.error || "فشل إرسال المهمة", "error");
        }
    } catch (e) {
        this.showToast("خطأ في الاتصال", "error");
    }
};

// ========================================
// Tasks Page Functions
// ========================================

App.prototype.tasksData = [];
App.prototype.tasksTab = 'my';
App.prototype.tasksStatusFilter = 'all';

App.prototype.loadTasksPage = async function() {
    try {
        const userId = this.currentUser?.id;
        if (!userId) return;

        // Load stats
        const statsRes = await fetch(`/tasks/stats?userId=${userId}`);
        const stats = await statsRes.json();
        document.getElementById('task-stat-total').textContent = stats.total || 0;
        document.getElementById('task-stat-new').textContent = stats.newCount || 0;
        document.getElementById('task-stat-progress').textContent = stats.inProgress || 0;
        document.getElementById('task-stat-done').textContent = stats.done || 0;
        document.getElementById('task-stat-urgent').textContent = stats.highPriority || 0;

        // Load tasks based on current tab
        await this.fetchTasks();
    } catch (e) {
        console.error('[Tasks] Load error:', e);
    }
};

App.prototype.fetchTasks = async function() {
    const userId = this.currentUser?.id;
    if (!userId) return;

    let url = '';
    switch (this.tasksTab) {
        case 'my': url = `/tasks/my?userId=${userId}`; break;
        case 'assigned': url = `/tasks/assigned?managerId=${userId}`; break;
        case 'all': url = `/tasks/all`; break;
    }

    try {
        const res = await fetch(url);
        this.tasksData = await res.json();
        this.renderTasksBoard();
    } catch (e) {
        console.error('[Tasks] Fetch error:', e);
    }
};

App.prototype.renderTasksBoard = function() {
    const data = this.tasksStatusFilter === 'all'
        ? this.tasksData
        : this.tasksData.filter(t => t.status === this.tasksStatusFilter);

    const newTasks = data.filter(t => t.status === 'New');
    const progressTasks = data.filter(t => t.status === 'InProgress');
    const doneTasks = data.filter(t => t.status === 'Done');

    document.getElementById('col-count-new').textContent = newTasks.length;
    document.getElementById('col-count-progress').textContent = progressTasks.length;
    document.getElementById('col-count-done').textContent = doneTasks.length;

    document.getElementById('col-body-new').innerHTML = newTasks.map(t => this.renderTaskCard(t)).join('');
    document.getElementById('col-body-progress').innerHTML = progressTasks.map(t => this.renderTaskCard(t)).join('');
    document.getElementById('col-body-done').innerHTML = doneTasks.map(t => this.renderTaskCard(t)).join('');

    const board = document.getElementById('tasks-board');
    const empty = document.getElementById('tasks-empty-state');
    if (data.length === 0) {
        board.classList.add('hidden');
        empty.classList.remove('hidden');
    } else {
        board.classList.remove('hidden');
        empty.classList.add('hidden');
    }
};

App.prototype.renderTaskCard = function(task) {
    const priorityMap = {
        'High': { cls: 'priority-high', label: '🔴 عالية', color: '#ef4444' },
        'Medium': { cls: 'priority-medium', label: '🟡 متوسطة', color: '#f59e0b' },
        'Low': { cls: 'priority-low', label: '🟢 منخفضة', color: '#10b981' }
    };
    const p = priorityMap[task.priority] || priorityMap.Medium;

    const statusActions = {
        'New': `<button class="task-action-btn action-start" onclick="app.updateTaskStatus(${task.id}, 'InProgress')" title="بدء التنفيذ"><i class="fas fa-play"></i></button>`,
        'InProgress': `<button class="task-action-btn action-done" onclick="app.updateTaskStatus(${task.id}, 'Done')" title="إنهاء"><i class="fas fa-check"></i></button>`,
        'Done': `<button class="task-action-btn action-reopen" onclick="app.updateTaskStatus(${task.id}, 'New')" title="إعادة فتح"><i class="fas fa-undo"></i></button>`
    };

    const createdDate = task.createdAt ? new Date(task.createdAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }) : '';
    const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }) : '';

    const isOverdue = task.dueDate && task.status !== 'Done' && new Date(task.dueDate) < new Date();
    const overdueClass = isOverdue ? 'task-overdue' : '';

    const assigneeInfo = this.tasksTab === 'assigned'
        ? `<span class="task-assignee"><i class="fas fa-user"></i> ${task.targetUserName || ''}</span>`
        : `<span class="task-manager"><i class="fas fa-user-tie"></i> ${task.managerName || ''}</span>`;

    return `
        <div class="task-card ${p.cls} ${overdueClass}" data-id="${task.id}">
            <div class="task-card-header">
                <span class="task-priority-badge" style="background: ${p.color}20; color: ${p.color}; border: 1px solid ${p.color}40;">${p.label}</span>
                ${isOverdue ? '<span class="task-overdue-badge">⏰ متأخرة</span>' : ''}
            </div>
            <h4 class="task-card-title">${task.title || ''}</h4>
            ${task.description ? `<p class="task-card-desc">${task.description}</p>` : ''}
            <div class="task-card-meta">
                ${assigneeInfo}
                <span class="task-date"><i class="fas fa-calendar-alt"></i> ${createdDate}</span>
                ${dueDate ? `<span class="task-due ${isOverdue ? 'due-overdue' : ''}"><i class="fas fa-clock"></i> ${dueDate}</span>` : ''}
            </div>
            <div class="task-card-actions">
                ${statusActions[task.status] || ''}
                <button class="task-action-btn action-delete" onclick="app.deleteTask(${task.id})" title="حذف"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>`;
};

App.prototype.switchTaskTab = function(tab, btn) {
    this.tasksTab = tab;
    document.querySelectorAll('.task-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.fetchTasks();
};

App.prototype.filterTasks = function(status, btn) {
    this.tasksStatusFilter = status;
    document.querySelectorAll('.task-chip').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.renderTasksBoard();
};

App.prototype.updateTaskStatus = async function(taskId, newStatus) {
    try {
        const res = await fetch('/tasks/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, status: newStatus })
        });
        if (res.ok) {
            this.showToast('تم تحديث حالة المهمة', 'success');
            await this.loadTasksPage();
        }
    } catch (e) {
        this.showToast('خطأ في تحديث المهمة', 'error');
    }
};

App.prototype.deleteTask = async function(taskId) {
    const confirmed = await window.confirm('هل تريد حذف هذه المهمة نهائياً؟');
    if (!confirmed) return;
    try {
        const res = await fetch(`/tasks/${taskId}`, { method: 'DELETE' });
        if (res.ok) {
            this.showToast('تم حذف المهمة', 'success');
            await this.loadTasksPage();
        }
    } catch (e) {
        this.showToast('خطأ في حذف المهمة', 'error');
    }
};

App.prototype.showCreateTaskModal = async function() {
    const modal = document.getElementById('create-task-modal');
    modal.classList.remove('hidden');

    // Reset form
    document.getElementById('task-title-input').value = '';
    document.getElementById('task-desc-input').value = '';
    document.getElementById('task-priority-input').value = 'Medium';
    document.getElementById('task-due-input').value = '';

    // Populate assignee list
    try {
        const res = await fetch('/users');
        const users = await res.json();
        const select = document.getElementById('task-assignee-input');
        select.innerHTML = users.filter(u => u.active).map(u =>
            `<option value="${u.id}" ${u.id === this.currentUser?.id ? 'selected' : ''}>${u.fullname}</option>`
        ).join('');
    } catch (e) {}
};

App.prototype.hideCreateTaskModal = function() {
    document.getElementById('create-task-modal').classList.add('hidden');
};

App.prototype.createTask = async function() {
    const title = document.getElementById('task-title-input').value.trim();
    if (!title) { this.showToast('يرجى إدخال عنوان المهمة', 'error'); return; }

    const task = {
        managerId: this.currentUser?.id,
        targetUserId: parseInt(document.getElementById('task-assignee-input').value),
        title: title,
        description: document.getElementById('task-desc-input').value.trim(),
        priority: document.getElementById('task-priority-input').value,
        dueDate: document.getElementById('task-due-input').value || null
    };

    try {
        const res = await fetch('/tasks/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
        });
        if (res.ok) {
            this.showToast('تم إنشاء المهمة بنجاح ✅', 'success');
            this.hideCreateTaskModal();
            await this.loadTasksPage();
        } else {
            this.showToast('خطأ في إنشاء المهمة', 'error');
        }
    } catch (e) {
        this.showToast('خطأ في الاتصال', 'error');
    }
};


// Initialize App

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});

// --- Archive System Logic ---
App.prototype.toggleAdabirInlineFilter = function() {
    const panelId = this.currentPage === 'salary-returns' ? 'salary-adabir-inline-filter' : 'adabir-inline-filter';
    document.getElementById(panelId)?.classList.toggle('hidden');
};

App.prototype.showAdabirReasonModal = async function() {
    const isSalary = this.currentPage === 'salary-returns';
    const from = document.getElementById(isSalary ? 'salary-adabir-date-from' : 'adabir-date-from')?.value || '';
    const to = document.getElementById(isSalary ? 'salary-adabir-date-to' : 'adabir-date-to')?.value || '';
    if (!from || !to) {
        this.showToast?.('اختر تاريخ البداية والنهاية أولاً', 'warning');
        return;
    }

    const sourceTable = isSalary ? 'SalaryReturns' : 'Returns';
    try {
        const params = new URLSearchParams({ dateFrom: from, dateTo: to, sourceTable });
        const res = await fetch('/api/adabir/preview?' + params.toString());
        const preview = await res.json();
        if (!res.ok || preview.success === false) throw new Error(preview.message || 'فشل المعاينة');
        if ((preview.recordCount || 0) <= 0) {
            this.showToast?.('لا توجد سجلات غير مؤرشفة في هذه الفترة', 'warning');
            return;
        }
        const input = document.getElementById('adabir-reason-input');
        if (input) input.value = '';
        this.pendingAdabirArchive = { dateFrom: from, dateTo: to, sourceTable, recordCount: preview.recordCount };
        document.getElementById('adabir-reason-modal')?.classList.remove('hidden');
    } catch (e) {
        console.error('Adabir preview failed', e);
        this.showToast?.(e.message || 'تعذر تنفيذ معاينة الأضابير', 'error');
    }
};

App.prototype.hideAdabirReasonModal = function() {
    document.getElementById('adabir-reason-modal')?.classList.add('hidden');
};

App.prototype.archiveCurrentSelectionToAdabir = function() {
    const isSalary = this.currentPage === 'salary-returns';
    const sourceTable = isSalary ? 'SalaryReturns' : 'Returns';
    const isAllFiltered = isSalary ? this.isAllSalaryReturnsSelected : this.isAllReturnsSelected;
    const selectedIds = isSalary
        ? Array.from(this.selectedSalaryReturnIds || []).map(Number).filter(Number.isFinite)
        : Array.from(this.selectedReturnIds || []).map(Number).filter(Number.isFinite);

    if (!isAllFiltered && selectedIds.length === 0) {
        this.showToast?.('حدد سجلاً واحداً على الأقل أو اختر تحديد كل النتائج المفلترة أولاً', 'warning');
        return;
    }

    const filters = isSalary ? {
        search: this.salarySearchQuery || '',
        attachmentStatus: this.salaryAttachmentFilterValue || 'all',
        uploadDateFrom: this.salaryUploadDateFrom || '',
        uploadDateTo: this.salaryUploadDateTo || '',
        settlement: this.salarySettlementFilterValue || 'all',
        returnStatus: this.salaryReturnStatusFilterValue || 'all',
        monthFilter: this.salaryMonthFilterValue || 'all',
        paymentDateFilter: this.salaryPaymentDateFilterValue || 'all'
    } : {
        search: this.searchQuery || '',
        attachmentStatus: this.attachmentFilterValue || 'all',
        uploadDateFrom: this.uploadDateFrom || document.getElementById('upload-date-filter')?.value || '',
        uploadDateTo: this.uploadDateTo || document.getElementById('upload-date-filter')?.value || '',
        settlement: this.settlementFilterValue || 'all',
        returnStatus: this.returnStatusFilterValue || 'all',
        monthFilter: this.monthFilterValue || 'all',
        paymentDateFilter: this.paymentDateFilterValue || 'all'
    };

    const totalFiltered = isSalary ? (this.salaryPagination?.total || 0) : (this.totalFilteredCount || 0);
    const recordCount = isAllFiltered ? totalFiltered : selectedIds.length;
    if (!recordCount || recordCount <= 0) {
        this.showToast?.('لا توجد سجلات مطابقة للنقل إلى الأضابير', 'warning');
        return;
    }

    this.pendingAdabirArchive = {
        sourceTable,
        ids: isAllFiltered ? null : selectedIds,
        archiveAllFiltered: Boolean(isAllFiltered),
        recordCount,
        dateFrom: filters.uploadDateFrom || '',
        dateTo: filters.uploadDateTo || '',
        ...filters
    };

    const input = document.getElementById('adabir-reason-input');
    if (input) input.value = isAllFiltered ? 'نقل السجلات المطابقة للفلاتر إلى الأضابير' : 'نقل السجلات المحددة إلى الأضابير';
    document.getElementById('adabir-reason-modal')?.classList.remove('hidden');
};

App.prototype.confirmExecutionArchive = async function() {
    const pending = this.pendingAdabirArchive;
    if (!pending) {
        this.showToast?.('لا توجد عملية نقل جاهزة للتنفيذ', 'warning');
        return;
    }

    const reason = (document.getElementById('adabir-reason-input')?.value || '').trim();
    if (reason.length < 5) {
        this.showToast?.('اكتب سبب الأرشفة بحد أدنى 5 أحرف', 'warning');
        return;
    }

    if (!confirm(`سيتم نقل ${pending.recordCount} سجل إلى الأضابير. هل تريد المتابعة؟`)) return;

    try {
        const res = await fetch('/api/adabir/archive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...pending, reason })
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || result.success === false) throw new Error(result.message || 'فشل النقل إلى الأضابير');

        this.hideAdabirReasonModal();
        document.getElementById(pending.sourceTable === 'SalaryReturns' ? 'salary-adabir-inline-filter' : 'adabir-inline-filter')?.classList.add('hidden');
        this.pendingAdabirArchive = null;
        this.returnsCache = null;
        this.salaryReturnsCache = null;
        this.showToast?.(`تم نقل ${result.count || pending.recordCount} سجل إلى الأضابير`, 'success');

        if (pending.sourceTable === 'SalaryReturns') {
            this.clearSalarySelection?.();
            await this.loadSalaryReturns?.(1);
        } else {
            this.clearSelection?.();
            await this.loadReturns?.(1);
        }
    } catch (e) {
        console.error('Adabir archive failed', e);
        this.showToast?.(e.message || 'فشل النقل إلى الأضابير', 'error');
    }
};

App.prototype.loadAdabir = async function() {
    try {
        const res = await fetch('/api/adabir');
        const data = await res.json();
        this.adabirBatches = Array.isArray(data) ? data : [];
        const tbody = document.getElementById('adabir-tbody');
        if(!tbody) return;
        this.renderAdabirBatches(this.adabirBatches);
    } catch(e) { console.error('Error loading Adabir', e); }
};

App.prototype.renderAdabirBatches = function(data) {
    const tbody = document.getElementById('adabir-tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:28px; color:#94a3b8;">لا توجد إضابير مطابقة للفلاتر الحالية</td></tr>`;
        return;
    }
    (data || []).forEach(batch => {
            const sourceLabel = this.getAdabirSourceLabel ? this.getAdabirSourceLabel(batch.sourceTable) : (batch.sourceTable || '');
            const statusLabel = this.getAdabirStatusLabel ? this.getAdabirStatusLabel(batch) : 'نشط';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${batch.id}</td>
                <td>${batch.archivedAt}</td>
                <td>${batch.reason}</td>
                <td>${batch.dateFrom} - ${batch.dateTo}</td>
                <td>${batch.recordCount}</td>
                <td>${sourceLabel}</td>
                <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${batch.excelNames}">${batch.excelNames}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="app.viewAdabirDetails(${batch.id})">التفاصيل</button>
                    <button class="btn btn-sm btn-danger" onclick="app.restoreAdabir(${batch.id})">استعادة</button>
                    <span class="adabir-meta-pill" style="margin-right:6px;">${statusLabel}</span>
                </td>
            `;
            tbody.appendChild(tr);
        });
};

App.prototype.filterAdabir = function() {
    const q = (document.getElementById('adabir-search')?.value || '').toLowerCase().trim();
    const periodFrom = document.getElementById('adabir-period-from')?.value || '';
    const periodTo = document.getElementById('adabir-period-to')?.value || '';
    const source = document.getElementById('adabir-source-filter')?.value || 'all';
    const status = document.getElementById('adabir-status-filter')?.value || 'all';

    const filtered = (this.adabirBatches || []).filter(batch => {
        const sourceLabel = this.getAdabirSourceLabel ? this.getAdabirSourceLabel(batch.sourceTable) : (batch.sourceTable || '');
        const searchable = [
            batch.id,
            batch.sourceTable,
            sourceLabel,
            batch.reason,
            batch.archivedAt,
            batch.dateFrom,
            batch.dateTo,
            batch.excelNames
        ].map(v => String(v ?? '').toLowerCase()).join(' ');

        if (q && !searchable.includes(q)) return false;
        if (source !== 'all' && String(batch.sourceTable || '') !== source) return false;

        const isRestored = this.isAdabirBatchRestored ? this.isAdabirBatchRestored(batch) : false;
        if (status === 'active' && isRestored) return false;
        if (status === 'restored' && !isRestored) return false;

        if (periodFrom || periodTo) {
            const fromValue = String(batch.dateFrom || batch.archivedAt || '').substring(0, 10);
            const toValue = String(batch.dateTo || batch.archivedAt || '').substring(0, 10);
            if (periodFrom && toValue && toValue < periodFrom) return false;
            if (periodTo && fromValue && fromValue > periodTo) return false;
        }
        return true;
    });
    this.renderAdabirBatches(filtered);
};

App.prototype.clearAdabirFilters = function() {
    ['adabir-search', 'adabir-period-from', 'adabir-period-to'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['adabir-source-filter', 'adabir-status-filter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 'all';
    });
    this.renderAdabirBatches(this.adabirBatches || []);
};

App.prototype.getAdabirSourceLabel = function(sourceTable) {
    if (sourceTable === 'SalaryReturns') return 'مرتدات المرتبات';
    if (sourceTable === 'Returns') return 'مرتدات الحوافز';
    return sourceTable || 'غير محدد';
};

App.prototype.isAdabirBatchRestored = function(batch) {
    const raw = String(batch?.status || batch?.Status || '').toLowerCase();
    return raw.includes('restored') || raw.includes('مسترجع');
};

App.prototype.getAdabirStatusLabel = function(batch) {
    return this.isAdabirBatchRestored(batch) ? 'مسترجع' : 'نشط';
};

App.prototype.viewAdabirDetails = async function(id) {
    try {
        const res = await fetch('/api/adabir/' + id + '/details');
        const details = await res.json();
        this.currentAdabirDetails = Array.isArray(details) ? details : [];
        this.currentAdabirBatch = (this.adabirBatches || []).find(b => String(b.id) === String(id)) || null;
        document.getElementById('adabir-details-id').textContent = id;
        const search = document.getElementById('adabir-details-search');
        if (search) search.value = '';
        this.renderAdabirDetailsMeta(id);
        this.renderAdabirDetails(this.currentAdabirDetails);
        document.getElementById('adabir-details-modal')?.classList.remove('hidden');
    } catch(e) { console.error(e); }
};

(function installIndexedDbSyncLoaders() {
    const originalLoadReturns = App.prototype.loadReturns;
    const originalLoadSalaryReturns = App.prototype.loadSalaryReturns;
    const originalLoadFullReturns = App.prototype.loadFullReturns;

    App.prototype.loadReturns = async function(page = 1, pageSize = 50, search = '', filter = '', attachmentStatus = 'all', append = false) {
        if (!append) {
            if (!Array.isArray(this.returnsCache) || this.returnsCache.length === 0) {
                await this._loadCachedDataset?.('returns');
            }

            if (Array.isArray(this.returnsCache) && this.returnsCache.length > 0) {
                console.log('[LOCAL-FIRST][returns] Rendering from IndexedDB cache');
                this.handleLocalSearch(search || '', filter || '', attachmentStatus || 'all', page, pageSize, append);
                this._syncDataset?.('returns').catch(() => {});
                this.startBackgroundSync?.();
                return { source: 'indexeddb', count: this.returnsCache.length };
            }
        }

        const result = await originalLoadReturns.apply(this, arguments);
        this.startBackgroundSync?.();
        return result;
    };

    App.prototype.loadSalaryReturns = async function(page = 1, pageSize = 50, search = '', append = false) {
        if (!append) {
            if (!Array.isArray(this.salaryReturnsCache) || this.salaryReturnsCache.length === 0) {
                await this._loadCachedDataset?.('salary');
            }

            if (Array.isArray(this.salaryReturnsCache) && this.salaryReturnsCache.length > 0) {
                console.log('[LOCAL-FIRST][salary] Rendering from IndexedDB cache');
                this.handleLocalSalarySearch(search || '', this.salaryAttachmentFilterValue || 'all', page, pageSize, append);
                this._syncDataset?.('salary').catch(() => {});
                this.startBackgroundSync?.();
                return { source: 'indexeddb', count: this.salaryReturnsCache.length };
            }
        }

        const result = await originalLoadSalaryReturns.apply(this, arguments);
        this.startBackgroundSync?.();
        return result;
    };

    App.prototype.loadFullReturns = async function(page = 1, pageSize = 50, query = '', isSearch = false) {
        if (query === null || query === undefined) {
            query = document.getElementById('unified-search-input')?.value || this.searchQuery || '';
        }

        const hasReturnsCache = Array.isArray(this.returnsCache) && this.returnsCache.length > 0;
        const hasSalaryCache = Array.isArray(this.salaryReturnsCache) && this.salaryReturnsCache.length > 0;
        if (!hasReturnsCache) await this._loadCachedDataset?.('returns');
        if (!hasSalaryCache) await this._loadCachedDataset?.('salary');

        if ((this.returnsCache && this.returnsCache.length) || (this.salaryReturnsCache && this.salaryReturnsCache.length)) {
            console.log('[SYNC][unified] Loaded from cache');
            if (isSearch) this.selectedUnifiedStatementQuery = '';
            this.searchQuery = query || '';
            this.unifiedSettlementStatus = document.getElementById('unified-settlement-status')?.value || this.unifiedSettlementStatus || 'not_settled';
            this.showUnifiedSearchState?.('');
            this.updateUnifiedAccountStatementButton?.(false);
            await this.handleUnifiedLocalSearch(query || '');
            document.getElementById('unified-loading')?.classList.add('hidden');
            this.startBackgroundSync?.();
            return;
        }

        const result = await originalLoadFullReturns.apply(this, arguments);
        this.startBackgroundSync?.();
        return result;
    };
})();

App.prototype.renderAdabirDetailsMeta = function(id) {
    const meta = document.getElementById('adabir-details-meta');
    if (!meta) return;
    const batch = this.currentAdabirBatch || {};
    const source = this.getAdabirSourceLabel ? this.getAdabirSourceLabel(batch.sourceTable) : (batch.sourceTable || '');
    const range = batch.dateFrom || batch.dateTo ? `${batch.dateFrom || '-'} - ${batch.dateTo || '-'}` : 'غير محددة';
    const reason = batch.reason || 'بدون سبب مسجل';
    meta.innerHTML = `
        <span class="adabir-meta-pill">المصدر: ${source}</span>
        <span class="adabir-meta-pill">الفترة: ${range}</span>
        <span class="adabir-meta-pill">السبب: ${reason}</span>
    `;
};

App.prototype.renderAdabirDetails = function(details) {
    const thead = document.getElementById('adabir-details-thead');
    const tbody = document.getElementById('adabir-details-tbody');
    const count = document.getElementById('adabir-details-count');
    if (!thead || !tbody) return;

    const rows = (details || []).map(d => {
        let raw = {};
        try { raw = JSON.parse(d.rawData || d.RawData || '{}'); } catch {}
        return { detail: d, raw };
    });

    const headers = ['OriginalId', 'SourceTable', 'ReturnCode', 'UploadDate', 'الاسم', 'رقم الحساب', 'قيمة العملية', 'الحالة'];
    thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    tbody.innerHTML = rows.map(({ detail, raw }) => {
        const get = key => raw[key] ?? detail[key] ?? detail[key.charAt(0).toLowerCase() + key.slice(1)] ?? '';
        return `<tr>
            <td>${get('OriginalId')}</td>
            <td>${get('SourceTable')}</td>
            <td>${get('ReturnCode')}</td>
            <td>${get('UploadDate')}</td>
            <td>${raw['الاسم'] || raw['الاســــم'] || raw['Name'] || ''}</td>
            <td>${raw['رقم الحساب'] || raw['AccountNumber'] || ''}</td>
            <td>${raw['قيمة العملية'] || raw['المبلغ'] || raw['Amount'] || ''}</td>
            <td>${raw['الحالة'] || raw['Status'] || ''}</td>
        </tr>`;
    }).join('');
    if (count) count.textContent = `عدد السجلات: ${rows.length}`;
};

App.prototype.renderAdabirDetails = function(details) {
    const thead = document.getElementById('adabir-details-thead');
    const tbody = document.getElementById('adabir-details-tbody');
    const count = document.getElementById('adabir-details-count');
    if (!thead || !tbody) return;

    const rows = (details || []).map(d => {
        let raw = {};
        try { raw = JSON.parse(d.rawData || d.RawData || '{}'); } catch {}
        return { detail: d, raw };
    });

    const headers = ['الأصل', 'المصدر', 'كود المرتد', 'تاريخ الرفع', 'الاسم', 'رقم الحساب', 'قيمة العملية', 'الحالة'];
    thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    tbody.innerHTML = rows.map(({ detail, raw }) => {
        const get = key => raw[key] ?? detail[key] ?? detail[key.charAt(0).toLowerCase() + key.slice(1)] ?? '';
        const sourceValue = this.getAdabirSourceLabel ? this.getAdabirSourceLabel(get('SourceTable')) : get('SourceTable');
        return `<tr>
            <td>${get('OriginalId')}</td>
            <td>${sourceValue}</td>
            <td>${get('ReturnCode')}</td>
            <td>${get('UploadDate')}</td>
            <td>${raw['الاسم'] || raw['Name'] || ''}</td>
            <td>${raw['رقم الحساب'] || raw['AccountNumber'] || ''}</td>
            <td>${raw['قيمة العملية'] || raw['المبلغ'] || raw['Amount'] || ''}</td>
            <td>${raw['الحالة'] || raw['Status'] || ''}</td>
        </tr>`;
    }).join('');
    if (count) count.textContent = `عدد السجلات: ${rows.length}`;
};

App.prototype.filterAdabirDetails = function() {
    const q = (document.getElementById('adabir-details-search')?.value || '').toLowerCase().trim();
    const source = this.currentAdabirDetails || [];
    if (!q) {
        this.renderAdabirDetails(source);
        return;
    }
    this.renderAdabirDetails(source.filter(d => JSON.stringify(d).toLowerCase().includes(q)));
};

App.prototype.hideAdabirDetailsModal = function() {
    document.getElementById('adabir-details-modal')?.classList.add('hidden');
};

App.prototype.restoreAdabir = async function(id) {
    if(!confirm('هل أنت متأكد من رغبتك في استعادة هذه الدفعة للجدول الرئيسي؟')) return;
    try {
        const res = await fetch('/api/adabir/restore/' + id, { method: 'POST' });
        if(res.ok) {
            alert('تمت الاستعادة بنجاح');
            this.returnsCache = null;
            this.salaryReturnsCache = null;
            this.loadAdabir();
        } else {
            alert('حدث خطأ أثناء الاستعادة');
        }
    } catch(e) { console.error(e); }
};
