---
title: 快速开始
description: ClassIntra 校园内网 WebOS 项目介绍、核心特性、系统要求与快速安装步骤，几分钟内启动完整的班级数字平台。
---

# 快速开始

欢迎使用 **ClassIntra** —— 面向班级教室场景的校园内网 WebOS 平台。

## 项目介绍

ClassIntra 是一个为班级教室场景而生的 Web 桌面系统：一台服务器 + 一台平板 = 完整的班级数字平台。无需外网，局域网即可运行。系统采用类 iOS 设计语言，自研 `ios/` 组件库，专为横屏平板（960×600）优化，同时适配桌面浏览器。

技术栈锁定 **Vue 2.7 + Vite 5 + Node.js + Express + SQLite**，通过 `@vitejs/plugin-legacy` 兼容 Chrome 80 老旧教育终端。前后端采用 pnpm workspace monorepo 组织，前端 `client/` 与后端 `server/` 独立可插拔，应用以 `apps/<name>/` 为单位自带 `frontend/` + `backend/` + `manifest.json`。

内置 8 大模块覆盖班级日常：桌面系统、即时通讯、AI 对话、社区论坛、资源仓库、音乐播放、笔记系统、管理后台。

::: tip 适用场景
- **班级教室**：一台服务器 + 多台平板，构建班级数字平台
- **机房部署**：Chrome 80 老旧教育终端兼容，局域网运行
- **横屏平板**：960×600 横屏优化，触控优先，最小触摸区域 44px
- **校园内网**：无需外网，数据不出校，安全可控
- **跨班级联动**：多班级公共聊天室实时同步，支持 Tailscale 组网
:::

## 核心特性

| 特性 | 说明 |
|------|------|
| 🖥️ **桌面系统** | 类 iOS 启动台，应用图标分页排列、壁纸切换、锁屏密码、通知中心（超能岛） |
| 💬 **即时通讯** | 公共聊天、班级群聊（自动建群）、私聊、表情、消息撤回、群公告 |
| 🌤️ **天气系统** | 实时天气、7 日预报、空气质量、生活指数、降雨预警动画 |
| 🤖 **AI 对话** | OpenAI 兼容 / DeepSeek 双引擎，Tavily 联网搜索，LaTeX 数学公式渲染 |
| 📝 **社区论坛** | 发帖、评论、点赞、收藏、Markdown + LaTeX 渲染，签到经验与排行榜 |
| 📁 **资源仓库** | 文件浏览与搜索、PDF 在线预览、MKV/MP4 视频流播放、云盘与客上传 |
| 🎵 **音乐播放** | 在线播放列表、LRC 歌词同步、背景播放、超能岛快捷控制 |
| 📒 **笔记系统** | Markdown 编辑器、代码高亮、Mermaid 流程图、KaTeX 数学公式 |
| ⚙️ **管理后台** | 用户管理、广播通知、班干委任、应用管控、操作日志 |
| 🔗 **跨班级联动** | WebSocket 中继实现多班级公共聊天室消息实时同步 |
| 🌗 **深色/浅色主题** | 跟随系统自动切换或手动选择 |

## 系统要求

### 开发环境

| 项目 | 最低版本 | 推荐版本 | 说明 |
|------|---------|---------|------|
| Node.js | 18.0.0 | 18 LTS / 20 LTS | 前后端运行时 |
| pnpm | 8.0.0 | 8.15+ / 9.x | monorepo 包管理 |
| Git | 2.20+ | 最新版 | 克隆仓库与版本管理 |
| ffmpeg | — | 最新版（可选） | 视频流式转码需要 |

::: warning Node 版本
请确保 Node.js ≥ 18，否则部分依赖将无法安装。可使用 [nvm](https://github.com/nvm-sh/nvm) 或 [fnm](https://github.com/Schniz/fnm) 切换版本：
```bash
nvm install 18
nvm use 18
```
:::

### 浏览器支持

| 浏览器 | 最低版本 | 备注 |
|--------|---------|------|
| Chrome / Edge | 80+ | 推荐 90+，教育终端常见版本 |
| Firefox | 75+ | 推荐 90+ |
| Safari | 13+ | 推荐 15+（iOS 横屏） |
| 移动端 Chrome / Safari | 最新版 | 横屏平板自动适配 |

### 设备要求

| 设备类型 | 最低配置 | 推荐配置 |
|---------|---------|---------|
| 平板（横屏） | 960×600 分辨率 / 2 GB RAM | 1280×800 / 4 GB RAM |
| 桌面浏览器 | 1280×720 / 2 GB RAM | 1920×1080 / 4 GB RAM |
| 服务器 | 512 MB RAM / 双核 CPU | 1 GB RAM / 四核 CPU |
| 屏幕 | ≥ 960px 宽度（横屏） | ≥ 1280px 宽度 |

::: tip 低性能设备
ClassIntra 在 512 MB RAM 的服务器与 Chrome 80 老旧终端上也能流畅运行，better-sqlite3 嵌入式数据库零配置、低占用。
:::

## 快速安装

只需 4 步即可在本地启动 ClassIntra。

### 1. 克隆仓库

```bash
git clone https://github.com/ClassIntra/ClassIntra.git
cd ClassIntra
```

::: tip 网络问题
国内用户若访问 GitHub 较慢，可使用镜像：
```bash
git clone https://ghproxy.com/https://github.com/ClassIntra/ClassIntra.git
```
:::

### 2. 安装依赖

ClassIntra 使用 pnpm workspace 管理 monorepo：

```bash
pnpm install
```

此命令会安装 `client`、`server`、`apps/*`、`plugins/*`、`shared` 所有 workspace 的依赖。项目根目录 `.npmrc` 已配置 `build_from_source=false`，优先使用预编译包避免 `better-sqlite3` 等原生模块在本机工具链缺失时编译失败。

::: tip 插件目录
`plugins/` 不属于主仓库：新克隆的仓库没有该目录，需要时从 [market 仓库](https://github.com/ClassIntra/market) 的 `plugins/` 目录复制插件到本地 `plugins/` 后再执行 `pnpm install`。未放置插件时安装命令会正常跳过。
:::

### 3. 配置环境变量

```bash
cp server/.env.example server/.env
# 编辑 server/.env，至少设置 JWT_SECRET（必填，否则服务拒绝启动）
```

::: warning JWT_SECRET 必填
`JWT_SECRET` 必须设置为 ≥ 32 字符的随机串，否则服务启动时会被拒绝。班管 ID（`ADMIN_USER_IDS`）格式为 `YYCC00`，例如 `250100` 表示 25 届 01 班班管。
:::

### 4. 启动开发服务器

```bash
pnpm dev
```

此命令会并行启动后端 server（端口 9001）与前端 Vite dev server（端口 5001），Vite 已配置代理，`/api` 与 `/ws` 请求自动转发到 `http://localhost:9001`。

::: tip Windows 一键启动
Windows 用户也可使用 `start.bat`（开发）或 `start-prod.bat`（生产）一键启动，`cn.bat` 提供 PM2 进程管理。
:::

## 访问应用

启动成功后访问：

- **开发模式**：<http://localhost:5001>（Vite dev server，自动代理到后端）
- **后端 API**：<http://localhost:9001>（Express HTTP + WebSocket）
- **首次配置**：<http://localhost:5001/setup>（班级初始化向导）

::: tip 首次使用
首次启动必须访问 `/setup` 完成班级初始化：设置届数、班级、导入预注册名单、指定班管。详见 [基本使用](/quick-start/basic-usage)。
:::

## 下一步

- [安装](/quick-start/installation) - 完整环境准备、依赖安装、环境变量、首次配置
- [基本使用](/quick-start/basic-usage) - 桌面操作、应用一览、管理后台
- [核心概念](/concepts/) - 架构、应用、Manifest、主题、WebSocket
- [部署运维](/deployment/) - 生产部署、教育场景、多机中继
