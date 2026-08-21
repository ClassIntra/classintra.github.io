---
title: 应用管控
description: ClassIntra 应用管控系统，包含 app_control 表结构、应用启用/禁用机制、路由守卫检查流程、管理员远程管控、默认应用加载（default-apps-loader.js）以及桌面布局与 Dock 生成。
---

# 应用管控

ClassIntra 通过 `app_control` 表实现应用的启用/禁用管控。管理员可远程启用或禁用桌面上的每个应用，前端路由守卫根据管控状态决定是否允许进入对应路由。管控状态由 `apps/*/manifest.json` 的 `defaultEnabled` 字段决定初始值，运行时由管理员通过后台动态调整。

源码位置：`server/src/utils/init-db.js`、`server/src/core/default-apps-loader.js`、`server/src/routes/system.js`、`server/src/routes/admin.js`、`client/src/router/index.js`

## app_control 表结构

`app_control` 表存储应用的启用/禁用状态，由 `000_baseline.js` 迁移创建：

| 字段 | 类型 | 说明 |
|------|------|------|
| `app_name` | TEXT PRIMARY KEY | 应用唯一标识（对应 `manifest.json` 的 `name` 字段） |
| `enabled` | INTEGER | 是否启用（`1` = 启用，`0` = 禁用） |

### 建表语句

```sql
CREATE TABLE IF NOT EXISTS app_control (
  app_name TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1
);
```

::: tip 简洁设计
`app_control` 表刻意保持极简：只有 `app_name` 和 `enabled` 两个字段。应用的元数据（label / icon / color / order / category）由 `apps/*/manifest.json` 提供，管控表只负责"启用/禁用"这一单一职责。
:::

## 应用启用/禁用机制

### 默认应用初始化

`init-db.js` 在数据初始化阶段调用 `default-apps-loader.getDefaultApps()` 获取所有 `defaultEnabled !== false` 的应用，写入 `app_control` 表：

```javascript
// init-db.js
var defaultAppsLoader = require('../core/default-apps-loader');
var defaultApps = defaultAppsLoader.getDefaultApps();
var initAppStmt = db.prepare("INSERT OR IGNORE INTO app_control (app_name, enabled) VALUES (?, 1)");
for (var i = 0; i < defaultApps.length; i++) {
  initAppStmt.run(defaultApps[i]);
}
```

::: warning INSERT OR IGNORE 策略
默认应用初始化使用 `INSERT OR IGNORE`，避免覆盖管理员已有的管控决策。即：

- 全新数据库：所有 `defaultEnabled !== false` 的应用插入，`enabled = 1`
- 已有数据库：跳过已存在的 `app_name`，保留管理员手动禁用过的状态

这确保管理员修改不会被重启覆盖。
:::

### 云盘应用清理

云盘已合并到资源仓库（`apps/cloud/` → `apps/resource/`），`init-db.js` 会清理孤儿管控记录：

```javascript
// 幂等：无 cloud 行时 DELETE 不报错
try {
  db.prepare("DELETE FROM app_control WHERE app_name = 'cloud'").run();
} catch (e) { /* app_control 表可能尚未创建，忽略 */ }
```

## 路由守卫检查流程

源码：`client/src/router/index.js`

### 检查流程图

```
用户访问路由（如 /countdown）
    ↓
router.beforeEach(to, from, next)
    ↓
1. 检查 user.status === 'disabled' → 跳转 Banned
    ↓
2. 检查 to.meta.requiresAuth && !token → 跳转 Login
    ↓
3. 提取 appName = ROUTE_APP_MAP[to.path]
    ↓
appName 存在 && to.meta.requiresAuth && token ?
    ├─ 否 → proceedWithAdminCheck(to, next)（直接通过）
    └─ 是
        ↓
        4. 判断是否管理员/班干
        var isAdminUser = user.is_admin === 1 || user.role === 'officer'
        ↓
        isAdminUser ?
        ├─ 是 → proceedWithAdminCheck(to, next)（管理员不受管控限制）
        └─ 否
            ↓
            5. 检查 appName === 'browser'
            ├─ 是 → 检查 user.info.browser_enabled
            │       ├─ true → proceedWithAdminCheck(to, next)
            │       └─ false → next({ name: 'Desktop' })
            └─ 否
                ↓
                6. getEnabledApps().then(function(enabledApps) {
                     enabledApps.indexOf(appName) === -1 ?
                       ├─ 是 → next({ name: 'Desktop' })（应用被禁用）
                       └─ 否 → proceedWithAdminCheck(to, next)
                   })
```

### ROUTE_APP_MAP

`ROUTE_APP_MAP` 由 `router-aggregator.js` 从 `apps/*/manifest.json` 聚合产生，映射路由路径到应用名：

```javascript
// 由 @/core/router-aggregator 从 apps/*/manifest.json 聚合产生
ROUTE_APP_MAP = {
  '/countdown': 'countdown',
  '/calendar': 'calendar',
  '/notes': 'notes',
  '/resource': 'resource',
  '/ai-chat': 'ai-chat',
  '/chat': 'chat',
  '/community': 'community',
  '/timetable': 'timetable',
  '/weather': 'weather',
  '/music': 'music',
  '/settings': 'settings',
  '/admin': 'admin',
  '/integration': 'integration'
};

// browser 路由不通过 manifest 注册（写死在路由表）
ROUTE_APP_MAP['/browser'] = 'browser';
```

::: tip 超能岛浏览器例外
超能岛浏览器（`/browser` 路由）不通过应用管控，改为 per-user `browser_enabled` 字段控制。这是因为浏览器权限属于用户级隐私设置，而非应用级管控。`browser_enabled` 在管理后台 → 用户列表 → 编辑用户 → 超能岛浏览器 中配置。
:::

### 应用管控缓存

前端缓存启用应用列表，避免每次路由跳转都请求后端：

```javascript
var enabledAppsCache = null;       // null=未加载，数组=已加载
var enabledAppsLoading = null;     // 进行中的请求

function getEnabledApps() {
  if (enabledAppsCache !== null) return Promise.resolve(enabledAppsCache);
  if (enabledAppsLoading) return enabledAppsLoading;
  enabledAppsLoading = api.get('/system/app-control').then(function(response) {
    enabledAppsCache = response.data.data.enabled_apps || [];
    enabledAppsLoading = null;
    return enabledAppsCache;
  }).catch(function() {
    // 降级：全部启用（数据库异常时也不影响用户使用）
    enabledAppsCache = ['chat', 'community', 'ai-chat', 'notes', 'resource',
                       'weather', 'music', 'settings', 'timetable',
                       'calendar', 'countdown', 'browser'];
    enabledAppsLoading = null;
    return enabledAppsCache;
  });
  return enabledAppsLoading;
}
```

::: warning 降级策略
当 `/api/system/app-control` 请求失败时（如网络异常或数据库错误），前端降级为"全部启用"。这确保即使管控服务异常，用户仍可正常使用所有应用。`/api/system/app-control` 路由本身也有同样的降级：

```javascript
// server/src/routes/system.js
router.get('/app-control', function(req, res) {
  auth.requireAuth(req, res, function() {
    try {
      var rows = db.prepare('SELECT app_name, enabled FROM app_control').all();
      // ...
    } catch (e) {
      // 数据库异常时返回全部启用（降级处理）
      res.json({ code: 200, data: { enabled_apps: [...所有应用...] } });
    }
  });
});
```
:::

### 缓存清除

管理员修改应用管控后，前端通过 `router.clearAppControlCache()` 清除缓存：

```javascript
// 导出缓存清除函数，供管理页面调用
router.clearAppControlCache = clearAppControlCache;

function clearAppControlCache() {
  enabledAppsCache = null;
  enabledAppsLoading = null;
}
```

管理后台在修改管控状态后会调用此函数，下次路由跳转会重新请求 `/api/system/app-control`。

## 管理员远程管控

### 管控 API

管理员通过以下 API 远程管控应用：

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/system/app-control` | `requireAuth` | 获取启用应用列表（所有登录用户可调用） |
| `GET` | `/api/admin/apps` | `requireAuth` + `requireAdmin` | 获取所有应用元数据（管理员可见） |
| `POST` | `/api/admin/app-control` | `requireAuth` + `requireAdmin` + `requirePermission('manage_app_control')` | 启用/禁用应用 |

### 获取启用应用列表

```javascript
// server/src/routes/system.js
router.get('/app-control', function(req, res) {
  auth.requireAuth(req, res, function() {
    try {
      var rows = db.prepare('SELECT app_name, enabled FROM app_control').all();
      var enabledApps = [];
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].enabled) enabledApps.push(rows[i].app_name);
      }
      res.json({ code: 200, data: { enabled_apps: enabledApps } });
    } catch (e) {
      // 数据库异常时返回全部启用（降级）
      res.json({ code: 200, data: { enabled_apps: [...全部应用...] } });
    }
  });
});
```

### 启用/禁用应用

```javascript
// server/src/routes/admin.js
router.post('/app-control', auth.requirePermission('manage_app_control'), function(req, res) {
  var appName = req.body.app_name;
  var enabled = req.body.enabled ? 1 : 0;
  // UPSERT：存在则更新 enabled，不存在则插入
  db.prepare(
    'INSERT INTO app_control (app_name, enabled) VALUES (?, ?) ' +
    'ON CONFLICT(app_name) DO UPDATE SET enabled = excluded.enabled'
  ).run(appName, enabled);
  // 记录管理员操作日志
  logAction(req.user.user_id, 'app_control', appName, 'enabled=' + enabled);
  res.json({ code: 200, message: '应用管控已更新' });
});
```

::: tip 管理员不受管控限制
路由守卫中，管理员（`is_admin === 1`）和班干（`role === 'officer'`）不受应用管控限制，确保管理员始终能访问所有应用进行管理。这避免了"管理员误禁用管理后台后无法恢复"的死锁。
:::

## 默认应用加载（default-apps-loader.js）

源码：`server/src/core/default-apps-loader.js`

`default-apps-loader.js` 是后端聚合层模块，从 `apps/*/manifest.json` 提取应用列表，供 `init-db.js` 初始化 `app_control` 表、`admin` 路由展示管理界面。

### 核心 API

| 方法 | 返回 | 说明 |
|------|------|------|
| `getDefaultApps()` | `string[]` | 默认启用的应用名列表（`defaultEnabled !== false`） |
| `getAllApps()` | `object[]` | 所有应用元数据（供管理后台） |
| `getDesktopApps()` | `object[]` | 桌面应用（`category === 'desktop'`） |

### 实现

```javascript
var manifestLoader = require('./manifest-loader');

// 获取默认启用的应用列表
function getDefaultApps() {
  var manifests = manifestLoader.loadManifests();
  return manifests
    .filter(function(m) { return m.defaultEnabled !== false; })
    .map(function(m) { return m.name; });
}

// 获取所有应用元数据（供管理后台）
function getAllApps() {
  var manifests = manifestLoader.loadManifests();
  return manifests.map(function(m) {
    return {
      name: m.name,
      label: m.label,
      icon: m.icon,
      color: m.color,
      category: m.category || 'desktop',
      canDisable: m.canDisable !== false,
      defaultEnabled: m.defaultEnabled !== false,
      order: m.order || 99
    };
  });
}

// 获取桌面应用（category === 'desktop'）
function getDesktopApps() {
  var manifests = manifestLoader.loadManifests();
  return manifests
    .filter(function(m) { return (m.category || 'desktop') === 'desktop'; })
    .map(function(m) {
      return {
        name: m.name,
        label: m.label,
        icon: m.icon,
        color: m.color,
        route: m.frontend && m.frontend.route
      };
    });
}
```

### getAllApps() 返回示例

```javascript
[
  {
    name: 'countdown',
    label: '倒数日',
    icon: '/resources/public/icons/Countdown.png',
    color: '#FF9500',
    category: 'desktop',
    canDisable: true,
    defaultEnabled: true,
    order: 11
  },
  // ...
]
```

## 桌面布局与 Dock 生成

桌面布局由 `client/src/views/Desktop.vue` 渲染，应用列表来自 `APP_REGISTRY`（由 `app-registry.js` 聚合 manifest 产生），并经过 `app_control` 过滤。

### 应用列表生成流程

```
1. app-registry.js 聚合 apps/*/manifest.json → APP_REGISTRY
    ↓
2. store/modules/desktop.js 加载 APP_REGISTRY 到 state
    ↓
3. GET /api/system/app-control 获取 enabled_apps
    ↓
4. Desktop.vue 过滤：
   apps = APP_REGISTRY
     .filter(app => app.category === 'desktop')   // 仅桌面应用
     .filter(app => enabled_apps.includes(app.name)) // 仅启用的应用
     .sort((a, b) => a.order - b.order)             // 按 order 排序
    ↓
5. 分页渲染（每页 24 个图标，类 iOS 启动台）
    ↓
6. Dock 栏：固定显示常用应用（如 chat / community / ai-chat）
```

### 桌面应用元数据

每个桌面应用包含以下元数据（由 manifest.json 提供）：

| 字段 | 来源 | 说明 |
|------|------|------|
| `name` | `manifest.name` | 应用唯一标识 |
| `label` | `manifest.label` | 显示名称 |
| `icon` | `manifest.icon` | 图标路径 |
| `color` | `manifest.color` | 主题色（图标背景） |
| `category` | `manifest.category` | 分类（`desktop` / `system` / `hidden`） |
| `order` | `manifest.order` | 排序权重（越小越靠前，缺省 99） |
| `route` | `manifest.frontend.route` | 主路由路径 |
| `canDisable` | `manifest.canDisable` | 是否允许用户禁用（缺省 `true`） |

::: tip 分页与 Dock
桌面应用分页显示，每页 24 个图标（6 列 × 4 行），底部有页码指示器。Dock 栏固定显示常用应用，不受分页影响。壁纸切换、锁屏密码、超能岛通知中心等桌面级功能由 `App.vue` 全局管理。
:::

### 应用图标组件

`client/src/components/AppIcon.vue` 负责渲染单个应用图标，支持：

- 图标 + 标签的双行布局
- 触控优化（最小触摸区域 44px）
- 长按进入编辑模式（删除/移动）
- 拖拽排序（`desktop-drag.js` mixin）
- 主题色背景（`manifest.color`）

## 相关文档

- [架构概览](./)
- [应用架构详解](./architecture)
- [Manifest 清单](./manifest)
- [主题系统](./theme-system)
- [WebSocket 通信](./websocket)
- [认证与权限](./auth)
- [快速开始](/quick-start/)
