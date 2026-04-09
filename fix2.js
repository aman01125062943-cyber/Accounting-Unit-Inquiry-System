const fs = require('fs');
const appJsPath = 'C:\\Users\\esth633\\Desktop\\hk\\wwwroot\\js\\app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

// 1. إصلاح عدم تحميل البيانات في الدالة refreshCurrentPage
const targetRefresh = /this\.loadReturns\(this\.pagination\?\.currentPage \|\| 1, itemsPerPage, this\.currentSearch, this\.currentFilter\);/g;
appJs = appJs.replace(targetRefresh, "this.loadReturns(this.pagination?.currentPage || 1, itemsPerPage, this.searchQuery || '', this.filterValue || 'all', this.attachmentFilterValue || 'all');");

const targetRefreshSalary = /this\.loadSalaryReturns\(this\.salaryPagination\?\.currentPage \|\| 1, itemsPerPage, this\.salarySearchQuery\);/g;
appJs = appJs.replace(targetRefreshSalary, "this.loadSalaryReturns(this.salaryPagination?.currentPage || 1, itemsPerPage, this.salarySearchQuery || '', this.salaryFilterValue || 'all', this.salaryAttachmentFilterValue || 'all');");

// 2. ترحيل اسم المستخدم عند رفع المرفق لمنع الإشعار الذاتي
const uploadTarget = /`\$\{baseUrl\}\/attachments\/\$\{this\.currentReturnId\}`/g;
appJs = appJs.replace(uploadTarget, "`\${baseUrl}/attachments/\${this.currentReturnId}?user=\${encodeURIComponent(this.currentUser?.fullname || 'مستخدم')}`");

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('Fixed variables and attachment upload user param');
