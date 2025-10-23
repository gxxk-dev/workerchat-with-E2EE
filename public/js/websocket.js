// ========================
// WebSocket相关函数
// ========================

function getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // 对房间ID进行URL编码以支持Unicode字符
    const encodedRoomId = encodeURIComponent(roomId);
    return `${protocol}//${host}/api/room/${encodedRoomId}/websocket`;
}

async function connectWebSocket() {
    try {
        const wsUrl = getWebSocketUrl();
        debugLog(`尝试连接WebSocket: ${wsUrl}`);
        updateConnectionStatus("connecting");

        websocket = new WebSocket(wsUrl);
        setupWebSocketHandlers();

    } catch (error) {
        debugLog("WebSocket连接失败: " + error.message);
        updateConnectionStatus("disconnected");
        showNotification("连接失败: " + error.message, "error");

        // 尝试重新获取房间ID并重连
        try {
            roomId = await fetchRoomId();
            debugLog(`重新获取房间ID: ${roomId}`);
            setTimeout(() => connectWebSocket(), 2000);
        } catch (retryError) {
            debugLog("重新获取房间ID失败: " + retryError.message);
        }
    }
}

function setupWebSocketHandlers() {
    if (!websocket) return;

    websocket.onopen = () => {
        handleConnectedUI();
    };

    websocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            // 处理服务端的ping请求,立即回复pong
            if (data.type === 'ping') {
                debugLog('收到服务端ping,回复pong');
                websocket.send(JSON.stringify({ type: 'pong' }));
                return;
            }

            // 处理pong响应,重置心跳超时
            if (data.type === 'pong') {
                resetHeartbeatTimeout();
                return;
            }

            handleWebSocketMessage(data);
        } catch (error) {
            debugLog('解析消息失败: ' + error.message);
        }
    };

    websocket.onclose = () => {
        debugLog('WebSocket连接已关闭');

        // 处理断连时的界面调整
        handleDisconnectedUI();

        // 自动重连
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setTimeout(() => {
                debugLog(`尝试重连 (${reconnectAttempts}/${maxReconnectAttempts})`);
                connectWebSocket();
            }, 2000 * reconnectAttempts);
        }
    };

    websocket.onerror = (error) => {
        debugLog("WebSocket错误: " + error);
        showNotification('连接错误', 'error');
    };
}

function registerUser() {
    if (websocket && websocket.readyState === WebSocket.OPEN && publicKey) {
        debugLog('发送用户注册请求' + (inviteId ? ' (携带邀请码)' : ''));
        const registerMsg = {
            type: 'register',
            publicKey: publicKey
        };
        if (inviteId) {
            registerMsg.inviteId = inviteId;
        }
        websocket.send(JSON.stringify(registerMsg));
    }
}

async function handleWebSocketMessage(data) {
    debugLog('收到消息: ' + data.type);

    switch (data.type) {
        case 'authChallenge':
            await handleAuthChallenge(data);
            break;

        case 'registered':
        case 'authenticated':
            // 始终使用服务器返回的ID作为userId(用于消息识别)
            userId = data.profile.id;
            // 始终更新用户名和邮箱（可能在服务器端被更新）
            userName = data.profile.name;
            userEmail = data.profile.email;

            // 显示密钥指纹(如果已初始化)或服务器ID
            if (userFingerprint) {
                keyIdEl.textContent = userFingerprint;
            } else {
                keyIdEl.textContent = userId;
            }

            if (data.assignedRole) {
                roomInfo.yourRole = data.assignedRole;
                showNotification(`身份验证成功，角色: ${getRoleLabel(data.assignedRole)}`);
            } else {
                showNotification('身份验证成功');
            }
            enableUI();

            // 请求用户列表
            websocket.send(JSON.stringify({ type: 'getUsers' }));
            break;

        case 'roomInfo':
            handleRoomInfo(data);
            break;

        case 'encryptedMessage':
            handleEncryptedMessage(data);
            break;

        case 'systemMessage':
            handleSystemMessage(data);
            break;

        case 'userList':
            updateUserList(data.users);
            break;

        case 'roomTypeConverted':
            handleRoomTypeConverted(data);
            break;

        case 'userKicked':
            handleUserKicked(data);
            break;

        case 'userBanned':
            handleUserBanned(data);
            break;

        case 'roleChanged':
            handleRoleChanged(data);
            break;

        case 'inviteLinkGenerated':
            handleInviteLinkGenerated(data);
            break;

        case 'banList':
            handleBanList(data);
            break;

        case 'inviteLinks':
            handleInviteLinks(data);
            break;

        case 'privacyConfigUpdated':
            handlePrivacyConfigUpdated(data);
            break;

        case 'messageCountConfigUpdated':
            handleMessageCountConfigUpdated(data);
            break;

        case 'creatorTransferred':
            handleCreatorTransferred(data);
            break;

        case 'permissionDenied':
            handlePermissionDenied(data);
            break;

        case 'error':
            showNotification(data.message, 'error');
            debugLog('服务器错误: ' + data.message);
            break;

        default:
            debugLog('未知消息类型: ' + data.type);
    }
}

// 处理连接成功时的界面调整
function handleConnectedUI() {
    debugLog('WebSocket连接已建立');

    // 检查是否有公钥来确定连接状态
    if (publicKey) {
        updateConnectionStatus('connected');
        registerUser();
    } else {
        updateConnectionStatus('no-key');
    }

    reconnectAttempts = 0;

    // 清空用户列表并显示加载提示
    userListEl.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">正在加载用户列表...</div>';

    // 启用UI
    enableUI();

    // 启动心跳机制
    startHeartbeat();
}

// 处理断连时的界面调整
function handleDisconnectedUI() {
    // 更新连接状态显示
    updateConnectionStatus('disconnected');

    // 禁用输入控件
    disableUI();

    // 停止心跳机制
    stopHeartbeat();

    // 更新用户列表显示为断开连接状态
    userListEl.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">等待连接...</div>';

    // 在聊天窗口显示断开连接提示
    handleSystemMessage({
        type: 'systemMessage',
        content: '您已断开连接',
        timestamp: Date.now(),
        messageType: 'userDisconnected'
    });
}

// 发送消息
async function sendMessage() {
    const messageText = messageInputEl.value.trim();
    if (!messageText) return;

    if (!publicKey) {
        showNotification('请先导入或生成公钥', 'warning');
        return;
    }

    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        showNotification('WebSocket未连接', 'error');
        return;
    }

    // 检查是否有发送消息权限
    if (roomInfo.yourRole === 'guest') {
        showNotification('Guest无法发送消息', 'warning');
        return;
    }

    try {
        debugLog('开始加密消息...');

        // 获取所有用户的公钥进行加密
        const allUsers = Array.from(users.values());
        const publicKeys = [];

        for (const user of allUsers) {
            try {
                const pubKey = await openpgp.readKey({ armoredKey: user.publicKey });
                publicKeys.push(pubKey);
            } catch (error) {
                debugLog(`无法读取用户 ${user.name} 的公钥: ${error.message}`);
            }
        }

        if (publicKeys.length === 0) {
            showNotification('没有找到有效的公钥', 'warning');
            return;
        }

        // 为所有用户加密消息
        const encrypted = await openpgp.encrypt({
            message: await openpgp.createMessage({ text: messageText }),
            encryptionKeys: publicKeys,
            format: 'armored'
        });

        debugLog(`消息加密成功，为 ${publicKeys.length} 个用户加密`);

        // 构建消息对象
        const messageData = {
            type: 'message',
            encryptedData: encrypted
        };

        // 如果有回复信息，添加到消息中
        if (replyingTo) {
            messageData.replyTo = {
                senderId: replyingTo.senderId,
                timestamp: replyingTo.timestamp,
                messageNumber: replyingTo.messageNumber
            };
            debugLog(`发送回复消息，回复给: ${replyingTo.senderId}`);
        }

        // 发送加密消息
        websocket.send(JSON.stringify(messageData));

        // 清空输入框
        messageInputEl.value = '';

        // 清除回复状态
        if (replyingTo) {
            cancelReply();
        }

    } catch (error) {
        debugLog('加密失败: ' + error.message);
        showNotification('加密失败: ' + error.message, 'error');
    }
}

// 处理服务器质询
async function handleAuthChallenge(data) {
    debugLog('收到服务器质询');

    if (!privateKey) {
        showNotification('未找到私钥，无法验证身份', 'error');
        return;
    }

    try {
        // 使用私钥解密质询
        const encryptedMessage = await openpgp.readMessage({
            armoredMessage: data.encryptedChallenge
        });

        const privKey = await openpgp.readPrivateKey({ armoredKey: privateKey });

        const { data: decrypted } = await openpgp.decrypt({
            message: encryptedMessage,
            decryptionKeys: privKey
        });

        debugLog('质询解密成功');

        // 发送质询响应
        websocket.send(JSON.stringify({
            type: 'challengeResponse',
            response: decrypted
        }));

    } catch (error) {
        debugLog('质询验证失败: ' + error.message);
        showNotification('密钥验证失败，请确保使用正确的密钥对', 'error');
        websocket.close();
    }
}
