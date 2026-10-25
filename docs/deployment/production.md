---
title: 生产部署
description: ClassIntra 生产环境部署完整流程，覆盖环境准备、依赖安装、环境变量配置、前端构建、PM2 进程守护、Nginx 反向代理、HTTPS 配置与部署验证。
---

# 生产部署

本页面介绍 ClassIntra 生产环境的完整部署流程，从环境准备到 PM2 进程守护、Nginx 反向代理与 HTTPS 配置，最后给出部署验证与健康检查命令。

## 环境准备

### 安装 Node.js 与 pnpm

| 工具 | 最低版本 | 推荐版本 | 用途 |
|------|---------|---------|------|
| Node.js | 18.0.0 | 18 LTS / 20 LTS | 前后端运行时 |
| pnpm | 8.0.0 | 8.15+ / 9.x | monorepo 包管理 |
| Git | 2.20+ | 最新版 | 克隆仓库 |
| PM2 | 5.0+ | 7.x+ | 进程守护（项目依赖自带） |
| Nginx（可选） | 1.18+ | 最新稳定版 | 反向代理与 HTTPS 终端 |

:::: details Windows Server / Windows 10+
1. 下载 [Node.js 18 LTS](https://nodejs.org/) 安装包
2. 启用 pnpm 与构建工具：
   ```powershell
   npm install -g pnpm
   npm install -g windows-build-tools  # 可选，编译原生模块时
   ```
3. 验证：
   ```powershell
   node -v    # v18.x.x
   pnpm -v
   ```
::::

:::: details Linux (Ubuntu / Debian)
```bash
# Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
npm install -g pnpm

# 构建工具（编译 better-sqlite3 用，正常情况使用预编译包即可）
sudo apt-get install -y build-essential python3

# Nginx
sudo apt-get install -y nginx
```
::::

:::: details macOS
```bash
brew install node@18
brew install nginx
npm install -g pnpm
```
::::

## 克隆仓库与安装依赖

```bash
git clone https://github.com/ClassIntra/ClassIntra.git
cd ClassIntra
```

::: tip 镜像加速
国内服务器若访问 GitHub 较慢，可使用镜像：
```bash
git clone https://ghproxy.com/https://github.com/ClassIntra/ClassIntra.git
```
:::

安装 monorepo 全部依赖：

```bash
pnpm install
```

项目根目录 `.npmrc` 已配置 `build_from_source=false`，优先下载 `better-sqlite3` 等原生模块的预编译包，避免本机缺少 C++ 工具链时编译失败。`pnpm-workspace.yaml` 声明了 `server` 与 `client` 两个 workspace，pnpm 会自动建立内部链接。

## 环境变量配置

从模板复制配置：

```bash
cp server/.env.example server/.env
```

完整 `.env` 示例（按场景调整）：

```bash
# 服务端口
PORT=9001
WS_PORT=10001

# JWT 配置（v1.4 起签发走 RS256，无需必填项）
# 私钥：JWT_PRIVATE_KEY 可选（PEM 文本或路径）；留空时首次启动自动生成
# RSA-2048 密钥对到 server/keys/jwt-private.pem（公钥 jwt-public.pem 同目录）
# JWT_PRIVATE_KEY=
# JWT_SECRET=<可选，仅过渡期验旧 token 与兜底>
JWT_EXPIRES_IN=7d

# 班管 ID（格式 YYCC00，逗号分隔多班）
ADMIN_USER_IDS=250100

# 开发者账号密码（可选，生产环境建议关闭）
# DEV_PASSWORD=dev123456

# 和风天气
QWEATHER_KEY=<your-qweather-key>
QWEATHER_LOCATION=116.41,39.92
QWEATHER_API_HOST=devapi.qweather.com

# 数据存储
RESOURCES_DIR=../Resources
DB_PATH=./database/classintra.db

# 中继配置（单机可留空）
RELAY_SERVERS=
RELAY_SECRET=
RELAY_SERVER_ID=server-a
RELAY_PORT=10011
COHORT=25

# HTTPS（生产建议 true，启用 secure cookie）
HTTPS=false
# HTTPS 服务端口（PM2 classintra-https 进程监听，默认 9443，不再默认 443；
# 要占 443 须显式设 HTTPS_PORT=443）
# HTTPS_PORT=9443

# CORS（公网部署需配置允许的前端域名）
CORS_ORIGINS=

# Syncthing（可选）
SYNCTHING_HOST=localhost
SYNCTHING_PORT=8384
SYNCTHING_API_KEY=

# Tailscale VPN（可选）
TAILSCALE_ENABLED=false
TAILSCALE_RELAY_IP=

# 详细日志（生产环境建议 0）
VERBOSE_LOG=0
```

::: warning JWT 私钥不出本机
RS256 私钥（`server/keys/jwt-private.pem`）仅用于本机签发 token，**绝不能外发或提交 Git**。其他服务（如 Cluss）需要验 CI token 时，把公钥 `server/keys/jwt-public.pem` 交给对方即可；`server/keys/` 属敏感目录，备份时加密保存。
:::

详细配置项说明见 [配置项参考](./configuration)。

## 构建前端

生产模式需先构建前端静态资源，由后端 Express 直接提供：

```bash
pnpm build
```

`pnpm build` 流程：

1. 执行 `client/scripts/prebuild.js` —— 自动递增 `server/version.json` 的 PATCH 版本号，写入 `buildHash` 与 `buildTime`
2. 在 `client/` 目录执行 `vite build`
3. 产物输出到 `client/dist/`，由 `server/src/app.js` 直接读取并托管

::: tip Windows 一键构建
项目提供 `build.bat`，自动完成依赖安装、版本写入与前端构建：
```cmd
build.bat
```
:::

::: warning 构建失败排查
- **`better-sqlite3` 编译失败**：确认 Node.js ≥ 18，或安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- **Vite 内存溢出**：在 `client` 目录执行 `NODE_OPTIONS=--max-old-space-size=2048 pnpm build`
- **版本写入失败**：检查 `server/version.json` 是否存在或可写
:::

## PM2 启动配置

PM2 用于守护后端进程，崩溃自动重启。项目已自带 `ecosystem.config.js`：

```js
// ecosystem.config.js（节选）
module.exports = {
  apps: [
    {
      name: 'classintra-server',
      script: 'src/app.js',
      cwd: path.resolve(__dirname, 'server'),
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      restart_delay: 8000,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=768',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: path.join(__dirname, 'logs', 'server-error.log'),
      out_file: path.join(__dirname, 'logs', 'server-out.log'),
      merge_logs: true,
      min_uptime: '30s',
      listen_timeout: 30000,
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        // 自动从 server/.env 注入
        PORT: envVars.PORT || '9001',
        WS_PORT: envVars.WS_PORT || '10001',
        JWT_SECRET: envVars.JWT_SECRET || '',
        // ... 其余环境变量
      }
    }
  ]
};
```

启动服务：

```bash
# 启动 PM2 守护进程
pm2 start ecosystem.config.js

# 保存进程列表（开机自启）
pm2 save

# 设置开机自启
pm2 startup
# 按 PM2 提示执行返回的 sudo 命令
```

### PM2 进程清单

`ecosystem.config.js` 共定义五个进程：

| 进程 | 说明 |
|------|------|
| `classintra-server` | 主服务：HTTP 9001、WS 10001、Relay 10011 |
| `classintra-https` | HTTPS 9443（`src/app-https.js`，`WS_MIRROR_MODE=true` 的 9001 镜像实例，不监听 WS/Relay） |
| `tunnel-gateway` | 隧道网关 10111 |
| `chmlfrp-frpc` | CHMLFRP 内网穿透 frpc 客户端 |
| `pcagent` | noVNC 设备远程代理（Python） |

::: tip
`pm2 status` 应看到五个进程均为 `online`。HTTPS 端口如需更换，改 `server/.env` 的 `HTTPS_PORT` 后走「应用配置重启」（`pm2 restart ecosystem.config.js --update-env`）。
:::

::: tip Windows 开机自启
Windows 平台使用 [pm2-windows-startup](https://github.com/Unitech/pm2-windows-startup)：
```powershell
npm install -g pm2-windows-startup
pm2-startup install
pm2 start ecosystem.config.js
pm2 save
```
:::

### 常用 PM2 命令

| 命令 | 说明 |
|------|------|
| `pm2 status` | 查看进程状态 |
| `pm2 logs classintra-server` | 实时查看日志 |
| `pm2 restart classintra-server` | 重启进程 |
| `pm2 reload classintra-server` | 零停机重启（cluster 模式） |
| `pm2 stop classintra-server` | 停止进程 |
| `pm2 delete classintra-server` | 移除进程 |
| `pm2 monit` | 实时监控面板（CPU/内存） |
| `pm2 describe classintra-server` | 查看进程详细信息 |

更多命令详见 [CLI 工具 - PM2 命令](/development/cli#pm2-命令)。

## Nginx 反向代理（可选）

生产环境推荐使用 Nginx 做反向代理，处理 HTTPS 终端、静态资源缓存与负载均衡。

```nginx
# /etc/nginx/conf.d/classintra.conf
upstream classintra_backend {
    server 127.0.0.1:9001;
    keepalive 32;
}

server {
    listen 80;
    server_name classintra.example.edu;

    # 健康检查端点（不记日志）
    location = /api/system/health {
        proxy_pass http://classintra_backend;
        access_log off;
    }

    # WebSocket 升级
    location /ws {
        proxy_pass http://127.0.0.1:10001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # 其余请求转发到 Express
    location / {
        proxy_pass http://classintra_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # 静态资源长缓存
    location ~* \.(?:js|css|woff2?|png|jpg|jpeg|gif|svg|ico)$ {
        proxy_pass http://classintra_backend;
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    client_max_body_size 100m;  # 上传限制
}
```

::: tip WebSocket 端口
若 WebSocket 直接监听独立端口（默认 10001），需要单独的 `location /ws` 块并设置 `Upgrade` 头。前端会通过 `WS_PORT` 自动连接 `ws://host:10001`，若希望统一走 80/443 端口，可在 Nginx 上将 `/ws` 反代到 `127.0.0.1:10001`，并将 `WS_PORT` 改为 80 或 443。
:::

## HTTPS 配置

校园公网部署强烈建议启用 HTTPS。ClassIntra 内置 HTTPS 服务，由 PM2 进程 **classintra-https**（`server/src/app-https.js`）提供，**默认监听 9443**（不再默认 443，避免与本机其他服务冲突；要占 443 须在 `server/.env` 显式设置 `HTTPS_PORT=443`）。两种方式任选其一：

### 方式一：内置 HTTPS（默认）

`pm2 start ecosystem.config.js` 会一并拉起 classintra-https（与 classintra-server 同规格守护，开机自启）。该进程是 9001 主实例的 TLS 镜像（`WS_MIRROR_MODE=true`，WebSocket 与 Relay 仍由主实例监听）。

内网可用自签证书：

```powershell
# Windows 自签证书
cd server
.\scripts\generate-certs.ps1
.\start-https.ps1
```

::: warning 自签证书
自签证书浏览器会告警，仅适合内网测试。生产环境请使用 Let's Encrypt 或学校 CA 颁发的证书。
:::

### 方式二：Nginx 终止 HTTPS

让 Nginx 占用 443 对外、终止 TLS，反代到内置 HTTPS 的 9443（与方式一取其一；若选择此模式，也可让 Nginx 直接回源 9001 的 HTTP 实例）：

申请证书后配置：

```nginx
server {
    listen 443 ssl http2;
    server_name classintra.example.edu;

    ssl_certificate     /etc/letsencrypt/live/classintra.example.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/classintra.example.edu/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 反代到内置 HTTPS 实例（默认 9443）；也可回源 http://127.0.0.1:9001
    location / {
        proxy_pass https://127.0.0.1:9443;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP 跳转 HTTPS
server {
    listen 80;
    server_name classintra.example.edu;
    return 301 https://$host$request_uri;
}
```

申请证书（Let's Encrypt）：

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d classintra.example.edu
```

两种方式都需在 `server/.env` 启用 HTTPS（secure cookie）并限制跨域：

```bash
HTTPS=true
CORS_ORIGINS=https://classintra.example.edu
```

## 验证部署

部署完成后通过以下命令验证：

```bash
# 1. 健康检查（含数据库、WebSocket、Relay、内存）
curl http://localhost:9001/api/system/health

# 期望返回：
# {
#   "code": 200,
#   "data": {
#     "status": "healthy",
#     "checks": {
#       "database": { "status": "ok" },
#       "websocket": { "status": "ok", "online_count": 0 },
#       "relay": { "status": "ok" / "not_configured" },
#       "memory": { "status": "ok", "heap_used_mb": ..., "rss_mb": ... }
#     }
#   }
# }

# 2. 心跳检查（轻量，适合脚本监控）
curl http://localhost:9001/api/system/heartbeat

# 3. 版本检查
curl http://localhost:9001/api/system/version

# 4. PM2 状态
pm2 status

# 5. 浏览器访问
# 首次配置：http://<server-ip>:9001/setup
# 桌面入口：http://<server-ip>:9001/
# HTTPS 入口（classintra-https 进程）：https://<server-ip>:9443/
```

::: tip 健康检查端点
- `GET /api/system/health` —— 综合健康检查，含数据库、WebSocket、Relay、内存
- `GET /api/system/heartbeat` —— 轻量心跳，返回版本与是否需要强制更新
- `GET /api/system/version` —— 完整版本信息
:::

## 安全提示

::: warning 安全清单
部署到公网或共享内网前**务必**完成以下检查：

**密钥与认证**
- ✅ JWT 密钥对就绪（默认自动生成于 `server/keys/`，或显式配置 `JWT_PRIVATE_KEY`）；私钥不出本机
- ✅ `JWT_EXPIRES_IN` 不过长（建议 7d，长期使用可设 30d）
- ✅ `DEV_PASSWORD` 已注释或移除（避免开发者后门）
- ✅ `QWEATHER_KEY` 等 API 密钥不外泄
- ✅ `RELAY_SECRET` 已设置（多机联动场景）

**网络与防火墙**
- ✅ 仅开放 9001（或 HTTPS 9443）到公网
- ✅ WebSocket 10001 与 Relay 10011 **仅内网可达**
- ✅ 数据库目录 `server/database/` 不可外部访问
- ✅ 启用 HTTPS（公网部署）
- ✅ 配置 `CORS_ORIGINS` 限制跨域

**系统加固**
- ✅ 创建非 root 用户运行 PM2
- ✅ `server/.env` 文件权限设为 600（仅属主可读写）
- ✅ `server/keys/` 目录（JWT 私钥）权限 600，不可提交 Git、备份加密
- ✅ 定期备份数据库（见 [监控运维 - 备份恢复](./monitoring#备份与恢复)）
- ✅ 监控磁盘空间，避免日志塞满
:::

::: warning 数据库文件保护
`server/database/classintra.db` 包含所有用户数据、聊天记录、文件元数据，**绝不能公网可访问**。Nginx 反代时确保 `/database/` 路径不被暴露（默认 Express 不会路由到该目录，但请检查 Nginx 配置）。
:::

## 下一步

- [教育场景部署](./education) - 单班/多班联动配置
- [配置项参考](./configuration) - 完整环境变量
- [监控运维](./monitoring) - 日志、备份、故障排查
- [安装指南](/quick-start/installation) - 首次配置向导
