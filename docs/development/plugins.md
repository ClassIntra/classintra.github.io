---
title: 插件开发
description: ClassIntra 插件开发指南，覆盖 plugins 目录结构、manifest type=plugin 声明、integration 契约（contract/frontendBridge/clientEntry/channels）、CampusBili 桥接案例与 postMessage 通信协议。
---

# 插件开发

插件（Plugin）是 ClassIntra 与外部系统联动的标准化扩展机制。与普通应用不同，插件不提供桌面图标和独立页面，而是通过**通信契约**将外部系统（如视频站、第三方平台）接入 ClassIntra。

源码位置：插件源码维护在 [market 仓库](https://github.com/ClassIntra/market) 的 `plugins/` 目录；运行时部署到班级服务器的 `plugins/` 目录（该目录不属于主仓库，仅作为运行时加载点）。相关集成代码位于 `client/src/integrations/`、`server/src/integrations/`。

## 插件与应用的区别

| 维度 | 应用（app） | 插件（plugin） |
|------|------------|---------------|
| 位置 | `apps/<name>/` | `plugins/<name>/` |
| manifest `type` | `app` | `plugin` |
| 桌面图标 | 有（`category: desktop`） | 无（`category: hidden`） |
| 前端页面 | 必须有 `frontend.route` | 无独立路由，提供桥接模块 |
| 后端路由 | 可选 `backend` | 通常有（身份验证等） |
| 核心职责 | 完整功能 | 系统间联动 |

## 目录结构

```
plugins/my-bridge/
├── manifest.json              # 必填，插件清单
├── README.md                  # 插件说明
├── backend/
│   └── routes.js              # 后端路由（身份验证等）
├── frontend/
│   └── bridge.js              # 前端桥接模块（postMessage 通信）
└── shared/
    └── contract.js            # 通信契约（双方共享的消息协议定义）
```

## manifest 编写

以内置的 CampusBili 桥接插件为例：

```json
{
  "name": "campusbili-bridge",
  "type": "plugin",
  "version": "1.2.0",
  "label": "CampusBili 桥接",
  "category": "hidden",
  "order": 99,
  "defaultEnabled": true,
  "canDisable": false,
  "description": "ClassIntra 与 CampusBili 的统一联动插件（v1.1 协议）",
  "backend": {
    "mountPath": "/api/campusbili-bridge",
    "entry": "./backend/routes.js"
  },
  "integration": {
    "contract": "./shared/contract.js",
    "frontendBridge": "./frontend/bridge.js",
    "clientEntry": "client/src/integrations/campusbili-bridge-client.js",
    "protocolVersion": "1.1",
    "channels": [
      "handshake",
      "identity-injection",
      "request-mute",
      "video-control",
      "playback-status",
      "share-request",
      "back-button",
      "page-info",
      "ping"
    ]
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 插件唯一标识，kebab-case |
| `type` | string | 是 | 固定为 `plugin` |
| `category` | string | 否 | 建议为 `hidden`（不在桌面显示图标） |
| `canDisable` | boolean | 否 | 联动基础插件建议 `false`（不允许禁用） |
| `backend` | object | 否 | 后端路由挂载，同应用 |
| `integration` | object | 是 | 联动集成配置，插件的核心字段 |

### `integration` 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `contract` | string | 通信契约文件路径，前后端共享消息协议定义 |
| `frontendBridge` | string | 前端桥接模块路径（供嵌入的 iframe 页面使用） |
| `clientEntry` | string | client 侧集成入口（由 client 构建引用） |
| `protocolVersion` | string | 协议版本号，握手时用于版本协商 |
| `channels` | string[] | 允许的消息通道白名单，未列出的通道消息会被拒绝 |

## 通信契约（contract.js）

契约文件定义双方共同遵守的消息协议，是联动的「宪法」：

```javascript
// plugins/my-bridge/shared/contract.js
// 协议版本与通道白名单的唯一事实来源（Single Source of Truth）

var PROTOCOL_VERSION = '1.1';

// 允许的消息通道（未在白名单中的消息一律拒绝）
var CHANNELS = [
  'handshake',        // 握手
  'identity-injection', // 身份注入
  'ping'              // 心跳
];

// 每个通道的消息结构定义
var MESSAGE_SCHEMAS = {
  'handshake': {
    // iframe → ClassIntra
    request: { source: 'string', event: 'string', protocolVersion: 'string' },
    // ClassIntra → iframe
    response: { source: 'string', event: 'string', protocolVersion: 'string' }
  }
};

module.exports = {
  PROTOCOL_VERSION: PROTOCOL_VERSION,
  CHANNELS: CHANNELS,
  MESSAGE_SCHEMAS: MESSAGE_SCHEMAS
};
```

::: warning 契约优先
所有联动消息必须通过契约规范：通道名进白名单、消息结构符合 schema。私自新增通道会造成版本兼容性问题——升级协议时必须同步递增 `protocolVersion`。
:::

## 握手流程

ClassIntra 与嵌入页面通过 postMessage 通信，遵循完整握手流程：

```
iframe（外部页面）                          ClassIntra（宿主）
      │                                          │
      │ 1. HELLO { protocolVersion: '1.1' }        │
      ├─────────────────────────────────────────→ │
      │                                          │ 2. 版本协商（兼容则继续）
      │ 3. WELCOME { protocolVersion: '1.1' }      │
      ├←───────────────────────────────────────── │
      │ 4. READY                                    │
      ├─────────────────────────────────────────→ │
      │                                          │ 5. identity-injection
      │    { token, user } （身份注入）              │
      ├←───────────────────────────────────────── │
      │                                          │
      │ 6. 业务消息（白名单通道内双向通信）            │
      ├←────────────────────────────────────────→ │
```

1. **HELLO**：iframe 加载后向宿主声明协议版本
2. **版本协商**：宿主比对 `protocolVersion`，不兼容则拒绝通信
3. **WELCOME**：宿主确认握手成功
4. **READY**：iframe 声明就绪
5. **身份注入**：宿主将登录态（token / 用户信息）注入 iframe
6. **业务消息**：在白名单通道内双向通信（如 `video-control`、`request-mute`）

## 前端桥接模块（bridge.js）

桥接模块运行在**被嵌入的外部页面**中，封装 postMessage 细节：

```javascript
// plugins/my-bridge/frontend/bridge.js
// 外部页面引入此模块即可与 ClassIntra 通信

(function(global) {
  'use strict';

  var PROTOCOL_VERSION = '1.1';
  var handlers = {};
  var ready = false;

  // 监听宿主消息
  global.addEventListener('message', function(event) {
    var msg = event.data;
    if (!msg || msg.source !== 'classintra') return;
    if (msg.event === 'welcome') {
      ready = true;
      post('ready', {});
    }
    if (handlers[msg.event]) handlers[msg.event](msg.data);
  });

  function post(event, data) {
    global.parent.postMessage({
      source: 'external-app',
      event: event,
      protocolVersion: PROTOCOL_VERSION,
      data: data || {}
    }, '*');
  }

  var Bridge = {
    // 发起握手
    hello: function() { post('hello', { protocolVersion: PROTOCOL_VERSION }); },
    // 注册通道处理器
    on: function(channel, fn) { handlers[channel] = fn; },
    // 发送消息（仅白名单通道）
    send: function(channel, data) {
      if (!ready) { console.warn('[bridge] 尚未完成握手'); return; }
      post(channel, data);
    },
    isReady: function() { return ready; }
  };

  global.MyBridge = Bridge;
})(window);
```

## client 集成入口

宿主侧（ClassIntra）的集成逻辑位于 `client/src/integrations/`，负责：

- 监听并校验 iframe 消息（来源、协议版本、通道白名单）
- 握手响应与身份注入
- 将业务事件转发给对应模块（如超能岛视频岛、静音控制）

```
client/src/integrations/campusbili-bridge-client.js
    ├─ 校验 event.source / protocolVersion / channels
    ├─ 响应 HELLO → WELCOME
    ├─ READY 后注入身份
    └─ video-control → Vuex island 模块（视频岛）
       request-mute → 音乐应用暂停
```

## 后端路由

插件后端路由与应用一致，挂载到 `backend.mountPath`：

```javascript
// plugins/my-bridge/backend/routes.js
var express = require('express');
var router = express.Router();
var auth = require('../../server/src/middleware/auth');

// 验证联动会话有效性（iframe 内 fetch 携带注入的 token）
router.get('/session', auth.requireAuth, function(req, res) {
  res.json({
    code: 200,
    data: { user_id: req.user.user_id, nickname: req.user.nickname }
  });
});

module.exports = router;
```

::: tip 相对路径
插件位于仓库根 `plugins/`，引用 server 模块的相对路径为 `../../server/src/...`（应用是 `../../../server/src/...`）。
:::

## 验证清单

- ✅ `manifest.json` 通过校验：`type: plugin`、`integration` 完整
- ✅ 后端启动日志显示路由挂载：`挂载应用路由: my-bridge -> /api/my-bridge`
- ✅ iframe 引入 bridge.js 后能完成 HELLO → WELCOME → READY 握手
- ✅ 非白名单通道消息被拒绝并告警
- ✅ 协议版本不匹配时握手失败且不抛异常
- ✅ 身份注入后 iframe 内 API 调用携带有效 token

## 下一步

- [第三方应用开发](./third-party) - 完整应用开发
- [小组件开发](./widgets) - 桌面小组件
- [WebSocket 通信](/concepts/websocket) - 实时消息机制
