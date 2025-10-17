// ========================
// 用户列表管理
// ========================

// 更新用户列表
function updateUserList(userList) {
    userListEl.innerHTML = '';
    users.clear();

    debugLog(`更新用户列表，共 ${userList.length} 个用户`);

    userList.forEach(user => {
        users.set(user.id, user);

        const userEl = document.createElement('div');
        userEl.className = 'user-item';
        if (user.id === userId) {
            userEl.classList.add('self');
        }

        const idDisplay = user.id.slice(-16);

        // 用户信息容器
        const userInfoEl = document.createElement('div');
        userInfoEl.className = 'user-info-container';

        // 使用DOM API创建元素而不是innerHTML
        const nameEl = document.createElement('div');
        nameEl.className = 'user-name';
        nameEl.textContent = user.name + (user.id === userId ? ' (你)' : '');

        // 添加角色徽章 - 仅在Private房间下显示
        if (user.role && roomInfo.roomType === 'private') {
            const roleEl = document.createElement('span');
            roleEl.className = `role-badge role-${user.role}`;
            roleEl.textContent = getRoleLabel(user.role);
            nameEl.appendChild(roleEl);
        }

        const idEl = document.createElement('div');
        idEl.className = 'user-id';
        idEl.textContent = idDisplay;

        userInfoEl.appendChild(nameEl);
        userInfoEl.appendChild(idEl);

        if (user.email) {
            const emailEl = document.createElement('div');
            emailEl.className = 'user-email';
            emailEl.textContent = user.email;
            userInfoEl.appendChild(emailEl);
        }

        userEl.appendChild(userInfoEl);

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
                banBtn.onclick = () => {
                    const banType = confirm('封禁密钥指纹？\n点击"确定"封禁密钥指纹，点击"取消"封禁IP') ? 'keyFingerprint' : 'ip';
                    banUser(user.id, banType);
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

        userListEl.appendChild(userEl);
    });

    if (userList.length === 0) {
        userListEl.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无用户</div>';
    }
}
