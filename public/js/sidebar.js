// ========================
// 面板切换处理
// ========================

function setupSidebarToggle() {
    const roomName = document.getElementById('roomName');
    const overlay = document.getElementById('overlay');
    const manageArea = document.querySelector('.manage-area');
    const slideToggle = document.querySelector('.slide-toggle');

    // 展开侧边栏
    function expandSidebar() {
        if (!window.isMobile) return;
        manageArea.classList.add('expanded');
        overlay.style.display = 'block';
        if (slideToggle) {
            slideToggle.classList.add('expanded');
        }
    }

    // 收起侧边栏
    function collapseSidebar() {
        if (!window.isMobile) return;
        manageArea.classList.remove('expanded');
        overlay.style.display = 'none';
        if (slideToggle) {
            slideToggle.classList.remove('expanded');
        }
    }

    // 点击标题展开侧边栏
    roomName.addEventListener('click', expandSidebar);

    // 点击遮罩层收起侧边栏
    overlay.addEventListener('click', collapseSidebar);

    // 响应窗口大小变化
    window.addEventListener('resize', () => {
        if (window.isMobile) {
            // 在非移动端时确保面板处于正常状态
            collapseSidebar();
        }
    });
}
