---
title: API 参考
description: ClassIntra 校园内网 WebOS API 总览，涵盖前端核心模块 API（ServiceRegistry / ThemeEngine / EventBus / HotkeyManager / SearchRegistry / PersistenceStore）与服务端 HTTP + WebSocket API。
outline: [2, 3]
---

# API 参考

ClassIntra 校园内网 WebOS 提供两套互补的 API，分别面向**前端运行时核心模块**与**服务端接入**。本章节是它们的总入口，也是一份严谨的参考手册。

## API 类型一览

| 类型 | 协议 / 形态 | 运行位置 | 主要用途 |
|------|------------|----------|----------|
| 前端 API | ES Module（`client/src/core/`） | 浏览器（Vue 2.7 运行时） | 服务编排、主题切换、事件总线、热键、全局搜索、持久化存储 |
| 服务端 API | HTTP + WebSocket | ClassIntra Server（默认 `:5001`） | 认证、用户、管理、系统、资源、CDN 代理、集成、等级、初始化 |
| HTTP 工具 | Axios 封装（`utils/api.js`） | 浏览器 | 统一请求拦截、Token 注入、401 自动跳转、断网保护 |
| WebSocket 客户端 | 原生 WebSocket + HTTP 长轮询回退 | 浏览器 | 实时聊天、通知推送、心跳保活 |

::: tip 何时用哪一套
- 在前端代码中调用核心模块（事件总线、主题切换、热键注册） → 使用[前端 API](./client)
- 通过命令行、外部脚本或第三方系统集成 ClassIntra → 调用[服务端 API](./server)
- 撰写 manifest、约束数据库结构、排查 WebSocket 消息格式 → 查阅[类型定义](./types)
:::

## 板块导航

| 板块 | 内容要点 |
|------|----------|
| [前端 API 参考](./client) | ServiceRegistry、ThemeEngine、EventBus、HotkeyManager、SearchRegistry、PersistenceStore 及 utils/api.js、utils/websocket.js 使用示例 |
| [服务端 API 参考](./server) | 认证、用户、管理、初始化、资源、等级、CDN 代理、系统、集成 9 大路由模块的端点表与请求/响应示例 |
| [类型定义](./types) | 数据库表结构、Manifest Schema、WebSocket 消息格式、API 响应格式、环境变量、错误码常量 |

## 阅读约定

- 所有源码路径均相对仓库根目录，标注形式为 `server/src/routes/auth.js`、`client/src/core/service-registry.js`。
- 标注 `异步` 的方法返回 `Promise`，需要 `await` 或 `.then()` 链式调用。
- 表格中"认证"列：`否` 表示公开端点，`是` 表示需要 `Authorization: Bearer <token>` 或 `Cookie: token=...`，`管理员` 表示仅 `is_admin = 1` 的用户可访问。
- 文档中 `:id`、`:name` 代表路径参数，`*` 代表通配（如 `/api/cdn/proxy?url=*`）。
- 前端代码使用 Vue 2.7 Options API + ES Module 语法；后端代码使用 CommonJS（`require` / `module.exports`）。
- 所有 API 响应统一为 JSON，结构为 `{ code, message, data }`，详见 [服务端 API — 通用响应格式](./server#通用响应格式)。

::: warning 版本对齐
本参考手册与 ClassIntra 主仓库 `server/src/routes/`、`client/src/core/`、`client/src/utils/` 同步。如发现行为与文档不一致，请以源码为准并提交 Issue 修订文档。
:::

## 相关文档

- [核心概念 — 应用架构](/concepts/architecture)
- [核心概念 — Manifest 清单](/concepts/manifest)
- [核心概念 — 主题系统](/concepts/theme-system)
- [核心概念 — WebSocket 通信](/concepts/websocket)
- [核心概念 — 认证与权限](/concepts/auth)
- [核心概念 — 应用管控](/concepts/app-control)
- [开发指南 — 第三方应用开发](/development/third-party)
