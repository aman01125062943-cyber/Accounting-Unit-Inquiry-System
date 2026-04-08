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

    getUser() {
        return this.currentUser;
    }

    // ========================================
    // التحقق من الصلاحيات
    // ========================================

    hasPermission(permission) {
        if (!this.currentUser) return false;

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
        return this.hasPermission('export');
    }

    canImport() {
        return this.hasPermission('import');
    }

    canManageUsers() {
        return this.hasPermission('users');
    }

    canAccessArchive() {
        return this.hasPermission('archive');
    }
}

// تصدير
window.auth = new Auth();
