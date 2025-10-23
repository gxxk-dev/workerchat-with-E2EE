// ========================
// 消息处理函数
// ========================

// 处理加密消息
async function handleEncryptedMessage(data) {
    debugLog(`收到来自 ${data.senderId} 的加密消息`);

    // 尝试解密消息
    if (!privateKey) {
        displayEncryptedMessage(data, '需要私钥才能解密此消息');
        return;
    }

    try {
        const encryptedMessage = await openpgp.readMessage({
            armoredMessage: data.encryptedData
        });

        const privKey = await openpgp.readPrivateKey({
            armoredKey: privateKey
        });

        const { data: decrypted } = await openpgp.decrypt({
            message: encryptedMessage,
            decryptionKeys: privKey,
            format: 'text'
        });

        // 缓存解密后的消息
        const cacheKey = `${data.timestamp}_${data.senderId}`;
        messageCache.set(cacheKey, {
            senderId: data.senderId,
            text: decrypted,
            timestamp: data.timestamp,
            messageNumber: data.messageNumber
        });

        // 限制缓存大小
        if (messageCache.size > MAX_CACHE_SIZE) {
            const firstKey = messageCache.keys().next().value;
            messageCache.delete(firstKey);
        }

        displayMessage({
            senderId: data.senderId,
            text: decrypted,
            timestamp: data.timestamp,
            isSelf: data.senderId === userId,
            messageNumber: data.messageNumber,
            replyTo: data.replyTo,
            syncedFrom: data.syncedFrom
        });

        // 如果是接收到的同步消息（不是自己同步的），处理同步通知
        if (data.syncedFrom && data.syncedFrom.syncedBy !== userId) {
            handleSyncNotification(data.syncedFrom.syncedBy);
        }

        debugLog('消息解密成功');

    } catch (error) {
        debugLog('解密失败: ' + error.message);
        displayEncryptedMessage({
            senderId: data.senderId,
            text: data.encryptedData,
            timestamp: data.timestamp,
            isSelf: data.senderId === userId
        }, '解密失败: ' + error.message);
    }
}

// 显示加密消息（无法解密时）
function displayEncryptedMessage(message, reason) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.isSelf ? 'sent' : 'received'} encrypted`;

    const timeString = new Date(message.timestamp).toLocaleTimeString();
    const senderInfo = users.get(message.senderId) || {
        name: message.senderId.slice(-16),
        email: ''
    };

    // 创建发送者信息部分
    const senderInfoEl = document.createElement('div');
    senderInfoEl.className = 'sender-info';

    const senderNameEl = document.createElement('span');
    senderNameEl.className = 'sender-name';
    senderNameEl.textContent = senderInfo.name;

    const senderIdEl = document.createElement('span');
    senderIdEl.className = 'sender-id';
    senderIdEl.textContent = `[${message.senderId.slice(-16)}]`;

    const messageTimeEl = document.createElement('span');
    messageTimeEl.className = 'message-time';
    messageTimeEl.textContent = timeString;

    senderInfoEl.appendChild(senderNameEl);
    senderInfoEl.appendChild(senderIdEl);
    senderInfoEl.appendChild(messageTimeEl);

    // 创建消息文本部分
    const messageTextEl = document.createElement('div');
    messageTextEl.className = 'message-text';

    const encryptedNoticeEl = document.createElement('div');
    encryptedNoticeEl.style.fontStyle = 'italic';
    encryptedNoticeEl.style.color = '#ff6b6b';
    encryptedNoticeEl.textContent = `🔒 ${reason}`;

    const detailsEl = document.createElement('details');
    detailsEl.style.marginTop = '8px';

    const summaryEl = document.createElement('summary');
    summaryEl.style.cursor = 'pointer';
    summaryEl.style.fontSize = '0.8em';
    summaryEl.textContent = '查看加密数据';

    const preEl = document.createElement('pre');
    preEl.style.marginTop = '5px';
    preEl.style.fontSize = '0.7em';
    preEl.style.whiteSpace = 'pre-wrap';
    preEl.style.wordBreak = 'break-all';
    preEl.textContent = message.text; // 使用 textContent 防止 XSS

    detailsEl.appendChild(summaryEl);
    detailsEl.appendChild(preEl);

    messageTextEl.appendChild(encryptedNoticeEl);
    messageTextEl.appendChild(detailsEl);

    messageEl.appendChild(senderInfoEl);
    messageEl.appendChild(messageTextEl);

    messagesEl.appendChild(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

// 显示消息
function displayMessage({ senderId, text, timestamp, isSelf, messageNumber, replyTo, syncedFrom }) {
    // 如果是同步消息，使用原始时间戳作为显示时间戳
    const displayTimestamp = syncedFrom ? syncedFrom.originalTimestamp : timestamp;

    // 检查消息是否已存在（去重）
    const existingMessages = messagesEl.querySelectorAll('.message');
    for (const existingMsg of existingMessages) {
        const existingTimestamp = existingMsg.getAttribute('data-timestamp');
        const existingSenderId = existingMsg.getAttribute('data-sender-id');

        // 如果找到相同时间戳和发送者的消息，说明已存在，直接返回
        if (existingTimestamp === String(displayTimestamp) && existingSenderId === senderId) {
            debugLog(`消息已存在，跳过显示: timestamp=${displayTimestamp}, sender=${senderId}`);
            return;
        }
    }

    const messageEl = document.createElement('div');
    messageEl.className = `message ${isSelf ? 'sent' : 'received'}`;

    messageEl.setAttribute('data-timestamp', displayTimestamp);
    messageEl.setAttribute('data-sender-id', senderId);

    // 判断是否是接收到的同步消息（不是自己同步的）
    const isReceivedSyncMessage = syncedFrom && syncedFrom.syncedBy !== userId;

    // 如果是接收到的同步消息，添加特殊样式标记
    if (isReceivedSyncMessage) {
        messageEl.classList.add('synced-message');
    }

    const senderInfo = users.get(senderId) || {
        name: senderId.slice(-16),
        email: ''
    };

    // 使用显示时间戳来格式化时间
    const timeString = new Date(displayTimestamp).toLocaleTimeString();

    // 如果有回复信息，显示回复引用
    if (replyTo) {
        const replyReference = document.createElement('div');
        replyReference.className = 'reply-reference';

        // 从缓存中获取被回复的消息
        const repliedCacheKey = `${replyTo.timestamp}_${replyTo.senderId}`;
        const repliedMessage = messageCache.get(repliedCacheKey);

        const repliedUser = users.get(replyTo.senderId) || {
            name: replyTo.senderId.slice(-16)
        };

        let replyText = '原消息已不可用';
        if (repliedMessage) {
            // 截取前50个字符作为预览
            replyText = repliedMessage.text.length > 50
                ? repliedMessage.text.substring(0, 50) + '...'
                : repliedMessage.text;
        }

        replyReference.innerHTML = `
            <div class="reply-icon">↩</div>
            <div class="reply-content">
                <div class="reply-sender">${repliedUser.name}</div>
                <div class="reply-text">${replyText}</div>
            </div>
        `;

        messageEl.appendChild(replyReference);
    }

    // 创建发送者信息部分
    const senderInfoEl = document.createElement('div');
    senderInfoEl.className = 'sender-info';

    // 创建发送者名称部分
    const senderNameEl = document.createElement('span');
    senderNameEl.className = 'sender-name';
    senderNameEl.textContent = senderInfo.name;

    // 创建发送者ID部分
    const senderIdEl = document.createElement('span');
    senderIdEl.className = 'sender-id';
    senderIdEl.textContent = ` [${senderId.slice(-16)}]`;

    // 将名称和ID添加到发送者名称元素中
    senderNameEl.appendChild(senderIdEl);

    // 创建时间部分
    const messageTimeEl = document.createElement('span');
    messageTimeEl.className = 'message-time';
    messageTimeEl.textContent = timeString;

    // 如果是接收到的同步消息（不是自己转发的），添加SYNC标识
    if (isReceivedSyncMessage) {
        const syncBadge = document.createElement('span');
        syncBadge.className = 'sync-badge';
        syncBadge.textContent = 'SYNC';
        syncBadge.style.marginLeft = '5px';
        syncBadge.style.padding = '2px 6px';
        syncBadge.style.backgroundColor = '#3b82f6';
        syncBadge.style.color = 'white';
        syncBadge.style.borderRadius = '3px';
        syncBadge.style.fontSize = '0.7em';
        syncBadge.style.fontWeight = 'bold';
        messageTimeEl.appendChild(syncBadge);
    }

    // 创建消息编号部分（如果存在且用户有权限）
    // 对于同步消息，优先使用原始消息编号
    const displayMessageNumber = syncedFrom?.originalMessageNumber || messageNumber;
    if (displayMessageNumber && canSeeMessageNumber()) {
        const messageNumberEl = document.createElement('span');
        messageNumberEl.className = 'message-number';
        messageNumberEl.textContent = `#${displayMessageNumber}`;
        messageTimeEl.appendChild(messageNumberEl);
    }

    // 将名称和时间添加到发送者信息元素中
    senderInfoEl.appendChild(senderNameEl);
    senderInfoEl.appendChild(messageTimeEl);

    // 创建消息文本部分
    const messageTextEl = document.createElement('div');
    messageTextEl.className = 'message-text';

    // 使用 Markdown 解析和 DOMPurify 清理
    try {
        const rawHtml = marked.parse(text);
        const cleanHtml = DOMPurify.sanitize(rawHtml);
        messageTextEl.innerHTML = cleanHtml;
    } catch (error) {
        // 如果 Markdown 解析失败,降级到纯文本
        console.error('Markdown 解析失败:', error);
        messageTextEl.textContent = text;
    }

    // 将所有部分添加到消息元素中
    messageEl.appendChild(senderInfoEl);
    messageEl.appendChild(messageTextEl);

    // 添加回复按钮（只对非Guest用户显示）
    if (roomInfo.yourRole !== 'guest') {
        const replyButton = document.createElement('button');
        replyButton.className = 'reply-btn';
        replyButton.innerHTML = '↩';
        replyButton.title = '回复此消息';
        replyButton.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到消息元素
            setReplyTo({
                senderId,
                timestamp,
                messageNumber,
                text
            });
        });
        messageEl.appendChild(replyButton);

        // 添加同步按钮
        const syncButton = document.createElement('button');
        syncButton.className = 'sync-btn';
        syncButton.innerHTML = '➦';
        syncButton.title = '同步此消息';
        syncButton.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到消息元素
            showSyncDialog({
                senderId,
                timestamp,
                messageNumber,
                text
            });
        });
        messageEl.appendChild(syncButton);
    }

    // 按时间戳插入消息到正确位置
    if (isReceivedSyncMessage) {
        // 接收到的同步消息：按原始时间戳插入到正确位置
        let inserted = false;
        const existingMessages = messagesEl.querySelectorAll('.message');

        for (const existingMsg of existingMessages) {
            const existingTimestamp = parseInt(existingMsg.getAttribute('data-timestamp'));
            if (displayTimestamp < existingTimestamp) {
                messagesEl.insertBefore(messageEl, existingMsg);
                inserted = true;
                break;
            }
        }

        // 如果没有插入（时间戳最新），追加到末尾
        if (!inserted) {
            messagesEl.appendChild(messageEl);
        }

        // 同步消息不自动滚动到底部，保持当前滚动位置
    } else {
        // 普通消息或自己同步的消息：直接追加到末尾
        messagesEl.appendChild(messageEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // 移动端点击消息显示操作按钮
    if (window.isMobile && roomInfo.yourRole !== 'guest') {
        messageEl.addEventListener('click', function(e) {
            // 如果点击的是按钮本身，不处理
            if (e.target.closest('.reply-btn') || e.target.closest('.sync-btn')) {
                return;
            }

            // 移除其他消息的激活状态
            const allMessages = messagesEl.querySelectorAll('.message');
            allMessages.forEach(msg => {
                if (msg !== messageEl) {
                    msg.classList.remove('message-active');
                }
            });

            // 切换当前消息的激活状态
            messageEl.classList.toggle('message-active');
        });
    }
}

// 处理系统消息
function handleSystemMessage(data) {
    debugLog(`收到系统消息: ${data.messageType}`);

    // 创建系统消息元素
    const systemMessageEl = document.createElement('div');
    systemMessageEl.className = `system-message ${data.messageType.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    systemMessageEl.textContent = data.content;

    messagesEl.appendChild(systemMessageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ========================
// 回复功能相关函数
// ========================

// 设置回复状态
function setReplyTo(messageInfo) {
    replyingTo = messageInfo;
    updateReplyPreview();
    messageInputEl.focus();
}

// 取消回复
function cancelReply() {
    replyingTo = null;
    updateReplyPreview();
}

// 更新回复预览UI
function updateReplyPreview() {
    let replyPreviewEl = document.querySelector('.reply-preview');

    if (!replyingTo) {
        // 如果没有回复状态，移除预览
        if (replyPreviewEl) {
            replyPreviewEl.remove();
        }
        return;
    }

    // 如果没有预览元素，创建一个
    if (!replyPreviewEl) {
        replyPreviewEl = document.createElement('div');
        replyPreviewEl.className = 'reply-preview';

        const inputArea = document.querySelector('.input-area');
        inputArea.insertBefore(replyPreviewEl, inputArea.firstChild);
    }

    const repliedUser = users.get(replyingTo.senderId) || {
        name: replyingTo.senderId.slice(-16)
    };

    const previewText = replyingTo.text.length > 50
        ? replyingTo.text.substring(0, 50) + '...'
        : replyingTo.text;

    replyPreviewEl.innerHTML = `
        <div class="reply-preview-content">
            <div class="reply-preview-icon">↩</div>
            <div class="reply-preview-info">
                <div class="reply-preview-sender">${repliedUser.name}</div>
                <div class="reply-preview-text">${previewText}</div>
            </div>
        </div>
        <button class="reply-preview-close" onclick="cancelReply()">✕</button>
    `;
}

// ========================
// 同步功能相关函数
// ========================

// 显示同步对话框
function showSyncDialog(messageInfo) {
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'sync-overlay';

    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'sync-dialog';

    // 对话框标题
    const title = document.createElement('h3');
    title.textContent = '选择同步目标';
    title.style.marginBottom = '15px';

    // 用户列表容器
    const userListContainer = document.createElement('div');
    userListContainer.className = 'sync-user-list';

    // 遍历所有用户，排除自己
    const otherUsers = Array.from(users.values()).filter(u => u.id !== userId);

    if (otherUsers.length === 0) {
        userListContainer.innerHTML = '<p style="text-align:center;color:#999;">没有其他用户</p>';
    } else {
        otherUsers.forEach(user => {
            const userItem = document.createElement('label');
            userItem.className = 'sync-user-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = user.id;
            checkbox.id = `sync-user-${user.id}`;

            const userName = document.createElement('span');
            userName.textContent = user.name;
            userName.className = 'sync-user-name';

            const userIdView = document.createElement('span');
            userIdView.textContent = ` [${user.id.slice(-8)}]`;
            userIdView.className = 'sync-user-id';
            userIdView.style.fontSize = '0.8em';
            userIdView.style.color = '#999';

            userItem.appendChild(checkbox);
            userItem.appendChild(userName);
            userItem.appendChild(userIdView);

            userListContainer.appendChild(userItem);
        });
    }

    // 按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'sync-dialog-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.className = 'sync-cancel-btn';
    cancelBtn.onclick = () => {
        document.body.removeChild(overlay);
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '同步';
    confirmBtn.className = 'sync-confirm-btn';
    confirmBtn.onclick = async () => {
        const selectedUserIds = Array.from(
            dialog.querySelectorAll('input[type="checkbox"]:checked')
        ).map(cb => cb.value);

        if (selectedUserIds.length === 0) {
            showNotification('请至少选择一个用户', 'warning');
            return;
        }

        // 关闭对话框
        document.body.removeChild(overlay);

        // 执行同步
        await syncMessage(messageInfo, selectedUserIds);
    };

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(confirmBtn);

    // 组装对话框
    dialog.appendChild(title);
    dialog.appendChild(userListContainer);
    dialog.appendChild(buttonContainer);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 点击遮罩层关闭
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    };
}

// 处理同步消息通知
function handleSyncNotification(syncedByUserId) {
    // 获取或初始化该用户的同步消息跟踪
    let syncInfo = syncNotificationTimers.get(syncedByUserId);

    if (syncInfo) {
        // 已有定时器，清除旧定时器并增加计数
        clearTimeout(syncInfo.timer);
        syncInfo.count++;
    } else {
        // 新用户的同步消息
        syncInfo = { count: 1, timer: null };
        syncNotificationTimers.set(syncedByUserId, syncInfo);
    }

    // 创建新定时器，在延迟后显示通知
    syncInfo.timer = setTimeout(() => {
        const syncedByUser = users.get(syncedByUserId) || {
            name: syncedByUserId.slice(-16)
        };

        const message = `${syncedByUser.name} 为您同步了 ${syncInfo.count} 条消息`;
        showNotification(message, 'info');

        // 清理定时器记录
        syncNotificationTimers.delete(syncedByUserId);
    }, SYNC_NOTIFICATION_DELAY);
}

// 同步消息
async function syncMessage(messageInfo, targetUserIds) {
    debugLog(`开始同步消息给 ${targetUserIds.length} 个用户`);

    try {
        // 获取目标用户的公钥
        const targetUsers = targetUserIds.map(id => users.get(id)).filter(u => u);
        const publicKeys = [];

        for (const user of targetUsers) {
            try {
                const pubKey = await openpgp.readKey({ armoredKey: user.publicKey });
                publicKeys.push(pubKey);
            } catch (error) {
                debugLog(`无法读取用户 ${user.name} 的公钥: ${error.message}`);
            }
        }

        // 同时添加自己的公钥,这样自己也能解密同步的消息
        try {
            const myPubKey = await openpgp.readKey({ armoredKey: publicKey });
            publicKeys.push(myPubKey);
            debugLog('已添加自己的公钥用于解密');
        } catch (error) {
            debugLog(`无法读取自己的公钥: ${error.message}`);
        }

        if (publicKeys.length === 0) {
            showNotification('没有找到有效的公钥', 'warning');
            return;
        }

        // 为目标用户和自己加密消息
        const encrypted = await openpgp.encrypt({
            message: await openpgp.createMessage({ text: messageInfo.text }),
            encryptionKeys: publicKeys,
            format: 'armored'
        });

        debugLog(`消息加密成功，为 ${publicKeys.length} 个用户加密（包括自己）`);

        // 构建同步消息对象
        const syncData = {
            type: 'message',
            encryptedData: encrypted,
            syncedFrom: {
                originalSenderId: messageInfo.senderId,
                originalTimestamp: messageInfo.timestamp,
                originalMessageNumber: messageInfo.messageNumber, // 保留原始消息编号
                syncedBy: userId
            },
            targetUserIds: targetUserIds
        };

        // 发送同步消息
        websocket.send(JSON.stringify(syncData));

        showNotification(`消息已同步给 ${targetUserIds.length} 个用户`);

    } catch (error) {
        debugLog('同步失败: ' + error.message);
        showNotification('同步失败: ' + error.message, 'error');
    }
}
