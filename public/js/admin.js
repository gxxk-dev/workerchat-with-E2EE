// ========================
// 群管理功能 - 消息处理函数
// ========================

// 处理房间信息
function handleRoomInfo(data) {
    roomInfo = {
        roomType: data.roomType,
        isCreator: data.isCreator,
        yourRole: data.yourRole,
        privacy: data.privacy,
        messageCountVisibleToUser: data.messageCountVisibleToUser,
        messageCountVisibleToGuest: data.messageCountVisibleToGuest
    };
    debugLog(`房间信息: ${getRoomTypeLabel(data.roomType)}, 角色: ${getRoleLabel(data.yourRole)}`);

    // 处理消息计数
    if (data.messageCount !== undefined) {
        const storageKey = `lastSeenMessageCount_${roomId}`;
        const lastSeen = localStorage.getItem(storageKey);
        const hasConnectedBefore = localStorage.getItem(`hasConnectedBefore_${roomId}`) === 'true';

        if (!hasConnectedBefore) {
            // 标记用户已经连接过此房间
            localStorage.setItem(`hasConnectedBefore_${roomId}`, 'true');

            // 首次连接，显示加入前的消息数
            if (data.messageCount > 0) {
                showNotification(`加入前已有 ${data.messageCount} 条消息记录`, 'warning');
            }
        } else if (lastSeen !== null) {
            // 重连，计算缺失的消息数
            const lastSeenCount = parseInt(lastSeen, 10);
            const missedCount = data.messageCount - lastSeenCount;

            // 只有在真正缺失消息时才提示
            if (missedCount > 0) {
                showNotification(`断联期间缺失了 ${missedCount} 条消息记录`, 'warning');
            }
        }

        // 更新localStorage
        localStorage.setItem(storageKey, data.messageCount.toString());
    }

    // 同步消息计数配置到UI (如果服务器返回了这些配置)
    if (data.enableMessageCount !== undefined) {
        const enableMessageCount = document.getElementById('enableMessageCount');
        if (enableMessageCount) {
            enableMessageCount.checked = data.enableMessageCount;
        }
    }
    if (data.messageCountVisibleToUser !== undefined) {
        const messageCountVisibleToUser = document.getElementById('messageCountVisibleToUser');
        if (messageCountVisibleToUser) {
            messageCountVisibleToUser.checked = data.messageCountVisibleToUser;
        }
    }
    if (data.messageCountVisibleToGuest !== undefined) {
        const messageCountVisibleToGuest = document.getElementById('messageCountVisibleToGuest');
        if (messageCountVisibleToGuest) {
            messageCountVisibleToGuest.checked = data.messageCountVisibleToGuest;
        }
    }

    // 更新UI显示
    updateUIBasedOnRole();

    // 如果是Private房间且是Admin/Creator，加载管理数据
    if (data.roomType === 'private' && (data.yourRole === 'admin' || data.yourRole === 'creator')) {
        getBanList();
        getInviteLinks();
    }
}

// 处理房间类型转换
function handleRoomTypeConverted(data) {
    const actorName = getUserName(data.convertedBy);
    showNotification(`${actorName} 将房间转换为 ${getRoomTypeLabel(data.newType)}`);

    // 请求更新房间信息
    websocket.send(JSON.stringify({ type: 'getUsers' }));
}

// 处理用户被踢出
function handleUserKicked(data) {
    const targetName = getUserName(data.targetUserId);
    const actorName = getUserName(data.kickedBy);
    const reason = data.reason ? ` (原因: ${data.reason})` : '';

    showNotification(`${targetName} 被 ${actorName} 踢出房间${reason}`, 'warning');

    // 如果被踢的是自己
    if (data.targetUserId === userId) {
        alert(`你已被踢出房间${reason}`);
        // 可选：重定向到首页
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }

    // 刷新用户列表
    websocket.send(JSON.stringify({ type: 'getUsers' }));
}

// 处理用户被封禁
function handleUserBanned(data) {
    const targetName = getUserName(data.targetUserId);
    const actorName = getUserName(data.bannedBy);
    const reason = data.reason ? ` (原因: ${data.reason})` : '';

    showNotification(`${targetName} 被 ${actorName} 封禁${reason}`, 'warning');

    // 刷新用户列表和封禁列表
    websocket.send(JSON.stringify({ type: 'getUsers' }));
    getBanList();
}

// 处理角色变更
function handleRoleChanged(data) {
    const targetName = getUserName(data.targetUserId);
    const actorName = getUserName(data.changedBy);

    showNotification(`${actorName} 将 ${targetName} 的角色从 ${getRoleLabel(data.oldRole)} 变更为 ${getRoleLabel(data.newRole)}`);

    // 如果变更的是自己，更新本地角色信息
    if (data.targetUserId === userId) {
        roomInfo.yourRole = data.newRole;
        updateUIBasedOnRole();
    }

    // 刷新用户列表
    websocket.send(JSON.stringify({ type: 'getUsers' }));
}

// 处理邀请链接生成
function handleInviteLinkGenerated(data) {
    showNotification('邀请链接已生成');

    // 显示邀请链接
    const invite = data.invite;
    const expireText = invite.expiresAt ? new Date(invite.expiresAt).toLocaleString() : '永不过期';
    const usageText = invite.maxUsage ? `${invite.usageCount}/${invite.maxUsage}` : `${invite.usageCount}/无限`;

    const linkHtml = `
        <div class="invite-item" data-invite-id="${invite.id}">
            <div class="invite-info">
                <div class="invite-url" title="${data.fullUrl}">${data.fullUrl}</div>
                <div class="invite-meta">
                    角色: ${getRoleLabel(invite.role)} | 过期: ${expireText} | 使用: ${usageText}
                </div>
            </div>
            <div class="invite-actions">
                <button onclick="copyInviteLink('${data.fullUrl}')">复制</button>
                <button onclick="deleteInviteLink('${invite.id}')">删除</button>
            </div>
        </div>
    `;

    const inviteListEl = document.getElementById('inviteList');
    if (inviteListEl) {
        inviteListEl.insertAdjacentHTML('afterbegin', linkHtml);
    }
}

// 处理封禁列表
function handleBanList(data) {
    const banListEl = document.getElementById('banList');
    if (!banListEl) return;

    banListEl.innerHTML = '';

    if (data.records.length === 0) {
        banListEl.innerHTML = '<div style="text-align: center; color: #999; padding: 10px;">暂无封禁记录</div>';
        return;
    }

    data.records.forEach(record => {
        const bannedByName = getUserName(record.bannedBy);
        const banTime = new Date(record.bannedAt).toLocaleString();
        const reason = record.reason ? ` - ${record.reason}` : '';
        const typeText = record.type === 'ip' ? 'IP' : '密钥指纹';

        const recordHtml = `
            <div class="ban-item">
                <div class="ban-info">
                    <div><strong>${typeText}:</strong> ${record.value}</div>
                    <div class="ban-meta">封禁者: ${bannedByName} | 时间: ${banTime}${reason}</div>
                </div>
                <button onclick="unbanUser('${record.type}', '${record.value}')">解封</button>
            </div>
        `;

        banListEl.insertAdjacentHTML('beforeend', recordHtml);
    });
}

// 处理邀请链接列表
function handleInviteLinks(data) {
    const inviteListEl = document.getElementById('inviteList');
    if (!inviteListEl) return;

    inviteListEl.innerHTML = '';

    if (data.links.length === 0) {
        inviteListEl.innerHTML = '<div style="text-align: center; color: #999; padding: 10px;">暂无邀请链接</div>';
        return;
    }

    data.links.forEach(invite => {
        const expireText = invite.expiresAt ? new Date(invite.expiresAt).toLocaleString() : '永不过期';
        const usageText = invite.maxUsage ? `${invite.usageCount}/${invite.maxUsage}` : `${invite.usageCount}/无限`;
        const fullUrl = `${window.location.origin}/?r=${invite.roomId}&i=${invite.id}`;

        const linkHtml = `
            <div class="invite-item" data-invite-id="${invite.id}">
                <div class="invite-info">
                    <div class="invite-url" title="${fullUrl}">${fullUrl}</div>
                    <div class="invite-meta">
                        角色: ${getRoleLabel(invite.role)} | 过期: ${expireText} | 使用: ${usageText}
                    </div>
                </div>
                <div class="invite-actions">
                    <button onclick="copyInviteLink('${fullUrl}')">复制</button>
                    <button onclick="deleteInviteLink('${invite.id}')">删除</button>
                </div>
            </div>
        `;

        inviteListEl.insertAdjacentHTML('beforeend', linkHtml);
    });
}

// 处理隐私配置更新
function handlePrivacyConfigUpdated(data) {
    const actorName = getUserName(data.updatedBy);
    showNotification(`${actorName} 更新了隐私配置`);

    roomInfo.privacy = data.config;

    // 更新隐私配置UI
    const guestCanViewMessages = document.getElementById('guestCanViewMessages');
    const guestCanViewUserList = document.getElementById('guestCanViewUserList');
    const requireInviteToJoin = document.getElementById('requireInviteToJoin');

    if (guestCanViewMessages) guestCanViewMessages.checked = data.config.guestCanViewMessages;
    if (guestCanViewUserList) guestCanViewUserList.checked = data.config.guestCanViewUserList;
    if (requireInviteToJoin) requireInviteToJoin.checked = data.config.requireInviteToJoin;
}

// 处理消息计数配置更新
function handleMessageCountConfigUpdated(data) {
    const actorName = getUserName(data.updatedBy);
    showNotification(`${actorName} 更新了消息计数配置`);

    // 更新消息计数配置UI
    const enableMessageCount = document.getElementById('enableMessageCount');
    const messageCountVisibleToUser = document.getElementById('messageCountVisibleToUser');
    const messageCountVisibleToGuest = document.getElementById('messageCountVisibleToGuest');

    if (enableMessageCount) enableMessageCount.checked = data.enableMessageCount;
    if (messageCountVisibleToUser) messageCountVisibleToUser.checked = data.messageCountVisibleToUser;
    if (messageCountVisibleToGuest) messageCountVisibleToGuest.checked = data.messageCountVisibleToGuest;
}

// 处理Creator转让
function handleCreatorTransferred(data) {
    const oldName = getUserName(data.oldCreatorId);
    const newName = getUserName(data.newCreatorId);

    showNotification(`${oldName} 将Creator身份转让给 ${newName}`);

    // 如果转让给自己，更新角色
    if (data.newCreatorId === userId) {
        roomInfo.yourRole = 'creator';
        roomInfo.isCreator = true;
        updateUIBasedOnRole();
    }
    // 如果自己是原Creator，更新角色
    if (data.oldCreatorId === userId) {
        roomInfo.yourRole = 'admin';
        roomInfo.isCreator = false;
        updateUIBasedOnRole();
    }

    // 刷新用户列表
    websocket.send(JSON.stringify({ type: 'getUsers' }));
}

// 处理权限拒绝
function handlePermissionDenied(data) {
    showNotification(`权限不足: ${data.reason}`, 'error');
    debugLog(`权限拒绝 - 操作: ${data.action}, 原因: ${data.reason}`);
}

// ========================
// 群管理功能 - 操作函数
// ========================

// 转换房间类型
function convertRoomType(targetType) {
    if (!confirm(`确定要将房间转换为${getRoomTypeLabel(targetType)}吗？`)) return;

    websocket.send(JSON.stringify({
        type: 'convertRoomType',
        targetType: targetType
    }));
}

// 踢出用户
function kickUser(targetUserId) {
    const targetUser = users.get(targetUserId);
    if (!targetUser) return;

    const reason = prompt(`确定要踢出用户 ${targetUser.name} 吗？请输入原因（可选）：`);
    if (reason === null) return; // 用户取消

    websocket.send(JSON.stringify({
        type: 'kickUser',
        targetUserId: targetUserId,
        reason: reason || undefined
    }));
}

// 封禁用户
function banUser(targetUserId, banType) {
    const targetUser = users.get(targetUserId);
    if (!targetUser) return;

    const typeText = banType === 'ip' ? 'IP地址' : '密钥指纹';
    const reason = prompt(`确定要封禁用户 ${targetUser.name} 的${typeText}吗？请输入原因（可选）：`);
    if (reason === null) return; // 用户取消

    websocket.send(JSON.stringify({
        type: 'banUser',
        targetUserId: targetUserId,
        banType: banType,
        reason: reason || undefined
    }));
}

// 解除封禁
function unbanUser(banType, value) {
    if (!confirm(`确定要解除此封禁吗？`)) return;

    websocket.send(JSON.stringify({
        type: 'unban',
        banType: banType,
        value: value
    }));

    // 刷新封禁列表
    setTimeout(() => getBanList(), 500);
}

// 修改用户角色
function changeUserRole(targetUserId, newRole) {
    const targetUser = users.get(targetUserId);
    if (!targetUser) return;

    if (!confirm(`确定要将 ${targetUser.name} 的角色变更为 ${getRoleLabel(newRole)} 吗？`)) return;

    websocket.send(JSON.stringify({
        type: 'changeRole',
        targetUserId: targetUserId,
        newRole: newRole
    }));
}

// 生成邀请链接
function generateInviteLink() {
    const role = document.getElementById('inviteRole')?.value || 'user';
    const expiresHours = document.getElementById('inviteExpires')?.value;
    const maxUsage = document.getElementById('inviteMaxUsage')?.value;

    const message = {
        type: 'generateInvite',
        role: role
    };

    if (expiresHours && parseInt(expiresHours) > 0) {
        message.expiresIn = parseInt(expiresHours) * 3600000; // 转换为毫秒
    }

    if (maxUsage && parseInt(maxUsage) > 0) {
        message.maxUsage = parseInt(maxUsage);
    }

    websocket.send(JSON.stringify(message));
}

// 删除邀请链接
function deleteInviteLink(inviteId) {
    if (!confirm('确定要删除此邀请链接吗？')) return;

    websocket.send(JSON.stringify({
        type: 'deleteInviteLink',
        inviteId: inviteId
    }));

    // 删除UI元素
    const inviteItem = document.querySelector(`[data-invite-id="${inviteId}"]`);
    if (inviteItem) {
        inviteItem.remove();
    }
}

// 获取封禁列表
function getBanList() {
    websocket.send(JSON.stringify({
        type: 'getBanList'
    }));
}

// 获取邀请链接列表
function getInviteLinks() {
    websocket.send(JSON.stringify({
        type: 'getInviteLinks'
    }));
}

// 更新隐私配置
function updatePrivacyConfig() {
    const guestCanViewMessages = document.getElementById('guestCanViewMessages')?.checked || false;
    const guestCanViewUserList = document.getElementById('guestCanViewUserList')?.checked || false;
    const requireInviteToJoin = document.getElementById('requireInviteToJoin')?.checked || false;

    websocket.send(JSON.stringify({
        type: 'updatePrivacyConfig',
        config: {
            guestCanViewMessages: guestCanViewMessages,
            guestCanViewUserList: guestCanViewUserList,
            requireInviteToJoin: requireInviteToJoin
        }
    }));
}

// 更新消息计数配置
function updateMessageCountConfig() {
    const enableMessageCount = document.getElementById('enableMessageCount')?.checked || false;
    const messageCountVisibleToUser = document.getElementById('messageCountVisibleToUser')?.checked || false;
    const messageCountVisibleToGuest = document.getElementById('messageCountVisibleToGuest')?.checked || false;

    websocket.send(JSON.stringify({
        type: 'updateMessageCountConfig',
        enableMessageCount: enableMessageCount,
        messageCountVisibleToUser: messageCountVisibleToUser,
        messageCountVisibleToGuest: messageCountVisibleToGuest
    }));
}

// 转让Creator身份
function transferCreator(targetUserId) {
    const targetUser = users.get(targetUserId);
    if (!targetUser) return;

    if (!confirm(`确定要将Creator身份转让给 ${targetUser.name} 吗？此操作不可撤销！`)) return;

    websocket.send(JSON.stringify({
        type: 'transferCreator',
        targetUserId: targetUserId
    }));
}

// 复制邀请链接
function copyInviteLink(url) {
    navigator.clipboard.writeText(url)
        .then(() => showNotification('邀请链接已复制'))
        .catch(err => {
            // fallback
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('邀请链接已复制');
        });
}
