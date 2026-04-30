/**
 * نظام إدارة المرتدات - نظام المصادقة
 */

class Auth {
    constructor() {
        this.currentUser = null;
        this.sessionKey = 'returns_session';
    }

    // ========================================
    // تسجيل الدخول والخروج
    // ========================================

    async login(username, password) {
        // الاتصال بالسيرفر للتحقق
        const result = await db.login(username, password);

        if (!result.success) {
            return result;
        }

        // حفظ الجلسة
        this.currentUser = result.user;
        if (!Array.isArray(this.currentUser.permissions)) {
            this.currentUser.permissions = [];
        }
        localStorage.setItem(this.sessionKey, JSON.stringify(this.currentUser));

        return { success: true, user: this.currentUser };
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem(this.sessionKey);
    }

    // ========================================
    // التحقق من الجلسة
    // ========================================

    checkSession() {
        const session = localStorage.getItem(this.sessionKey);
        if (session) {
            try {
                this.currentUser = JSON.parse(session);
                return true;
            } catch {
                this.logout();
                return false;
            }
        }
        return false;
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    getUser() {
        return this.currentUser;
    }

    // ========================================
    // التحقق من الصلاحيات
    // ========================================

    hasPermission(permission) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        if (Array.isArray(this.currentUser.permissions)) {
            return this.currentUser.permissions.includes(permission);
        }

        const permissions = {
            admin: ['view', 'export', 'import', 'archive', 'users', 'settings', 'dashboard', 'salary-returns', 'full-returns'],
            editor: ['view', 'export', 'import', 'archive', 'dashboard', 'salary-returns'],
            viewer: ['view', 'dashboard', 'salary-returns']
        };

        const userPermissions = permissions[this.currentUser.role] || [];
        return userPermissions.includes(permission);
    }

    isAdmin() {
        return this.currentUser?.role === 'admin';
    }

    canExport() {
        return this.hasPermission('action.export') || this.hasPermission('export');
    }

    canImport() {
        return this.hasPermission('action.import') || this.hasPermission('import');
    }

    canManageUsers() {
        return this.hasPermission('page.settings') || this.hasPermission('users');
    }

    canAccessArchive() {
        return this.hasPermission('page.archive') || this.hasPermission('archive');
    }

    canAccessPage(page) {
        return this.hasPermission(`page.${page}`);
    }

    canDo(action) {
        return this.hasPermission(`action.${action}`);
    }
}

// تصدير
window.auth = new Auth();

