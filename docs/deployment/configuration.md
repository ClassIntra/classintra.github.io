---
title: 配置项参考
description: ClassIntra 全部环境变量参考，按基础配置、认证、AI、天气、搜索、数据存储、中继、同步、VPN、日志分类，包含变量名、类型、默认值与说明。
---

# 配置项参考

ClassIntra 通过 `server/.env` 文件配置全部运行参数。本页面列出所有环境变量，按功能分类，便于查阅与排查。

::: tip 加载机制
环境变量由 `server/src/config/index.js` 在服务启动时读取，PM2 模式下由 `ecosystem.config.js` 自动注入。修改后需重启服务（`pm2 restart classintra-server`）生效。
:::

## 基础配置

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `PORT` | number | `9001` | HTTP 服务端口，提供 REST API 与静态前端 |
| `WS_PORT` | number | `10001` | WebSocket 服务端口，用于实时通讯 |
| `HTTPS` | boolean | `false` | 是否启用 HTTPS 模式（影响 cookie secure 标记） |
| `CORS_ORIGINS` | string | （空） | 允许跨域的前端域名，逗号分隔。生产环境建议显式指定 |

::: warning HTTPS 与 CORS
公网部署必须：
- `HTTPS=true` 启用 secure cookie
- `CORS_ORIGINS=https://your.domain.com` 限制跨域
:::

## 认证配置

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `JWT_SECRET` | string | **必填** | JWT 签名密钥，≥32 字符随机串，未设置则服务拒绝启动 |
| `JWT_EXPIRES_IN` | string | `7d` | JWT 过期时间，支持 `1h` / `7d` / `30d` 等 |
| `ADMIN_USER_IDS` | string | （空） | 班管 ID 列表，格式 `YYCC00`，逗号分隔，如 `250100,250200` |
| `DEV_PASSWORD` | string | （空） | 开发者测试账号密码，设置后创建 ID=`999999` 的开发者账号。**生产环境必须留空** |

::: tip 班管 ID 格式
`YYCC00` 含义：
- `YY` —— 届数（毕业年后两位，如 `25` = 2025 届）
- `CC` —— 班级编号（如 `08` = 8 班）
- `00` —— 固定后缀（标识班管身份）

班管不预创建账号，真实用户通过预注册名单注册后，系统匹配 `ADMIN_USER_IDS` 自动授予管理员权限。
:::

::: warning JWT_SECRET 安全
- 不可使用模板默认值 `change-this-to-a-secure-random-string-at-least-32-chars`
- 生成随机密钥：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- 密钥泄露后所有 JWT 失效，需重新签发
- 生产环境建议每 90 天轮换
:::

## AI 配置

ClassIntra 支持 OpenAI 兼容的 AI 服务（默认 GPT）与 DeepSeek 双通道。

### OpenAI 兼容

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `AI_API_KEY` | string | （空） | AI 服务 API Key |
| `AI_API_URL` | string | （空） | AI 服务接口地址，需兼容 OpenAI Chat Completions 格式 |
| `AI_MODEL` | string | `gpt-3.5-turbo` | 默认模型 |
| `AI_AVAILABLE_MODELS` | string | `gpt-4o-mini-2024-07-18,gpt-4o-mini` | 可切换模型列表，逗号分隔 |

### DeepSeek

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `DEEPSEEK_API_KEY` | string | （空） | DeepSeek API Key |
| `DEEPSEEK_API_URL` | string | `https://api.deepseek.com/chat/completions` | DeepSeek 接口地址 |
| `DEEPSEEK_MODEL` | string | `deepseek-chat` | 默认模型 |

::: tip 双模型切换
前端 AI 聊天支持 GPT 与 DeepSeek 双通道，用户可在对话中切换模型。DeepSeek 未配置时仅 GPT 可用。
:::

## 天气配置

ClassIntra 集成 [和风天气](https://www.qweather.com/) 服务，支持 API Key 与 JWT 两种鉴权方式。

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `QWEATHER_KEY` | string | （空） | 和风天气 API Key（基础鉴权） |
| `QWEATHER_LOCATION` | string | （空） | 默认城市坐标，格式 `经度,纬度`，如 `116.41,39.92` |
| `QWEATHER_API_HOST` | string | `devapi.qweather.com` | API 主机，免费版用 `devapi.qweather.com`，商业版用 `api.qweather.com` |
| `QWEATHER_KID` | string | （空） | JWT 鉴权 Credential ID（可选） |
| `QWEATHER_SUB` | string | （空） | JWT 鉴权 Subject（项目 ID） |
| `QWEATHER_PRIVATE_KEY` | string | （空） | JWT 鉴权 EdDSA 私钥（PEM 格式） |

::: tip 鉴权方式选择
- **API Key**：免费版默认，设置 `QWEATHER_KEY` 即可
- **JWT 鉴权**：商业版推荐，设置 `QWEATHER_KID` + `QWEATHER_SUB` + `QWEATHER_PRIVATE_KEY`，安全性更高
- 两种方式可共存，优先使用 JWT
:::

::: warning 私钥保护
`QWEATHER_PRIVATE_KEY` 是敏感信息，文件权限设为 600，**不可提交到 Git**。`server/.env` 已在 `.gitignore` 中。
:::

## 搜索配置

AI 聊天的联网搜索功能基于 [Tavily](https://tavily.com/)。

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `TAVILY_API_KEY` | string | （空） | Tavily API Key |
| `TAVILY_API_URL` | string | `https://api.tavily.com/search` | Tavily 搜索接口地址 |

::: tip 未配置时的行为
未设置 `TAVILY_API_KEY` 时，AI 聊天的「联网搜索」按钮不显示，但普通对话不受影响。
:::

## 数据存储配置

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `DB_PATH` | string | `./database/classintra.db` | SQLite 数据库文件路径（相对于 `server/`） |
| `RESOURCES_DIR` | string | `../Resources` | 静态资源根目录（相对 `server/`），存放照片、云盘、壁纸等 |

::: tip 数据库路径
- 默认存储在 `server/database/classintra.db`
- 启用 WAL 模式提升并发读写性能（`classintra.db-wal` 与 `classintra.db-shm` 是 WAL 附属文件，备份时一起复制）
- 路径可改为绝对路径，如 `/var/lib/classintra/db.sqlite`
:::

::: warning 备份完整性
SQLite 备份**必须**包含以下三个文件：
- `classintra.db` —— 主数据库
- `classintra.db-wal` —— WAL 日志
- `classintra.db-shm` —— 共享内存索引

缺失任一文件都可能导致数据不一致。
:::

## 中继配置

跨服务器中继（Relay）用于多班级、多机部署场景的消息同步。

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `RELAY_SERVERS` | string | （空） | 对端服务器列表，逗号分隔，格式 `host:port` |
| `RELAY_SECRET` | string | （空） | 中继共享密钥，所有节点必须一致 |
| `RELAY_SERVER_ID` | string | （空） | 本节点唯一标识，如 `server-a` / `class-1` |
| `RELAY_PORT` | number | `10011` | 本节点中继监听端口 |
| `COHORT` | string | （空） | 届数标识，逗号分隔，同届才同步；留空自动从 `ADMIN_USER_IDS` 推断 |

::: tip 配置示例
```bash
# 服务器 A
RELAY_SERVER_ID=server-a
RELAY_SERVERS=192.168.1.101:10011
RELAY_SECRET=<32 字符随机串>
RELAY_PORT=10011
COHORT=25

# 服务器 B
RELAY_SERVER_ID=server-b
RELAY_SERVERS=192.168.1.100:10011
RELAY_SECRET=<同 A 的密钥>
RELAY_PORT=10011
COHORT=25
```
:::

## 同步配置

[Syncthing](https://syncthing.net/) 用于跨服务器的资源文件同步（云盘、照片等），非中继消息。

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `SYNCTHING_HOST` | string | `localhost` | Syncthing REST API 主机 |
| `SYNCTHING_PORT` | number | `8384` | Syncthing REST API 端口 |
| `SYNCTHING_API_KEY` | string | （空） | Syncthing API Key |

::: tip 何时启用
仅在多机部署且需要共享大文件（如云盘资源）时启用 Syncthing。单机部署无需配置。Syncthing 服务需独立安装，详见 [Syncthing 文档](https://docs.syncthing.net/)。
:::

## VPN 配置

[Tailscale](https://tailscale.com/) 用于跨校区组网，无需开放公网端口。

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `TAILSCALE_ENABLED` | boolean | `false` | 是否启用 Tailscale 集成 |
| `TAILSCALE_RELAY_IP` | string | （空） | 对端服务器的 Tailscale IP（如 `100.64.0.1`） |
| `TAILSCALE_STATUS_CMD` | string | `tailscale status --json` | 检查节点状态的命令 |

::: tip Tailscale 与 Relay 配合
启用 Tailscale 后，`RELAY_SERVERS` 改为对端的 Tailscale IP：
```bash
TAILSCALE_ENABLED=true
RELAY_SERVERS=100.64.0.2:10011
```
:::

## 日志配置

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `VERBOSE_LOG` | number | `0` | 详细日志开关，`0` 关闭 / `1` 启用活动日志记录 |

::: warning 详细日志性能
`VERBOSE_LOG=1` 会记录每个 HTTP 请求、WebSocket 消息、Relay 同步事件，磁盘占用快速增长。**仅排查问题时临时启用**，排查后立即恢复为 `0`。
:::

## 配置示例

### 单班级最小配置

```bash
# server/.env —— 单班最小可用
PORT=9001
WS_PORT=10001

JWT_SECRET=<32 字符随机串>
JWT_EXPIRES_IN=7d

ADMIN_USER_IDS=250100
COHORT=25

DB_PATH=./database/classintra.db
RESOURCES_DIR=../Resources

# HTTPS=false（内网）
# CORS_ORIGINS=（留空，允许所有来源）
VERBOSE_LOG=0
```

### 公网生产配置

```bash
# server/.env —— 公网部署
PORT=9001
WS_PORT=10001

JWT_SECRET=<32 字符随机串>
JWT_EXPIRES_IN=7d

ADMIN_USER_IDS=250100
COHORT=25

# AI / 天气 / 搜索
AI_API_KEY=<your-key>
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4o-mini
QWEATHER_KEY=<your-qweather-key>
QWEATHER_LOCATION=116.41,39.92
TAVILY_API_KEY=<your-tavily-key>

# 安全
HTTPS=true
CORS_ORIGINS=https://classintra.example.edu

# 数据存储
DB_PATH=./database/classintra.db
RESOURCES_DIR=../Resources

# 关闭开发者后门
# DEV_PASSWORD=

# 关闭详细日志
VERBOSE_LOG=0
```

### 多班级中继配置

```bash
# 服务器 A（1 班）
PORT=9001
WS_PORT=10001
JWT_SECRET=<32 字符随机串>
ADMIN_USER_IDS=250100
COHORT=25
DB_PATH=./database/classintra.db

RELAY_SERVER_ID=class-1
RELAY_SERVERS=192.168.1.101:10011   # 2 班
RELAY_SECRET=<共享密钥>
RELAY_PORT=10011

# 服务器 B（2 班）
# PORT=9001
# WS_PORT=10001
# JWT_SECRET=<同 A，或不同>
# ADMIN_USER_IDS=250200
# COHORT=25
# RELAY_SERVER_ID=class-2
# RELAY_SERVERS=192.168.1.100:10011   # 1 班
# RELAY_SECRET=<同 A>
# RELAY_PORT=10011
```

::: warning 配置同步
所有中继节点的 `RELAY_SECRET` **必须完全一致**，否则握手失败。建议使用密码管理器分发，避免人工输入错误。
:::

## 环境变量优先级

ClassIntra 配置加载顺序（后者覆盖前者）：

```
1. server/.env 文件
       ↓
2. 系统环境变量（如 export PORT=9002）
       ↓
3. PM2 ecosystem.config.js 中的 env 字段
       ↓
4. 命令行参数（极少用）
```

::: tip 调试当前生效值
访问 `GET /api/system/health` 可查看运行中的部分配置（端口、版本）。完整配置需登录后访问管理后台查看。
:::

## 下一步

- [生产部署](./production) - 完整部署流程
- [教育场景](./education) - 班级部署实战
- [监控运维](./monitoring) - 日志与故障排查
- [API 参考](/api/) - 服务端 API 文档
