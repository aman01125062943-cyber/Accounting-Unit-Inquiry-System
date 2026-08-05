// ============================================================================
// RealtimeSyncService - خدمة التحديث التلقائي الفوري والتزامن اللحظي
// ============================================================================

class RealtimeSyncService {
    constructor() {
        this.hubConnection = null;
        this.connectionState = 'disconnected'; // 'connected' | 'reconnecting' | 'disconnected'
        this.lastUpdated = null;
        this.listeners = new Map(); // table -> Set of callbacks
        this.stateListeners = new Set();
        this.pollingTimers = new Map(); // table -> intervalId
        this.pollingIntervalMs = 5000;
        this.editingRowIds = new Set(); // IDs currently being edited by user
        this.isSignalRSupported = typeof signalR !== 'undefined';
    }

    // تسجيل الاستماع لحالة الاتصال
    onStateChange(callback) {
        if (typeof callback === 'function') {
            this.stateListeners.add(callback);
            callback(this.connectionState, this.lastUpdated);
        }
    }

    // تحديث الحالة وتنبيه المستمعين
    _setState(state) {
        this.connectionState = state;
        this.stateListeners.forEach(cb => {
            try { cb(this.connectionState, this.lastUpdated); } catch (e) { console.error(e); }
        });
    }

    // تحديث وقت آخر مزامنة
    _touchUpdated() {
        this.lastUpdated = new Date();
        this.stateListeners.forEach(cb => {
            try { cb(this.connectionState, this.lastUpdated); } catch (e) { console.error(e); }
        });
    }

    // بدء الاتصال اللحظي عبر SignalR أو Fallback للـ Polling
    async init() {
        if (this.hubConnection) return;

        if (this.isSignalRSupported) {
            try {
                this.hubConnection = new signalR.HubConnectionBuilder()
                    .withUrl('/notificationHub')
                    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
                    .configureLogging(signalR.LogLevel.Warning)
                    .build();

                this.hubConnection.onreconnecting(() => {
                    this._setState('reconnecting');
                });

                this.hubConnection.onreconnected(() => {
                    this._setState('connected');
                    this._touchUpdated();
                });

                this.hubConnection.onclose(() => {
                    this._setState('disconnected');
                    this._startGlobalFallbackPolling();
                });

                this.hubConnection.on('DbChange', (payload) => {
                    this._touchUpdated();
                    this._handleDbChangePayload(payload);
                });

                this._setState('reconnecting');
                await this.hubConnection.start();
                this._setState('connected');
                this._touchUpdated();
                return;
            } catch (err) {
                console.warn('[RealtimeSync] SignalR connection failed, falling back to Polling:', err);
                this.hubConnection = null;
            }
        }

        this._setState('disconnected');
        this._startGlobalFallbackPolling();
    }

    // التعامل مع الأحداث القادمة من SignalR
    _handleDbChangePayload(payload) {
        if (!payload) return;
        const table = payload.table || payload.Table || '';
        const normTable = this._normalizeTableName(table);
        
        // استدعاء المراققين لهذا الجدول أو لجميع الجداول (*)
        this._notifyListeners(normTable, payload);
        this._notifyListeners('*', payload);
    }

    // توحيد مسميات الجداول
    _normalizeTableName(table) {
        if (!table) return '';
        const lower = table.toLowerCase();
        if (lower.includes('salary') || lower.includes('مرتبات')) return 'SalaryReturns';
        if (lower.includes('return') || lower.includes('حوافز') || lower.includes('مرتدات')) return 'Returns';
        if (lower.includes('ledger') || lower.includes('بنك')) return 'BankLedger';
        return table;
    }

    // الاشتراك في التحديثات الخاصة بجدول معين
    subscribe(tableName, callback, changeCheckApiUrl = null) {
        const normTable = this._normalizeTableName(tableName);
        if (!this.listeners.has(normTable)) {
            this.listeners.set(normTable, new Set());
        }
        this.listeners.get(normTable).add(callback);

        // إذا كان SignalR غير متصل أو لم يعمل، نشغّل Polling لهذا الجدول تحديداً
        if (changeCheckApiUrl && this.connectionState !== 'connected') {
            this._startTablePolling(normTable, changeCheckApiUrl);
        }

        return () => this.unsubscribe(normTable, callback);
    }

    // إلغاء الاشتراك
    unsubscribe(tableName, callback) {
        const normTable = this._normalizeTableName(tableName);
        if (this.listeners.has(normTable)) {
            this.listeners.get(normTable).delete(callback);
            if (this.listeners.get(normTable).size === 0) {
                this.listeners.delete(normTable);
                this._stopTablePolling(normTable);
            }
        }
    }

    // تنبيه المشتركين
    _notifyListeners(normTable, payload) {
        if (this.listeners.has(normTable)) {
            this.listeners.get(normTable).forEach(cb => {
                try { cb(payload); } catch (err) { console.error(err); }
            });
        }
    }

    // بدء Polling محدد لجدول معين
    _startTablePolling(normTable, apiUrl) {
        if (this.pollingTimers.has(normTable)) return;
        let lastVersion = null;

        const timerId = setInterval(async () => {
            if (this.connectionState === 'connected') return; // لا نحتاج Polling إذا كان SignalR متصل

            try {
                const url = new URL(apiUrl, window.location.origin);
                if (lastVersion) url.searchParams.set('since', lastVersion);
                
                const res = await fetch(url.toString());
                if (!res.ok) return;
                const data = await res.json();
                
                if (data && (data.hasChanges || data.changedCount > 0)) {
                    if (data.latestVersion) lastVersion = data.latestVersion;
                    this._touchUpdated();
                    this._notifyListeners(normTable, { table: normTable, operation: 'POLL_SYNC', data });
                }
            } catch (e) {
                // تجاهل أخطاء الشبكة المؤقتة
            }
        }, this.pollingIntervalMs);

        this.pollingTimers.set(normTable, timerId);
    }

    _stopTablePolling(normTable) {
        if (this.pollingTimers.has(normTable)) {
            clearInterval(this.pollingTimers.get(normTable));
            this.pollingTimers.delete(normTable);
        }
    }

    _startGlobalFallbackPolling() {
        if (this.pollingTimers.has('_global')) return;
        const timerId = setInterval(() => {
            if (this.connectionState === 'connected') {
                this._stopTablePolling('_global');
                return;
            }
            this._touchUpdated();
        }, 10000);
        this.pollingTimers.set('_global', timerId);
    }

    // حماية السجلات التي يجرى تعديلها حالياً من قبل المستخدم المحلي
    markRowEditing(rowId, isEditing = true) {
        if (isEditing) {
            this.editingRowIds.add(rowId);
        } else {
            this.editingRowIds.delete(rowId);
        }
    }

    isRowBeingEdited(rowId) {
        return this.editingRowIds.has(rowId);
    }

    // إغلاق وتنظيف جميع الاتصالات والتايمرز
    destroy() {
        this.pollingTimers.forEach(id => clearInterval(id));
        this.pollingTimers.clear();
        this.listeners.clear();
        this.stateListeners.clear();
        if (this.hubConnection) {
            try { this.hubConnection.stop(); } catch (e) {}
            this.hubConnection = null;
        }
        this._setState('disconnected');
    }
}

// إنشاء نسخة موحدة على مستوى التطبيق
window.realtimeSync = new RealtimeSyncService();
