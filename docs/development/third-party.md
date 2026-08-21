---
title: 第三方应用开发
description: ClassIntra 第三方应用开发指南，覆盖目录结构、manifest.json 编写、前端 Vue 组件、Vuex 模块、后端 Express 路由、桌面小组件、应用图标规范、集成系统（postMessage Bridge 与 Webhook）与完整计数器示例。
---

# 第三方应用开发

ClassIntra 采用「约定优于配置」的模块化架构，应用以独立目录形式存在，由聚合器自动扫描挂载。本页面介绍如何从零开发一个完整的第三方应用，覆盖前端、后端、桌面小组件与集成系统接入。

## 应用目录结构

每个应用位于 `apps/<app-name>/`，约定结构如下：

```
apps/my-app/
├── manifest.json              # 必填，应用清单
├── icon.svg                   # 可选，相对路径图标
├── icon.png                   # 可选，PNG 图标
├── frontend/
│   ├── MyApp.vue              # 主页面组件（必填）
│   ├── store.js              # 可选，Vuex 模块
│   └── widgets/               # 可选，桌面小组件
│       └── MyAppWidget.vue
└── backend/
    └── routes.js              # 可选，Express 路由
```

::: tip 命名规范
- 应用目录与 `name` 字段使用 kebab-case（如 `my-app`、`ai-chat`）
- Vue 组件使用 PascalCase（如 `MyApp.vue`）
- 路由路径与 `mountPath` 使用 kebab-case（如 `/my-app`、`/api/my-app`）
:::

## manifest.json 编写

`manifest.json` 是应用的元信息清单，由聚合器扫描解析。完整字段如下：

```json
{
  "name": "my-app",
  "type": "app",
  "version": "1.0.0",
  "label": "我的应用",
  "icon": "/resources/public/icons/MyApp.png",
  "color": "#5856D6",
  "category": "desktop",
  "order": 20,
  "defaultEnabled": true,
  "canDisable": true,
  "frontend": {
    "route": "/my-app",
    "routeName": "MyApp",
    "component": "./frontend/MyApp.vue",
    "widgets": [
      {
        "id": "my-app-widget",
        "name": "我的应用组件",
        "component": "./frontend/widgets/MyAppWidget.vue",
        "defaultSize": { "w": 2, "h": 2 },
        "minSize": { "w": 1, "h": 1 },
        "maxSize": { "w": 4, "h": 4 },
        "description": "显示我的应用摘要",
        "configSchema": {
          "fields": [
            {
              "key": "count",
              "label": "显示数量",
              "type": "number",
              "default": 5,
              "min": 1,
              "max": 20
            }
          ]
        }
      }
    ]
  },
  "backend": {
    "mountPath": "/api/my-app",
    "entry": "./backend/routes.js",
    "rateLimit": {
      "max": 100,
      "windowMs": 60000,
      "message": "请求过于频繁，请稍后再试"
    }
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `name` | string | 是 | — | 应用唯一标识，kebab-case |
| `type` | string | 否 | `'app'` | `app` / `system` / `widget` |
| `version` | string | 否 | `'0.0.0'` | semver 版本号 |
| `label` | string | 是 | — | 桌面显示名 |
| `icon` | string | 否 | — | 图标路径，绝对路径或 `./icon.svg` |
| `color` | string | 否 | — | 主题色 hex（如 `#5856D6`） |
| `category` | string | 否 | `'desktop'` | `desktop` / `system` / `hidden` |
| `order` | number | 否 | `99` | 排序权重，越小越靠前 |
| `defaultEnabled` | boolean | 否 | `true` | 是否默认启用 |
| `canDisable` | boolean | 否 | `true` | 是否允许用户禁用 |
| `frontend` | object | 否 | — | 前端配置 |
| `backend` | object | 否 | — | 后端配置 |

### `frontend` 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `route` | string | 是 | 路由路径，如 `/my-app` |
| `routeName` | string | 是 | 路由名（PascalCase） |
| `component` | string | 是 | 组件文件路径（相对应用根目录） |
| `widgets` | array | 否 | 桌面小组件列表 |

### `backend` 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `mountPath` | string | 是 | 路由挂载路径，如 `/api/my-app` |
| `entry` | string | 是 | 路由文件路径（相对应用根目录） |
| `rateLimit` | object | 否 | 限流配置 |

::: warning 路由路径冲突
- `frontend.route` 不可与现有应用重复
- `backend.mountPath` 必须以 `/api/` 开头，且不可与 `/api/auth`、`/api/system` 等系统路由冲突
- 聚合器启动时会扫描冲突并打印警告，重复路由会被后注册的覆盖
:::

## 前端开发

### Vue 组件

应用主组件遵循 [代码风格约定](./#代码风格约定)（Options API + `var` / `function`）：

```vue
<!-- apps/my-app/frontend/MyApp.vue -->
<template>
  <div class="my-app-page">
    <h1>{{ title }}</h1>
    <p>{{ message }}</p>
    <button @click="fetchData">刷新数据</button>
  </div>
</template>

<script>
import api from '@/utils/api';

export default {
  name: 'MyApp',
  data: function() {
    return {
      title: '我的应用',
      message: '加载中...'
    };
  },
  methods: {
    fetchData: function() {
      var self = this;
      api.get('/api/my-app/data').then(function(res) {
        if (res.data.code === 200) {
          self.message = res.data.data.message;
        }
      }).catch(function(err) {
        console.error('获取数据失败:', err);
        self.message = '加载失败';
      });
    }
  },
  mounted: function() {
    this.fetchData();
  }
};
</script>

<style scoped>
.my-app-page {
  padding: 20px;
}
</style>
```

### 路由配置

路由由聚合器自动注册，**无需手动修改** `client/src/router/index.js`。聚合器会：

1. 扫描 `apps/*/manifest.json`
2. 为每个有 `frontend.route` 的应用动态添加路由
3. 启用懒加载（`() => import(component)`）以减小首屏包体

### Vuex 模块

若应用需要状态管理，可选创建 `store.js`：

```javascript
// apps/my-app/frontend/store.js
export default {
  namespaced: true,
  state: {
    items: [],
    loading: false
  },
  mutations: {
    SET_ITEMS: function(state, items) {
      state.items = items;
    },
    SET_LOADING: function(state, loading) {
      state.loading = loading;
    }
  },
  actions: {
    fetchItems: function(context) {
      context.commit('SET_LOADING', true);
      return fetch('/api/my-app/items').then(function(r) { return r.json(); }).then(function(res) {
        if (res.code === 200) {
          context.commit('SET_ITEMS', res.data.items);
        }
      }).finally(function() {
        context.commit('SET_LOADING', false);
      });
    }
  },
  getters: {
    itemCount: function(state) {
      return state.items.length;
    }
  }
};
```

::: tip 自动注册
聚合器会扫描应用目录，自动将 `store.js` 注册到 Vuex。模块名空间为应用 `name`，访问方式：`this.$store.state['my-app'].items`。
:::

## 后端开发

### Express 路由

后端路由文件导出一个 Express Router：

```javascript
// apps/my-app/backend/routes.js
var express = require('express');
var router = express.Router();

// 鉴权中间件
var auth = require('../../../server/src/middleware/auth');

// GET /api/my-app/data
router.get('/data', auth.requireAuth, function(req, res) {
  res.json({
    code: 200,
    data: {
      message: 'Hello from backend at ' + new Date().toISOString(),
      user_id: req.user.user_id
    }
  });
});

// POST /api/my-app/items
router.post('/items', auth.requireAuth, function(req, res) {
  var name = req.body.name;
  if (!name) {
    return res.status(400).json({ code: 400, message: 'name 必填' });
  }
  res.json({ code: 200, data: { id: Date.now(), name: name } });
});

module.exports = router;
```

### 数据库操作

通过 `server/src/utils/db.js` 访问 SQLite：

```javascript
var db = require('../../../server/src/utils/db');

// 查询
var rows = db.prepare('SELECT * FROM users WHERE user_id = ?').all(userId);

// 单条
var row = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);

// 插入
var info = db.prepare('INSERT INTO my_items (name, user_id) VALUES (?, ?)').run(name, userId);
var newId = info.lastInsertRowid;

// 更新
db.prepare('UPDATE my_items SET name = ? WHERE id = ?').run(name, id);

// 事务
var tx = db.transaction(function() {
  db.prepare('INSERT INTO ...').run(...);
  db.prepare('UPDATE ...').run(...);
});
tx();
```

::: tip 表创建
建议在 [数据库迁移](#数据库迁移) 中创建表，避免运行时 DDL 影响性能。
:::

### 中间件

ClassIntra 内置中间件位于 `server/src/middleware/`：

| 中间件 | 用途 | 用法 |
|--------|------|------|
| `auth.requireAuth` | 要求登录 | `router.get('/x', auth.requireAuth, handler)` |
| `auth.requireAdmin` | 要求班管权限 | `router.post('/x', auth.requireAdmin, handler)` |
| `rate-limit` | 速率限制 | 在 `manifest.json` 的 `rateLimit` 中声明 |

## 桌面小组件开发

小组件（Widget）显示在桌面网格中，无需独立页面即可展示摘要信息。

### manifest 声明

在 `frontend.widgets` 中声明：

```json
{
  "frontend": {
    "widgets": [
      {
        "id": "my-app-widget",
        "name": "我的应用组件",
        "component": "./frontend/widgets/MyAppWidget.vue",
        "defaultSize": { "w": 2, "h": 2 },
        "minSize": { "w": 1, "h": 1 },
        "maxSize": { "w": 4, "h": 4 },
        "description": "显示我的应用摘要",
        "configSchema": {
          "fields": [
            {
              "key": "filter",
              "label": "显示范围",
              "type": "select",
              "options": [
                { "value": "all", "label": "全部" },
                { "value": "pinned", "label": "仅置顶" }
              ],
              "default": "all"
            },
            {
              "key": "count",
              "label": "显示数量",
              "type": "number",
              "default": 5,
              "min": 1,
              "max": 20
            },
            {
              "key": "showAvatar",
              "label": "显示头像",
              "type": "bool",
              "default": true
            }
          ]
        }
      }
    ]
  }
}
```

### Widget 组件

```vue
<!-- apps/my-app/frontend/widgets/MyAppWidget.vue -->
<template>
  <div class="my-widget">
    <div class="widget-header">
      <span class="title">{{ config.title || '我的应用' }}</span>
    </div>
    <div class="widget-body">
      <div v-for="item in items" :key="item.id" class="item">
        {{ item.name }}
      </div>
      <div v-if="items.length === 0" class="empty">暂无数据</div>
    </div>
  </div>
</template>

<script>
import api from '@/utils/api';

export default {
  name: 'MyAppWidget',
  props: {
    config: { type: Object, default: function() { return {}; } }
  },
  data: function() {
    return {
      items: []
    };
  },
  methods: {
    load: function() {
      var self = this;
      var count = this.config.count || 5;
      api.get('/api/my-app/items', { params: { count: count } })
        .then(function(res) {
          if (res.data.code === 200) {
            self.items = res.data.data.items;
          }
        });
    }
  },
  watch: {
    'config.count': function() { this.load(); },
    'config.filter': function() { this.load(); }
  },
  mounted: function() {
    this.load();
  }
};
</script>

<style scoped>
.my-widget {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
}
.widget-header .title {
  font-weight: 600;
  font-size: 14px;
}
.widget-body {
  flex: 1;
  overflow-y: auto;
}
.item {
  padding: 6px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.empty {
  color: #999;
  text-align: center;
  padding: 20px 0;
}
</style>
```

## 应用图标规范

图标支持 SVG 与 PNG 两种格式：

| 格式 | 推荐尺寸 | 文件大小 | 适用场景 |
|------|---------|---------|---------|
| **SVG** | 64×64 viewport | < 5 KB | 矢量、可缩放、支持主题色 |
| **PNG** | 128×128 px | < 20 KB | 含渐变、阴影等复杂图标 |

### 图标路径

| 路径形式 | 解析结果 | 示例 |
|---------|---------|------|
| 绝对路径 `/resources/...` | 直接访问 `Resources/public/...` | `/resources/public/icons/Weather.png` |
| 相对路径 `./icon.svg` | 解析为 `/apps-static/<name>/icon.svg` | `./icon.svg` |

::: tip 统一图标目录
建议将所有应用图标统一放在 `Resources/public/icons/`，便于管理与备份。内置应用图标位于 [ClassIntra/Resources/public/icons](https://github.com/ClassIntra/ClassIntra/tree/main/Resources/public/icons)。
:::

### 图标设计建议

- 风格统一（线性 / 面性二选一）
- 单色或双色，避免照片质感
- 主题色通过 `color` 字段控制背景，图标本身保持纯色
- 圆角矩形 22% 圆角（与 iOS 风格一致）

## 集成系统使用

ClassIntra 提供两种集成方式，便于外部系统接入：

### postMessage Bridge

适用于嵌入 ClassIntra 的 iframe 或被 ClassIntra 嵌入的应用。

```javascript
// 外部应用向 ClassIntra 发送消息
window.parent.postMessage({
  source: 'external-app',
  event: 'navigate',
  data: { path: '/my-app' }
}, '*');

// 监听 ClassIntra 发来的消息
window.addEventListener('message', function(event) {
  if (event.data && event.data.source === 'classintra') {
    console.log('收到 ClassIntra 事件:', event.data.event);
    // 处理事件
  }
});
```

支持的 Bridge 事件：

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `navigate` | 外 → 内 | `{ path: '/my-app' }` | 跳转到指定路由 |
| `toast` | 外 → 内 | `{ message: '...', type: 'success' }` | 显示提示 |
| `auth` | 内 → 外 | `{ token: '...', user: {...} }` | 传递登录态 |
| `theme-change` | 内 → 外 | `{ theme: 'dark' }` | 主题变更通知 |

### Webhook 收发

适用于外部系统向 ClassIntra 推送事件，或 ClassIntra 向外部系统推送事件。

#### 接收 Webhook（外部 → ClassIntra）

```bash
POST /api/integrations/webhook
Headers:
  X-ClassIntra-Token: <token>
  X-ClassIntra-Signature: <HMAC-SHA256>
  X-ClassIntra-Timestamp: <unix-ms>
  X-ClassIntra-Event: custom.event
Body:
  { ...任意 JSON... }
```

#### 发送 Webhook（ClassIntra → 外部）

通过 `token-store` 注册外部集成后，ClassIntra 在事件触发时自动调用外部 Webhook。详见 [集成 API 文档](/api/)。

::: warning Webhook 安全
- 必须包含 `X-ClassIntra-Token`、`X-ClassIntra-Signature`、`X-ClassIntra-Timestamp` 三个 header
- 时间戳容差为 5 分钟（防重放）
- HMAC-SHA256 签名基于 raw body + timestamp
- 限流按 token 维度计算
:::

## 完整示例：创建计数器应用

下面创建一个完整的计数器应用，包含前端、后端、数据库迁移与图标。

### 1. 创建目录结构

```
apps/counter/
├── manifest.json
├── icon.svg
├── frontend/
│   └── Counter.vue
└── backend/
    └── routes.js
```

### 2. manifest.json

```json
{
  "name": "counter",
  "type": "app",
  "version": "1.0.0",
  "label": "计数器",
  "icon": "./icon.svg",
  "color": "#FF9500",
  "category": "desktop",
  "order": 30,
  "defaultEnabled": true,
  "canDisable": true,
  "frontend": {
    "route": "/counter",
    "routeName": "Counter",
    "component": "./frontend/Counter.vue"
  },
  "backend": {
    "mountPath": "/api/counter",
    "entry": "./backend/routes.js",
    "rateLimit": {
      "max": 60,
      "windowMs": 60000
    }
  }
}
```

### 3. icon.svg

```svg
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="48" height="48" rx="14" fill="#FF9500"/>
  <text x="32" y="42" font-family="Arial" font-size="28" font-weight="bold"
        text-anchor="middle" fill="white">+</text>
</svg>
```

### 4. frontend/Counter.vue

```vue
<template>
  <div class="counter-page">
    <h1>计数器</h1>
    <div class="count-display">{{ count }}</div>
    <div class="actions">
      <button @click="decrement" :disabled="loading">-</button>
      <button @click="increment" :disabled="loading">+</button>
      <button @click="reset" class="reset" :disabled="loading">重置</button>
    </div>
  </div>
</template>

<script>
import api from '@/utils/api';

export default {
  name: 'Counter',
  data: function() {
    return {
      count: 0,
      loading: false
    };
  },
  methods: {
    load: function() {
      var self = this;
      self.loading = true;
      api.get('/api/counter').then(function(res) {
        if (res.data.code === 200) {
          self.count = res.data.data.count;
        }
      }).finally(function() {
        self.loading = false;
      });
    },
    increment: function() {
      var self = this;
      api.post('/api/counter/increment').then(function(res) {
        if (res.data.code === 200) {
          self.count = res.data.data.count;
        }
      });
    },
    decrement: function() {
      var self = this;
      api.post('/api/counter/decrement').then(function(res) {
        if (res.data.code === 200) {
          self.count = res.data.data.count;
        }
      });
    },
    reset: function() {
      var self = this;
      if (!confirm('确定重置为 0？')) return;
      api.post('/api/counter/reset').then(function(res) {
        if (res.data.code === 200) {
          self.count = res.data.data.count;
        }
      });
    }
  },
  mounted: function() {
    this.load();
  }
};
</script>

<style scoped>
.counter-page {
  padding: 24px;
  text-align: center;
}
.count-display {
  font-size: 48px;
  font-weight: bold;
  margin: 24px 0;
  color: #FF9500;
}
.actions button {
  font-size: 18px;
  padding: 8px 16px;
  margin: 0 8px;
  border: none;
  border-radius: 8px;
  background: #FF9500;
  color: white;
  cursor: pointer;
}
.actions button:disabled {
  opacity: 0.5;
}
.actions button.reset {
  background: #FF3B30;
}
</style>
```

### 5. backend/routes.js

```javascript
var express = require('express');
var router = express.Router();
var auth = require('../../../server/src/middleware/auth');
var db = require('../../../server/src/utils/db');

// 初始化当前用户的计数（如不存在则插入 0）
function ensureCounter(userId) {
  var existing = db.prepare('SELECT count FROM counters WHERE user_id = ?').get(userId);
  if (!existing) {
    db.prepare('INSERT INTO counters (user_id, count, updated_at) VALUES (?, 0, ?)').run(
      userId,
      Date.now()
    );
    return 0;
  }
  return existing.count;
}

// GET /api/counter
router.get('/', auth.requireAuth, function(req, res) {
  var count = ensureCounter(req.user.user_id);
  res.json({ code: 200, data: { count: count } });
});

// POST /api/counter/increment
router.post('/increment', auth.requireAuth, function(req, res) {
  var userId = req.user.user_id;
  ensureCounter(userId);
  db.prepare('UPDATE counters SET count = count + 1, updated_at = ? WHERE user_id = ?').run(
    Date.now(),
    userId
  );
  var row = db.prepare('SELECT count FROM counters WHERE user_id = ?').get(userId);
  res.json({ code: 200, data: { count: row.count } });
});

// POST /api/counter/decrement
router.post('/decrement', auth.requireAuth, function(req, res) {
  var userId = req.user.user_id;
  ensureCounter(userId);
  db.prepare('UPDATE counters SET count = count - 1, updated_at = ? WHERE user_id = ?').run(
    Date.now(),
    userId
  );
  var row = db.prepare('SELECT count FROM counters WHERE user_id = ?').get(userId);
  res.json({ code: 200, data: { count: row.count } });
});

// POST /api/counter/reset
router.post('/reset', auth.requireAuth, function(req, res) {
  var userId = req.user.user_id;
  ensureCounter(userId);
  db.prepare('UPDATE counters SET count = 0, updated_at = ? WHERE user_id = ?').run(
    Date.now(),
    userId
  );
  res.json({ code: 200, data: { count: 0 } });
});

module.exports = router;
```

### 6. 数据库迁移

在 `server/src/migrations/` 创建新迁移文件：

```javascript
// server/src/migrations/001_counter.js
module.exports = {
  version: 1,
  name: 'counter-table',
  up: function(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS counters (
        user_id TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_counters_updated ON counters(updated_at);
    `);
  },
  down: function(db) {
    db.exec('DROP TABLE IF EXISTS counters;');
  }
};
```

::: tip 迁移执行
迁移由 `server/src/utils/migration-runner.js` 在服务启动时按版本号顺序执行。新迁移文件名建议 `NNN_描述.js`（如 `001_counter.js`）。
:::

### 7. 构建验证

```bash
# 构建前端（路由自动聚合）
pnpm build

# 启动后端（自动挂载 /api/counter）
cd server && node src/app.js

# 检查日志
# 期望：[route-aggregator] 挂载应用路由: counter -> /api/counter

# 测试 API
curl http://localhost:9001/api/counter \
  -H "Authorization: Bearer <your-jwt-token>"

# 桌面访问
# http://localhost:5001/counter
```

::: tip 验证清单
- ✅ `pnpm build` 无错误
- ✅ 后端启动日志显示 `挂载应用路由: counter -> /api/counter`
- ✅ 桌面出现「计数器」图标
- ✅ 点击图标进入 `/counter` 页面
- ✅ API 返回 `code: 200`
- ✅ 计数功能正常工作
:::

## 下一步

- [SDK 参考](./sdk) - 前端核心 API 详解
- [调试技巧](./debugging) - 前后端调试方法
- [CLI 工具](./cli) - 命令行参考
- [Manifest 清单](/concepts/manifest) - 完整 manifest 字段
- [架构概览](/concepts/architecture) - 整体架构
