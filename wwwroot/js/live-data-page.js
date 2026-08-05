// ============================================================================
// LiveDataPage - صفحة البيانات المباشرة (مطابقة تماماً لتصميم جدول المرتبات اللحظي)
// ============================================================================

class LiveDataPage {
    constructor(containerId) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        
        this.whitelist = {
            'Returns': {
                id: 'Returns',
                displayName: 'الحوافز والمرتدات العامة',
                apiUrl: '/returns',
                primaryKey: 'id',
                sensitiveFields: ['Password', 'PasswordHash', 'Token', 'SessionId', 'Secret', 'ApiKey', 'ConnectionString'],
                editable: true,
                changeCheckUrl: '/api/returns/changes'
            },
            'SalaryReturns': {
                id: 'SalaryReturns',
                displayName: 'المرتبات والأجور',
                apiUrl: '/salary-returns',
                primaryKey: 'id',
                sensitiveFields: ['Password', 'PasswordHash', 'Token', 'SessionId', 'Secret', 'ApiKey', 'ConnectionString'],
                editable: true,
                changeCheckUrl: '/api/salary-returns/changes'
            }
        };

        this.selectedTableId = 'Returns';
        this.data = [];
        this.columns = [];
        this.hiddenColumns = new Set();
        this.pinnedColumns = new Set();
        this.currentPage = 1;
        this.pageSize = 50;
        this.totalItems = 0;
        this.totalPages = 1;
        this.searchQuery = '';
        this.settlementFilter = 'all';
        this.yearFilter = 'all';
        this.monthFilter = 'all';
        this.autoSyncEnabled = true;
        this.isLoading = false;
        this.isLoadingMore = false;
        this.editingRowId = null;
        this.unsubscribeSync = null;

        // قاموس تعريب مسميات رؤوس الأعمدة بالكامل
        this.headerTranslations = {
            'id': 'الرقم المرجعي',
            'Id': 'الرقم المرجعي',
            'creditorName': 'الاسم الكامل',
            'creditorNationalId': 'الرقم القومي / الهوية',
            'creditorAccount': 'رقم الحساب الأصلي',
            'newCreditorAccount': 'رقم الحساب المعدل',
            'creditorBic': 'رمز البنك الأصلي',
            'newCreditorBic': 'رمز البنك المصحح',
            'creditorBranch': 'فرع البنك الأصلي',
            'newCreditorBranch': 'فرع البنك المصحح',
            'NEWCREDITORBRANCH': 'فرع البنك المصحح',
            'transactionAmount': 'قيمة العملية',
            'transactionStatus': 'حالة المعاملة',
            'reason': 'سبب الفشل / الارتداد',
            'settlementStatus': 'حالة التسوية',
            'paymentSettlementNo': 'رقم تسوية السداد',
            'accrualSettlementNo': 'رقم تسوية التعلية',
            'uploadDate': 'تاريخ الرفع',
            'UPLOADDATE': 'تاريخ الرفع',
            'returnDate': 'تاريخ المرتد / التعلية',
            'RETURNDATE': 'تاريخ المرتد / التعلية',
            'approvalDate': 'تاريخ اعتماد المرتد',
            'APPROVALDATE': 'تاريخ اعتماد المرتد',
            'editDate': 'تاريخ التعديل',
            'editApprovalDate': 'تاريخ اعتماد التعديل',
            'settlementPaymentDate': 'تاريخ السداد الفعلي',
            'editSource': 'مصدر التعديل',
            'batchId': 'رقم الدفعة',
            'ReturnCode': 'كود الملف',
            'AttachmentCount': 'عدد المرفقات',
            'ATTACHMENTCOUNT': 'عدد المرفقات',
            'ImportId': 'رقم الاستيراد',
            'IsDeleted': 'محذوف',
            'IsArchived': 'مؤرشف',
            'ArchivedBatchId': 'دفعة الأرشيف',
            'UpdatedAt': 'تاريخ التحديث'
        };
    }

    async init() {
        this.renderLayout();
        this.loadSavedTableSettings(this.selectedTableId);
        this.setupRealtimeSync();
        await this.loadData(false, false);
        this.setupInfiniteScroll();
    }

    setupRealtimeSync() {
        if (window.realtimeSync) {
            window.realtimeSync.init();
            this.unsubscribeSync = window.realtimeSync.subscribe('*', (payload) => {
                if (this.autoSyncEnabled) {
                    this.handleRealtimeUpdate(payload);
                }
            });

            window.realtimeSync.onStateChange((state, lastUpdated) => {
                this.updateSyncStatusUI(state, lastUpdated);
            });
        }
    }

    updateSyncStatusUI(state, lastUpdated) {
        const badge = document.getElementById('live-sync-status-badge');
        const timeEl = document.getElementById('live-last-updated-time');
        if (!badge) return;

        if (state === 'connected') {
            badge.className = 'badge-status success me-2';
            badge.innerHTML = '<i class="fas fa-wifi me-1"></i> متصل فوري';
        } else if (state === 'reconnecting') {
            badge.className = 'badge-status warning me-2';
            badge.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> إعادة اتصال...';
        } else {
            badge.className = 'badge-status me-2';
            badge.style.background = 'rgba(255,255,255,0.1)';
            badge.style.color = '#94a3b8';
            badge.innerHTML = '<i class="fas fa-signal me-1"></i> تحديث آمن';
        }

        if (timeEl && lastUpdated) {
            timeEl.textContent = lastUpdated.toLocaleTimeString('ar-EG');
        }
    }

    handleRealtimeUpdate(payload) {
        if (!this.autoSyncEnabled) return;
        this.loadData(true, false);
    }

    renderLayout() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="unified-premium-container" dir="rtl" style="width: 100%;">
                
                <!-- بطاقات إحصائيات البيانات المباشرة -->
                <div class="dashboard-stats-row-pro search-stats-summary" style="width: 100%; margin-bottom: 20px;">
                    <div class="stat-card-pro pro-total-summary">
                        <div class="stat-details-pro">
                            <span class="stat-label" id="live-stat-table-name">سجلات البيانات المباشرة</span>
                            <span class="stat-value" id="live-total-count">0</span>
                        </div>
                        <div class="stat-icon" style="background: rgba(0, 240, 255, 0.1); color: #00f0ff;">
                            <i class="fas fa-database"></i>
                        </div>
                    </div>
                    <div class="stat-card-pro pro-pending">
                        <div class="stat-details-pro">
                            <span class="stat-label">حالة التزامن المباشر</span>
                            <span class="stat-value" style="font-size: 1.1rem;" id="live-sync-status-badge">جاري الاتصال...</span>
                            <div class="stat-sub-row">
                                <span class="stat-label-sub">آخر تحديث:</span>
                                <span class="stat-value-sub" id="live-last-updated-time">--:--</span>
                            </div>
                        </div>
                        <div class="stat-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">
                            <i class="fas fa-signal"></i>
                        </div>
                    </div>
                </div>

                <!-- شريط الفلاتر والتحكم الفاخر المطابق لجدول المرتبات -->
                <div class="dashboard-controls-row-pro" style="width: 100%; margin-bottom: 20px;">
                    <div class="pro-controls-wrapper rtl-flex" style="gap: 12px; flex-wrap: wrap;">
                        
                        <!-- زر اختيار نوع الجدول -->
                        <div class="pro-filter-item" style="min-width: 200px;">
                            <label>نوع البيانات</label>
                            <select id="live-table-select" style="font-weight: bold; color: #00f0ff;">
                                <option value="Returns" selected>🎁 الحوافز والمرتدات العامة</option>
                                <option value="SalaryReturns">💵 المرتبات والأجور</option>
                            </select>
                        </div>

                        <!-- صندوق البحث المباشر السريع -->
                        <div class="pro-search-container" style="flex: 2; min-width: 260px;">
                            <i class="fas fa-search pro-search-icon"></i>
                            <input type="text" id="live-search-input" placeholder="البحث المباشر بالاسم، الرقم القومي، كود الملف، أو رقم الحساب..." value="${this.searchQuery}">
                        </div>

                        <!-- فلاتر التسوية والسنوات والشهور -->
                        <div class="pro-filters-container rtl-flex" style="flex: 2; gap: 10px; flex-wrap: wrap;">
                            <div class="pro-filter-item" style="flex: 1; min-width: 130px;">
                                <label>حالة التسوية</label>
                                <select id="live-settlement-filter">
                                    <option value="all">الكل</option>
                                    <option value="تم التسوية">تم التسوية</option>
                                    <option value="لم يتم التسوية">تحت التسوية</option>
                                </select>
                            </div>
                            <div class="pro-filter-item" style="flex: 1; min-width: 110px;">
                                <label>السنة</label>
                                <select id="live-year-filter">
                                    <option value="all">كل السنوات</option>
                                    <option value="2026">2026</option>
                                    <option value="2025">2025</option>
                                    <option value="2024">2024</option>
                                </select>
                            </div>
                            <div class="pro-filter-item" style="flex: 1; min-width: 110px;">
                                <label>الشهر</label>
                                <select id="live-month-filter">
                                    <option value="all">كل الشهور</option>
                                    <option value="01">01 - يناير</option>
                                    <option value="02">02 - فبراير</option>
                                    <option value="03">03 - مارس</option>
                                    <option value="04">04 - أبريل</option>
                                    <option value="05">05 - مايو</option>
                                    <option value="06">06 - يونيو</option>
                                    <option value="07">07 - يوليو</option>
                                    <option value="08">08 - أغسطس</option>
                                    <option value="09">09 - سبتمبر</option>
                                    <option value="10">10 - أكتوبر</option>
                                    <option value="11">11 - نوفمبر</option>
                                    <option value="12">12 - ديسمبر</option>
                                </select>
                            </div>

                            <button id="live-btn-column-toggle" class="btn-pro-action" style="height: 48px; border-radius: 12px; margin-top: auto; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff;" title="الأعمدة">
                                <i class="fas fa-columns me-1"></i> الأعمدة
                            </button>
                            <button id="live-btn-refresh" class="btn-pro-action btn-sync-pro" style="height: 48px; border-radius: 12px; margin-top: auto;" title="تحديث يدوي">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div id="live-column-selector-container" style="width: 100%; margin-bottom: 15px; display: none;"></div>
                <div id="live-alert-container" style="width: 100%;"></div>

                <!-- جدول البيانات المباشر المطور مع التثبيت أقصى اليمين -->
                <div class="table-container pro-table-container" style="width: 100%; flex: 1;">
                    <div class="table-wrapper-scroll" id="live-scroll-container" style="max-height: calc(100vh - 280px); overflow-y: auto; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08);">
                        <table class="data-table" id="live-table">
                            <thead>
                                <tr id="live-table-header">
                                    <th class="text-center sticky-col-1">#</th>
                                    <th>جاري التحميل...</th>
                                </tr>
                            </thead>
                            <tbody id="live-table-body">
                                <tr>
                                    <td colspan="10" class="text-center py-5 text-muted">
                                        <div class="loading-spinner-premium" style="margin: 20px auto;"></div>
                                        <p>جاري جلب البيانات المباشرة...</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div id="live-loading-more-indicator" style="display: none; text-align: center; padding: 15px; color: #00f0ff;">
                            <i class="fas fa-spinner fa-spin me-2"></i> جاري تحميل باقي السجلات تلقائياً...
                        </div>
                    </div>

                    <!-- شريط الحصيلة والتمرير المستمر -->
                    <div class="d-flex justify-content-between align-items-center mt-3 px-3 py-2" style="background: rgba(15, 23, 42, 0.4); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                        <div id="live-pagination-info" style="color: #94a3b8; font-weight: 600; font-size: 0.9rem;">
                            سجلات مستمرة: تم تحميل 0 من 0
                        </div>
                        <div style="color: #00f0ff; font-weight: 700; font-size: 0.85rem;">
                            <i class="fas fa-stream me-1"></i> التمرير المستمر مفعّل
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const tableSelect = document.getElementById('live-table-select');
        if (tableSelect) {
            tableSelect.addEventListener('change', (e) => {
                this.selectedTableId = e.target.value;
                this.currentPage = 1;
                this.data = [];
                const titleBadge = document.getElementById('live-stat-table-name');
                if (titleBadge) {
                    titleBadge.textContent = this.whitelist[this.selectedTableId].displayName;
                }
                this.loadSavedTableSettings(this.selectedTableId);
                this.loadData(false, false);
            });
        }

        const searchInput = document.getElementById('live-search-input');
        let searchTimeout = null;
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchQuery = e.target.value;
                    this.currentPage = 1;
                    this.data = [];
                    this.loadData(false, false);
                }, 400);
            });
        }

        const settlementFilter = document.getElementById('live-settlement-filter');
        if (settlementFilter) {
            settlementFilter.addEventListener('change', (e) => {
                this.settlementFilter = e.target.value;
                this.currentPage = 1;
                this.data = [];
                this.loadData(false, false);
            });
        }

        const yearFilter = document.getElementById('live-year-filter');
        if (yearFilter) {
            yearFilter.addEventListener('change', async (e) => {
                this.yearFilter = e.target.value;
                this.currentPage = 1;
                this.data = [];
                await this.loadAvailableMonths();
                this.loadData(false, false);
            });
        }

        const monthFilter = document.getElementById('live-month-filter');
        if (monthFilter) {
            monthFilter.addEventListener('change', (e) => {
                this.monthFilter = e.target.value;
                this.currentPage = 1;
                this.data = [];
                this.loadData(false, false);
            });
        }

        // تحميل الشهور المتاحة أول مرة
        this.loadAvailableMonths();

        const refreshBtn = document.getElementById('live-btn-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.currentPage = 1;
                this.data = [];
                this.loadData(false, false);
            });
        }

        const colToggleBtn = document.getElementById('live-btn-column-toggle');
        if (colToggleBtn) {
            colToggleBtn.addEventListener('click', () => {
                const container = document.getElementById('live-column-selector-container');
                if (container) container.style.display = container.style.display === 'none' ? 'block' : 'none';
            });
        }
    }

    setupInfiniteScroll() {
        const scrollContainer = document.getElementById('live-scroll-container');
        if (!scrollContainer || scrollContainer.dataset.listenerAttached) return;

        let lastScrollTop = 0;
        scrollContainer.addEventListener('scroll', () => {
            const scrollTop = scrollContainer.scrollTop;
            if (Math.abs(scrollTop - lastScrollTop) < 4) return;
            lastScrollTop = scrollTop;

            if (this.isLoadingMore || this.isLoading) return;

            if (scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 180) {
                if (this.currentPage < this.totalPages) {
                    this.currentPage++;
                    this.loadData(true, true);
                }
            }
        });
        scrollContainer.dataset.listenerAttached = 'true';
    }

    async loadAvailableMonths() {
        const monthSelect = document.getElementById('live-month-filter');
        if (!monthSelect) return;
        try {
            const tblConfig = this.whitelist[this.selectedTableId];
            let baseUrl = tblConfig && tblConfig.apiUrl ? tblConfig.apiUrl : '/returns';
            let monthsUrl = baseUrl.endsWith('/') ? baseUrl + 'months' : baseUrl + '/months';
            
            const url = new URL(monthsUrl, window.location.origin);
            if (this.yearFilter && this.yearFilter !== 'all') {
                url.searchParams.set('year', this.yearFilter);
            }
            
            const res = await fetch(url.toString());
            if (res.ok) {
                const months = await res.json();
                let html = '<option value="all">كل الشهور</option>';
                if (Array.isArray(months)) {
                    months.forEach(m => {
                        html += `<option value="${m}">${m}</option>`;
                    });
                }
                monthSelect.innerHTML = html;
                if (this.monthFilter !== 'all' && Array.isArray(months) && months.includes(this.monthFilter)) {
                    monthSelect.value = this.monthFilter;
                } else {
                    this.monthFilter = 'all';
                    monthSelect.value = 'all';
                }
            }
        } catch (err) {
            console.error('[LiveData] Error loading available months:', err);
        }
    }

    async loadData(silent = false, isAppend = false) {
        const tblConfig = this.whitelist[this.selectedTableId];
        if (!tblConfig) return;

        if (this.isLoading && !silent) return;

        if (isAppend) {
            this.isLoadingMore = true;
            const indicator = document.getElementById('live-loading-more-indicator');
            if (indicator) indicator.style.display = 'block';
        } else {
            this.isLoading = true;
            if (!silent) this.renderLoadingState();
        }

        try {
            const url = new URL(tblConfig.apiUrl, window.location.origin);
            url.searchParams.set('page', this.currentPage);
            url.searchParams.set('pageSize', this.pageSize);
            if (this.searchQuery) url.searchParams.set('search', this.searchQuery);
            if (this.settlementFilter !== 'all') url.searchParams.set('settlementStatus', this.settlementFilter);
            if (this.yearFilter !== 'all') url.searchParams.set('year', this.yearFilter);
            if (this.monthFilter !== 'all') url.searchParams.set('month', this.monthFilter);

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error(`خطأ في استجابة الخادم (${res.status})`);
            const responseData = await res.json();

            const newItems = responseData.data || (Array.isArray(responseData) ? responseData : []);
            if (responseData.pagination) {
                this.totalItems = responseData.pagination.total || newItems.length;
                this.totalPages = responseData.pagination.totalPages || 1;
            } else {
                this.totalItems = newItems.length;
                this.totalPages = 1;
            }

            if (isAppend) {
                this.data = [...this.data, ...newItems];
                this.appendRowsToTable(newItems);
            } else {
                this.data = newItems;
                this.extractColumns();
                this.renderColumnSelector();
                this.renderTable();
            }

            this.updatePaginationInfo();
            this.updateTotalBadge();

        } catch (err) {
            console.error('[LiveData] Load error:', err);
            if (!isAppend) this.renderErrorState(err.message);
        } finally {
            this.isLoading = false;
            this.isLoadingMore = false;
            const indicator = document.getElementById('live-loading-more-indicator');
            if (indicator) indicator.style.display = 'none';
        }
    }

    extractColumns() {
        if (!this.data || this.data.length === 0) {
            this.columns = ['الاسم', 'الشهر', 'المبلغ', 'ReturnCode'];
            return;
        }

        const keysSet = new Set();
        this.data.forEach(item => {
            Object.keys(item).forEach(k => {
                if (!k.startsWith('_') && k !== 'RawData') keysSet.add(k);
            });
        });

        const allKeys = Array.from(keysSet);
        
        const nameKey = allKeys.find(k => k === 'الاسم' || k === 'creditorName' || k === 'الاسم الكامل') || 'الاسم';
        const fileCodeKey = allKeys.find(k => k === 'كود الملف' || k === 'ReturnCode' || k === 'FileCode' || k === 'كود_الملف') || 'كود الملف';
        const monthKey = allKeys.find(k => k === 'الشهر' || k === 'month' || k === 'Month') || 'الشهر';
        const amountKey = allKeys.find(k => k === 'المبلغ' || k === 'transactionAmount' || k === 'قيمة العملية') || 'المبلغ';

        const fixedKeys = [nameKey, fileCodeKey, monthKey, amountKey];
        const sorted = [...fixedKeys];

        // الأعمدة المطلوب إخفاؤها لمنع التكرار
        const excludedColumns = new Set([
            'batchId', 'transactionStatus', 'حالة المعاملة',
            'reason', 'السبب', 'settlementStatus', 'حالة التسوية',
            'newCreditorAccount', 'رقم الحساب بعد التعديل', 'creditorAccount', 'رقم الحساب'
        ]);

        allKeys.forEach(k => {
            if (!sorted.includes(k) && k !== 'id' && k !== 'Id' && !excludedColumns.has(k)) {
                sorted.push(k);
            }
        });

        // تعيين الأعمدة المستبعدة في hiddenColumns تلقائياً لعدم العرض التكراري
        excludedColumns.forEach(col => this.hiddenColumns.add(col));

        this.columns = sorted;
    }

    getHeaderTitle(col) {
        if (this.headerTranslations[col]) {
            return this.headerTranslations[col];
        }
        return col;
    }

    renderColumnSelector() {
        const container = document.getElementById('live-column-selector-container');
        if (!container) return;

        let html = `<div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 15px;"><h6 style="color: #00f0ff; margin-bottom: 10px; font-weight: 700;">إخفاء/إظهار الأعمدة:</h6><div style="display: flex; flex-wrap: wrap; gap: 12px;">`;
        this.columns.forEach(col => {
            const checked = !this.hiddenColumns.has(col) ? 'checked' : '';
            const title = this.getHeaderTitle(col);
            html += `
                <label style="display: flex; align-items: center; gap: 5px; color: #cbd5e1; font-size: 0.85rem; cursor: pointer;">
                    <input type="checkbox" class="live-col-checkbox" value="${this.escapeHtml(col)}" ${checked}>
                    ${this.escapeHtml(title)}
                </label>
            `;
        });
        html += `</div></div>`;
        container.innerHTML = html;

        container.querySelectorAll('.live-col-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const col = e.target.value;
                if (e.target.checked) {
                    this.hiddenColumns.delete(col);
                } else {
                    this.hiddenColumns.add(col);
                }
                this.renderTable();
            });
        });
    }

    renderTable() {
        const headerRow = document.getElementById('live-table-header');
        const tbody = document.getElementById('live-table-body');
        if (!headerRow || !tbody) return;

        const visibleCols = this.columns.filter(c => !this.hiddenColumns.has(c));

        let headerHtml = `<th class="text-center sticky-col-1">#</th>`;
        visibleCols.forEach((col, idx) => {
            const stickyClass = idx === 0 ? 'sticky-col-2' : (idx === 1 ? 'sticky-col-3' : (idx === 2 ? 'sticky-col-4' : ''));
            headerHtml += `<th class="${stickyClass}">${this.escapeHtml(this.getHeaderTitle(col))}</th>`;
        });
        headerHtml += `<th class="text-center" style="width: 90px;">التحكم</th>`;
        headerRow.innerHTML = headerHtml;

        if (this.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${visibleCols.length + 2}" class="text-center py-5 text-muted">
                        <div style="font-size: 2.5rem; margin-bottom: 10px;">📭</div>
                        <p class="fw-bold">لا توجد سجلات مباشرة مطابقة للبحث أو الفلتر.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        this.appendRowsToTable(this.data, 0);
    }

    appendRowsToTable(rows, startIndexOffset = null) {
        const tbody = document.getElementById('live-table-body');
        if (!tbody) return;

        const visibleCols = this.columns.filter(c => !this.hiddenColumns.has(c));
        const currentExistingCount = startIndexOffset !== null ? startIndexOffset : (tbody.querySelectorAll('tr[id^="live-row-"]').length);

        let fragment = document.createDocumentFragment();
        rows.forEach((row, index) => {
            const rowId = row.id || row.Id;
            const rowIndex = currentExistingCount + index + 1;

            const tr = document.createElement('tr');
            tr.id = `live-row-${rowId}`;

            let rowHtml = `<td class="text-center text-muted fw-bold sticky-col-1">${rowIndex}</td>`;
            visibleCols.forEach((col, idx) => {
                const stickyClass = idx === 0 ? 'sticky-col-2' : (idx === 1 ? 'sticky-col-3' : (idx === 2 ? 'sticky-col-4' : ''));
                const val = row[col] !== undefined && row[col] !== null ? row[col] : '';
                rowHtml += `<td class="${stickyClass}" data-col="${this.escapeHtml(col)}">${this.formatCellValue(col, val)}</td>`;
            });

            rowHtml += `
                <td class="text-center">
                    <button class="btn-pro-action btn-edit-live" data-id="${rowId}" style="padding: 4px 10px; font-size: 12px; background: rgba(0, 240, 255, 0.15); border: 1px solid rgba(0, 240, 255, 0.4); color: #00f0ff;" title="تعديل السجل">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                </td>
            `;

            tr.innerHTML = rowHtml;
            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
        this.bindRowActions();
    }

    bindRowActions() {
        const editButtons = this.container.querySelectorAll('.btn-edit-live');
        editButtons.forEach(btn => {
            if (!btn.dataset.bound) {
                btn.dataset.bound = 'true';
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    this.openEditModal(id);
                });
            }
        });
    }

    openEditModal(rowId) {
        const row = this.data.find(r => (r.id || r.Id) == rowId);
        if (!row) return;

        this.editingRowId = rowId;
        if (window.realtimeSync) window.realtimeSync.markRowEditing(rowId, true);

        let fieldsHtml = '';
        Object.keys(row).forEach(key => {
            if (key === 'id' || key === 'Id' || key.startsWith('_') || key === 'AttachmentCount') return;
            const val = row[key] !== null && row[key] !== undefined ? row[key] : '';
            const fieldTitle = this.getHeaderTitle(key);
            fieldsHtml += `
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: 700; color: #e2e8f0; margin-bottom: 5px;">${this.escapeHtml(fieldTitle)} <span style="font-size: 0.75rem; color: #64748b;">(${this.escapeHtml(key)})</span></label>
                    <input type="text" class="live-edit-input form-input" data-key="${this.escapeHtml(key)}" value="${this.escapeHtml(String(val))}" style="width: 100%; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 8px 12px; border-radius: 8px;">
                </div>
            `;
        });

        const modalHtml = `
            <div id="liveEditModal" class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000000; display: flex; align-items: center; justify-content: center;" dir="rtl">
                <div class="modal-content" style="max-width: 700px; width: 90%; background: #0d1623; border: 1px solid #00f0ff; border-radius: 16px; padding: 20px;">
                    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0; color: #00f0ff; font-weight: 800;"><i class="fas fa-edit me-2"></i> تعديل سجل مباشر #${rowId}</h4>
                        <button type="button" class="btn-close-modal" id="live-modal-close" style="background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;">✕</button>
                    </div>
                    <div class="modal-body" style="max-height: 60vh; overflow-y: auto; padding-left: 10px;">
                        <div id="live-modal-alert"></div>
                        <form id="live-edit-form">
                            ${fieldsHtml}
                        </form>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid rgba(255,255,255,0.1); pt: 15px; margin-top: 20px;">
                        <button type="button" class="btn btn-secondary" id="live-cancel-btn" style="padding: 8px 20px; border-radius: 8px;">إلغاء</button>
                        <button type="button" id="live-save-btn" class="btn btn-primary" style="padding: 8px 20px; border-radius: 8px; background: #00f0ff; color: #000; font-weight: 700;">
                            <i class="fas fa-save me-1"></i> حفظ والتحديث المباشر
                        </button>
                    </div>
                </div>
            </div>
        `;

        let modalContainer = document.getElementById('live-modal-container');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'live-modal-container';
            document.body.appendChild(modalContainer);
        }
        modalContainer.innerHTML = modalHtml;

        const closeModal = () => {
            if (window.realtimeSync) window.realtimeSync.markRowEditing(rowId, false);
            this.editingRowId = null;
            modalContainer.innerHTML = '';
        };

        document.getElementById('live-modal-close')?.addEventListener('click', closeModal);
        document.getElementById('live-cancel-btn')?.addEventListener('click', closeModal);

        document.getElementById('live-save-btn')?.addEventListener('click', async () => {
            await this.saveRowEdit(rowId, closeModal);
        });
    }

    async saveRowEdit(rowId, closeModalCb) {
        const saveBtn = document.getElementById('live-save-btn');
        const alertEl = document.getElementById('live-modal-alert');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> جاري حفظ التغييرات...';

        const updatedObj = {};
        const inputs = document.querySelectorAll('.live-edit-input');
        inputs.forEach(input => {
            const key = input.getAttribute('data-key');
            updatedObj[key] = input.value;
        });

        const tblConfig = this.whitelist[this.selectedTableId];

        try {
            const res = await fetch(`${tblConfig.apiUrl}/${rowId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedObj)
            });

            const result = await res.json();
            if (res.ok && (result.success || result.record)) {
                const newRecord = result.record || updatedObj;
                newRecord.id = rowId;
                const idx = this.data.findIndex(r => (r.id || r.Id) == rowId);
                if (idx !== -1) {
                    this.data[idx] = newRecord;
                    this.updateRowDOM(newRecord);
                }
                closeModalCb();
            } else {
                throw new Error(result.message || 'فشل حفظ التعديلات في الخادم');
            }
        } catch (err) {
            alertEl.innerHTML = `<div style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; padding: 10px; border-radius: 8px; margin-bottom: 15px;"><i class="fas fa-exclamation-circle me-1"></i> ${this.escapeHtml(err.message)}</div>`;
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save me-1"></i> حفظ والتحديث المباشر';
        }
    }

    updateRowDOM(row) {
        const rowId = row.id || row.Id;
        const tr = document.getElementById(`live-row-${rowId}`);
        if (!tr) return;

        const visibleCols = this.columns.filter(c => !this.hiddenColumns.has(c));
        visibleCols.forEach(col => {
            const td = tr.querySelector(`td[data-col="${CSS.escape(col)}"]`);
            if (td) {
                const val = row[col] !== undefined && row[col] !== null ? row[col] : '';
                td.innerHTML = this.formatCellValue(col, val);
                td.style.transition = 'background 0.5s';
                td.style.background = 'rgba(0, 240, 255, 0.25)';
                setTimeout(() => td.style.background = '', 1500);
            }
        });
    }

    formatCellValue(col, val) {
        if (val === null || val === undefined) return '';
        if (col === 'حالة التسوية' || col === 'settlementStatus') {
            const isSettled = String(val).includes('تم');
            return `<span class="badge-status ${isSettled ? 'success' : 'warning'}">${this.escapeHtml(String(val))}</span>`;
        }
        return this.escapeHtml(String(val));
    }

    renderLoadingState() {
        const tbody = document.getElementById('live-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${(this.columns.length || 5) + 2}" class="text-center py-5">
                        <div class="loading-spinner-premium" style="margin: 20px auto;"></div>
                        <p style="color: #94a3b8;">جاري جلب البيانات المباشرة...</p>
                    </td>
                </tr>
            `;
        }
    }

    renderErrorState(msg) {
        const container = document.getElementById('live-alert-container');
        if (container) {
            container.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; padding: 15px; border-radius: 12px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
                    <i class="fas fa-exclamation-triangle fa-2x"></i>
                    <div>
                        <h6 style="margin: 0 0 4px; font-weight: 700;">خطأ في تحميل البيانات المباشرة</h6>
                        <span>${this.escapeHtml(msg)}</span>
                    </div>
                </div>
            `;
        }
    }

    updatePaginationInfo() {
        const info = document.getElementById('live-pagination-info');
        if (info) {
            info.textContent = `سجلات مستمرة: تم تحميل ${this.data.length.toLocaleString('ar-EG')} من إجمالي ${this.totalItems.toLocaleString('ar-EG')} سجل`;
        }
    }

    updateTotalBadge() {
        const badge = document.getElementById('live-total-count');
        if (badge) {
            badge.textContent = this.totalItems.toLocaleString('ar-EG');
        }
    }

    loadSavedTableSettings(tableId) {
        try {
            const saved = localStorage.getItem(`livedata_settings_${tableId}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.hiddenColumns = new Set(parsed.hiddenColumns || []);
                this.pinnedColumns = new Set(parsed.pinnedColumns || []);
            } else {
                this.hiddenColumns.clear();
                this.pinnedColumns.clear();
            }
        } catch (e) {
            this.hiddenColumns.clear();
            this.pinnedColumns.clear();
        }
    }

    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    destroy() {
        if (typeof this.unsubscribeSync === 'function') {
            this.unsubscribeSync();
        }
    }
}

window.LiveDataPage = LiveDataPage;
