// ========== 枚举定义 ==========

// 房间类型
export enum RoomType {
    PUBLIC = 'public',
    PRIVATE = 'private'
}

// 用户角色（新增 CREATOR）
export enum UserRole {
    CREATOR = 'creator',  // 最高权限
    ADMIN = 'admin',
    USER = 'user',
    GUEST = 'guest'
}

// 权限枚举
export enum Permission {
    VIEW_MESSAGES = 'view_messages',
    VIEW_USER_LIST = 'view_user_list',
    SEND_MESSAGES = 'send_messages',
    KICK_USERS = 'kick_users',
    BAN_USERS = 'ban_users',
    CHANGE_ROLES = 'change_roles',
    GENERATE_INVITES = 'generate_invites',
    VIEW_BAN_LIST = 'view_ban_list',
    CONVERT_ROOM_TYPE = 'convert_room_type',         // 只有 Creator
    UPDATE_PRIVACY_CONFIG = 'update_privacy_config',  // 只有 Creator
    UPDATE_MESSAGE_COUNT_CONFIG = 'update_message_count_config',  // 只有 Creator
    TRANSFER_CREATOR = 'transfer_creator'             // 只有 Creator（可选）
}

// ========== 基础接口 ==========

// IP(含v6/v4支持)
export interface IP {
    v6?: string;
    v4: string;
}

// 房间配置（删除 createdAt）
export interface RoomConfig {
    type: RoomType;
    creatorId: string;  // Creator的密钥指纹
    privacy?: PrivacyConfig;  // 仅 Private 房间使用
    enableMessageCount?: boolean;  // 是否启用消息计数
    messageCount?: number;  // 当前消息总数
    messageCountVisibleToUser?: boolean;  // User 是否可见消息计数
    messageCountVisibleToGuest?: boolean;  // Guest 是否可见消息计数
}

// 隐私配置
export interface PrivacyConfig {
    guestCanViewMessages: boolean;   // Guest 能否接收消息广播
    guestCanViewUserList: boolean;   // Guest 能否看到完整用户列表
    requireInviteToJoin: boolean;    // 是否必须通过邀请链接才能加入
}

// 邀请链接（缩短 ID）
export interface InviteLink {
    id: string;              // 8字符邀请码
    roomId: string;          // 10字符房间ID
    role: UserRole;          // 加入后的角色
    createdBy: string;       // Creator密钥指纹
    expiresAt?: number;      // 过期时间戳（可选）
    usageCount: number;      // 已使用次数
    maxUsage?: number;       // 最大使用次数（可选）
}

// 封禁记录（增强）
export interface BanRecord {
    type: 'ip' | 'keyFingerprint';
    value: IP | string;
    bannedAt: number;      // 封禁时间戳
    bannedBy: string;      // 封禁者密钥指纹
    reason?: string;       // 封禁原因
}

// 用户信息（修改）
export interface UserInfo {
    id: string;
    name: string;
    email: string;
    publicKey: string;
    webSocket: WebSocket;
    role: UserRole;        // Public 房间：USER 或 CREATOR
    ipAddress?: IP;
}

// 用户信息
export interface UserProfile {
    id: string; // 即keyid(long)
    name: string;
    email: string;
}

// 回复信息
export interface ReplyInfo {
    senderId: string;           // 被回复消息的发送者ID
    messageNumber?: number;     // 被回复消息的编号
    timestamp: number;          // 被回复消息的时间戳
}

// 同步信息
export interface SyncInfo {
    originalSenderId: string;       // 原始发送者ID
    originalTimestamp: number;      // 原始消息时间戳
    originalMessageNumber?: number; // 原始消息编号（如果有）
    syncedBy: string;               // 同步者ID
}

// ========== 客户端 -> 服务器 消息 ==========

// 注册（新增 inviteId）
export interface RegisterMessage {
    type: 'register';
    publicKey: string;
    inviteId?: string;     // 邀请码（从 URL 参数获取）
}

// 质询响应（客户端解密质询后发送）
export interface ChallengeResponseMessage {
    type: 'challengeResponse';
    response: string;      // 解密后的质询字符串
}

// 转换房间类型
export interface ConvertRoomTypeMessage {
    type: 'convertRoomType';
    targetType: RoomType;
}

// 踢出用户（只需 ID，不需要 name）
export interface KickUserMessage {
    type: 'kickUser';
    targetUserId: string;
    reason?: string;
}

// 封禁用户
export interface BanUserMessage {
    type: 'banUser';
    targetUserId: string;
    banType: 'ip' | 'keyFingerprint';
    reason?: string;
}

// 解除封禁
export interface UnbanMessage {
    type: 'unban';
    banType: 'ip' | 'keyFingerprint';
    value: string;  // IP地址或密钥指纹
}

// 修改用户角色
export interface ChangeRoleMessage {
    type: 'changeRole';
    targetUserId: string;
    newRole: UserRole;
}

// 生成邀请链接
export interface GenerateInviteMessage {
    type: 'generateInvite';
    role: UserRole;
    expiresIn?: number;  // 过期时间（毫秒）
    maxUsage?: number;   // 最大使用次数
}

// 更新隐私配置（仅 Creator）
export interface UpdatePrivacyConfigMessage {
    type: 'updatePrivacyConfig';
    config: PrivacyConfig;
}

// 更新消息计数配置（仅 Creator）
export interface UpdateMessageCountConfigMessage {
    type: 'updateMessageCountConfig';
    enableMessageCount: boolean;
    messageCountVisibleToUser: boolean;
    messageCountVisibleToGuest: boolean;
}

// 获取封禁列表
export interface GetBanListMessage {
    type: 'getBanList';
}

// 获取邀请链接列表
export interface GetInviteLinksMessage {
    type: 'getInviteLinks';
}

// 删除邀请链接
export interface DeleteInviteLinkMessage {
    type: 'deleteInviteLink';
    inviteId: string;
}

// 转让 Creator 身份（可选功能）
export interface TransferCreatorMessage {
    type: 'transferCreator';
    targetUserId: string;
}

// 聊天消息
export interface ChatMessage {
    type: 'message';
    encryptedData: string;
    replyTo?: ReplyInfo;        // 可选的回复信息
    syncedFrom?: SyncInfo;       // 可选的同步信息
    targetUserIds?: string[];    // 可选的目标用户ID列表（用于同步）
}

// ========== 服务器 -> 客户端 消息 ==========

// 身份验证质询（服务端发送加密质询）
export interface AuthChallengeMessage {
    type: 'authChallenge';
    encryptedChallenge: string;  // 使用用户公钥加密的质询
}

// 注册成功（新增 assignedRole）
export interface RegisteredMessage {
    type: 'registered';
    profile: UserProfile;
    assignedRole: UserRole;  // 服务器分配的角色
}

// 房间信息（连接后立即发送）
export interface RoomInfoMessage {
    type: 'roomInfo';
    roomType: RoomType;
    isCreator: boolean;    // 当前用户是否为Creator
    yourRole: UserRole;    // 你的角色
    privacy?: PrivacyConfig; // 隐私配置（仅 Private 房间）
    messageCount?: number; // 当前消息总数（根据权限返回）
    enableMessageCount?: boolean; // 是否启用消息计数（仅Creator可见）
    messageCountVisibleToUser?: boolean; // User是否可见消息计数（仅Creator可见）
    messageCountVisibleToGuest?: boolean; // Guest是否可见消息计数（仅Creator可见）
}

// 房间类型已转换
export interface RoomTypeConvertedMessage {
    type: 'roomTypeConverted';
    newType: RoomType;
    convertedBy: string;  // 只返回 userId
}

// 用户被踢出通知（只返回 userId，客户端查询 name）
export interface UserKickedMessage {
    type: 'userKicked';
    targetUserId: string;
    kickedBy: string;
    reason?: string;
}

// 用户被封禁通知
export interface UserBannedMessage {
    type: 'userBanned';
    targetUserId: string;
    bannedBy: string;
    banType: 'ip' | 'keyFingerprint';
    reason?: string;
}

// 角色变更通知
export interface RoleChangedMessage {
    type: 'roleChanged';
    targetUserId: string;
    oldRole: UserRole;
    newRole: UserRole;
    changedBy: string;
}

// 邀请链接已生成
export interface InviteLinkGeneratedMessage {
    type: 'inviteLinkGenerated';
    invite: {
        id: string;
        role: UserRole;
        expiresAt?: number;
        maxUsage?: number;
        usageCount: number;
    };
    fullUrl: string;  // 完整URL：https://example.com/?r=xxx&i=yyy
}

// 封禁列表响应
export interface BanListMessage {
    type: 'banList';
    records: Array<{
        type: 'ip' | 'keyFingerprint';
        value: string;
        bannedAt: number;
        bannedBy: string;
        reason?: string;
    }>;
}

// 邀请链接列表响应
export interface InviteLinksMessage {
    type: 'inviteLinks';
    links: InviteLink[];
}

// 隐私配置已更新
export interface PrivacyConfigUpdatedMessage {
    type: 'privacyConfigUpdated';
    config: PrivacyConfig;
    updatedBy: string;
}

// 消息计数配置已更新
export interface MessageCountConfigUpdatedMessage {
    type: 'messageCountConfigUpdated';
    enableMessageCount: boolean;
    messageCountVisibleToUser: boolean;
    messageCountVisibleToGuest: boolean;
    updatedBy: string;
}

// Creator 已转让
export interface CreatorTransferredMessage {
    type: 'creatorTransferred';
    oldCreatorId: string;
    newCreatorId: string;
}

// 权限拒绝
export interface PermissionDeniedMessage {
    type: 'permissionDenied';
    action: string;
    reason: string;
}

// 用户列表（扩展）
export interface UserListMessage {
    type: 'userList';
    users: Array<{
        id: string;
        name: string;
        email: string;
        publicKey: string;
        role: UserRole;  // 所有房间都返回角色
    }>;
}

// 加密信息
export interface EncryptedMessage {
    type: 'encryptedMessage';
    senderId: string;
    encryptedData: string;
    timestamp: number;
    messageNumber?: number; // 消息编号，可选字段保持向后兼容
    replyTo?: ReplyInfo;    // 可选的回复信息
    syncedFrom?: SyncInfo;   // 可选的同步信息
}

// 系统提示消息
export interface SystemMessage {
    type: 'systemMessage';
    content: string;
    timestamp: number;
    messageType: 'userJoined' | 'userReconnected' | 'userDisconnected' | 'newbieGuide' | 'info';
}

// 错误消息
export interface ErrorMessage {
    type: 'error';
    message: string;
}

// ========== 角色权限配置 ==========

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    [UserRole.CREATOR]: [
        Permission.VIEW_MESSAGES,
        Permission.VIEW_USER_LIST,
        Permission.SEND_MESSAGES,
        Permission.KICK_USERS,
        Permission.BAN_USERS,
        Permission.CHANGE_ROLES,
        Permission.GENERATE_INVITES,
        Permission.VIEW_BAN_LIST,
        Permission.CONVERT_ROOM_TYPE,        // 独有
        Permission.UPDATE_PRIVACY_CONFIG,    // 独有
        Permission.UPDATE_MESSAGE_COUNT_CONFIG,  // 独有
        Permission.TRANSFER_CREATOR          // 独有
    ],
    [UserRole.ADMIN]: [
        Permission.VIEW_MESSAGES,
        Permission.VIEW_USER_LIST,
        Permission.SEND_MESSAGES,
        Permission.KICK_USERS,
        Permission.BAN_USERS,
        Permission.CHANGE_ROLES,
        Permission.GENERATE_INVITES,
        Permission.VIEW_BAN_LIST
    ],
    [UserRole.USER]: [
        Permission.VIEW_MESSAGES,
        Permission.VIEW_USER_LIST,
        Permission.SEND_MESSAGES
    ],
    [UserRole.GUEST]: [
        Permission.VIEW_MESSAGES,      // 受限于 privacy.guestCanViewMessages
        Permission.VIEW_USER_LIST      // 受限于 privacy.guestCanViewUserList
    ]
};
