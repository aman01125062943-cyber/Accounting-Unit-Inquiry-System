const fs = require('fs');
const appJsPath = 'C:\\Users\\esth633\\Desktop\\hk\\wwwroot\\js\\app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

// 1. إزالة السطر الذي يجبر إعادة تحميل الصفحة بالكامل
appJs = appJs.replace('App.prototype.refreshCurrentPage = function () { window.location.reload(); };', '// تم إيقاف فرض إعادة تحميل الصفحة لتفعيل التحديث الذكي');

// 2. تحديث شريط التقدم للتحميل العالمي
const targetLoading = `App.prototype.showLoading = function () {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.remove('hidden');
};

App.prototype.hideLoading = function () {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.add('hidden');
};`;

const newLoading = `App.prototype.showLoading = function () {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.remove('hidden');
    
    const pb = document.getElementById('global-progress-bar');
    if (pb) {
        pb.style.opacity = '1';
        pb.style.width = '0%';
        setTimeout(() => { pb.style.width = '75%'; }, 50);
    }
};

App.prototype.hideLoading = function () {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.add('hidden');
    
    const pb = document.getElementById('global-progress-bar');
    if (pb) {
        pb.style.width = '100%';
        setTimeout(() => {
            pb.style.opacity = '0';
            setTimeout(() => { pb.style.width = '0%'; }, 400);
        }, 500);
    }
};`;
appJs = appJs.replace(targetLoading, newLoading);

// 3. تحديث شريط التقدم للدوال المعرفة بطريقة أخرى
const altLoading = `    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }`;

const newAltLoading = `    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        const pb = document.getElementById('global-progress-bar');
        if (pb) {
            pb.style.opacity = '1';
            pb.style.width = '0%';
            setTimeout(() => { pb.style.width = '75%'; }, 50);
        }
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
        const pb = document.getElementById('global-progress-bar');
        if (pb) {
            pb.style.width = '100%';
            setTimeout(() => { pb.style.opacity = '0'; setTimeout(() => { pb.style.width = '0%'; }, 400); }, 500);
        }
    }`;
appJs = appJs.replace(altLoading, newAltLoading);

// 4. دالة التحديث الذكية للصفحة بدون تحميل كامل للموقع
const targetRefresh = /App\.prototype\.refreshCurrentPage = function \(\) \{[\s\S]*?if \(this\.loadDashboardStats\) this\.loadDashboardStats\(\);\s*\}\s*\};/m;

const newRefresh = `App.prototype.refreshCurrentPage = function () {
    console.log('[REFRESH] Smart partial refresh for:', this.currentPage);
    
    if (this.currentPage === 'returns') {
        const itemsPerPage = (this.pagination && this.pagination.itemsPerPage) ? this.pagination.itemsPerPage : 50;
        this.loadReturns(this.pagination?.currentPage || 1, itemsPerPage, this.currentSearch, this.currentFilter);
    } else if (this.currentPage === 'salary-returns') {
        const itemsPerPage = (this.salaryPagination && this.salaryPagination.itemsPerPage) ? this.salaryPagination.itemsPerPage : 200;
        this.loadSalaryReturns(this.salaryPagination?.currentPage || 1, itemsPerPage, this.salarySearchQuery);
    } else if (this.currentPage === 'full-returns') {
        this.loadFullReturns(1, 50, this.searchQuery || '', true);
    } else if (this.currentPage === 'dashboard') {
        if (typeof this.loadDashboardStats === 'function') this.loadDashboardStats();
    } else if (this.currentPage === 'archive') {
        if (typeof this.loadArchive === 'function') this.loadArchive();
    } else if (this.currentPage === 'smart-payment') {
        if (typeof this.runSmartPaymentMatch === 'function') this.runSmartPaymentMatch();
    }
};`;

if (targetRefresh.test(appJs)) {
    appJs = appJs.replace(targetRefresh, newRefresh);
}

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('Done replacement');
