---
title: 部署概览
description: ClassIntra 部署方式总览，覆盖开发模式、生产模式与 Docker 化部署，包含系统要求、端口规划与场景选型指引。
---

# 部署概览

ClassIntra 是面向校园内网的 WebOS 平台，支持单机部署、PM2 生产部署、多机中继组网等多种形态。本页面提供部署方式对比、系统要求与端口规划，帮助你快速选型。

## 部署方式对比

| 部署方式 | 适用场景 | 启动命令 | 进程管理 | 复杂度 | 推荐指数 |
|---------|---------|---------|---------|--------|---------|
| **开发模式** | 本地开发调试 | `pnpm dev` | Vite + Node（前台） | ★ | ⭐⭐⭐⭐⭐ |
| **生产模式** | 单机上线、教育场景 | `pnpm build && pnpm start` | PM2 守护 | ★★ | ⭐⭐⭐⭐⭐ |
| **PM2 中继模式** | 多班级跨机联动 | `pm2 start ecosystem.config.js` | PM2 + Relay Bus | ★★★ | ⭐⭐⭐⭐ |
| **Docker 化部署** | 容器化环境（实验性） | `docker compose up` | Docker / Compose | ★★★ | ⭐⭐⭐ |

::: tip 选型建议
- **教育场景（一班一机）**：生产模式 + PM2 守护，简单稳定
- **多班级联动**：PM2 中继模式，配置 `RELAY_SERVERS` 实现跨机消息同步
- **公网访问**：在 PM2 基础上加 Nginx 反向代理 + HTTPS（参考 [生产部署](./production)）
- **跨校区组网**：Tailscale VPN + Relay 中继（参考 [教育场景](./education)）
:::

## 系统要求

### 服务端

| 项目 | 最低要求 | 推荐配置 | 说明 |
|------|---------|---------|------|
| **操作系统** | Windows 10 / Linux / macOS | Windows 11 / Ubuntu 22.04 LTS | 跨平台支持，建议 64 位 |
| **CPU** | 双核 1.6 GHz | 四核 2.4 GHz+ | 单班可降至双核 |
| **内存** | 1 GB | 2 GB+ | PM2 `max_memory_restart` 默认 512 MB |
| **硬盘** | 1 GB 可用空间 | 5 GB+ SSD | 含数据库、资源、日志 |
| **Node.js** | 18.0.0 | 18 LTS / 20 LTS | `better-sqlite3` 原生模块要求 |
| **pnpm** | 8.0.0 | 8.15+ / 9.x | monorepo 包管理 |
| **Git** | 2.20+ | 最新版 | 克隆仓库 |
| **ffmpeg**（可选） | — | 最新版 | MKV/MP4 视频流式转码 |

### 客户端（学生平板）

| 项目 | 最低要求 | 推荐配置 | 说明 |
|------|---------|---------|------|
| **浏览器** | Chrome 80+ | Chrome 100+ / Safari 15+ | 兼容 ES2017 + Options API |
| **屏幕** | 1024×768 | 横屏 1280×800+ | 横屏平板优化 |
| **网络** | 局域网可达服务器 | 千兆有线 / Wi-Fi 5 | 无需外网 |

::: warning Chrome 80 兼容
ClassIntra 前端代码风格刻意保留 `var` / `function` / Options API，避免在 Chrome 80 等老旧浏览器上崩溃。若学生平板浏览器低于 Chrome 80，需升级或安装 [Chrome Enterprise](https://chromeenterprise.google/browser/)。
:::

## 端口规划

ClassIntra 默认占用以下端口，部署前请确认未被占用：

| 端口 | 协议 | 服务 | 配置项 | 默认值 |
|------|------|------|--------|--------|
| **9001** | HTTP | REST API + 静态前端 | `PORT` | 9001 |
| **10001** | WebSocket | 实时通讯（聊天、桌面、超能岛） | `WS_PORT` | 10001 |
| **10011** | TCP | 跨机 Relay 中继 | `RELAY_PORT` | 10011 |
| **5001** | HTTP | Vite Dev Server（仅开发模式） | `vite.config.mjs` | 5001 |
| **8384** | HTTP | Syncthing API（可选，文件同步） | `SYNCTHING_PORT` | 8384 |

::: tip 端口冲突排查
若端口被占用，可修改 `server/.env` 调整端口：
```bash
# Windows 查看端口占用
netstat -ano | findstr :9001

# Linux / macOS
lsof -i :9001
```
:::

::: warning 防火墙放行
生产环境仅需开放 9001（或 HTTPS 443）。WebSocket 10001 与 Relay 10011 仅在内网/中继场景开放，**禁止暴露到公网**。详见 [生产部署 - 安全提示](./production#安全提示)。
:::

## 部署流程概览

```
① 环境准备        →  安装 Node.js 18+ / pnpm / Git
   ↓
② 克隆仓库        →  git clone + pnpm install
   ↓
③ 配置环境变量    →  复制 .env.example → 编辑 .env（必填 JWT_SECRET）
   ↓
④ 首次配置向导    →  访问 /setup 完成班级初始化
   ↓
⑤ 构建前端        →  pnpm build（生产模式）
   ↓
⑥ 启动服务        →  pnpm start / pm2 start ecosystem.config.js
   ↓
⑦ 验证部署        →  curl /api/system/health
```

## 下一步

- [生产部署](./production) - PM2 守护、Nginx 反代、HTTPS 配置
- [教育场景](./education) - 单班部署、多班联动、Tailscale 组网
- [配置项](./configuration) - 全部环境变量参考
- [监控运维](./monitoring) - 健康检查、日志、备份恢复
- [安装指南](/quick-start/installation) - 详细安装步骤
