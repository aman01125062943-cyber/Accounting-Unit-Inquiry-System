const fs = require('fs');

const appJsPath = 'C:\\Users\\esth633\\Desktop\\hk\\wwwroot\\js\\app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

const regex1 = /App\.prototype\.initSignalR = function \(\) \{[\s\S]*?console\.error\('\[RealTime\] Init failed:', e\);\s*}\s*};/m;

const newInitSignalR = `App.prototype.initSignalR = function () {
    try {
        if (!window.signalR) {
            console.warn('[RealTime] SignalR library not loaded.');
            return;
        }

        this.fillHubUrlField();        
        const customUrl = this.getHubUrl();
        const buildConnection = (url) => {
            this.hubConnection = new signalR.HubConnectionBuilder()
                .withUrl(url)
                .withAutomaticReconnect()
                .build();

            let dbChangeTimeout;
            let dbChangeQueue = [];

            const processQueue = async () => {
                const queueCopy = [...dbChangeQueue];
                dbChangeQueue = [];
                if (queueCopy.length === 0) return;

                let actionUser = '';
                const summary = {};
                
                queueCopy.forEach(item => {
                    if (item.user && !actionUser) actionUser = item.user;
                    
                    let opName = item.operation;
                    // ترجمة العمليات الأساسية من النظام
                    const opMap = {
                        "INSERT": "إضافة",
                        "UPDATE": "تعديل",
                        "DELETE": "حذف",
                        "UPDATE_SYS": "تحديث",
                        "تسوية": "سداد/تسوية",
                        "استيراد": "استيراد بيانات",
                        "رفع مرفق": "إضافة مرفق",
                        "حذف مرفق": "حذف مرفق",
                        "مزامنة": "مزامنة مجمعة",
                        "سداد ذكي": "سداد ذكي"
                    };
                    
                    const finalOpName = opMap[opName] || opName;
                    if (!summary[finalOpName]) {
                        summary[finalOpName] = 0;
                    }
                    summary[finalOpName]++;
                });

                const isSmartSettlement = queueCopy.some(item => item.operation === 'سداد ذكي' || item.table === 'SmartSettlement');
                
                let notifyMessage = '';
                const opsArray = Object.keys(summary).map(op => \`\${op} (\${summary[op]})\`);
                
                if (isSmartSettlement) {
                    const count = queueCopy.length;
                    notifyMessage = \`تم انتهاء السداد الذكي لعدد (\${count}) سجل. هل تريد التحديث؟\`;
                } else {
                    notifyMessage = \`تم تسجيل العمليات: \${opsArray.join(' | ')}. هل تريد التحديث؟\`;
                }

                this.playNotificationSound();
                const target = window.app || this;
                if (typeof target.showSignalRNotification === 'function') {
                    target.showSignalRNotification(notifyMessage, actionUser || 'النظام');
                } else {
                    this.showSignalRNotification(notifyMessage, actionUser || 'النظام');
                }
            };

            this.hubConnection.on("DbChange", (e) => {
                if (window.dbLastActionTime && (Date.now() - window.dbLastActionTime < 15000)) return;
                dbChangeQueue.push(e);
                clearTimeout(dbChangeTimeout);
                dbChangeTimeout = setTimeout(processQueue, 3000);
            });

            this.hubConnection.on("UpdateData", (source, user, operation) => {
                // If the operation is from current user, ignore it to avoid annoyance
                if (this.currentUser && user === this.currentUser.fullname) return;
                
                dbChangeQueue.push({ 
                    table: source, 
                    operation: operation || 'UPDATE_SYS', 
                    user: user 
                });
                
                clearTimeout(dbChangeTimeout);
                dbChangeTimeout = setTimeout(processQueue, 3000);
            });

            this.hubConnection.start()
                .then(() => console.log('[RealTime] Connected to SignalR Hub'))
                .catch(err => console.error("[RealTime] Error connecting:", err));
        };

        if (customUrl === "/notificationHub") {
            this.computeAutoHubUrl()
                .then(autoUrl => buildConnection(autoUrl || customUrl))
                .catch(() => buildConnection(customUrl));
        } else {
            buildConnection(customUrl);
        }

    } catch (e) {
        console.error('[RealTime] Init failed:', e);
    }
};`;

appJs = appJs.replace(regex1, newInitSignalR);

const regex2 = /App\.prototype\.showSignalRNotification = function \(sourceName, user\) \{[\s\S]*?setTimeout\(\(\) => banner\.remove\(\), 400\);\s*\}\s*\}, 15000\);\s*\};/m;

const newShowSignalR = `App.prototype.showSignalRNotification = function (message, user) {
    const bannerId = 'signalr-notification-banner';
    let banner = document.getElementById(bannerId);
    
    if (banner) banner.remove();
    
    banner = document.createElement('div');
    banner.id = bannerId;
    banner.dir = 'rtl';
    banner.style.cssText = \`
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: rgba(13, 22, 35, 0.98);
        color: white;
        padding: 15px 30px;
        z-index: 999999;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        animation: slideDownSignalR 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: 'Cairo', sans-serif;
        border-bottom: 3px solid #00f0ff;
    \`;
    
    if (!document.getElementById('slide-down-anim-signalr')) {
        const style = document.createElement('style');
        style.id = 'slide-down-anim-signalr';
        style.innerHTML = \`
            @keyframes slideDownSignalR {
                from { transform: translateY(-100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        \`;
        document.head.appendChild(style);
    }
    
    banner.innerHTML = \`
        <div style="display: flex; align-items: center; gap: 15px;">
            <div style="width: 40px; height: 40px; background: rgba(0, 240, 255, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-bell fa-shake" style="color: #00f0ff; animation-iteration-count: 2;"></i>
            </div>
            <div style="font-size: 1.05em;">
                <strong style="color: #ffc107;">[\${user}]:</strong> \${message}
            </div>
        </div>
        <div style="display: flex; gap: 12px;">
            <button id="banner-accept" class="btn" style="background: #00f0ff; color: #0d1623; font-weight: 800; padding: 6px 25px; border-radius: 8px; border: none; cursor: pointer; transition: all 0.2s;">
                <i class="fas fa-check-circle"></i> نعم، التحديث
            </button>
            <button id="banner-close" class="btn" style="background: transparent; color: #888; border: 1px solid #444; padding: 6px 20px; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                لاحقاً
            </button>
        </div>
    \`;
    
    document.body.appendChild(banner);
    
    const acceptBtn = document.getElementById('banner-accept');
    const closeBtn = document.getElementById('banner-close');

    acceptBtn.onclick = () => {
        this.refreshCurrentPage();
        banner.style.transition = 'all 0.4s ease-in';
        banner.style.transform = 'translateY(-100%)';
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 400);
    };
    
    closeBtn.onclick = () => {
        banner.style.transition = 'all 0.4s ease-in';
        banner.style.transform = 'translateY(-100%)';
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 400);
    };
    
    acceptBtn.onmouseover = () => { acceptBtn.style.background = '#00d0dd'; acceptBtn.style.boxShadow = '0 0 15px rgba(0,240,255,0.4)'; };
    acceptBtn.onmouseout = () => { acceptBtn.style.background = '#00f0ff'; acceptBtn.style.boxShadow = 'none'; };
    closeBtn.onmouseover = () => { closeBtn.style.color = 'white'; closeBtn.style.borderColor = 'white'; };
    closeBtn.onmouseout = () => { closeBtn.style.color = '#888'; closeBtn.style.borderColor = '#444'; };

    setTimeout(() => {
        if (banner.parentElement) {
            banner.style.transition = 'all 0.4s ease-in';
            banner.style.transform = 'translateY(-100%)';
            banner.style.opacity = '0';
            setTimeout(() => banner.remove(), 400);
        }
    }, 15000);
};`;

appJs = appJs.replace(regex2, newShowSignalR);
fs.writeFileSync(appJsPath, appJs, 'utf8');

const updatedJs = fs.readFileSync(appJsPath, 'utf8');
if (updatedJs.includes('نعم، التحديث')) {
   console.log("Success");
} else {
   console.log("Failed to replace");
}
