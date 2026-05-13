/**
 * نظام إدارة المرتدات - واجهة API المركزية
 */

class Database {
    constructor() {
        this.baseUrl = window.location.origin;
    }

    // ========================================
    // تهيئة
    // ========================================

    async init() {
        // تهيئة IndexedDB لتخزين البيانات الضخمة
        await this.initCache();
        return true;
    }

    async initCache() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('HK_Offline_DB', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('cache')) {
                    db.createObjectStore('cache');
                }
            };
            request.onsuccess = (e) => {
                this.cacheDb = e.target.result;
                resolve();
            };
            request.onerror = (e) => reject(e);
        });
    }

    async setLocalCache(key, data) {
        if (!this.cacheDb) await this.initCache();
        return new Promise((resolve, reject) => {
            const transaction = this.cacheDb.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.put(data, key);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }

    async getLocalCache(key) {
        if (!this.cacheDb) await this.initCache();
        return new Promise((resolve, reject) => {
            const transaction = this.cacheDb.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.get(key);
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e);
        });
    }

    async clearLocalCache(key) {
        if (!this.cacheDb) await this.initCache();
        return new Promise((resolve, reject) => {
            const transaction = this.cacheDb.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = key ? store.delete(key) : store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }

    async initDefaultUsers() {
        // المستخدمين يتم إدارتهم في السيرفر
        return true;
    }

    // ========================================
    // دوال مساعدة للاتصال
    // ========================================

    /**
     * Centralized API Fetching with Visual Feedback
     * @param {string} endpoint - API path
     * @param {object} options - Fetch options + triggerBtn for UI feedback
     * @returns {Promise<any>}
     */
    async fetchApi(endpoint, options = {}) {
        const method = options.method || 'GET';
        const loadingConfig = !options.__skipLoadingWrapper && window.__getLoadingEndpointConfig
            ? window.__getLoadingEndpointConfig({ url: endpoint, method })
            : null;

        if (loadingConfig && window.withLoading) {
            const retryOptions = { ...options };
            return window.withLoading(
                () => this.fetchApi(endpoint, { ...options, __skipLoadingWrapper: true }),
                {
                    ...loadingConfig,
                    retry: () => this.fetchApi(endpoint, retryOptions)
                }
            );
        }

        const { __skipLoadingWrapper, __suppressErrorLog, triggerBtn: optionTriggerBtn, ...requestOptions } = options;
        
        // Add cache-buster to GET requests to ensure fresh data (especially for attachment counts)
        if (method === 'GET') {
            const separator = endpoint.includes('?') ? '&' : '?';
            endpoint += `${separator}t=${Date.now()}`;
        }

        let url = `${this.baseUrl}${endpoint}`;
        
        // --- VISUAL FEEDBACK LOGIC ---
        // Provides immediate (100-300ms) response by adding loading state to button
        const triggerBtn = optionTriggerBtn || null;
        if (triggerBtn && triggerBtn instanceof HTMLElement) {
            triggerBtn.classList.add('btn-loading');
            triggerBtn.disabled = true;
        }

        // Append user to URL if available
        const activeUser = window.app?.currentUser || this.currentUser || JSON.parse(localStorage.getItem('returns_session') || '{}');
        if (activeUser && (activeUser.fullname || activeUser.FullName)) {
            const separator = url.includes('?') ? '&' : '?';
            const userName = activeUser.fullname || activeUser.FullName || activeUser.username || 'مستخدم';
            url += `${separator}user=${encodeURIComponent(userName)}`;
        }

        try {
            const headers = {};
            // Don't set Content-Type for FormData, browser will set it with boundary
            if (!(requestOptions.body instanceof FormData)) {
                headers['Content-Type'] = 'application/json';
            }
            const activeUserForHeader = window.app?.currentUser || window.auth?.getUser?.() || JSON.parse(localStorage.getItem('returns_session') || '{}');
            if (activeUserForHeader?.id) {
                headers['X-User-Id'] = String(activeUserForHeader.id);
            }

            const response = await fetch(url, {
                ...requestOptions,
                __skipGlobalLoading: true,
                headers: { ...headers, ...(requestOptions.headers || {}) }
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { message: `HTTP error! status: ${response.status}` };
                }
                
                // Visual error feedback
                if (triggerBtn) {
                    triggerBtn.classList.remove('btn-loading');
                    triggerBtn.classList.add('btn-error-feedback');
                    setTimeout(() => {
                        triggerBtn.classList.remove('btn-error-feedback');
                        triggerBtn.disabled = false;
                    }, 1500);
                }

                throw new Error(errorData.error || errorData.message || `خادم غير متاح (${response.status})`);
            }

            const data = await response.json();

            // --- LOCAL ACTION TRACKING ---
            // If this was a modifying request, record the time so we can ignore our own DbChange notifications
            if (requestOptions.method && ['POST', 'PUT', 'DELETE'].includes(requestOptions.method.toUpperCase())) {
                window.dbLastActionTime = Date.now();
                if (!endpoint.includes('/api/search-index/') && window.app?.markSearchFilterIndexStale) {
                    window.app.markSearchFilterIndexStale(endpoint);
                }
            }

            // Visual success feedback
            if (triggerBtn) {
                triggerBtn.classList.remove('btn-loading');
                triggerBtn.classList.add('btn-success-feedback');
                setTimeout(() => {
                    triggerBtn.classList.remove('btn-success-feedback');
                    triggerBtn.disabled = false;
                }, 1000);
            }

            return data;
        } catch (error) {
            if (!__suppressErrorLog) {
                console.error(`API Error (${endpoint}):`, error);
            }
            
            // Visual error feedback on exception
            if (triggerBtn) {
                triggerBtn.classList.remove('btn-loading');
                triggerBtn.classList.add('btn-error-feedback');
                setTimeout(() => {
                    triggerBtn.classList.remove('btn-error-feedback');
                    triggerBtn.disabled = false;
                }, 1500);
            }

            throw error;
        }
    }

    async getAvailableMonths() {
        return await this.fetchApi('/api/smart-settlement/months');
    }

    // ========================================
    // المرتدات (Returns)
    // ========================================

    async getReturns(page = 1, pageSize = 50, search = null, filter = null, attachmentStatus = null, min = null, max = null, targetColumn = null, statusFilter = null, monthFilter = null, settlementFilter = null, uploadDateFrom = null, uploadDateTo = null, paymentDateFilter = null) {
        const params = new URLSearchParams({
            page: page.toString(),
            pageSize: pageSize.toString()
        });

        if (search) params.append('search', search);
        if (filter) {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filter);
            const isDefaultFilter = filter.startsWith('default-');
            if (isUuid || isDefaultFilter) {
                params.append('filterId', filter);
            } else {
                params.append('filter', filter);
            }
        }
        if (attachmentStatus && attachmentStatus !== 'all') params.append('attachmentStatus', attachmentStatus);
        if (min !== null && min !== undefined) params.append('min', min);
        if (max !== null && max !== undefined) params.append('max', max);
        if (targetColumn) params.append('targetColumn', targetColumn);
        if (statusFilter && statusFilter !== 'all') params.append('statusFilter', statusFilter);
        if (monthFilter && monthFilter !== 'all') params.append('monthFilter', monthFilter);
        if (settlementFilter && settlementFilter !== 'all') params.append('settlementFilter', settlementFilter);
        if (uploadDateFrom) params.append('uploadDateFrom', uploadDateFrom);
        if (uploadDateTo) params.append('uploadDateTo', uploadDateTo);
        if (paymentDateFilter && paymentDateFilter !== 'all') params.append('paymentDateFilter', paymentDateFilter);

        return await this.fetchApi(`/returns?${params}`, { timeout: 30000 });
    }

    async getAllReturns(search = null, filter = null, attachmentStatus = null, min = null, max = null, targetColumn = null) {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (filter) {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filter);
            const isDefaultFilter = filter.startsWith('default-');
            if (isUuid || isDefaultFilter) {
                params.append('filterId', filter);
            } else {
                params.append('filter', filter);
            }
        }
        if (attachmentStatus && attachmentStatus !== 'all') params.append('attachmentStatus', attachmentStatus);
        if (min !== null && min !== undefined) params.append('min', min);
        if (max !== null && max !== undefined) params.append('max', max);
        if (targetColumn) params.append('targetColumn', targetColumn);

        return await this.fetchApi(`/returns/all?${params}`);
    }

    async getReturnChanges(since = null) {
        const params = new URLSearchParams();
        if (since) params.append('since', since);
        return await this.fetchApi(`/api/returns/changes?${params}`, { timeout: 12000, __skipLoadingWrapper: true });
    }

    async syncReturns(since = null) {
        const params = new URLSearchParams();
        if (since) params.append('since', since);
        return await this.fetchApi(`/api/returns/sync?${params}`, { timeout: 30000, __skipLoadingWrapper: true });
    }

    async getReturnStatuses() {
        return await this.fetchApi('/returns/statuses');
    }

    async saveReturns(data, importInfo) {
        return await this.fetchApi('/returns/import', {
            method: 'POST',
            body: JSON.stringify({
                filename: importInfo.filename,
                size: importInfo.size,
                headers: importInfo.headers,
                data: data
            })
        });
    }

    async deleteAllReturns() {
        const response = await this.fetchApi('/returns', {
            method: 'DELETE'
        });
        return response.success;
    }

    async deleteReturn(id) {
        const response = await this.fetchApi(`/returns/${id}`, {
            method: 'DELETE'
        });
        return response.success;
    }

    async updateReturn(id, data) {
        return await this.fetchApi(`/returns/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async getUploadDates() {
        return await this.fetchApi('/returns/upload-dates');
    }

    async getPaymentDates() {
        return await this.fetchApi('/returns/payment-dates');
    }

    async getReturnMonths() {
        return await this.fetchApi('/returns/months');
    }

    async repairSchema() {
        try {
            const response = await this.fetchApi('/maintenance/repair-schema', { method: 'POST' });
            console.log('[SCHEMA REPAIR]', response);
            return response;
        } catch (e) {
            console.error('Schema repair failed', e);
            return { success: false, error: e.message };
        }
    }

    // ========================================
    // مرتبات (Salary Returns)
    // ========================================

    async getSalaryReturns(page = 1, pageSize = 50, search = null, attachmentStatus = null, uploadDateFrom = null, uploadDateTo = null, settlementFilter = null, statusFilter = null, monthFilter = null, paymentDateFilter = null) {
        const params = new URLSearchParams({
            page: page.toString(),
            pageSize: pageSize.toString()
        });

        if (search) params.append('search', search);
        if (attachmentStatus && attachmentStatus !== 'all') params.append('attachmentStatus', attachmentStatus);
        if (uploadDateFrom) params.append('uploadDateFrom', uploadDateFrom);
        if (uploadDateTo) params.append('uploadDateTo', uploadDateTo);
        if (settlementFilter && settlementFilter !== 'all') params.append('settlementStatus', settlementFilter);
        if (statusFilter && statusFilter !== 'all') params.append('returnStatus', statusFilter);
        if (monthFilter && monthFilter !== 'all') params.append('month', monthFilter);
        if (paymentDateFilter && paymentDateFilter !== 'all') params.append('paymentDateFilter', paymentDateFilter);

        return await this.fetchApi(`/salary-returns?${params}`, { timeout: 30000 });
    }

    async getAllSalaryReturns(search = null, attachmentStatus = null, uploadDateFrom = null, uploadDateTo = null, settlementFilter = null, statusFilter = null, monthFilter = null, paymentDateFilter = null) {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (attachmentStatus && attachmentStatus !== 'all') params.append('attachmentStatus', attachmentStatus);
        if (uploadDateFrom) params.append('uploadDateFrom', uploadDateFrom);
        if (uploadDateTo) params.append('uploadDateTo', uploadDateTo);
        if (settlementFilter && settlementFilter !== 'all') params.append('settlementStatus', settlementFilter);
        if (statusFilter && statusFilter !== 'all') params.append('returnStatus', statusFilter);
        if (monthFilter && monthFilter !== 'all') params.append('month', monthFilter);
        if (paymentDateFilter && paymentDateFilter !== 'all') params.append('paymentDateFilter', paymentDateFilter);

        return await this.fetchApi(`/salary-returns/all?${params}`);
    }

    async getSalaryReturnChanges(since = null) {
        const params = new URLSearchParams();
        if (since) params.append('since', since);
        return await this.fetchApi(`/api/salary-returns/changes?${params}`, { timeout: 12000, __skipLoadingWrapper: true });
    }

    async syncSalaryReturns(since = null) {
        const params = new URLSearchParams();
        if (since) params.append('since', since);
        return await this.fetchApi(`/api/salary-returns/sync?${params}`, { timeout: 30000, __skipLoadingWrapper: true });
    }

    async saveSalaryReturns(data, importInfo) {
        return await this.fetchApi('/salary-returns/import', {
            method: 'POST',
            body: JSON.stringify({
                filename: importInfo.filename,
                size: importInfo.size,
                headers: importInfo.headers,
                data: data
            })
        });
    }

    async deleteAllSalaryReturns() {
        const response = await this.fetchApi('/salary-returns', {
            method: 'DELETE'
        });
        return response.success;
    }

    async deleteSalaryReturn(id) {
        const response = await this.fetchApi(`/salary-returns/${id}`, {
            method: 'DELETE'
        });
        return response.success;
    }

    async updateSalaryReturn(id, data) {
        return await this.fetchApi(`/salary-returns/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async getSalaryUploadDates() {
        return await this.fetchApi('/salary-returns/upload-dates');
    }

    async getFullReturnChanges(since = null) {
        const params = new URLSearchParams();
        if (since) params.append('since', since);
        return await this.fetchApi(`/api/full-returns/changes?${params}`, { timeout: 12000, __skipLoadingWrapper: true });
    }

    async syncFullReturns(since = null) {
        const params = new URLSearchParams();
        if (since) params.append('since', since);
        return await this.fetchApi(`/api/full-returns/sync?${params}`, { timeout: 30000, __skipLoadingWrapper: true });
    }

    // ========================================
    // الأرشيف (Archive)
    // ========================================

    async getArchive() {
        return await this.fetchApi('/archive');
    }

    async restoreFromArchive(archiveId) {
        const response = await this.fetchApi(`/archive/restore/${archiveId}`, {
            method: 'POST'
        });
        return response.success;
    }

    async deleteArchive(archiveId) {
        const response = await this.fetchApi(`/archive/${archiveId}`, {
            method: 'DELETE'
        });
        return response.success;
    }

    // ========================================
    // المستخدمين (Users)
    // ========================================

    async getUsers() {
        return await this.fetchApi('/users');
    }

    async saveUser(userData) {
        return await this.fetchApi('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async deleteUser(userId) {
        return await this.fetchApi(`/users/${userId}`, {
            method: 'DELETE'
        });
    }

    // ========================================
    // المصادقة (Auth)
    // ========================================

    async login(username, password) {
        try {
            const response = await this.fetchApi('/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            return response;
        } catch (error) {
            return { success: false, error: 'خطأ في الاتصال بالسيرفر' };
        }
    }

    // ========================================
    // المرفقات (Attachments)
    // ========================================

    async getAttachments(returnId) {
        return await this.fetchApi(`/returns/attachments/${returnId}`);
    }

    async uploadAttachment(returnId, file) {
        const formData = new FormData();
        formData.append('file', file);

        // Robust user name extraction matching fetchApi logic
        const activeUser = window.app?.currentUser || this.currentUser || JSON.parse(localStorage.getItem('returns_session') || '{}');
        const userName = window.app?.currentUser?.fullname || 
                         window.app?.currentUser?.FullName || 
                         window.auth?.currentUser?.fullname || 
                         activeUser?.fullname || 
                         'مستخدم';

        const user = encodeURIComponent(userName);
        
        const response = await fetch(`${this.baseUrl}/returns/attachments/${returnId}?user=${user}`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('فشل رفع الملف');
        return await response.json();
    }

    async deleteAttachment(attachmentId) {
        const response = await this.fetchApi(`/returns/attachment/${attachmentId}`, {
            method: 'DELETE'
        });
        return response.success;
    }


    async getServerConfig() {
        return await this.fetchApi('/config/scanner-settings'); // This returns many config values including AttachmentLinkMode
    }

    async saveAttachmentLinkMode(mode, options = {}) {
        const response = await this.fetchApi('/config/attachment-link-mode', {
            method: 'POST',
            body: JSON.stringify({ mode }),
            ...options
        });
        return response.success;
    }

    // ========================================
    // الفلاتر (Filters Settings)
    // ========================================

    async getFilters() {
        return await this.fetchApi('/api/filters');
    }

    async addFilter(filterData) {
        const response = await this.fetchApi('/api/filters', {
            method: 'POST',
            body: JSON.stringify(filterData)
        });
        return response;
    }

    async updateFilter(id, filterData) {
        const response = await this.fetchApi(`/api/filters/${id}`, {
            method: 'PUT',
            body: JSON.stringify(filterData)
        });
        return response;
    }

    async deleteFilter(id) {
        const response = await this.fetchApi(`/api/filters/${id}`, {
            method: 'DELETE'
        });
        return response.success;
    }

    // ========================================
    // المهام والمشاركة (Advanced Features)
    // ========================================

    async getMyTasks(userId) {
        return await this.fetchApi(`/tasks/my?userId=${userId}`);
    }

    async assignTask(taskData) {
        return await this.fetchApi('/tasks/assign', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
    }

    async sendShare(shareData) {
        return await this.fetchApi('/shares/send', {
            method: 'POST',
            body: JSON.stringify(shareData)
        });
    }

    async getPendingShares(userId) {
        return await this.fetchApi(`/shares/pending?userId=${userId}`);
    }

    async respondToShare(shareId, userId, status) {
        return await this.fetchApi('/shares/respond', {
            method: 'POST',
            body: JSON.stringify({ shareId, userId, status })
        });
    }

    async setArchiveExclusive(archiveId, type, userId) {
        return await this.fetchApi('/archives/exclusive', {
            method: 'POST',
            body: JSON.stringify({ archiveId, type, userId })
        });
    }

    async getAuditLogs() {
        return await this.fetchApi('/audit/logs');
    }
}

// تصدير
window.db = new Database();
