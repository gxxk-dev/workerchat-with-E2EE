// ========================
// 心跳机制
// ========================

function startHeartbeat() {
    // 清除已存在的定时器
    stopHeartbeat();

    // 每50秒发送一次ping
    heartbeatInterval = setInterval(() => {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            debugLog('发送心跳ping');
            websocket.send(JSON.stringify({ type: 'ping' }));

            // 设置15秒超时,如果没收到pong就认为连接断开
            heartbeatTimeout = setTimeout(() => {
                debugLog('心跳超时,关闭连接');
                websocket.close();
            }, 15000);
        }
    }, 50000);
}

function resetHeartbeatTimeout() {
    if (heartbeatTimeout) {
        clearTimeout(heartbeatTimeout);
        heartbeatTimeout = null;
    }
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    if (heartbeatTimeout) {
        clearTimeout(heartbeatTimeout);
        heartbeatTimeout = null;
    }
}
