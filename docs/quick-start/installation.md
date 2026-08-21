---
title: 安装
description: ClassIntra 完整安装指南，包含环境准备、克隆仓库、依赖安装（.npmrc build_from_source=false）、环境变量配置、数据库初始化、启动开发服务器与首次配置向导。
---

# 安装

本页面介绍 ClassIntra 的完整安装与启动流程，覆盖环境准备、依赖安装、环境变量、数据库初始化、首次配置与常见问题排查。

## 环境准备

ClassIntra 采用 pnpm workspace monorepo 架构，前端基于 Vite 5 + Vue 2.7，后端基于 Node.js + Express 4 + better-sqlite3。请确保已安装以下工具：

### 依赖清单

| 工具 | 最低版本 | 推荐版本 | 用途 | 安装命令 |
|------|---------|---------|------|---------|
| **Node.js** | 18.0.0 | 18 LTS / 20 LTS | 前后端运行时 | [nodejs.org](https://nodejs.org/) |
| **pnpm** | 8.0.0 | 8.15+ / 9.x | monorepo 包管理 | `npm install -g pnpm` |
| **Git** | 2.20+ | 最新版 | 克隆仓库与版本管理 | [git-scm.com](https://git-scm.com/) |
| **ffmpeg** | — | 最新版（可选） | 视频流式转码 | [ffmpeg.org](https://ffmpeg.org/) |

::: warning 版本要求
- Node.js 必须 ≥ 18，否则 `better-sqlite3` 等依赖无法安装
- pnpm 推荐 8.15+，避免 workspace 依赖解析冲突
- ffmpeg 仅在需要 MKV/MP4 视频流播放时安装
:::

### 安装 Node.js 与 pnpm

:::: details Windows 系统
1. 从 [Node.js 官网](https://nodejs.org/) 下载 LTS 安装包（推荐 18 LTS）
2. 安装后打开 PowerShell 验证：
   ```powershell
   node -v   # 应输出 v18.x.x
   npm -v
   ```
3. 启用 pnpm：
   ```powershell
   npm install -g pnpm
   pnpm -v
   ```
::::

:::: details macOS 系统
推荐使用 [Homebrew](https://brew.sh/)：
```bash
brew install node@18
npm install -g pnpm
```

或使用 [nvm](https://github.com/nvm-sh/nvm)：
```bash
nvm install 18
nvm use 18
nvm alias default 18
npm install -g pnpm
```
::::

:::: details Linux 系统
```bash
# Node.js (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
npm install -g pnpm
```
::::

## 克隆仓库

```bash
git clone https://github.com/ClassIntra/ClassIntra.git
cd ClassIntra
```

::: tip 镜像加速
国内用户若访问 GitHub 较慢，可使用镜像加速：
```bash
# ghproxy 镜像
git clone https://ghproxy.com/https://github.com/ClassIntra/ClassIntra.git
```
:::

仓库结构如下（节选）：

```
ClassIntra/
├── apps/                    # 应用（前端页面 + 可选后端 + 小组件）
│   ├── ai-chat/             # AI 对话
│   ├── chat/                # 即时通讯
│   ├── community/           # 社区论坛
│   ├── music/               # 音乐播放
│   ├── notes/               # Markdown 笔记
│   ├── resource/            # 资源仓库 + 云盘
│   ├── weather/             # 天气系统
│   ├── settings/            # 个人设置
│   ├── admin/               # 管理后台
│   └── ...
├── client/                  # Vue 2.7 前端（桌面、登录、路由、Vuex）
├── server/                  # Node.js + Express 后端
│   ├── src/                 # 路由、WebSocket、中间件、服务
│   ├── .env.example         # 环境变量模板
│   ├── database/            # SQLite 数据库（自动创建）
│   └── public/              # 静态资源 + setup.html
├── shared/                  # 前后端共享层
├── Resources/               # 用户自行管理的静态资源
├── .npmrc                   # build_from_source=false
└── package.json
```

## 安装依赖

ClassIntra 使用 pnpm workspace 管理 monorepo，根目录 `pnpm-workspace.yaml` 声明了 `client`、`server`、`apps/*`、`plugins/*`、`shared` 等 workspace。

在项目根目录执行：

```bash
pnpm install
```

此命令会一次性安装所有 workspace 的依赖，并自动建立 workspace 内部链接。

### 关于 .npmrc

项目根目录 `.npmrc` 已配置：

```ini
; 优先使用预编译包（避免 better-sqlite3 等原生模块在本机工具链缺失时编译失败）
; 当预编译包不可用时自动回退到源码编译
build_from_source=false
```

这一配置确保 `better-sqlite3` 等原生模块优先下载预编译二进制，避免本机缺少 C++ 工具链（如 Windows 的 Visual Studio Build Tools 或 Linux 的 `build-essential`）时编译失败。若预编译包不可用，会自动回退到源码编译。

::: tip 原生模块编译失败
若 `pnpm install` 在 `better-sqlite3` 步骤报错：
1. 确认 Node.js 版本 ≥ 18
2. Windows 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
3. Linux 执行 `sudo apt-get install -y build-essential python3`
4. 临时绕过：`pnpm install --ignore-scripts`（不推荐，会跳过原生模块编译）
:::

::: warning 常见问题
- **Node 版本不匹配**：请确保 `node -v` ≥ 18
- **网络问题**：可配置 `.npmrc` 使用淘宝镜像：
  ```ini
  registry=https://registry.npmmirror.com
  ```
- **peer 依赖冲突**：可尝试 `pnpm install --strict-peer-dependencies=false`
:::

## 环境变量配置

ClassIntra 通过 `server/.env` 读取配置，首次安装需从模板复制：

```bash
cp server/.env.example server/.env
```

### 必填变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `JWT_SECRET` | JWT 签名密钥（≥ 32 字符随机串） | `your-secure-random-string-at-least-32-chars` |

### 常用变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `ADMIN_USER_IDS` | 班管 ID（逗号分隔，格式 `YYCC00`） | `250100` 或 `250100,250200` |
| `QWEATHER_KEY` | 和风天气 API Key | `your-qweather-api-key` |
| `AI_API_KEY` | AI 服务 API Key（OpenAI 兼容） | `your-ai-api-key` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | `your-deepseek-api-key` |
| `TAVILY_API_KEY` | Tavily 联网搜索 API Key | `your-tavily-api-key` |
| `DEV_PASSWORD` | 开发者测试账号密码（ID: 999999） | `dev123456` |
| `COHORT` | 届数（跨班级中继过滤） | `25` |

编辑 `server/.env` 文件，至少设置 `JWT_SECRET`：

```bash
# 编辑 .env
# Windows: notepad server/.env
# macOS / Linux: nano server/.env
```

::: warning JWT_SECRET 必须设置
`JWT_SECRET` 是 JWT 签名密钥，**必须**设置为 ≥ 32 字符的随机串。若保留模板默认值或留空，服务启动时会被拒绝。可使用以下命令生成：
```bash
# 生成 32 字符随机串
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
:::

::: warning 班管 ID 格式说明
`ADMIN_USER_IDS` 格式为 `YYCC00`：
- `YY` —— 届数（毕业年份后两位，如 `25` = 2025 届）
- `CC` —— 班级编号（如 `01` = 1 班）
- `00` —— 固定后缀（标识班管身份）

例如 `250100` 表示 25 届 01 班班管。多班级用逗号分隔：`250100,250200`。

班管**不预创建账号**，真实用户通过预注册名单注册后，系统匹配 `ADMIN_USER_IDS` 即自动获得管理员权限。请确保预注册名单（`server/config/pre-records.json`）中包含对应 `user_id` 的用户姓名。
:::

## 数据库初始化

ClassIntra 使用 `better-sqlite3` 嵌入式数据库，**无需手动创建**。首次启动后端时，`server/src/utils/init-db.js` 会自动：

1. 在 `server/database/` 目录创建 SQLite 数据库文件（默认 `classintra.db`）
2. 创建所有数据表（users、messages、posts、files、notes、settings 等）
3. 执行迁移脚本（`server/src/migrations/`，按版本号顺序）
4. 导入预注册名单（若 `server/config/pre-records.json` 存在）

::: tip 零配置数据库
better-sqlite3 是嵌入式数据库，无需单独安装数据库服务，数据库文件随项目走，备份只需复制 `server/database/` 目录。默认启用 WAL 模式提升并发读写性能。
:::

::: warning 手动重置
如需重置数据库，删除 `server/database/classintra.db` 文件后重启服务即可重新初始化。**此操作会清除所有数据，请谨慎操作。**
:::

## 启动开发服务器

在项目根目录执行：

```bash
pnpm dev
```

此命令（`pnpm --parallel --filter server --filter client run dev`）会并行启动：

- **后端 server**（端口 9001）：`node src/app.js`，提供 REST API + WebSocket
- **前端 client**（端口 5001）：`vite` dev server，提供 HMR 热重载

Vite dev server 已配置代理，`/api` 与 `/ws` 请求会自动转发到 `http://localhost:9001`，无需额外 CORS 处理。

启动成功后控制台会显示：

```
ClassIntra server listening on http://localhost:9001
WebSocket server listening on ws://localhost:10001
VITE v5.x  ready in xxx ms
➜  Local:   http://localhost:5001/
```

::: tip 单独启动
- 仅后端：`pnpm dev:server`（端口 9001）
- 仅前端：`pnpm dev:client`（端口 5001，需后端已启动）
:::

::: tip Windows 一键启动
- `start.bat` —— 开发模式一键启动
- `start-prod.bat` —— 生产模式一键启动
- `cn.bat` —— PM2 进程管理
:::

## 首次配置

启动成功后，访问 <http://localhost:5001/setup>（或生产模式 <http://localhost:9001/setup>）完成班级初始化向导，五步完成配置：

```
① 届数        → 设置毕业年份后两位（如 25 = 2025 届）
② 班级        → 班级编号 + 名称（如 08 → 8 班）
③ 预注册名单  → 批量导入学生姓名，系统自动分配 YYCCNN 格式学号
④ 班管指定    → 每班选一人担任班级管理员（ID 末两位 00）
⑤ 确认保存    → 写入 .env + pre-records.json + 初始化数据库
```

### 预注册名单导入

预注册名单存储在 `server/config/pre-records.json`，格式如下：

```json
{
  "class08": ["张三", "李四", "王五"],
  "class18": ["赵六", "钱七"]
}
```

键名 `classNN` 中的 `NN` 为班级编号，值为该班学生真实姓名数组。系统会自动为每位学生分配 `YYCCNN` 格式学号（届数 + 班级号 + 序号），学生注册时使用预注册名单中的真实姓名，系统自动匹配学号。

::: tip 班管匹配
学生注册后，系统检查其 `user_id` 是否匹配 `.env` 中的 `ADMIN_USER_IDS`，匹配则自动授予管理员权限。班管无需单独创建账号，正常注册即可。
:::

::: warning 首次配置注意
- `/setup` 页面仅在数据库未初始化时可访问，完成配置后将被禁用
- 完成配置后需重启服务（`Ctrl + C` 后重新 `pnpm dev`）使 `.env` 生效
- 预注册名单导入后，学生必须使用真实姓名注册才能匹配学号
:::

## 生产构建

```bash
# 构建前端产物
pnpm build

# 启动生产服务（前端产物由 Express 直接提供）
cd server && NODE_ENV=production node src/app.js
# → http://localhost:9001
```

`pnpm build` 会先运行 `client/scripts/prebuild.js`（自动递增 PATCH 版本号、生成 changelog），再执行 `vite build`，产物输出到 `client/dist/`，由 `server/src/app.js` 直接提供静态服务。

::: tip 生产部署
完整的生产部署（多机中继、Tailscale 组网、HTTPS 配置、PM2 进程管理）请参考 [部署运维](/deployment/) 与项目根目录 [DEPLOY.md](https://github.com/ClassIntra/ClassIntra/blob/main/DEPLOY.md)。
:::

## 常见问题

### Q1：`pnpm install` 报 `better-sqlite3` 编译失败

**原因**：本机缺少 C++ 编译工具链。

**解决**：
- Windows：安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Linux：`sudo apt-get install -y build-essential python3`
- macOS：`xcode-select --install`

项目 `.npmrc` 已配置 `build_from_source=false` 优先使用预编译包，正常情况下不会触发编译。

### Q2：服务启动报 `JWT_SECRET is required`

**原因**：未设置 `JWT_SECRET` 或保留模板默认值。

**解决**：编辑 `server/.env`，将 `JWT_SECRET` 设置为 ≥ 32 字符的随机串：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Q3：前端启动后白屏

**可能原因**：
1. 后端 server 未启动 —— 启动 server 后刷新页面
2. 浏览器版本过低 —— 升级 Chrome / Firefox 至推荐版本
3. 端口被占用 —— 检查 5001 / 9001 端口

### Q4：WebSocket 连接失败

**原因**：后端 server 未运行，或端口 10001 被防火墙拦截。

**解决**：
```bash
# 检查 server 是否运行
curl http://localhost:9001/api/health

# 检查端口占用（Windows）
netstat -ano | findstr :10001
```

### Q5：首次配置后 `/setup` 无法访问

**原因**：完成首次配置后，`/setup` 页面被自动禁用。

**解决**：如需重新配置，删除 `server/database/classintra.db` 后重启服务（会清除所有数据）。

## 下一步

- [基本使用](/quick-start/basic-usage) - 桌面操作、应用一览、管理后台
- [核心概念](/concepts/) - 架构、应用、Manifest、主题系统
- [部署运维](/deployment/) - 生产部署、教育场景、多机中继
- [开发指南](/development/) - 第三方应用开发、SDK、调试
