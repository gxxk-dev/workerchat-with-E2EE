# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an end-to-end encrypted chat room application built on Cloudflare Workers with OpenPGP encryption. The application provides secure real-time messaging where messages are encrypted on the client side and the server cannot read the plaintext.

## Architecture

### Backend (Cloudflare Workers)
- **Entry Point**: `src/index.ts` - Main worker that handles HTTP requests and WebSocket upgrades
- **Core Logic**: `src/ChatRoom.ts` - Durable Object class that manages chat room state, user connections, and message routing
- **Type Definitions**: `src/models.ts` - Shared interfaces and enums for user roles, permissions, messages, and data structures

### Frontend (Single Page Application)
- **Main Interface**: `public/index.html` - Complete SPA with Tailwind CSS styling
- **Mobile Redirect**: `public/wap.html` - Simple redirect to main interface  
- Uses OpenPGP.js for client-side encryption/decryption
- Tailwind CSS for responsive design and styling with CDN integration
- Vanilla JavaScript with responsive design and mobile adaptations

### Key Components

1. **Durable Objects**: Each chat room is a separate Durable Object instance identified by a 64-character room ID
2. **WebSocket Communication**: Real-time messaging through WebSocket connections managed by the ChatRoom class
3. **PGP Encryption**: End-to-end encryption using OpenPGP with user-generated key pairs
4. **User Management**: Role-based system (Guest, User, Admin) with permission controls
5. **Session Handling**: WebSocket connections are tracked per user with reconnection support

## Development Commands

```bash
# Local development server
npm run dev
# or 
npm start

# Deploy to Cloudflare Workers  
npm run deploy

# Generate TypeScript types for Cloudflare Workers
npm run cf-typegen
```

## Configuration Files

- `wrangler.jsonc` - Cloudflare Workers configuration with Durable Object bindings
- `tsconfig.json` - TypeScript configuration for ES2021 with strict mode
- `worker-configuration.d.ts` - Generated TypeScript definitions for Workers runtime

## Key Implementation Details

### Message Flow
1. Users connect via WebSocket to `/api/room/{roomId}/websocket`
2. Registration requires a valid PGP public key
3. Messages are encrypted client-side before sending to the server
4. Server routes encrypted messages to all connected users in the room
5. Recipients decrypt messages using their private keys stored locally

### Security Features
- Private keys never leave the client browser (stored in localStorage)
- All message content is encrypted end-to-end
- Server only handles routing of encrypted data
- PGP key validation and user profile extraction from public keys
- WebSocket Secure (WSS) transport encryption

### Room Management
- Room IDs are 64-character random strings
- New rooms created via POST `/api/room`
- Rooms are implemented as Durable Objects for global consistency
- User state persists within each room instance

## File Structure

```
src/
├── index.ts        # Main worker entry point and request routing
├── ChatRoom.ts     # Durable Object for chat room logic
└── models.ts       # TypeScript interfaces and types

public/
├── index.html      # Complete frontend application
└── wap.html        # Mobile redirect page
```

## Development Notes

- This is a TypeScript project with strict type checking enabled
- Uses Cloudflare Workers runtime APIs and Durable Objects
- Frontend is a single HTML file with embedded styles and scripts
- No build process required - direct deployment of source files
- OpenPGP.js loaded from CDN for encryption functionality