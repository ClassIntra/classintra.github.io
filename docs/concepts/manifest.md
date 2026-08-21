---
title: Manifest 清单
description: ClassIntra 应用清单（manifest.json）规范，包含完整 Schema 字段表、JSON 示例、前后端自动聚合流程图、应用结构示例（countdown）以及应用管控机制。
---

# Manifest 清单

应用清单（`manifest.json`）是 ClassIntra 应用模块化架构的核心契约。前后端聚合器通过扫描 `apps/*/manifest.json` 自动挂载路由、注册桌面图标、加载小组件，无需手动注册。

源码位置：`apps/*/manifest.json`、`shared/src/manifest-schema.js`

## Manifest Schema 完整字段表

### 顶层字段

| 字段 | 类型 | 必填 | 缺省值 | 说明 |
|------|------|------|--------|------|
| `name` | string | ✅ | — | 应用唯一标识（kebab-case） |
| `label` | string | ✅ | — | 显示名称 |
| `icon` | string | ❌ | — | 图标路径（如 `/resources/public/icons/X.png`） |
| `color` | string | ❌ | — | 主题色（hex 格式） |
| `category` | string | ❌ | `desktop` | 应用分类：`desktop` / `system` / `hidden` |
| `order` | number | ❌ | `99` | 排序权重（越小越靠前） |
| `defaultEnabled` | boolean | ❌ | `true` | 默认是否启用 |
| `canDisable` | boolean | ❌ | `true` | 是否允许用户禁用 |
| `type` | string | ❌ | `app` | 应用类型：`app` / `system` / `widget` |
| `version` | string | ❌ | `0.0.0` | 语义化版本号（semver） |
| `frontend` | object | ❌ | — | 前端配置（见下表） |
| `backend` | object | ❌ | — | 后端配置（见下表） |
| `extraBackends` | array | ❌ | — | 额外后端路由（见下表） |

### `frontend` 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `route` | string | ✅ | 主路由路径（如 `/countdown`） |
| `routeName` | string | ❌ | 路由名称（如 `Countdown`） |
| `component` | string | ✅ | 组件路径（相对 manifest，如 `./frontend/Countdown.vue`） |
| `extraRoutes` | array | ❌ | 附加路由（如 cloud-picker） |
| `widgets` | array | ❌ | 桌面小组件定义 |

### `frontend.extraRoutes` 数组项

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `path` | string | ✅ | 路由路径 |
| `routeName` | string | ❌ | 路由名称 |
| `component` | string | ✅ | 组件路径 |
| `requiresAuth` | boolean | ❌ | 是否需要登录（缺省 `true`） |
| `appControl` | boolean | ❌ | 是否受应用管控（缺省 `true`） |

### `frontend.widgets` 数组项

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 小组件 id（应用内唯一） |
| `name` | string | ✅ | 显示名称 |
| `component` | string | ✅ | 组件路径 |
| `defaultSize` | object | ❌ | 默认尺寸 `{ w, h }` |
| `minSize` | object | ❌ | 最小尺寸 `{ w, h }` |
| `maxSize` | object | ❌ | 最大尺寸 `{ w, h }` |
| `description` | string | ❌ | 描述 |
| `configSchema` | object | ❌ | 配置 schema（见下表） |

### `frontend.widgets[].configSchema.fields` 数组项

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | string | ✅ | 配置键 |
| `label` | string | ✅ | 显示标签 |
| `type` | string | ✅ | 字段类型：`select` / `text` / `bool` / `number` |
| `options` | array | ❌ | select 类型的选项列表 `[{ value, label }]` |
| `default` | any | ❌ | 默认值 |

### `backend` 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `mountPath` | string | ✅ | 挂载路径（如 `/api/countdown`） |
| `entry` | string | ✅ | 入口文件路径（相对 manifest，如 `./backend/routes.js`） |
| `rateLimit` | object | ❌ | 限流配置 `{ max, windowMs }` |

### `extraBackends` 数组项

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `mountPath` | string | ✅ | 挂载路径 |
| `entry` | string | ✅ | 入口文件路径 |

## JSON 示例

### 最小应用

```json
{
  "name": "notes",
  "label": "笔记",
  "frontend": {
    "route": "/notes",
    "component": "./frontend/Notes.vue"
  },
  "backend": {
    "mountPath": "/api/notes",
    "entry": "./backend/routes.js"
  }
}
```

### 完整应用（含 widgets + extraRoutes + extraBackends）

```json
{
  "name": "resource",
  "label": "资源",
  "icon": "/resources/public/icons/Files.png",
  "color": "#5856D6",
  "category": "desktop",
  "order": 5,
  "defaultEnabled": true,
  "canDisable": true,
  "type": "app",
  "version": "1.0.0",
  "frontend": {
    "route": "/resource",
    "routeName": "Resource",
    "component": "./frontend/Resource.vue",
    "extraRoutes": [
      { "path": "/cloud", "routeName": "CloudDrive", "component": "./frontend/CloudDrive.vue" }
    ]
  },
  "backend": {
    "mountPath": "/api/resources",
    "entry": "./backend/routes.js"
  },
  "extraBackends": [
    { "mountPath": "/api/cloud", "entry": "./backend/cloud-routes.js" }
  ]
}
```

## 自动聚合流程图

manifest.json 由前后端两套独立的聚合器扫描，各自生成所需产物。

### 前端聚合流程

```
apps/*/manifest.json
        │
        └─→ client/src/core/manifest-loader.js（import.meta.glob）
                ├─→ client/src/core/router-aggregator.js（注册 vue-router）
                │       └─→ appRoutes + ROUTE_APP_MAP
                │       └─→ 使用方：client/src/router/index.js
                ├─→ client/src/core/store-aggregator.js（注册 Vuex 模块）
                │       └─→ APP_STORE_MODULES
                │       └─→ 使用方：client/src/store/index.js
                ├─→ client/src/core/widget-aggregator.js（注册桌面小组件）
                │       └─→ WIDGET_REGISTRY
                │       └─→ 使用方：components/Desktop.vue
                └─→ client/src/core/app-registry.js（注册桌面图标）
                        └─→ APP_REGISTRY
                        └─→ 使用方：store/modules/desktop.js
```

### 后端聚合流程

```
apps/*/manifest.json
        │
        └─→ server/src/core/manifest-loader.js（fs 扫描）
                ├─→ server/src/core/route-aggregator.js（挂载 Express 路由）
                │       └─→ mountAppRoutes(app)
                │       └─→ 主 backend + extraBackends（数组）
                │       └─→ 应用 manifest.backend.rateLimit 限流中间件
                │       └─→ 使用方：server/src/app.js
                └─→ server/src/core/default-apps-loader.js（默认应用列表）
                        └─→ getDefaultApps() / getAllApps() / getDesktopApps()
                        └─→ 使用方：init-db.js / admin 路由
```

::: tip manifest-loader 共享
前端 `manifest-loader.js` 与后端 `manifest-loader.js` 是两套独立实现：
- 前端用 `import.meta.glob('../../../apps/*/manifest.json', { eager: true })` 同步加载（Vite 打包时静态分析）
- 后端用 `fs.readdirSync` 扫描 `apps/` 目录并 `require()` 加载

两者输出格式一致，但加载机制不同。详见 [应用架构详解](./architecture#聚合层工作流程)。
:::

## 应用结构示例（countdown）

以 `apps/countdown` 为例，展示一个完整应用的目录结构：

```
apps/countdown/
├── manifest.json              # 清单（驱动聚合）
├── icon.svg                   # 应用图标
├── frontend/
│   ├── Countdown.vue          # 主页面
│   ├── widgets/
│   │   └── CountdownWidget.vue  # 桌面小组件
│   └── store.js               # Vuex 模块（可选）
└── backend/
    └── routes.js              # Express 路由
```

对应 `manifest.json`：

```json
{
  "name": "countdown",
  "type": "app",
  "version": "1.0.0",
  "label": "倒数日",
  "icon": "/resources/public/icons/Countdown.png",
  "color": "#FF9500",
  "category": "desktop",
  "order": 11,
  "defaultEnabled": true,
  "canDisable": true,
  "frontend": {
    "route": "/countdown",
    "routeName": "Countdown",
    "component": "./frontend/Countdown.vue",
    "widgets": [
      {
        "id": "countdown",
        "name": "倒数日",
        "component": "./frontend/widgets/CountdownWidget.vue",
        "defaultSize": { "w": 2, "h": 1 },
        "minSize": { "w": 1, "h": 1 },
        "maxSize": { "w": 4, "h": 2 },
        "description": "显示最近的倒数日",
        "configSchema": {
          "fields": [
            {
              "key": "filter",
              "label": "显示范围",
              "type": "select",
              "options": [
                { "value": "all", "label": "全部" },
                { "value": "pinned", "label": "仅置顶" },
                { "value": "today", "label": "仅今天" }
              ],
              "default": "all"
            }
          ]
        }
      }
    ]
  },
  "backend": {
    "mountPath": "/api/countdown",
    "entry": "./backend/routes.js"
  }
}
```

::: warning 路径基准
manifest.json 中所有 `component` / `entry` 路径都是**相对 manifest.json 所在目录**的相对路径（以 `./` 开头）。聚合器通过 `manifest-loader.getComponent(appName, relPath)` 解析为可导入的模块路径。
:::

## 验证规则

`validateManifest(m)` 返回 `{ valid, errors, warnings, manifest }`：

| 级别 | 字段 | 行为 |
|------|------|------|
| **errors**（阻断性） | `name` / `label` 缺失或非字符串 | 聚合器跳过该应用 |
| **warnings**（非阻断） | `name` 不符合 kebab-case | `console.warn` 但继续挂载 |
| **warnings**（非阻断） | `type` / `category` 不在枚举中 | 降级为默认值 |
| **warnings**（非阻断） | `version` 不符合 semver | `console.warn` 但继续挂载 |
| **warnings**（非阻断） | `frontend.route` / `frontend.component` 缺失 | `console.warn` 但继续挂载 |
| **warnings**（非阻断） | `backend.mountPath` / `backend.entry` 缺失 | `console.warn` 但继续挂载 |
| **warnings**（非阻断） | `extraBackends` 项缺少 `mountPath` / `entry` | `console.warn` 但继续挂载 |

**策略**：聚合器加载 manifest 后调用 `validateManifest`，`errors` 阻断挂载，`warnings` 仅 `console.warn` 不阻断。

## 应用管控机制

每个应用通过 `app_control` 表（`app_name` + `enabled`）控制启用/禁用：

- **初始化**：`init-db.js` 调用 `default-apps-loader.getDefaultApps()`，把所有 `defaultEnabled !== false` 的应用写入 `app_control` 表（`INSERT OR IGNORE`，避免覆盖管理员修改）
- **前端路由守卫**：`router/index.js` 的 `beforeEach` 通过 `ROUTE_APP_MAP` 检查当前路由对应的应用是否启用，未启用则跳转到桌面
- **管理员管控**：管理员可通过 `/api/admin/app-control` 远程启用/禁用应用，前端缓存通过 `router.clearAppControlCache()` 清除
- **超能岛浏览器**：例外，不通过应用管控，改为 per-user `browser_enabled` 字段控制

详见 [应用管控](./app-control)。

## 版本演进

| 版本 | 变更 |
|------|------|
| 1.0 | 初始规范：`name` / `label` / `icon` / `color` / `category` / `order` / `defaultEnabled` / `canDisable` / `frontend` / `backend` |
| 1.1 | 新增 `extraBackends`（阶段 0：云盘合并到资源仓库） |
| 1.2 | 新增 `type` / `version` 字段（阶段 3：对齐 Ditto 规范） |

## 相关文档

- [架构概览](./)
- [应用架构详解](./architecture)
- [主题系统](./theme-system)
- [WebSocket 通信](./websocket)
- [认证与权限](./auth)
- [应用管控](./app-control)
- [快速开始](/quick-start/)
