// ========================
// UI控制函数
// ========================

function updateConnectionStatus(status) {
    connectionStatusEl.className = `connection-status status-${status}`;
    switch (status) {
        case 'connected':
            connectionStatusEl.textContent = '已连接';
            break;
        case 'no-key':
            connectionStatusEl.textContent = '已连接';
            break;
        case 'connecting':
            connectionStatusEl.textContent = '连接中...';
            break;
        case 'disconnected':
            connectionStatusEl.textContent = '未连接';
            break;
    }
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
        // 检查是否有发送消息的权限（Guest没有）
        const canSendMessages = roomInfo.yourRole !== 'guest';
        messageInputEl.disabled = !canSendMessages;
        sendButtonEl.disabled = !canSendMessages;

        if (!canSendMessages) {
            messageInputEl.placeholder = 'Guest无法发送消息';
        } else {
            messageInputEl.placeholder = '输入消息...';
        }
    }
}

function disableUI() {
    messageInputEl.disabled = true;
    sendButtonEl.disabled = true;
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

    if (roomTypeSection) {
        roomTypeSection.style.display = isCreator ? 'block' : 'none';
    }

    if (inviteSection) {
        inviteSection.style.display = (isPrivate && hasManagePermission) ? 'block' : 'none';
    }

    if (banListSection) {
        banListSection.style.display = (isPrivate && hasManagePermission) ? 'block' : 'none';
    }

    if (privacySection) {
        privacySection.style.display = (isPrivate && isCreator) ? 'block' : 'none';
    }

    if (messageCountSection) {
        messageCountSection.style.display = isCreator ? 'block' : 'none';
    }

    // 在public room下隐藏Guest相关选项
    const messageCountGuestLabel = document.getElementById('messageCountGuestLabel');
    if (messageCountGuestLabel) {
        messageCountGuestLabel.style.display = isPrivate ? 'flex' : 'none';
    }

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
            roomSettingsTab.style.display = 'flex';
        } else {
            roomSettingsTab.style.display = 'none';
            // 如果当前在房间设置Tab，切换回密钥管理
            const roomSettingsContent = document.getElementById('roomSettings');
            if (roomSettingsContent && roomSettingsContent.classList.contains('active')) {
                // 切换到密钥管理Tab
                const keyManagementTab = document.querySelector('[data-tab="keyManagement"]');
                const keyManagementContent = document.getElementById('keyManagement');
                if (keyManagementTab && keyManagementContent) {
                    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                    keyManagementTab.classList.add('active');
                    keyManagementContent.classList.add('active');
                }
            }
        }
    }

    // 根据权限启用/禁用消息发送
    const canSendMessages = roomInfo.yourRole !== 'guest';
    if (publicKey && websocket && websocket.readyState === WebSocket.OPEN) {
        messageInputEl.disabled = !canSendMessages;
        sendButtonEl.disabled = !canSendMessages;

        if (!canSendMessages) {
            messageInputEl.placeholder = 'Guest无法发送消息';
        } else {
            messageInputEl.placeholder = '输入消息...';
        }
    }
}

// 事件监听器设置
function setupEventListeners() {
    sendButtonEl.addEventListener('click', sendMessage);
    messageInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            if (!window.isMobile) e.preventDefault();
            sendMessage();
        }
    });
    connectionStatusEl.addEventListener('click', handleConnectionStatusClick);

    generateKeysBtn.addEventListener('click', generateNewKeys);
    importPublicKeyBtn.addEventListener('click', () => importKey('public'));
    importPrivateKeyBtn.addEventListener('click', () => importKey('private'));
    copyPublicKeyBtn.addEventListener('click', copyPublicKey);
}
