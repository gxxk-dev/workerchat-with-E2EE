// ========================
// 初始化应用
// ========================

document.addEventListener('DOMContentLoaded', async function() {
    debugLog('应用初始化...');

    // 检查浏览器兼容性
    const isCompatible = checkBrowserSupport();
    if (!isCompatible) {
        debugLog('浏览器不兼容，应用可能无法正常运行');
        // 虽然不兼容，但仍然尝试继续运行
    }

    // 设置Tab切换
    setupTabSwitching();

    // 设置侧边栏切换
    setupSidebarToggle();

    // 尝试从URL参数获取房间ID和邀请码
    const urlParams = getUrlParams();

    if (urlParams.roomId) {
        // 使用URL中提供的房间ID
        roomId = urlParams.roomId;
        debugLog(`从URL参数获取房间ID: ${roomId}`);

        // 检查是否有邀请码
        if (urlParams.inviteId) {
            inviteId = urlParams.inviteId;
            debugLog(`检测到邀请码: ${inviteId}`);
            showNotification(`正在使用邀请链接加入房间: ${roomId.slice(0, 8)}...`, 'warning');
        } else {
            showNotification(`正在加入房间: ${roomId.slice(0, 8)}...`, 'warning');
        }
    } else {
        // 创建新房间
        try {
            roomId = await fetchRoomId();
            debugLog(`创建新房间: ${roomId}`);

            // 更新URL以包含新房间ID
            updateURLWithRoomId(roomId);
            showNotification(`已创建聊天室: ${roomId.slice(0, 8)}...`);
        } catch (error) {
            debugLog('获取房间ID失败: ' + error.message);
            showNotification('创建聊天室失败', 'error');
            return;
        }
    }

    // 更新UI
    const roomName = document.getElementById('roomName');
    roomName.textContent = `E2EE Chat #${roomId}`;

    // 更新标题
    document.title = `E2EE Chat #${roomId}`;

    roomUrlEl.innerHTML = `
        <span id="copyRoomLink">${window.location.href} <span style="margin-left: 10px; padding: 4px 8px; background: var(--primary); border: none; border-radius: 4px; color: white; cursor: pointer;">复制链接</span></span>
    `;

    // 添加复制房间链接按钮
    document.getElementById('copyRoomLink')?.addEventListener('click', function() {
        navigator.clipboard.writeText(window.location.href)
            .then(() => showNotification('房间链接已复制'))
            .catch(err => showNotification('复制失败: ' + err.message, 'error'));
    });

    // 尝试加载本地密钥
    await loadLocalKeys();

    // 连接WebSocket
    await connectWebSocket();

    // 设置事件监听器
    setupEventListeners();

    // 显示新手指导（页面加载完成后立即显示）
    setTimeout(() => showNewbieGuide(), 500); // 延迟500ms确保界面完全渲染

    // 输入区域自动高度调整
    messageInputEl.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
});
