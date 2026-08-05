// ============================================================================
// IncentivesPage - صفحة إدارة وتصفح بيانات الحوافز (تعريب كامل لرؤوس الجداول)
// ============================================================================

class IncentivesPage {
    constructor(containerId) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.data = [];
        this.columns = [];
        this.currentPage = 1;
        this.pageSize = 50;
        this.totalItems = 0;
        this.totalPages = 1;
        this.searchQuery = '';
        this.settlementFilter = 'all';
        this.isLoading = false;
        this.isLoadingMore = false;
        this.errorMessage = null;
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
        this.setupRealtimeSync();
        await this.loadData(false, false);
        this.setupInfiniteScroll();
    }

    setupRealtimeSync() {
        if (window.realtimeSync) {
            window.realtimeSync.init();
            this.unsubscribeSync = window.realtimeSync.subscribe('Returns', (payload) => {
                this.handleRealtimeUpdate(payload);
            }, '/api/returns/changes');

            window.realtimeSync.onStateChange((state, lastUpdated) => {
                this.updateSyncStatusUI(state, lastUpdated);
            });
        }
    }

    updateSyncStatusUI(state, lastUpdated) {
        const badge = document.getElementById('inc-sync-status-badge');
        const timeEl = document.getElementById('inc-last-updated-time');
        if (!badge) return;

        if (state === 'connected') {
            badge.className = 'badge-status success me-2';
            badge.innerHTML = '<i class="fas fa-wifi me-1"></i> متصل لحظياً';
        } else if (state === 'reconnecting') {
            badge.className = 'badge-status warning me-2';
            badge.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> يعيد الاتصال...';
        } else {
            badge.className = 'badge-status me-2';
            badge.style.background = 'rgba(255,255,255,0.1)';
            badge.style.color = '#94a3b8';
            badge.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i> تحديث دوري';
        }

        if (timeEl && lastUpdated) {
            timeEl.textContent = lastUpdated.toLocaleTimeString('ar-EG');
        }
    }

    async handleRealtimeUpdate(payload) {
        if (this.editingRowId && window.realtimeSync.isRowBeingEdited(this.editingRowId)) {
            return;
        }

        if (payload && payload.rowId && payload.rowId > 0) {
            await this.refreshSingleRow(payload.rowId);
        } else {
            this.currentPage = 1;
            await this.loadData(true, false);
        }
    }

    renderLayout() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="unified-premium-container" dir="rtl" style="width: 100%;">
                <!-- بطاقات إحصائيات الصفحة -->
                <div class="dashboard-stats-row-pro search-stats-summary" style="width: 100%; margin-bottom: 20px;">
                    <div class="stat-card-pro pro-total-summary">
                        <div class="stat-details-pro">
                            <span class="stat-label">سجلات الحوافز والمرتدات</span>
                            <span class="stat-value" id="inc-total-count">0</span>
                        </div>
                        <div class="stat-icon" style="background: rgba(0, 240, 255, 0.1); color: #00f0ff;">
                            <i class="fas fa-gift"></i>
                        </div>
                    </div>
                    <div class="stat-card-pro pro-pending">
                        <div class="stat-details-pro">
                            <span class="stat-label">حالة الاتصال الفوري</span>
                            <span class="stat-value" style="font-size: 1.1rem;" id="inc-sync-status-badge">جاري الاتصال...</span>
                            <div class="stat-sub-row">
                                <span class="stat-label-sub">آخر تحديث:</span>
                                <span class="stat-value-sub" id="inc-last-updated-time">--:--</span>
                            </div>
                        </div>
                        <div class="stat-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">
                            <i class="fas fa-signal"></i>
                        </div>
                    </div>
                </div>

                <!-- شريط الأدوات والبحث والفلترة -->
                <div class="dashboard-controls-row-pro" style="width: 100%; margin-bottom: 20px;">
                    <div class="pro-controls-wrapper rtl-flex" style="gap: 15px;">
                        <div class="pro-search-container" style="flex: 2;">
                            <i class="fas fa-search pro-search-icon"></i>
                            <input type="text" id="inc-search-input" placeholder="البحث بالاسم، الرقم الوظيفي، أو رقم الهوية..." value="${this.searchQuery}">
                        </div>

                        <div class="pro-filters-container rtl-flex" style="flex: 1; gap: 15px;">
                            <div class="pro-filter-item" style="flex: 1;">
                                <label>حالة التسوية</label>
                                <select id="inc-settlement-filter">
                                    <option value="all">الكل</option>
                                    <option value="تم التسوية">تم التسوية</option>
                                    <option value="لم يتم التسوية">لم يتم التسوية</option>
                                </select>
                            </div>
                            <button id="inc-btn-refresh" class="btn-pro-action btn-sync-pro" style="height: 48px; border-radius: 12px; margin-top: auto;" title="تحديث يدوي">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div id="inc-alert-container" style="width: 100%;"></div>

                <!-- جدول البيانات المطور مع تعريب الرؤوس -->
                <div class="table-container pro-table-container" style="width: 100%; flex: 1;">
                    <div class="table-wrapper-scroll" id="inc-scroll-container" style="max-height: calc(100vh - 280px); overflow-y: auto; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08);">
                        <table class="data-table" id="inc-table">
                            <thead>
                                <tr id="inc-table-header">
                                    <th>#</th>
                                    <th>جاري التحميل...</th>
                                </tr>
                            </thead>
                            <tbody id="inc-table-body">
                                <tr>
                                    <td colspan="10" class="text-center py-5 text-muted">
                                        <div class="loading-spinner-premium" style="margin: 20px auto;"></div>
                                        <p>جاري جلب بيانات الحوافز والمرتدات...</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div id="inc-loading-more-indicator" style="display: none; text-align: center; padding: 15px; color: #00f0ff;">
                            <i class="fas fa-spinner fa-spin me-2"></i> جاري تحميل باقي السجلات تلقائياً...
                        </div>
                    </div>

                    <!-- شريط الحصيلة والتمرير المستمر -->
                    <div class="d-flex justify-content-between align-items-center mt-3 px-3 py-2" style="background: rgba(15, 23, 42, 0.4); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                        <div id="inc-pagination-info" style="color: #94a3b8; font-weight: 600; font-size: 0.9rem;">
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
        const searchInput = document.getElementById('inc-search-input');
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

        const settlementFilter = document.getElementById('inc-settlement-filter');
        if (settlementFilter) {
            settlementFilter.addEventListener('change', (e) => {
                this.settlementFilter = e.target.value;
                this.currentPage = 1;
                this.data = [];
                this.loadData(false, false);
            });
        }

        const refreshBtn = document.getElementById('inc-btn-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.currentPage = 1;
                this.data = [];
                this.loadData(false, false);
            });
        }
    }

    setupInfiniteScroll() {
        const scrollContainer = document.getElementById('inc-scroll-container');
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

    async loadData(silent = false, isAppend = false) {
        if (this.isLoading && !silent) return;

        if (isAppend) {
            this.isLoadingMore = true;
            const indicator = document.getElementById('inc-loading-more-indicator');
            if (indicator) indicator.style.display = 'block';
        } else {
            this.isLoading = true;
            if (!silent) this.renderLoadingState();
        }

        try {
            const url = new URL('/returns', window.location.origin);
            url.searchParams.set('page', this.currentPage);
            url.searchParams.set('pageSize', this.pageSize);
            if (this.searchQuery) url.searchParams.set('search', this.searchQuery);
            if (this.settlementFilter !== 'all') url.searchParams.set('settlementStatus', this.settlementFilter);

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error(`خطأ استجابة الخادم (${res.status})`);
            const responseData = await res.json();

            const newItems = responseData.data || [];
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
                this.renderTable();
            }

            this.updatePaginationInfo();
            this.updateTotalBadge();

        } catch (err) {
            console.error('[Incentives] Load error:', err);
            this.errorMessage = err.message || 'حدث خطأ أثناء تحميل البيانات';
            if (!isAppend) this.renderErrorState();
        } finally {
            this.isLoading = false;
            this.isLoadingMore = false;
            const indicator = document.getElementById('inc-loading-more-indicator');
            if (indicator) indicator.style.display = 'none';
        }
    }

    extractColumns() {
        if (!this.data || this.data.length === 0) {
            this.columns = ['الاسم', 'الشهر', 'قيمة العملية', 'ReturnCode', 'حالة التسوية'];
            return;
        }

        const keysSet = new Set();
        this.data.forEach(item => {
            Object.keys(item).forEach(k => {
                if (!k.startsWith('_') && k !== 'RawData') keysSet.add(k);
            });
        });

        const allKeys = Array.from(keysSet);
        
        // الأعمدة الثابتة الثلاثة المستهدفة: الاسم، الشهر (05-2026)، قيمة العملية
        const nameKey = allKeys.find(k => k === 'الاسم' || k === 'creditorName' || k === 'الاسم الكامل') || 'الاسم';
        const monthKey = allKeys.find(k => k === 'الشهر' || k === 'month' || k === 'Month') || 'الشهر';
        const amountKey = allKeys.find(k => k === 'قيمة العملية' || k === 'transactionAmount' || k === 'المبلغ') || 'قيمة العملية';

        const fixedKeys = [nameKey, monthKey, amountKey];
        const sorted = [...fixedKeys];

        allKeys.forEach(k => {
            if (!sorted.includes(k) && k !== 'id' && k !== 'Id') sorted.push(k);
        });

        this.columns = sorted;
    }

    getHeaderTitle(col) {
        if (this.headerTranslations[col]) {
            return this.headerTranslations[col];
        }
        return col;
    }

    renderTable() {
        const headerRow = document.getElementById('inc-table-header');
        const tbody = document.getElementById('inc-table-body');
        if (!headerRow || !tbody) return;

        let headerHtml = `<th class="text-center sticky-col-1">#</th>`;
        this.columns.forEach((col, idx) => {
            const stickyClass = idx === 0 ? 'sticky-col-2' : (idx === 1 ? 'sticky-col-3' : (idx === 2 ? 'sticky-col-4' : ''));
            headerHtml += `<th class="${stickyClass}">${this.escapeHtml(this.getHeaderTitle(col))}</th>`;
        });
        headerHtml += `<th class="text-center" style="width: 90px;">التحكم</th>`;
        headerRow.innerHTML = headerHtml;

        if (this.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${this.columns.length + 2}" class="text-center py-5 text-muted">
                        <div style="font-size: 2.5rem; margin-bottom: 10px;">📭</div>
                        <p class="fw-bold">لا توجد سجلات حوافز تطابق المعايير المحددة.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        this.appendRowsToTable(this.data, 0);
    }

    appendRowsToTable(rows, startIndexOffset = null) {
        const tbody = document.getElementById('inc-table-body');
        if (!tbody) return;

        const currentExistingCount = startIndexOffset !== null ? startIndexOffset : (tbody.querySelectorAll('tr[id^="inc-row-"]').length);

        let fragment = document.createDocumentFragment();
        rows.forEach((row, index) => {
            const rowId = row.id || row.Id;
            const rowIndex = currentExistingCount + index + 1;

            const tr = document.createElement('tr');
            tr.id = `inc-row-${rowId}`;

            let rowHtml = `<td class="text-center text-muted fw-bold sticky-col-1">${rowIndex}</td>`;
            this.columns.forEach((col, idx) => {
                const stickyClass = idx === 0 ? 'sticky-col-2' : (idx === 1 ? 'sticky-col-3' : (idx === 2 ? 'sticky-col-4' : ''));
                const val = row[col] !== undefined && row[col] !== null ? row[col] : '';
                rowHtml += `<td class="${stickyClass}" data-col="${this.escapeHtml(col)}">${this.formatCellValue(col, val)}</td>`;
            });

            rowHtml += `
                <td class="text-center">
                    <button class="btn-pro-action btn-edit-inc" data-id="${rowId}" style="padding: 4px 10px; font-size: 12px; background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(14, 165, 233, 0.4); color: #38bdf8;" title="تعديل السجل">
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
        const editButtons = this.container.querySelectorAll('.btn-edit-inc');
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

    async refreshSingleRow(rowId) {
        try {
            const res = await fetch(`/returns?search=${rowId}&pageSize=1`);
            if (!res.ok) return;
            const resData = await res.json();
            const updatedRow = (resData.data || []).find(r => (r.id || r.Id) == rowId);
            if (updatedRow) {
                const localIdx = this.data.findIndex(r => (r.id || r.Id) == rowId);
                if (localIdx !== -1) {
                    this.data[localIdx] = updatedRow;
                    this.updateRowDOM(updatedRow);
                }
            }
        } catch (e) {
            console.error('Failed to refresh row', rowId, e);
        }
    }

    updateRowDOM(row) {
        const rowId = row.id || row.Id;
        const tr = document.getElementById(`inc-row-${rowId}`);
        if (!tr) return;

        this.columns.forEach(col => {
            const td = tr.querySelector(`td[data-col="${CSS.escape(col)}"]`);
            if (td) {
                const val = row[col] !== undefined && row[col] !== null ? row[col] : '';
                td.innerHTML = this.formatCellValue(col, val);
                td.style.transition = 'background 0.5s';
                td.style.background = 'rgba(245, 158, 11, 0.25)';
                setTimeout(() => td.style.background = '', 1500);
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
                    <input type="text" class="inc-edit-input form-input" data-key="${this.escapeHtml(key)}" value="${this.escapeHtml(String(val))}" style="width: 100%; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 8px 12px; border-radius: 8px;">
                </div>
            `;
        });

        const modalHtml = `
            <div id="incEditModal" class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000000; display: flex; align-items: center; justify-content: center;" dir="rtl">
                <div class="modal-content" style="max-width: 700px; width: 90%; background: #0d1623; border: 1px solid #00f0ff; border-radius: 16px; padding: 20px;">
                    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0; color: #00f0ff; font-weight: 800;"><i class="fas fa-edit me-2"></i> تعديل سجل الحوافز #${rowId}</h4>
                        <button type="button" class="btn-close-modal" id="inc-modal-close" style="background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;">✕</button>
                    </div>
                    <div class="modal-body" style="max-height: 60vh; overflow-y: auto; padding-left: 10px;">
                        <div id="inc-modal-alert"></div>
                        <form id="inc-edit-form">
                            ${fieldsHtml}
                        </form>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid rgba(255,255,255,0.1); pt: 15px; margin-top: 20px;">
                        <button type="button" class="btn btn-secondary" id="inc-cancel-btn" style="padding: 8px 20px; border-radius: 8px;">إلغاء</button>
                        <button type="button" id="inc-save-btn" class="btn btn-primary" style="padding: 8px 20px; border-radius: 8px; background: #00f0ff; color: #000; font-weight: 700;">
                            <i class="fas fa-save me-1"></i> حفظ التغييرات
                        </button>
                    </div>
                </div>
            </div>
        `;

        let modalContainer = document.getElementById('inc-modal-container');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'inc-modal-container';
            document.body.appendChild(modalContainer);
        }
        modalContainer.innerHTML = modalHtml;

        const closeModal = () => {
            if (window.realtimeSync) window.realtimeSync.markRowEditing(rowId, false);
            this.editingRowId = null;
            modalContainer.innerHTML = '';
        };

        document.getElementById('inc-modal-close')?.addEventListener('click', closeModal);
        document.getElementById('inc-cancel-btn')?.addEventListener('click', closeModal);

        document.getElementById('inc-save-btn')?.addEventListener('click', async () => {
            await this.saveRowEdit(rowId, closeModal);
        });
    }

    async saveRowEdit(rowId, closeModalCb) {
        const saveBtn = document.getElementById('inc-save-btn');
        const alertEl = document.getElementById('inc-modal-alert');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> جاري الحفظ...';

        const updatedObj = {};
        const inputs = document.querySelectorAll('.inc-edit-input');
        inputs.forEach(input => {
            const key = input.getAttribute('data-key');
            updatedObj[key] = input.value;
        });

        try {
            const res = await fetch(`/returns/${rowId}`, {
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
                throw new Error(result.message || 'فشل حفظ التعديلات');
            }
        } catch (err) {
            alertEl.innerHTML = `<div style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; padding: 10px; border-radius: 8px; margin-bottom: 15px;"><i class="fas fa-exclamation-circle me-1"></i> ${this.escapeHtml(err.message)}</div>`;
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save me-1"></i> حفظ التغييرات';
        }
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
        const tbody = document.getElementById('inc-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${(this.columns.length || 5) + 2}" class="text-center py-5">
                        <div class="loading-spinner-premium" style="margin: 20px auto;"></div>
                        <p style="color: #94a3b8;">جاري جلب بيانات الحوافز والمرتدات...</p>
                    </td>
                </tr>
            `;
        }
    }

    renderErrorState() {
        const container = document.getElementById('inc-alert-container');
        if (container) {
            container.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; padding: 15px; border-radius: 12px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
                    <i class="fas fa-exclamation-triangle fa-2x"></i>
                    <div>
                        <h6 style="margin: 0 0 4px; font-weight: 700;">خطأ أثناء تحميل البيانات</h6>
                        <span>${this.escapeHtml(this.errorMessage)}</span>
                    </div>
                </div>
            `;
        }
    }

    updatePaginationInfo() {
        const info = document.getElementById('inc-pagination-info');
        if (info) {
            info.textContent = `سجلات مستمرة: تم تحميل ${this.data.length.toLocaleString('ar-EG')} من إجمالي ${this.totalItems.toLocaleString('ar-EG')} سجل`;
        }
    }

    updateTotalBadge() {
        const badge = document.getElementById('inc-total-count');
        if (badge) {
            badge.textContent = this.totalItems.toLocaleString('ar-EG');
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

window.IncentivesPage = IncentivesPage;
