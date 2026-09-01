---
title: WebSocket 通信
description: ClassIntra WebSocket 通信系统，包含连接流程（URL、JWT 鉴权、心跳、重连）、消息类型表格（public/private/group/broadcast）、中继 Relay 系统架构、跨班级消息同步机制、前端 WebSocket 客户端（utils/websocket.js）以及消息速率限制。
---

# 实时通信

ClassIntra 的实时通信同时支持 WebSocket 和 HTTP 长轮询。现代浏览器优先使用 WebSocket；腾讯 X5、TBS、旧版 Android WebView 或 WebSocket 握手失败时使用 HTTP。后端 `ws/chat-server.js` 负责聊天连接，`realtime-bus.js` 提供不依赖 Chat 应用的第三方扩展实时事件通道。

源码位置：`server/src/ws/chat-server.js`、`client/src/utils/websocket.js`、`server/src/utils/relay-bus.js`

## 连接流程

### URL 与端口

| 服务 | 默认端口 | 配置项 | 说明 |
|------|----------|--------|------|
| 主 WebSocket 服务 | `10001` | `config.wsPort` / `WS_PORT` | 处理客户端连接、消息广播 |
| Relay 中继服务 | `10011` | `config.relayPort` / `RELAY_PORT` | 跨服务器中继（可选） |

URL 格式：`ws(s)://<host>:<port>/?token=<JWT>`（HTTPS 模式下使用 `wss://`）

### JWT 鉴权

客户端在连接 URL 中携带 `token` 参数，服务端在 `wss.on('connection')` 中通过 `jwtUtil.verifyToken` 验证：

```
客户端：new WebSocket('ws://host:10001/?token=' + encodeURIComponent(token))
    ↓
服务端：wss.on('connection', function(ws, req) { ... })
    ↓
1. 从 req.url 解析 token 参数
    ↓
2. jwtUtil.verifyToken(token) → { valid, data }
    ↓
3. 失败：ws.close(4001, '未授权')，记录日志
    ↓
4. 成功：req.user = data，加入 clients 字典
    ↓
5. 发送 { type: 'connected', user_info, online_users } 确认
```

::: warning token 来源
客户端从 `localStorage.getItem('token')` 读取 JWT，附加到 WebSocket URL。token 由 `POST /api/auth/login` 或 `POST /api/auth/register` 返回，同时通过 httpOnly cookie 设置。详见 [认证与权限](./auth)。
:::

### 心跳机制

| 方向 | 间隔 | 实现 |
|------|------|------|
| 客户端 → 服务端 | `30s` | `WebSocketManager.heartbeatInterval = 30000`，发送 `{ type: 'ping' }` |
| 服务端 → 客户端 | 即时响应 | 收到 ping 立即回 `{ type: 'pong' }` |

客户端若 `30s` 未收到 pong，标记 `_lastPongReceived = false`，触发重连。

### 重连机制

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `maxReconnectAttempts` | `10` | 最大重连次数 |
| `reconnectDelay` | `3000` | 重连延迟（毫秒） |
| `connectTimeout` | `10000` | 连接超时（毫秒） |

```
连接关闭
    ↓
reconnectAttempts < maxReconnectAttempts ?
    ├─ 是 → scheduleReconnect() → 重连
    └─ 否 → 切换到 HTTP 长轮询（_switchToPolling）
```

::: tip HTTP 长轮询回退
当 WebSocket 不可用（浏览器不支持或重连超过 10 次）时，`WebSocketManager` 自动切换到 `_transport = 'poll'` 模式，通过 HTTP 长轮询保持消息收发能力。这确保在严格受限网络环境下仍能使用聊天功能。
:::

## 第三方扩展 HTTP 通道

市场应用通过 `context.realtime` 使用全局 HTTP 实时事件，不应自行调用 `new WebSocket()`：

```javascript
var stop = context.realtime.subscribe('plugin.updated', function(payload) {
  console.log('扩展更新:', payload);
});

context.realtime.publish('plugin.updated', { version: '1.0.1' }, context.appName);
stop();
```

该通道的接口位于 `/api/realtime`，需要 JWT 鉴权。扩展事件与 Chat 应用解耦，即使 Chat 应用未启用，第三方扩展仍可使用 HTTP 实时通信。

## 消息类型表格

ClassIntra WebSocket 消息分为以下类型，均通过 `data.type` 字段区分：

| 消息类型 | `data.type` | 方向 | 说明 |
|----------|-------------|------|------|
| 连接确认 | `connected` | 服务端 → 客户端 | 鉴权成功后发送，携带 `user_info` / `online_users` |
| 公共聊天 | `new_message` | 双向 | 公共聊天室消息（`room_id = 'public'`） |
| 私聊 | `private_message` | 双向 | 一对一私聊消息 |
| 群聊 | `group_message` | 双向 | 群聊消息（班级群 `class_CC` 或自定义群） |
| 消息撤回 | `message_recalled` | 服务端 → 客户端 | 撤回通知（公共/私聊/群聊通用） |
| 在线状态 | `user_online` / `user_offline` | 服务端 → 客户端 | 用户上下线广播 |
| 心跳 | `ping` / `pong` | 双向 | 保活探测 |
| 系统通知 | `system_notification` | 服务端 → 客户端 | 封禁、应用更新、权限变更、天气预警 |
| 广播 | `broadcast` | 服务端 → 客户端 | 管理员全局广播 |

### public（公共聊天）

存储表：`chat_messages`（`room_id = 'public'`）。所有登录用户可见，广播给 `clients` 字典中所有在线用户（排除发送者）。

### private（私聊）

存储表：`private_messages`（含 `sender_id` / `receiver_id` / `read` 字段）。仅推送给 `receiver_id` 对应的客户端。

### group（群聊）

存储表：`group_messages`。班级群（`class_CC` 格式）通过 `canUserSeeGroup` 校验班级归属：

- **班级群**：用户只能看到自己班级的群聊（班管 `YYCC00` 仅看本班，普通学生 `YYCCNN` 取 `CC` 比对）
- **非班级群**：所有群成员可见

### broadcast（广播）

管理员通过 `POST /api/admin/broadcast` 发布，通过 WebSocket `{ type: 'broadcast' }` 推送给所有在线用户。

## 中继（Relay）系统架构

中继系统用于跨服务器（跨班级）消息同步，典型场景：多个班级各自部署一台 ClassIntra 服务器，通过 Relay 实现公共聊天室实时同步。

```
┌─────────────────────────────────────────────────────────────┐
│  班级 A 服务器（RELAY_SERVER_ID = server-aaa）               │
│  - 主 WebSocket 端口 10001                                    │
│  - Relay 端口 10011                                          │
│  - clients: { user1, user2, ... }                            │
└─────────────────────────────────────────────────────────────┘
                          ↕
              Relay WebSocket 连接（双向）
              + HMAC + RELAY_SECRET 签名
                          ↕
┌─────────────────────────────────────────────────────────────┐
│  班级 B 服务器（RELAY_SERVER_ID = server-bbb）               │
│  - 主 WebSocket 端口 10001                                    │
│  - Relay 端口 10011                                          │
│  - clients: { user3, user4, ... }                            │
└─────────────────────────────────────────────────────────────┘
```

### Relay 配置

| 环境变量 | 说明 |
|----------|------|
| `RELAY_SERVERS` | 逗号分隔的 relay 服务器地址列表（如 `ws://10.0.0.2:10011,ws://10.0.0.3:10011`） |
| `RELAY_SECRET` | Relay 通信密钥（HMAC 签名 + 密码混淆，**生产环境必须设置**） |
| `RELAY_SERVER_ID` | 当前服务器唯一 id（缺省时自动生成并持久化到 `system_settings`） |

::: danger 安全告警
若配置了 `RELAY_SERVERS` 但未设置 `RELAY_SECRET`，服务端会输出 CRITICAL 警告：

```
[Relay] CRITICAL: RELAY_SECRET not set but relay servers configured!
[Relay] Remote admin commands will NOT be verified. Set RELAY_SECRET in .env for security.
```

继续运行但**不接受**未鉴权的远程管理命令。生产环境必须设置 `RELAY_SECRET`。
:::

### Relay 工作流程

#### 发送方（relayToPeers）

```
本地用户发送消息
    ↓
broadcast(message, excludeClientId, skipRelay=false)
    ↓ skipRelay=false 时
    ↓
relayToPeers(message)
    ↓
1. 为消息生成 relay_msg_id（RELAY_SERVER_ID + 时间戳 + 随机）
    ↓
2. 遍历 relayPeers，通过 WebSocket 发送给所有 peer
    ↓
3. 检查 bufferedAmount，避免大消息阻塞
    ↓
4. 发送失败的 peer 从 relayPeers 移除
```

#### 接收方（processRelayedMessage）

```
peer 发来 relay 消息
    ↓
wss.on('connection') → handleRelayConnection(ws)
    ↓
ws.on('message') → 校验 RELAY_SECRET
    ↓
processRelayedMessage(data)
    ↓
relayBus.processRelayed(data)
    ↓
1. 根据 data.type 路由到对应 handler
    ↓
2. 写入本地数据库（stmtInsertRelayedXxx）
    ↓
3. 广播给本地 clients（broadcast，skipRelay=true 防止回环）
```

::: tip 防回环
中继消息处理时 `skipRelay=true`，确保消息不会被再次中继给其他 peer，避免无限循环。
:::

### Relay 事件总线

`relay-bus.js` 是 Relay 系统的内部事件总线，注册了一系列 handler 处理不同类型的 relay 消息：

| 事件 | 说明 |
|------|------|
| `chat_message` | 公共聊天消息中继 |
| `private_message` | 私聊消息中继 |
| `group_message` | 群聊消息中继 |
| `message_recall` | 消息撤回中继 |
| `user_online` / `user_offline` | 在线状态同步 |
| `user_registered` | 用户注册同步 |
| `user_login` | 用户登录同步（仅本地，不中继） |
| `group_update` | 群组信息变更（名称/公告/成员） |

## 跨班级消息同步机制

跨班级同步依赖以下机制：

### 班级群自动创建

`init-db.js` 在数据初始化时，从 `pre-records.json` 提取所有班级（`YYCCNN` 格式中的 `CC`），为每个班级创建 `class_CC` 群组，并把对应班级的预注册用户加入群成员。班管（`YYCC00`）自动加入对应班级群。

### 班级归属判断

```javascript
function getUserClassId(userId) {
  // 6位格式 YYCCNN
  if (userId.length === 6 && /^\d{6}$/.test(userId)) {
    var yy = userId.substring(0, 2);
    var cc = userId.substring(2, 4);
    var nn = userId.substring(4, 6);
    if (nn === '00') return 'class_' + cc; // YYCC00 = 班管
    return cc; // YYCCNN = 普通学生
  }
  // ... 兼容旧格式
}
```

### 班级群权限校验

```javascript
function canUserSeeGroup(userId, groupId) {
  var cls = getUserClassId(userId);
  // 仅对班级群（class_ 前缀）做班级归属限制
  if (groupId.indexOf('class_') === 0) {
    if (typeof cls === 'string' && cls.indexOf('class_') === 0) {
      return cls === groupId; // 班管只能看自己班
    }
    var groupClass = groupId.substring('class_'.length);
    return cls === groupClass; // 普通学生比对班级号
  }
  return true; // 非班级群：所有成员可见
}
```

::: warning 跨班级公共聊天
公共聊天室（`room_id = 'public'`）通过 Relay 中继实现跨班级同步。每个班级的服务器本地存储一份公共聊天消息副本，通过 `relay_msg_id` 去重，确保多服务器间消息一致。
:::

## 前端 WebSocket 客户端

源码：`client/src/utils/websocket.js`

`WebSocketManager` 是前端 WebSocket 客户端，采用构造函数 + prototype 模式（兼容 Chrome 80）。

### 核心状态

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `ws` | `null` | WebSocket 实例 |
| `connected` | `false` | 是否已连接 |
| `authenticated` | `false` | 是否已鉴权（收到 `connected` 消息） |
| `reconnectAttempts` | `0` | 当前重连次数 |
| `maxReconnectAttempts` | `10` | 最大重连次数 |
| `heartbeatInterval` | `30000` | 心跳间隔（毫秒） |
| `_transport` | `'ws'` | 传输模式：`'ws'` 或 `'poll'` |
| `_offlineQueue` | `[]` | 离线消息队列（最大 50 条） |
| `_lastPongReceived` | `true` | 上次 pong 是否收到 |

### 核心 API

| 方法 | 说明 |
|------|------|
| `connect(url)` | 连接 WebSocket（自动降级到 polling） |
| `disconnect()` | 主动断开（不触发重连） |
| `send(data)` | 发送消息（离线时入队） |
| `on(type, callback)` | 监听消息类型 |
| `off(type, callback)` | 取消监听 |
| `emit(type, data)` | 触发监听器（内部） |
| `startHeartbeat()` / `stopHeartbeat()` | 心跳管理 |
| `scheduleReconnect()` | 调度重连 |
| `_switchToPolling()` / `_startPolling()` / `_stopPolling()` | HTTP 长轮询回退 |
| `_flushOfflineQueue()` | 重连后发送离线队列消息 |

### 使用示例

```javascript
import WebSocketManager from '@/utils/websocket';

var wsManager = new WebSocketManager();

// 监听连接状态
wsManager.on('_connectionStateChange', function(payload) {
  console.log('连接状态:', payload.state); // 'connected' / 'disconnected'
});

// 监听新消息
wsManager.on('new_message', function(data) {
  console.log('公共消息:', data.message);
});

// 监听私聊
wsManager.on('private_message', function(data) {
  console.log('私聊:', data.message);
});

// 连接
wsManager.connect('ws://' + location.hostname + ':10001');
```

### 离线消息队列

当连接断开时，`send()` 调用会入队 `_offlineQueue`（最多 50 条），重连成功后 `_flushOfflineQueue()` 自动发送。这确保用户在弱网环境下发送的消息不会丢失。

::: tip 离线队列大小限制
`_maxOfflineQueue = 50`，超出后新消息会挤掉最旧的消息。如需调整，修改 `WebSocketManager` 构造函数中的 `_maxOfflineQueue`。
:::

## 消息速率限制

### 客户端消息限流

服务端对每个用户的消息发送进行速率限制：

```javascript
function checkWsRateLimit(userId, maxCount, windowMs) {
  var now = Date.now();
  if (!messageRateLimit[userId] || now - messageRateLimit[userId].windowStart > windowMs) {
    messageRateLimit[userId] = { count: 1, windowStart: now };
    return true;
  }
  messageRateLimit[userId].count++;
  return messageRateLimit[userId].count <= maxCount;
}
```

### 防重复消息

服务端维护 `recentClientMsgs` 字典，记录每个用户最近 10 秒内发送的消息内容，防止客户端网络重传导致的重复消息：

```javascript
function isDuplicateClientMsg(userId, content) {
  if (!recentClientMsgs[userId]) return false;
  var now = Date.now();
  for (var i = recentClientMsgs[userId].length - 1; i >= 0; i--) {
    if (now - recentClientMsgs[userId][i].ts > 10000) {
      recentClientMsgs[userId].splice(0, i + 1);
      break;
    }
    if (recentClientMsgs[userId][i].content === content) return true;
  }
  return false;
}
```

### 大消息丢弃

| 限制 | 阈值 | 行为 |
|------|------|------|
| WebSocket payload 最大 | `5 MB`（`maxPayload: 5 * 1024 * 1024`） | 服务端拒绝接收 |
| 单条消息发送大小 | `1 MB` | `sendToClient` 丢弃并 warn |
| 客户端 bufferedAmount | `512 KB` | 跳过发送，避免背压 |
| Relay 消息大小 | `10 MB` | `relayToPeers` 丢弃并 error |
| Relay bufferedAmount | `5 MB` | 跳过发送 |

::: warning 时序安全比较
Relay 鉴权使用 `crypto.timingSafeEqual` 进行时序安全的字符串比较，防止时序侧信道攻击。详见 `chat-server.js` 中的 `safeCompare` 函数。
:::

## 相关文档

- [架构概览](./)
- [应用架构详解](./architecture)
- [Manifest 清单](./manifest)
- [主题系统](./theme-system)
- [认证与权限](./auth)
- [应用管控](./app-control)
- [快速开始](/quick-start/)
