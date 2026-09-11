---
title: 架构概览
description: ClassIntra 校园内网 WebOS 的整体架构总览、五层分层模型、目录结构、与 Ditto 的对比，以及核心设计原则导航。
---

# 架构概览

ClassIntra 是面向教育场景的 Web 桌面系统，技术栈锁定 **Vue 2.7 + JavaScript**，必须兼容 **Chrome 80** 及更低版本浏览器（教育终端常见）。一台服务器 + 一台平板即可构建完整的班级数字平台，无需外网，局域网即可运行。

本章节介绍 ClassIntra 的核心架构、设计理念与子系统导航，帮助你快速建立全局认知。

## 项目定位

ClassIntra 为班级教室场景而生，定位为「校园内网 WebOS」：

- **校园内网优先**：局域网即可运行，数据不出校
- **横屏平板优化**：专为 960×600 横屏平板设计，触控优先，最小触摸区域 44px
- **类 iOS 设计**：自研 `ios/` 组件库，启动台、Dock 栏、超能岛通知中心
- **Chrome 80 兼容**：通过 `@vitejs/plugin-legacy` 适配老旧教育终端
- **应用可插拔**：`apps/*/manifest.json` 驱动的聚合式应用架构

::: tip 语法约束
为了兼容 Chrome 80 与教育终端老旧浏览器，项目禁用 `?.` / `??` / `??=` / `||=` / `&&=`，统一使用 `var` + `function`，不使用 `class` / 箭头函数 / 模板字符串。详见 [Chrome 80 兼容约束](./architecture#_6-chrome-80-兼容约束)。
:::

## 五层架构

ClassIntra 分为 5 层，每层职责单一、依赖方向清晰（上层依赖下层，下层不感知上层）：

```
┌─────────────────────────────────────────────────────────────┐
│  应用层 (apps/*)                                             │
│  每个应用自带 frontend/backend/manifest.json，独立可插拔       │
└─────────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────────────────────────────────────────┐
│  聚合层 (core/*-aggregator)                                  │
│  从 apps/*/manifest.json 聚合 路由/store/widget/后端路由       │
└─────────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────────────────────────────────────────┐
│  集成层 (integrations/)                                      │
│  PostMessage Bridge + Outbound Launcher + Webhook 双向通信   │
└─────────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────────────────────────────────────────┐
│  核心层 (core/)                                              │
│  ServiceRegistry / ThemeEngine / EventBus / HotkeyManager /  │
│  SearchRegistry / PersistenceStore                           │
└─────────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────────────────────────────────────────┐
│  共享层 (shared/)                                            │
│  ClassIntraError / constants / manifest-schema /             │
│  integration-contract / theme-tokens                         │
└─────────────────────────────────────────────────────────────┘
```

| 层级 | 位置 | 职责 |
|------|------|------|
| 应用层 | `apps/*/` | 每个应用独立可插拔，自带 manifest.json + frontend + backend |
| 聚合层 | `client/src/core/*-aggregator.js` | 自动聚合路由表、Vuex 模块、桌面 widget |
| 集成层 | `client/src/integrations/` + `server/src/integrations/` | 与外部系统的双向通信（postMessage + webhook） |
| 核心层 | `client/src/core/` | 前端基础设施（ServiceRegistry / ThemeEngine / EventBus / HotkeyManager / SearchRegistry / PersistenceStore） |
| 共享层 | `shared/src/` | 跨端契约（错误码、Manifest Schema、集成协议、主题 Token） |

## 目录结构概览

```
ClassIntra/
├── client/                     # 前端（Vue 2.7）
│   ├── src/
│   │   ├── core/               # 核心层 + 聚合层
│   │   ├── integrations/       # 集成层（PostMessageBridge / OutboundLauncher）
│   │   ├── components/         # 通用组件（GlobalSearch / ModalDialog / ...）
│   │   ├── views/              # 系统页面（Desktop / Login / Browser / Banned）
│   │   ├── store/              # Vuex 根 + 模块
│   │   ├── router/             # 路由根（路由表由聚合器生成）
│   │   ├── utils/              # 工具（api / websocket / latex-renderer ...）
│   │   ├── styles/             # 全局样式（global.scss / _motion.scss）
│   │   └── main.js             # 入口（含 Chrome 80 polyfills）
│   └── vite.config.mjs
├── server/                     # 后端（Node.js + Express）
│   ├── src/
│   │   ├── core/               # 核心层（ServiceRegistry / LifecycleOrchestrator / manifest-loader）
│   │   ├── integrations/       # 集成层（token-store / webhook-receiver / outbound-dispatcher）
│   │   ├── migrations/         # DB 迁移脚本（按版本号顺序执行）
│   │   ├── routes/             # 旧路由（auth / chat / community / admin / system ...）
│   │   ├── middleware/         # 中间件（限流、认证）
│   │   ├── services/           # 业务服务（视频转码、中继总线）
│   │   ├── utils/              # 工具（db / init-db / migration-runner / jwt / cache ...）
│   │   ├── ws/                 # WebSocket 聊天 + 中继
│   │   └── config/             # 配置
│   └── database/               # SQLite 数据库文件
├── shared/                     # 前后端共享层（ES Module，仅前端引用）
│   └── src/
│       ├── constants.js        # 错误码 / 事件名 / 集成协议常量
│       ├── errors.js           # ClassIntraError + globalErrorHandler
│       ├── manifest-schema.js  # Manifest 字段定义 + 验证器
│       ├── integration-contract.js  # 集成协议契约
│       ├── theme-tokens.js     # LIGHT_TOKENS / DARK_TOKENS 重导出
│       └── theme-adapter.js    # flattenTokens / applyToElement
├── apps/                       # 应用层（每个应用一个目录）
│   ├── countdown/
│   ├── calendar/
│   ├── notes/
│   ├── resource/               # 资源仓库
│   ├── ai-chat/
│   ├── chat/
│   ├── community/
│   ├── timetable/
│   ├── weather/
│   ├── music/
│   ├── settings/
│   ├── admin/                  # 管理后台
│   └── integration/            # 集成管理后台 UI
├── themes/                     # 主题包（light / dark）
├── theme-extensions/           # 扩展主题（material-you）
├── plugins/                    # 插件运行时目录（源码维护于 market 仓库，如 campusbili-bridge）
├── docs/                       # 项目内文档
└── Resources/                  # 静态资源（图标、壁纸）
```

## 与 Ditto 的对比

ClassIntra **参考** Ditto 的架构设计，但**不是** Ditto 的衍生版。两者定位不同，对齐关键契约以便未来双向迁移。

| 维度 | Ditto | ClassIntra |
|------|-------|------------|
| 技术栈 | Vue 3 + TypeScript | Vue 2.7 + JavaScript |
| 语法约束 | 现代 ES2022+ | 禁用 `?.` / `??` / `??=` / `||=` / `&&=`，统一 `var` + `function` |
| 浏览器目标 | 现代浏览器（Chrome 100+） | Chrome 80+（教育终端） |
| 应用市场 | 内置 | 不做 |
| 应用级权限声明 | 完整 | 不做 |
| 主题动画 | 四档（fast/normal/slow/none） | 单档（开/关） |
| 集成方式 | postMessage 单向 | postMessage + webhook 双向 |
| Manifest 前缀 | `--ditto-*` | `--ci-*` |
| 错误码前缀 | `DITTO_*` | `CLASSINTRA_*` |
| 定位 | 通用 WebOS | 教育桌面（独立运行，对齐关键规范） |

::: warning 对齐策略
ClassIntra 与 Ditto 对齐以下契约，便于未来迁移：

- **Manifest Schema**：字段名 + 结构对齐，ClassIntra 增加 `extraBackends` 等教育场景字段
- **错误码**：前缀 `CLASSINTRA_*`（与 Ditto 的 `DITTO_*` 共存，不混用）
- **主题 Token**：`--ci-*` 前缀（与 Ditto 的 `--ditto-*` 区分）
- **集成协议**：envelope 格式兼容，但 `type: 'classintra-integration'`（不混用）

如需将 ClassIntra 应用迁移到 Ditto，只需调整 manifest 字段名 + 错误码前缀 + 主题 token 前缀，业务代码无需大改。
:::

## 核心设计原则

### 1. Chrome 80 兼容优先

通过 `main.js` 顶部注入 polyfill（`Object.hasOwn` / `String.prototype.replaceAll` / `Promise.any` / `Array.prototype.at`），并通过 `@vitejs/plugin-legacy` 生成兼容版本产物，确保在老旧教育终端可用。

### 2. Manifest 驱动的应用聚合

每个应用自带 `manifest.json`，聚合器扫描 `apps/*/manifest.json` 自动生成路由表、Vuex 模块、桌面 widget、后端路由，无需手动注册。详见 [Manifest 清单](./manifest)。

### 3. 单例 + 懒创建的核心服务

所有核心模块（ServiceRegistry / ThemeEngine / EventBus / HotkeyManager / SearchRegistry / PersistenceStore）采用单例 + 懒创建模式，首次使用时才实例化，避免启动期一次性创建所有服务的开销。详见 [应用架构详解](./architecture)。

### 4. 双写策略平滑迁移

ClassIntra 经历了从"旧变量体系"到"新 token 体系"的迁移。采用双写策略：新代码用 `--ci-*` 变量（运行时注入 inline style），旧代码继续用旧变量（由 `global.scss` 提供），后续统一清理。详见 [主题系统](./theme-system)。

### 5. 前后端对称的契约共享

共享层 `shared/src/` 定义跨端契约（错误码、Manifest Schema、集成协议、主题 Token），前端通过 `@shared` 别名引用（ES Module），后端在 `server/src/core/` 维护 CommonJS 等价版本（人工同步）。

### 6. WebSocket 中继跨班级联动

支持多班级公共聊天室实时同步（基于 Tailscale 组网），通过 `RELAY_SERVERS` 配置多服务器中继，跨班级消息自动同步。详见 [WebSocket 通信](./websocket)。

## 板块导航

本章节包含以下 7 个子文档，建议按顺序阅读：

| 板块 | 描述 | 关键内容 |
|------|------|----------|
| [架构概览](./) | 系统总览与设计原则 | 五层架构、目录结构、与 Ditto 对比 |
| [应用架构详解](./architecture) | 五层架构与启动流程 | 核心层模块、聚合层流程、前端 11 步启动、后端 7 步启动、Chrome 80 兼容约束 |
| [Manifest 清单](./manifest) | 应用清单规范 | Schema 字段、JSON 示例、聚合流程、应用管控 |
| [主题系统](./theme-system) | 主题引擎与 Token 体系 | ThemeEngine、双写策略、动画开关、扩展主题 |
| [WebSocket 通信](./websocket) | 实时通信与中继 | 连接流程、消息类型、Relay 系统、跨班级同步 |
| [认证与权限](./auth) | JWT 与权限分级 | 鉴权流程、用户 ID 格式、预注册名单、班管授权 |
| [应用管控](./app-control) | 应用启用/禁用机制 | app_control 表、路由守卫、管理员远程管控 |

::: info 阅读建议
- 初次接触 ClassIntra 的开发者：先读本页 → [应用架构详解](./architecture) → [Manifest 清单](./manifest)
- 关注实时通信的开发者：重点阅读 [WebSocket 通信](./websocket)
- 关注权限与安全的开发者：直接看 [认证与权限](./auth) 与 [应用管控](./app-control)
- 关注视觉定制的开发者：阅读 [主题系统](./theme-system)
:::

## 源码导航

核心源码位于主仓库的 `client/src/core/`、`server/src/core/` 与 `shared/src/`：

| 子系统 | 源码路径 |
|--------|----------|
| 前端核心层 | `client/src/core/` |
| 前端聚合层 | `client/src/core/*-aggregator.js` |
| 前端集成层 | `client/src/integrations/` |
| 后端核心层 | `server/src/core/` |
| 后端集成层 | `server/src/integrations/` |
| 后端 WebSocket | `server/src/ws/chat-server.js` |
| 后端认证中间件 | `server/src/middleware/auth.js` |
| 后端迁移系统 | `server/src/utils/migration-runner.js` + `server/src/migrations/` |
| 共享层契约 | `shared/src/` |
| 主题包 | `themes/` + `theme-extensions/` |
| 应用层 | `apps/*/` |

## 相关文档

- [应用架构详解](./architecture)
- [Manifest 清单](./manifest)
- [主题系统](./theme-system)
- [WebSocket 通信](./websocket)
- [认证与权限](./auth)
- [应用管控](./app-control)
- [快速开始](/quick-start/)
