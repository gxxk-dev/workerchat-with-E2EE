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

        displayMessage({
            senderId: data.senderId,
            text: decrypted,
            timestamp: data.timestamp,
            isSelf: data.senderId === userId,
            messageNumber: data.messageNumber
        });

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
function displayMessage({ senderId, text, timestamp, isSelf, messageNumber }) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${isSelf ? 'sent' : 'received'}`;

    const senderInfo = users.get(senderId) || {
        name: senderId.slice(-16),
        email: ''
    };

    const timeString = new Date(timestamp).toLocaleTimeString();

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

    // 创建消息编号部分（如果存在且用户有权限）
    if (messageNumber && canSeeMessageNumber()) {
        const messageNumberEl = document.createElement('span');
        messageNumberEl.className = 'message-number';
        messageNumberEl.textContent = `#${messageNumber}`;
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

    messagesEl.appendChild(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
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
