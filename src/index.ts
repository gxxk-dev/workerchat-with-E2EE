export { ChatRoom } from "./ChatRoom";

export interface Env {
    CHAT_ROOMS: DurableObjectNamespace;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        
        // 处理 CORS 预检请求
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                }
            });
        }

        // 创建房间 API
        if (url.pathname === '/api/room' && request.method === 'POST') {
            try {
                // 生成10字符的短房间ID
                const roomId = generateRoomId();
                
                return new Response(roomId, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/plain',
                        'Access-Control-Allow-Origin': '*',
                    }
                });
            } catch (error) {
                return new Response('Internal Server Error', {
                    status: 500,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    }
                });
            }
        }

        // WebSocket 连接处理（支持Unicode房间ID）
        const match = url.pathname.match(/^\/api\/room\/([^/]+)\/websocket$/);
        if (match && request.headers.get('Upgrade') === 'websocket') {
            // 解码URL中的房间ID（支持Unicode字符）
            let roomId: string;
            try {
                roomId = decodeURIComponent(match[1]);
            } catch (error) {
                return new Response('Invalid room ID encoding', {
                    status: 400,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    }
                });
            }

            // 验证房间ID
            if (!roomId || roomId.length === 0 || roomId.length > 256) {
                return new Response('Invalid room ID: must be between 1 and 256 characters', {
                    status: 400,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    }
                });
            }

            // 获取或创建 Durable Object 实例(指定在亚太区域创建)
            const durableObjectId = env.CHAT_ROOMS.idFromName(roomId);
            const durableObject = env.CHAT_ROOMS.get(durableObjectId, { locationHint: "apac" });

            // 转发 WebSocket 请求到 Durable Object
            return durableObject.fetch(request);
        }

        // 404 处理
        return new Response('Not Found', { status: 404 });
    }
};

// 生成10字符的短房间ID（base62编码）
function generateRoomId(): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const length = 10;
    let result = '';
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    for (let i = 0; i < length; i++) {
        result += chars[randomBytes[i] % chars.length];
    }
    return result;
}

// 生成8字符的邀请码（base62编码）
export function generateInviteCode(): string {
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