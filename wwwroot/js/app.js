
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

console.log('App JS Loaded Successfully version 6.6 - Unified Identity Attachments');

/**
 * نظام إدارة المرتدات - التطبيق الرئيسي
 */

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

        // إزالة أي حوار سابق
        this._remove();

        const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌', question: '❓' };

        // بناء HTML ديناميكياً
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

        // الأحداث
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

        // Focus
        if (isPrompt) setTimeout(() => card.querySelector('.fd-input')?.focus(), 100);

        return new Promise(resolve => { this.resolvePromise = resolve; });
    }

    _resolve(value) {
        if (!this.el) return;
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
        this.currentPage = 'returns';
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

        // Salary Returns Init
        this.salaryReturnsCache = null;
        this.isSalaryCaching = false;
        this.salaryReturnsData = [];
        this.salaryReturnsCurrentPage = 1;
        this.salaryReturnsRowsPerPage = 50;
        this.salarySearchQuery = '';
        this.salaryAttachmentFilterValue = 'all';
        this.salarySettlementFilterValue = 'all';
        this.salaryReturnStatusFilterValue = 'all';
        this.salaryMonthFilterValue = 'all';
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
        try { await db.init(); } catch (e) { }
        try { await this.loadFilters(); } catch (e) { }
        try { await db.initDefaultUsers(); } catch (e) { }
        try {
            const user = await auth.checkSession();
            if (user) {
                this.currentUser = user;
                this.showApp();
                this.navigateTo(this.currentPage);
                this.updateStats();
                this.initSidebar();
                this.currentArchiveTab = 'lauf';
                const tabLauf = document.getElementById('tab-btn-lauf');
                if (tabLauf) tabLauf.addEventListener('click', () => this.switchArchiveTab('lauf'));
                const tabFull = document.getElementById('tab-btn-full');
                if (tabFull) tabFull.addEventListener('click', () => this.switchArchiveTab('full'));
                await db.repairSchema();
                this.loadReturns();
                this.loadAttachmentLinkMode();
                this.loadExtractionMonths();
                
                // Simplified async call
                await this.loadFromOfflineStorage();
                this.populateReturnsCache();
                this.populateSalaryReturnsCache();
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
        try {
            const users = await db.getUsers();
            const select = document.getElementById('login-username');
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
            console.error('خطأ في تحميل قائمة المستخدمين:', error);
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
        // إخفاء زر الاستيراد إذا لم يكن لديه صلاحية
        if (!auth.canImport()) {
            document.getElementById('btn-import-returns')?.classList.add('hidden');
            document.getElementById('empty-import-btn')?.classList.add('hidden');
        }

        // إخفاء أزرار التصدير
        if (!auth.canExport()) {
            document.getElementById('export-excel-btn')?.classList.add('hidden');
            document.getElementById('export-csv-btn')?.classList.add('hidden');
        }

        // إخفاء صفحة الإعدادات لغير المدير
        if (!auth.canManageUsers()) {
            document.getElementById('nav-settings')?.classList.add('hidden');
        }
    }

    // ========================================
    // معالجة الأحداث
    // ========================================

    setupEventListeners() {
        // زر إعدادات الطوارئ (الترس) - النقر المزدوج
        const emergencyBtn = document.getElementById('emergency-setup-btn');
        if (emergencyBtn) {
            emergencyBtn.addEventListener('dblclick', async () => {
                const password = await window.prompt('أدخل كلمة مرور المطور للوصول إلى إعدادات الاتصال:', '');
                if (password === '2027') {
                    this.showApp();
                    // تأكد من ظهور زر الإعدادات حتى لو لم يتم تسجيل الدخول
                    document.getElementById('nav-settings')?.classList.remove('hidden');
                    this.navigateTo('settings');
                    this.switchSettingsTab('db');
                    this.showToast('تم الدخول إلى وضع المطور (إعدادات الاتصال)', 'success');
                } else if (password !== null && password !== '') {
                    this.showToast('كلمة المرور غير صحيحة', 'error');
                }
            });
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
            const delay = this.returnsCache ? 50 : 500;
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
            this.showApp();
            await this.loadReturns();
            this.showToast(`مرحباً ${result.user.fullname}`, 'success');
            this.playNotificationSound();
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

    navigateTo(page, preventLoad = false) {
        console.log('Navigating to:', page, preventLoad); // Debug log
        this.initTheme();
        if (!page) return;

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
            archive: { icon: '🗄️', text: 'الأرشيف' },
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
                this.loadUsers();
                this.loadDeletePassword();
                this.loadAttachmentLinkMode();
            }
            if (page === 'returns') this.loadReturns();
            if (page === 'full-returns') this.loadFullReturns();
            if (page === 'salary-returns') this.loadSalaryReturns();
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

        // إخفاء جميع محتويات التبويبات
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        // إزالة الحالة النشطة من جميع أزرار التبويبات
        document.querySelectorAll('#page-settings .btn-tab').forEach(btn => {
            btn.classList.remove('active');
        });

        // إظهار التبويب المطلوب وتنشيط الزر الخاص به
        const targetTab = document.getElementById(`settings-tab-${tabId}`);
        const targetBtn = document.getElementById(`tab-settings-${tabId}`);

        if (targetTab) targetTab.classList.remove('hidden');
        if (targetBtn) targetBtn.classList.add('active');

        this.currentSettingsTab = tabId;
    }

    /**
     * تحميل وعرض البيانات
     */
    async loadReturns(page = 1, pageSize = 50, search = null, filter = null, attachmentStatus = null, append = false) {
        console.log('[LOAD] loadReturns called:', { page, pageSize, search, filter, attachmentStatus, append });
        // تحديث الحالات المحلية لضمان التزامن
        if (search !== null) this.searchQuery = search;
        if (filter !== null) this.filterValue = filter;
        if (attachmentStatus !== null) this.attachmentFilterValue = attachmentStatus;

        // Use document value if local state is null (safety sync)
        if (this.searchQuery === null) {
            this.searchQuery = document.getElementById('table-search')?.value || "";
        }

        // Populate Upload Date Filter Options if empty
        const uploadSelect = document.getElementById('upload-date-filter');
        if (uploadSelect && uploadSelect.options.length <= 1) {
            try {
                const dates = await db.getUploadDates();
                if (dates && Array.isArray(dates) && dates.length > 0) {
                    uploadSelect.innerHTML = '<option value="all">الكل</option>'; // Reset options just in case
                    dates.forEach(d => {
                        if (d) {
                            const opt = document.createElement('option');
                            opt.value = d;
                            opt.textContent = d;
                            uploadSelect.appendChild(opt);
                        }
                    });
                }
            } catch (e) {
                console.warn('Failed to load upload dates', e);
            }
        }

        // Ensure filter values are always synced with UI if null
        this.monthFilterValue = document.getElementById('month-filter')?.value || this.monthFilterValue || 'all';
        this.settlementFilterValue = document.getElementById('settlement-filter')?.value || this.settlementFilterValue || 'all';
        this.returnStatusFilterValue = document.getElementById('return-status-filter')?.value || this.returnStatusFilterValue || 'all';
        const uploadDateFilterVal = document.getElementById('upload-date-filter')?.value;
        if (uploadDateFilterVal && uploadDateFilterVal !== 'all') {
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

            // استخدام pagination من السيرفر - 50 سجل في المرة
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
                'all', // statusFilter
                'all', // Force 'all' to avoid Server SQL error for monthFilter
                this.settlementFilterValue,
                this.uploadDateFrom,
                this.uploadDateTo
            );

            if (response.data && response.data.length > 0) {
                let dataToUse = response.data;

                dataToUse = dataToUse.map(row => {
                    const settlementNo = row['رقم تسوية السداد'] || '';
                    const hasSettlement = settlementNo && String(settlementNo).trim() !== '';
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

                // Filter by Return Status
                if (this.returnStatusFilterValue && this.returnStatusFilterValue !== 'all' && this.returnStatusFilterValue !== 'الكل') {
                    const mode = this.returnStatusFilterValue.toLowerCase();
                    dataToUse = dataToUse.filter(row => {
                        const status = (row['الحالة'] || row['Status'] || '').toLowerCase();
                        return status.includes(mode);
                    });
                }

                // Filter by Month next
                if (this.monthFilterValue && this.monthFilterValue !== 'all') {
                    const selectedMonth = this.monthFilterValue; // e.g. "01-2026"
                    dataToUse = dataToUse.filter(row => {
                        const fileCodeKeys = ['كـــود الملف', 'كود الملف', 'كُـــود المـلف', 'كـــود المـلف', 'FileCode', 'كود_الملف'];
                        const fileCode = this.findValue(row, fileCodeKeys) || '';
                        return String(fileCode).includes(selectedMonth);
                    });
                }

                if (append) {
                    this.data = [...this.data, ...dataToUse];
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

            const dataToRender = append ? response.data : null;
            this.renderTable(dataToRender, append);
            this.updateStats(response.stats);
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
                    const settlementNo = row['رقم تسوية السداد'] || '';
                    const hasSettlement = settlementNo && String(settlementNo).trim() !== '';
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
                const amountVal = row['قيمة العملية'] || row['المبلغ'] || row['Amount'];
                row._amount = this.parseAmount(amountVal);
                row._normStatus = this.normalizeArabic(row['الحالة'] || row['Status'] || '');
                
                const settlementNo = row['رقم تسوية السداد'] || '';
                const hasSettlement = settlementNo && String(settlementNo).trim() !== '';
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

    triggerNameSearch(name) {
        if (!name) return;
        
        let targetSearch = null;
        if (this.currentPage === 'page-smart-payment') {
            targetSearch = document.getElementById('salary-search');
        } else if (this.currentPage === 'page-full-returns') {
            const unifiedSearch = document.getElementById('unified-search-input');
            if (unifiedSearch && !unifiedSearch.closest('.hidden')) {
                targetSearch = unifiedSearch;
            }
        }
        
        if (!targetSearch) {
            targetSearch = document.getElementById('table-search');
        }
        
        if (targetSearch) {
            targetSearch.value = name;
            targetSearch.dispatchEvent(new Event('input', { bubbles: true }));
            window.scrollTo({top: 0, behavior: 'smooth'});
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

        // Optimized Field Discovery Keys
        const fileCodeKeys = ['كـــود الملف', 'كود الملف', 'كُـــود المـلف', 'كـــود المـلف', 'FileCode', 'كود_الملف'];

        const filtered = this.returnsCache.filter(row => {
            // 1. Search Logic
            if (searchWords.length > 0) {
                const rowStr = row._searchStr || "";
                // Optimization: Case-insensitive search already handled by _searchStr generation
                // We check if EVERY word in the search query exists in the row's search string
                // We also check against the original un-normalized query just in case
                const originalSearchWords = (search || "").toLowerCase().split(/\s+/).filter(w => w.length > 0);

                const matchNormalized = searchWords.every(word => rowStr.includes(word));
                const matchOriginal = originalSearchWords.every(word => rowStr.includes(word));

                if (!matchNormalized && !matchOriginal) return false;
            }

            // 2. Category Logic
            if (catFilter) {
                const isMatch = Object.values(row).some(val => String(val).toLowerCase().includes(catFilter));
                if (!isMatch) return false;
            }

            // 3. Month Logic (High Accuracy)
            if (selectedMonth) {
                let fileCode = "";
                for (const k of fileCodeKeys) {
                    if (row[k]) { fileCode = row[k]; break; }
                }
                if (!String(fileCode).includes(selectedMonth)) return false;
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
                const uploadDate = row['تاريخ الرفع'] || row['UploadDate'];
                if (!uploadDate) return false;

                if (uploadDateFrom && uploadDate < uploadDateFrom) return false;
                if (uploadDateTo) {
                    let toLimit = uploadDateTo;
                    if (toLimit.length === 10) toLimit += " 23:59:59";
                    if (uploadDate > toLimit) return false;
                }
            }

            return true;
        });

        console.timeEnd('[PERF] Local Search');
        console.log(`[LOCAL SEARCH] Found ${filtered.length} matches.`);

        // 6. Local Pagination
        const total = filtered.length;
        const totalPages = Math.ceil(total / pageSize);
        const start = (page - 1) * pageSize;
        const pagedData = filtered.slice(start, start + pageSize);

        if (!append) {
            this.data = pagedData;
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
                '#',
                'كود الملف',
                'الاسم',
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
                let val = row[h] ?? '';

                // منطق استعادة القيم المسميات المزدوجة (لأن البيانات مخزنة بالمفتاح القديم)
                if (val === '') {
                    if (h === 'تاريخ المرتد / تاريخ التعلية') {
                        val = row['تاريخ المرتد'] || row['تاريخ المرتدات'] || '';
                    }
                    if (h === 'تاريخ اعتماد التعديل / تاريخ السداد') {
                        val = row['تاريخ اعتماد التعديل'] || row['تاريخ اعتماد المرتدات'] || row['SettlementDate'] || '';
                    }
                }

                // Backup check for virtual columns that might not be in row directly but in RawData
                if (val === '' && h !== '#') {
                    // This is a safety layer for dynamic headers
                    val = row[h] || '';
                }

                if (h.includes('<input')) {
                    val = `<input type="checkbox" class="return-row-checkbox" value="${rowId}" onchange="window.app.updateSelectAllReturns()" style="transform: scale(1.2); cursor: pointer;">`;
                } else if (h === '#') {
                    val = previousRowCount + rowIndex + 1;
                } else if (h === 'كود الملف') {
                    const fileCodeKeys = ['كـــود الملف', 'كود الملف', 'كُـــود المـلف', ' FileCode', 'كود_الملف'];
                    val = this.findValue(row, fileCodeKeys) || '';
                } else if ((h === 'الاسم' || h === 'الاسم ') && !val) {
                    // Safety check for Name column variations
                    val = row['الاسم'] || row['الاسم '] || row['Name'] || '';
                } else if ((h === 'الرقم القومي' || h === 'الرقم_القومي') && !val) {
                    // محاولة البحث عن أي مفتاح يحتوي على NID أو رقم قومي في الـ RawData (المخزنة في row ككل)
                    for (const key in row) {
                        const lowKey = key.toLowerCase();
                        if ((lowKey.includes('national') || lowKey.includes('nid') || lowKey.includes('قومي')) && row[key]) {
                            val = row[key];
                            break;
                        }
                    }
                } else if (h === 'الشهر') {
                    // استخراج الشهر من "كود الملف" (تنسيق: Army-xxxx-Month-Year)
                    const fileCodeKeys = ['كـــود الملف', 'كود الملف', 'كُـــود المـلف', 'كـــود المـلف', 'FileCode', 'كود_الملف'];
                    const fileCode = this.findValue(row, fileCodeKeys) || '';
                    if (fileCode && String(fileCode).includes('-')) {
                        const parts = String(fileCode).split('-');
                        if (parts.length >= 2) {
                            val = parts[parts.length - 2] + '-' + parts[parts.length - 1]; // الشهر-السنة
                        }
                    }
                } else if (h === 'تاريخ الرفع') {
                    // Check multiple possible properties where the date might be stored
                    val = row['تاريخ الرفع'] || row['UploadDate'] || row['uploadDate'] || '';
                    if (!val) {
                        // Sometimes the property might have whitespace or hidden characters
                        const dateKeys = Object.keys(row).filter(k => k.includes('تاريخ الرفع') || k.includes('UploadDate'));
                        if (dateKeys.length > 0) {
                            val = row[dateKeys[0]];
                        }
                    }
                }

                // تنسيق التواريخ: يوم/شهر/سنة فقط
                if ((h.includes('تاريخ') || h.includes('Date')) && val) {
                    val = this.formatDate(val);
                }

                let rawVal = String(val);

                // منطق عرض العمود "حالة التسوية" حرفياً
                if (h === 'حالة التسوية') {
                    const actualVal = (row[h] || '').trim();
                    rawVal = String(actualVal);

                    if (actualVal === 'تم التسوية' || actualVal === 'تمت التسوية') {
                        val = '<span class="badge-status success">تم التسوية ✅</span>';
                    } else if (actualVal === 'لم يتم التسوية') {
                        val = '<span class="badge-status pending">لم يتم التسوية ⏳</span>';
                    } else {
                        val = actualVal;
                    }
                }

                // تنسيق المبالغ
                if (h.includes('قيمة') || h.includes('المبلغ')) {
                    const num = parseFloat(val);
                    if (!isNaN(num)) {
                        const style = num >= 0 ? 'amount-positive' : 'amount-negative';
                        val = `<span class="${style}">${num.toLocaleString()}</span>`;
                        rawVal = num.toLocaleString();
                    }
                }

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
                if (isNameCol) dynamicClass += ' col-name';

                return `<td class="${isSticky} ${dynamicClass}" style="${extraStyles}"${dblclickEvent}>${val}</td>`;
            }).join('');

            const hasAttachments = row.AttachmentCount > 0;
            const btnClass = hasAttachments ? 'btn-primary' : 'btn-secondary';
            const icon = hasAttachments ? '🖼️' : '📎';
            // Badge: always visible red circle if count > 0 with pulse animation
            const badge = hasAttachments ? `<span class="badge-count" style="background:#ef4444; color:white; border-radius:12px; padding:2px 8px; font-size:0.75em; position:absolute; top:-12px; right:-12px; font-weight:bold; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4); border: 1.5px solid #fff;">${row.AttachmentCount}</span>` : '';
            // Style: Cyan Glow for buttons with attachments
            const style = hasAttachments ? 'position: relative; border: 1px solid #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.5); transform: scale(1.05); transition: all 0.2s ease;' : 'position: relative; opacity: 0.6;';

            const actions = `<td class="col-actions" style="text-align:center; white-space: nowrap;">
            <button class="btn-icon ${btnClass}" style="margin-left:5px; ${style}" onclick="window.app.openAttachmentsModal('${rowId}', 'returns')" title="${hasAttachments ? 'عرض ' + row.AttachmentCount + ' مرفقات' : 'إضافة مرفق'}">
                ${icon} ${badge}
            </button>
            <button class="btn-icon" style="margin-left:5px;" onclick="window.app.editReturn('${rowId}')" title="تعديل السجل">✏️</button>
            <button class="btn-icon" style="margin-left:5px;" onclick="window.app.openReturnFolder('${rowId}')" title="فتح مجلد المرفقات">📂</button>
            <button class="btn-icon" style="color: #f87171;" onclick="window.app.deleteReturn('${rowId}')" title="حذف السجل">🗑️</button>
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

    updateStats(serverStats = null) {
        if (!serverStats) return;

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
        this.isSalaryImport = false; // تأكيد إعادة التعيين لمرتدات الحوافز
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
            const headers = ['كود الملف', 'الاسم', 'رقم الحساب', 'البنك', 'قيمة العملية', 'الحالة', 'السبب', 'رقم الحساب بعد التعديل', 'البنك بعد التعديل', 'كود الفرع بعد التعديل', 'رقم تسوية التعلية', 'تاريخ المرتد / تاريخ التعلية', 'تاريخ اعتماد المرتدات', 'تاريخ التعديل', 'تاريخ اعتماد التعديل', 'رقم تسوية السداد', 'تاريخ اعتماد التعديل / تاريخ السداد'];
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
            const headers = ['كود الملف', 'الاسم', 'رقم الحساب', 'البنك', 'قيمة العملية', 'الحالة', 'السبب', 'رقم الحساب بعد التعديل', 'البنك بعد التعديل', 'كود الفرع بعد التعديل', 'رقم تسوية التعلية', 'تاريخ المرتد / تاريخ التعلية', 'تاريخ اعتماد المرتدات', 'تاريخ التعديل', 'تاريخ اعتماد التعديل', 'رقم تسوية السداد', 'تاريخ اعتماد التعديل / تاريخ السداد'];
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

    // استعادة دالة إخفاء استيراد الملفات
    hideImportModal() {
        document.getElementById('import-modal')?.classList.add('hidden');
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            if (this.isSalaryImport) {
                this.processSalaryFile(file);
            } else {
                this.processFile(file);
            }
        }
    }

    async processFile(file) {
        this.showLoading();
        this.hideImportModal();

        try {
            const data = await this.readExcelFile(file);

            if (!data || data.length === 0) {
                throw new Error('الملف فارغ أو غير صالح');
            }

            // 1. تشغيل الفحص (Validation)
            this._validationService = new ValidationService();
            const validationResult = this._validationService.validate(data, this.returnsCache || []);

            // 2. تحديث واجهة الفحص
            this.populateValidationModal(validationResult);
            this.showValidationResultsPage(validationResult);

            // تخزين البيانات مؤقتاً
            this.pendingAllData = data;
            this.pendingValidData = validationResult.validRecords;
            this.pendingFile = file;

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
        
        // العودة للصفحة الصحيحة بناءً على نوع الفحص الحالي
        if (this.isSalaryImport) {
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
            type: this.isSalaryImport ? 'Salary' : 'Incentive'
        });

        // 1. مسح الكاش لضمان جلب البيانات الجديدة
        this.returnsCache = null;
        this.salaryReturnsCache = null;
        this.isCaching = false;

        // [FIX] إخفاء صفحة الـ validation وأزرارها أولاً
        this.hideLoading();

        // [FIX] إنشاء progress overlay ثابت بدلاً من DOM manipulation معقد
        const overlay = document.createElement('div');
        overlay.id = 'save-overlay-progress';
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

            console.log('[SAVE] Executing API Call...', { count: data.length, type: this.isSalaryImport ? 'Salary' : 'Incentive' });

            const response = this.isSalaryImport
                ? await this.db.saveSalaryReturns(data, importInfo)
                : await this.db.saveReturns(data, importInfo);

            clearInterval(interval);

            if (response && response.success !== false) {
                console.log('[SAVE] API Success:', response);
                setProgress(95, 'تم الحفظ بنجاح، جاري تحديث البيانات...');

                await new Promise(r => setTimeout(r, 800));
                setProgress(100, 'اكتمل الحفظ!');
                await new Promise(r => setTimeout(r, 400));

                // مسح الكاش وإغلاق واجهة الـ validation
                this.returnsCache = null;
                this.salaryReturnsCache = null;
                this.pendingAllData = null;
                this.pendingValidData = null;
                this.pendingFile = null;
                this._validationService = null;

                // إغلاق صفحة النتائج والمودال
                document.getElementById('validation-modal')?.classList.add('hidden');
                document.getElementById('page-validation-results')?.classList.add('hidden');

                removeOverlay();

                if (this.isSalaryImport) {
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
                    this.data = [];
                    this.renderTable([], false);
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

    async handleSmartPaymentFile(input) {
        const file = input.files[0];
        if (!file) return;

        this.smartExcelFileName = file.name; // Store the filename
        const dropZone = document.getElementById('smart-payment-drop-zone');
        if (dropZone) dropZone.textContent = `📄 ${file.name}`;

        const progress = document.getElementById('smart-payment-progress');
        const bar = document.getElementById('smart-payment-bar');
        const status = document.getElementById('smart-payment-status-text');
        
        if (progress) progress.classList.remove('hidden');
        if (status) status.textContent = 'جاري قراءة الملف...';
        if (bar) bar.style.width = '20%';

        try {
            const data = await this.readExcelFile(file);
            this.smartExcelData = data;
            
            if (bar) bar.style.width = '100%';
            if (status) status.textContent = `تم تحميل ${data.length} سجل من الملف بنجاح.`;
            
            document.getElementById('btn-smart-match').disabled = false;
            document.getElementById('smart-excel-count').textContent = data.length;
            document.getElementById('smart-payment-stats-row').style.display = 'grid';

        } catch (e) {
            console.error('[SMART] File Read Error:', e);
            if (status) status.textContent = 'خطأ في قراءة ملف الإكسيل!';
            this.showToast('فشل قراءة الملف المطلوب', 'error');
        }
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
        
        if (loading) loading.classList.remove('hidden');
        if (results) results.style.display = 'none';

        try {
            const matchBy = document.getElementById('smart-match-method')?.value || 'الاسم';

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

                const record = {
                    name: findCol(row, 'الاســــم', 'الاسم', 'CREDITOR_NAME', 'Name', 'اسم المستفيد'),
                    nationalId: findCol(row, 'الرقم القومي', 'NationalId', 'National ID', 'NID'),
                    batchCode: findCol(row, 'كـــود الملف', 'كود الملف', 'BatchCode', 'Batch ID'),
                    currentAccount: findCol(row, 'رقم الحساب', 'رقم الحساب الحالي', 'CurrentAccount', 'ACCOUNT_NUMBER'),
                    currentBank: findCol(row, 'البنك', 'اسم البنك', 'CurrentBank'),
                    modifiedAccount: findCol(row, 'رقم الحساب بعد التعديل', 'رقم الحساب الجديد', 'الحساب الجديد', 'ModifiedAccount'),
                    modifiedBank: findCol(row, 'البنك بعد التعديل', 'البنك الجديد', 'اسم البنك الجديد', 'ModifiedBank'),
                    returnDate: findCol(row, 'تاريخ المرتدات', 'تاريخ المرتد', 'ReturnDate'),
                    returnApprovalDate: findCol(row, 'تاريخ اعتماد المرتدات', 'ReturnApprovalDate'),
                    modDate: findCol(row, 'تاريخ التعديل', 'ModDate'),
                    modApprovalDate: findCol(row, 'تاريخ اعتماد التعديل', 'ModApprovalDate'),
                    settlementNo: findCol(row, 'رقم تسوية السداد', 'SettlementNo'),
                    settlementDate: findCol(row, 'تاريخ تسوية السداد', 'تاريخ التسوية', 'SettlementDate')
                };

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
                    ModifiedAccount: r.modifiedAccount,
                    ModifiedBank: r.modifiedBank,
                    ReturnDate: r.returnDate,
                    ReturnApprovalDate: r.returnApprovalDate,
                    ModDate: r.modDate,
                    ModApprovalDate: r.modApprovalDate,
                    SettlementNo: r.settlementNo,
                    SettlementDate: r.settlementDate
                })),
                Filters: {
                    Month: document.getElementById('smart-month-filter')?.value || '',
                    Status: document.getElementById('smart-status-filter')?.value || 'الكل',
                    MatchBy: document.getElementById('smart-match-method')?.value || 'الاسم',
                    DataType: document.getElementById('smart-type-filter')?.value || 'الكل'
                }
            };

            const response = await fetch('/api/smart-settlement/match', {
                method: 'POST',
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

            // Re-inject metadata into fresh results
            if (currentModifications.size > 0) {
                this.smartMatchResults.forEach(item => {
                    const key = `${item.sourceExcelRow.name}_${item.sourceExcelRow.currentAccount}`;
                    if (currentModifications.has(key)) {
                        Object.assign(item.sourceExcelRow, currentModifications.get(key));
                    }
                });
            }
            
            this.renderSmartPaymentResults(json.data);
            
            if (results) results.style.display = 'block';
            
            const totalMatches = json.data.reduce((acc, curr) => acc + (curr.matches.length + curr.salaryMatches.length), 0);
            document.getElementById('smart-matched-count').textContent = totalMatches;
            
            if (totalMatches > 0) {
                document.getElementById('btn-smart-execute-incentive').disabled = false;
                document.getElementById('btn-smart-execute-salary').disabled = false;
                document.getElementById('btn-smart-execute-all').disabled = false;
            } else {
                this.showToast('لم يتم العثور على أي مطابقة لبيانات الملف المرفوع', 'warning');
            }

        } catch (e) {
            console.error('[SMART] Match Error:', e);
            this.showToast('حدث خطأ أثناء مطابقة البيانات: ' + e.message, 'error');
        } finally {
            if (loading) loading.classList.add('hidden');
            btnMatch.disabled = false;
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

    renderSmartPaymentResults(data) {
        const resultsContainer = document.getElementById('smart-payment-results');
        if (!resultsContainer) return;

        // Get current filter value
        const dataTypeFilter = document.getElementById('smart-type-filter')?.value || 'الكل';

        // Clear existing results
        resultsContainer.innerHTML = '';

        if (!data || data.length === 0) {
            resultsContainer.innerHTML = '<div class="unified-table-empty">لا توجد نتائج مطابقة</div>';
            return;
        }

        data.forEach((item, index) => {
            const hasIncentives = (dataTypeFilter === 'الكل' || dataTypeFilter === 'incentive') && item.matches && item.matches.length > 0;
            const hasSalaries = (dataTypeFilter === 'الكل' || dataTypeFilter === 'salary') && item.salaryMatches && item.salaryMatches.length > 0;
            const hasMatches = hasIncentives || hasSalaries;
            
            const groupDiv = document.createElement('div');
            groupDiv.className = 'smart-payment-group';
            groupDiv.style.cssText = `
                background: rgba(13, 22, 35, 0.7);
                border: 1px solid ${hasMatches ? 'rgba(0, 240, 255, 0.25)' : 'rgba(239, 68, 68, 0.25)'};
                border-radius: 12px;
                margin-bottom: 25px;
                overflow: hidden;
                box-shadow: 0 8px 25px rgba(0,0,0,0.4);
                border-right: 4px solid ${hasMatches ? '#00f0ff' : '#ef4444'};
                width: 100%;
            `;

            // Check if fields were modified
            const isModified = (field) => item.sourceExcelRow[`_isModified_${field}`] ? 'border: 1px solid #ff9800 !important; background: rgba(255, 152, 0, 0.05);' : 'border: 1px solid rgba(255,255,255,0.08);';
            const modIcon = (field) => item.sourceExcelRow[`_isModified_${field}`] ? '<i class="fas fa-magic" style="color: #ff9800; font-size: 0.7em; margin-right: 4px;" title="تعديل يدوي"></i>' : '';

            // 1. Source Header (Card) - Compact & Professional
            const sourceHtml = `
                <div class="smart-source-header" style="padding: 15px 20px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div class="status-indicator" style="display: flex; align-items: center; gap: 6px; background: ${hasMatches ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; padding: 4px 12px; border-radius: 20px; border: 1px solid ${hasMatches ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'};">
                                <i class="fas ${hasMatches ? 'fa-check-double' : 'fa-exclamation-circle'}" style="color: ${hasMatches ? '#10b981' : '#ef4444'}; font-size: 0.85em;"></i>
                                <span style="color: ${hasMatches ? '#10b981' : '#ef4444'}; font-size: 0.8em; font-weight: 600;">${hasMatches ? 'مطابقة ناجحة' : 'لا توجد مطابقة'}</span>
                            </div>
                            <span style="color: #666; font-size: 0.75em; font-family: monospace;">${this.smartExcelFileName || 'Excel_Data'}</span>
                        </div>
                        <div style="text-align: left;">
                            <div style="color: #00f0ff; font-weight: 700; font-size: 1.1em; letter-spacing: 0.5px;">${item.sourceExcelRow.name}</div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px;">
                        <div class="source-field">
                            <label style="display: block; color: #555; font-size: 0.7em; margin-bottom: 3px; font-weight: 600;">${modIcon('batchCode')}كود الملف</label>
                            <input id="smart_input_${index}_batchCode" type="text" value="${item.sourceExcelRow.batchCode || ''}" 
                                   onchange="app.updateSmartExcelValue(${index}, 'batchCode', this.value)"
                                   style="background: rgba(255,255,255,0.02); ${isModified('batchCode')} color: #ccc; width: 100%; padding: 3px 8px; border-radius: 4px; font-size: 0.85em;">
                        </div>
                        <div class="source-field">
                            <label style="display: block; color: #555; font-size: 0.7em; margin-bottom: 3px; font-weight: 600;">${modIcon('name')}الاسم</label>
                            <input id="smart_input_${index}_name" type="text" value="${item.sourceExcelRow.name || ''}" 
                                   onchange="app.updateSmartExcelValue(${index}, 'name', this.value)"
                                   style="background: rgba(255,255,255,0.02); ${isModified('name')} color: #ccc; width: 100%; padding: 3px 8px; border-radius: 4px; font-size: 0.85em;">
                        </div>
                        <div class="source-field">
                            <label style="display: block; color: #555; font-size: 0.7em; margin-bottom: 3px; font-weight: 600;">${modIcon('currentAccount')}رقم الحساب</label>
                            <input id="smart_input_${index}_currentAccount" type="text" value="${item.sourceExcelRow.currentAccount || ''}" 
                                   onchange="app.updateSmartExcelValue(${index}, 'currentAccount', this.value)"
                                   style="background: rgba(255,255,255,0.02); ${isModified('currentAccount')} color: #ccc; width: 100%; padding: 3px 8px; border-radius: 4px; font-size: 0.85em;">
                        </div>
                        <div class="source-field">
                            <label style="display: block; color: #555; font-size: 0.7em; margin-bottom: 3px; font-weight: 600;">${modIcon('currentBank')}البنك</label>
                            <input id="smart_input_${index}_currentBank" type="text" value="${item.sourceExcelRow.currentBank || ''}" 
                                   onchange="app.updateSmartExcelValue(${index}, 'currentBank', this.value)"
                                   style="background: rgba(255,255,255,0.02); ${isModified('currentBank')} color: #ccc; width: 100%; padding: 3px 8px; border-radius: 4px; font-size: 0.85em;">
                        </div>
                        <div class="source-field">
                            <label style="display: block; color: #00f0ff; font-size: 0.7em; margin-bottom: 3px; font-weight: 700;">${modIcon('modifiedAccount')}حساب جديد <i class="fas fa-star" style="font-size: 0.6em;"></i></label>
                            <input id="smart_input_${index}_modifiedAccount" type="text" value="${item.sourceExcelRow.modifiedAccount || ''}" 
                                   onchange="app.updateSmartExcelValue(${index}, 'modifiedAccount', this.value)"
                                   style="background: rgba(0, 240, 255, 0.03); ${item.sourceExcelRow[`_isModified_modifiedAccount`] ? 'border: 1px solid #ff9800 !important;' : 'border: 1px solid rgba(0,240,255,0.25);'} color: #00f0ff; width: 100%; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.9em; box-shadow: 0 0 10px rgba(0,240,255,0.05);">
                        </div>
                        <div class="source-field">
                            <label style="display: block; color: #555; font-size: 0.7em; margin-bottom: 3px; font-weight: 600;">${modIcon('modifiedBank')}البنك الجديد</label>
                            <input id="smart_input_${index}_modifiedBank" type="text" value="${item.sourceExcelRow.modifiedBank || ''}" 
                                   onchange="app.updateSmartExcelValue(${index}, 'modifiedBank', this.value)"
                                   style="background: rgba(255,255,255,0.02); ${isModified('modifiedBank')} color: #ccc; width: 100%; padding: 3px 8px; border-radius: 4px; font-size: 0.85em;">
                        </div>
                        <div class="source-field">
                            <label style="display: block; color: #555; font-size: 0.7em; margin-bottom: 3px; font-weight: 600;">${modIcon('returnDate')}تاريخ المرتد</label>
                            <input id="smart_input_${index}_returnDate" type="text" value="${item.sourceExcelRow.returnDate || ''}" 
                                   onchange="app.updateSmartExcelValue(${index}, 'returnDate', this.value)"
                                   style="background: rgba(255,255,255,0.02); ${isModified('returnDate')} color: #888; width: 100%; padding: 3px 8px; border-radius: 4px; font-size: 0.85em;">
                        </div>
                        <div class="source-field">
                            <label style="display: block; color: #555; font-size: 0.7em; margin-bottom: 3px; font-weight: 600;">${modIcon('modDate')}تاريخ التعديل</label>
                            <input id="smart_input_${index}_modDate" type="text" value="${item.sourceExcelRow.modDate || ''}" 
                                   onchange="app.updateSmartExcelValue(${index}, 'modDate', this.value)"
                                   style="background: rgba(255,255,255,0.02); ${isModified('modDate')} color: #888; width: 100%; padding: 3px 8px; border-radius: 4px; font-size: 0.85em;">
                        </div>
                        <div class="source-field">
                            <label style="display: block; color: #10b981; font-size: 0.7em; margin-bottom: 3px; font-weight: 700;">${modIcon('settlementNo')}رقم تسوية السداد</label>
                            <input id="smart_input_${index}_settlementNo" type="text" value="${item.sourceExcelRow.settlementNo || ''}" 
                                   onchange="app.updateSmartExcelValue(${index}, 'settlementNo', this.value)"
                                   style="background: rgba(16, 185, 129, 0.03); ${isModified('settlementNo')} color: #10b981; width: 100%; padding: 3px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600; border: 1px solid rgba(16, 185, 129, 0.2);">
                        </div>
                        <div class="source-field">
                            <label style="display: block; color: #10b981; font-size: 0.7em; margin-bottom: 3px; font-weight: 700;">${modIcon('settlementDate')}تاريخ التسوية</label>
                            <input id="smart_input_${index}_settlementDate" type="text" value="${item.sourceExcelRow.settlementDate || ''}" 
                                   onchange="app.updateSmartExcelValue(${index}, 'settlementDate', this.value)"
                                   style="background: rgba(16, 185, 129, 0.03); ${isModified('settlementDate')} color: #10b981; width: 100%; padding: 3px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600; border: 1px solid rgba(16, 185, 129, 0.2);">
                        </div>
                    </div>
                </div>
            `;

            // 2. Database Matches Sections (Incentives & Salaries) - More Compact
            let matchesHtml = '<div class="smart-matches-container" style="padding: 15px;">';
            
            if (hasMatches) {
                // Incentives Sub-Section
                if (hasIncentives) {
                    matchesHtml += `
                        <div class="unified-section-wrapper" style="margin-bottom: 12px; border: 1px solid rgba(0, 240, 255, 0.15); border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.1);">
                            <div style="padding: 8px 15px; background: rgba(0, 240, 255, 0.08); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-coins" style="color: #00f0ff; font-size: 0.8em;"></i>
                                    <span style="color: #00f0ff; font-size: 0.85em; font-weight: 700; letter-spacing: 0.3px;">مطابقات الحوافز</span>
                                </div>
                                <span style="background: rgba(0, 240, 255, 0.2); color: #00f0ff; padding: 2px 10px; border-radius: 12px; font-size: 0.75em; font-weight: 800; border: 1px solid rgba(0, 240, 255, 0.3);">${item.matches.length} سجل</span>
                            </div>
                            <div class="table-container" style="background: transparent; border: none; padding: 0; max-height: 300px; overflow-x: auto;">
                                <table class="data-table" style="width: 100%; min-width: 1000px; font-size: 0.75em; border-collapse: separate; border-spacing: 0;">
                                    <thead>
                                        <tr style="background: rgba(255,255,255,0.02);">
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">كود الملف</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">الاسم (DB)</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">رقم الحساب</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">البنك</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">حساب جديد</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">البنك الجديد</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">تاريخ المرتد</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">تاريخ التعديل</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">رقم تسوية السداد</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">تاريخ التسوية</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">الحالة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${item.matches.map(m => `
                                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                                <td style="padding: 6px 8px; white-space: nowrap;">${m.batchCode || '---'}</td>
                                                <td style="padding: 6px 8px; font-weight: 600; color: #fff; white-space: nowrap;">${m.name}</td>
                                                <td style="padding: 6px 8px; color: #888; font-family: monospace; white-space: nowrap;">${m.currentAccount || '---'}</td>
                                                <td style="padding: 6px 8px; color: #888; white-space: nowrap;">${m.currentBank || '---'}</td>
                                                <td style="padding: 6px 8px; color: #00f0ff; font-weight: 700; font-family: monospace; white-space: nowrap;">${m.modifiedAccount || '---'}</td>
                                                <td style="padding: 6px 8px; color: #ccc; white-space: nowrap;">${m.modifiedBank || '---'}</td>
                                                <td style="padding: 6px 8px; color: #888; white-space: nowrap;">${m.returnDate || '---'}</td>
                                                <td style="padding: 6px 8px; color: #888; white-space: nowrap;">${m.modDate || '---'}</td>
                                                <td style="padding: 6px 8px; color: #10b981; font-weight: 600; white-space: nowrap;">${m.settlementNo || '---'}</td>
                                                <td style="padding: 6px 8px; color: #10b981; white-space: nowrap;">${m.settlementDate || '---'}</td>
                                                <td style="padding: 6px 8px; white-space: nowrap;"><span class="badge-status ${m.status === 'تم التسوية' ? 'success' : 'warning'}" style="font-size: 0.8em; padding: 2px 6px;">${m.status || 'لم يتم التسوية'}</span></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }

                // Salaries Sub-Section
                if (hasSalaries) {
                    matchesHtml += `
                        <div class="unified-section-wrapper" style="border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.1);">
                            <div style="padding: 8px 15px; background: rgba(16, 185, 129, 0.08); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-money-check-alt" style="color: #10b981; font-size: 0.8em;"></i>
                                    <span style="color: #10b981; font-size: 0.85em; font-weight: 700; letter-spacing: 0.3px;">مطابقات المرتبات</span>
                                </div>
                                <span style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 2px 10px; border-radius: 12px; font-size: 0.75em; font-weight: 800; border: 1px solid rgba(16, 185, 129, 0.3);">${item.salaryMatches.length} سجل</span>
                            </div>
                            <div class="table-container" style="background: transparent; border: none; padding: 0; max-height: 300px; overflow-x: auto;">
                                <table class="data-table" style="width: 100%; min-width: 1000px; font-size: 0.75em; border-collapse: separate; border-spacing: 0;">
                                    <thead>
                                        <tr style="background: rgba(255,255,255,0.02);">
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">كود الملف</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">الاسم (DB)</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">رقم الحساب</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">البنك</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">حساب جديد</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">البنك الجديد</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">تاريخ المرتد</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">تاريخ التعديل</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">رقم تسوية السداد</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">تاريخ التسوية</th>
                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">الحالة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${item.salaryMatches.map(m => `
                                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                                <td style="padding: 6px 8px; white-space: nowrap;">${m.batchCode || '---'}</td>
                                                <td style="padding: 6px 8px; font-weight: 600; color: #fff; white-space: nowrap;">${m.name}</td>
                                                <td style="padding: 6px 8px; color: #888; font-family: monospace; white-space: nowrap;">${m.currentAccount || '---'}</td>
                                                <td style="padding: 6px 8px; color: #888; white-space: nowrap;">${m.currentBank || '---'}</td>
                                                <td style="padding: 6px 8px; color: #10b981; font-weight: 700; font-family: monospace; white-space: nowrap;">${m.modifiedAccount || '---'}</td>
                                                <td style="padding: 6px 8px; color: #ccc; white-space: nowrap;">${m.modifiedBank || '---'}</td>
                                                <td style="padding: 6px 8px; color: #888; white-space: nowrap;">${m.returnDate || '---'}</td>
                                                <td style="padding: 6px 8px; color: #888; white-space: nowrap;">${m.modDate || '---'}</td>
                                                <td style="padding: 6px 8px; color: #10b981; font-weight: 600; white-space: nowrap;">${m.settlementNo || '---'}</td>
                                                <td style="padding: 6px 8px; color: #10b981; white-space: nowrap;">${m.settlementDate || '---'}</td>
                                                <td style="padding: 6px 8px; white-space: nowrap;"><span class="badge-status ${m.status === 'تم التسوية' ? 'success' : 'warning'}" style="font-size: 0.8em; padding: 2px 6px;">${m.status || 'لم يتم التسوية'}</span></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }
            } else {
                matchesHtml += `
                    <div style="padding: 20px; text-align: center; color: #f87171; background: rgba(239, 68, 68, 0.05); border-radius: 8px; border: 1px dashed rgba(239, 68, 68, 0.2);">
                        <i class="fas fa-search-minus" style="margin-bottom: 8px; font-size: 1.25em;"></i>
                        <p style="margin: 0; font-size: 0.85em; font-weight: 500;">لم يتم العثور على أي سجلات مطابقة في قاعدة البيانات</p>
                    </div>
                `;
            }

            matchesHtml += '</div>';

            groupDiv.innerHTML = sourceHtml + matchesHtml;
            resultsContainer.appendChild(groupDiv);
        });
    }

    updateSmartExcelValue(index, field, value) {
        if (!this.smartMatchResults || !this.smartMatchResults[index]) return;
        
        const row = this.smartMatchResults[index].sourceExcelRow;
        
        // Save original value if not already saved
        const originalKey = `_original_${field}`;
        if (row[originalKey] === undefined) {
            row[originalKey] = row[field];
        }

        row[field] = value;
        
        // Mark as modified if different from original
        row[`_isModified_${field}`] = (String(value).trim() !== String(row[originalKey]).trim());

        console.log(`[SMART] Updated record ${index} field ${field} to:`, value, "Modified:", row[`_isModified_${field}`]);
        
        // To precisely update without losing focus: just find the input and update its border color if modified.
        // We do not re-render the whole list to avoid breaking user typing/tab flow.
        const inputId = `smart_input_${index}_${field}`;
        const inputEl = document.getElementById(inputId);
        if (inputEl) {
            if (row[`_isModified_${field}`]) {
                inputEl.style.border = '1px solid #ff9800';
                inputEl.style.boxShadow = '0 0 5px rgba(255, 152, 0, 0.3)';
            } else {
                inputEl.style.border = '1px solid rgba(255,255,255,0.1)';
                inputEl.style.boxShadow = 'none';
            }
        }
    }

    _renderSmartSubTable(items, head, body, badge, empty, type) {
        if (badge) badge.textContent = items.length;
        
        if (items.length === 0) {
            if (empty) empty.classList.remove('hidden');
            if (head) head.innerHTML = '';
            if (body) body.innerHTML = '';
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
                    <td>${item.excelName}</td>
                    <td style="font-weight: bold; color: #00f0ff;">${item.dbName}</td>
                    <td>${item.newAccountNumber || '---'}</td>
                    <td>${item.newBankName || '---'}</td>
                    <td><span class="badge-status success">${item.currentStatus || 'غير محدد'}</span></td>
                </tr>
            `).join('');
        }
    }

    async executeSmartPayment(targetType = 'all') {
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
            const updatePayload = {
                BatchCode: getVal(src.batchCode, src.BatchCode),
                NewAccount: getVal(src.modifiedAccount, src.ModifiedAccount),
                NewBank: getVal(src.modifiedBank, src.ModifiedBank),
                ReturnDate: getVal(src.returnDate, src.ReturnDate),
                ReturnApprovalDate: getVal(src.returnApprovalDate, src.ReturnApprovalDate),
                ModDate: getVal(src.modDate, src.ModDate),
                ModApprovalDate: getVal(src.modApprovalDate, src.ModApprovalDate),
                SettlementNo: getVal(src.settlementNo, src.SettlementNo),
                SettlementDate: getVal(src.settlementDate, src.SettlementDate)
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
        const triggerBtnId = targetType === 'incentive' ? 'btn-smart-execute-incentive' : targetType === 'salary' ? 'btn-smart-execute-salary' : 'btn-smart-execute-all';
        const triggerBtn = document.getElementById(triggerBtnId);

        const confirmed = confirm(`هل أنت متأكد من تنفيذ تحديث بيانات (${typeText}) لعدد (${updatesList.length}) سجل مطابق؟`);
        if (!confirmed) return;

        // Progress UI
        const progContainer = document.getElementById('smart-progress-container');
        const buttons = ['btn-smart-execute-incentive', 'btn-smart-execute-salary', 'btn-smart-execute-all', 'btn-smart-match'];

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
                document.getElementById('smart-payment-status-text').textContent = 'تم تنفيذ العملية بنجاح وتحديث كافة السجلات.';
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

    toggleSelectAllReturns(isChecked) {
        const checkboxes = document.querySelectorAll('#table-body .return-row-checkbox');
        checkboxes.forEach(cb => cb.checked = isChecked);
        this.updateSelectAllReturns();
    }

    updateSelectAllReturns() {
        const checkboxes = document.querySelectorAll('#table-body .return-row-checkbox');
        const checkedBoxes = document.querySelectorAll('#table-body .return-row-checkbox:checked');
        const selectAllCb = document.getElementById('selectAllCheckbox');
        const deleteBtn = document.getElementById('btn-delete-selected');
        const countBadge = document.getElementById('selected-count-badge');

        if (selectAllCb) {
            selectAllCb.checked = checkboxes.length > 0 && checkboxes.length === checkedBoxes.length;
        }

        if (deleteBtn && countBadge) {
            countBadge.textContent = checkedBoxes.length;
            deleteBtn.style.display = checkedBoxes.length > 0 ? 'inline-flex' : 'none';
        }
    }

    async deleteSelectedReturns() {
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
            console.error('Error in multi delete:', error);
            this.showToast('حدث خطأ أثناء الحذف المتعدد', 'error');
        } finally {
            this.hideLoading();
            this.updateSelectAllReturns();
        }
    }

    async deleteReturn(id) {
        const confirmed = await dialog.show({
            title: 'أرشفة سجل',
            message: 'هل أنت متأكد من نقل هذا السجل للأرشيف؟',
            type: 'question',
            showCancel: true,
            liteMode: true
        });
        if (!confirmed) return;
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
            this.showToast('خطأ: ' + error.message, 'error');
        }
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

        // Render Fields
        Object.keys(currentRow).forEach(key => {
            if (key === 'id' || key === 'Id' || key === 'AttachmentCount' || key.startsWith('_')) return;

            const group = document.createElement('div');
            group.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem;';

            // Full width for specific fields
            if (false) { // Condition removed since كود المرتد is removed
                group.style.gridColumn = 'span 2 / span 2';
            }

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
            input.value = currentRow[key] || '';
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

        const merged = { ...this.editingMainReturnOriginal, ...data };
        delete merged.id;
        delete merged.Id;
        delete merged.AttachmentCount;
        Object.keys(merged).forEach(k => {
            if (k.startsWith('_')) delete merged[k];
        });

        try {
            const result = await db.updateReturn(this.editingMainReturnId, merged);
            if (result && result.success) {
                this.returnsCache = null;
                this.showToast('تم تعديل السجل بنجاح', 'success');
                this.closeEditMainReturnModal();
                await this.loadReturns(this.pagination?.currentPage || 1, this.rowsPerPage, this.searchQuery, this.filterValue, this.attachmentFilterValue);
            } else {
                this.showToast('فشل تعديل السجل', 'error');
            }
        } catch (error) {
            this.showToast('خطأ: ' + error.message, 'error');
        }
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

        tbody.innerHTML = data.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td dir="ltr">${new Date(item.date || item.Date).toLocaleString('ar-EG')}</td>
                <td>${item.filename || item.Filename}</td>
                <td>${(item.recordCount || item.RecordCount || 0).toLocaleString()} سجل</td>
                <td>${((item.size || item.Size || 0) / 1024 / 1024).toFixed(2)} MB</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-sm btn-primary" onclick="app.restoreArchive(${item.id || item.Id})">
                            🔄 استعادة
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="app.deleteArchive(${item.id || item.Id})">
                            🗑️ حذف
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
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

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td dir="ltr">${dateStr}</td>
                    <td><code>${item.filename || item.Filename}</code></td>
                    <td>${(item.recordCount || item.RecordCount || 0).toLocaleString()} سجل</td>
                    <td>${this.formatFileSize(item.size || item.Size || 0)}</td>
                    <td>
                        <div style="display: flex; gap: 8px;">
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
            <button class="btn btn-sm btn-secondary" onclick="app.editUser(${user.id})">
              تعديل
            </button>
            ${user.username !== 'admin' ? `
              <button class="btn btn-sm btn-error" onclick="app.deleteUser(${user.id})">
                حذف
              </button>
            ` : ''}
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

    async loadDbPath() {
        try {
            const result = await db.fetchApi('/config/path');
            const pathInput = document.getElementById('db-path');
            if (pathInput) {
                pathInput.value = result.path || '';
                pathInput.readOnly = false; // Force editable
                pathInput.disabled = false; // Force enabled
            }

            // جلب حالة الجداولمن أن السيرفر يعمل
            document.getElementById('db-connection-status').innerHTML = 'حالة الاتصال: <span class="badge badge-success">متصل</span>';
        } catch (error) {
            document.getElementById('db-connection-status').innerHTML = 'حالة الاتصال: <span class="badge badge-error">غير متصل</span>';
        }
    }

    async saveDbPath() {
        const path = document.getElementById('db-path').value;
        if (!path) return;

        this.showLoading();
        try {
            const result = await db.fetchApi('/config/path', {
                method: 'POST',
                body: JSON.stringify({ path })
            });

            if (result.success) {
                this.showToast(result.message, 'success');
                document.getElementById('db-connection-status').innerHTML = 'حالة الاتصال: <span class="badge badge-success">متصل بنجاح</span>';
                setTimeout(() => location.reload(), 1500);
            } else {
                this.showToast(result.message, 'error');
                document.getElementById('db-connection-status').innerHTML = 'حالة الاتصال: <span class="badge badge-error">خطأ في المسار</span>';
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

            const result = await db.fetchApi('/config/browse', { method: 'POST' });

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
            const result = await db.fetchApi(`${baseUrl}/attachment/${id}`, { method: 'DELETE' });
            if (result.success) {
                this.showToast('تم حذف الملف', 'success');
                if (this.currentReturnId) {
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
        
        // Handle Excel Serial Numbers if they still come through as numbers
        if (typeof val === 'number' && val > 20000 && val < 60000) {
            dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
        } else if (val instanceof Date) {
            dateObj = val;
        } else {
            // Try parsing string
            dateObj = new Date(val);
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
        this.searchQuery = query;
        this.loadFullReturns(1, 50, query, true);
    }

    // ========================================
    async loadFullReturns(page = 1, pageSize = 50, query = '', isSearch = false) {
        console.log('[UNIFIED] loadFullReturns called:', { page, pageSize, query, isSearch });
        
        const loadingEl = document.getElementById('unified-loading');
        const resultsEl = document.getElementById('unified-results');
        const initialEl = document.getElementById('unified-empty-initial');
        const statsRow = document.getElementById('unified-stats-row');
        
        const hasIncentiveCache = this.returnsCache && this.returnsCache.length > 0;
        const hasSalaryCache = this.salaryReturnsCache && this.salaryReturnsCache.length > 0;

        if (!query || query.trim() === '') {
            // Show first Batch of data if cache exists
            if (hasIncentiveCache || hasSalaryCache) {
                this.handleUnifiedLocalSearch(''); // This will now show tables with default data
            } else {
                if (resultsEl) resultsEl.style.display = 'none';
                if (statsRow) statsRow.style.display = 'grid'; // Keep search card visible
            }
            return;
        }

        if (loadingEl) loadingEl.classList.remove('hidden');

        if (hasIncentiveCache || hasSalaryCache) {
            console.log('[UNIFIED] Using Local Cache Search');
            await this.handleUnifiedLocalSearch(query);
            if (loadingEl) loadingEl.classList.add('hidden');
            return;
        }

        try {
            // Fallback to API if not cached
            const [incentiveRes, salaryRes] = await Promise.all([
                db.getReturns(page, pageSize, query),
                db.getSalaryReturns(page, pageSize, query)
            ]);


            console.log('[UNIFIED] Results received:', { incentive: incentiveRes.data.length, salary: salaryRes.data.length });

            // Store data for export
            this.unifiedIncentiveData = incentiveRes.data || [];
            this.unifiedSalaryData = salaryRes.data || [];

            // Update Stats
            this.updateUnifiedStats(incentiveRes.stats, salaryRes.stats || { totalCount: salaryRes.data.length, totalAmount: salaryRes.data.reduce((sum, r) => sum + (parseFloat(r['صافي المستحق'] || r['Amount'] || 0)), 0) });

            // Render Tables
            this.renderUnifiedTable('incentive', incentiveRes.data);
            this.renderUnifiedTable('salary', salaryRes.data);

            if (loadingEl) loadingEl.classList.add('hidden');
            if (resultsEl) resultsEl.style.display = 'block';
            if (statsRow) statsRow.style.display = 'grid';

        } catch (error) {
            console.error('[UNIFIED] Search failed:', error);
            this.showToast('فشل البحث الموحد: ' + error.message, 'error');
            if (loadingEl) loadingEl.classList.add('hidden');
        }
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

    toggleUnifiedSection(type) {
        const wrapper = document.getElementById(`section-${type}`);
        if (wrapper) {
            wrapper.classList.toggle('collapsed');
        }
    }

    renderUnifiedTable(type, data) {
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

        const headers = Object.keys(data[0]).filter(k => !k.startsWith('_') && k.toLowerCase() !== 'id');

        // إعادة ترتيب الأعمدة ليكون "الاسم" هو العمود الأول (دعم الكشيدة: الاســــم)
        const nameIdx = headers.findIndex(h => h.includes('الاسم') || h.includes('المستفيد') || h.includes('الاســــم'));
        if (nameIdx > -1) {
            const nameHeader = headers.splice(nameIdx, 1)[0];
            headers.unshift(nameHeader);
        }

        // وضع "قيمة العملية" في المركز الثاني مباشرة بعد الاسم لمساندة التثبيت
        const valIdx = headers.findIndex(h => h.includes('قيمة العملية') || h.includes('المبلغ'));
        if (valIdx > -1) {
            const valHeader = headers.splice(valIdx, 1)[0];
            headers.splice(1, 0, valHeader);
        }

        // إضافة عمود الإجراءات في النهاية
        headers.push('الإجراءات');

        headers.forEach((h, index) => {
            const th = document.createElement('th');
            th.textContent = h;
            // تثبيت العمود الأول دائماً (الذي أصبح الاسم الآن)
            if (index === 0) {
                th.classList.add('sticky-col');
            } else if (index === 1 && (h.includes('قيمة العملية') || h.includes('المبلغ'))) {
                th.classList.add('sticky-col-2');
            }
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

        data.slice(0, 100).forEach(row => {
            const tr = document.createElement('tr');
            headers.forEach((h, index) => {
                const td = document.createElement('td');
                let value = row[h] || '';
                
                // تنسيق تلقائي للتواريخ إذا كان اسم العمود يحتوي على "تاريخ" أو القيمة تشبه التاريخ
                if (h.includes('تاريخ') && value && typeof value === 'string' && value.includes('-')) {
                    try {
                        const date = new Date(value);
                        if (!isNaN(date)) {
                            value = date.toLocaleDateString('en-GB').split('/').reverse().join('/'); // YYYY/MM/DD
                        }
                    } catch (e) {}
                }

                if (h === 'الإجراءات') {
                    const rowId = row.id || row.Id;
                    const hasAttachments = row.AttachmentCount > 0;
                    const badge = hasAttachments ? `<span class="badge-count" style="background:#ef4444; color:white; border-radius:12px; padding:2px 8px; font-size:0.75em; position:absolute; top:-12px; right:-12px; font-weight:bold; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4); border: 1.5px solid #fff; z-index: 10;">${row.AttachmentCount}</span>` : '';
                    const style = hasAttachments ? 'position: relative; border: 1px solid #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.3); transform: scale(1.05); transition: all 0.2s ease;' : 'position: relative; opacity: 0.6;';
                    
                    td.innerHTML = `
                        <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
                            <button class="btn-icon ${hasAttachments ? 'btn-primary' : 'btn-secondary'}" 
                                    style="${style}" 
                                    onclick="event.stopPropagation(); window.app.openAttachmentsModal('${rowId}', '${type === 'salary' ? 'salary' : 'returns'}')" 
                                    title="${hasAttachments ? 'عرض ' + row.AttachmentCount + ' مرفقات' : 'إضافة مرفق'}">
                                ${hasAttachments ? '🖼️' : '📎'}
                                ${badge}
                            </button>
                            <button class="btn-icon btn-info" 
                                    style="padding: 4px 8px; font-size: 1.1em; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px;" 
                                    onclick="event.stopPropagation(); window.app.openUnifiedFolder('${rowId}', '${type}')" 
                                    title="فتح المجلد المباشر">
                                📂
                            </button>
                        </div>
                    `;
                } else {
                    if (searchRegex && value && String(value).length < 500) {
                        const safeVal = String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        td.innerHTML = safeVal.replace(searchRegex, '<span class="search-highlight">$1</span>');
                    } else {
                        td.textContent = value;
                    }
                }
                
                if (index === 0) {
                    td.classList.add('sticky-col');
                    td.classList.add('clickable-name'); // لإضافة علامة الماوس
                    td.title = 'انقر مرتين للبحث بهذا الاسم';
                    
                    // ميزة النقر المزدوج للبحث السريع
                    td.ondblclick = () => {
                        const searchInput = document.getElementById('unified-search-input');
                        if (searchInput) {
                            searchInput.value = td.textContent.trim();
                            this.runUnifiedSearch();
                            this.showUnifiedToast('تم نسخ الاسم وبدء البحث السريع', 'info', 'بحث فوري');
                        }
                    };
                } else if (index === 1 && (h.includes('قيمة العملية') || h.includes('المبلغ'))) {
                    td.classList.add('sticky-col-2');
                }
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

        const filterData = (data) => {
            if (!data) return [];
            return data.filter(row => {
                const searchStr = row._searchStr || '';
                return words.every(word => searchStr.includes(word));
            });
        };

        const incentiveResults = filterData(this.returnsCache);
        const salaryResults = filterData(this.salaryReturnsCache);

        this.unifiedIncentiveData = incentiveResults;
        this.unifiedSalaryData = salaryResults;

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

App.prototype.handleReportSearchInput = function (query) {
    const suggestionsContainer = document.getElementById('report-search-suggestions');
    if (!suggestionsContainer) return;

    if (!query || query.length < 1) {
        suggestionsContainer.classList.add('hidden');
        return;
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
        // إذا لم يكن الكاش متاحاً، نحاول ملئه
        populateFunc();
        suggestionsContainer.classList.add('hidden');
        return;
    }

    const normQuery = this.normalizeArabic(query);
    const nameKeys = ['Name', 'FullName', 'الاسم', 'الإسم', 'اسم العميل', 'الاسم بالكامل', 'Full Name', 'اسم الموظف', 'اسم_العميل', 'الاســــم'];

    const uniqueNames = new Set();
    cache.forEach(record => {
        const rawName = this.findValue(record, nameKeys);
        if (rawName) {
            const normName = this.normalizeArabic(rawName);
            if (normName.includes(normQuery)) {
                uniqueNames.add(rawName);
            }
        }
    });

    const matches = Array.from(uniqueNames).slice(0, 10); // الحد الأقصى 10 اقتراحات

    if (matches.length > 0) {
        suggestionsContainer.innerHTML = matches.map(name => `
            <div class="autocomplete-suggestion" onclick="app.selectReportSuggestion('${name.replace(/'/g, "\\'")}')">
                ${name}
            </div>
        `).join('');
        suggestionsContainer.classList.remove('hidden');
    } else {
        suggestionsContainer.classList.add('hidden');
    }
};

App.prototype.selectReportSuggestion = function (name) {
    const input = document.getElementById('report-search-name');
    if (input) input.value = name;
    document.getElementById('report-search-suggestions')?.classList.add('hidden');
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
        const normalizedName = this.normalizeArabic(name);

        // 1. Try to use Local Cache for faster performance if available
        if (this.currentPage === 'salary-returns' && this.salaryReturnsCache) {
            console.log('[REPORT] Using Salary Returns Cache...');
            sourceData = this.salaryReturnsCache;
        } else if (this.currentPage === 'returns' && this.returnsCache) {
            console.log('[REPORT] Using Incentive Returns Cache...');
            sourceData = this.returnsCache;
        } else {
            // 2. Fallback to API if cache is not available
            console.log('[REPORT] Cache not available, fetching from API...');
            let apiResponse;
            if (this.currentPage === 'salary-returns') {
                apiResponse = await db.getSalaryReturns(1, 2000, name, 'all');
            } else {
                apiResponse = await db.getReturns(1, 2000, name, 'all');
            }
            sourceData = apiResponse?.data || [];
        }

        // 3. Filter data locally with Case-Insensitive Arabic Normalization
        let filtered = sourceData.filter(r => {
            const nameKeys = ['الاسم', 'الاســــم', 'Name', 'FullName', 'المستفيد', 'اسم الموظف', 'الإسم'];
            const rawName = this.findValue(r, nameKeys) || '';
            const normalizedRowName = this.normalizeArabic(rawName);
            
            // Match if row name includes the query
            if (!normalizedRowName.includes(normalizedName)) return false;

            // Filter by Settlement Status
            // For Salary Returns, we often have a 'حالة التسوية' field directly
            const settlementStatusKeys = ['حالة التسوية', 'Status', 'SettlementStatus'];
            const settlementVal = String(this.findValue(r, settlementStatusKeys) || '').trim();
            
            // For Incentive Returns, we often check the Modification Date
            const modDateKeys = ['تاريخ اعتماد التعديل', 'تاريخ التسوية', 'ModificationDate', 'تاريخ التعديل'];
            const modDate = this.findValue(r, modDateKeys);
            const hasModDate = modDate && String(modDate).trim() !== '' && String(modDate) !== '-';

            // Determination of isSettled:
            // 1. If 'حالة التسوية' says 'تمت التسوية' or similar
            // 2. Or if it has a modification date
            let isSettled = hasModDate || settlementVal.includes('تمت') || settlementVal.includes('سداد') || settlementVal.includes('Settled');

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

            const modDateKeys = ['تاريخ اعتماد التعديل', 'تاريخ التسوية', 'ModificationDate', 'تاريخ التعديل'];
            const modDate = this.findValue(r, modDateKeys);
            const isSettled = modDate && String(modDate).trim() !== '' && String(modDate) !== '-';

            if (isSettled) {
                totalSettled += amount;
                countSettled++;
            } else {
                totalUnsettled += amount;
                countUnsettled++;
            }

            const oldAccKeys = ['رقم الحساب القديم', 'OldAccount', 'رقم_الحساب_القديم', 'رقم الحساب'];
            const newAccKeys = ['رقم الحساب الجديد', 'NewAccount', 'رقم_الحساب_الجديد', 'رقم الحساب المعدل'];
            const returnDateKeys = ['ت. المرتد', 'ReturnDate', 'تاريخ_المرتد', 'تاريخ المرتد'];

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td style="font-family: monospace; white-space: nowrap;">${this.findValue(r, oldAccKeys) || '-'}</td>
                <td style="font-family: monospace; white-space: nowrap;">${this.findValue(r, newAccKeys) || '-'}</td>
                <td>${this.findValue(r, returnDateKeys) || '-'}</td>
                <td style="font-weight: bold;">${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td>${modDate || '-'}</td>
                <td style="color: ${isSettled ? '#059669' : '#dc2626'};">${isSettled ? 'تم التسوية' : 'تحت التسوية'}</td>
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

App.prototype.showToast = function (message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: toast-in 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toast-out 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) return obj[key];
        const foundKey = Object.keys(obj).find(k => k.trim() === key);
        if (foundKey) return obj[foundKey];
    }
    return null;
};

App.prototype.parseAmount = function (val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    // Remove non-numeric characters except dot and minus
    const cleaned = String(val).replace(/[^0-9.-]/g, '');
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
                resolve(jsonData);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
};

App.prototype.loadFromOfflineStorage = async function () {
    try {
        console.log('[OFFLINE] Loading initial data from IndexedDB...');
        
        // 1. Load Incentive Returns
        const cachedIncentive = await db.getLocalCache('returns_data_v2');
        if (cachedIncentive && Array.isArray(cachedIncentive) && cachedIncentive.length > 0) {
            this.returnsCache = cachedIncentive.map(row => {
                const settlementNo = row['رقم تسوية السداد'] || '';
                const hasSettlement = settlementNo && String(settlementNo).trim() !== '';
                row['حالة التسوية'] = hasSettlement ? 'تم التسوية' : 'لم يتم التسوية';
                
                // Ensure search index exists
                if (!row._searchStr) {
                    const originalValues = Object.entries(row)
                        .filter(([k, v]) => !k.startsWith('_') && v !== null && v !== undefined)
                        .map(([k, v]) => String(v).toLowerCase());
                    row._searchStr = originalValues.join(' ');
                }
                return row;
            });
            console.log(`[OFFLINE] Restored ${cachedIncentive.length} incentive records.`);
        }

        // 2. Load Salary Returns
        const cachedSalary = await db.getLocalCache('salary_returns_data_v1');
        if (cachedSalary && Array.isArray(cachedSalary) && cachedSalary.length > 0) {
            this.salaryReturnsCache = cachedSalary.map(row => {
                if (!row._searchStr) {
                    const originalValues = Object.entries(row)
                        .filter(([k, v]) => !k.startsWith('_') && v !== null && v !== undefined)
                        .map(([k, v]) => String(v).toLowerCase());
                    row._searchStr = originalValues.join(' ');
                }
                return row;
            });
            console.log(`[OFFLINE] Restored ${cachedSalary.length} salary records.`);
        }

        // Initial render if applicable
        if (this.currentPage === 'returns' && this.returnsCache) {
            this.handleLocalSearch(this.searchQuery, this.filterValue, this.attachmentFilterValue, 1, this.rowsPerPage, false);
        } else if (this.currentPage === 'full-returns' && (this.returnsCache || this.salaryReturnsCache)) {
            this.loadFullReturns(1, 50, this.searchQuery, true);
        }

    } catch (e) {
        console.warn('[OFFLINE] Failed to load from offline storage:', e);
    }
};


App.prototype.populateReturnsCache = async function () {
    if (this.isCaching) return;
    this.isCaching = true;

    const container = document.getElementById('sync-progress-container');
    const bar = document.getElementById('sync-bar-inner');
    const perc = document.getElementById('sync-percentage');
    const statusText = document.getElementById('sync-status-text');

    if (container) container.classList.remove('hidden');
    if (statusText) statusText.textContent = 'جاري مزامنة المليون سجل...';

    try {
        if (bar) bar.style.width = '20%';
        if (perc) perc.textContent = '20%';

        console.log('[SYNC] Background synchronization started...');
        const allData = await db.getAllReturns();

        if (bar) bar.style.width = '70%';
        if (perc) perc.textContent = '70%';
        if (statusText) statusText.textContent = 'جاري تحديث القاعدة المحلية...';

        // Optimized mapping for 1M records - Unified Settlement Logic
        this.returnsCache = allData.map(row => {
            const amountVal = row['قيمة العملية'] || row[' قيمة العملية'] || row['ProcessValue'] || row['المبلغ'] || row['Amount'];
            row._amount = this.parseAmount(amountVal);
            row._normStatus = this.normalizeArabic(row['الحالة'] || row['Status'] || row['حالة الارتداد'] || '');

            const settlementNo = row['رقم تسوية السداد'] || '';
            const hasSettlement = settlementNo && String(settlementNo).trim() !== '';
            row['حالة التسوية'] = hasSettlement ? 'تم التسوية' : 'لم يتم التسوية';
            row._isSettled = hasSettlement;

            // Comprehensive Search index for 1M records
            const originalValues = Object.entries(row)
                .filter(([k, v]) => !k.startsWith('_') && v !== null && v !== undefined)
                .map(([k, v]) => String(v).toLowerCase());
            const normalizedValues = originalValues.map(v => this.normalizeArabic(v));
            row._searchStr = [...new Set([...originalValues, ...normalizedValues])].join(' ');

            return row;
        });

        // Save to IndexedDB for next startup
        await db.setLocalCache('returns_data_v2', this.returnsCache);

        if (bar) bar.style.width = '100%';
        if (perc) perc.textContent = '100%';
        if (statusText) statusText.textContent = 'تم التحديث بنجاح';

        this.showToast('تم تحديث البيانات من السيرفر بنجاح', 'success');

        // Optional: refresh view if filtering is active
        if (this.currentPage === 'returns') {
            this.handleLocalSearch(this.searchQuery, this.filterValue, this.attachmentFilterValue, 1, this.rowsPerPage, false);
        }

        setTimeout(() => {
            if (container) container.classList.add('hidden');
        }, 2000);

    } catch (e) {
        console.error('[SYNC] Cache population failed:', e);
        if (statusText) statusText.textContent = 'فشلت المزامنة!';
        if (bar) bar.style.background = '#ef4444';
    } finally {
        this.isCaching = false;
    }
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
            if (smartSelect) {
                smartSelect.innerHTML = '<option value="">كل الاشهر</option>' + result.data.map(m => `<option value="${m}">${m}</option>`).join('');
            }
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

App.prototype.handleMonthFilterChange = async function (val) {
    console.log('[FILTER] Month filter changed:', val);
    this.monthFilterValue = val;
    this.currentPage_num = 1;
    await this.loadReturns(1, this.rowsPerPage, this.searchQuery, this.filterValue, this.attachmentFilterValue);
};

App.prototype.handleSettlementFilterChange = async function (val) {
    // This is now handled inside the class method above for consistency
    // Keeping this prototype as a proxy if needed by HTML inline events
    this.settlementFilterValue = val;
    this.currentPage_num = 1;
    await this.loadReturns(1, this.rowsPerPage, this.searchQuery, this.filterValue, this.attachmentFilterValue);
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
    console.log('[LOAD] loadSalaryReturns called:', { page, pageSize, search, append });
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

    const uploadDateFilter = document.getElementById('salary-upload-date-filter')?.value || 'all';
    if (uploadDateFilter && uploadDateFilter !== 'all') {
        this.salaryUploadDateFrom = uploadDateFilter;
        this.salaryUploadDateTo = uploadDateFilter;
    }

    // Populate Upload Date Filter Options if empty
    const uploadSelect = document.getElementById('salary-upload-date-filter');
    if (uploadSelect && uploadSelect.options.length <= 1) {
        try {
            const dates = await db.getSalaryUploadDates();
            if (dates && Array.isArray(dates) && dates.length > 0) {
                uploadSelect.innerHTML = '<option value="all">كل التواريخ ▼</option>';
                dates.forEach(d => {
                    if (d) {
                        const opt = document.createElement('option');
                        opt.value = d;
                        opt.textContent = d;
                        uploadSelect.appendChild(opt);
                    }
                });
            }
        } catch (e) {
            console.warn('Failed to load salary upload dates', e);
        }
    }

    console.log('[SALARY FILTERS]', {
        attachment: this.salaryAttachmentFilterValue,
        settlement: this.salarySettlementFilterValue,
        returnStatus: this.salaryReturnStatusFilterValue,
        month: this.salaryMonthFilterValue,
        uploadFrom: this.salaryUploadDateFrom,
        uploadTo: this.salaryUploadDateTo
    });

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
            this.salaryUploadDateTo
        );

        if (response.data && response.data.length > 0) {
            let dataToUse = response.data.filter(row => row !== null);
            let displayStats = response.stats;

            // Normalize Settlement Status
            dataToUse = dataToUse.map(row => {
                const settlementNo = row['رقم تسوية السداد'] || '';
                const hasSettlement = settlementNo && String(settlementNo).trim() !== '';
                row['حالة التسوية'] = hasSettlement ? 'تم التسوية' : 'لم يتم التسوية';
                return row;
            });

            // Filter by Settlement first
            if (this.salarySettlementFilterValue && this.salarySettlementFilterValue !== 'all' && this.salarySettlementFilterValue !== 'الكل') {
                const mode = this.salarySettlementFilterValue.trim();
                dataToUse = dataToUse.filter(row => {
                    const actualVal = (row['حالة التسوية'] || '').trim();
                    return actualVal === mode;
                });
            }

            // Filter by Return Status
            if (this.salaryReturnStatusFilterValue && this.salaryReturnStatusFilterValue !== 'all' && this.salaryReturnStatusFilterValue !== 'الكل') {
                const mode = this.salaryReturnStatusFilterValue.toLowerCase();
                dataToUse = dataToUse.filter(row => {
                    const status = (row['الحالة'] || row['Status'] || '').toLowerCase();
                    return status.includes(mode);
                });
            }

            // Filter by Month next
            if (this.salaryMonthFilterValue && this.salaryMonthFilterValue !== 'all') {
                const selectedMonth = this.salaryMonthFilterValue;
                dataToUse = dataToUse.filter(row => {
                    const fileCodeKeys = ['كـــود الملف', 'كود الملف', 'كُـــود المـلف', 'كـــود المـلف', 'FileCode', 'كود_الملف'];
                    const fileCode = this.findValue(row, fileCodeKeys) || '';
                    return String(fileCode).includes(selectedMonth);
                });
            }

            if (dataToUse.length !== response.data.length) {
                // Manually calculate stats if local filtering was applied
                let totalAmount = 0, settledAmount = 0, pendingAmount = 0;
                let settled = 0, pending = 0;

                dataToUse.forEach(row => {
                    const amountVal = row['قيمة العملية'] || row[' قيمة العملية'] || row['ProcessValue'] || row['المبلغ'] || row['Amount'];
                    const num = this.parseAmount(amountVal);
                    totalAmount += num;
                    if (row['حالة التسوية'] === 'تم التسوية' || row['حالة التسوية'] === 'تمت التسوية') {
                        settled++;
                        settledAmount += num;
                    } else {
                        pending++;
                        pendingAmount += num;
                    }
                });

                displayStats = {
                    filteredCount: dataToUse.length,
                    totalAmount,
                    successCount: settled,
                    settledAmount,
                    pendingCount: pending,
                    pendingAmount
                };
            }

            if (append) {
                this.salaryReturnsData = [...this.salaryReturnsData, ...dataToUse];
            } else {
                this.salaryReturnsData = dataToUse;
                this.salaryHeaders = this.extractSalaryHeaders(this.salaryReturnsData);
            }
            this.salaryPagination = response.pagination;
            if (dataToUse.length !== response.data.length) {
                this.salaryPagination.total = dataToUse.length;
            }
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

        const dataToRender = append ? this.salaryReturnsCache : null;
        this.renderSalaryTable(dataToRender, append);

        // Update Global Stats if this is the initial non-filtered load
        const isFiltered = this.salarySearchQuery || (this.salaryAttachmentFilterValue !== 'all') || (this.salarySettlementFilterValue !== 'all');
        if (!isFiltered && response.stats) {
            this.salaryGlobalStats.count = response.stats.total || response.stats.totalCount || response.stats.filteredCount;
            this.salaryGlobalStats.amount = response.stats.totalAmount;
        }

        this.updateSalaryStats(this.currentDisplayStats || response.stats);

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

        // إعادة ترتيب الأعمدة: وضع الاسم في المقدمة دائمًا
        let displayHeaders = [...this.salaryHeaders];
        const nameKeys = ['الاسم', 'الاســــم', 'Name', 'FullName'];
        const nameIdx = displayHeaders.findIndex(h => nameKeys.includes(h));

        if (nameIdx !== -1) {
            const nameHeader = displayHeaders.splice(nameIdx, 1)[0];
            displayHeaders.unshift(nameHeader);
        }

        // إضافة "الرقم القومي" بعد الاسم مباشرة إن لم يوجد
        if (!displayHeaders.some(h => h.includes('الرقم القومي') || h.includes('الرقم_القومي'))) {
            const currentNameIdx = displayHeaders.findIndex(h => nameKeys.includes(h));
            if (currentNameIdx !== -1) {
                displayHeaders.splice(currentNameIdx + 1, 0, 'الرقم القومي');
            } else {
                displayHeaders.unshift('الرقم القومي');
            }
        }

        // إضافة عمود "الشهر"
        if (!displayHeaders.includes('الشهر')) {
            const nidIdx = displayHeaders.findIndex(h => h.includes('الرقم القومي') || h.includes('الرقم_القومي'));
            if (nidIdx !== -1) {
                displayHeaders.splice(nidIdx + 1, 0, 'الشهر');
            } else {
                displayHeaders.push('الشهر');
            }
        }

        // إضافة عمود "تاريخ الرفع"
        if (!displayHeaders.includes('تاريخ الرفع')) {
            displayHeaders.push('تاريخ الرفع');
        }

        // إضافة عمود "حالة التسوية" في النهاية
        if (!displayHeaders.includes('حالة التسوية')) {
            displayHeaders.push('حالة التسوية');
        }

        displayHeaders.unshift('#');
        displayHeaders.unshift('<input type="checkbox" id="selectAllSalaryCheckbox" onchange="window.app.toggleSelectAllSalaryReturns(this.checked)" style="transform: scale(1.2); cursor: pointer;" title="تحديد الكل">');

        tableHeaders.innerHTML = '<tr>' + displayHeaders.map(h => {
            const hNorm = h.replace(/ـ/g, '').replace(/[أإآ]/g, 'ا').toLowerCase();
            const isNameCol = hNorm.includes('الاسم') || hNorm.includes('name') || hNorm.includes('fullname');

            let isSticky = '';
            if (h.includes('<input')) isSticky = 'sticky-col';
            else if (h === '#') isSticky = 'sticky-col-2';
            else if (isNameCol) isSticky = 'sticky-col-3';
            else if (h.includes('قيمة العملية') || h.includes('المبلغ')) isSticky = 'sticky-col-4';

            let dynamicClass = '';
            if (h === '#') dynamicClass = 'col-id';
            if (isNameCol) dynamicClass = 'col-name';

            return `<th class="sci-fi-th ${isSticky} ${dynamicClass}">${h}</th>`;
        }).join('') + '<th class="sci-fi-th col-actions" style="text-align:center;">الإجراءات</th></tr>';
        tableBody.innerHTML = '';
        this._displaySalaryHeaders = displayHeaders;
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
                let val = row[h] ?? '';
                let rawVal = String(val);

                if (h === '#') {
                    val = previousRowCount + rowIndex + 1;
                    rawVal = String(val);
                } else if (h.includes('<input')) {
                    val = `<input type="checkbox" class="salary-row-checkbox" value="${rowId}" onchange="window.app.updateSelectAllSalaryReturns()" style="transform: scale(1.2); cursor: pointer;">`;
                } else if (h === 'الاسم' || h === 'الاسم ') {
                    val = row['الاسم'] || row['الاسم '] || row['Name'] || '';
                    rawVal = String(val);
                } else if (h === 'الرقم القومي' || h === 'الرقم_القومي') {
                    for (const key in row) {
                        const lowKey = key.toLowerCase();
                        if ((lowKey.includes('national') || lowKey.includes('nid') || lowKey.includes('قومي')) && row[key]) {
                            val = row[key];
                            break;
                        }
                    }
                    rawVal = String(val);
                } else if (h === 'الشهر') {
                    const fileCodeKeys = ['كـــود الملف', 'كود الملف', 'FileCode'];
                    const fileCode = this.findValue(row, fileCodeKeys) || '';
                    if (fileCode && String(fileCode).includes('-')) {
                        const parts = String(fileCode).split('-');
                        if (parts.length >= 2) {
                            val = parts[parts.length - 2] + '-' + parts[parts.length - 1];
                        }
                    }
                    rawVal = String(val);
                } else if (h === 'تاريخ الرفع') {
                    val = row['UploadDate'] || row['تاريخ الرفع'] || '';
                    rawVal = String(val);
                } else if (h === 'حالة التسوية') {
                    const actualVal = (row[h] || '').trim();
                    rawVal = String(actualVal);
                    if (actualVal === 'تم التسوية' || actualVal === 'تمت التسوية') {
                        val = '<span class="badge-status success">تم التسوية ✅</span>';
                    } else if (actualVal === 'لم يتم التسوية') {
                        val = '<span class="badge-status pending">لم يتم التسوية ⏳</span>';
                    } else {
                        val = actualVal;
                    }
                } else {
                    // Format dates
                    if ((h.includes('تاريخ') || h.includes('Date')) && val) {
                        val = this.formatDate(val);
                        rawVal = val;
                    }

                    // Format numbers
                    if ((h.includes('قيمة') || h.includes('المبلغ') || h.includes('Amount')) && val) {
                        const num = parseFloat(val);
                        if (!isNaN(num)) {
                            val = `<span class="${num >= 0 ? 'amount-positive' : 'amount-negative'}">${num.toLocaleString()}</span>`;
                            rawVal = num.toLocaleString();
                        }
                    }
                }

                // تطبيق التلوين على كل الحقول النصية (بما فيها الاسم) إذا تطابقت مع البحث
                if (searchRegex && h !== '#' && !h.includes('<input') && h !== 'حالة التسوية') {
                    if (rawVal && String(rawVal).length < 500 && !String(val).includes('<')) {
                        val = String(rawVal).replace(searchRegex, '<span class="search-highlight">$1</span>');
                    }
                }

                const hNorm = h.replace(/ـ/g, '').replace(/[أإآ]/g, 'ا').toLowerCase();
                const isNameCol = hNorm.includes('الاسم') || hNorm.includes('name') || hNorm.includes('fullname');

                let isSticky = '';
                if (h.includes('<input')) isSticky = 'sticky-col';
                else if (h === '#') isSticky = 'sticky-col-2';
                else if (isNameCol) isSticky = 'sticky-col-3';
                else if (h.includes('قيمة العملية') || h.includes('المبلغ')) isSticky = 'sticky-col-4';

                let dynamicClass = '';
                if (h === '#') dynamicClass = 'col-id';
                if (isNameCol) dynamicClass = 'col-name';

                return `<td class="${isSticky} ${dynamicClass}">${val}</td>`;
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
    }
};

App.prototype.showSalaryAutoSyncModal = function () {
    this.isSalarySync = true;
    this.showAutoSyncModal();
};

App.prototype.downloadSalaryTemplate = function () {
    const headers = [
        'كود الملف',
        'الاســــم',
        'الرقم القومي',
        'رقم الحساب',
        'البنك',
        'قيمة العملية',
        'الحالة',
        'السبب',
        'رقم الحساب بعد التعديل',
        'البنك بعد التعديل',
        'كود الفرع بعد التعديل',
        'رقم التعلية',
        'تاريخ التعلية',
        'تاريخ الارتداد',
        'تاريخ اعتماد المرتدات',
        'تاريخ التعديل',
        'تاريخ اعتماد التعديل',
        'رقم تسوية السداد',
        'تاريخ تسوية السداد'
    ];
    
    // إنشاء ورقة العمل بصفوف فارغة (رؤوس فقط)
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    
    // تنزيل الملف
    XLSX.writeFile(wb, "Salary_Returns_Template.xlsx");
    this.showToast('تم تحميل نموذج المرتبات بنجاح', 'success');
};

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
    console.log('[SALARY FILTER] Upload Date Select changed:', val);
    if (val && val !== 'all') {
        this.salaryUploadDateFrom = val;
        this.salaryUploadDateTo = val;
    } else {
        this.salaryUploadDateFrom = null;
        this.salaryUploadDateTo = null;
    }
    this.salaryCurrentPage = 1;
    await this.loadSalaryReturns(1, 50, this.salarySearchQuery);
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

    updateText('salary-count', formatNum(this.salaryGlobalStats.count || stats.systemTotalCount || stats.totalCount || stats.total));
    updateText('salary-amount', formatCurr(this.salaryGlobalStats.amount || stats.totalAmount));
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
    if (this.isSalaryCaching) return;
    this.isSalaryCaching = true;

    // Using the same UI elements as Returns if existing, else console logs only
    const container = document.getElementById('sync-progress-container');
    const bar = document.getElementById('sync-bar-inner');
    const perc = document.getElementById('sync-percentage');
    const status = document.getElementById('sync-status-text');

    if (container) container.classList.remove('hidden');
    if (status) status.textContent = 'جاري الاتصال بقاعدة البيانات...';
    if (bar) bar.style.width = '10%';
    if (perc) perc.textContent = '10%';

    console.log('[SALARY CACHE] Starting background data synchronization...');
    try {
        if (bar) bar.style.width = '30%';
        if (perc) perc.textContent = '30%';
        if (status) status.textContent = 'جاري تنزيل نسخة البيانات...';

        const allData = await db.getAllSalaryReturns();

        if (bar) bar.style.width = '80%';
        if (perc) perc.textContent = '80%';
        if (status) status.textContent = 'جاري معالجة السجلات...';

        let globalCount = 0;
        let globalAmount = 0;

        this.salaryReturnsCache = allData.map(row => {
            const amountVal = row['قيمة العملية'] || row[' قيمة العملية'] || row['ProcessValue'] || row['المبلغ'] || row['Amount'];
            const amt = this.parseAmount(amountVal);
            row._amount = amt;
            
            globalCount++;
            globalAmount += amt;

            row._normStatus = this.normalizeArabic(row['الحالة'] || row['Status'] || row['حالة الارتداد'] || '');
            {
                const settlementNo = row['رقم تسوية السداد'] || '';
                const hasSettlement = settlementNo && String(settlementNo).trim() !== '';
                row['حالة التسوية'] = hasSettlement ? 'تم التسوية' : 'لم يتم التسوية';
                row._isSettled = hasSettlement;
            }

            const originalValues = Object.entries(row)
                .filter(([k, v]) => !k.startsWith('_') && v !== null && v !== undefined)
                .map(([k, v]) => String(v).toLowerCase());

            const normalizedValues = originalValues.map(v => this.normalizeArabic(v));

            row._searchStr = [...new Set([...originalValues, ...normalizedValues])].join(' ');

            return row;
        });

        this.salaryGlobalStats = { count: globalCount, amount: globalAmount };

        // Save to IndexedDB for next startup
        await db.setLocalCache('salary_returns_data_v1', this.salaryReturnsCache);

        if (bar) bar.style.width = '100%';
        if (perc) perc.textContent = '100%';
        if (status) status.textContent = 'تمت المزامنة بنجاح';

        console.log(`[SALARY CACHE] Successfully cached ${allData.length} records for instant search.`);

        setTimeout(() => {
            if (container) container.classList.add('hidden');
        }, 2000);

        return allData;

    } catch (e) {
        console.error('[SALARY CACHE] Cache population failed:', e);
        if (status) status.textContent = 'فشلت المزامنة!';
        if (bar) bar.style.background = '#ef4444';
        throw e;
    } finally {
        this.isSalaryCaching = false;
    }
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
    const uploadDateFrom = this.salaryUploadDateFrom;
    const uploadDateTo = this.salaryUploadDateTo;

    const fileCodeKeys = ['كـــود الملف', 'كود الملف', 'كُـــود المـلف', 'كـــود المـلف', 'FileCode', 'كود_الملف'];

    const filtered = this.salaryReturnsCache.filter(row => {
        if (searchWords.length > 0) {
            const rowStr = row._searchStr || "";
            const originalSearchWords = (search || "").toLowerCase().split(/\s+/).filter(w => w.length > 0);

            const matchNormalized = searchWords.every(word => rowStr.includes(word));
            const matchOriginal = originalSearchWords.every(word => rowStr.includes(word));

            if (!matchNormalized && !matchOriginal) return false;
        }

        if (selectedMonth) {
            let fileCode = "";
            for (const k of fileCodeKeys) {
                if (row[k]) { fileCode = row[k]; break; }
            }
            if (!String(fileCode).includes(selectedMonth)) return false;
        }

        if (settlementMode) {
            const actualVal = (row['حالة التسوية'] || '').trim();
            if (actualVal !== settlementMode) return false;
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

        if (uploadDateFrom || uploadDateTo) {
            const uploadDate = row['تاريخ الرفع'] || row['UploadDate'];
            if (!uploadDate) return false;

            if (uploadDateFrom && uploadDate < uploadDateFrom) return false;
            if (uploadDateTo) {
                let toLimit = uploadDateTo;
                if (toLimit.length === 10) toLimit += " 23:59:59";
                if (uploadDate > toLimit) return false;
            }
        }

        return true;
    });

    console.timeEnd('[PERF] Local Salary Search');
    console.log(`[LOCAL SALARY SEARCH] Found ${filtered.length} matches.`);

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const pagedData = filtered.slice(start, start + pageSize);

    if (!append) {
        this.salaryReturnsData = pagedData;
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
        const isSettled = ((obj['حالة التسوية'] || '').trim() === 'تم التسوية');

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

    this.salarySearchQuery = '';
    this.salaryAttachmentFilterValue = 'all';
    this.salaryReturnStatusFilterValue = 'all';
    this.salarySettlementFilterValue = 'all';
    this.salaryMonthFilterValue = 'all';
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
        const attachFilter = document.getElementById('salary-attachment-filter')?.value || 'all';
        const dateFilter = document.getElementById('salary-upload-date-filter')?.value || 'all';

        let uploadFrom = null, uploadTo = null;
        if (dateFilter && dateFilter !== 'all') {
            uploadFrom = dateFilter;
            uploadTo = dateFilter;
        }

        const allData = await db.getAllSalaryReturns(this.salarySearchQuery, attachFilter, uploadFrom, uploadTo);

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

    Object.keys(row).forEach(key => {
        if (key === 'id' || key === 'Id' || key === 'AttachmentCount' || key.startsWith('_')) return;

        const group = document.createElement('div');
        group.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem;';

        const label = document.createElement('label');
        label.textContent = key;
        label.style.color = '#94a3b8';
        label.style.fontSize = '0.9rem';

        // جلب القيمة من المفتاح الأصلي إذا كان الحقل معاد تسميته
        let originalKey = key;
        if (key === 'رقم تسوية التعلية') originalKey = 'محدد كتسوية';
        else if (key === 'رقم تسوية السداد') originalKey = 'رقم استمارة اعادة التحويل / التسوية';
        else if (key === 'تاريخ تسوية التعلية') originalKey = 'تاريخ المرتدات';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = row[originalKey] ?? row[key] ?? '';
        input.dataset.key = key;
        input.style.cssText = `
            background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem;
            color: #f1f5f9; padding: 0.75rem; font-size: 1rem; outline: none;
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

    this.showLoading();
    try {
        const res = await fetch(`/salary-returns/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        const result = await res.json();
        if (result.success) {
            this.showToast('تم تحديث السجل بنجاح', 'success');
            this.closeEditSalaryModal();
            await this.loadSalaryReturns();
        } else {
            throw new Error(result.message || 'فشل التحديث');
        }
    } catch (e) {
        this.showToast(e.message, 'error');
    } finally {
        this.hideLoading();
    }
};

App.prototype.showSalaryImportModal = function () {
    this.isSalaryImport = true;
    document.getElementById('import-modal')?.classList.remove('hidden');

    // Change modal title to indicate salary
    const modalTitle = document.querySelector('#import-modal h3');
    if (modalTitle) modalTitle.textContent = "استيراد ملف مرتادات المرتبات";
};

App.prototype.hideImportModal = function () {
    document.getElementById('import-modal')?.classList.add('hidden');
    // Reset title
    const modalTitle = document.querySelector('#import-modal h3');
    if (modalTitle) modalTitle.textContent = "استيراد بيانات";

    setTimeout(() => { this.isSalaryImport = false; }, 500);
}

App.prototype.processSalaryFile = async function (file) {
    this.showLoading();
    this.hideImportModal();
    try {
        const data = await this.readExcelFile(file);
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
        const success = await db.deleteAllReturns();
        if (success) {
            this.showToast('تم نقل جميع سجلات الحوافز للأرشيف بنجاح', 'success');
            this.returnsCache = null;
            await this.loadReturns(1);
        } else {
            this.showToast('فشل حذف البيانات', 'error');
        }
    } catch (e) {
        this.showToast('خطأ في الاتصال: ' + e.message, 'error');
    } finally {
        this.hideLoading();
    }
};

App.prototype.confirmDeleteAllSalary = async function () {
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
        const success = await db.deleteAllSalaryReturns();
        if (success) {
            this.showToast('تم نقل جميع سجلات المرتبات للأرشيف بنجاح', 'success');
            this.salaryReturnsCache = null;
            await this.loadSalaryReturns(1);
        } else {
            this.showToast('فشل حذف البيانات', 'error');
        }
    } catch (e) {
        this.showToast('خطأ في الاتصال: ' + e.message, 'error');
    } finally {
        this.hideLoading();
    }
};

App.prototype.exportSalaryToExcel = async function () {
    this.showLoading();
    try {
        const allData = await db.getAllSalaryReturns(this.salarySearchQuery, this.salaryAttachmentFilterValue);
        if (!allData || allData.length === 0) {
            this.showToast('لا توجد بيانات لتصديرها', 'warning');
            return;
        }

        const headersToExport = this.salaryHeaders;
        const worksheetData = [headersToExport];
        allData.forEach(row => {
            const rowArray = headersToExport.map(header => row[header] === null || row[header] === undefined ? '' : row[header]);
            worksheetData.push(rowArray);
        });

        const ws = XLSX.utils.aoa_to_sheet(worksheetData);
        if (!ws['!views']) ws['!views'] = [];
        ws['!views'].push({ RTL: true });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "المرتبات");

        const fileName = `تقرير_المرتبات_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
        this.showToast('تم تصدير البيانات بنجاح', 'success');
    } catch (error) {
        console.error('Export Salary Error:', error);
        this.showToast('فشل تصدير البيانات', 'error');
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

            this.hubConnection.onreconnecting(() => this.updateSignalRUI('reconnecting'));
            this.hubConnection.onreconnected(() => this.updateSignalRUI('online'));
            this.hubConnection.onclose(() => this.updateSignalRUI('offline'));

            this.hubConnection.start()
                .then(() => {
                    const urlInfo = this.hubConnection.connection.baseUrl || url;
                    console.log(`[RealTime] Connected to SignalR Hub at: ${urlInfo}`);
                    this.updateSignalRUI('online');
                })
                .catch(err => {
                    console.error("[RealTime] Error connecting to SignalR:", err);
                    this.updateSignalRUI('offline');
                    if (window.app && window.app.showUnifiedToast) {
                        window.app.showUnifiedToast('فشل الاتصال بنظام الإشعارات اللحظية. يرجى التحقق من جدار الحماية.', 'warning', 'نظام الإشعارات');
                    }
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
 * Show a pleasant, non-intrusive floating notification card
 */
App.prototype.showSignalRNotification = function (sourceName, user, operation = "تحديث") {
    const cardId = 'signalr-notification-card';
    let card = document.getElementById(cardId);
    
    if (card) card.remove();
    
    card = document.createElement('div');
    card.id = cardId;
    card.dir = 'rtl';
    card.style.cssText = `
        position: fixed;
        top: 25px;
        left: 25px;
        width: 400px;
        background: linear-gradient(135deg, rgba(13, 22, 35, 0.95) 0%, rgba(20, 35, 55, 0.9) 100%);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        color: white;
        padding: 22px;
        z-index: 20000;
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-left: 6px solid #00f0ff;
        box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 0 20px rgba(0, 240, 255, 0.05);
        font-family: 'Cairo', sans-serif;
        animation: slideInNotificationLeft 0.8s cubic-bezier(0.19, 1, 0.22, 1);
        display: flex;
        flex-direction: column;
        gap: 18px;
    `;
    
    // Add Animations
    if (!document.getElementById('anim-signalr-professional')) {
        const style = document.createElement('style');
        style.id = 'anim-signalr-professional';
        style.innerHTML = `
            @keyframes slideInNotificationLeft {
                from { transform: translateX(-120%) scale(0.9); opacity: 0; }
                to { transform: translateX(0) scale(1); opacity: 1; }
            }
            @keyframes fadeOutNotificationLeft {
                to { transform: translateX(-120%) scale(0.9); opacity: 0; }
            }
            @keyframes pulseBorder {
                0% { box-shadow: 0 0 0 0 rgba(0, 240, 255, 0.4); }
                70% { box-shadow: 0 0 0 10px rgba(0, 240, 255, 0); }
                100% { box-shadow: 0 0 0 0 rgba(0, 240, 255, 0); }
            }
        `;
        document.head.appendChild(style);
    }
    
    card.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 15px;">
            <div style="min-width: 50px; height: 50px; background: rgba(0, 240, 255, 0.15); border-radius: 15px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(0,240,255,0.1);">
                <i class="fas fa-satellite-dish" style="color: #00f0ff; font-size: 1.4em;"></i>
            </div>
            <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <span style="font-size: 0.8em; color: #00f0ff; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">تحديث لحظي</span>
                    <span style="font-size: 0.75em; color: #555;">الآن</span>
                </div>
                <div style="line-height: 1.6; font-size: 1em; color: #e0e0e0;">
                    <strong style="color: #ffc107;">${user}</strong> قام بـ <span style="background: rgba(0,240,255,0.1); padding: 2px 8px; border-radius: 6px; color: #00f0ff;">${operation}</span> 
                    في <span style="font-weight: bold; color: #fff;">${sourceName}</span>.
                </div>
            </div>
        </div>
        
        <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 12px; font-size: 0.9em; color: #aaa; text-align: center; border: 1px dashed rgba(255,255,255,0.05);">
            هل ترغب في مزامنة البيانات الحالية؟
        </div>

        <div style="display: flex; gap: 12px;">
            <button id="noti-accept" class="btn" style="flex: 2; background: #00f0ff; color: #0d1623; font-weight: 800; padding: 12px; border-radius: 12px; border: none; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 0.95em; animation: pulseBorder 2s infinite;">
                <i class="fas fa-sync-alt"></i> نعم، تحديث الآن
            </button>
            <button id="noti-close" class="btn" style="flex: 1; background: rgba(255,255,255,0.05); color: #888; border: 1px solid rgba(255,255,255,0.08); padding: 12px; border-radius: 12px; cursor: pointer; transition: all 0.3s; font-size: 0.9em;">
                تجاهل
            </button>
        </div>
    `;
    
    document.body.appendChild(card);
    
    const acceptBtn = document.getElementById('noti-accept');
    const closeBtn = document.getElementById('noti-close');

    const removeCard = (delay = 500) => {
        card.style.animation = 'fadeOutNotificationLeft 0.8s cubic-bezier(0.19, 1, 0.22, 1) forwards';
        setTimeout(() => card.remove(), delay);
    };

    acceptBtn.onclick = async () => {
        // Feedback State
        acceptBtn.disabled = true;
        acceptBtn.style.background = '#10b981';
        acceptBtn.style.color = 'white';
        acceptBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري المزامنة...';
        
        try {
            await this.refreshCurrentPage();
            
            // Success Mark
            acceptBtn.innerHTML = '<i class="fas fa-check-circle"></i> تم التحديث بنجاح';
            setTimeout(() => removeCard(800), 1200);
        } catch (e) {
            acceptBtn.style.background = '#ef4444';
            acceptBtn.innerHTML = '<i class="fas fa-times-circle"></i> فشل التحديث';
            setTimeout(() => removeCard(800), 2000);
        }
    };
    
    closeBtn.onclick = () => removeCard();
    
    // Hover effects
    acceptBtn.onmouseover = () => { if (!acceptBtn.disabled) { acceptBtn.style.transform = 'translateY(-3px)'; acceptBtn.style.boxShadow = '0 8px 20px rgba(0,240,255,0.3)'; } };
    acceptBtn.onmouseout = () => { if (!acceptBtn.disabled) { acceptBtn.style.transform = 'translateY(0)'; acceptBtn.style.boxShadow = 'none'; } };
    closeBtn.onmouseover = () => { closeBtn.style.background = 'rgba(255,255,255,0.1)'; closeBtn.style.color = 'white'; closeBtn.style.borderColor = 'rgba(255,255,255,0.2)'; };
    closeBtn.onmouseout = () => { closeBtn.style.background = 'rgba(255,255,255,0.05)'; closeBtn.style.color = '#888'; closeBtn.style.borderColor = 'rgba(255,255,255,0.08)'; };

    // Auto remove after 20 seconds
    setTimeout(() => {
        if (card && card.parentElement && !acceptBtn.disabled) removeCard();
    }, 25000);
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

// Initialize App

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init(); // تفعيل تشغيل التطبيق
});
