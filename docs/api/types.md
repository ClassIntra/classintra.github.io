---
title: 类型定义
description: ClassIntra 核心类型与结构参考：数据库表结构、Manifest Schema 字段定义、WebSocket 消息格式、API 响应格式、环境变量类型定义、错误码常量。
outline: [2, 3]
---

# 类型定义

本页面汇总 ClassIntra 在前后端共享的核心结构与类型，是撰写 `manifest.json`、排查数据库表结构、确认 WebSocket 消息格式与环境变量配置时的参考依据。所有结构均来自 `server/src/migrations/`、`shared/src/`、`client/src/`。

## 目录

- [数据库表结构](#数据库表结构)
- [Manifest Schema](#manifest-schema)
- [WebSocket 消息格式](#websocket-消息格式)
- [API 响应格式](#api-响应格式)
- [环境变量](#环境变量)
- [错误码常量](#错误码常量)

## 数据库表结构

ClassIntra 使用 better-sqlite3 嵌入式数据库，所有表通过 `server/src/migrations/000_baseline.js` 一次性创建（使用 `IF NOT EXISTS`，幂等）。下表列出主要业务表与字段。

### users — 用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | 自增主键 |
| `net_name` | `TEXT NOT NULL UNIQUE` | 网名（唯一） |
| `real_name` | `TEXT NOT NULL UNIQUE` | 真实姓名（唯一） |
| `user_id` | `TEXT NOT NULL UNIQUE` | 业务用户 ID（如学号 `2024001`） |
| `gender` | `TEXT DEFAULT ''` | 性别 |
| `password_hash` | `TEXT NOT NULL` | bcrypt 哈希密码 |
| `status` | `TEXT DEFAULT 'active'` | 状态：`active` / `disabled` |
| `is_admin` | `INTEGER DEFAULT 0` | 是否管理员（0/1） |
| `info_json` | `TEXT DEFAULT '{}'` | 扩展信息 JSON（生日/微信/QQ/邮箱/电话/地址/签名） |
| `created_at` | `TEXT DEFAULT (datetime('now'))` | 创建时间 |
| `last_login` | `TEXT DEFAULT NULL` | 最后登录时间 |

### pre_records — 预注册名单

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | 自增主键 |
| `real_name` | `TEXT NOT NULL UNIQUE` | 真实姓名（唯一） |
| `user_id` | `TEXT NOT NULL UNIQUE` | 业务用户 ID |
| `gender` | `TEXT DEFAULT ''` | 性别 |

::: tip 白名单注册
`pre_records` 是注册白名单：管理员录入学生姓名与 `user_id` 后，学生才能以此姓名注册。注册成功后，对应 `pre_records` 记录不会被删除（仅校验是否存在），便于审计。
:::

### broadcasts — 广播通知

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | 自增主键 |
| `content` | `TEXT NOT NULL` | 广播内容 |
| `priority` | `TEXT DEFAULT 'normal'` | 优先级：`normal` / `high` / `urgent` |
| `created_at` | `TEXT DEFAULT (datetime('now'))` | 创建时间 |

### announcements — 公告

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | 自增主键 |
| `title` | `TEXT NOT NULL` | 标题 |
| `content` | `TEXT NOT NULL` | 内容 |
| `type` | `TEXT DEFAULT 'notice'` | 类型：`notice` / `event` / `assignment` |
| `author_id` | `TEXT NOT NULL` | 作者 ID |
| `author_name` | `TEXT DEFAULT ''` | 作者姓名 |
| `pinned` | `INTEGER DEFAULT 0` | 是否置顶（0/1） |
| `created_at` | `TEXT DEFAULT (datetime('now'))` | 创建时间 |

### chat_messages — 公共聊天

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | 自增主键 |
| `room_id` | `TEXT DEFAULT 'public'` | 房间 ID（默认 `public`） |
| `sender_id` | `TEXT NOT NULL` | 发送者 ID |
| `sender_name` | `TEXT NOT NULL` | 发送者姓名 |
| `content` | `TEXT NOT NULL` | 消息内容 |
| `type` | `TEXT DEFAULT 'text'` | 类型：`text` / `image` / `file` / `system` |
| `recalled` | `INTEGER DEFAULT 0` | 是否撤回（0/1） |
| `created_at` | `TEXT DEFAULT (datetime('now'))` | 创建时间 |

### private_messages — 私聊

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | 自增主键 |
| `sender_id` | `TEXT NOT NULL` | 发送者 ID |
| `receiver_id` | `TEXT NOT NULL` | 接收者 ID |
| `content` | `TEXT NOT NULL` | 内容 |
| `type` | `TEXT DEFAULT 'text'` | 类型 |
| `read` | `INTEGER DEFAULT 0` | 是否已读（0/1） |
| `recalled` | `INTEGER DEFAULT 0` | 是否撤回 |
| `created_at` | `TEXT DEFAULT (datetime('now'))` | 创建时间 |

### groups — 班级群组

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `TEXT PRIMARY KEY` | 群组 ID |
| `name` | `TEXT NOT NULL` | 群名 |
| `creator_id` | `TEXT NOT NULL` | 创建者 ID |
| `members_json` | `TEXT DEFAULT '[]'` | 成员列表 JSON 数组 |
| `announcement` | `TEXT DEFAULT ''` | 群公告 |
| `announcement_at` | `TEXT DEFAULT NULL` | 公告更新时间 |
| `created_at` | `TEXT DEFAULT (datetime('now'))` | 创建时间 |

::: tip members_json 结构
群成员存储在 `members_json` 字段中，格式为 `[{ user_id, role, joined_at }, ...]`，`role` 取值 `owner` / `admin` / `member`。这种 JSON 存储方式简化了小规模班级场景的查询，避免额外的 `group_members` 关联表。
:::

### group_messages — 群聊消息

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | 自增主键 |
| `group_id` | `TEXT NOT NULL` | 群组 ID |
| `sender_id` | `TEXT NOT NULL` | 发送者 ID |
| `sender_name` | `TEXT NOT NULL` | 发送者姓名 |
| `content` | `TEXT NOT NULL` | 内容 |
| `type` | `TEXT DEFAULT 'text'` | 类型 |
| `recalled` | `INTEGER DEFAULT 0` | 是否撤回 |
| `created_at` | `TEXT DEFAULT (datetime('now'))` | 创建时间 |

### conversations — AI 对话

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `TEXT PRIMARY KEY` | 对话 ID |
| `user_id` | `TEXT NOT NULL` | 用户 ID |
| `title` | `TEXT DEFAULT '新对话'` | 对话标题 |
| `messages_json` | `TEXT DEFAULT '[]'` | 消息列表 JSON 数组 |
| `created_at` | `TEXT DEFAULT (datetime('now'))` | 创建时间 |
| `updated_at` | `TEXT DEFAULT (datetime('now'))` | 更新时间 |

### user_settings — 用户设置

| 字段 | 类型 | 说明 |
|------|------|------|
| `user_id` | `TEXT PRIMARY KEY` | 用户 ID |
| `theme` | `TEXT DEFAULT 'light'` | 主题（`light` / `dark`） |
| `wallpaper` | `TEXT DEFAULT 'default'` | 壁纸 ID |
| `notifications_json` | `TEXT DEFAULT '{"superIsland":true,"chat":true,"sound":false}'` | 通知设置 |
| `updated_at` | `TEXT DEFAULT (datetime('now'))` | 更新时间 |

### admin_logs — 管理日志

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | 自增主键 |
| `admin_id` | `TEXT NOT NULL` | 操作者 ID |
| `action` | `TEXT NOT NULL` | 操作动作（如 `disable_user`、`broadcast`、`appoint_officer`） |
| `target` | `TEXT DEFAULT ''` | 目标对象 ID |
| `detail` | `TEXT DEFAULT ''` | 详情 |
| `created_at` | `TEXT DEFAULT (datetime('now'))` | 创建时间 |

### posts — 论坛帖子

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | 自增主键 |
| `author_id` | `TEXT NOT NULL` | 作者 ID |
| `title` | `TEXT NOT NULL` | 标题 |
| `content` | `TEXT NOT NULL` | 内容（Markdown） |
| `category` | `TEXT DEFAULT 'general'` | 分类 |
| `views` | `INTEGER DEFAULT 0` | 浏览数 |
| `likes` | `INTEGER DEFAULT 0` | 点赞数 |
| `created_at` | `TEXT DEFAULT (datetime('now'))` | 创建时间 |

### comments — 评论

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | 自增主键 |
| `post_id` | `TEXT NOT NULL` | 帖子 ID |
| `author_id` | `TEXT NOT NULL` | 作者 ID |
| `content` | `TEXT NOT NULL` | 评论内容 |
| `parent_id` | `INTEGER DEFAULT NULL` | 父评论 ID（楼中楼） |
| `created_at` | `TEXT DEFAULT (datetime('now'))` | 创建时间 |

### files — 文件

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | 自增主键 |
| `owner_id` | `TEXT NOT NULL` | 所有者 ID |
| `filename` | `TEXT NOT NULL` | 文件名 |
| `path` | `TEXT NOT NULL` | 存储路径（相对 `Resources/cloud/`） |
| `size` | `INTEGER NOT NULL` | 字节数 |
| `mime_type` | `TEXT DEFAULT ''` | MIME 类型 |
| `created_at` | `TEXT DEFAULT (datetime('now'))` | 创建时间 |

### notes — 笔记

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | 自增主键 |
| `owner_id` | `TEXT NOT NULL` | 所有者 ID |
| `title` | `TEXT NOT NULL` | 标题 |
| `content` | `TEXT DEFAULT ''` | 内容（Markdown） |
| `visibility` | `TEXT DEFAULT 'private'` | 可见性：`private` / `shared` / `public` |
| `updated_at` | `TEXT DEFAULT (datetime('now'))` | 更新时间 |

### app_control — 应用管控

| 字段 | 类型 | 说明 |
|------|------|------|
| `app_name` | `TEXT PRIMARY KEY` | 应用名（kebab-case） |
| `enabled` | `INTEGER DEFAULT 1` | 是否启用（0/1） |
| `updated_at` | `TEXT DEFAULT (datetime('now'))` | 更新时间 |

### system_settings — 系统设置

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | `TEXT PRIMARY KEY` | 设置键（如 `site_name`、`allow_register`） |
| `value` | `TEXT DEFAULT ''` | 设置值 |
| `updated_at` | `TEXT DEFAULT (datetime('now'))` | 更新时间 |

### integrations — 第三方集成

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | 自增主键 |
| `name` | `TEXT NOT NULL` | 集成名称 |
| `token` | `TEXT NOT NULL` | 集成 Token（`ci_` 前缀） |
| `secret` | `TEXT NOT NULL` | 集成 secret（`sec_` 前缀） |
| `scopes` | `TEXT DEFAULT '[]'` | 权限范围 JSON 数组 |
| `origins` | `TEXT DEFAULT '[]'` | Origin 白名单 JSON 数组 |
| `webhook_url` | `TEXT DEFAULT ''` | Webhook 接收地址 |
| `expires_at` | `TEXT DEFAULT NULL` | 过期时间 |
| `created_at` | `TEXT DEFAULT (datetime('now'))` | 创建时间 |

### levels — 用户等级

| 字段 | 类型 | 说明 |
|------|------|------|
| `user_id` | `TEXT PRIMARY KEY` | 用户 ID |
| `exp` | `INTEGER DEFAULT 0` | 经验值 |
| `level` | `INTEGER DEFAULT 0` | 等级 |
| `last_login` | `TEXT DEFAULT NULL` | 最后登录日期（用于计算连续签到） |
| `streak` | `INTEGER DEFAULT 0` | 连续登录天数 |

::: tip 等级图标
等级 0-6 对应 `Resources/public/icons/level/Lv0.svg` ~ `Lv6.svg`，前端根据 `level` 字段动态加载图标。
:::

## Manifest Schema

源码：`shared/src/manifest-schema.js`（前端 ES Module）+ `server/src/core/manifest-schema.js`（后端 CommonJS 版）

应用清单描述应用的元数据、前后端入口、分类与权限。ClassIntra 的 manifest 使用扁平 schema，前后端共用同一份验证器。

### 字段定义

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `name` | `string` | 是 | — | 应用唯一标识（kebab-case） |
| `label` | `string` | 是 | — | 显示名称 |
| `icon` | `string` | 否 | — | 图标路径 |
| `color` | `string` | 否 | — | 主题色（hex） |
| `category` | `string` | 否 | `'desktop'` | 分类：`desktop` / `system` / `hidden` |
| `order` | `number` | 否 | `99` | 排序权重（越小越靠前） |
| `defaultEnabled` | `boolean` | 否 | `true` | 默认是否启用 |
| `canDisable` | `boolean` | 否 | `true` | 是否允许用户禁用 |
| `type` | `string` | 否 | `'app'` | 类型：`app` / `system` / `widget` / `plugin` |
| `version` | `string` | 否 | `'0.0.0'` | 语义化版本号（semver） |
| `frontend` | `object` | 否 | — | 前端配置（`route` / `component`） |
| `backend` | `object` | 否 | — | 后端配置（`mountPath` / `entry`） |
| `extraBackends` | `array` | 否 | — | 额外后端路由（阶段 0 引入） |
| `integration` | `object` | 否 | — | 插件联动配置（`type=plugin` 时使用） |

### frontend 字段

| 子字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `route` | `string` | 是 | 前端路由路径（如 `/chat`） |
| `component` | `string` | 是 | Vue 组件路径（如 `Chat/Chat.vue`，相对 `apps/<name>/frontend/`） |

### backend 字段

| 子字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `mountPath` | `string` | 是 | 后端路由挂载路径（如 `/api/chat`） |
| `entry` | `string` | 是 | 后端入口文件（如 `routes.js`，相对 `apps/<name>/backend/`） |

### integration 字段（type=plugin 时）

| 子字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `contract` | `object` | 是 | 联动契约（定义对外暴露的能力） |
| `frontendBridge` | `string` | 否 | 前端桥接入口 |
| `clientEntry` | `string` | 否 | 客户端入口 |
| `channels` | `array` | 否 | WebSocket 频道声明 |

### 验证器

`validateManifest(m)` 返回 `{ valid, errors, warnings, manifest }`：

- `valid`：`boolean`，是否通过校验（有 errors 即 false）
- `errors`：阻断性错误数组（缺 `name` / `label` 等）
- `warnings`：非阻断警告数组（缺 `icon` / `color`、版本不符合 semver 等）
- `manifest`：归一化后的 manifest（补全默认值）

::: tip 前后端共用
前端（`shared/src/manifest-schema.js`）以 ES Module 形式导出 `validateManifest` 与 `FIELD_DEFS`；后端（`server/src/core/manifest-schema.js`）维护 CommonJS 版本，行为一致，便于在 Express 路由与服务注册阶段统一校验。
:::

### 示例

```json
{
  "name": "ai-chat",
  "label": "AI 对话",
  "icon": "AI-Chat.svg",
  "color": "#7B68EE",
  "category": "desktop",
  "order": 10,
  "defaultEnabled": true,
  "canDisable": true,
  "type": "app",
  "version": "1.2.0",
  "frontend": {
    "route": "/ai-chat",
    "component": "AIChat.vue"
  },
  "backend": {
    "mountPath": "/api/ai-chat",
    "entry": "routes.js"
  }
}
```

## WebSocket 消息格式

ClassIntra WebSocket 连接地址为 `ws://host:port/ws?token=<jwt>`，所有消息为 JSON 文本，统一结构为 `{ type, ...payload }`。

### 客户端 → 服务端

| `type` | 字段 | 说明 |
|------|------|------|
| `connect` | （无） | 连接后首条消息，完成认证 |
| `ping` | （无） | 心跳请求 |
| `chat` | `room_id`、`content`、`type` | 发送聊天消息 |
| `private_message` | `receiver_id`、`content`、`type` | 发送私聊消息 |
| `group_message` | `group_id`、`content`、`type` | 发送群聊消息 |
| `recall` | `message_id`、`channel` | 撤回消息 |
| `typing` | `room_id` / `group_id` | 输入中提示 |

### 服务端 → 客户端

| `type` | 字段 | 说明 |
|------|------|------|
| `connected` | `user_id`、`server_time` | 连接认证成功 |
| `pong` | （无） | 心跳响应 |
| `chat` | `id`、`room_id`、`sender_id`、`sender_name`、`content`、`type`、`created_at` | 聊天消息广播 |
| `private_message` | `id`、`sender_id`、`sender_name`、`content`、`type`、`created_at` | 私聊消息推送 |
| `group_message` | `id`、`group_id`、`sender_id`、`sender_name`、`content`、`type`、`created_at` | 群聊消息推送 |
| `recalled` | `message_id`、`channel` | 消息撤回通知 |
| `notification` | `title`、`body`、`type`、`source` | 通知推送 |
| `broadcast` | `content`、`priority` | 广播通知 |
| `user_login` | `user_id`、`last_login` | 用户上线通知 |
| `error` | `message` | 错误消息 |

::: tip 消息撤回
`recall` 消息会触发服务端向同频道所有客户端广播 `recalled`，客户端收到后更新对应消息的 UI 状态。撤回有时效限制（默认 2 分钟内）。
:::

## API 响应格式

所有 HTTP 响应均为 JSON，统一结构：

```typescript
interface ApiResponse<T = any> {
  code: number;        // 业务状态码，200 表示成功
  message: string;     // 可读状态描述
  data: T | null;      // 业务数据，失败时为 null
}
```

部分端点会附加额外字段（如 `ban_expires_at`、`ban_reason`），前端按需读取。

::: warning code 与 HTTP 状态码
`code` 是业务状态码，通常与 HTTP 状态码一致（如 200/400/401/403/404/409/500），但部分端点即使业务失败也会返回 HTTP 200 + `code: 400`，前端需读取 `response.data.code` 而非 `response.status` 判断业务成功。
:::

## 环境变量

源码：`server/.env.example`

ClassIntra 服务端通过 `dotenv` 读取环境变量，主要变量如下：

| 变量 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `PORT` | `number` | 否 | `3000` | 后端监听端口 |
| `JWT_SECRET` | `string` | 是 | — | JWT 签名密钥（未设置拒绝启动） |
| `DB_PATH` | `string` | 否 | `data/classintra.db` | SQLite 数据库文件路径 |
| `PUBLIC_DIR` | `string` | 否 | `public` | 静态资源目录 |
| `CORS_ORIGIN` | `string` | 否 | `*` | CORS 白名单（逗号分隔） |
| `CDN_WHITELIST` | `string` | 否 | — | CDN 代理域名白名单（逗号分隔） |
| `HTTPS` | `boolean` | 否 | `false` | 是否启用 HTTPS |
| `NODE_ENV` | `string` | 否 | `development` | 运行环境（`production` / `development`） |
| `ADMIN_USER_IDS` | `string` | 否 | `[]` | 管理员用户 ID 列表（JSON 数组字符串） |
| `RELAY_SECRET` | `string` | 否 | — | 中继服务器间认证密钥 |
| `RELAY_SERVERS` | `string` | 否 | `[]` | 中继服务器地址列表（JSON 数组字符串） |
| `WEATHER_API_KEY` | `string` | 否 | — | 和风天气 API Key |
| `AI_API_KEY` | `string` | 否 | — | AI 对话服务 API Key（OpenAI 兼容） |
| `AI_API_BASE` | `string` | 否 | — | AI 服务 Base URL |
| `AI_MODEL` | `string` | 否 | `deepseek-chat` | AI 默认模型 |

::: danger JWT_SECRET 必填
`JWT_SECRET` 是唯一必填项，未设置时服务端启动会抛出错误并退出。生产环境请使用至少 32 字符的高强度随机字符串，建议通过 `openssl rand -hex 32` 生成。
:::

::: tip 多机中继配置
多班级中继需要配置 `RELAY_SECRET`（所有节点共享同一密钥）与 `RELAY_SERVERS`（其他节点的 WebSocket 地址，JSON 数组字符串）。通常配合 Tailscale 组网使用。
:::

## 错误码常量

源码：`shared/src/constants.js` + `shared/src/errors.js`

ClassIntra 使用 `ClassIntraError` 统一封装内部错误，通过 `error.code` 标识错误类型。

### 前端核心错误码

| 错误码 | 触发场景 | 处理建议 |
|--------|----------|----------|
| `SERVICE_NOT_REGISTERED` | `ServiceRegistry.resolve` 时 name 未注册 | 检查 name 拼写与注册时机 |
| `SERVICE_ALREADY_REGISTERED` | `register` 时 name 已存在 | 改用唯一 name 或先 `shutdown` |
| `THEME_NOT_FOUND` | `setTheme` 时 id 未注册 | 检查主题是否通过 `theme-loader` 加载 |
| `HOTKEY_INVALID_COMBO` | `register` 时 combo 格式错误 | 使用 `ctrl+k` 等标准格式 |
| `HOTKEY_DUPLICATE_ID` | `register` 时 id 已存在 | 改用唯一 id 或先 `unregister` |
| `STORAGE_QUOTA_EXCEEDED` | `PersistenceStore.set` 时 localStorage 空间不足 | 清理无用 key 或改用 IndexedDB |
| `WS_CONNECTION_FAILED` | WebSocket 连接失败 | 检查 URL、Token、网络 |
| `WS_AUTH_FAILED` | WebSocket 认证失败 | 检查 Token 有效性 |
| `NETWORK_OFFLINE` | 断网保护触发 | 等待网络恢复 |

### HTTP 业务状态码

服务端 API 的业务状态码（`code` 字段）：

| code | 含义 | 典型场景 |
|------|------|----------|
| `200` | 成功 | 正常请求 |
| `400` | Bad Request | 参数无效、字段缺失、密码强度不足 |
| `401` | Unauthorized | 未携带 Token、Token 无效、密码错误 |
| `403` | Forbidden | 账号被禁用、无管理员权限、域名不在白名单 |
| `404` | Not Found | 用户/资源不存在 |
| `409` | Conflict | 网名已占用、姓名已注册 |
| `429` | Too Many Requests | 限流触发 |
| `500` | Internal Server Error | 服务端未捕获异常 |
| `503` | Service Unavailable | 中继服务器不可用 |

::: tip ClassIntraError 结构
所有前端内部错误均继承自 `ClassIntraError`，可通过 `error.code` 获取错误码、`error.message` 获取可读描述、`error.cause` 获取原始错误。捕获时优先按 `code` 分支处理。
:::

## 相关文档

- [API 参考 — 总览](./index)
- [API 参考 — 前端 API](./client)
- [API 参考 — 服务端 API](./server)
- [核心概念 — Manifest 清单](/concepts/manifest)
- [核心概念 — WebSocket 通信](/concepts/websocket)
- [核心概念 — 认证与权限](/concepts/auth)
- [核心概念 — 应用管控](/concepts/app-control)
- [部署运维 — 配置项](/deployment/configuration)
