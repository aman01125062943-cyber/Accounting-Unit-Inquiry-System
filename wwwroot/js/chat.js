/**
 * ChatModule - نظام المراسلة والمهام
 */
class ChatModule {
    constructor() {
        this.hubConnection = null;
        this.users = [];
        this.conversations = [];
        this.currentConversationId = null;
        this.currentOtherUserId = null;
        this.currentUser = null;
        this.messages = [];
        this.tasks = [];
        this.unreadTotal = 0;
        
        this.elements = {
            userList: null,
            conversationList: null,
            messageArea: null,
            input: null,
            sendBtn: null,
            chatHeaderName: null,
            chatHeaderStatus: null,
            tasksPanel: null,
            tasksList: null,
            emptyState: null,
            chatMain: null,
            unreadBadge: null,
            searchInput: null
        };
    }

    async init() {
        if (!auth.isAuthenticated()) return;
        this.currentUser = auth.getUser();
        if (!this.currentUser) return;

        this._bindElements();
        this._setupEventListeners();
        
        try {
            // تهيئة جداول قاعدة البيانات عند أول مرة
            await db.fetchApi('/chat/init');
            
            await this.loadUsers();
            await this.initSignalR();
            await this.loadConversations();
            
            // تحديث مؤشر الإشعارات
            this.updateTotalUnreadCount();
        } catch (e) {
            console.error('[Chat] Initialization error:', e);
        }
    }

    _bindElements() {
        this.elements.userList = document.getElementById('chat-users-list');
        this.elements.conversationList = document.getElementById('chat-conversations-list');
        this.elements.messageArea = document.getElementById('chat-messages-area');
        this.elements.input = document.getElementById('chat-message-input');
        this.elements.sendBtn = document.getElementById('chat-send-btn');
        this.elements.chatHeaderName = document.getElementById('chat-header-name');
        this.elements.chatHeaderStatus = document.getElementById('chat-header-status');
        this.elements.tasksPanel = document.getElementById('chat-tasks-panel');
        this.elements.tasksList = document.getElementById('chat-tasks-list');
        this.elements.emptyState = document.getElementById('chat-empty-state');
        this.elements.chatMain = document.getElementById('chat-main-area');
        this.elements.unreadBadge = document.getElementById('chat-unread-badge');
        this.elements.searchInput = document.getElementById('chat-search-input');
    }

    _setupEventListeners() {
        if(this.elements.sendBtn) {
            this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        if(this.elements.input) {
            this.elements.input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            this.elements.input.addEventListener('input', () => {
                // Auto-resize textarea
                this.elements.input.style.height = 'auto';
                this.elements.input.style.height = (this.elements.input.scrollHeight) + 'px';
                
                if(this.elements.input.value.trim() !== '') {
                    this.elements.sendBtn.removeAttribute('disabled');
                } else {
                    this.elements.sendBtn.setAttribute('disabled', 'true');
                }
            });
        }
        
        if(this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', (e) => {
                if(document.querySelector('.chat-tab-btn[data-tab="conversations"]').classList.contains('active')) {
                    this.renderConversations(e.target.value);
                } else {
                    this.renderUsers(e.target.value);
                }
            });
        }

        // تحويل التبويبات (محادثات / مستخدمين)
        document.querySelectorAll('.chat-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.chat-tab-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                const tab = e.currentTarget.dataset.tab;
                if(this.elements.searchInput) this.elements.searchInput.value = '';
                
                if (tab === 'conversations') {
                    if(this.elements.userList) this.elements.userList.style.display = 'none';
                    if(this.elements.conversationList) this.elements.conversationList.style.display = 'block';
                    this.renderConversations();
                } else {
                    if(this.elements.conversationList) this.elements.conversationList.style.display = 'none';
                    if(this.elements.userList) this.elements.userList.style.display = 'block';
                    this.renderUsers();
                }
            });
        });
    }

    async initSignalR() {
        if (!this.currentUser) return;
        
        // استخدام اتصال مستقل عن الإشعارات العامة
        this.hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(`/chatHub?userId=${this.currentUser.id}`)
            .withAutomaticReconnect([0, 2000, 10000, 30000])
            .build();

        this.hubConnection.on("ReceiveMessage", (message) => {
            console.log("Chat message received:", message);
            
            // إذا كانت الرسالة في المحادثة المفتوحة حالياً
            if (this.currentConversationId == message.conversationId) {
                this.messages.push(message);
                this.renderMessage(message, true);
                
                // تحديد كمقروءة مباشرة بما أن المحادثة مفتوحة
                if (message.senderId != this.currentUser.id) {
                    this.markMessagesAsRead(message.conversationId);
                }
            } else if (message.senderId != this.currentUser.id) {
                // إظهار إشعار عام إذا لم تكن المحادثة مفتوحة
                this.showGlobalMessageNotification(message);
                window.app?.playNotificationSound();
            } else {
                window.app?.playNotificationSound();
            }
            
            // تحديث قائمة المحادثات لرفعها للأعلى
            this.updateConversationLastMessage(message.conversationId, message);
        });

        this.hubConnection.on("MessageRead", (conversationId, readerId) => {
            if (this.currentConversationId == conversationId && readerId != this.currentUser.id) {
                this.loadMessages(conversationId); // إعادة تحميل بسيط لتحديث الدبل-تشيك
            }
        });

        this.hubConnection.on("TaskCreated", (task) => {
            if (this.currentConversationId == task.conversationId) {
                this.tasks.unshift(task);
                this.renderTasks();
                // وضع علامة على الرسالة في الواجهة بأنها تحولت لمهمة
                const btn = document.querySelector(`.chat-msg-action-btn[onclick*="showTaskModal(${task.messageId})"]`);
                if(btn) {
                    btn.classList.add('task-converted');
                    btn.title = 'تم التحويل لمهمة';
                    btn.innerHTML = '<i class="fas fa-check-circle"></i>';
                }
            }
        });

        this.hubConnection.on("TaskStatusChanged", (data) => {
            const taskIndex = this.tasks.findIndex(t => t.id == data.taskId);
            if (taskIndex !== -1) {
                this.tasks[taskIndex].status = data.status;
                this.tasks[taskIndex].updatedAt = data.updatedAt;
                this.renderTasks();
            }
        });

        this.hubConnection.on("UserOnline", (userId) => {
            this.updateUserStatus(userId, true);
        });

        this.hubConnection.on("UserOffline", (userId) => {
            this.updateUserStatus(userId, false);
        });

        try {
            await this.hubConnection.start();
            console.log("[Chat] SignalR Connected");
            await this.hubConnection.invoke("RegisterUser", parseInt(this.currentUser.id));
        } catch (err) {
            console.error("[Chat] SignalR Error:", err.toString());
            // Retry after 5 secs
            setTimeout(() => this.initSignalR(), 5000);
        }
    }

    async loadUsers() {
        try {
            const response = await db.fetchApi('/chat/users');
            console.log('[Chat] Users response:', response);
            if (Array.isArray(response)) {
                // استبعاد المستخدم الحالي من القائمة مع التأكد من مطابقة النوع
                this.users = response.filter(u => String(u.id) !== String(this.currentUser.id));
                console.log('[Chat] Users initialized:', this.users.length);
                
                // إضافة استدعاء renderUsers لضمان ظهور القائمة فور التحميل
                this.renderUsers();
            }
        } catch (e) {
            console.error('[Chat] Failed to load users', e);
        }
    }

    async loadConversations() {
        if (!this.currentUser) return;
        try {
            const response = await db.fetchApi(`/chat/conversations/${this.currentUser.id}`);
            if (Array.isArray(response)) {
                this.conversations = response;
                
                // إذا كنا في التبويب الخاص بالمحادثات
                const activeTab = document.querySelector('.chat-tab-btn.active');
                if (activeTab && activeTab.dataset.tab === 'conversations') {
                    this.renderConversations();
                }
                
                this.updateTotalUnreadCount();
                
                // الانضمام لغرف المحادثات في SignalR
                if (this.hubConnection && this.hubConnection.state === "Connected") {
                    this.conversations.forEach(c => {
                        this.hubConnection.invoke("JoinConversation", c.id).catch(err => console.error(err));
                    });
                }
            }
        } catch (e) {
            console.error('[Chat] Failed to load conversations', e);
        }
    }

    renderConversations(filter = '') {
        if (!this.elements.conversationList) return;
        this.elements.conversationList.innerHTML = '';
        
        let filtered = this.conversations;
        if (filter.trim() !== '') {
            const lowerFilter = filter.toLowerCase();
            filtered = this.conversations.filter(c => c.otherUserName.toLowerCase().includes(lowerFilter));
        }
        
        if (filtered.length === 0) {
            this.elements.conversationList.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b; font-size: 0.9em;">لا توجد محادثات سابقة</div>';
            return;
        }
        
        filtered.forEach(conv => {
            const dateStr = this.formatDateOrTime(conv.lastMessageAt);
            const isActive = this.currentConversationId == conv.id ? 'active' : '';
            const isUnread = conv.unreadCount > 0 ? 'unread' : '';
            
            const colorClass = this.getUserColorClass(conv.otherUserId);
            const avatarChar = conv.otherUserName ? conv.otherUserName.charAt(0) : '?';
            const onlineClass = conv.isOnline ? '' : 'offline';
            
            const lastMsgPreview = conv.lastMessage ? conv.lastMessage : 'بدأت المحادثة...';
            
            const html = `
                <div class="chat-list-item ${isActive} ${isUnread}" onclick="window.chatModule.openConversation(${conv.id}, ${conv.otherUserId}, '${conv.otherUserName}', ${conv.isOnline})">
                    <div class="chat-avatar ${colorClass}">
                        ${avatarChar}
                        <div class="online-indicator ${onlineClass}" id="online-indicator-conv-${conv.otherUserId}"></div>
                    </div>
                    <div class="chat-list-info">
                        <div style="display: flex; justify-content: space-between; align-items: baseline;">
                            <div class="chat-list-name">${conv.otherUserName}</div>
                            <div class="chat-list-time">${dateStr}</div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div class="chat-list-preview">${lastMsgPreview}</div>
                            ${conv.unreadCount > 0 ? `<div class="chat-unread-count">${conv.unreadCount}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            this.elements.conversationList.insertAdjacentHTML('beforeend', html);
        });
    }

    renderUsers(filter = '') {
        if (!this.elements.userList) return;
        this.elements.userList.innerHTML = '';
        
        let filtered = this.users;
        if (filter.trim() !== '') {
            const lowerFilter = filter.toLowerCase();
            filtered = this.users.filter(u => u.fullname.toLowerCase().includes(lowerFilter));
        }
        
        if (filtered.length === 0) {
            this.elements.userList.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b; font-size: 0.9em;">لا يوجد مستخدمين</div>';
            return;
        }
        
        filtered.forEach(user => {
            const colorClass = this.getUserColorClass(user.id);
            const onlineClass = user.isOnline ? '' : 'offline';
            const roleName = user.role === 'admin' ? 'مدير' : (user.role === 'editor' ? 'محرر' : 'مشاهد');
            
            const html = `
                <div class="chat-list-item" onclick="window.chatModule.startNewConversation(${user.id}, '${user.fullname}')">
                    <div class="chat-avatar ${colorClass}">
                        ${user.avatar}
                        <div class="online-indicator ${onlineClass}" id="online-indicator-user-${user.id}"></div>
                    </div>
                    <div class="chat-list-info">
                        <div class="chat-list-name">${user.fullname}</div>
                        <div class="chat-list-preview" style="color: #475569;">${roleName}</div>
                    </div>
                </div>
            `;
            
            this.elements.userList.insertAdjacentHTML('beforeend', html);
        });
    }

    async startNewConversation(userId, userName) {
        if (!this.currentUser) return;
        try {
            const response = await db.fetchApi('/chat/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user1Id: parseInt(this.currentUser.id),
                    user2Id: userId
                })
            });
            
            if (response.success) {
                // إذا كانت محادثة جديدة للتو، نحدث القائمة أولاً
                if (response.isNew) {
                    await this.loadConversations();
                }
                
                const userObj = this.users.find(u => u.id == userId);
                const isOnline = userObj ? userObj.isOnline : false;
                
                this.openConversation(response.conversationId, userId, userName, isOnline);
            }
        } catch (e) {
            console.error('[Chat] Failed to start conversation', e);
            window.app?.showToast('فشل في بدء المحادثة', 'error');
        }
    }

    async openConversation(convId, otherUserId, otherUserName, isOnline) {
        this.currentConversationId = convId;
        this.currentOtherUserId = otherUserId;
        
        // تحديث الواجهة
        if (this.elements.emptyState) this.elements.emptyState.style.display = 'none';
        if (this.elements.chatMain) this.elements.chatMain.style.display = 'flex';
        
        if (this.elements.chatHeaderName) this.elements.chatHeaderName.textContent = otherUserName;
        if (this.elements.chatHeaderStatus) {
            this.elements.chatHeaderStatus.textContent = isOnline ? 'متصل الآن' : 'غير متصل';
            this.elements.chatHeaderStatus.className = isOnline ? 'chat-header-status' : 'chat-header-status offline';
        }
        
        // تحديد كمقروء في واجهة القائمة
        const convIndex = this.conversations.findIndex(c => c.id == convId);
        if (convIndex !== -1 && this.conversations[convIndex].unreadCount > 0) {
            this.conversations[convIndex].unreadCount = 0;
            this.updateTotalUnreadCount();
            
            // في حالة كان التبويب مفعل
            const activeTab = document.querySelector('.chat-tab-btn.active');
            if (activeTab && activeTab.dataset.tab === 'conversations') {
                this.renderConversations(this.elements.searchInput ? this.elements.searchInput.value : '');
            }
            
            // إبلاغ الخادم
            this.markMessagesAsRead(convId);
        } else {
            // تحديث التحديد النشط في القائمة
            document.querySelectorAll('.chat-list-item').forEach(item => item.classList.remove('active'));
            const activeItem = document.querySelector(`.chat-list-item[onclick*="openConversation(${convId}"]`);
            if (activeItem) activeItem.classList.add('active');
        }
        
        // تحميل الرسائل والمهام
        this.elements.messageArea.innerHTML = '<div style="text-align: center; padding: 20px; color: #64748b;">جاري التحميل...</div>';
        
        await Promise.all([
            this.loadMessages(convId),
            this.loadTasksForConversation(convId)
        ]);
        
        // تركيز حقل الإدخال
        if(this.elements.input) {
            this.elements.input.value = '';
            this.elements.input.style.height = 'auto';
            this.elements.input.focus();
            if(window.innerWidth > 768) {
                // فقط في الشاشات الكبيرة كي لا تنفتح لوحة المفاتيح في الموبايل فجأة
            }
        }
        if(this.elements.sendBtn) this.elements.sendBtn.setAttribute('disabled', 'true');
    }

    async loadMessages(convId) {
        try {
            const response = await db.fetchApi(`/chat/messages/${convId}`);
            if (response.data) {
                this.messages = response.data;
                this.renderAllMessages();
            }
        } catch (e) {
            console.error('[Chat] Failed to load messages', e);
            if(this.elements.messageArea) this.elements.messageArea.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">خطأ في تحميل الرسائل</div>';
        }
    }

    renderAllMessages() {
        if (!this.elements.messageArea) return;
        this.elements.messageArea.innerHTML = '';
        
        if (this.messages.length === 0) {
            const emptyHtml = `<div style="text-align: center; color: #64748b; padding: 30px; font-size: 0.9em; background: rgba(0,240,255,0.02); border-radius: 12px; margin: 20px;">
                <div style="font-size: 2em; margin-bottom: 10px;">👋</div>
                أرسل رسالة للبدء
            </div>`;
            this.elements.messageArea.innerHTML = emptyHtml;
            return;
        }
        
        let lastDate = null;
        
        this.messages.forEach(msg => {
            // فاصل التاريخ
            const msgDate = Date.parse(msg.sentAt);
            if (!isNaN(msgDate)) {
                const dateObj = new Date(msgDate);
                const dateStr = dateObj.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
                
                if (dateStr !== lastDate) {
                    this.elements.messageArea.insertAdjacentHTML('beforeend', `
                        <div class="chat-date-separator">
                            <span>${dateStr}</span>
                        </div>
                    `);
                    lastDate = dateStr;
                }
            }
            
            this.renderMessage(msg, false);
        });
        
        this.scrollToBottom();
    }

    renderMessage(msg, isNew = false) {
        if (!this.elements.messageArea) return;
        
        // إزالة رسالة "أرسل رسالة للبدء" لو موجودة
        if (this.messages.length === 1 && isNew) {
            this.elements.messageArea.innerHTML = '';
        }
        
        const isSentByMe = msg.senderId == this.currentUser.id;
        const msgClass = isSentByMe ? 'sent' : 'received';
        
        const timeStr = this.formatTimeOnly(msg.sentAt);
        const tickHtml = isSentByMe ? (msg.isRead ? '<i class="fas fa-check-double chat-read-tick"></i>' : '<i class="fas fa-check chat-read-tick" style="color: #64748b;"></i>') : '';
        
        const taskBtnClass = msg.isTaskConverted ? 'task-converted' : '';
        const taskBtnTitle = msg.isTaskConverted ? 'تم التحويل لمهمة' : 'تحويل لمهمة';
        const taskIcon = msg.isTaskConverted ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-tasks"></i>';
        
        // استبدال \n بـ <br> للتنسيق المكتوب
        const formattedContent = msg.content.replace(/\n/g, '<br>');
        
        const html = `
            <div class="chat-message-wrapper ${msgClass}" id="msg-${msg.id}">
                <div class="chat-bubble">
                    ${formattedContent}
                    <div class="chat-msg-actions">
                        <button class="chat-msg-action-btn ${taskBtnClass}" title="${taskBtnTitle}" onclick="window.chatModule.showTaskModal(${msg.id}, '${msg.content.replace(/'/g, "\\'")}')">
                            ${taskIcon}
                        </button>
                    </div>
                </div>
                <div class="chat-msg-time">
                    ${timeStr} ${tickHtml}
                </div>
            </div>
        `;
        
        this.elements.messageArea.insertAdjacentHTML('beforeend', html);
        
        if (isNew) {
            this.scrollToBottom();
        }
    }

    scrollToBottom() {
        if (this.elements.messageArea) {
            this.elements.messageArea.scrollTop = this.elements.messageArea.scrollHeight;
        }
    }

    async sendMessage() {
        if (!this.elements.input || !this.currentConversationId || !this.currentUser) return;
        
        const content = this.elements.input.value.trim();
        if (content === '') return;
        
        const reqData = {
            conversationId: this.currentConversationId,
            senderId: parseInt(this.currentUser.id),
            content: content
        };
        
        // تفريغ الحقل سريعاً للتجربة الجيدة
        this.elements.input.value = '';
        this.elements.input.style.height = 'auto';
        this.elements.sendBtn.setAttribute('disabled', 'true');
        
        try {
            const response = await db.fetchApi('/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqData)
            });
            
            if (response.success && response.message) {
                // سيأتي الإشعار عبر SignalR ولكن نسرع العملية بإضافتها محلياً إن لم تأتِ بعد
                if (!this.messages.find(m => m.id == response.message.id)) {
                    this.messages.push(response.message);
                    this.renderMessage(response.message, true);
                    this.updateConversationLastMessage(this.currentConversationId, response.message);
                }
            }
        } catch (e) {
            console.error('[Chat] Failed to send message', e);
            window.app?.showToast('فشل في إرسال الرسالة', 'error');
            // استعادة النص لو فشل
            this.elements.input.value = content;
            this.elements.sendBtn.removeAttribute('disabled');
        }
    }

    async markMessagesAsRead(convId) {
        if (!this.currentUser) return;
        try {
            await db.fetchApi(`/chat/messages/read/${convId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ readerId: parseInt(this.currentUser.id) })
            });
        } catch (e) {
            // صامت
        }
    }

    updateConversationLastMessage(convId, message) {
        const convIndex = this.conversations.findIndex(c => c.id == convId);
        if (convIndex !== -1) {
            this.conversations[convIndex].lastMessageAt = message.sentAt;
            this.conversations[convIndex].lastMessage = message.content;
            
            if (message.senderId != this.currentUser.id && this.currentConversationId != convId) {
                this.conversations[convIndex].unreadCount++;
                this.updateTotalUnreadCount();
            }
            
            // نقل المحادثة للأعلى
            const convObj = this.conversations.splice(convIndex, 1)[0];
            this.conversations.unshift(convObj);
            
            // إعادة رسم القائمة إن كانت معروضة ولا يوجد بحث
            const activeTab = document.querySelector('.chat-tab-btn.active');
            if (activeTab && activeTab.dataset.tab === 'conversations') {
                if(!this.elements.searchInput || this.elements.searchInput.value.trim() === '') {
                    this.renderConversations();
                }
            }
        }
    }

    // ========================================
    // المهام
    // ========================================

    toggleTasksPanel() {
        if (this.elements.tasksPanel) {
            this.elements.tasksPanel.classList.toggle('show');
        }
    }

    async loadTasksForConversation(convId) {
        try {
            const response = await db.fetchApi(`/chat/tasks/conversation/${convId}`);
            if (Array.isArray(response)) {
                this.tasks = response;
                this.renderTasks();
                
                // إضافة زر فتح المهام للهيدر إن لم يكن موجوداً
                const HeaderActions = document.querySelector('.chat-header-actions');
                let toggleTasksBtn = document.getElementById('toggle-tasks-btn');
                
                if(!toggleTasksBtn && HeaderActions) {
                    toggleTasksBtn = document.createElement('button');
                    toggleTasksBtn.id = 'toggle-tasks-btn';
                    toggleTasksBtn.className = 'chat-header-btn';
                    toggleTasksBtn.innerHTML = '<i class="fas fa-tasks"></i>';
                    toggleTasksBtn.onclick = () => this.toggleTasksPanel();
                    HeaderActions.prepend(toggleTasksBtn);
                }
                
                // تحديث الستايل للزر لو المهام موجودة
                if (toggleTasksBtn) {
                    if(this.tasks.length > 0) {
                        toggleTasksBtn.style.color = '#00f0ff';
                        toggleTasksBtn.style.borderColor = 'rgba(0,240,255,0.4)';
                        toggleTasksBtn.innerHTML = `<i class="fas fa-tasks"></i><span style="position:absolute; top:-5px; right:-5px; background:#ef4444; color:#fff; font-size:10px; padding:2px 5px; border-radius:10px; font-weight:bold;">${this.tasks.length}</span>`;
                    } else {
                        toggleTasksBtn.style.color = '';
                        toggleTasksBtn.style.borderColor = '';
                        toggleTasksBtn.innerHTML = '<i class="fas fa-tasks"></i>';
                    }
                }
            }
        } catch (e) {
            console.error('[Chat] Failed to load tasks', e);
        }
    }

    renderTasks() {
        if (!this.elements.tasksList) return;
        this.elements.tasksList.innerHTML = '';
        
        if (this.tasks.length === 0) {
            this.elements.tasksList.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b; font-size: 0.85em;">لا توجد مهام في هذه المحادثة</div>';
            return;
        }
        
        this.tasks.forEach(task => {
            const priorityClass = `priority-${task.priority.toLowerCase()}`;
            const statusClass = `status-${task.status.toLowerCase()}`;
            
            const pText = task.priority === 'High' ? 'عالي' : (task.priority === 'Low' ? 'منخفض' : 'متوسط');
            
            let statusDisplayHtml = '';
            
            // إذا كان المستخدم الحالي هو المنشئ أو المُكلف يمكنه تغيير الحالة
            if (this.currentUser.id == task.createdById || this.currentUser.id == task.assignedToId || this.currentUser.role === 'admin') {
                statusDisplayHtml = `
                    <select class="chat-task-status-select" onchange="window.chatModule.updateTaskStatus(${task.id}, this.value)">
                        <option value="New" ${task.status==='New'?'selected':''}>جديد</option>
                        <option value="InProgress" ${task.status==='InProgress'?'selected':''}>جاري العمل</option>
                        <option value="Delayed" ${task.status==='Delayed'?'selected':''}>مؤجل</option>
                        <option value="Done" ${task.status==='Done'?'selected':''}>منجز</option>
                        <option value="Canceled" ${task.status==='Canceled'?'selected':''}>ملغي</option>
                    </select>
                `;
            } else {
                const sText = task.status === 'New' ? 'جديد' : (task.status === 'Done' ? 'منجز' : (task.status === 'InProgress' ? 'جاري العمل' : task.status));
                statusDisplayHtml = `<span class="chat-task-badge ${statusClass}">${sText}</span>`;
            }
            
            let quotedText = '';
            if (task.messageContent) {
                // عرض مقتطف من الرسالة الأصلية
                let shortMsg = task.messageContent.length > 50 ? task.messageContent.substring(0, 50) + '...' : task.messageContent;
                quotedText = `<div class="chat-task-quoted-msg" style="margin-bottom: 8px;">"${shortMsg}"</div>`;
            }
            
            const html = `
                <div class="chat-task-card">
                    ${quotedText}
                    <h5 class="chat-task-title">${task.title}</h5>
                    ${task.description ? `<p style="font-size: 0.8em; color: #94a3b8; margin: 0 0 8px;">${task.description}</p>` : ''}
                    
                    <div class="chat-task-meta">
                        <span class="chat-task-badge ${priorityClass}">${pText}</span>
                        ${statusDisplayHtml}
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 10px; padding-top: 8px;">
                        <div class="chat-task-assignee">لـ: ${task.assignedToName}</div>
                        ${task.dueDate ? `<div class="chat-task-assignee" style="color: #00f0ff;"><i class="far fa-clock"></i> ${task.dueDate}</div>` : ''}
                    </div>
                </div>
            `;
            
            this.elements.tasksList.insertAdjacentHTML('beforeend', html);
        });
    }

    async updateTaskStatus(taskId, newStatus) {
        if (!this.currentUser) return;
        try {
            const response = await db.fetchApi(`/chat/tasks/${taskId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    updatedById: parseInt(this.currentUser.id)
                })
            });
            
            if (response.success) {
                window.app?.showToast('تم تحديث المهمة بنجاح', 'success');
            }
        } catch (e) {
            console.error('[Chat] Failed to update task', e);
            window.app?.showToast('فشل في تحديث المهمة', 'error');
            // استرجاع القيمة السابقة بالواجهة لو أمكن (اختياري)
        }
    }

    showTaskModal(messageId, messageContent) {
        let modal = document.getElementById('chat-task-modal');
        
        if (!modal) {
            // إنشاء الـ Modal إذا لم يكن موجوداً
            const modalHtml = `
                <div id="chat-task-modal" class="chat-task-modal-overlay">
                    <div class="chat-task-modal">
                        <div class="chat-task-modal-header">
                            <h3>تحويل رسالة إلى مهمة</h3>
                            <button class="chat-task-modal-close" onclick="document.getElementById('chat-task-modal').classList.remove('show')">✕</button>
                        </div>
                        <div class="chat-task-modal-body">
                            <input type="hidden" id="task-modal-message-id" value="">
                            
                            <div class="chat-task-quoted-msg" id="task-modal-quote"></div>
                            
                            <div class="chat-task-form-group">
                                <label>عنوان المهمة (إلزامي)*</label>
                                <input type="text" id="task-modal-title" placeholder="اكتب عنواناً واضحاً للمهمة...">
                            </div>
                            
                            <div class="chat-task-form-group">
                                <label>الوصف أو ملاحظات</label>
                                <textarea id="task-modal-desc" placeholder="أضف تفاصيل أخرى للمهمة إن وجدت..."></textarea>
                            </div>
                            
                            <div class="chat-task-form-row">
                                <div class="chat-task-form-group">
                                    <label>تكليف إلى</label>
                                    <select id="task-modal-assignee"></select>
                                </div>
                                <div class="chat-task-form-group">
                                    <label>تاريخ الاستحقاق</label>
                                    <input type="date" id="task-modal-date">
                                </div>
                            </div>
                            
                            <div class="chat-task-form-row">
                                <div class="chat-task-form-group">
                                    <label>الأولوية</label>
                                    <select id="task-modal-priority">
                                        <option value="Medium" selected>متوسط</option>
                                        <option value="High">عالي</option>
                                        <option value="Low">منخفض</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="chat-task-modal-footer">
                            <button class="chat-task-save-btn" onclick="window.chatModule.saveNewTask()">إنشاء المهمة وربطها</button>
                            <button class="chat-task-cancel-btn" onclick="document.getElementById('chat-task-modal').classList.remove('show')">إلغاء</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            modal = document.getElementById('chat-task-modal');
        }
        
        // تعبئة البيانات
        document.getElementById('task-modal-message-id').value = messageId;
        document.getElementById('task-modal-quote').textContent = `"${messageContent}"`;
        document.getElementById('task-modal-title').value = messageContent.length > 40 ? messageContent.substring(0, 40) + '...' : messageContent;
        document.getElementById('task-modal-desc').value = '';
        
        const assigneeSelect = document.getElementById('task-modal-assignee');
        assigneeSelect.innerHTML = `<option value="${this.currentOtherUserId}">${this.elements.chatHeaderName?.textContent || 'الطرف الآخر'}</option>`;
        assigneeSelect.innerHTML += `<option value="${this.currentUser.id}">نفسي (${this.currentUser.fullname})</option>`;
        
        // يمكن إضافة باقي المستخدمين
        this.users.forEach(u => {
            if(u.id != this.currentOtherUserId && u.id != this.currentUser.id) {
                assigneeSelect.innerHTML += `<option value="${u.id}">${u.fullname}</option>`;
            }
        });
        
        // إظهار المودال
        modal.classList.add('show');
    }

    async saveNewTask() {
        if (!this.currentUser || !this.currentConversationId) return;
        
        const messageId = document.getElementById('task-modal-message-id').value;
        const title = document.getElementById('task-modal-title').value.trim();
        const desc = document.getElementById('task-modal-desc').value.trim();
        const assignee = document.getElementById('task-modal-assignee').value;
        const duedate = document.getElementById('task-modal-date').value;
        const priority = document.getElementById('task-modal-priority').value;
        
        if (title === '') {
            window.app?.showToast('يرجى إدخال عنوان المهمة', 'error');
            return;
        }
        
        const btn = document.querySelector('.chat-task-save-btn');
        btn.disabled = true;
        btn.textContent = 'جاري الحفظ...';
        
        try {
            const reqData = {
                messageId: parseInt(messageId),
                conversationId: parseInt(this.currentConversationId),
                title: title,
                description: desc,
                dueDate: duedate,
                priority: priority,
                assignedToId: parseInt(assignee),
                createdById: parseInt(this.currentUser.id),
                attachments: null
            };
            
            const response = await db.fetchApi('/chat/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqData)
            });
            
            if (response.success) {
                document.getElementById('chat-task-modal').classList.remove('show');
                window.app?.showToast('تم ربط المهمة بنجاح', 'success');
                
                // في حالة استجابة النظام ستضاف عبر SignalR، ولكن للتأكيد المزدوج:
                if (this.messages) {
                    const msg = this.messages.find(m => m.id == messageId);
                    if (msg) msg.isTaskConverted = true;
                }
            }
        } catch (e) {
            console.error('[Chat] Failed to save task', e);
            window.app?.showToast('فشل في حفظ المهمة', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'إنشاء المهمة وربطها';
        }
    }

    // ========================================
    // مساعدات وتنسيق
    // ========================================

    updateUserStatus(userId, isOnline) {
        // تحديث في القائمة
        const userObj = this.users.find(u => u.id == userId);
        if (userObj) userObj.isOnline = isOnline;
        
        const convObj = this.conversations.find(c => c.otherUserId == userId);
        if (convObj) convObj.isOnline = isOnline;
        
        // تحديث الـ DOM
        const userIndicator = document.getElementById(`online-indicator-user-${userId}`);
        if (userIndicator) {
            userIndicator.className = isOnline ? 'online-indicator' : 'online-indicator offline';
        }
        
        const convIndicator = document.getElementById(`online-indicator-conv-${userId}`);
        if (convIndicator) {
            convIndicator.className = isOnline ? 'online-indicator' : 'online-indicator offline';
        }
        
        // تحديث هيدر المحادثة إذا كانت المفتوحة حالياً للطرف الآخر
        if (this.currentOtherUserId == userId && this.elements.chatHeaderStatus) {
            this.elements.chatHeaderStatus.textContent = isOnline ? 'متصل الآن' : 'غير متصل';
            this.elements.chatHeaderStatus.className = isOnline ? 'chat-header-status' : 'chat-header-status offline';
        }
    }

    updateTotalUnreadCount() {
        this.unreadTotal = this.conversations.reduce((acc, curr) => acc + curr.unreadCount, 0);
        
        if (this.elements.unreadBadge) {
            if (this.unreadTotal > 0) {
                this.elements.unreadBadge.textContent = this.unreadTotal;
                this.elements.unreadBadge.classList.remove('hidden');
                this.elements.unreadBadge.style.display = 'inline-block';
            } else {
                this.elements.unreadBadge.classList.add('hidden');
                this.elements.unreadBadge.style.display = 'none';
            }
        }
    }

    getUserColorClass(userId) {
        const colorsCount = 7;
        const colorIndex = (userId % colorsCount) + 1;
        return `color-${colorIndex}`;
    }

    formatDateOrTime(dateStr) {
        if (!dateStr) return '';
        const dTimestamp = Date.parse(dateStr);
        if (isNaN(dTimestamp)) return '';
        
        const d = new Date(dTimestamp);
        const now = new Date();
        
        // إذا كان اليوم
        if (d.toDateString() === now.toDateString()) {
            return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        }
        
        // إذا كان يوماً آخر
        return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    }
    
    formatTimeOnly(dateStr) {
        if (!dateStr) return '';
        const dTimestamp = Date.parse(dateStr);
        if (isNaN(dTimestamp)) return '';
        
        const d = new Date(dTimestamp);
        return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * إظهار إشعار عام عند استقبال رسالة جديدة
     */
    showGlobalMessageNotification(message) {
        // إذا كان المستخدم في نفس المحادثة أصلاً، لا داعي للإشعار العائم
        if (this.currentConversationId == message.conversationId) return;

        const container = document.body;
        const colorClass = this.getUserColorClass(message.senderId);
        const avatarChar = message.senderName ? message.senderName.charAt(0) : '?';
        
        // إنشاء عنصر الإشعار
        const notification = document.createElement('div');
        notification.className = 'global-chat-notification';
        
        notification.innerHTML = `
            <div class="gcn-avatar ${colorClass}">
                ${avatarChar}
            </div>
            <div class="gcn-content">
                <div class="gcn-sender">${message.senderName}</div>
                <div class="gcn-msg">${message.content}</div>
            </div>
            <div class="gcn-close" onclick="event.stopPropagation(); this.parentElement.classList.add('hiding'); setTimeout(() => this.parentElement.remove(), 400);">
                ✕
            </div>
        `;

        // منطق النقر لفتح المحادثة
        notification.onclick = () => {
            // الانتقال لصفحة الدردشة إذا لم نكن فيها
            if (window.app && window.app.currentPage !== 'chat') {
                window.app.navigateTo('chat');
            }

            // فتح المحادثة المحددة
            const otherUserName = message.senderName;
            const otherUserId = message.senderId;
            const convId = message.conversationId;
            
            // جلب حالة الاتصال من قائمة المستخدمين إن وجدت
            const userObj = this.users.find(u => u.id == otherUserId);
            const isOnline = userObj ? userObj.isOnline : false;

            this.openConversation(convId, otherUserId, otherUserName, isOnline);
            
            // إخفاء الإشعار
            notification.classList.add('hiding');
            setTimeout(() => notification.remove(), 400);
        };

        container.appendChild(notification);

        // إخفاء تلقائي بعد 5 ثوانٍ
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.add('hiding');
                setTimeout(() => notification.remove(), 400);
            }
        }, 5000);
    }
}

// تهيئة عامة
window.chatModule = new ChatModule();

// ربط مع load للـ app لتشغيله بعد التحميل الأساسي
const originalAppInit = window.app ? window.app.init : null;
if (window.app && typeof window.app.init === 'function') {
    // سيتم استدعاؤها من داخل app.js بطريقة آمنة
}
