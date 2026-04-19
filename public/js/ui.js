// ========================
// UI控制函数
// ========================

function updateConnectionStatus(status) {
    const el = DOM.connectionStatus;
    const base = 'text-xs px-2 py-0.5 rounded-full tabular-nums';
    const styles = {
        connected:    `${base} bg-emerald-500/20 text-emerald-400`,
        'no-key':     `${base} bg-yellow-500/20 text-yellow-400`,
        connecting:   `${base} bg-yellow-500/20 text-yellow-400`,
        disconnected: `${base} bg-red-500/20 text-red-400`,
    };
    el.className = styles[status] || styles.disconnected;
    const labels = { connected: '已连接', 'no-key': '已连接', connecting: '连接中...', disconnected: '未连接' };
    el.textContent = labels[status] || '未连接';
}

// 手动断开/重连
function handleConnectionStatusClick() {
    // 如果websocket不存在或已关闭,则尝试重新连接
    if (!websocket || websocket.readyState === WebSocket.CLOSED || websocket.readyState === WebSocket.CLOSING) {
        debugLog('用户尝试手动重连');
        reconnectAttempts = 0; // 重置重连次数
        connectWebSocket();
        showNotification('正在重新连接...', 'warning');
        return;
    }

    // 如果已连接或正在连接,则断开
    if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
        debugLog('用户手动断开连接');
        // 防止自动重连
        reconnectAttempts = maxReconnectAttempts;
        websocket.close();
        // 立即调用断开连接的UI处理
        handleDisconnectedUI();
        showNotification('已断开连接');
    }
}

function enableUI() {
    if (publicKey) {
        const canSendMessages = roomInfo.yourRole !== 'guest';
        DOM.messageInput.disabled = !canSendMessages;
        DOM.sendButton.disabled = !canSendMessages;
        DOM.messageInput.placeholder = canSendMessages ? '输入消息...' : 'Guest无法发送消息';
    }
}

function disableUI() {
    DOM.messageInput.disabled = true;
    DOM.sendButton.disabled = true;
}

// 更新UI基于角色
function updateUIBasedOnRole() {
    const isPrivate = roomInfo.roomType === 'private';
    const isCreator = roomInfo.yourRole === 'creator';
    const isAdmin = roomInfo.yourRole === 'admin';
    const hasManagePermission = isCreator || isAdmin;

    // 显示/隐藏管理区域
    const roomTypeSection = document.getElementById('roomTypeSection');
    const inviteSection = document.getElementById('inviteSection');
    const banListSection = document.getElementById('banListSection');
    const privacySection = document.getElementById('privacySection');
    const messageCountSection = document.getElementById('messageCountSection');

    const toggle = (el, show) => el && el.classList.toggle('hidden', !show);

    toggle(roomTypeSection, isCreator);
    toggle(inviteSection, isPrivate && hasManagePermission);
    toggle(banListSection, isPrivate && hasManagePermission);
    toggle(privacySection, isPrivate && isCreator);
    toggle(messageCountSection, isCreator);

    const messageCountGuestLabel = document.getElementById('messageCountGuestLabel');
    toggle(messageCountGuestLabel, isPrivate);

    // 更新转换按钮文本
    const convertBtn = document.getElementById('convertRoomTypeBtn');
    if (convertBtn) {
        if (roomInfo.roomType === 'public') {
            convertBtn.textContent = '转换为 Private Room';
            convertBtn.onclick = () => convertRoomType('private');
        } else {
            convertBtn.textContent = '转换为 Public Room';
            convertBtn.onclick = () => convertRoomType('public');
        }
    }

    // 显示/隐藏房间设置Tab
    const roomSettingsTab = document.querySelector('[data-tab="roomSettings"]');
    if (roomSettingsTab) {
        // 只有creator或admin才能看到房间设置Tab
        if (hasManagePermission || isCreator) {
            roomSettingsTab.classList.remove('hidden');
        } else {
            roomSettingsTab.classList.add('hidden');
            // 如果当前在房间设置Tab，切换回密钥管理
            const roomSettingsContent = document.getElementById('roomSettings');
            if (roomSettingsContent && !roomSettingsContent.classList.contains('hidden')) {
                const keyManagementTab = document.querySelector('[data-tab="keyManagement"]');
                const keyManagementContent = document.getElementById('keyManagement');
                if (keyManagementTab && keyManagementContent) {
                    document.querySelectorAll('.tab-btn').forEach(b => { b.removeAttribute('data-active'); b.classList.remove('active'); });
                    document.querySelectorAll('.tab-content').forEach(c => { c.classList.add('hidden'); c.classList.remove('active'); });
                    keyManagementTab.setAttribute('data-active', '');
                    keyManagementContent.classList.remove('hidden');
                }
            }
        }
    }

    // 根据权限启用/禁用消息发送
    const canSendMessages = roomInfo.yourRole !== 'guest';
    if (publicKey && websocket && websocket.readyState === WebSocket.OPEN) {
        DOM.messageInput.disabled = !canSendMessages;
        DOM.sendButton.disabled = !canSendMessages;

        if (!canSendMessages) {
            DOM.messageInput.placeholder = 'Guest无法发送消息';
        } else {
            DOM.messageInput.placeholder = '输入消息...';
        }
    }
}

function setKeyIdDisplay(id) {
    DOM.keyId.textContent = id;
    DOM.keyId.title = id;
}

function copyKeyId() {
    const id = DOM.keyId.title;
    if (!id || id === '未注册') return;
    navigator.clipboard.writeText(id).then(() => showNotification('密钥 ID 已复制'));
}

// 事件监听器设置
function setupEventListeners() {
    DOM.sendButton.addEventListener('click', sendMessage);
    DOM.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            if (!window.isMobile) e.preventDefault();
            sendMessage();
        }
    });
    DOM.connectionStatus.addEventListener('click', handleConnectionStatusClick);

    DOM.generateKeys.addEventListener('click', generateNewKeys);
    DOM.importPublicKey.addEventListener('click', () => importKey('public'));
    DOM.importPrivateKey.addEventListener('click', () => importKey('private'));
    DOM.copyPublicKey.addEventListener('click', copyPublicKey);

    document.getElementById('generateInviteLinkBtn')?.addEventListener('click', generateInviteLink);
    document.getElementById('updatePrivacyConfigBtn')?.addEventListener('click', updatePrivacyConfig);
    document.getElementById('updateMessageCountConfigBtn')?.addEventListener('click', updateMessageCountConfig);
}
