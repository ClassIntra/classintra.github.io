---
title: 运维控制台（ClassIntraOps）
description: ClassIntraOps 桌面运维控制台 —— 下载、安装与使用指引
---

# 🧰 运维控制台（ClassIntraOps）

ClassIntraOps 是 ClassIntra 的**独立运维控制台**：一个 Windows 桌面应用（另附零依赖 Web 控制台作为备用形态），用于在不碰命令行的前提下完成 CI 的日常运维 —— 查看服务状态、配置密钥、跨班对端探活、安装更新、看日志。

**它主要面向零基础用户**：下载单文件、双击即用，全程图形界面，不需要命令行与开发经验。开发者仍可走 [快速开始](/quick-start/) 的命令行方式。

- 仓库：<https://github.com/ClassIntra/ClassIntra-Ops>
- 版本：**v0.1（测试版）**
- 平台：Windows 10/11 x64

::: warning ⚠️ 测试版声明
ClassIntraOps 目前处于 **v0.1 测试阶段**，功能与配置格式尚未稳定，后续版本可能包含**破坏性变更**（配置文件格式、日志位置、数据结构等）。升级前请备份 `ClassIntraOps.config.json`，并关注 [Releases](https://github.com/ClassIntra/ClassIntra-Ops/releases) 与 [CHANGELOG](https://github.com/ClassIntra/ClassIntra-Ops/blob/main/CHANGELOG.md)。
:::

## 下载

前往 [Releases 页面](https://github.com/ClassIntra/ClassIntra-Ops/releases) 下载对应版本的单文件应用（如 `ClassIntraOps-v0.1-win-x64.exe`），**下载即用，无需安装 .NET**（自包含运行时）。

也可以从源码运行：

```bash
git clone https://github.com/ClassIntra/ClassIntra-Ops.git
cd ClassIntraOps/launcher
dotnet run -c Release
```

## 快速上手

1. **双击运行** `ClassIntraOps.exe` —— 首次启动会进入**欢迎页**
2. **定位 CI 仓库**：欢迎页提供两种方式 ——
   - 「下载并安装 CI」：git 拉取 → 装依赖 → 构建 → PM2 启动，全程实时回显
   - 「选择已有 CI 目录」：直接指向已有的 ClassIntra 仓库（判定依据：目录下有 `ecosystem.config.js` 或 `server/`；应用也会自动探测同级目录）
3. **配置密钥**：仓库就位后自动进入「密钥配置」—— 表单由 `server/.env.example` 推导，密钥打码不回显、留空不覆盖、保存自动备份
4. **启动服务**：总览页「启动全部」，或安装时勾选启动；改过 `.env` 后必须走「**应用配置重启**」（`pm2 restart ecosystem.config.js --update-env`），普通 restart 不会重新加载环境变量

::: tip 门禁说明
在 CI 仓库就位之前，**密钥配置 / 跨班对端 / 服务日志**三页会在导航上保持禁用（图标压暗）—— 这是为了避免你对着空数据猜。总览、安装更新、环境设置始终可用。
:::

## 托盘常驻

点击窗口 ✕ **不会退出程序**——窗口隐藏进系统托盘，后台监控持续运行：

- **左键点击**托盘图标：恢复主窗口
- **右键托盘图标**：`打开主窗口` / `退出 ClassIntraOps`

真正退出请走托盘菜单的「退出」。

## 崩溃排查

任何未处理的异常都会写入运行目录下的 `logs/crash.log`（不闪退）。反馈问题时请附上该文件内容。

## 环境依赖

控制台本身免安装，但**操作 CI**（安装更新 / 启停服务 / 构建）需要目标机器具备：

| 工具 | 用途 |
|------|------|
| node | 运行 CI 服务本体 |
| pnpm | 安装依赖与构建前端 |
| git | 拉取源码更新 |
| pm2 | 托管 CI 进程 |

欢迎页会自动检测这四项并给出可用性结论。

## Web 控制台（备用形态）

仓库内另含零依赖的 Web 控制台（`ops-server/`），`node server.js` 直跑，默认监听 `127.0.0.1:9099`。桌面端不可用时的备选方案。
