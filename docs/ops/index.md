---
title: 运维控制台（ClassIntraOps）
description: ClassIntraOps v0.2 使用指引。下载单文件、双击即用，图形界面完成「定位仓库 → 配置密钥 → 初始化班级 → 启动服务 → 日常运维」。含桌面控制台 launcher 与 Web 控制台 ops-server。
outline: [2, 3]
---

# 🧰 运维控制台（ClassIntraOps）

ClassIntraOps 是 ClassIntra 的**独立运维控制台**：一个 Windows 桌面应用（自包含单文件，无需安装 .NET），另附零依赖的 Web 控制台作为备用形态。用于在不碰命令行的前提下完成 CI 的日常运维——查看服务状态、配置密钥、初始化班级、跨班对端探活、安装更新、备份回滚、看日志。

**主要面向零基础用户**：下载单文件、双击即用，全程图形界面，不需要命令行与开发经验。

**仓库**：<https://github.com/ClassIntra/ClassIntra-Ops>

**版本**：**v0.2（测试版）** — 2026-10 上线，新增班级概览、更新中心、备份回滚、操作时间线、开机自启。

**平台**：Windows 10/11 x64（launcher）；Web 控制台可在任意能装 Node.js 的机器上跑。

::: warning ⚠️ 测试版声明
ClassIntraOps 处于 **v0.2 测试阶段**，功能与配置格式尚未稳定，后续版本可能包含**破坏性变更**（配置文件格式、日志位置、数据结构等）。升级前请备份 `ClassIntraOps.config.json`，并关注 [Releases](https://github.com/ClassIntra/ClassIntra-Ops/releases) 与 [CHANGELOG](https://github.com/ClassIntra/ClassIntra-Ops/blob/main/CHANGELOG.md)。
:::

## 下载

前往 [Releases 页面](https://github.com/ClassIntra/ClassIntra-Ops/releases) 下载对应版本的单文件应用（如 `ClassIntraOps-v0.2-win-x64.exe`，自包含运行时），**下载即用，无需安装 .NET**。

也可从源码运行：

```bash
git clone https://github.com/ClassIntra/ClassIntra-Ops.git
cd ClassIntraOps/launcher
dotnet run -c Release
```

发布单文件：

```bash
dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true
```

本机日常使用（推荐）：

```bash
run-ops.cmd   # 关掉旧实例 → 启动 launcher\dist\ClassIntraOps.exe
```

## 形态对比

| 形态 | 适用场景 | 说明 |
|---|---|---|
| **launcher**（Avalonia 桌面控制台，主形态） | 管理员本机、有桌面的 Windows / Linux | 原生窗口：9 页，业务逻辑 C# 原生实现 |
| **ops-server**（Web 控制台，备用形态） | 无头 Linux 服务器、远程管理 | 零第三方依赖，`node ops-server/server.js` 直跑，浏览器访问 `http://127.0.0.1:9099`；从「环境设置」页可一键拉起 |

两形态能力基本对齐。

## 9 个页面一览

| 页面 | 用途 |
|---|---|
| **欢迎** | 仓库未定位时唯一落点；定位后自动进入「班级初始化」或「配置密钥」 |
| **总览** | CPU / 内存 / 磁盘 / 运行时长 KPI，PM2 进程表（状态灯、重启次数、启停操作）、资源趋势图 |
| **密钥配置** | 由 `server/.env.example` 推导分组表单，密钥打码不回显、留空不覆盖，保存自动备份 |
| **跨班对端** | 解析 `RELAY_SERVERS`，TCP 层探活判在线（不误判 relay 的 426 路径），延迟微型柱、行内探活 |
| **安装更新** | 从 Gitee 拉源码（GitHub 自动兜底）→ 更新前备份数据库与配置 → 装依赖 → 构建前端 → PM2 启动，实时回显，失败即停不回滚 |
| **班级初始化** | 届数 / 班级 / 班管 / 名单一次填完，学号由 CI 自动分配（班管 `YYCC00`、学生 `YYCCnn`），**装完直接能用，不用再打开 `/setup` 页面** |
| **备份与回滚** | 更新前自动备份 `backup/ops-pre-update-<ts>/`（SQLite 三件套、`.env`、`version.json`、`config/*.json`），支持回滚 |
| **服务日志** | `server-out.log` / `server-error.log` 尾部 300 行 |
| **环境设置** | CI 仓库路径、node/pnpm/git/pm2 工具检测、开机自启（HKCU Run 键）、拉起 Web 控制台 |

## 快速上手（桌面控制台）

1. **双击运行** `ClassIntraOps-v0.2-win-x64.exe`，首次进入**欢迎页**。
2. **定位 CI 仓库**：点「下载并安装 CI」（git 拉取 → 装依赖 → 构建 → PM2 启动，全程实时回显），或「选择已有 CI 目录」（判定依据：目录下有 `ecosystem.config.js` 或 `server/`）。
3. **配置密钥**：仓库就位后进入「密钥配置」表单，字段由 `server/.env.example` 自动推导，保存自动备份。
4. **班级初始化**：在「班级初始化」页填届数、班级、班管、导入名单，学号由 CI 自动分配，装完即用，无需再访问 `/setup`。
5. **启动服务**：总览页「启动全部」；改密钥后必须走「**应用配置重启**」（`pm2 restart ecosystem.config.js --update-env`），普通重启不会重新加载环境变量。

## 托盘常驻

点击窗口 ✕ 不会退出程序——窗口隐藏进系统托盘，后台监控持续运行：

- 左键点击托盘图标：恢复主窗口
- 右键托盘图标：打开主窗口 / 退出 ClassIntraOps

真正退出请走托盘菜单的「退出」。

## 启动参数

| 参数 | 作用 |
|---|---|
| （无） | 正常启动，显示主窗口 |
| `--silent` / `--tray` | 只驻留托盘，不弹窗；开机自启用的就是它 |
| `--diagnose` | 不开窗口自检「日志 / 搜索 / 班级数据」，结果写 `logs/diagnose.txt` |
| `--screenshot` | 逐页截图验证（自检用） |

已经运行一个实例时，再双击图标会**把已有窗口叫出来**，不会开第二个。

开机自启在「环境设置」页开启（写 HKCU 的 Run 键，用户级，不需要管理员权限），启动命令带 `--silent` 只驻留托盘，不弹窗打断用户。

## Web 控制台（无头环境备选）

```bash
cd ClassIntraOps/ops-server
node server.js
# 打开 http://127.0.0.1:9099，Windows 可双击 ops.bat
```

默认只绑 `127.0.0.1`，因为它能读写 `.env` 里的全部密钥。确需局域网访问 Web 控制台时，设置 `OPS_HOST`，并务必同时设置 `OPS_TOKEN`。

## 配置（环境变量）

| 变量 | 默认 | 说明 |
|---|---|---|
| `OPS_PORT` | 9099 | 监听端口 |
| `OPS_HOST` | 127.0.0.1 | 监听地址，改前先读安全须知 |
| `OPS_TOKEN` | 空 | 启用后所有请求需带 `?token=` 或 `x-ops-token` 头 |
| `CI_ROOT` | 自动探测 | CI 仓库根目录 |

## 崩溃排查

任何未处理的异常都会写入运行目录下的 `logs/crash.log`（不闪退）。反馈问题时请附上该文件内容。

自检：`--diagnose` 参数不开窗口，自检日志 / 搜索 / 班级数据，结果写 `logs/diagnose.txt`。

## 常见问题

**Q：点「启动全部」进程不起来？**
`ecosystem.config.js` 定义五个进程，但 `tunnel-gateway`、`chmlfrp-frpc`、`pcagent` 是特定部署站点的公网隧道与远程运维配套，写死了本机绝对路径，普通机器上必然失败。只启动 `classintra-server` 与 `classintra-https` 即可：

```bash
pm2 delete tunnel-gateway chmlfrp-frpc pcagent
pm2 save
```

**Q：改了 `.env` 配置没生效？**
必须走总览页的「应用配置重启」，它执行 `pm2 restart ecosystem.config.js --update-env`；普通 `pm2 restart` 保留旧环境变量。

**Q：班级初始化和 `/setup` 有什么区别？**
一样的初始化逻辑，Ops 的「班级初始化」是把表单转成一次 HTTP 调用发给 CI 的 `/api/setup/save`。用 Ops 做完就不用再去浏览器打开 `/setup` 了。

## 下一步读什么

| 你想做 | 去哪 |
|---|---|
| 命令行部署（不想用 Ops） | [10 分钟部署上线（保姆级）](/deployment/beginner) |
| 生产部署与 PM2 五进程说明 | [生产部署](/deployment/production) |
| 配置变量全量参考 | [配置项](/deployment/configuration) |
| 编写 ClassIntra 应用 | [第一个应用：从零到上架](/development/first-app) |
