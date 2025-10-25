// ========================
// 浏览器兼容性 Polyfills
// ========================

// Element.closest() polyfill (用于 IE11 等旧版浏览器)
if (!Element.prototype.closest) {
    Element.prototype.closest = function(selector) {
        let el = this;
        while (el) {
            if (el.matches && el.matches(selector)) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
    };
}

// Element.matches() polyfill (部分旧版浏览器需要)
if (!Element.prototype.matches) {
    Element.prototype.matches =
        Element.prototype.matchesSelector ||
        Element.prototype.mozMatchesSelector ||
        Element.prototype.msMatchesSelector ||
        Element.prototype.oMatchesSelector ||
        Element.prototype.webkitMatchesSelector ||
        function(s) {
            var matches = (this.document || this.ownerDocument).querySelectorAll(s),
                i = matches.length;
            while (--i >= 0 && matches.item(i) !== this) {}
            return i > -1;
        };
}

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

// ========================
// 浏览器兼容性检测
// ========================

// 检查浏览器是否支持必要的功能
function checkBrowserSupport() {
    const requiredFeatures = {
        'WebSocket': 'WebSocket' in window,
        'Fetch API': 'fetch' in window,
        'LocalStorage': 'localStorage' in window,
        'ES6 Promise': 'Promise' in window,
        'URLSearchParams': 'URLSearchParams' in window
    };

    const missingFeatures = [];
    for (const [feature, supported] of Object.entries(requiredFeatures)) {
        if (!supported) {
            missingFeatures.push(feature);
        }
    }

    if (missingFeatures.length > 0) {
        const message = `您的浏览器不支持以下功能：\n${missingFeatures.join(', ')}\n\n建议使用以下浏览器的最新版本：\n- Chrome 108+\n- Firefox 101+\n- Safari 15.4+\n- Edge 108+`;
        alert(message);
        console.error('浏览器兼容性检查失败:', missingFeatures);
        return false;
    }

    // 检查可选功能并给出警告
    const optionalFeatures = {
        'Clipboard API': 'clipboard' in navigator && 'writeText' in navigator.clipboard,
        'File.text()': typeof File !== 'undefined' && File.prototype.text
    };

    const warningFeatures = [];
    for (const [feature, supported] of Object.entries(optionalFeatures)) {
        if (!supported) {
            warningFeatures.push(feature);
        }
    }

    if (warningFeatures.length > 0) {
        console.warn('以下功能不支持，将使用降级方案:', warningFeatures);
    }

    return true;
}

// ========================
// 自定义输入对话框 (替代 prompt)
// ========================

// 显示自定义输入对话框
function customPrompt(title, placeholder = '', defaultValue = '') {
    return new Promise((resolve) => {
        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.className = 'custom-prompt-overlay';

        // 创建对话框
        const dialog = document.createElement('div');
        dialog.className = 'custom-prompt-dialog';

        // 对话框标题
        const titleEl = document.createElement('div');
        titleEl.className = 'custom-prompt-title';
        titleEl.textContent = title;

        // 输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'custom-prompt-input';
        input.placeholder = placeholder;
        input.value = defaultValue;

        // 按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'custom-prompt-buttons';

        // 取消按钮
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'custom-prompt-btn custom-prompt-cancel';
        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
            resolve(null);
        };

        // 确认按钮
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '确定';
        confirmBtn.className = 'custom-prompt-btn custom-prompt-confirm';
        confirmBtn.onclick = () => {
            const value = input.value.trim();
            document.body.removeChild(overlay);
            resolve(value || null);
        };

        // 回车确认
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });

        // 组装对话框
        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(confirmBtn);
        dialog.appendChild(titleEl);
        dialog.appendChild(input);
        dialog.appendChild(buttonContainer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // 自动聚焦输入框
        setTimeout(() => input.focus(), 100);

        // 点击遮罩层取消
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cancelBtn.click();
            }
        };
    });
}
