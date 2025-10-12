import {
    UserInfo, RegisterMessage, ChatMessage, RegisteredMessage, UserListMessage,
    EncryptedMessage, ErrorMessage, UserProfile, UserRole, Permission,
    RoomConfig, RoomType, PrivacyConfig, InviteLink, BanRecord, IP,
    ConvertRoomTypeMessage, KickUserMessage, BanUserMessage, UnbanMessage,
    ChangeRoleMessage, GenerateInviteMessage, UpdatePrivacyConfigMessage,
    GetBanListMessage, GetInviteLinksMessage, DeleteInviteLinkMessage,
    TransferCreatorMessage, RoomInfoMessage, RoomTypeConvertedMessage,
    UserKickedMessage, UserBannedMessage, RoleChangedMessage,
    InviteLinkGeneratedMessage, BanListMessage, InviteLinksMessage,
    PrivacyConfigUpdatedMessage, CreatorTransferredMessage, PermissionDeniedMessage,
    UpdateMessageCountConfigMessage, MessageCountConfigUpdatedMessage,
    ROLE_PERMISSIONS
} from "./models";
import { readKey } from "openpgp";

export class ChatRoom {
    private state: DurableObjectState;
    private users: Map<WebSocket, UserInfo> = new Map();
    private sessions: Set<WebSocket> = new Set();
    private roomId: string = '';
    private roomConfig: RoomConfig | null = null;
    private invites: Map<string, InviteLink> = new Map();
    private banList: BanRecord[] = [];
    private origin: string = ''; // 保存请求的origin

    constructor(state: DurableObjectState) {
        this.state = state;
        this.initializeRoom();
    }

    private async initializeRoom(): Promise<void> {
        // 从持久化存储加载数据
        await this.loadRoomConfig();
        await this.loadInvites();
        await this.loadBanList();
    }

    async fetch(request: Request): Promise<Response> {
        if (request.headers.get('Upgrade') !== 'websocket') {
            return new Response('Expected websocket', { status: 400 });
        }

        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);

        // 从请求URL提取房间ID和origin
        const url = new URL(request.url);
        const match = url.pathname.match(/\/api\/room\/([^/]+)\/websocket$/);
        if (match) {
            this.roomId = decodeURIComponent(match[1]);
        }

        // 保存origin用于生成邀请链接
        if (!this.origin) {
            this.origin = `${url.protocol}//${url.host}`;
        }

        this.handleSession(server);

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    private handleSession(webSocket: WebSocket): void {
        webSocket.accept();
        this.sessions.add(webSocket);

        webSocket.addEventListener('message', async (event) => {
            try {
                const message = JSON.parse(event.data as string);
                await this.handleMessage(webSocket, message);
            } catch (error) {
                this.sendError(webSocket, 'Invalid JSON format');
            }
        });

        webSocket.addEventListener('close', () => {
            this.handleDisconnect(webSocket);
        });

        webSocket.addEventListener('error', () => {
            this.handleDisconnect(webSocket);
        });
    }

    private async handleMessage(webSocket: WebSocket, message: any): Promise<void> {
        switch (message.type) {
            case 'register':
                await this.handleRegister(webSocket, message);
                break;
            case 'getUsers':
                this.handleGetUsers(webSocket);
                break;
            case 'message':
                await this.handleChatMessage(webSocket, message);
                break;
            case 'convertRoomType':
                await this.handleConvertRoomType(webSocket, message);
                break;
            case 'kickUser':
                await this.handleKickUser(webSocket, message);
                break;
            case 'banUser':
                await this.handleBanUser(webSocket, message);
                break;
            case 'unban':
                await this.handleUnban(webSocket, message);
                break;
            case 'changeRole':
                await this.handleChangeRole(webSocket, message);
                break;
            case 'generateInvite':
                await this.handleGenerateInvite(webSocket, message);
                break;
            case 'updatePrivacyConfig':
                await this.handleUpdatePrivacyConfig(webSocket, message);
                break;
            case 'getBanList':
                this.handleGetBanList(webSocket, message);
                break;
            case 'getInviteLinks':
                this.handleGetInviteLinks(webSocket, message);
                break;
            case 'deleteInviteLink':
                await this.handleDeleteInviteLink(webSocket, message);
                break;
            case 'transferCreator':
                await this.handleTransferCreator(webSocket, message);
                break;
            case 'updateMessageCountConfig':
                await this.handleUpdateMessageCountConfig(webSocket, message);
                break;
            default:
                this.sendError(webSocket, `Unknown message type: ${message.type}`);
        }
    }

    private async handleRegister(webSocket: WebSocket, message: RegisterMessage): Promise<void> {
        try {
            if (!message.publicKey || typeof message.publicKey !== 'string') {
                this.sendError(webSocket, 'Invalid public key format');
                return;
            }

            // 验证公钥格式
            if (!this.isValidPGPPublicKey(message.publicKey)) {
                this.sendError(webSocket, 'Invalid PGP public key format');
                return;
            }

            // 从公钥中提取用户信息
            const userProfile = await this.extractUserProfile(message.publicKey);

            // 检查封禁列表
            if (this.isUserBanned(userProfile.id)) {
                this.sendError(webSocket, '您已被封禁，无法加入此房间');
                webSocket.close();
                return;
            }

            // 初始化房间配置（如果是第一个用户）
            const isFirstUser = this.users.size === 0;
            if (isFirstUser && !this.roomConfig) {
                this.roomConfig = {
                    type: RoomType.PUBLIC,
                    creatorId: userProfile.id,
                    enableMessageCount: true,  // 默认启用消息计数
                    messageCountVisibleToUser: false,
                    messageCountVisibleToGuest: false,
                    messageCount: 0
                };
                await this.saveRoomConfig();
            }

            // 分配角色
            const assignedRole = await this.assignUserRole(
                isFirstUser,
                this.roomConfig!,
                message.inviteId,
                userProfile.id
            );

            const userInfo: UserInfo = {
                id: userProfile.id,
                name: userProfile.name,
                email: userProfile.email,
                publicKey: message.publicKey,
                webSocket: webSocket,
                role: assignedRole
            };

            // 检查用户是否已存在
            const existingUser = this.findUserById(userInfo.id);
            if (existingUser && existingUser.webSocket !== webSocket) {
                // 更新现有用户的连接
                this.users.delete(existingUser.webSocket);
                existingUser.webSocket.close();
            }

            this.users.set(webSocket, userInfo);

            // 发送注册成功响应
            const registeredResponse: RegisteredMessage = {
                type: 'registered',
                profile: {
                    id: userInfo.id,
                    name: userInfo.name,
                    email: userInfo.email
                },
                assignedRole: assignedRole
            };

            webSocket.send(JSON.stringify(registeredResponse));

            // 发送房间信息
            const roomInfo: RoomInfoMessage = {
                type: 'roomInfo',
                roomType: this.roomConfig!.type,
                isCreator: userInfo.id === this.roomConfig!.creatorId,
                yourRole: assignedRole,
                privacy: this.roomConfig!.privacy
            };

            // 根据权限添加消息计数
            if (this.canViewMessageCount(userInfo)) {
                roomInfo.messageCount = this.roomConfig!.messageCount || 0;
            }

            webSocket.send(JSON.stringify(roomInfo));

            // 向所有用户广播用户列表更新
            this.broadcastUserList();

        } catch (error: any) {
            this.sendError(webSocket, error.message || 'Registration failed');
            webSocket.close();
        }
    }

    private async assignUserRole(
        isFirstUser: boolean,
        roomConfig: RoomConfig,
        inviteId: string | undefined,
        userFingerprint: string
    ): Promise<UserRole> {
        if (isFirstUser) return UserRole.CREATOR;

        if (roomConfig.type === RoomType.PUBLIC) {
            return UserRole.USER;
        }

        // Private 房间
        if (inviteId) {
            const invite = await this.validateInvite(inviteId);
            if (invite) {
                await this.incrementInviteUsage(inviteId);
                return invite.role;
            }
        }

        if (roomConfig.privacy?.requireInviteToJoin) {
            throw new Error('需要有效的邀请链接才能加入此房间');
        }

        return UserRole.GUEST;
    }

    private async validateInvite(inviteId: string): Promise<InviteLink | null> {
        const invite = this.invites.get(inviteId);
        if (!invite) return null;

        // 检查是否过期
        if (invite.expiresAt && invite.expiresAt < Date.now()) {
            return null;
        }

        // 检查使用次数
        if (invite.maxUsage && invite.usageCount >= invite.maxUsage) {
            return null;
        }

        return invite;
    }

    private async incrementInviteUsage(inviteId: string): Promise<void> {
        const invite = this.invites.get(inviteId);
        if (invite) {
            invite.usageCount++;
            await this.saveInvites();
        }
    }

    private generateInviteCode(): string {
        const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const length = 8;
        let result = '';
        const randomBytes = new Uint8Array(length);
        crypto.getRandomValues(randomBytes);
        for (let i = 0; i < length; i++) {
            result += chars[randomBytes[i] % chars.length];
        }
        return result;
    }

    // ========== 权限检查系统 ==========

    private hasPermission(user: UserInfo, permission: Permission): boolean {
        if (!this.roomConfig) return false;

        const rolePermissions = ROLE_PERMISSIONS[user.role];

        if (!rolePermissions.includes(permission)) {
            return false;
        }

        // Guest 的特殊权限受 privacy 配置限制
        if (user.role === UserRole.GUEST && this.roomConfig.privacy) {
            if (permission === Permission.VIEW_MESSAGES &&
                !this.roomConfig.privacy.guestCanViewMessages) {
                return false;
            }

            if (permission === Permission.VIEW_USER_LIST &&
                !this.roomConfig.privacy.guestCanViewUserList) {
                return false;
            }
        }

        return true;
    }

    private canKickUser(actor: UserInfo, target: UserInfo): boolean {
        // 不能踢出 Creator
        if (target.role === UserRole.CREATOR) return false;

        // Creator 可以踢出任何人
        if (actor.role === UserRole.CREATOR) return true;

        // Admin 不能踢出 Admin
        if (actor.role === UserRole.ADMIN && target.role === UserRole.ADMIN) return false;

        // 检查基本踢出权限
        return this.hasPermission(actor, Permission.KICK_USERS);
    }

    private canBanUser(actor: UserInfo, targetId: string): boolean {
        // 不能封禁 Creator
        if (targetId === this.roomConfig?.creatorId) return false;

        return this.hasPermission(actor, Permission.BAN_USERS);
    }

    private canChangeRole(actor: UserInfo, target: UserInfo, newRole: UserRole): boolean {
        // 不能修改 Creator
        if (target.role === UserRole.CREATOR) return false;

        // 不能将人提升为 Creator
        if (newRole === UserRole.CREATOR) return false;

        return this.hasPermission(actor, Permission.CHANGE_ROLES);
    }

    private canViewMessageCount(user: UserInfo): boolean {
        // Creator 和 Admin 总是可见(不受配置影响)
        if (user.role === UserRole.CREATOR || user.role === UserRole.ADMIN) {
            return true;
        }

        if (!this.roomConfig || !this.roomConfig.enableMessageCount) {
            return false;
        }

        // User 根据配置可见
        if (user.role === UserRole.USER) {
            return this.roomConfig.messageCountVisibleToUser ?? false;
        }

        // Guest 根据配置可见
        if (user.role === UserRole.GUEST) {
            return this.roomConfig.messageCountVisibleToGuest ?? false;
        }

        return false;
    }

    // ========== 管理操作处理 ==========

    private async handleConvertRoomType(webSocket: WebSocket, message: ConvertRoomTypeMessage): Promise<void> {
        const user = this.users.get(webSocket);
        if (!user) return;

        if (!this.hasPermission(user, Permission.CONVERT_ROOM_TYPE)) {
            this.sendPermissionDenied(webSocket, 'convertRoomType', '只有Creator可以转换房间类型');
            return;
        }

        if (!this.roomConfig) return;

        const oldType = this.roomConfig.type;
        this.roomConfig.type = message.targetType;

        if (message.targetType === RoomType.PRIVATE) {
            // Public → Private：初始化默认隐私配置
            this.roomConfig.privacy = {
                guestCanViewMessages: true,
                guestCanViewUserList: true,
                requireInviteToJoin: false
            };
        } else {
            // Private → Public：清空管理数据
            this.roomConfig.privacy = undefined;
            this.invites.clear();
            this.banList = [];
            await this.saveInvites();
            await this.saveBanList();

            // 将所有非Creator用户转为USER
            for (const [ws, u] of this.users) {
                if (u.role !== UserRole.CREATOR) {
                    u.role = UserRole.USER;
                }
            }
        }

        await this.saveRoomConfig();

        // 广播通知
        const notification: RoomTypeConvertedMessage = {
            type: 'roomTypeConverted',
            newType: message.targetType,
            convertedBy: user.id
        };
        this.broadcast(notification);

        // 重新发送房间信息给所有用户
        this.broadcastRoomInfo();
    }

    private async handleKickUser(webSocket: WebSocket, message: KickUserMessage): Promise<void> {
        const actor = this.users.get(webSocket);
        if (!actor) return;

        const target = this.findUserById(message.targetUserId);
        if (!target) {
            this.sendError(webSocket, '目标用户不存在');
            return;
        }

        if (!this.canKickUser(actor, target)) {
            this.sendPermissionDenied(webSocket, 'kickUser', '您没有权限踢出此用户');
            return;
        }

        // 广播通知
        const notification: UserKickedMessage = {
            type: 'userKicked',
            targetUserId: message.targetUserId,
            kickedBy: actor.id,
            reason: message.reason
        };
        this.broadcast(notification);

        // 关闭目标用户的连接
        target.webSocket.close();
        this.handleDisconnect(target.webSocket);
    }

    private async handleBanUser(webSocket: WebSocket, message: BanUserMessage): Promise<void> {
        const actor = this.users.get(webSocket);
        if (!actor) return;

        if (!this.canBanUser(actor, message.targetUserId)) {
            this.sendPermissionDenied(webSocket, 'banUser', '您没有权限封禁此用户');
            return;
        }

        const target = this.findUserById(message.targetUserId);

        // 添加到封禁列表
        const banRecord: BanRecord = {
            type: message.banType,
            value: message.banType === 'keyFingerprint' ? message.targetUserId : (target?.ipAddress || { v4: 'unknown' }),
            bannedAt: Date.now(),
            bannedBy: actor.id,
            reason: message.reason
        };

        this.banList.push(banRecord);
        await this.saveBanList();

        // 广播通知
        const notification: UserBannedMessage = {
            type: 'userBanned',
            targetUserId: message.targetUserId,
            bannedBy: actor.id,
            banType: message.banType,
            reason: message.reason
        };
        this.broadcast(notification);

        // 如果用户在线，踢出
        if (target) {
            target.webSocket.close();
            this.handleDisconnect(target.webSocket);
        }
    }

    private async handleUnban(webSocket: WebSocket, message: UnbanMessage): Promise<void> {
        const actor = this.users.get(webSocket);
        if (!actor) return;

        if (!this.hasPermission(actor, Permission.BAN_USERS)) {
            this.sendPermissionDenied(webSocket, 'unban', '您没有权限解除封禁');
            return;
        }

        // 从封禁列表中移除
        this.banList = this.banList.filter(record => {
            if (record.type !== message.banType) return true;
            if (typeof record.value === 'string') {
                return record.value !== message.value;
            } else {
                return record.value.v4 !== message.value;
            }
        });

        await this.saveBanList();
    }

    private async handleChangeRole(webSocket: WebSocket, message: ChangeRoleMessage): Promise<void> {
        const actor = this.users.get(webSocket);
        if (!actor) return;

        const target = this.findUserById(message.targetUserId);
        if (!target) {
            this.sendError(webSocket, '目标用户不存在');
            return;
        }

        if (!this.canChangeRole(actor, target, message.newRole)) {
            this.sendPermissionDenied(webSocket, 'changeRole', '您没有权限修改此用户的角色');
            return;
        }

        const oldRole = target.role;
        target.role = message.newRole;

        // 广播通知
        const notification: RoleChangedMessage = {
            type: 'roleChanged',
            targetUserId: message.targetUserId,
            oldRole: oldRole,
            newRole: message.newRole,
            changedBy: actor.id
        };
        this.broadcast(notification);

        // 更新用户列表
        this.broadcastUserList();
    }

    private async handleGenerateInvite(webSocket: WebSocket, message: GenerateInviteMessage): Promise<void> {
        const actor = this.users.get(webSocket);
        if (!actor) return;

        if (!this.hasPermission(actor, Permission.GENERATE_INVITES)) {
            this.sendPermissionDenied(webSocket, 'generateInvite', '您没有权限生成邀请链接');
            return;
        }

        const inviteId = this.generateInviteCode();
        const invite: InviteLink = {
            id: inviteId,
            roomId: this.roomId,
            role: message.role,
            createdBy: actor.id,
            expiresAt: message.expiresIn ? Date.now() + message.expiresIn : undefined,
            usageCount: 0,
            maxUsage: message.maxUsage
        };

        this.invites.set(inviteId, invite);
        await this.saveInvites();

        // 构建完整URL（使用保存的origin）
        const fullUrl = `${this.origin}/?r=${this.roomId}&i=${inviteId}`;

        const response: InviteLinkGeneratedMessage = {
            type: 'inviteLinkGenerated',
            invite: {
                id: invite.id,
                role: invite.role,
                expiresAt: invite.expiresAt,
                maxUsage: invite.maxUsage,
                usageCount: invite.usageCount
            },
            fullUrl: fullUrl
        };

        webSocket.send(JSON.stringify(response));
    }

    private async handleUpdatePrivacyConfig(webSocket: WebSocket, message: UpdatePrivacyConfigMessage): Promise<void> {
        const actor = this.users.get(webSocket);
        if (!actor) return;

        if (!this.hasPermission(actor, Permission.UPDATE_PRIVACY_CONFIG)) {
            this.sendPermissionDenied(webSocket, 'updatePrivacyConfig', '只有Creator可以修改隐私配置');
            return;
        }

        if (!this.roomConfig) return;

        this.roomConfig.privacy = message.config;
        await this.saveRoomConfig();

        // 广播通知
        const notification: PrivacyConfigUpdatedMessage = {
            type: 'privacyConfigUpdated',
            config: message.config,
            updatedBy: actor.id
        };
        this.broadcast(notification);
    }

    private handleGetBanList(webSocket: WebSocket, message: GetBanListMessage): void {
        const user = this.users.get(webSocket);
        if (!user) return;

        if (!this.hasPermission(user, Permission.VIEW_BAN_LIST)) {
            this.sendPermissionDenied(webSocket, 'getBanList', '您没有权限查看封禁列表');
            return;
        }

        const response: BanListMessage = {
            type: 'banList',
            records: this.banList.map(record => ({
                type: record.type,
                value: typeof record.value === 'string' ? record.value : record.value.v4,
                bannedAt: record.bannedAt,
                bannedBy: record.bannedBy,
                reason: record.reason
            }))
        };

        webSocket.send(JSON.stringify(response));
    }

    private handleGetInviteLinks(webSocket: WebSocket, message: GetInviteLinksMessage): void {
        const user = this.users.get(webSocket);
        if (!user) return;

        if (!this.hasPermission(user, Permission.GENERATE_INVITES)) {
            this.sendPermissionDenied(webSocket, 'getInviteLinks', '您没有权限查看邀请链接');
            return;
        }

        const response: InviteLinksMessage = {
            type: 'inviteLinks',
            links: Array.from(this.invites.values())
        };

        webSocket.send(JSON.stringify(response));
    }

    private async handleDeleteInviteLink(webSocket: WebSocket, message: DeleteInviteLinkMessage): Promise<void> {
        const user = this.users.get(webSocket);
        if (!user) return;

        if (!this.hasPermission(user, Permission.GENERATE_INVITES)) {
            this.sendPermissionDenied(webSocket, 'deleteInviteLink', '您没有权限删除邀请链接');
            return;
        }

        this.invites.delete(message.inviteId);
        await this.saveInvites();
    }

    private async handleTransferCreator(webSocket: WebSocket, message: TransferCreatorMessage): Promise<void> {
        const actor = this.users.get(webSocket);
        if (!actor) return;

        if (!this.hasPermission(actor, Permission.TRANSFER_CREATOR)) {
            this.sendPermissionDenied(webSocket, 'transferCreator', '只有Creator可以转让身份');
            return;
        }

        const target = this.findUserById(message.targetUserId);
        if (!target) {
            this.sendError(webSocket, '目标用户不存在');
            return;
        }

        if (!this.roomConfig) return;

        const oldCreatorId = this.roomConfig.creatorId;

        // 更新角色
        actor.role = UserRole.ADMIN;
        target.role = UserRole.CREATOR;
        this.roomConfig.creatorId = target.id;

        await this.saveRoomConfig();

        // 广播通知
        const notification: CreatorTransferredMessage = {
            type: 'creatorTransferred',
            oldCreatorId: oldCreatorId,
            newCreatorId: target.id
        };
        this.broadcast(notification);

        // 更新用户列表
        this.broadcastUserList();
    }

    private async handleUpdateMessageCountConfig(webSocket: WebSocket, message: UpdateMessageCountConfigMessage): Promise<void> {
        const actor = this.users.get(webSocket);
        if (!actor) return;

        if (!this.hasPermission(actor, Permission.UPDATE_MESSAGE_COUNT_CONFIG)) {
            this.sendPermissionDenied(webSocket, 'updateMessageCountConfig', '只有Creator可以修改消息计数配置');
            return;
        }

        if (!this.roomConfig) return;

        this.roomConfig.enableMessageCount = message.enableMessageCount;
        this.roomConfig.messageCountVisibleToUser = message.messageCountVisibleToUser;
        this.roomConfig.messageCountVisibleToGuest = message.messageCountVisibleToGuest;

        // 如果启用消息计数，初始化计数器
        if (message.enableMessageCount && this.roomConfig.messageCount === undefined) {
            this.roomConfig.messageCount = 0;
        }

        await this.saveRoomConfig();

        // 广播通知
        const notification: MessageCountConfigUpdatedMessage = {
            type: 'messageCountConfigUpdated',
            enableMessageCount: message.enableMessageCount,
            messageCountVisibleToUser: message.messageCountVisibleToUser,
            messageCountVisibleToGuest: message.messageCountVisibleToGuest,
            updatedBy: actor.id
        };
        this.broadcast(notification);
    }

    // ========== 消息和用户列表处理 ==========

    private handleGetUsers(webSocket: WebSocket): void {
        const user = this.users.get(webSocket);
        if (!user) return;

        // 检查查看用户列表权限
        if (!this.hasPermission(user, Permission.VIEW_USER_LIST)) {
            // Guest 无权限时只返回自己
            const response: UserListMessage = {
                type: 'userList',
                users: [{
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    publicKey: user.publicKey,
                    role: user.role
                }]
            };
            webSocket.send(JSON.stringify(response));
            return;
        }

        const users = Array.from(this.users.values()).map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            publicKey: u.publicKey,
            role: u.role
        }));

        const response: UserListMessage = {
            type: 'userList',
            users: users
        };

        webSocket.send(JSON.stringify(response));
    }

    private async handleChatMessage(webSocket: WebSocket, message: ChatMessage): Promise<void> {
        const sender = this.users.get(webSocket);
        if (!sender) {
            this.sendError(webSocket, 'User not registered');
            return;
        }

        if (!this.hasPermission(sender, Permission.SEND_MESSAGES)) {
            this.sendPermissionDenied(webSocket, 'sendMessage', '您没有权限发送消息');
            return;
        }

        if (!message.encryptedData || typeof message.encryptedData !== 'string') {
            this.sendError(webSocket, 'Invalid encrypted data format');
            return;
        }

        // 验证加密消息格式
        if (!this.isValidPGPMessage(message.encryptedData)) {
            this.sendError(webSocket, 'Invalid PGP message format');
            return;
        }

        // 广播加密消息
        const broadcastMessage: EncryptedMessage = {
            type: 'encryptedMessage',
            senderId: sender.id,
            encryptedData: message.encryptedData,
            timestamp: Date.now()
        };

        this.broadcast(broadcastMessage);

        // 递增消息计数（如果启用）
        if (this.roomConfig && this.roomConfig.enableMessageCount) {
            this.roomConfig.messageCount = (this.roomConfig.messageCount || 0) + 1;
            await this.saveRoomConfig();
        }
    }

    private async handleDisconnect(webSocket: WebSocket): Promise<void> {
        this.sessions.delete(webSocket);
        this.users.delete(webSocket);

        // 向其他用户广播用户列表更新
        this.broadcastUserList();

        // 当房间内没有用户时,清空所有持久化数据
        if (this.users.size === 0) {
            await this.clearAllData();
        }
    }

    private async clearAllData(): Promise<void> {
        // 清空内存数据
        this.roomConfig = null;
        this.invites.clear();
        this.banList = [];
        this.origin = '';

        // 清空持久化存储
        await this.state.storage.deleteAll();
    }

    private broadcast(message: any): void {
        const messageStr = JSON.stringify(message);
        for (const [ws, user] of this.users) {
            // 检查用户是否有权限接收此消息
            if (message.type === 'encryptedMessage') {
                if (!this.hasPermission(user, Permission.VIEW_MESSAGES)) {
                    continue;
                }
            }

            try {
                ws.send(messageStr);
            } catch (error) {
                // 连接已关闭，清理
                this.sessions.delete(ws);
                this.users.delete(ws);
            }
        }
    }

    private broadcastUserList(): void {
        for (const [ws, user] of this.users) {
            this.handleGetUsers(ws);
        }
    }

    private broadcastRoomInfo(): void {
        if (!this.roomConfig) return;

        for (const [ws, user] of this.users) {
            const roomInfo: RoomInfoMessage = {
                type: 'roomInfo',
                roomType: this.roomConfig.type,
                isCreator: user.id === this.roomConfig.creatorId,
                yourRole: user.role,
                privacy: this.roomConfig.privacy
            };

            // 根据权限添加消息计数
            if (this.canViewMessageCount(user)) {
                roomInfo.messageCount = this.roomConfig.messageCount || 0;
            }

            ws.send(JSON.stringify(roomInfo));
        }
    }

    private sendError(webSocket: WebSocket, message: string): void {
        const errorMessage: ErrorMessage = {
            type: 'error',
            message: message
        };

        try {
            webSocket.send(JSON.stringify(errorMessage));
        } catch (error) {
            // 连接已关闭，忽略错误
        }
    }

    private sendPermissionDenied(webSocket: WebSocket, action: string, reason: string): void {
        const message: PermissionDeniedMessage = {
            type: 'permissionDenied',
            action: action,
            reason: reason
        };

        try {
            webSocket.send(JSON.stringify(message));
        } catch (error) {
            // 连接已关闭，忽略错误
        }
    }

    // ========== 封禁检查 ==========

    private isUserBanned(userFingerprint: string, ipAddress?: IP): boolean {
        for (const record of this.banList) {
            if (record.type === 'keyFingerprint' && record.value === userFingerprint) {
                return true;
            }
            if (record.type === 'ip' && ipAddress && typeof record.value !== 'string') {
                if (record.value.v4 === ipAddress.v4) {
                    return true;
                }
            }
        }
        return false;
    }

    // ========== 持久化存储 ==========

    private async loadRoomConfig(): Promise<void> {
        const config = await this.state.storage.get<RoomConfig>('config');
        if (config) {
            this.roomConfig = config;
        }
    }

    private async saveRoomConfig(): Promise<void> {
        if (this.roomConfig) {
            await this.state.storage.put('config', this.roomConfig);
        }
    }

    private async loadInvites(): Promise<void> {
        const invites = await this.state.storage.get<Record<string, InviteLink>>('invites');
        if (invites) {
            this.invites = new Map(Object.entries(invites));
        }
    }

    private async saveInvites(): Promise<void> {
        const invitesObj = Object.fromEntries(this.invites);
        await this.state.storage.put('invites', invitesObj);
    }

    private async loadBanList(): Promise<void> {
        const banListData = await this.state.storage.get<{ records: BanRecord[] }>('banList');
        if (banListData) {
            this.banList = banListData.records;
        }
    }

    private async saveBanList(): Promise<void> {
        await this.state.storage.put('banList', { records: this.banList });
    }

    // ========== 工具方法 ==========

    private findUserById(id: string): UserInfo | undefined {
        for (const user of this.users.values()) {
            if (user.id === id) {
                return user;
            }
        }
        return undefined;
    }

    private isValidPGPPublicKey(publicKey: string): boolean {
        return publicKey.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----') &&
               publicKey.includes('-----END PGP PUBLIC KEY BLOCK-----');
    }

    private isValidPGPMessage(message: string): boolean {
        return message.includes('-----BEGIN PGP MESSAGE-----') &&
               message.includes('-----END PGP MESSAGE-----');
    }

    private async extractUserProfile(publicKeyArmored: string): Promise<UserProfile> {
        try {
            // 解析公钥
            const publicKey = await readKey({ armoredKey: publicKeyArmored });

            // 获取主用户ID
            const primaryUser = await publicKey.getPrimaryUser();
            const userID = primaryUser.user.userID;

            let name = '';
            let email = '';
            let id = '';

            if (userID) {
                const userIdString = userID.userID || '';
                const match = userIdString.match(/^(.+?)\s*<([^>]+)>$/);

                if (match) {
                    name = match[1].trim();
                    email = match[2].trim();
                } else {
                    if (userIdString.includes('@')) {
                        email = userIdString.trim();
                        name = email.split('@')[0];
                    } else {
                        name = userIdString.trim();
                    }
                }
            }

            id = publicKey.getFingerprint().toUpperCase();

            if (!name) {
                name = `User_${Math.random().toString(36).substr(2, 8)}`;
            }
            if (!email) {
                email = `${name.toLowerCase().replace(/\s+/g, '')}@example.com`;
            }

            return { id, name, email };

        } catch (error) {
            console.error('解析公钥时出错:', error);
            return this.fallbackExtractUserProfile(publicKeyArmored);
        }
    }

    private fallbackExtractUserProfile(publicKey: string): UserProfile {
        const lines = publicKey.split('\n');
        let name = `User_${Math.random().toString(36).substr(2, 8)}`;
        let email = `${name.toLowerCase()}@example.com`;
        let id = this.generateUserIdFromKey(publicKey);

        for (const line of lines) {
            if (line.includes('Comment:') || line.includes('Name:')) {
                const match = line.match(/([\w\s]+)\s*<([^>]+)>/);
                if (match) {
                    name = match[1].trim();
                    email = match[2].trim();
                }
            }
        }

        return { id, name, email };
    }

    private generateUserIdFromKey(publicKey: string): string {
        let hash = 0;
        for (let i = 0; i < publicKey.length; i++) {
            const char = publicKey.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }
}
