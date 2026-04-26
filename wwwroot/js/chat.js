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
        this.selectedFile = null; // للمرفقات
        
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
            searchInput: null,
            attachBtn: null, // زر المرفقات
            fileInput: null, // حقل الملفات المخفي
            previewArea: null // منطقة المعاينة قبل الإرسال
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
            
            // طلب إذن الإشعارات تم إيقافه هنا لمنع الخطأ في المتصفح

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
        
        // المرفقات
        this.elements.attachBtn = document.getElementById('chat-attach-btn');
        this.elements.fileInput = document.getElementById('chat-file-input');
        this.elements.previewArea = document.getElementById('chat-attachment-preview-area');
    }

    _setupEventListeners() {
        if(this.elements.attachBtn) {
            this.elements.attachBtn.addEventListener('click', () => this.elements.fileInput.click());
        }

        if(this.elements.fileInput) {
            this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        }

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

    async deleteTask(taskId) {
        if (!this.currentUser) return;
        if (!confirm('هل أنت متأكد من حذف هذه المهمة؟')) return;
        
        try {
            const response = await db.fetchApi(`/chat/tasks/${taskId}?userId=${this.currentUser.id}`, {
                method: 'DELETE'
            });
            
            if (response.success) {
                window.app?.showToast('تم حذف المهمة بنجاح', 'success');
                this.tasks = this.tasks.filter(t => t.id != taskId);
                this.renderTasks(this.tasks);
            }
        } catch (e) {
            console.error('[Chat] Failed to delete task', e);
            window.app?.showToast('فشل في حذف المهمة', 'error');
        }
    }

    showRescheduleModal(taskId, currentDate, currentTime) {
        let modal = document.getElementById('chat-reschedule-modal');
        if (!modal) {
            const modalHtml = `
                <div id="chat-reschedule-modal" class="chat-task-modal-overlay">
                    <div class="chat-task-modal">
                        <div class="chat-task-modal-header">
                            <h3>إعادة جدولة المهمة</h3>
                            <button class="chat-task-modal-close" onclick="document.getElementById('chat-reschedule-modal').classList.remove('show')">✕</button>
                        </div>
                        <div class="chat-task-modal-body">
                            <input type="hidden" id="reschedule-task-id">
                            <div class="chat-task-form-group">
                                <label>تاريخ الاستحقاق الجديد</label>
                                <input type="date" id="reschedule-date">
                            </div>
                            <div class="chat-task-form-group">
                                <label>وقت التنبيه الجديد</label>
                                <div class="custom-time-picker">
                                    <select id="reschedule-hour">
                                        ${Array.from({length: 12}, (_, i) => `<option value="${i+1}">${i+1}</option>`).join('')}
                                    </select>
                                    <span>:</span>
                                    <select id="reschedule-minute">
                                        ${Array.from({length: 60}, (_, i) => `<option value="${i.toString().padStart(2, '0')}">${i.toString().padStart(2, '0')}</option>`).join('')}
                                    </select>
                                    <select id="reschedule-period">
                                        <option value="AM">صباحاً</option>
                                        <option value="PM">مساءً</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="chat-task-modal-footer">
                            <button class="chat-task-save-btn" onclick="window.chatModule.saveReschedule()">حفظ التعديلات</button>
                            <button class="chat-task-cancel-btn" onclick="document.getElementById('chat-reschedule-modal').classList.remove('show')">إلغاء</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            modal = document.getElementById('chat-reschedule-modal');
        }
        
        document.getElementById('reschedule-task-id').value = taskId;
        document.getElementById('reschedule-date').value = currentDate;
        
        // تعيين قيم الوقت في الـ picker المخصص
        if (currentTime) {
            const [h24, m] = currentTime.split(':');
            let h12 = parseInt(h24);
            const period = h12 >= 12 ? 'PM' : 'AM';
            h12 = h12 % 12;
            if (h12 === 0) h12 = 12;
            
            document.getElementById('reschedule-hour').value = h12;
            document.getElementById('reschedule-minute').value = m;
            document.getElementById('reschedule-period').value = period;
        }

        modal.classList.add('show');
    }

    async saveReschedule() {
        const taskId = document.getElementById('reschedule-task-id').value;
        const newDate = document.getElementById('reschedule-date').value;
        
        const hour = document.getElementById('reschedule-hour').value;
        const minute = document.getElementById('reschedule-minute').value;
        const period = document.getElementById('reschedule-period').value;
        const newTime = this._convertPickerTo24h(hour, minute, period);
        
        try {
            const response = await db.fetchApi(`/chat/tasks/${taskId}/reschedule`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId: parseInt(taskId),
                    newDueDate: newDate,
                    newReminderTime: newTime,
                    updatedById: parseInt(this.currentUser.id)
                })
            });
            
            if (response.success) {
                document.getElementById('chat-reschedule-modal').classList.remove('show');
                window.app?.showToast('تم تحديث موعد المهمة', 'success');
                
                // تحديث البيانات محلياً
                const task = this.tasks.find(t => t.id == taskId);
                if (task) {
                    task.dueDate = newDate;
                    task.reminderTime = newTime;
                    this.renderTasks(this.tasks);
                }
            }
        } catch (e) {
            console.error('[Chat] Failed to reschedule', e);
            window.app?.showToast('فشل في إعادة الجدولة', 'error');
        }
    }

    async initSignalR() {
        if (!this.currentUser) return;

        // نظام التنبيهات الصوتي بناءً على وقت المهام
        // فحص كل 15 ثانية لضمان الدقة وعدم تفويت أي دقيقة
        if (this.taskReminderInterval) clearInterval(this.taskReminderInterval);
        this.taskReminderInterval = setInterval(() => this.checkTaskReminders(), 15000); 

        // استخدام اتصال مستقل عن الإشعارات العامة
        this.hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(`/chatHub?userId=${this.currentUser.id}`)
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: retryContext => {
                    if (retryContext.elapsedMilliseconds < 60000) {
                        // If we've been reconnecting for less than 60 seconds, retry every 2s, 5s, 10s
                        return [2000, 5000, 10000][retryContext.previousRetryCount] || 15000;
                    } else {
                        // If we've been reconnecting for more than 60 seconds, retry every 30s
                        return 30000;
                    }
                }
            })
            .build();

        this.hubConnection.onreconnecting((error) => {
            console.warn("[Chat] SignalR Reconnecting:", error);
            window.app?.updateSignalRUI('reconnecting');
        });

        this.hubConnection.onreconnected((connectionId) => {
            console.log("[Chat] SignalR Reconnected:", connectionId);
            window.app?.updateSignalRUI('online');
            // Re-register user after reconnection
            this.hubConnection.invoke("RegisterUser", parseInt(this.currentUser.id)).catch(err => console.error(err));
        });

        this.hubConnection.onclose((error) => {
            console.error("[Chat] SignalR Closed:", error);
            window.app?.updateSignalRUI('offline');
            // Attempt to restart after a delay
            setTimeout(() => this.startHub(), 5000);
        });

        this.hubConnection.on("ReceiveMessage", (message) => {
            console.log("Chat message received:", message);
            
            const isFromMe = message.senderId == this.currentUser.id;
            
            // Play sound for all incoming messages (not from me)
            if (!isFromMe) {
                window.app?.playNotificationSound();
            }

            // إذا كانت الرسالة في المحادثة المفتوحة حالياً
            if (this.currentConversationId == message.conversationId) {
                // منع التكرار لو أضيفت محلياً
                if (!this.messages.find(m => m.id == message.id)) {
                    this.messages.push(message);
                    this.renderMessage(message, true, !isFromMe); // Highlight if from others
                }
                
                // تحديد كمقروء مباشرة بما أن المحادثة مفتوحة
                if (!isFromMe) {
                    this.markMessagesAsRead(message.conversationId);
                }
            } else if (!isFromMe) {
                // إظهار إشعار عام إذا لم تكن المحادثة مفتوحة
                this.showGlobalMessageNotification(message);
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

        this.hubConnection.on("TaskRescheduled", (data) => {
            const task = this.tasks.find(t => t.id == data.taskId);
            if (task) {
                task.dueDate = data.newDueDate;
                task.reminderTime = data.newReminderTime;
                this.renderTasks();
                window.app?.showToast(`تم إعادة جدولة مهمة بواسطة ${data.updatedBy}`, 'info');
            }
        });

        this.hubConnection.on("TaskDeleted", (data) => {
            this.tasks = this.tasks.filter(t => t.id != data.taskId);
            this.renderTasks();
            window.app?.showToast(`تم حذف مهمة بواسطة ${data.deletedBy}`, 'warning');
        });

        this.hubConnection.on("MessageLiked", (data) => {
            const msg = this.messages.find(m => m.id == data.messageId);
            if (msg) {
                msg.likeCount = data.likeCount;
                const likeBadge = document.querySelector(`#msg-${data.messageId} .chat-msg-like-count`);
                if (likeBadge) {
                    likeBadge.textContent = data.likeCount;
                    likeBadge.classList.add('pulse');
                    setTimeout(() => likeBadge.classList.remove('pulse'), 500);
                } else {
                    // إذا لم يكن موجوداً، نعيد رسم الرسالة أو نضيف الـ badge
                    this.updateMessageLikeUI(data.messageId, data.likeCount);
                }
                
                if (data.likedBy != this.currentUser.id) {
                    // ربما إشعار صغير "فلان أعجب برسالته"
                }
            }
        });

        this.hubConnection.on("UserOnline", (userId) => {
            this.updateUserStatus(userId, true);
        });

        this.hubConnection.on("UserOffline", (userId) => {
            this.updateUserStatus(userId, false);
        });

        await this.startHub();
    }

    async startHub() {
        if (!this.hubConnection) return;
        
        try {
            await this.hubConnection.start();
            console.log("[Chat] SignalR Connected");
            window.app?.updateSignalRUI('online');
            await this.hubConnection.invoke("RegisterUser", parseInt(this.currentUser.id));
        } catch (err) {
            console.error("[Chat] SignalR Error:", err.toString());
            window.app?.updateSignalRUI('offline');
            // Retry after 5 secs
            setTimeout(() => this.startHub(), 5000);
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

    renderMessage(msg, isNew = false, highlight = false) {
        if (!this.elements.messageArea) return;
        
        // إزالة رسالة "أرسل رسالة للبدء" لو موجودة
        if (this.messages.length === 1 && isNew) {
            this.elements.messageArea.innerHTML = '';
        }
        
        const isSentByMe = msg.senderId == this.currentUser.id;
        const msgClass = isSentByMe ? 'sent' : 'received';
        const highlightClass = highlight ? 'chat-message-new' : '';
        
        const timeStr = this.formatTimeOnly(msg.sentAt);
        const tickHtml = isSentByMe ? (msg.isRead ? '<i class="fas fa-check-double chat-read-tick"></i>' : '<i class="fas fa-check chat-read-tick" style="color: #64748b;"></i>') : '';
        
        const taskBtnClass = msg.isTaskConverted ? 'task-converted' : '';
        const taskBtnTitle = msg.isTaskConverted ? 'تم التحويل لمهمة' : 'تحويل لمهمة';
        const taskIcon = msg.isTaskConverted ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-tasks"></i>';
        
        // المرفقات
        let attachmentHtml = '';
        if (msg.attachmentUrl) {
            const fileName = msg.attachmentUrl.split('/').pop();
            const lowerFileName = fileName.toLowerCase();
            let fileIcon = 'fa-file';
            let iconColor = '';
            
            if (msg.attachmentType === 'image') {
                attachmentHtml = `
                    <div class="chat-msg-attachment image">
                        <img src="${msg.attachmentUrl}" onclick="window.chatModule.previewFullImage('${msg.attachmentUrl}')" alt="صورة">
                        <a href="${msg.attachmentUrl}" download="${fileName}" class="chat-attachment-download" title="تنزيل الصورة"><i class="fas fa-download"></i></a>
                    </div>`;
            } else {
                if (msg.attachmentType === 'pdf' || lowerFileName.endsWith('.pdf')) {
                    fileIcon = 'fa-file-pdf';
                } else if (lowerFileName.endsWith('.doc') || lowerFileName.endsWith('.docx')) {
                    fileIcon = 'fa-file-word';
                    iconColor = 'color: #2b579a;';
                } else if (lowerFileName.endsWith('.xls') || lowerFileName.endsWith('.xlsx')) {
                    fileIcon = 'fa-file-excel';
                    iconColor = 'color: #217346;';
                }
                
                attachmentHtml = `
                    <div class="chat-msg-attachment file">
                        <a href="${msg.attachmentUrl}" target="_blank" style="${iconColor}"><i class="fas ${fileIcon}"></i> ${fileName}</a>
                        <a href="${msg.attachmentUrl}" download="${fileName}" class="chat-attachment-download" title="تنزيل الملف"><i class="fas fa-download"></i></a>
                    </div>`;
            }
        }

        // التفاعلات (الإعجابات)
        const likeHtml = `
            <div class="chat-msg-likes-wrapper" onclick="window.chatModule.likeMessage(${msg.id})">
                <i class="fas fa-heart ${msg.likeCount > 0 ? 'liked' : ''}"></i>
                ${msg.likeCount > 0 ? `<span class="chat-msg-like-count">${msg.likeCount}</span>` : ''}
            </div>
        `;

        // استبدال \n بـ <br> للتنسيق المكتوب (مع تعقيم)
        const escapeText = (text) => text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
        const formattedContent = escapeText(msg.content || '').replace(/\n/g, '<br>');
        
        const html = `
            <div class="chat-message-wrapper ${msgClass} ${highlightClass}" id="msg-${msg.id}">
                <div class="chat-bubble">
                    ${attachmentHtml}
                    ${formattedContent}
                    ${likeHtml}
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

    async likeMessage(msgId) {
        if (!this.currentUser) return;
        
        // إظهار القلب سريعاً (تحسين تجربة المستخدم)
        const heart = document.querySelector(`#msg-${msgId} .fa-heart`);
        if (heart) heart.classList.add('liked', 'pulse');

        try {
            await db.fetchApi('/chat/messages/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messageId: msgId,
                    userId: parseInt(this.currentUser.id)
                })
            });
        } catch (e) {
            console.error('[Chat] Like failed', e);
        }
    }

    updateMessageLikeUI(msgId, count) {
        const wrapper = document.querySelector(`#msg-${msgId} .chat-msg-likes-wrapper`);
        if (wrapper) {
            wrapper.innerHTML = `<i class="fas fa-heart liked"></i><span class="chat-msg-like-count">${count}</span>`;
        }
    }

    previewFullImage(url) {
        // إنشاء مودال للمعاينة داخل الصفحة (Lightbox)
        let modal = document.getElementById('chat-image-viewer');
        if (!modal) {
            const modalHtml = `
                <div id="chat-image-viewer" class="chat-image-viewer" onclick="this.classList.remove('show')">
                    <span class="close-viewer">&times;</span>
                    <img class="viewer-content" id="viewer-img">
                    <div id="viewer-caption"></div>
                    <a id="viewer-download" class="viewer-download" download onclick="event.stopPropagation()"><i class="fas fa-download"></i> تحميل الأصل</a>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            modal = document.getElementById('chat-image-viewer');
        }
        
        const img = document.getElementById('viewer-img');
        const caption = document.getElementById('viewer-caption');
        const download = document.getElementById('viewer-download');
        
        img.src = url;
        download.href = url;
        caption.textContent = url.split('/').pop();
        
        modal.classList.add('show');
    }

    handleFileSelection(e) {
        const file = e.target.files[0];
        if (!file) return;

        const allowedExtensions = ['jpg','jpeg','png','gif','pdf','doc','docx','xls','xlsx','txt','rar','zip'];
        const ext = file.name.split('.').pop().toLowerCase();
        
        if (!allowedExtensions.includes(ext)) {
            window.app?.showToast('نوع الملف غير مدعوم', 'error');
            this.elements.fileInput.value = '';
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            window.app?.showToast('حجم الملف كبير جداً (الأقصى 10MB)', 'error');
            this.elements.fileInput.value = '';
            return;
        }

        this.selectedFile = file;
        this.renderFilePreview();
        
        if (this.elements.sendBtn) {
            this.elements.sendBtn.removeAttribute('disabled');
        }
    }

    renderFilePreview() {
        if (!this.elements.previewArea || !this.selectedFile) return;

        this.elements.previewArea.innerHTML = '';
        this.elements.previewArea.classList.add('show');

        const isImage = this.selectedFile.type.startsWith('image/');
        
        if (isImage) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewHtml = `
                    <div class="chat-file-preview-item">
                        <img src="${e.target.result}" alt="Preview">
                        <button class="remove-preview-btn" onclick="window.chatModule.clearSelectedFile()">✕</button>
                    </div>
                `;
                this.elements.previewArea.innerHTML = previewHtml;
            };
            reader.readAsDataURL(this.selectedFile);
        } else {
            const lowerFileName = this.selectedFile.name.toLowerCase();
            let fileIcon = 'fa-file';
            let iconColor = '';
            
            if (lowerFileName.endsWith('.pdf')) {
                fileIcon = 'fa-file-pdf';
            } else if (lowerFileName.endsWith('.doc') || lowerFileName.endsWith('.docx')) {
                fileIcon = 'fa-file-word';
                iconColor = 'color: #2b579a;';
            } else if (lowerFileName.endsWith('.xls') || lowerFileName.endsWith('.xlsx')) {
                fileIcon = 'fa-file-excel';
                iconColor = 'color: #217346;';
            }

            const previewHtml = `
                <div class="chat-file-preview-item">
                    <div class="file-icon-preview" style="${iconColor}"><i class="fas ${fileIcon}"></i><span>${this.selectedFile.name}</span></div>
                    <button class="remove-preview-btn" onclick="window.chatModule.clearSelectedFile()">✕</button>
                </div>
            `;
            this.elements.previewArea.innerHTML = previewHtml;
        }
    }

    clearSelectedFile() {
        this.selectedFile = null;
        if (this.elements.fileInput) this.elements.fileInput.value = '';
        if (this.elements.previewArea) {
            this.elements.previewArea.innerHTML = '';
            this.elements.previewArea.classList.remove('show');
        }
        if (this.elements.sendBtn && this.elements.input && this.elements.input.value.trim() === '') {
            this.elements.sendBtn.setAttribute('disabled', 'true');
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
        if (content === '' && !this.selectedFile) return;
        
        const sendBtn = this.elements.sendBtn;
        const originalBtnContent = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        let attachmentUrl = null;
        let attachmentType = null;

        if (this.selectedFile) {
            try {
                const formData = new FormData();
                formData.append('file', this.selectedFile);
                
                const uploadRes = await fetch('/chat/upload', {
                    method: 'POST',
                    body: formData
                });
                
                if (uploadRes.ok) {
                    const data = await uploadRes.json();
                    attachmentUrl = data.url;
                    attachmentType = this.selectedFile.type.startsWith('image/') ? 'image' : (this.selectedFile.type === 'application/pdf' ? 'pdf' : 'file');
                } else {
                    throw new Error('فشل رفع الملف');
                }
            } catch (err) {
                console.error('[Chat] Upload error:', err);
                window.app?.showToast('فشل رفع المرفق، سيتم إرسال النص فقط', 'warning');
            }
        }

        const reqData = {
            conversationId: this.currentConversationId,
            senderId: parseInt(this.currentUser.id),
            content: content,
            attachmentUrl: attachmentUrl,
            attachmentType: attachmentType
        };
        
        this.elements.input.value = '';
        this.elements.input.style.height = 'auto';
        this.clearSelectedFile();
        
        try {
            const response = await db.fetchApi('/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqData)
            });
            
            if (response.success && response.message) {
                if (!this.messages.find(m => m.id == response.message.id)) {
                    this.messages.push(response.message);
                    this.renderMessage(response.message, true);
                    this.updateConversationLastMessage(this.currentConversationId, response.message);
                }
            }
        } catch (e) {
            console.error('[Chat] Failed to send message', e);
            window.app?.showToast('فشل في إرسال الرسالة', 'error');
            this.elements.input.value = content;
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalBtnContent;
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
                <div class="chat-task-card" id="task-item-${task.id}">
                    ${quotedText}
                    <h5 class="chat-task-title">${task.title}</h5>
                    ${task.description ? `<p style="font-size: 0.8em; color: #94a3b8; margin: 0 0 8px;">${task.description}</p>` : ''}
                    
                    <div class="chat-task-meta">
                        <span class="chat-task-badge ${priorityClass}">${pText}</span>
                        ${statusDisplayHtml}
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 10px; padding-top: 8px;">
                        <div class="chat-task-assignee">لـ: ${task.assignedToName}</div>
                        ${task.dueDate ? `<div class="chat-task-assignee" style="color: #00f0ff;"><i class="far fa-clock"></i> ${task.dueDate} ${this.formatTime12h(task.reminderTime)}</div>` : ''}
                    </div>

                    <div class="chat-task-actions" style="display: flex; gap: 8px; margin-top: 8px;">
                        <button class="chat-task-btn reschedule" onclick="window.chatModule.showRescheduleModal(${task.id}, '${task.dueDate || ''}', '${task.reminderTime || ''}')" title="إعادة جدولة">
                            <i class="fas fa-calendar-alt"></i>
                        </button>
                        <button class="chat-task-btn delete" onclick="window.chatModule.deleteTask(${task.id})" title="حذف المهمة">
                            <i class="fas fa-trash-alt"></i>
                        </button>
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
                                <div class="chat-task-form-group" style="flex: 1.5;">
                                    <label>وقت التنبيه</label>
                                    <div class="custom-time-picker">
                                        <select id="task-modal-hour" title="الساعة">
                                            ${Array.from({length: 12}, (_, i) => `<option value="${i+1}">${i+1}</option>`).join('')}
                                        </select>
                                        <span>:</span>
                                        <select id="task-modal-minute" title="الدقيقة">
                                            ${Array.from({length: 60}, (_, i) => `<option value="${i.toString().padStart(2, '0')}">${i.toString().padStart(2, '0')}</option>`).join('')}
                                        </select>
                                        <select id="task-modal-period" title="الفترة">
                                            <option value="AM">صباحاً</option>
                                            <option value="PM" selected>مساءً</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="chat-task-form-group" style="flex: 1;">
                                    <label>نغمة التنبيه</label>
                                    <select id="task-modal-alert-sound">
                                        <option value="default">افتراضي (نقي)</option>
                                        <option value="chime">جرس (Chime)</option>
                                        <option value="pulse">نبض (Pulse)</option>
                                        <option value="urgent">تنبيه عاجل</option>
                                    </select>
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
        
        // جلب الوقت من الـ picker المخصص
        const hour = document.getElementById('task-modal-hour').value;
        const minute = document.getElementById('task-modal-minute').value;
        const period = document.getElementById('task-modal-period').value;
        const reminderTime = this._convertPickerTo24h(hour, minute, period);

        const alertSound = document.getElementById('task-modal-alert-sound').value;
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
                reminderTime: reminderTime,
                alertSound: alertSound,
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

    requestNotificationPermission() {
        if (!("Notification" in window)) {
            console.warn("[Chat] Browser doesn't support notifications");
            return;
        }

        if (Notification.permission === "default") {
            Notification.requestPermission();
        }
    }

    checkTaskReminders() {
        const now = new Date();
        // الحصول على التاريخ المحلي بالتنسيق الصحيح YYYY-MM-DD
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const currentDateStr = `${year}-${month}-${day}`;
        
        // الحصول على الوقت المحلي HH:mm
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${hours}:${minutes}`;

        this.tasks.forEach(task => {
            if (task.status !== 'Done' && task.status !== 'Canceled' && 
                task.isReminderActive && 
                task.dueDate === currentDateStr && 
                task.reminderTime === currentTimeStr) {
                
                this.triggerTaskAlert(task);
            }
        });
    }

    async triggerTaskAlert(task) {
        // 1. تشغيل الصوت حسب الأولوية والنغمة
        this.playTaskAlertSound(task.alertSound, task.priority);
        
        // 2. إظهار إشعار Toast داخلي
        window.app?.showToast(`تنبيه مهمة: ${task.title}`, 'info');
        
        // 3. إنشاء إشعار منبثق مخصص (Custom Popup) داخل التطبيق يشبه الواتساب
        this.showCustomTaskPopup(task);

        // 4. إظهار إشعار متصفح (Desktop Notification) إذا كان مدعوماً
        if (Notification.permission === "granted") {
            const notification = new Notification("تنبيه مهمة!", {
                body: task.title,
                icon: '/favicon.ico'
            });
            notification.onclick = () => {
                window.focus();
                this.showTaskInUI(task);
            };
        }

        // 5. إيقاف التنبيه محلياً وفورياً
        task.isReminderActive = false; 

        // 6. إيقاف التنبيه في السيرفر لضمان عدم تكراره
        try {
            await db.fetchApi(`/chat/tasks/${task.id}/deactivate-reminder`, {
                method: 'PUT'
            });
        } catch (e) {
            console.error('[Chat] Failed to deactivate reminder', e);
        }
    }

    showCustomTaskPopup(task) {
        const container = document.body;
        
        // إزالة أي تنبيه سابق
        const existing = document.querySelector('.task-alert-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.className = 'task-alert-popup';
        
        const priorityColor = task.priority === 'High' ? '#ef4444' : (task.priority === 'Low' ? '#10b981' : '#f59e0b');

        popup.innerHTML = `
            <div class="tap-icon" style="background: ${priorityColor}">
                <i class="fas fa-thumbtack"></i>
            </div>
            <div class="tap-body">
                <div class="tap-title">تنبيه مهمة مستحقة!</div>
                <div class="tap-text">${task.title}</div>
                <div class="tap-hint">اضغط لفتح المهمة</div>
            </div>
            <div class="tap-close" onclick="event.stopPropagation(); this.closest('.task-alert-popup').remove();">
                <i class="fas fa-times"></i>
            </div>
        `;

        popup.onclick = () => {
            this.showTaskInUI(task);
            popup.remove();
        };

        container.appendChild(popup);
        
        // إخفاء تلقائي بعد 10 ثوانٍ
        setTimeout(() => {
            if (popup.parentElement) {
                popup.classList.add('hiding');
                setTimeout(() => popup.remove(), 400);
            }
        }, 10000);
    }

    showTaskInUI(task) {
        // الانتقال لصفحة الدردشة إذا لم نكن فيها
        if (window.app && window.app.currentPage !== 'chat') {
            window.app.navigateTo('chat');
        }
        
        // فتح المحادثة المرتبطة بالمهمة
        if (task.conversationId) {
            const conv = this.conversations.find(c => c.id == task.conversationId);
            if (conv) {
                this.openConversation(conv.id, conv.otherUserId, conv.otherUserName, conv.isOnline);
            } else {
                this.openConversation(task.conversationId);
            }
        }

        // فتح لوحة المهام
        if (this.elements.tasksPanel) {
            this.elements.tasksPanel.classList.add('active');
        }

        // تمييز المهمة في القائمة (بصرياً)
        setTimeout(() => {
            const taskElement = document.getElementById(`task-item-${task.id}`);
            if (taskElement) {
                taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                taskElement.classList.add('highlight-task');
                setTimeout(() => taskElement.classList.remove('highlight-task'), 3000);
            }
        }, 500);
    }

    playTaskAlertSound(soundType, priority) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // تخصيص التردد والنمط حسب الأولوية
        if (priority === 'High' || soundType === 'urgent') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        } else if (priority === 'Low' || soundType === 'chime') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        } else {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(660, audioCtx.currentTime); // E5
            gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
        }

        oscillator.start();
        
        // نمط الرنين (تنبيه متقطع للأولوية العالية)
        if (priority === 'High' || soundType === 'urgent') {
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2);
            oscillator.stop(audioCtx.currentTime + 2);
        } else {
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
            oscillator.stop(audioCtx.currentTime + 1);
        }
    }

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
     * تحويل الوقت من نظام 24 ساعة إلى 12 ساعة مع AM/PM
     */
    formatTime12h(time24) {
        if (!time24) return '';
        try {
            const [hours, minutes] = time24.split(':');
            const date = new Date();
            date.setHours(parseInt(hours), parseInt(minutes));
            return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (e) {
            return time24;
        }
    }

    _convertPickerTo24h(h12, m, period) {
        let h24 = parseInt(h12);
        if (period === 'PM' && h24 < 12) h24 += 12;
        if (period === 'AM' && h24 === 12) h24 = 0;
        return `${h24.toString().padStart(2, '0')}:${m}`;
    }

    /**
     * إظهار إشعار عام عند استقبال رسالة جديدة
     */
    showGlobalMessageNotification(message) {
        // إذا كان المستخدم في نفس المحادثة أصلاً، لا داعي للإشعار العائم
        if (this.currentConversationId == message.conversationId) return;

        // تظهر فقط إذا كانت شاشة المحادثة (الصفحة بالكامل) مغلقة كما طلب المستخدم
        if (window.app && window.app.currentPage === 'chat') {
            return;
        }

        const container = document.body;
        const colorClass = this.getUserColorClass(message.senderId);
        const avatarChar = message.senderName ? message.senderName.charAt(0) : '?';
        
        // إزالة أي إشعار سابق لتجنب التراكم
        const existing = document.querySelector('.global-chat-notification');
        if (existing) existing.remove();

        // إنشاء عنصر الإشعار بتصميم "واتساب" احترافي
        const notification = document.createElement('div');
        notification.className = `global-chat-notification whatsapp-style ${colorClass}`;
        
        // استخدام ألوان مخصصة لكل مرسل لتمييز الإشعار
        notification.style.borderLeft = `4px solid var(--user-color-${message.senderId % 7 + 1})`;

        const escapeText = (text) => text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

        notification.innerHTML = `
            <div class="gcn-avatar-wrapper">
                <div class="gcn-avatar ${colorClass}">
                    ${avatarChar}
                </div>
                <div class="gcn-whatsapp-icon">
                    <i class="fab fa-whatsapp"></i>
                </div>
            </div>
            <div class="gcn-body">
                <div class="gcn-header">
                    <span class="gcn-sender-name">${message.senderName}</span>
                    <span class="gcn-time">الآن</span>
                </div>
                <div class="gcn-message-preview">${escapeText(message.content || '')}</div>
            </div>
            <div class="gcn-actions">
                <div class="gcn-close-btn" onclick="event.stopPropagation(); const el = this.closest('.global-chat-notification'); el.classList.add('hiding'); setTimeout(() => { if (el && el.parentElement) el.remove(); }, 400);">
                    <i class="fas fa-times"></i>
                </div>
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
