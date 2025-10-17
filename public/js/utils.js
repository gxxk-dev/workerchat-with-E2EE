// ========================
// 工具函数
// ========================

// 判断是否为移动设备
Object.defineProperty(window, 'isMobile', {
    get() { // 全局变量+Getter
        return window.innerWidth <= 768;
    },
    configurable: true
});

window.addEventListener('resize', () => {
    // 触发 getter 重新计算
    const _ = window.isMobile;
});

// 获取房间ID
async function fetchRoomId() {
    try {
        const response = await fetch("/api/room", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
    } catch (error) {
        debugLog("获取房间ID失败: " + error.message);
        return null;
    }
}

// 调试日志函数
function debugLog(message) {
    console.log(message);
    const timestamp = new Date().toLocaleTimeString();
    debugInfoEl.textContent += `${timestamp}: ${message}\n`;
    debugInfoEl.scrollTop = debugInfoEl.scrollHeight;
}

// 显示通知
function showNotification(message, type = 'success') {
    notificationEl.textContent = message;
    notificationEl.className = 'notification';

    if (type === 'error') {
        notificationEl.classList.add('error');
    } else if (type === 'warning') {
        notificationEl.classList.add('warning');
    }

    notificationEl.classList.add('show');

    setTimeout(() => {
        notificationEl.classList.remove('show');
    }, 3000);
}

// 获取URL参数（支持短参数r和i）
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        roomId: urlParams.get('r') || urlParams.get('room'), // 支持新旧格式
        inviteId: urlParams.get('i')
    };
}

// 更新URL以包含房间ID（使用短参数）
function updateURLWithRoomId(roomId) {
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('r', roomId);
    // 移除旧格式参数
    newUrl.searchParams.delete('room');
    window.history.replaceState(null, '', newUrl.toString());
}

// 获取角色显示标签
function getRoleLabel(role) {
    const labels = {
        'creator': 'Creator',
        'admin': 'Admin',
        'user': 'User',
        'guest': 'Guest'
    };
    return labels[role] || role;
}

// 获取房间类型标签
function getRoomTypeLabel(type) {
    return type === 'public' ? 'Public Room' : 'Private Room';
}

// 检查是否有权限
function hasPermission(permission) {
    const permissions = {
        'creator': ['all'],
        'admin': ['kick', 'ban', 'changeRole', 'generateInvite', 'viewBanList'],
        'user': [],
        'guest': []
    };
    const rolePerms = permissions[roomInfo.yourRole] || [];
    return rolePerms.includes('all') || rolePerms.includes(permission);
}

// 获取用户名称（从users Map查询）
function getUserName(userId) {
    const user = users.get(userId);
    return user ? user.name : userId.slice(-16);
}

// 检查用户是否有权限查看消息编号
function canSeeMessageNumber() {
    // Creator 和 Admin 总是可以看到
    if (roomInfo.yourRole === 'creator' || roomInfo.yourRole === 'admin') {
        return true;
    }

    // 根据房间配置和用户角色决定
    if (roomInfo.yourRole === 'user') {
        return roomInfo.messageCountVisibleToUser === true;
    }

    if (roomInfo.yourRole === 'guest') {
        return roomInfo.messageCountVisibleToGuest === true;
    }

    return false;
}

// 显示新手指导
function showNewbieGuide() {
    // 检查是否已显示过新手指导
    const storageKey = `newbieGuideShown_initial`;
    if (localStorage.getItem(storageKey)) {
        return;
    }

    // 创建新手指导气泡
    const guideEl = document.createElement('div');
    guideEl.className = 'newbie-guide';

    // 根据设备类型显示不同的指导内容
    if (window.isMobile) {
        guideEl.innerHTML = '欢迎！<br/>请先单击左上标题展开面板，<br/>并在其中生成密钥以初始化身份！<br/>如果自备了PGP密钥对，<br/>也可以在左下角导入！';
    } else {
        guideEl.innerHTML = '欢迎！<br/>请在左下面板中生成密钥以初始化您的身份！<br/>（如果您自备了PGP密钥对，也可以在左下角导入）';
    }

    document.body.appendChild(guideEl);

    // 5秒后自动移除
    setTimeout(() => {
        if (guideEl.parentNode) {
            guideEl.remove();
        }
    }, 5000);

    // 标记为已显示
    localStorage.setItem(storageKey, 'true');
}
