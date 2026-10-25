---
title: Cluss 集成
description: ClassIntra 与旁挂同校系统 Cluss 的四条集成通道：/cluss-app 同源反代、只读联动桥、认证联邦（RS256 公钥）与云盘 bot 硬链接转运。
outline: [2, 3]
---

# Cluss 集成

[Cluss](https://github.com/ClassIntra) 是旁挂在 ClassIntra 之外的**同校系统**（对话 / 批改 / 写作等，一班一节点）。它不在 ClassIntra 主仓库内，而是作为独立服务与 CI 并存于同一台服务器，通过四条通道与 ClassIntra 集成：

| 通道 | 代码位置 | 方向 | 用途 |
| --- | --- | --- | --- |
| `/cluss-app` 同源反代 | `server/src/routes/cluss-proxy.js` | CI → Cluss | HTTPS 域名下同源内嵌 Cluss 页面 |
| 只读联动桥 `/api/cluss-bridge` | `server/src/routes/cluss-bridge.js` | Cluss → CI | 校验账号、取名册、取学生画像 |
| 认证联邦 | `server/keys/jwt-public.pem` | Cluss ← CI | Cluss 用 CI 公钥验 token，免密登录 |
| 云盘 bot 硬链接转运 | `apps/resource/backend/bot-transfer.js` | CI → AstrBot | 云盘转存不复制字节，由 bot 硬链接原文件 |

::: tip 全部只读、零侵入
联动桥对 ClassIntra 现有逻辑零改动：不碰 auth 中间件、不碰用户表写入，只多挂一个路由前缀；四个端点全部只读。
:::

## /cluss-app 同源反代

`cluss-proxy.js` 把 `/cluss-app/*` 反代到本机 Cluss 服务 `http://127.0.0.1:9003`，并**剥掉 `/cluss-app` 前缀**——Cluss 以为自己仍在根路径。`/cluss-app`（无尾斜杠）302 到 `/cluss-app/`，保证资源相对路径解析标准形态。

为什么必须存在：ClassIntra 开 HTTPS 后，「应用壳里 iframe 一个 `http://<host>:9003` 的 Cluss」会被浏览器按**混合内容**直接拦掉（HTTPS 页面里的 HTTP iframe 属于 active mixed content，无开关可放行）。同源反代让 iframe 指向 `/cluss-app/`，浏览器看到的就是同一个 `https://<host>`，问题从根上消失。

两个关键实现决策：

- **挂在 HTTPS 实例的 request 监听层**（`server/src/app-https.js`），而不是 `app.use`：命中 `/cluss-app` 的请求**绕过全部 express 中间件**与 SPA 兜底——compression 会包装 `res`，SSE 长连接（Cluss 的对话 / 批改 / 写作全是 `/api/chat/stream` 类流式接口）经过它可能被攒着不发；`app.get('*')` 的 SPA 兜底若在前面也永远轮不到反代。
- **仅 HTTPS 实例挂载**：HTTP 实例（9001）不挂反代，因此该通道**仅 HTTPS 域名可用**。

与 Cluss 侧的约定：Cluss 前端资源用相对路径（vite `base: './'`）、API 前缀由页面路径推导；Cluss 的 token cookie 名（`cluss_token`）与 CI 的 token **不同名**，同域并存不互相覆盖。

## 只读联动桥 /api/cluss-bridge

让 Cluss 能校验 ClassIntra 账号，实现「CI 用户直接登录 Cluss」。鉴权头 `X-Bridge-Secret`，值与 `RELAY_SECRET` **共用同一密钥**（刻意不再新增一个要运维同步的密钥）；未配置 `RELAY_SECRET` 时直接拒绝服务（503），密钥比对用时序安全比较。

| 端点 | 说明 |
| --- | --- |
| `GET /ping` | 存活探测（Cluss 启动时判断联动是否可用） |
| `POST /verify` | 账号口令校验，**唯一**返回 `password_hash` 的端点 |
| `GET /class-roster` | 取某班名册（`year` + `classNo`，SQL 内按 user_id 编码精确限定，结构上不可能带出别的班） |
| `GET /student-profile` | 学生画像素材（逐列脱敏白名单） |

`/verify` 的返回（禁用账号回 `200` + `data.disabled`，便于 Cluss 侧区分「密钥不对」与「账号被禁用」）：

```json
{
  "code": 200,
  "data": {
    "disabled": false,
    "user": {
      "user_id": "25081801",
      "net_name": "网名",
      "real_name": "姓名",
      "password_hash": "…（供 Cluss 侧离线登录校验，同 relay-verify 既有约定）",
      "is_class_admin": true,
      "is_admin": false
    }
  }
}
```

`is_class_admin` / `is_admin` 班管标志供 Cluss 侧授予管理权。除 `/verify` 外其余端点不返回任何凭据类字段；手机号 / QQ / 微信 / 住址等隐私列一律不外传。

## 认证联邦（RS256 公钥）

ClassIntra 自 v1.4.0 起 JWT 签发统一为 **RS256**：私钥不出本机，需要验 CI token 的其他服务拿到的是**公钥**。Cluss 验 CI 签发的 token 用 `server/keys/jwt-public.pem` 公钥验签——**不再有共享 `CI_JWT_SECRET` 的说法**（旧方案已废弃）。

- Cluss 侧登录后的会话 token 由 CI 签发、Cluss 用公钥本地验签，免登进入；
- 跨班 / 离线校验走既有的 `POST /api/auth/relay-verify`，鉴权头 `X-Relay-Secret` == `RELAY_SECRET`（与联动桥同值）。

## 云盘 bot 硬链接转运

Cluss 的 AstrBot 机器人用 yt-dlp 下载的视频落在 `Resources/cloud/botmedia/remote/`。学生把这些文件转存进云盘时，ClassIntra（v1.5.0 起）**不再复制字节**，而是调 AstrBot 插件的转运接口把原文件**硬链接**进云盘：

```
学生点「转存云盘」
  → CI apps/resource/backend/bot-transfer.js
  → POST http://127.0.0.1:6200/api/cloud/transfer（AstrBot 插件）
  → bot 把原文件硬链接进 cloud/shared/<hash>（同盘零占用；跨盘回退普通复制）
  → CI 侧只写 DB 记录，物理层归 bot
```

- 转运接口**不可达时自动回退本地复制**，功能不中断；
- 环境变量（均在 `server/.env`，不配即走默认值）：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `BOT_TRANSFER_URL` | `http://127.0.0.1:6200` | AstrBot 插件 api_server 地址 |
| `BOT_TRANSFER_TOKEN` | 空 | 对应插件 `api_token`；留空 = 插件未开鉴权时不带头部 |
| `BOT_TRANSFER_TIMEOUT_MS` | `10000` | 转运超时（本地硬链接是毫秒级操作） |

存量治理：历史版本复制产生的重复文件可用 `scripts/cloud-bot-relink.mjs` 统一重链回收。

## 第三方实时事件

Cluss 相关的实时事件（班级状态同步等）走 ClassIntra 统一的第三方实时事件通道（自 v1.4.0）：WS 优先——上行经核心 WS 发消息 type `realtime_publish`，下行以 type `extension_event` 推给在线用户；HTTP 长轮询兜底。机制详见 [WebSocket 通信](/concepts/websocket)。
