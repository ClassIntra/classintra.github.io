---
title: 服务端 API 参考
description: ClassIntra 服务端 HTTP + WebSocket 接口完整参考：认证、用户、管理、初始化、资源、等级、CDN 代理、系统、市场、集成等路由模块的端点表与请求/响应示例、通用响应格式、错误码、限流策略。
outline: [2, 3]
---

# 服务端 API 参考

ClassIntra 服务端由 Express 4 实现，对外暴露 HTTP 接口，覆盖认证、用户、管理、初始化、资源、等级、CDN 代理、系统、市场、集成、全局实时等模块。所有路由按文件拆分挂在 `/api/*` 前缀下，本页面是这些路由的完整参考手册。

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
- [全局实时 API（/api/realtime）](#全局实时-api-api-realtime)
- [集成 API（/api/integrations）](#集成-api-api-integrations)
- [市场 API（/api/market）](#市场-api-api-market)
- [错误码列表](#错误码列表)
- [限流策略](#限流策略)
- [示例](#示例)

## 基础信息

| 项目 | 值 |
| --- | --- |
| Base URL | `http://localhost:<port>` |
| 默认端口 | `9001`（后端 HTTP，占用自动顺延；前端开发服务器默认 `20001`） |
| 默认 Content-Type | `application/json`（除文件上传/下载、CDN 代理等明确说明外） |
| CORS | 默认开启，允许 `Origin: *`；生产环境通过 `CORS_ORIGINS` 配置白名单 |
| 允许方法 | `GET` / `POST` / `PUT` / `PATCH` / `DELETE` / `OPTIONS` |
| 允许请求头 | `Content-Type`、`Authorization`、`Cookie`、`X-Relay-Secret`、`X-ClassIntra-Token` |
| 暴露响应头 | `X-RateLimit-Limit`、`X-RateLimit-Remaining`、`Retry-After` |
| Cookie | `token`（httpOnly，`sameSite: 'lax'`，有效期 7 天） |

::: tip 端口与目录
- 前端开发服务器默认端口 `20001`，后端 API 默认端口 `9001`（`PORT` 可覆盖，占用自动顺延），生产部署时通过 `server/.env` 配置。
- 数据库文件路径由 `DB_PATH` 控制，默认 `./database/classintra.db`（server 相对路径，better-sqlite3 嵌入式数据库）。
- 静态资源由 `assets.js` 路由下发，默认目录 `server/public`（图标、壁纸、xgplayer 等）。
:::

## 认证机制

服务端使用两种并行的认证方式：

- **JWT Token**：登录/注册成功后返回 `token`，后续请求通过 `Authorization: Bearer <token>` 携带，同时也会写入 `token` Cookie（httpOnly）。
- **Cookie**：登录后服务端会设置 `token` Cookie，浏览器自动携带，配合 `withCredentials: true` 使用。

Token 由 `jsonwebtoken` 以 **RS256** 签发，包含 `user_id`、`net_name`、`real_name`、`is_admin`、`is_class_admin`、`role`、`officer_permissions`、`officer_title`、`gender` 等字段，有效期 7 天，通过 `jwtUtil.verifyToken` 校验（先按非对称算法白名单 RS256/RS384/RS512/ES256/ES384/ES512 验签，显式声明算法以防降级攻击；失败再退回 HS256 共享密钥，兼容过渡期的旧 Token）。

::: tip RS256 密钥管理
签名私钥只留在服务端本机：优先读取 `JWT_PRIVATE_KEY` 环境变量（PEM 文本或路径），未配置时默认使用 `server/keys/jwt-private.pem`（不存在则首次启动自动生成 RSA-2048 密钥对，公钥落 `server/keys/jwt-public.pem`）。私钥不出本机；外部服务需要验 Token 时，把 `server/keys/jwt-public.pem` 交给对方即可。`JWT_SECRET` 仅在过渡期用于验签尚未刷新的旧 Token，不再是必填项；私钥不可用且未配置 `JWT_SECRET` 时服务端拒绝签发。
:::

### 中继登录（跨班级）

ClassIntra 支持多班级中继登录：当本机数据库未找到用户时，会依次向 `config.relay.servers` 中的中继服务器发起 `POST /api/auth/relay-verify` 请求。该端点为服务间内部端点，鉴权头 `X-Relay-Secret` 必须与对端配置的 `RELAY_SECRET` 一致（`RELAY_SECRET` 同时用于跨班 Relay 消息同步与 Cluss 联动桥鉴权）。中继服务器校验账号密码并返回用户信息后，本机会落库并签发本机 Token。

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
| POST | `/api/user/change-password` | 修改密码 | 是 |
| GET | `/api/user/settings` | 获取用户设置（主题、壁纸、通知） | 是 |
| POST | `/api/user/settings` | 更新用户设置 | 是 |

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
    "hasPreRecords": true,
    "hasEnv": false,
    "cohorts": ["25"],
    "classes": ["08"],
    "preRecordCounts": {...},
    "dbUserCount": 0,
    "isFirstRun": true
  }
}
```

::: warning 一次性端点
`POST /api/setup/save` 仅在系统未初始化时可用，初始化完成后再调用会被鉴权中间件拒绝（需要 `auth + requireAdmin`），并不会返回 `403`。建议在生产部署后立即通过 Nginx 屏蔽 `/api/setup/*` 路径。
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
    { "id": "default", "name": "默认壁纸", "url": "/resources/public/wallpaper/default.jpg" },
    { "id": "mountain", "name": "山脉", "url": "/resources/public/wallpaper/mountain.jpg" }
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
| GET | `/api/system/relay-status` | 跨机（跨班）连通性诊断：对端可达性 + 最近同步时间 | 管理员 |
| GET | `/api/system/health` | 健康检查（数据库、内存、运行时长） | 否 |
| GET | `/api/system/app-control` | 获取启用的应用名列表（含锁屏开关，客户端据此过滤禁用应用） | 是 |

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

应用管控的启停在管理端完成：`GET /api/admin/app-control` 列出全部应用及启用状态（名单由 manifest-loader 动态扫描 `apps/*/manifest.json` 生成，并合并市场已安装应用），`PUT /api/admin/app-control/:appName` 更新启用状态（权限 `manage_app_control`；读取异常时降级为全部启用，变更后经 WS 广播 `market_app_control_changed`）。

**PUT /api/admin/app-control/:appName 请求体**：

```json
{
  "enabled": false
}
```

应用管控相关概念详见 [核心概念 — 应用管控](/concepts/app-control)。

## 全局实时 API（/api/realtime）

源码：`server/src/routes/realtime.js`、`server/src/utils/realtime-bus.js`

该通道面向第三方市场应用和插件，使用 JWT 鉴权，不依赖 Chat 应用。前端经 `context.realtime` 消费时**复用核心 WS 连接**（WebSocket 优先，X5/TBS/不支持时自动降级为 HTTP 长轮询）；下列 HTTP 端点保留给长轮询消费方与无 WS 环境。

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

## 应用级存储 API（/api/app-data）

供第三方应用保存**跟账号走**的数据：换设备、重装后登录即可取回。与 `context.data.storage`（本机缓存、卸载即清）互补。

| 方法 | 路径 | 说明 | 认证 |
|---|---|---|---|
| GET | `/api/app-data/:app/kv` | 列出键（不含值） | 登录 |
| GET | `/api/app-data/:app/kv/all` | 一次取回全部键值 | 登录 |
| GET | `/api/app-data/:app/kv/:key` | 读单个键 | 登录 |
| PUT | `/api/app-data/:app/kv/:key` | 写单个键，body `{ value }` | 登录 |
| DELETE | `/api/app-data/:app/kv/:key` | 删除单个键 | 登录 |
| GET | `/api/app-data/:app/blobs` | 文件列表 | 登录 |
| PUT | `/api/app-data/:app/blobs/:name` | 上传（原始字节 body，Content-Type 即文件类型） | 登录 |
| GET | `/api/app-data/:app/blobs/:name` | 下载 | 登录 |
| DELETE | `/api/app-data/:app/blobs/:name` | 删除文件 | 登录 |

边界与限额：

- 数据按 **(应用, 用户)** 隔离，用户之间互不可见；应用级共享数据只允许应用后端经服务代码写入，HTTP 不开放。
- 应用必须**已安装且未停用**：停用后连自己的数据也返回 403。
- 单值 ≤ 64KB，每人每应用 ≤ 500 键；单文件 ≤ 5MB，每人每应用 ≤ 50 个文件。
- 键名：字母/数字/`_`/`.`/`:`/`-`，1–128 位；文件名：字母/数字/`_`/`.`/`-`/空格，1–80 位。
- 数据**不随卸载删除**（用户可能重装）；需要彻底清理请在 `backend/cleanup.js` 里调 `ctx.appData.purge()`。
- 管理端接口：`GET /api/market/app-data-usage?name=` 查看占用；`POST /api/market/app-data-purge` 彻底清除（仅管理员）。
- 部署端可用 `MARKET_PURGE_APP_DATA_ON_UNINSTALL=1` 让卸载自动清数据。

前端 SDK 封装见 [第三方应用开发 § 云端数据](./../development/third-party#context-提供的能力)。

## 应用权限（/api/app-permissions）

第三方应用的敏感能力采用「声明 + 用时授权」两段式：`manifest.capabilities` 声明（安装页展示），首次调用时由使用者授权（按 应用 × 用户 记录）。

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/app-permissions/:app` | 我的授权状态：`sensitive`（该应用声明的敏感能力）+ `granted`（已授） | 登录 |
| POST | `/api/app-permissions/:app` | 授予/撤销本人：`{ capability, granted }` | 登录 |
| GET | `/api/app-permissions/admin/:app` | 全班授权汇总（按用户聚合） | 管理员 |
| POST | `/api/app-permissions/admin/revoke` | 代撤销：`{ name, userId?, capability? }`（都给则精确，只给 name 则清空该应用） | 管理员 |

敏感能力白名单（服务端权威）：`device.camera`、`device.microphone`、`system.notification`、`system.clipboard.read`。

- 应用未在 manifest 声明对应能力 → 400；声明 `system.clipboard` 视为覆盖 `system.clipboard.read`（父能力覆盖）。
- 应用被停用 → 403（停用状态不接受授权，也不该继续用）。
- 卸载**不删**授权记录（用户重装后不必再点）；需要清理时由应用在 `cleanup.js` 里处理业务数据。

## 集成 API（/api/integrations）

**机读契约**：`GET /api/integrations/v1/openapi.json`（免鉴权）返回 OpenAPI 3.0 描述，可直接导入 Postman / Apifox / Insomnia。接口字段以它为准，本文档与它不一致时视为 bug。


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
| POST | `/api/integrations/webhook` | 接收外部 Webhook | `X-ClassIntra-Token` |

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
`POST /api/integrations/webhook` 通过 `X-ClassIntra-Token` 头部携带集成 Token 进行认证。Webhook 接收方会校验 Token 有效性、Origin 白名单、scopes 权限，并通过 `webhookReceiver` 派发到对应的处理器。
:::

## 市场 API（/api/market）

源码：`server/src/routes/market.js`

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/market/sources` | 市场源列表（内置 + 环境变量 + 自定义，含 `builtin` / `base`） | 管理员 |
| POST | `/api/market/sources` | 添加自定义市场源，body `{ id, label, base }` | 管理员 |
| DELETE | `/api/market/sources/:id` | 删除自定义源（内置源与环境变量源不可删） | 管理员 |
| GET | `/api/market/catalog` | 市场目录（服务端代理拉取，`?source=` 指定市场源） | 管理员 |
| GET | `/api/market/asset` | 目录静态资源代理（应用图标等） | 否 |
| POST | `/api/market/install` | 安装应用 | 管理员 |
| POST | `/api/market/uninstall` | 卸载应用 | 管理员 |
| POST | `/api/market/plugin-toggle` | 启用 / 暂停插件 | 管理员 |
| POST | `/api/market/app-usage` | 应用打开心跳，body `{ name }` | 是 |
| POST | `/api/market/app-error` | 前端错误上报，body `{ name, message, stack, url }` | 是 |
| GET | `/api/market/app-health` | 应用健康度（`?name=` 单个，缺省全部） | 管理员 |

- **鉴权分层**：应用市场本身只对班管可见（`apps/market/manifest.json` 的 `visibleRoles: ["classAdmin"]`），接口层同口径——`/catalog`、`/sources`、`/plugins-installed`、`/themes-installed` 均要求管理员/班管。唯一例外是 **`/installed` 登录即可**：客户端要靠它注册第三方应用路由、渲染桌面图标，学生也必须能取。这样「学生看不到市场」不等于「学生用不了市场装的应用」。
- **`GET /api/market/asset?source=<sourceId>&path=<相对路径>`**：目录里的相对路径图标会被改写成该地址，由服务端代理拉取（路径校验 + 扩展名白名单 + 大小上限；SVG 响应附加禁止内联脚本的 CSP）。本地已安装应用的图标走 `/market-static/<name>/...`。
- **`POST /api/market/plugin-toggle`** 请求体 `{ "name": "<插件名>", "enabled": true|false }`：暂停后插件后端接口即时下线（请求期闸门，无需重启服务），成功后经核心 WS 广播 `plugin-paused` / `plugin-enabled` 事件。
- 应用安装 / 卸载成功后同样经 WS 广播 `market_app_changed`（action 为 `installed` / `uninstalled` 等）。市场还提供插件与主题的安装管理端点（`/installed`、`/plugins-installed`、`/themes-installed`、`/install-plugin`、`/install-theme` 等），此处不逐一列出。
- **`/api/market/app-health`** 返回每个已安装应用的 `metrics`（安装/更新次数）、`usage`（人数/次数/最近使用）、`errors`（总数/24h/最近一条）、`process`（进程型后端的运行状态）。这是**本地记账**，不上报中心服务器。
- **错误上报限流**：每会话每应用前端最多 5 条；服务端每小时最多落 500 条，且每应用只保留最近 200 条。

### 对外查询 API（/api/integrations/v1）

给「机器」用的只读业务接口：班级门户、大屏、外部统计脚本用集成 token 拉数据，不必共享管理员密码。

鉴权头：`X-ClassIntra-Token: <集成 token>`（不是 `Authorization: Bearer`，避免和用户 JWT 混淆）。

| 方法 | 路径 | 所需 scope | 说明 |
|---|---|---|---|
| GET | `/api/integrations/v1/whoami` | （无） | 自检：返回名称、scopes、到期时间 |
| GET | `/api/integrations/v1/users` | `user:read` | 用户列表，支持 `limit`（≤200）/`offset`/`q` |
| GET | `/api/integrations/v1/users/:userId` | `user:read` | 单个用户 |
| GET | `/api/integrations/v1/announcements` | `notification:read` | 公告列表，支持 `limit`/`offset`/`type` |
| GET | `/api/integrations/v1/apps` | `market:read` | 已安装市场应用（含启用状态） |
| GET | `/api/integrations/v1/stats` | `market:read` | 用户/公告/应用汇总 |
| POST | `/api/integrations/v1/announcements` | `notification:write` | 发布公告（支持幂等） |
| POST | `/api/integrations/v1/apps/:name/state` | `app:write` | 启用/停用应用（受保护应用拒绝） |

**写接口的幂等**：带 `Idempotency-Key: <8-128 位>` 时，24 小时内同键重复请求直接回放上次响应（响应头 `X-Idempotent-Replay: 1`），不会重复发公告。写操作会记入管理员日志，`admin_id` 为 `integration:<id>:<name>`，便于区分人/机器。

- 字段白名单：只返回 `user_id` / `net_name` / `real_name` / `level` / `exp` / `status` / `role` / `created_at` / `last_login`，**不含**密码哈希、隐私设置、联系方式、封禁原因。
- 缺少 scope → `403` 且错误信息点名缺哪个；token 无效/过期 → `401`。
- 每 token 每分钟 120 次，超限 `429` + `Retry-After`。

```bash
curl -H "X-ClassIntra-Token: ci_xxx" \
  "http://<服务器>:9001/api/integrations/v1/users?limit=20&q=张"
```

### 出站 Webhook（事件推送）

集成签发时填了 `webhookUrl`，且 `scopes` 命中事件所属范围，平台会在事件发生时向该地址 `POST` 一条 JSON。

| 事件 | 所需 scope | 触发时机 | `data` 主要字段 |
|---|---|---|---|
| `user.signed_in` | `user:read` | 登录成功 | `user_id` / `net_name` / `at` |
| `user.signed_out` | `user:read` | 登出 | `user_id` / `at` |
| `announcement.published` | `notification:write` | 管理员发布公告 | `id` / `title` / `type` / `author_id` |
| `market.app_installed` | `market:read` | 市场应用安装成功 | `name` / `version` / `source` / `operator` |
| `market.app_updated` | `market:read` | 市场应用更新成功 | `name` / `version` / `source` / `operator` |
| `market.app_uninstalled` | `market:read` | 市场应用卸载 | `name` / `operator` |
| `market.plugin_installed` / `_uninstalled` | `market:read` | 插件安装 / 卸载 | `name` / `version` |
| `market.theme_installed` / `_uninstalled` | `market:read` | 主题安装 / 卸载 | `id` / `version` |
| `app.enabled` / `app.disabled` | `app:read` | 管理端启用 / 停用应用（含第三方） | `name` / `label` / `source` / `operator` |

请求头：

```text
Content-Type: application/json
X-ClassIntra-Token: <集成 token>
X-ClassIntra-Event: <事件名>
X-ClassIntra-Timestamp: <毫秒时间戳>
X-ClassIntra-Signature: sha256=<hex>
```

请求体：

```json
{ "event": "app.disabled", "data": { "name": "pet", "source": "market" }, "timestamp": "1793366426735", "source": "classintra" }
```

**验签方式**（务必校验，否则任何人都能伪造请求）：

```js
const crypto = require('crypto');

// secret 只在签发时返回一次，请自行安全保存
function verify(secret, req) {
  const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
  const ts = req.headers['x-classintra-timestamp'];
  const got = String(req.headers['x-classintra-signature'] || '').replace(/^sha256=/, '');
  const expected = crypto.createHmac('sha256', secretHash)
    .update(ts + '.' + req.rawBody)          // 必须是原始字节，不要用 JSON.stringify 重新序列化
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}
```

::: warning 三个容易踩的点
- 签名密钥是 **`sha256(secret)`**，不是 secret 本身（服务端只存哈希，不存明文）。
- 参与签名的是 `timestamp + '.' + 原始请求体`，重新序列化会导致空格/字段顺序变化 → 验签失败。
- 当前投递**不重试**，失败只记日志；需要可靠送达请在接收端做幂等 + 自行补偿。
:::


**`GET /api/system/relay-status`**（管理员）：排查「另一班登不上 / 看不到另一班数据」的第一手工具。返回每个 `RELAY_SERVERS` 对端的 HTTP 可达性（3 秒超时）、延迟、失败原因，以及本机的 `last_sync_time` 与各类同步水位。对端不可达时 `peers[].reachable=false`、`error` 为 `TIMEOUT` 或 `ECONNREFUSED`。

::: warning 跨班账号的密码不在本班库里
跨机同步**不复制 `password_hash`**：对方班的用户行同步到本机后密码列为空。
登录这类账号时，服务端会拿账号密码去对端 `/api/auth/relay-verify` 验证（带 `X-Relay-Secret`）。
因此对端机器离线时，跨班账号**必然登录失败**——这是架构使然，不是密码错。
本机此时返回 `code: 503` 并提示「对方班级服务器不可达」，不要把这类失败当成密码错误。
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
curl -X POST http://localhost:9001/api/auth/register \
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
curl -X POST http://localhost:9001/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"account":"张三","password":"StrongPass123!"}'
```

### 刷新 Token

```bash
curl -X POST http://localhost:9001/api/auth/refresh-token \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -b cookies.txt
```

### 更新用户资料

```bash
curl -X PATCH http://localhost:9001/api/user/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"net_name": "新网名", "info": {"signature": "好好学习"}}'
```

### 修改密码

```bash
curl -X PUT http://localhost:9001/api/user/change-password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"old_password":"old","new_password":"new","confirm_password":"new"}'
```

### 管理员禁用用户

```bash
curl -X PATCH http://localhost:9001/api/admin/users/2024001/status \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"disabled","ban_reason":"违规操作","ban_expires_at":"2026-09-01 12:00:00"}'
```

### 发布广播通知

```bash
curl -X POST http://localhost:9001/api/admin/broadcasts \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"content":"今天下午 3 点开班会","priority":"high"}'
```

### 委任班干

```bash
curl -X POST http://localhost:9001/api/admin/officers \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"2024001","title":"班长","permissions":["manage_posts","manage_users"]}'
```

### 签到获取经验

```bash
curl -X POST http://localhost:9001/api/level/daily-login \
  -H "Authorization: Bearer <token>"
```

### CDN 代理获取资源

```bash
curl "http://localhost:9001/api/cdn/proxy?url=https://cdn.jsdelivr.net/npm/vue@2.7.16/dist/vue.min.js"
```

### 签发集成 Token

```bash
curl -X POST http://localhost:9001/api/integrations/tokens \
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
curl -X POST http://localhost:9001/api/integrations/webhook \
  -H "X-ClassIntra-Token: ci_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"event":"display.update","data":{"screen":"main"}}'
```

### 系统健康检查

```bash
curl http://localhost:9001/api/system/health
```

### 应用管控

```bash
curl -X PUT http://localhost:9001/api/admin/app-control/music \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"enabled":false}'
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
