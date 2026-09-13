---
title: 服务端 API 参考
description: ClassIntra 服务端 HTTP + WebSocket 接口完整参考：认证、用户、管理、初始化、资源、等级、CDN 代理、系统、集成 9 大路由模块的端点表与请求/响应示例、通用响应格式、错误码、限流策略。
outline: [2, 3]
---

# 服务端 API 参考

ClassIntra 服务端由 Express 4 实现，对外暴露 HTTP 接口，覆盖认证、用户、管理、初始化、资源、等级、CDN 代理、系统、集成 9 大模块。所有路由按文件拆分挂在 `/api/*` 前缀下，本页面是这些路由的完整参考手册。

## 目录

- [基础信息](#基础信息)
- [认证机制](#认证机制)
- [通用响应格式](#通用响应格式)
- [认证 API（/api/auth）](#认证-api-api-auth)
- [用户 API（/api/user）](#用户-api-api-user)
- [管理 API（/api/admin）](#管理-api-api-admin)
- [初始化 API（/api/setup）](#初始化-api-api-setup)
- [资源 API（/api/assets）](#资源-api-api-assets)
- [等级 API（/api/level）](#等级-api-api-level)
- [CDN 代理 API（/api/cdn）](#cdn-代理-api-api-cdn)
- [系统 API（/api/system）](#系统-api-api-system)
- [集成 API（/api/integrations）](#集成-api-api-integrations)
- [AI 聊天 API（/api/ai-chat）](#ai-聊天-api-api-ai-chat)
- [错误码列表](#错误码列表)
- [限流策略](#限流策略)
- [示例](#示例)

## 基础信息

| 项目 | 值 |
| --- | --- |
| Base URL | `http://localhost:<port>` |
| 默认端口 | `5001`（前端开发端口，后端默认 `3000`，可通过 `PORT` 覆盖） |
| 默认 Content-Type | `application/json`（除文件上传/下载、CDN 代理等明确说明外） |
| CORS | 默认开启，允许 `Origin: *`；生产环境通过 `CORS_ORIGIN` 配置白名单 |
| 允许方法 | `GET` / `POST` / `PUT` / `PATCH` / `DELETE` / `OPTIONS` |
| 允许请求头 | `Content-Type`、`Authorization`、`Cookie`、`X-Relay-Secret`、`X-Webhook-Token` |
| 暴露响应头 | `X-RateLimit-Limit`、`X-RateLimit-Remaining`、`Retry-After` |
| Cookie | `token`（httpOnly，`sameSite: 'lax'`，有效期 7 天） |

::: tip 端口与目录
- 前端开发服务器默认端口 `5001`，后端 API 默认端口 `3000`，生产部署时通过 `server/.env` 配置。
- 数据库文件路径由 `DB_PATH` 控制，默认 `server/data/classintra.db`（better-sqlite3 嵌入式数据库）。
- 静态资源目录由 `PUBLIC_DIR` 控制，默认 `server/public`。
:::

## 认证机制

服务端使用两种并行的认证方式：

- **JWT Token**：登录/注册成功后返回 `token`，后续请求通过 `Authorization: Bearer <token>` 携带，同时也会写入 `token` Cookie（httpOnly）。
- **Cookie**：登录后服务端会设置 `token` Cookie，浏览器自动携带，配合 `withCredentials: true` 使用。

Token 由 `jsonwebtoken` 签发，包含 `user_id`、`net_name`、`real_name`、`is_admin`、`is_class_admin`、`role`、`officer_permissions`、`officer_title`、`gender` 等字段，有效期 7 天，通过 `jwtUtil.verifyToken` 校验。

::: warning JWT_SECRET 必填
`server/.env` 中的 `JWT_SECRET` 为必填项，未设置时服务端拒绝启动。生产环境请使用高强度随机字符串（至少 32 字符）。
:::

### 中继登录（跨班级）

ClassIntra 支持多班级中继登录：当本机数据库未找到用户时，会依次向 `config.relay.servers` 中的中继服务器发起 `POST /api/auth/relay-verify` 请求，使用 `X-Relay-Secret` 头进行服务间认证。中继服务器返回用户信息后，本机会落库并签发本机 Token。

::: tip Tailscale 组网
多班级中继登录通常配合 Tailscale 组网使用，详见部署文档中的"多机中继"章节。
:::

## 通用响应格式

所有 HTTP 响应均为 JSON，统一结构为：

```json
{
  "code": 200,
  "message": "ok",
  "data": {}
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | `number` | 业务状态码，`200` 表示成功，其他为错误码（详见[错误码列表](#错误码列表)） |
| `message` | `string` | 可读的状态描述，成功时为 `"ok"` 或具体描述，失败时为错误信息 |
| `data` | `any \| null` | 业务数据，成功时为对象或数组，失败时为 `null` |

::: tip code 与 HTTP 状态码
`code` 是业务状态码，与 HTTP 状态码通常一致（如 `200`/`400`/`401`/`403`/`404`/`409`/`500`），但部分端点会返回 `code: 200` 同时 HTTP 状态码为 `200`，便于前端统一拦截。前端 `utils/api.js` 会优先读取 `response.data.code` 判断业务成功。
:::

部分端点会附加额外字段，例如禁用账号相关：

```json
{
  "code": 403,
  "message": "该账号已被禁用",
  "data": null,
  "ban_expires_at": "2026-09-01 12:00:00",
  "ban_reason": "违规操作"
}
```

## 认证 API（/api/auth）

源码：`server/src/routes/auth.js`

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 用户注册（需在 `pre_records` 名单中） | 否 |
| POST | `/api/auth/login` | 用户登录（支持中继登录） | 否 |
| POST | `/api/auth/refresh-token` | 刷新 Token | 是（携带旧 Token） |
| GET | `/api/auth/check-status` | 检查登录状态 | 是 |
| POST | `/api/auth/logout` | 退出登录 | 否 |
| GET | `/api/auth/ban-info` | 查询封禁信息 | 是 |
| POST | `/api/auth/relay-verify` | 中继服务器间密码验证（内部端点） | `X-Relay-Secret` |

### POST /api/auth/register

注册新用户。要求姓名必须在 `pre_records` 预注册名单中（由管理员预先录入），注册成功后自动签发 Token。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `net_name` | `string` | 是 | 网名（唯一） |
| `real_name` | `string` | 是 | 真实姓名（必须在 `pre_records` 表中） |
| `password` | `string` | 是 | 密码（需通过强度校验） |
| `confirm_password` | `string` | 是 | 确认密码（需与 `password` 一致） |

**成功响应**：

```json
{
  "code": 200,
  "message": "注册成功",
  "data": {
    "user_info": {
      "user_id": "2024001",
      "net_name": "小明同学",
      "real_name": "张三",
      "gender": "male",
      "status": "active",
      "is_admin": 0,
      "is_class_admin": false,
      "role": "user",
      "officer_permissions": "[]",
      "officer_title": "",
      "info": {},
      "created_at": "2026-08-21T10:00:00.000Z",
      "last_login": null,
      "ban_expires_at": null,
      "ban_reason": null
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**失败响应示例**：

```json
{ "code": 400, "message": "该姓名不在预注册名单中", "data": null }
```

```json
{ "code": 409, "message": "该网名已被使用", "data": null }
```

::: warning 预注册名单
ClassIntra 采用"白名单注册"策略：管理员需先在 `pre_records` 表录入学生姓名与 `user_id`，学生才能以此姓名注册。这保证了班级成员的真实性，防止外部人员随意注册。
:::

### POST /api/auth/login

用户登录。支持以 `real_name`、`user_id` 或 `net_name` 作为账号。若本机未找到用户，会尝试通过中继服务器登录。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `account` | `string` | 是 | 账号（真实姓名 / 用户ID / 网名） |
| `password` | `string` | 是 | 密码 |

**成功响应**：

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "user_info": { "...": "同 register 返回的 user_info 结构" },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**失败响应**：

| code | message | 说明 |
|------|---------|------|
| 400 | 请输入账号和密码 | 字段缺失 |
| 401 | 账号或密码错误 | 凭证错误 |
| 403 | 该账号已被禁用 | 账号被禁用（附带 `ban_expires_at`、`ban_reason`） |
| 500 | 服务器内部错误 | 服务异常 |

### POST /api/auth/refresh-token

刷新 Token。需携带当前有效的 Token（Cookie 或 `Authorization` 头），返回新 Token 与最新 `user_info`。

**请求**：无需请求体，从 Cookie 或 `Authorization` 头读取 Token。

**成功响应**：

```json
{
  "code": 200,
  "message": "令牌刷新成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(新 Token)",
    "user_info": { "...": "最新用户信息" }
  }
}
```

::: tip 自动刷新
前端 `utils/api.js` 在 401 拦截器中会自动尝试刷新 Token，刷新失败才跳转登录页。建议在应用启动时调用 `GET /api/auth/check-status` 校验登录状态并自动刷新。
:::

## 用户 API（/api/user）

源码：`server/src/routes/user.js`

所有 `/api/user/*` 路由均经过 `auth.requireAuth` 中间件，必须携带有效 Token。

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/user/profile` | 获取当前用户资料 | 是 |
| PATCH | `/api/user/profile` | 更新资料（net_name / info 子字段） | 是 |
| PUT | `/api/user/change-password` | 修改密码 | 是 |
| GET | `/api/user/settings` | 获取用户设置（主题、壁纸、通知） | 是 |
| PUT | `/api/user/settings` | 更新用户设置 | 是 |

**PATCH /api/user/profile 请求体**：

```json
{
  "net_name": "新网名",
  "info": {
    "birthday": "2008-01-01",
    "wechat": "wxid_xxx",
    "qq": "123456",
    "email": "test@example.com",
    "phone": "13800138000",
    "address": "北京市",
    "signature": "个性签名"
  }
}
```

`info` 字段仅允许更新 `birthday`、`wechat`、`qq`、`email`、`phone`、`address`、`signature` 这 7 个子字段，其他字段会被忽略。

::: warning 网名唯一性
更新 `net_name` 时会校验唯一性，若已被其他用户占用返回 `409`。
:::

## 管理 API（/api/admin）

源码：`server/src/routes/admin.js`

所有 `/api/admin/*` 路由均经过 `auth.requireAuth` + `auth.requireAdmin` 中间件，仅 `is_admin = 1` 的用户可访问。

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/admin/users` | 列出所有用户 | 管理员 |
| PATCH | `/api/admin/users/:id/status` | 更新用户状态（启用/禁用/封禁） | 管理员 |
| POST | `/api/admin/broadcasts` | 发布广播通知 | 管理员 |
| POST | `/api/admin/officers` | 委任/撤销班干 | 管理员 |
| GET | `/api/admin/logs` | 查询操作日志 | 管理员 |

**PATCH /api/admin/users/:id/status 请求体**：

```json
{
  "status": "disabled",
  "ban_expires_at": "2026-09-01 12:00:00",
  "ban_reason": "违规操作"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | `string` | 是 | `active` / `disabled` |
| `ban_expires_at` | `string` | 否 | 封禁到期时间（`disabled` 时可选） |
| `ban_reason` | `string` | 否 | 封禁原因 |

::: danger 生产环境务必加鉴权
当前 admin 路由已强制 `requireAdmin` 中间件校验 `is_admin` 字段，但建议生产部署仍在前置网关层叠加权限校验（如 nginx basic auth、零信任网关），形成双重保护。
:::

## 初始化 API（/api/setup）

源码：`server/src/routes/setup.js`

用于首次部署时的班级初始化配置，配置 `pre_records` 名单、管理员账号等。

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/setup/status` | 查询初始化状态 | 否 |
| POST | `/api/setup/save` | 保存初始化配置 | 否（仅未初始化时可用） |

**GET /api/setup/status 响应**：

```json
{
  "code": 200,
  "message": "ok",
  "data": {
    "initialized": false,
    "admin_count": 0
  }
}
```

::: warning 一次性端点
`POST /api/setup/save` 仅在系统未初始化（`initialized === false`）时可用，初始化完成后该端点会返回 `403`。建议在生产部署后立即通过 nginx 屏蔽 `/api/setup/*` 路径。
:::

## 资源 API（/api/assets）

源码：`server/src/routes/assets.js`

提供静态资源列表查询，主要用于桌面壁纸、天气图标、广播内容等。

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/assets/wallpapers` | 列出可用壁纸 | 是 |
| GET | `/api/assets/weather-icons` | 列出天气图标 | 是 |
| GET | `/api/assets/broadcasts` | 列出广播内容 | 是 |

**GET /api/assets/wallpapers 响应**：

```json
{
  "code": 200,
  "message": "ok",
  "data": [
    { "id": "default", "name": "默认壁纸", "url": "/wallpapers/default.jpg" },
    { "id": "mountain", "name": "山脉", "url": "/wallpapers/mountain.jpg" }
  ]
}
```

## 等级 API（/api/level）

源码：`server/src/routes/level.js`

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/level/info` | 获取当前用户等级信息 | 是 |
| POST | `/api/level/log` | 记录经验获取日志 | 是 |
| POST | `/api/level/daily-login` | 每日签到（连续登录奖励） | 是 |

**GET /api/level/info 响应**：

```json
{
  "code": 200,
  "message": "ok",
  "data": {
    "user_id": "2024001",
    "exp": 1250,
    "level": 5,
    "last_login": "2026-08-21T00:00:00.000Z",
    "streak": 7
  }
}
```

::: tip 等级体系
ClassIntra 内置等级系统：每日签到、发帖、评论均可获取经验，连续登录有额外奖励。等级图标位于 `Resources/public/icons/level/`，从 `Lv0.svg` 到 `Lv6.svg`。
:::

## CDN 代理 API（/api/cdn）

源码：`server/src/routes/cdn-proxy.js`

通用 CDN 代理，受域名白名单与缓存策略约束。

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/cdn/proxy` | 代理获取远程资源 | 是 |
| POST | `/api/cdn/clear-cache` | 清空 CDN 缓存 | 管理员 |

**GET /api/cdn/proxy 查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `url` | `string` | 是 | 目标资源 URL |
| `ttl` | `number` | 否 | 缓存时间（秒），默认按响应头 `Cache-Control` |

::: warning 域名白名单
CDN 代理仅允许白名单域名（默认包含常见 CDN 如 `cdn.jsdelivr.net`、`fonts.googleapis.com` 等），其他域名返回 `403`。可通过 `CDN_WHITELIST` 环境变量扩展。
:::

## 系统 API（/api/system）

源码：`server/src/routes/system.js`

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/system/version` | 获取系统版本信息 | 否 |
| GET | `/api/system/heartbeat` | 心跳检测（前端定时调用） | 否 |
| GET | `/api/system/health` | 健康检查（数据库、内存、运行时长） | 否 |
| PUT | `/api/system/app-control` | 应用管控（启用/禁用桌面应用） | 管理员 |

**GET /api/system/heartbeat 响应**：

```json
{
  "code": 200,
  "message": "ok",
  "data": {
    "timestamp": 1787299957000,
    "server_time": "2026-08-21T10:00:00.000Z"
  }
}
```

**PUT /api/system/app-control 请求体**：

```json
{
  "app_name": "ai-chat",
  "enabled": false
}
```

应用管控相关概念详见 [核心概念 — 应用管控](/concepts/app-control)。

## 全局实时 API（/api/realtime）

源码：`server/src/routes/realtime.js`、`server/src/utils/realtime-bus.js`

该通道面向第三方市场应用和插件，使用 JWT 鉴权的 HTTP 长轮询，不依赖 Chat 应用或 WebSocket。

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| POST | `/api/realtime/poll/register` | 注册当前用户的实时轮询通道 | 是 |
| GET | `/api/realtime/poll?since=<timestamp>` | 获取指定时间后的事件，最长等待 25 秒 | 是 |
| POST | `/api/realtime/publish` | 发布扩展事件 | 是 |
| POST | `/api/realtime/poll/unregister` | 注销实时轮询通道 | 是 |

市场应用前端优先使用 `context.realtime`，例如：

```javascript
var stop = context.realtime.subscribe('my-app.updated', function(payload) {
  console.log('收到更新:', payload);
});

context.realtime.publish('my-app.updated', { id: 1 }, context.appName);
stop();
```

## 集成 API（/api/integrations）

源码：`server/src/routes/integrations.js`

为第三方系统集成提供 Token 签发、Origin 白名单、Webhook 接收能力。

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| POST | `/api/integrations/tokens` | 签发新集成 Token | 管理员 |
| GET | `/api/integrations/tokens` | 列出所有集成 | 管理员 |
| GET | `/api/integrations/tokens/:id` | 获取单个集成 | 管理员 |
| PUT | `/api/integrations/tokens/:id` | 更新集成（scopes/origins） | 管理员 |
| DELETE | `/api/integrations/tokens/:id` | 撤销 Token | 管理员 |
| POST | `/api/integrations/tokens/:id/regenerate-secret` | 重新生成 secret | 管理员 |
| GET | `/api/integrations/origins` | 获取 Origin 白名单 | 是 |
| POST | `/api/integrations/webhook` | 接收外部 Webhook | `X-Webhook-Token` |

**POST /api/integrations/tokens 请求体**：

```json
{
  "name": "校园大屏集成",
  "scopes": ["read:users", "read:broadcasts"],
  "origins": ["https://display.example.com"],
  "webhookUrl": "https://display.example.com/webhook",
  "ttlDays": 30
}
```

**成功响应**：

```json
{
  "code": 200,
  "message": "token 签发成功",
  "data": {
    "id": 1,
    "name": "校园大屏集成",
    "token": "ci_xxxxxxxxxxxxxxxx",
    "secret": "sec_xxxxxxxxxxxxxxxx",
    "scopes": ["read:users", "read:broadcasts"],
    "origins": ["https://display.example.com"],
    "created_at": "2026-08-21T10:00:00.000Z"
  }
}
```

::: tip Webhook 验证
`POST /api/integrations/webhook` 通过 `X-Webhook-Token` 头部携带集成 Token 进行认证。Webhook 接收方会校验 Token 有效性、Origin 白名单、scopes 权限，并通过 `webhookReceiver` 派发到对应的处理器。
:::

## AI 聊天 API（/api/ai-chat）

源码：`apps/ai-chat/backend/routes.js`（manifest 声明挂载，全局限流 30 次/分钟）

AI 聊天采用**模型注册表**（`ai_models` 表）驱动，支持接入任意 OpenAI 兼容模型。模型接入、启停与默认模型管理见 [配置项 → AI 配置](/deployment/configuration#ai-配置)。

### 模型

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/ai-chat/models` | 当前用户可见的模型列表（不含密钥） | 是 |
| GET | `/api/ai-chat/admin/models` | 全量模型列表（Key 掩码） | 系统管理员 |
| POST | `/api/ai-chat/admin/models` | 接入新模型 | 系统管理员 |
| PUT | `/api/ai-chat/admin/models/:id` | 编辑模型（Key 留空不覆盖） | 系统管理员 |
| DELETE | `/api/ai-chat/admin/models/:id` | 删除模型 | 系统管理员 |
| PUT | `/api/ai-chat/admin/models/:id/toggle` | 启用 / 停用（停用默认模型时自动迁移默认标记） | 系统管理员 |
| PUT | `/api/ai-chat/admin/models/default` | 设置全局默认模型 | 系统管理员 |
| POST | `/api/ai-chat/admin/models/test` | 测试连接（支持未保存的配置，15s 超时） | 系统管理员 |

**GET /api/ai-chat/models 响应**：

```json
{
  "code": 200,
  "data": {
    "models": [
      {
        "id": "glm-4-flash",
        "label": "智谱 GLM-4-Flash",
        "color": "#6366f1",
        "is_free": true,
        "supports_thinking": true,
        "supports_search": false,
        "is_default": false
      }
    ],
    "default_model": "default",
    "user_model": "glm-4-flash",
    "can_manage": false
  }
}
```

### 模型管理（AI 模型 tab，管理页内）

模型管理 UI位于 **管控中心 → AI 模型** tab（系统管理员与班管可见）。支持：

- **接入数量与来源不限**：每个模型独立 API 地址与密钥；API 地址填到 `/v1` 即自动补全 `/chat/completions`
- **单源多模型**：同一源接入多个模型时自动提示复用已有密钥（`reuse_key_from`，明文不出后端）
- **厂商模板**：智谱 GLM / DeepSeek / Kimi / Qwen / 硅基流动 / OpenAI 一键填充
- **模型级参数**：上下文预算（`max_context_tokens`，0 = 全局默认 10000）、单次输出上限（`max_output_tokens`）、思考强度（`reasoning_effort`，low / medium / high）
- 启停（控制用户可见性）、设默认、连接测试（15s 超时）、删除

### 使用策略（ai_policies）

策略 = 预设的模型授权方案（如「仅免费」「考试模式」），在管理页多选用户一次性应用。

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/ai-chat/admin/policies` | 策略列表（含默认策略标记） | 系统管理员/班管 |
| POST | `/api/ai-chat/admin/policies` | 创建策略（`model_ids` 空数组 = 不限制） | 系统管理员/班管 |
| PUT | `/api/ai-chat/admin/policies/:id` | 编辑策略 | 系统管理员/班管 |
| DELETE | `/api/ai-chat/admin/policies/:id` | 删除策略（默认策略不可删；引用用户自动回落默认策略） | 系统管理员/班管 |
| POST | `/api/ai-chat/admin/apply-policy` | 多选用户批量应用策略（`user_ids` + `policy_id`，空 `policy_id` = 解除限制） | 系统管理员/班管 |

策略解析规则：用户生效策略的允许集合之外视为不可用；请求模型、个人偏好、全局默认均被排除时，取策略内第一个可用模型；故障回落同样受策略约束。

### 聊天

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| POST | `/api/ai-chat/chat` | 同步对话（JSON 响应） | 是 |
| POST | `/api/ai-chat/chat/stream` | 流式对话（SSE） | 是 |

**POST /api/ai-chat/chat 请求体**：

```json
{
  "conversation_id": "uuid",
  "message": "你好",
  "model": "glm-4-flash",
  "thinking": true,
  "system_prompt": "可选，全局自定义提示词"
}
```

模型解析优先级：请求体 `model` > 用户保存的偏好 > 全局默认模型 > 首个可用模型。主模型请求失败时自动回落到默认模型，响应带 `fallback: true` 与实际使用的 `model` / `model_label` 字段。`thinking` 仅在所选模型声明了「深度思考」能力时生效。

**SSE 事件**（`text/event-stream`，逐行 `data: {...}`）：

| 事件 | 说明 |
| --- | --- |
| `{"content": "..."}` | 增量内容（`action: "replace"` 表示整段替换，用于搜索后重放） |
| `{"reasoning": "..."}` | 思考过程增量（思考模式） |
| `{"searching": true, "query": "..."}` | 联网搜索开始 / 结束 |
| `{"fallback": true, "model": "...", "model_label": "..."}` | 主模型失败，已切换备用模型 |
| `{"usage": {...}}` | Token 用量与缓存命中 |
| `{"error": "..."}` / `{"done": true}` | 错误 / 正常收尾 |

### 对话管理与设置

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET / POST | `/api/ai-chat/conversations` | 对话列表 / 新建 | 是 |
| GET / PATCH / DELETE | `/api/ai-chat/conversations/:id` | 对话详情 / 改标题与人设 / 删除 | 是 |
| PUT | `/api/ai-chat/conversations/:id/messages` | 整体覆盖消息（多选编辑后同步） | 是 |
| GET / PUT | `/api/ai-chat/settings` | 用户偏好（`system_prompt`、`pinned_conversations`、`model`） | 是 |

::: warning 管理端点权限
`/api/ai-chat/admin/*` 要求 `is_admin = 1`：系统管理员与**班管**（服务端登录时动态提升）有权限，班干（officer 角色）无权访问 —— 模型配置包含上游 API 密钥。`GET /models` 响应中的 `can_manage` 字段为服务端权威判定，前端管理入口以此展示。

管控中心用户管理页的「AI 策略」批量应用走同一权限体系；旧 DeepSeek 单独开关（`/admin/ai-settings/*` 的 deepseek 端点）已废弃移除。
:::

## 错误码列表

ClassIntra 服务端使用统一的业务状态码，与 HTTP 状态码通常一致：

| code | HTTP 状态码 | 含义 | 典型场景 |
|------|-----------|------|----------|
| 200 | 200 | 成功 | 正常请求 |
| 400 | 400 | Bad Request | 参数无效、字段缺失、密码强度不足 |
| 401 | 401 | Unauthorized | 未携带 Token、Token 无效、密码错误 |
| 403 | 403 | Forbidden | 账号被禁用、无管理员权限、域名不在白名单 |
| 404 | 404 | Not Found | 用户/资源不存在 |
| 409 | 409 | Conflict | 网名已占用、姓名已注册 |
| 429 | 429 | Too Many Requests | 限流触发，附 `Retry-After` |
| 500 | 500 | Internal Server Error | 服务端未捕获异常 |
| 503 | 503 | Service Unavailable | 中继服务器不可用 |

::: tip 前端统一拦截
前端 `utils/api.js` 在响应拦截器中读取 `response.data.code`，非 `200` 时通过 Vuex `toast` 模块弹出错误提示。401 会触发自动登出并跳转登录页（公开页面除外）。
:::

## 限流策略

ClassIntra 通过 `server/src/middleware/rate-limit.js` 实现基于内存的令牌桶限流：

| 端点类别 | 限流策略 | 触发响应 |
|---------|---------|---------|
| `/api/auth/login` | 每 IP 每分钟 10 次 | 429 + `Retry-After` |
| `/api/auth/register` | 每 IP 每小时 5 次 | 429 + `Retry-After` |
| `/api/auth/relay-verify` | 每 IP 每分钟 20 次 | 429 + `Retry-After` |
| `/api/integrations/webhook` | 每集成每秒 10 次 | 429 + `Retry-After` |
| 其他认证端点 | 每用户每分钟 60 次 | 429 + `Retry-After` |

::: tip 限流响应头
触发限流时响应头会附加：
- `X-RateLimit-Limit`：窗口期内最大请求数
- `X-RateLimit-Remaining`：剩余请求数
- `Retry-After`：建议重试秒数
:::

## 示例

### 注册新用户

```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "net_name": "小明同学",
    "real_name": "张三",
    "password": "StrongPass123!",
    "confirm_password": "StrongPass123!"
  }'
```

### 登录并保存 Token

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"account":"张三","password":"StrongPass123!"}'
```

### 刷新 Token

```bash
curl -X POST http://localhost:5001/api/auth/refresh-token \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -b cookies.txt
```

### 更新用户资料

```bash
curl -X PATCH http://localhost:5001/api/user/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"net_name": "新网名", "info": {"signature": "好好学习"}}'
```

### 修改密码

```bash
curl -X PUT http://localhost:5001/api/user/change-password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"old_password":"old","new_password":"new","confirm_password":"new"}'
```

### 管理员禁用用户

```bash
curl -X PATCH http://localhost:5001/api/admin/users/2024001/status \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"disabled","ban_reason":"违规操作","ban_expires_at":"2026-09-01 12:00:00"}'
```

### 发布广播通知

```bash
curl -X POST http://localhost:5001/api/admin/broadcasts \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"content":"今天下午 3 点开班会","priority":"high"}'
```

### 委任班干

```bash
curl -X POST http://localhost:5001/api/admin/officers \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"2024001","title":"班长","permissions":["manage_posts","manage_users"]}'
```

### 签到获取经验

```bash
curl -X POST http://localhost:5001/api/level/daily-login \
  -H "Authorization: Bearer <token>"
```

### CDN 代理获取资源

```bash
curl "http://localhost:5001/api/cdn/proxy?url=https://cdn.jsdelivr.net/npm/vue@2.7.16/dist/vue.min.js"
```

### 签发集成 Token

```bash
curl -X POST http://localhost:5001/api/integrations/tokens \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "校园大屏集成",
    "scopes": ["read:users", "read:broadcasts"],
    "origins": ["https://display.example.com"],
    "ttlDays": 30
  }'
```

### 接收 Webhook

```bash
curl -X POST http://localhost:5001/api/integrations/webhook \
  -H "X-Webhook-Token: ci_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"event":"display.update","data":{"screen":"main"}}'
```

### 系统健康检查

```bash
curl http://localhost:5001/api/system/health
```

### 应用管控

```bash
curl -X PUT http://localhost:5001/api/system/app-control \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"app_name":"ai-chat","enabled":false}'
```

## 相关文档

- [API 参考 — 总览](./index)
- [API 参考 — 前端 API](./client)
- [API 参考 — 类型定义](./types)
- [核心概念 — 认证与权限](/concepts/auth)
- [核心概念 — 应用管控](/concepts/app-control)
- [核心概念 — WebSocket 通信](/concepts/websocket)
- [部署运维 — 配置项](/deployment/configuration)
- [部署运维 — 监控运维](/deployment/monitoring)
