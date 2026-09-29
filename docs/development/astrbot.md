---
description: AstrBot 机器人接入插件（astrbot-relay）——机器人以独立真实账号登录 ClassIntra，通过 OneBot v11 反向 WS 或 AstrBot HTTP 直调接入完整 AI 管线，并内置只读信息共享与管理代理两类能力。
---

# AstrBot 机器人接入（astrbot-relay）

`astrbot-relay` 让一个 **AstrBot 机器人**（如「林晞」）以**独立真实账号**成为 ClassIntra 的一等居民：
用户像私聊普通同学一样私聊它，消息经插件送入 AstrBot 的完整管线（人设 / 插件 / 记忆 / 指令系统），
回复再以机器人身份发回站内。

插件源码维护在 [market 仓库](https://github.com/ClassIntra/market) 的 `plugins/astrbot-relay/`，
运行时部署到班级服务器的 `plugins/` 目录（聚合器自动扫描挂载）。

::: tip 与「跨班中继」的区别
本页讲的是**机器人接入**（插件 `astrbot-relay`）。
[WebSocket 通信](./../concepts/websocket) 里的「中继 Relay」是**多班服务器之间的聊天消息同步**，二者完全不同名、不同物。
:::

## 架构

当前推荐部署为**同机运行**（ClassIntra 与 AstrBot 在同一台机器），无 SSH / 隧道 / 外网依赖：

```
用户私聊「林晞」
  → ClassIntra WS（10001）→ 本插件（机器人账号在线）
  → ① OneBot v11 反向 WS（ws://127.0.0.1:6199/ws，X-Client-Role: universal）
     ② 或 AstrBot HTTP 直调（http://127.0.0.1:6200/api/chat）
  → AstrBot 管线：parser(B站解析) / music(点歌) / meme_manager(表情包) / LLM / 记忆…
  ← AstrBot 下发 send_private_msg（消息段数组）/ SSE 流
  ← base64:// 与 file:// 媒体段 → 复制到 Resources/astrbot/remote/ → 站内 URL
  ← 按句末标点分段，以机器人身份发出
```

插件后端由四个模块组成：

| 文件 | 职责 |
| --- | --- |
| `backend/relay.js` | 主中继：CI WS ↔ AstrBot 双向消息编排、媒体落盘、身份同步、社区读写 |
| `backend/routes.js` | 对外 HTTP 端点（状态 / 发帖 / 信息共享 / 管理代理） |
| `backend/bot-user.js` | 机器人账号的自举与网名同步（`users.net_name` 唯一来源） |
| `backend/info.js` | **站内信息共享**：只读取数（公告 / 快讯 / 资源仓库 / 天气） |
| `backend/manage.js` | **管理代理**：机器人代管 ClassIntra 的 op 白名单与两段式确认闸门 |

## 双向插件：ClassIntra 与 AstrBot 两边都要装

机器人接入是**双边**链路——两侧各需要一个插件，缺任一边都不通。这是接 AstrBot 时最容易踩的坑：
「我明明装了插件，为什么机器人不说话？」通常就是只装了一边。

```
ClassIntra 侧                                AstrBot 侧
plugins/astrbot-relay/             ←→        astrbot_plugin_classintra/
· 机器人账号登录 CI WS（10001）               · 注册 aiocqhttp 反向 WS 适配器
· OneBot v11 反向 WS 客户端                   · 人设 / 记忆 / 风格卡
· 媒体段落盘为站内资源                         · LLM 工具层（发帖 / 管理代理 op）
· /api/astrbot/*（状态 / 发帖 / 信息 / 管理）    · HTTP /api/chat、/api/chat/health
```

| 侧 | 插件 | 缺失时的表现 |
| --- | --- | --- |
| ClassIntra | `plugins/astrbot-relay`（本页主题） | 没有 LLM 管线——机器人不会有人设 / 工具 / 记忆 / 表情包 |
| AstrBot | `astrbot_plugin_classintra` | 连不上 CI WS——消息发不出去、也收不回来 |

### 判断「两边都装好了」

| 侧 | 判据 |
| --- | --- |
| ClassIntra | `GET /api/astrbot/status`（管理员会话）→ `data.connected === true` **且** `data.onebot.connected === true` |
| AstrBot | `GET /api/chat/health` 返回 `code: 200`，且 WebUI 中 `aiocqhttp` 适配器处于**已连接** |

两侧都满足后，用任意账号私聊机器人应能触发完整回复（例如发 B 站链接 → parser 回视频）。

### 两侧必须一致的共享配置

| 配置 | ClassIntra 侧（`server/.env`） | AstrBot 侧 |
| --- | --- | --- |
| 反向 WS 地址 | `ASTRBOT_WS_URL=ws://127.0.0.1:6199/ws` | `aiocqhttp` 适配器 `ws_reverse_host` / `ws_reverse_port` |
| 反向 WS 令牌 | `ASTRBOT_WS_TOKEN` | 适配器 token |
| 发帖共享密钥 | `ASTRBOT_PUBLISH_KEY` | 插件配置 `publish_key` |
| 机器人账号 | `BOT_USER_ID` / `BOT_NET_NAME` / `BOT_REAL_NAME` | ——（显示名以 CI `users.net_name` 为唯一来源） |

---

## 安装与配置

1. 确认插件位于班级服务器 `plugins/astrbot-relay/`（聚合器自动挂载）。
2. 在 `server/.env` 追加（完整键见仓库根 `server/.env.example`）：

```dotenv
# ===== AstrBot 接入（OneBot v11）=====
BOT_USER_ID=linxi_ai          # 机器人账号（幂等自动创建）
BOT_NET_NAME=白露未晞          # 显示网名（唯一来源 users.net_name）
BOT_REAL_NAME=林晞            # 真实姓名
BOT_PASSWORD=改成强密码        # 必填（同时用于自动建号与 WS 登录）
BOT_GENDER=女

ASTRBOT_WS_URL=ws://127.0.0.1:6199/ws   # AstrBot aiocqhttp 反向 WS
ASTRBOT_WS_TOKEN=                        # 反向 WS 令牌（与适配器配置一致）
AB_MAX_SEGMENTS=3             # 单次回复最多分段数（避免触发发送限流）
ASTRBOT_PUBLISH_KEY=改成长随机串 # 站内接口共享密钥（与 AstrBot 端插件 publish_key 一致）
# AB_ALLOWED_USERS=250800     # 留空 = 所有人可用
```

3. **AstrBot 侧**：WebUI → 机器人 → 新增 `aiocqhttp` 适配器（`ws_reverse_host=127.0.0.1`、`ws_reverse_port=6199`）。
4. 重启 ClassIntra 后端。启动时插件自动：
   - 在 `users` 表创建机器人账号（幂等）；
   - 登录 CI WS 并保持长连接（断线 3s 起指数退避重连，JWT 过期自动重登）；
   - 连入 OneBot 反向 WS（握手需 `X-Client-Role` 与 `X-Self-ID` 头，缺一即 400）。

::: warning 需要重启
插件加载在服务器启动阶段完成，**修改 `.env` 后需重启 `classintra-server`**（`pm2 restart classintra-server`）才生效。
:::

## 消息段映射

**AstrBot → CI（出站）**

| OneBot 段 | ClassIntra 呈现 |
| --- | --- |
| `text` | 文本（按句末标点分段，300–800ms 间隔模拟真人连发，默认上限 `AB_MAX_SEGMENTS` 段） |
| `image` / `record` / `video`（`base64://` 或 `file://`） | 落盘 `Resources/astrbot/remote/`，以 `/resources/...__image/__audio/__video` 站内 URL 发送 |
| `file`（`file://` URI） | 同上落盘发送 |
| `music(custom)` | `🎵 标题 链接` 文本 |
| `at` | `@昵称` 文本 |
| `reply` | `（回复：原文摘要…）` 前缀 |
| `location` / `share` / `poke` / `contact` | 对应中文提示文本 |
| `nodes`（合并转发） | 展平为多条文本 / 媒体 |
| `json` / `xml` 卡片 | 提取标题与跳转链接 |

**CI → AstrBot（入站）**

| CI 消息 | OneBot 段 |
| --- | --- |
| `text` / `ai_forward` | `text`（`ai_forward` 提取正文） |
| `[cloud-img:hash.ext]` | `image`（base64，多模态模型可直接看图） |
| `[cloud-audio:hash.ext]` | `record`（base64，可走 ASR） |
| `[cloud-video:hash.ext]` | `video`（`file://` 本机路径） |
| 消息撤回 `message_recalled` | notice: `friend_recall` / `group_recall` |
| 连接 / 心跳 | meta_event: `lifecycle(connect)` / `heartbeat(30s)` |

## 支持的 OneBot action

- **消息**：`send_private_msg` / `send_msg` / `send_group_msg` / `send_private_forward_msg` / `send_group_forward_msg` / `delete_msg`
- **信息**：`get_msg` / `get_login_info` / `get_stranger_info` / `get_friend_list` / `get_version_info` / `get_status`
- **群**：`get_group_list` / `get_group_info` / `get_group_member_list` / `get_group_member_info`（查询 CI 数据库实时返回，群成员 / 群名真实）
- **媒体**：`get_image` / `get_record` / `can_send_image` / `can_send_record`
- **群管 / 文件类**（CI 无对应能力）：`set_group_*` / `upload_*_file` / `get_*_file_url` 等受理返回 `ok`，不中断管线
- 未识别 action 一律返回 `ok` 空数据

## HTTP 端点

除 `/status` 与 `/publish` 外，信息共享与管理代理统一走 `x-publish-key` 请求头鉴权
（值 = `ASTRBOT_PUBLISH_KEY`）。

| 端点 | 鉴权 | 说明 |
| --- | --- | --- |
| `GET /api/astrbot/status` | 管理员会话 | 机器人连接状态（CI WS / OneBot 双通道） |
| `POST /api/astrbot/publish` | `x-publish-key` | 以机器人账号在社区论坛发帖（支持附图，最多 9 张） |
| `GET /api/astrbot/info/*` | `x-publish-key` | 站内信息共享只读源（见下） |
| `GET /api/astrbot/manage/ops` | `x-publish-key` | 拉取管理 op 白名单目录 |
| `POST /api/astrbot/manage` | `x-publish-key` | 执行管理 op（受两段式确认闸门约束） |

## 站内信息共享（只读）

`backend/info.js` 让机器人以「ClassIntra 一等居民」身份读取站内公开信息，而不是靠猜。
读的是 CI 自己的库 / 配置 / 服务，零侵入应用代码：

| 端点 | 数据源 |
| --- | --- |
| `/info/announcements` | 公告 |
| `/info/broadcasts` | 快讯 |
| `/info/forum`、`/info/post/:id/comments` | 社区帖子与回帖（按可见性分组，等价于一个真实普通用户所见） |
| `/info/resources` | 资源仓库 |
| `/info/weather` | 天气 |
| `/info/pulse` | 站点脉搏（在线 / 活跃概览） |

涉及「按性别分组的可见性」与写权限的社区操作（读帖、读评论、发评论）走 `relay.js` 中带机器人自身 JWT
调 CI 自身路由的路径，**保证机器人看到的、能做的与一个真实普通用户完全一致**。

## 管理代理（受授权约束）

`backend/manage.js` 让机器人**以自己的账号**代管 ClassIntra。链路为：

```
AstrBot 工具 classintra_admin
  → CI POST /api/astrbot/manage（op 名 + 参数，无路径注入）
  → manage.js 按 OPS 白名单解析为 { method, path, body }
  → 自签机器人 JWT 打本机 /api/admin/*
  → 复用 CI 原有 WS 广播 / 墓碑 / 水位 / 审计，零逻辑漂移
```

- **授权**：管理代理的授权人仍是真人（CI `ADMIN_USER_IDS` / AstrBot 端 `owner_user_ids`），**仅他本人可指挥**；
  机器人账号通过 `BOT_ADMIN_IDS` 获得 `isSystemAdmin()` 豁免（可跨班），**不是**冒用授权人账号。
- **审计**：`admin_logs` 中 `admin_id` = 授权人，`action` 前缀为「林晞代理:」，`detail` 记录 `executor`。
- **两段式闸门**：标 `destructive` 的 op **不会立即执行**——
  第一次调用只返回动作复述并记为 pending；需再由授权人发一条**确认语**（`classintra_admin_confirm`）才真正执行。
  确认校验锚定在**提议之后的新消息**（按 `message_id` 比对，防模型自问自答）；疑问句或超长文本一律视为非确认；
  `classintra_admin_cancel` 可撤销。

**op 白名单（24 项）**——AstrBot 只能传 op 名与参数，**无法指定 URL / 方法**：

| 分组 | op |
| --- | --- |
| 公告 | `announce_publish` / `announce_edit` / `announce_pin` / `announce_delete`* / `announce_list` |
| 快讯 | `broadcast_publish` |
| 聊天 | `chat_clear`* / `chat_delete_message`* |
| 用户 | `user_list` / `user_ban`* / `user_unban` / `user_update`* / `user_reset_password`* / `user_delete`* |
| 设备 | `lock_screen_set`* / `lock_screen_get` |
| 应用 | `app_control_list` / `app_control_set`* |
| 服务器 | `server_mode_set`* / `pm2_status` / `pm2_restart`* / `pm2_stop`* / `pm2_start` / `server_stats` |

> `*` = `destructive`，需两段式确认。

**全体令牌**：`user_ban` / `user_unban` 的 `target` 支持 `all` 与 `all_except_<用户…>`。
范围 = 全部**非管理员、非班管**用户；命中后 relay 只发**一个**请求打 CI 的 `POST /api/admin/users/bulk-status`
（单次循环 UPDATE + 一次审计），避免上百次串行 PATCH 撞超时。

## 媒体与表情包（内网零外网加载）

- **AI 生成的图片 / 语音 / 视频 / 文件**：媒体段 / SSE 事件 → 从 AstrBot 数据目录
  （`attachments`，缺省回退 `webchat/imgs`）**同机复制**到 `ClassIntra/Resources/astrbot/remote/`，
  以 `/resources/...__image/__audio/__video` 站内 URL 发送，前端原生渲染。
- **表情包 `&&标签&&`**：独占一行的表情标记映射为 `Resources/astrbot/emoji/<标签>.png|gif…` 的站内图片 URL；
  没有对应图片文件时保留原文本。把真实表情图放入 `emoji` 目录即可生效。

## 验证

```bash
curl http://localhost:9001/api/astrbot/status
# → { "onebot": { "connected": true }, ... }
```

用另一个账号私聊机器人：发 B 站链接 → `parser` 自动回视频；`点歌 歌名` → `music` 回歌曲。

## 故障排查

| 现象 | 排查 |
| --- | --- |
| `onebot.connected: false` | AstrBot 未启动或 6199 未监听；握手需带 `X-Client-Role` 与 `X-Self-ID`，缺一即 400 |
| 媒体「资源加载失败」 | `file://` 指向的文件不存在或已被清理 |
| 回复报 402 | 聊天模型 Key 余额不足（`parser` / `music` 等插件不依赖 LLM，不受影响） |

## 已知边界

- **群聊 @触发、语音输入**暂未实现（私聊优先）。
- ClassIntra 私聊 WS 限流 **30 条/分钟**（服务端约束），机器人回复计入同一额度——这也是 `AB_MAX_SEGMENTS` 存在的理由。
- `AB_ASYNC_ENABLED` 异步模式当前未启用（同机部署无隧道需求，同步即可）。
