function setupSidebarToggle() {
    const roomName = document.getElementById('roomName');
    const overlay = document.getElementById('overlay');
    const manageArea = document.querySelector('[data-panel="manage"]');
    const slideToggle = document.querySelector('.slide-toggle');

    function expandSidebar() {
        if (!window.isMobile) return;
        manageArea.setAttribute('data-open', '');
        overlay.classList.remove('hidden');
    }

    function collapseSidebar() {
        if (!window.isMobile) return;
        manageArea.removeAttribute('data-open');
        overlay.classList.add('hidden');
    }

    if (roomName) roomName.addEventListener('click', expandSidebar);
    if (slideToggle) slideToggle.addEventListener('click', expandSidebar);
    if (overlay) overlay.addEventListener('click', collapseSidebar);

    window.addEventListener('resize', () => {
        if (!window.isMobile) manageArea.removeAttribute('data-open');
    });
}
