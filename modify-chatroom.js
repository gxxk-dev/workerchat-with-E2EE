const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'ChatRoom.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. 在 saveUserRoles 方法后添加 loadUserLastSeenMessageCount 和 saveUserLastSeenMessageCount 方法
const saveUserRolesEnd = content.indexOf('    private async saveUserRoles(): Promise<void> {');
const saveUserRolesEndPos = content.indexOf('    }', saveUserRolesEnd) + 6; // "    }\n" 的长度

const newMethods = `
    private async loadUserLastSeenMessageCount(): Promise<void> {
        const lastSeenData = await this.state.storage.get<Record<string, number>>('userLastSeenMessageCount');
        if (lastSeenData) {
            this.userLastSeenMessageCount = new Map(Object.entries(lastSeenData));
        }
    }

    private async saveUserLastSeenMessageCount(): Promise<void> {
        const lastSeenObj = Object.fromEntries(this.userLastSeenMessageCount);
        await this.state.storage.put('userLastSeenMessageCount', lastSeenObj);
    }
`;

content = content.slice(0, saveUserRolesEndPos) + newMethods + content.slice(saveUserRolesEndPos);

// 2. 修改 handleDisconnect 方法
const handleDisconnectStart = content.indexOf('    private async handleDisconnect(webSocket: WebSocket): Promise<void> {');
const handleDisconnectEnd = content.indexOf('    }', handleDisconnectStart) + 6;

const newHandleDisconnect = `    private async handleDisconnect(webSocket: WebSocket): Promise<void> {
        // 在删除用户前,保存该用户最后看到的消息计数
        const user = this.users.get(webSocket);
        if (user && this.roomConfig) {
            const currentCount = this.roomConfig.messageCount || 0;
            this.userLastSeenMessageCount.set(user.id, currentCount);
            await this.saveUserLastSeenMessageCount();
        }

        this.sessions.delete(webSocket);
        this.users.delete(webSocket);

        // 向其他用户广播用户列表更新
        this.broadcastUserList();

        // 当房间内没有用户时,清空所有持久化数据
        if (this.users.size === 0) {
            await this.clearAllData();
        }
    }
`;

content = content.slice(0, handleDisconnectStart) + newHandleDisconnect + content.slice(handleDisconnectEnd);

// 3. 修改 handleRegister 中的重连消息逻辑
const reconnectMsgPattern = /            \/\/ 发送用户加入\/重连的系统提示消息\n            const currentMessageCount = this\.roomConfig!\.messageCount \|\| 0;\n            if \(isReconnecting\) \{[\s\S]*?\n            \}/;

const newReconnectMsg = `            // 发送用户加入/重连的系统提示消息
            const currentMessageCount = this.roomConfig!.messageCount || 0;
            if (isReconnecting) {
                const lastSeenCount = this.userLastSeenMessageCount.get(userInfo.id) || 0;
                const missedCount = currentMessageCount - lastSeenCount;

                if (missedCount > 0) {
                    this.broadcastSystemMessage(
                        \`\${userInfo.name} 重新连接到了房间 (错过了 \${missedCount} 条消息)\`,
                        'userReconnected'
                    );
                } else {
                    this.broadcastSystemMessage(
                        \`\${userInfo.name} 重新连接到了房间\`,
                        'userReconnected'
                    );
                }
            } else {
                if (currentMessageCount > 0) {
                    this.broadcastSystemMessage(
                        \`\${userInfo.name} 加入了房间 (加入前已有 \${currentMessageCount} 条消息)\`,
                        'userJoined'
                    );
                } else {
                    this.broadcastSystemMessage(
                        \`\${userInfo.name} 加入了房间\`,
                        'userJoined'
                    );
                }
            }`;

content = content.replace(reconnectMsgPattern, newReconnectMsg);

// 4. 修改 clearAllData 方法
const clearAllDataPattern = /    private async clearAllData\(\): Promise<void> \{\n        \/\/ 清空内存数据\n        this\.roomConfig = null;\n        this\.invites\.clear\(\);\n        this\.banList = \[\];\n        this\.userRoles\.clear\(\);\n        this\.origin = '';[\s\S]*?    \}/;

const newClearAllData = `    private async clearAllData(): Promise<void> {
        // 清空内存数据
        this.roomConfig = null;
        this.invites.clear();
        this.banList = [];
        this.userRoles.clear();
        this.userLastSeenMessageCount.clear();
        this.origin = '';

        // 清空持久化存储
        await this.state.storage.deleteAll();
    }`;

content = content.replace(clearAllDataPattern, newClearAllData);

// 保存文件
fs.writeFileSync(filePath, content, 'utf8');
console.log('文件修改完成');
