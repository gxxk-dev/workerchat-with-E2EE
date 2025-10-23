// ========================
// 全局状态管理
// ========================

// 密钥和用户信息
let privateKey = '';
let publicKey = '';
let userId = ''; // 服务器返回的用户ID,用于消息识别
let userFingerprint = ''; // 本地密钥指纹(long key ID),用于显示
let userName = '';
let userEmail = '';
let hasInitializedKeyId = false; // 标志:确保密钥指纹只加载一次

// WebSocket 连接
let websocket = null;
let roomId = '';
let inviteId = ''; // 邀请码

// 用户管理
let users = new Map();

// 重连机制
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;

// 设备类型
let isMobile = null; // 占位符 具体判断看后面util部分的getter

// 心跳机制
let heartbeatInterval = null; // 心跳定时器
let heartbeatTimeout = null; // 心跳超时定时器

// 房间信息
let roomInfo = {
    roomType: 'public',
    isCreator: false,
    yourRole: 'user',
    privacy: null
};

// 回复功能相关状态
let replyingTo = null; // 当前正在回复的消息 { senderId, messageNumber, timestamp, text }
let messageCache = new Map(); // 缓存最近的解密消息，用于回复预览 (key: timestamp_senderId, value: { senderId, text, timestamp, messageNumber })
const MAX_CACHE_SIZE = 100; // 最多缓存100条消息

// 同步消息通知
let syncNotificationTimers = new Map(); // 跟踪同步消息通知的定时器 (key: syncedBy userId, value: { count, timer })
const SYNC_NOTIFICATION_DELAY = 2000; // 2秒内收到的同步消息合并显示

// DOM元素
const userListEl = document.getElementById('userList');
const messagesEl = document.getElementById('messages');
const messageInputEl = document.getElementById('messageInput');
const sendButtonEl = document.getElementById('sendButton');
const generateKeysBtn = document.getElementById('generateKeys');
const importPublicKeyBtn = document.getElementById('importPublicKey');
const importPrivateKeyBtn = document.getElementById('importPrivateKey');
const copyPublicKeyBtn = document.getElementById('copyPublicKey');
const keyIdEl = document.getElementById('keyId');
const notificationEl = document.getElementById('notification');
const debugInfoEl = document.getElementById('debugInfo');
const connectionStatusEl = document.getElementById('connectionStatus');
const roomUrlEl = document.getElementById('roomUrl');
const manageArea = document.querySelector('.manage-area');
const overlayEl = document.getElementById('overlay');
