// ========================
// 用户列表管理
// ========================

function updateUserList(userList) {
    users.clear();
    userList.forEach(u => users.set(u.id, u));
    debugLog(`更新用户列表，共 ${userList.length} 个用户`);
    renderUserList(userList);
}

function renderUserList(userList) {
    DOM.userList.innerHTML = '';

    if (userList.length === 0) {
        DOM.userList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无用户</div>';
        return;
    }

    const collisions = getShortIdCollisions(users);

    userList.forEach(user => {
        const color = getUserColor(user.id);
        const isSelf = user.id === userId;
        const idDisplay = collisions.has(user.id) ? user.id.slice(-16) : user.id.slice(-8);
        const hasCollision = collisions.has(user.id);

        const userEl = document.createElement('div');
        userEl.className = 'user-item' + (isSelf ? ' self' : '');

        userEl.appendChild(buildUserCard(user, color, isSelf, idDisplay, hasCollision));

        // 添加操作按钮（如果有权限且不是自己）
        if (user.id !== userId && roomInfo.roomType === 'private') {
            const actionsEl = document.createElement('div');
            actionsEl.className = 'user-actions';

            // 踢出按钮
            if (hasPermission('kick') && user.role !== 'creator') {
                const kickBtn = document.createElement('button');
                kickBtn.className = 'action-btn kick-btn';
                kickBtn.textContent = '踢出';
                kickBtn.onclick = () => kickUser(user.id);
                actionsEl.appendChild(kickBtn);
            }

            // 封禁按钮
            if (hasPermission('ban') && user.role !== 'creator') {
                const banBtn = document.createElement('button');
                banBtn.className = 'action-btn ban-btn';
                banBtn.textContent = '封禁';
                banBtn.onclick = async () => {
                    const isFingerprint = await customChoice('选择封禁方式', '封禁IP', '封禁密钥指纹');
                    if (isFingerprint === null) return;
                    banUser(user.id, isFingerprint ? 'keyFingerprint' : 'ip');
                };
                actionsEl.appendChild(banBtn);
            }

            // 角色切换下拉菜单
            if (hasPermission('changeRole') && user.role !== 'creator') {
                const roleSelect = document.createElement('select');
                roleSelect.className = 'role-select';
                roleSelect.value = user.role;

                const roles = ['admin', 'user', 'guest'];
                roles.forEach(role => {
                    const option = document.createElement('option');
                    option.value = role;
                    option.textContent = getRoleLabel(role);
                    if (role === user.role) {
                        option.selected = true;
                    }
                    roleSelect.appendChild(option);
                });

                roleSelect.onchange = () => {
                    if (roleSelect.value !== user.role) {
                        changeUserRole(user.id, roleSelect.value);
                    }
                };

                actionsEl.appendChild(roleSelect);
            }

            // 转让Creator按钮（仅Creator可见）
            if (roomInfo.yourRole === 'creator' && user.role !== 'creator') {
                const transferBtn = document.createElement('button');
                transferBtn.className = 'action-btn transfer-btn';
                transferBtn.textContent = '转让';
                transferBtn.onclick = () => transferCreator(user.id);
                actionsEl.appendChild(transferBtn);
            }

            if (actionsEl.children.length > 0) {
                userEl.appendChild(actionsEl);
            }
        }

        DOM.userList.appendChild(userEl);
    });

    if (userList.length === 0) {
        DOM.userList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无用户</div>';
    }
}

// ── 共用：构建徽章行 ──
function buildBadges(user, isSelf) {
    const frag = document.createDocumentFragment();
    if (isSelf) {
        const b = document.createElement('span');
        b.className = 'self-badge';
        b.textContent = '你';
        frag.appendChild(b);
    }
    if (user.role && roomInfo.roomType === 'private') {
        const r = document.createElement('span');
        r.className = `role-badge role-${user.role}`;
        r.textContent = getRoleLabel(user.role);
        frag.appendChild(r);
    }
    return frag;
}

// ── 方案 C：名字前色点 ──
function buildUserCard(user, color, isSelf, idDisplay, hasCollision) {
    const wrap = document.createElement('div');
    wrap.className = 'user-variant-c';

    const info = document.createElement('div');
    info.className = 'user-info-container';

    const nameRow = document.createElement('div');
    nameRow.className = 'user-name';
    const dot = document.createElement('span');
    dot.className = 'user-dot';
    dot.style.background = color;
    nameRow.appendChild(dot);
    nameRow.appendChild(document.createTextNode(user.name));
    nameRow.appendChild(buildBadges(user, isSelf));
    info.appendChild(nameRow);

    const idRow = document.createElement('div');
    idRow.className = 'user-id' + (hasCollision ? ' collision' : '');
    idRow.textContent = idDisplay.toUpperCase().replace(/(.{4})/g, '$1 ').trim();
    info.appendChild(idRow);

    if (user.email) {
        const em = document.createElement('div');
        em.className = 'user-email';
        em.textContent = user.email;
        info.appendChild(em);
    }

    wrap.appendChild(info);
    return wrap;
}
