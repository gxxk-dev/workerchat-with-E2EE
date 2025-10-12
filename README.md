# workerchat-with-E2EE

一个基于 Cloudflare Workers 和 OpenPGP 的极简端到端加密聊天室应用。

## 声明

本项目由 Era Code 提供支持。Era Code 是一款位于您的终端中的可「真正理解您的代码库」的编码工具。

## ✨ 特性

- 🔒 **端到端加密** - 使用 PGP 协议确保消息安全
- 🌐 **无服务器架构** - 基于 Cloudflare Workers 和 Durable Objects
- 🔑 **密钥管理** - 支持生成、导入和导出 PGP 密钥
- 💬 **实时通信** - WebSocket 实现实时消息传输
- 📱 **响应式布局** - 适配移动设备

## 🚀 快速开始

### 部署到 Cloudflare Workers
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/gxxk-dev/workerchat-with-E2EE.git)

### 本地运行
`git clone`后`npm run dev`即可运行

## 💻 使用说明

1. **创建/加入聊天室** - 访问部署域名，系统自动创建房间或通过 URL 参数加入指定房间
2. **密钥管理** - 生成密钥对或导入现有密钥，支持导出公钥分享
3. **发送消息** - 消息自动端到端加密，确保通信安全
4. **移动端** - 点击标题可展开设置面板，方便操作

## 🛠️ 技术栈

- **后端**: Cloudflare Workers + Durable Objects + WebSocket
- **前端**: 原生 JavaScript + OpenPGP.js + CSS3

## 🔐 安全特性

- 消息在客户端加密，服务器无法读取明文
- 私钥仅存储在用户浏览器本地(localStorage)
- WSS 加密传输

## 📄 许可证

本项目以 AGPLv3(orlater) 许可证发布，欢迎贡献代码和提出建议。