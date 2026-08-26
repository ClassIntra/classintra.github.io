---
title: 应用架构详解
description: ClassIntra 五层架构详解，包含核心层 6 大模块（ServiceRegistry / ThemeEngine / EventBus / HotkeyManager / SearchRegistry / PersistenceStore）、聚合层工作流程、前端 11 步与后端 7 步启动流程，以及 Chrome 80 兼容约束表。
---

# 应用架构详解

本文档深入 ClassIntra 的五层架构，详细介绍核心层 6 大模块、聚合层工作流程、前后端启动流程，以及 Chrome 80 兼容约束。

源码位置：`client/src/core/`、`server/src/core/`

## 五层架构详解

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

### 各层职责与关键文件

| 层级 | 位置 | 职责 | 关键文件 |
|------|------|------|----------|
| 应用层 | `apps/*/` | 独立可插拔的应用模块 | `apps/countdown/manifest.json`、`apps/resource/manifest.json` |
| 聚合层 | `client/src/core/*-aggregator.js` | 自动聚合路由表、Vuex 模块、桌面 widget | `manifest-loader.js`、`router-aggregator.js`、`store-aggregator.js`、`widget-aggregator.js` |
| 集成层 | `client/src/integrations/` + `server/src/integrations/` | 与外部系统双向通信 | `postmessage-bridge.js`、`webhook-receiver.js`、`outbound-dispatcher.js` |
| 核心层 | `client/src/core/` | 前端基础设施，单例 + 懒创建 | `service-registry.js`、`theme-engine.js`、`event-bus.js` |
| 共享层 | `shared/src/` | 跨端契约（ES Module，前端引用） | `constants.js`、`errors.js`、`manifest-schema.js`、`integration-contract.js` |

::: tip 为什么前后端不共用一套共享层
- 前端用 Vite 打包，必须 ES Module
- 后端用 Node.js CommonJS（`require`），且不希望通过构建步骤
- 强行共用会引入打包复杂度，违背"低复杂度"原则

后端在 `server/src/core/` 维护 CommonJS 等价版本（人工同步）。
:::

## 核心层模块

核心层位于 `client/src/core/`，全部采用 **单例 + 懒创建** 模式，通过 `getXxx()` 获取实例。

### 核心层模块一览

| 模块 | 文件 | 作用 | 设计要点 |
|------|------|------|----------|
| ServiceRegistry | `service-registry.js` | 服务注册中心 | 懒创建 + 单例缓存 + 逆序销毁 + 异常隔离 |
| ThemeEngine | `theme-engine.js` | 主题引擎 | setTheme + `--ci-*` 变量 + 动画开关 + 订阅通知 |
| EventBus | `event-bus.js` | 事件总线 | handler 异常隔离 + 防递归 + 单例 `getEventBus()` |
| HotkeyManager | `hotkey-manager.js` | 快捷键管理器 | capture 阶段监听 + 倒序匹配 + 输入框过滤 |
| SearchRegistry | `search-registry.js` | 全局搜索 | 应用 + 命令 + Provider 三源搜索 |
| PersistenceStore | `persistence-store.js` | 持久化存储 | localStorage 优先 + memory 降级 + 数据迁移 |

::: warning 后端对应模块
后端在 `server/src/core/` 维护对应实现：`service-registry.js`、`lifecycle-orchestrator.js`、`manifest-loader.js`、`route-aggregator.js`、`default-apps-loader.js`、`errors.js`、`manifest-schema.js`。
:::

### ServiceRegistry 服务注册中心

源码：`client/src/core/service-registry.js`

**设计要点**：

1. **懒创建**：`register(name, factory)` 仅注册工厂，`resolve(name)` 时才实例化
2. **单例缓存**：首次 resolve 创建并缓存，后续返回同一实例
3. **生命周期**：factory 可返回 `{ instance, destroy }`，shutdown 时**逆序**调用 destroy
4. **异常隔离**：单个服务 destroy 异常不中断其他服务
5. **异步支持**：`resolveAsync(name)` 支持 factory 返回 Promise

**已注册服务**（见 `client/src/main.js`）：

| 服务名 | 实例 | 说明 |
|--------|------|------|
| `eventBus` | `EventEmitter` | 全局事件总线 |
| `store` | Vuex Store | 状态管理 |
| `themeEngine` | `ThemeEngine` | 主题引擎 |
| `hotkey` | `HotkeyManager` | 快捷键 |
| `integration` | `IntegrationManager` | 集成系统 |
| `search` | `SearchRegistry` | 全局搜索 |

**使用方式**：

```javascript
// main.js 中注册
import { getServiceRegistry } from '@/core/service-registry';
var serviceRegistry = getServiceRegistry();
serviceRegistry.register('themeEngine', function() { return getThemeEngine(); });
serviceRegistry.register('store', function() { return store; });

// 组件中使用
this.$services.resolve('themeEngine').setTheme('dark');
```

### ThemeEngine 主题引擎

源码：`client/src/core/theme-engine.js`

**设计要点**：

1. `setTheme(id)` 通过 `setAttribute('data-theme', id)` 触发 CSS 切换（旧机制，向后兼容）
2. 额外写入 `--ci-*` 新变量（inline style），供新代码使用
3. 旧变量（`--primary-color` 等）继续由 `:root` 和 `[data-theme="dark"]` CSS 提供
4. `subscribe(callback)` 订阅主题变化，`setMotionEnabled(false)` 关闭动画
5. **双写策略**：新代码用 `--ci-*`，旧代码继续用旧变量，后续清理

详见 [主题系统](./theme-system)。

### EventBus 事件总线

源码：`client/src/core/event-bus.js`

**设计要点**：

1. handler 异常隔离：单个 handler throw 不影响其他 handler
2. `emit` 时复制 handlers 数组，防止遍历中被修改
3. `'error:handler'` 事件用于报告 handler 异常（避免递归）
4. 单例 `getEventBus()`

**事件名规范**（见 `shared/src/constants.js`）：

```javascript
EVENT_NAMES = {
  THEME_CHANGED: 'theme:changed',
  THEME_MOTION_TOGGLED: 'theme:motion-toggled',
  APP_LAUNCHED: 'app:launched',
  APP_CLOSED: 'app:closed',
  USER_SIGNED_IN: 'user:signed-in',
  USER_SIGNED_OUT: 'user:signed-out',
  INTEGRATION_HANDSHAKE: 'integration:handshake',
  INTEGRATION_EVENT: 'integration:event',
  INTEGRATION_DISCONNECTED: 'integration:disconnected'
}
```

::: tip 局部事件
局部事件可由各模块自定义，不强制全部声明在 `constants.js` 中。命名建议使用 `域:动作` 格式（如 `chat:message-received`）。
:::

### HotkeyManager 快捷键管理器

源码：`client/src/core/hotkey-manager.js`

**设计要点**：

1. **capture 阶段监听**：`addEventListener('keydown', handler, true)` 确保在 target 之前拦截
2. **combo normalize**：`'Ctrl+K'` / `'ctrl+k'` / `'Control+K'` 统一为 `'ctrl+k'`
3. **输入框过滤**：默认在 input/textarea/contenteditable 中不触发（除非声明 `global: true`）
4. **倒序匹配**：后注册的优先级高（允许覆盖）
5. `register(binding)` 返回**取消注册函数**

**使用方式**：

```javascript
import { getHotkeyManager } from '@/core/hotkey-manager';
var hotkey = getHotkeyManager();

// 注册 Ctrl+K（输入框中也触发）
var unregister = hotkey.register({
  id: 'global-search',
  combo: 'Ctrl+K',
  description: '打开全局搜索',
  global: true,                  // 输入框中也触发
  handler: function(e) {
    e.preventDefault();
    openSearch();
  }
});

// 取消注册
unregister();
```

### SearchRegistry 全局搜索

源码：`client/src/core/search-registry.js` + `client/src/components/GlobalSearch.vue`

**三源搜索**：

| 来源 | 数据 | 匹配字段 | 点击行为 |
|------|------|----------|----------|
| 应用 | `APP_REGISTRY` | `name` / `label` | 跳转路由 |
| 命令 | `registerCommand` | `title` / `keywords` / `description` | 执行 `action` |
| Provider | `registerProvider` | 自定义 | 自定义渲染 |

**使用方式**：

```javascript
import { getSearchRegistry } from '@/core/search-registry';
var search = getSearchRegistry();

// 注册命令
search.registerCommand({
  id: 'toggle-theme',
  title: '切换深色模式',
  description: '在浅色/深色主题间切换',
  keywords: ['theme', 'dark', '主题', '深色'],
  icon: 'fa-solid fa-moon',
  action: function() { /* ... */ }
});

// 注册自定义 Provider（异步）
search.registerProvider({
  id: 'notes',
  category: '笔记',
  search: function(query) {
    return fetch('/api/notes/search?q=' + encodeURIComponent(query))
      .then(function(r) { return r.json(); })
      .then(function(data) { return data.items; });
  }
});
```

**UI 触发**：`Ctrl+K` 唤起 `GlobalSearch.vue`（在 `App.vue` 中注册 hotkey）。

### PersistenceStore 持久化存储

源码：`client/src/core/persistence-store.js`

**设计要点**：

1. localStorage 优先，memory 降级（隐私模式或 storage 被禁用时）
2. `prefix` 隔离命名空间（默认 `classintra:`），避免与其他应用冲突
3. `MigrationStep` 支持数据迁移（按 version 升序执行）
4. `onChange(key, handler)` 订阅 key 变化

**使用方式**：

```javascript
import { getDefaultStore } from '@/core/persistence-store';
var store = getDefaultStore();

store.set('user preference', { theme: 'dark', lang: 'zh-CN' });
var pref = store.get('user preference', { theme: 'light' });  // 第二参数为默认值

// 订阅变化
var unsubscribe = store.onChange('user preference', function(newValue, fullKey) {
  console.log('偏好已更新:', newValue);
});
unsubscribe();
```

## 聚合层工作流程

聚合层位于 `client/src/core/*-aggregator.js`，从 `apps/*/manifest.json` 自动聚合路由表、Vuex 模块、桌面 widget，无需手动注册。

### 前端聚合器

| 聚合器 | 输出 | 使用方 |
|--------|------|--------|
| `manifest-loader.js` | `loadManifests()` / `getComponent(appName, relPath)` | 其他聚合器共用 |
| `router-aggregator.js` | `appRoutes`（Vue Router 路由表）+ `ROUTE_APP_MAP` | `client/src/router/index.js` |
| `store-aggregator.js` | `APP_STORE_MODULES`（Vuex 模块映射） | `client/src/store/index.js` |
| `widget-aggregator.js` | `WIDGET_REGISTRY` + `getWidget` / `listWidgets` / `registerWidget` | `components/Desktop.vue` |
| `app-registry.js` | `APP_REGISTRY`（桌面应用元数据） | `store/modules/desktop.js` |

### 后端聚合器

| 聚合器 | 输出 | 使用方 |
|--------|------|--------|
| `server/src/core/manifest-loader.js` | `loadManifests()` / `getAppEntryPath()` | 其他后端聚合器 |
| `server/src/core/route-aggregator.js` | `mountAppRoutes(app)` / `getBackendApps()` | `server/src/app.js` |
| `server/src/core/default-apps-loader.js` | `getDefaultApps()` / `getAllApps()` / `getDesktopApps()` | `init-db.js` / `admin` 路由 |

### 自动聚合流程图

**前端聚合**（启动时一次性聚合）：

```
import.meta.glob('../../../apps/*/manifest.json', { eager: true })
    ↓
manifest-loader.loadManifests()
    ↓ 校验 + 排序
    ↓
┌──────────────────┬──────────────────┬──────────────────┐
│ router-aggregator│ store-aggregator │ widget-aggregator│
│ → appRoutes      │ → APP_STORE_     │ → WIDGET_REGISTRY│
│ → ROUTE_APP_MAP  │   MODULES        │                  │
└──────────────────┴──────────────────┴──────────────────┘
    ↓                   ↓                   ↓
router/index.js     store/index.js     Desktop.vue
```

**后端聚合**（启动时挂载）：

```
manifest-loader.loadManifests()
    ↓
route-aggregator.mountAppRoutes(app)
    ↓ 遍历 manifest
    ↓ 主 backend + extraBackends（数组）
    ↓ 应用 manifest.backend.rateLimit 限流中间件
express app.use(mountPath, router)
```

::: tip manifest-loader 共享
前端 `manifest-loader.js` 是所有聚合器的基础，调用 `loadManifests()` 返回经过 `validateManifest` 校验和按 `order` 排序的 manifest 列表。其他聚合器都依赖它的输出。
:::

## 启动流程

### 前端启动（11 步）

入口：`client/src/main.js`

```
1. Polyfills（Object.hasOwn / replaceAll / Promise.any / Array.at）
    ↓
2. import Vue + App + router + store + 全局组件
    ↓
3. 注册全局错误处理（Vue.config.errorHandler / window.onerror / unhandledrejection）
    ↓
4. 注册全局组件（ModalDialog / LoadingSkeleton / ErrorBoundary）
    ↓
5. Vue.use(ModalPlugin) — 暴露 this.$modal
    ↓
6. router.onError + 包装 router.push/replace（捕获 NavigationDuplicated）
    ↓
7. ServiceRegistry 注册核心服务（eventBus / store / themeEngine / hotkey / integration / search）
    ↓
8. Vue.prototype.$services = serviceRegistry  — 组件内 this.$services.resolve('xxx')
    ↓
9. window.__router = router  — 供 SearchRegistry 应用搜索跳转
    ↓
10. new Vue({ router, store, render }).$mount('#app')
    ↓
11. window.__onVueReady()  — 供测试脚本感知就绪
```

**App.vue mounted** 阶段额外完成：

- 初始化 `$modal` 实例
- 检测性能等级（low/medium/high）→ `data-perf` 属性
- 应用主题 + 初始化动画开关
- 拉取用户状态 + 用户设置（壁纸/主题同步）
- 注册 WebSocket 消息处理（封禁 / 应用更新 / 权限变更 / 天气预警）
- 启动心跳检测（2 秒间隔，5 次失败才锁屏）
- 注册 `Ctrl+K` 全局搜索快捷键
- 启动更新检查器

### 后端启动（7 步）

入口：`server/src/app.js`

```
1. 加载 .env + config
    ↓
2. 初始化数据库（init-db.js）
   ├─ migrationRunner.runAll()  — 执行 schema 迁移
   ├─ _initData()               — 数据初始化（预注册 / 默认应用 / watermark）
   └─ runCloudMigration()       — 云盘旧文件迁移（幂等）
    ↓
3. 创建 Express app + 中间件（json / urlencoded / cookie-parser / 静态资源）
    ↓
4. 挂载旧路由（auth / chat / community / admin / setup ...）
    ↓
5. route-aggregator.mountAppRoutes(app)  — 挂载 apps/*/backend/ 路由
    ↓
6. 启动 HTTP server + WebSocket server
    ↓
7. （可选）LifecycleOrchestrator.startup()  — 分阶段启动（本期预留）
```

::: warning 数据库初始化顺序
后端启动时数据库初始化的调用顺序严格为：

1. `migrationRunner.runAll()` — 执行所有待执行的 schema 迁移（幂等）
2. `_initData()` — 数据初始化（预注册名单、班管账号、班级群、默认分组、默认应用、watermark）
3. `runCloudMigration()` — 云盘旧文件自动迁移（文件系统操作，幂等）

顺序不能颠倒：迁移必须先于数据初始化，否则数据初始化可能因表不存在而失败。
:::

## Chrome 80 兼容约束

详见 [Chrome 80 兼容](/development/chrome-80-compat)。核心约束如下表：

| 禁用语法 | 原因 | 替代方案 |
|----------|------|----------|
| `?.`（可选链） | Chrome 80 不支持 | 显式 `&&` 判断 |
| `??`（空值合并） | Chrome 80 不支持 | `\|\|` 配合显式 null 检查 |
| `??=` / `\|\|=` / `&&=` | Chrome 80 不支持 | 显式赋值 |
| `class` 语法 | 与现有代码风格不一致 | 构造函数 + prototype |
| `let` / `const` | 与现有代码风格不一致（项目约定 `var`） | `var` |
| 模板字符串 | 与现有代码风格不一致 | 字符串拼接 |
| 箭头函数 | 与现有代码风格不一致 | `function` |
| `Object.hasOwn` | Chrome 93+ | `main.js` 已 polyfill |
| `String.prototype.replaceAll` | Chrome 85+ | `main.js` 已 polyfill |
| `Promise.any` | Chrome 85+ | `main.js` 已 polyfill |
| `Array.prototype.at` | Chrome 92+ | `main.js` 已 polyfill |

::: danger 项目约定
所有源码必须遵守以下约定，PR 不符合约定将被拒绝：

- 统一使用 `var`（不使用 `let` / `const`）
- 统一使用 `function`（不使用箭头函数）
- 统一使用构造函数 + prototype（不使用 `class`）
- 统一使用字符串拼接（不使用模板字符串）
- 统一使用显式 `&&` 判断（不使用 `?.`）
- 单引号、2 空格缩进、kebab-case 文件名
:::

## 相关文档

- [架构概览](./)
- [Manifest 清单](./manifest)
- [主题系统](./theme-system)
- [WebSocket 通信](./websocket)
- [认证与权限](./auth)
- [应用管控](./app-control)
- [快速开始](/quick-start/)
