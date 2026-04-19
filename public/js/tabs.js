// ========================
// Tab切换处理
// ========================

function setupTabSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            tabBtns.forEach(b => { b.removeAttribute('data-active'); b.classList.remove('active'); });
            tabContents.forEach(c => { c.classList.add('hidden'); c.classList.remove('active'); });

            btn.setAttribute('data-active', '');
            btn.classList.add('active');
            const target = document.getElementById(targetTab);
            if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
        });
    });

    // 初始化第一个 tab
    const firstBtn = tabBtns[0];
    if (firstBtn) {
        firstBtn.setAttribute('data-active', '');
        firstBtn.classList.add('active');
    }
}
