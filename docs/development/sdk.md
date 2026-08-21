---
title: SDK 参考
description: ClassIntra SDK 参考文档，覆盖前端核心 API（ServiceRegistry、ThemeEngine、EventBus、HotkeyManager、SearchRegistry、PersistenceStore）、后端 API（路由挂载、中间件、数据库）与集成 API（postMessage Bridge、Webhook）。
---

# SDK 参考

本页面列出 ClassIntra 前后端的核心 API，便于第三方应用开发者查阅。所有 API 均符合 [代码风格约定](./#代码风格约定)（`var` / `function` / Options API）。

## 前端核心 API

前端核心服务位于 `client/src/core/`，采用单例模式，通过 `getServiceRegistry()` 统一获取。

### ServiceRegistry

服务注册中心，懒创建 + 单例缓存。位于 [client/src/core/service-registry.js](https://github.com/ClassIntra/ClassIntra/blob/main/client/src/core/service-registry.js)。

#### API

| 方法 | 签名 | 说明 |
|------|------|------|
| `register` | `(name, factory, options?) => void` | 注册服务工厂 |
| `resolve` | `(name) => instance` | 同步解析服务（懒创建） |
| `resolveAsync` | `(name) => Promise<instance>` | 异步解析服务（factory 返回 Promise） |
| `unregister` | `(name) => void` | 移除服务 |
| `shutdown` | `() => void` | 销毁所有服务（逆序调用 destroy） |

#### 用法

```javascript
import { getServiceRegistry } from '@/core/service-registry';

var registry = getServiceRegistry();

// 简单注册
registry.register('myService', function() {
  return { hello: function() { return 'world'; } };
});

// 带销毁函数
registry.register('dbConnection', function() {
  var conn = openConnection();
  return {
    instance: conn,
    destroy: function() {
      conn.close();
    }
  };
});

// 在组件中使用
var myService = registry.resolve('myService');
myService.hello();  // 'world'

// 通过 Vue 实例访问（已挂到 Vue.prototype）
// this.$services.resolve('myService')
```

::: tip 单例 vs 多例
默认 `singleton: true`，首次 resolve 时创建并缓存。设为 `false` 时每次 resolve 都创建新实例：
```javascript
registry.register('tempService', factory, { singleton: false });
```
:::

### ThemeEngine

主题引擎，管理内置主题与扩展主题。位于 [client/src/core/theme-engine.js](https://github.com/ClassIntra/ClassIntra/blob/main/client/src/core/theme-engine.js)。

#### API

| 方法 | 签名 | 说明 |
|------|------|------|
| `registerTheme` | `(id, options) => void` | 注册主题 |
| `setTheme` | `(id) => void` | 切换当前主题 |
| `getTheme` | `(id) => object` | 获取主题信息 |
| `getCurrentTheme` | `() => string` | 获取当前主题 id |
| `listThemes` | `() => array` | 列出所有已注册主题 |
| `subscribe` | `(callback) => function` | 订阅主题变化，返回取消订阅 |
| `setMotionEnabled` | `(enabled) => void` | 启用/禁用动画 |
| `isMotionEnabled` | `() => boolean` | 动画是否启用 |
| `setDynamicColor` | `(seedColor) => void` | 动态色注入（扩展主题） |
| `loadExternalTheme` | `(url) => Promise` | 加载远程主题包 |

#### 用法

```javascript
import { getThemeEngine } from '@/core/theme-engine';

var themeEngine = getThemeEngine();

// 订阅主题变化
var unsubscribe = themeEngine.subscribe(function(themeId, themeData) {
  console.log('主题切换:', themeId);
});

// 切换主题
themeEngine.setTheme('dark');

// 注册自定义主题
themeEngine.registerTheme('my-theme', {
  name: '我的主题',
  type: 'light',
  tokens: {
    'color-primary': '#FF9500',
    'color-bg': '#FFFFFF'
  }
});

// 启用/禁用动画
themeEngine.setMotionEnabled(false);

// 取消订阅
unsubscribe();
```

### EventBus

事件总线，发布订阅模式。位于 [client/src/core/event-bus.js](https://github.com/ClassIntra/ClassIntra/blob/main/client/src/core/event-bus.js)。

#### API

| 方法 | 签名 | 说明 |
|------|------|------|
| `on` | `(eventName, handler) => function` | 订阅事件，返回取消订阅函数 |
| `once` | `(eventName, handler) => function` | 订阅一次（触发后自动移除） |
| `off` | `(eventName, handler) => void` | 显式取消订阅 |
| `emit` | `(eventName, ...args) => void` | 触发事件 |

#### 用法

```javascript
import { getEventBus } from '@/core/event-bus';

var bus = getEventBus();

// 订阅
var unsubscribe = bus.on('user:login', function(user) {
  console.log('用户登录:', user.name);
});

// 一次性订阅
bus.once('app:ready', function() {
  console.log('应用初始化完成');
});

// 触发
bus.emit('user:login', { id: '25010001', name: '张三' });

// 取消订阅
unsubscribe();
// 或
bus.off('user:login', handler);
```

::: tip 异常隔离
单个 handler 抛错不会影响其他 handler，错误通过 `error:handler` 事件报告。可以订阅 `error:handler` 进行统一错误处理。
:::

#### 内置事件名

| 事件名 | 触发时机 | 参数 |
|--------|---------|------|
| `user:login` | 用户登录成功 | `{ id, name, role }` |
| `user:logout` | 用户登出 | — |
| `theme:change` | 主题切换 | `(themeId, themeData)` |
| `app:ready` | 应用初始化完成 | — |
| `network:online` | 网络恢复 | — |
| `network:offline` | 网络断开 | — |
| `ws:open` | WebSocket 连接 | — |
| `ws:close` | WebSocket 断开 | `{ code, reason }` |

### HotkeyManager

快捷键管理器，支持组合键注册。位于 [client/src/core/hotkey-manager.js](https://github.com/ClassIntra/ClassIntra/blob/main/client/src/core/hotkey-manager.js)。

#### API

| 方法 | 签名 | 说明 |
|------|------|------|
| `register` | `(combo, handler, options?) => function` | 注册快捷键，返回取消注册函数 |
| `unregister` | `(combo, handler) => void` | 显式取消注册 |
| `enable` | `() => void` | 启用快捷键监听 |
| `disable` | `() => void` | 暂停快捷键监听 |
| `isEnabled` | `() => boolean` | 当前是否启用 |

#### 组合键格式

```
[modifier+]+key
```

| 修饰键 | 接受名 |
|--------|--------|
| `ctrl` | `ctrl` / `control` |
| `cmd` | `cmd` / `meta` / `command` |
| `alt` | `alt` / `option` |
| `shift` | `shift` |

| key | 接受名 |
|-----|--------|
| 字母 | `a` ~ `z` |
| 数字 | `0` ~ `9` |
| 特殊 | `esc`、`del`、`space`、`up`、`down`、`left`、`right`、`enter`、`tab`、`f1`~`f12` |

#### 用法

```javascript
import { getHotkeyManager } from '@/core/hotkey-manager';

var hotkeys = getHotkeyManager();

// 注册
var unregister = hotkeys.register('ctrl+k', function(e) {
  e.preventDefault();
  console.log('Ctrl+K 触发');
});

// 全局快捷键（在输入框中也触发）
hotkeys.register('ctrl+shift+p', function() {
  // ...
}, { global: true });

// 取消注册
unregister();
```

::: warning 输入框过滤
默认情况下，当焦点在 `input` / `textarea` / `contenteditable` 元素时，快捷键不触发。如需在输入框中也响应，传 `{ global: true }`。
:::

### SearchRegistry

全局搜索注册表，统一管理搜索源。位于 [client/src/core/search-registry.js](https://github.com/ClassIntra/ClassIntra/blob/main/client/src/core/search-registry.js)。

#### API

| 方法 | 签名 | 说明 |
|------|------|------|
| `registerProvider` | `(provider) => function` | 注册搜索源，返回取消注册 |
| `unregisterProvider` | `(id) => void` | 移除搜索源 |
| `registerCommand` | `(command) => function` | 注册命令（如「跳转设置」） |
| `search` | `(query) => Promise<results>` | 执行搜索，返回所有源结果 |
| `recordRecent` | `(query) => void` | 记录最近搜索 |
| `getRecent` | `() => array` | 获取最近搜索历史 |

#### Provider 结构

```javascript
{
  id: 'my-app-search',
  category: '我的应用',
  search: function(query) {
    // 返回 result[] 或 Promise<result[]>
    return [
      {
        id: 'item-1',
        title: '相关条目',
        description: '描述...',
        icon: '/icon.svg',
        category: '我的应用',
        action: function() {
          // 点击后执行
          router.push('/my-app/1');
        }
      }
    ];
  }
}
```

#### 用法

```javascript
import { getSearchRegistry } from '@/core/search-registry';

var search = getSearchRegistry();

// 注册搜索源
var unregister = search.registerProvider({
  id: 'notes-search',
  category: '笔记',
  search: function(query) {
    return fetch('/api/notes/search?q=' + encodeURIComponent(query))
      .then(function(r) { return r.json(); })
      .then(function(res) {
        return res.data.items.map(function(item) {
          return {
            id: 'note-' + item.id,
            title: item.title,
            description: item.preview,
            icon: '/resources/public/icons/Note.svg',
            category: '笔记',
            action: function() {
              window.location.hash = '#/notes/' + item.id;
            }
          };
        });
      });
  }
});

// 注册命令
search.registerCommand({
  id: 'cmd-new-note',
  title: '新建笔记',
  description: '快速创建一篇笔记',
  icon: '/resources/public/icons/Note.svg',
  keywords: ['新建', '笔记', 'new', 'note'],
  action: function() {
    window.location.hash = '#/notes/new';
  }
});

// 取消注册
unregister();
```

### PersistenceStore

持久化存储，localStorage 优先 + memory 降级。位于 [client/src/core/persistence-store.js](https://github.com/ClassIntra/ClassIntra/blob/main/client/src/core/persistence-store.js)。

#### API

| 方法 | 签名 | 说明 |
|------|------|------|
| `get` | `(key, defaultValue?) => any` | 读取值（自动 JSON 反序列化） |
| `set` | `(key, value) => void` | 写入值（自动 JSON 序列化） |
| `remove` | `(key) => void` | 删除值 |
| `clear` | `() => void` | 清空所有键 |
| `onChange` | `(key, handler) => function` | 订阅 key 变化 |
| `migrate` | `(steps) => void` | 执行数据迁移 |

#### 用法

```javascript
import { getDefaultStore } from '@/core/persistence-store';

var store = getDefaultStore();

// 读写
store.set('user-preference', { theme: 'dark', lang: 'zh' });
var pref = store.get('user-preference', { theme: 'light', lang: 'zh' });

// 订阅变化
var unsubscribe = store.onChange('user-preference', function(newValue, oldValue) {
  console.log('偏好更新:', newValue);
});

// 删除
store.remove('user-preference');

// 带迁移的存储
var userStore = new PersistenceStore('my-app:', {
  migrations: [
    {
      version: 1,
      migrate: function(store) {
        // v0 → v1：迁移旧数据
        var oldName = store.get('name');
        if (oldName) {
          store.set('profile', { name: oldName });
          store.remove('name');
        }
      }
    }
  ]
});
```

::: tip key 前缀
所有 key 自动添加 `classintra:` 前缀，避免与其他应用冲突。自定义前缀：`new PersistenceStore('my-app:')`。
:::

## 后端 API

后端 Express 应用，路由由 `server/src/core/route-aggregator.js` 自动聚合。

### 路由挂载

应用后端通过 `manifest.json` 自动挂载：

```json
{
  "backend": {
    "mountPath": "/api/my-app",
    "entry": "./backend/routes.js"
  }
}
```

启动日志：

```
[route-aggregator] 挂载应用路由: my-app -> /api/my-app
```

### 路由文件模板

```javascript
// apps/my-app/backend/routes.js
var express = require('express');
var router = express.Router();

var auth = require('../../../server/src/middleware/auth');
var db = require('../../../server/src/utils/db');

// 公开接口（不需登录）
router.get('/public', function(req, res) {
  res.json({ code: 200, data: { message: 'hello' } });
});

// 需要登录
router.get('/me', auth.requireAuth, function(req, res) {
  res.json({ code: 200, data: { user_id: req.user.user_id } });
});

// 仅班管
router.post('/admin', auth.requireAdmin, function(req, res) {
  res.json({ code: 200, data: { ok: true } });
});

module.exports = router;
```

### 中间件

ClassIntra 内置中间件位于 `server/src/middleware/`：

| 中间件 | 文件 | 用途 |
|--------|------|------|
| `auth.requireAuth` | `auth.js` | 要求 JWT 登录 |
| `auth.requireAdmin` | `auth.js` | 要求班管权限 |
| `rate-limit` | `rate-limit.js` | 限流（在 manifest 中声明） |

```javascript
var auth = require('../../../server/src/middleware/auth');

router.get('/secret', auth.requireAuth, function(req, res) {
  // req.user 已解析，包含 user_id、name、role
  res.json({ code: 200, data: { user: req.user } });
});
```

::: tip 限流声明
在 `manifest.json` 的 `backend.rateLimit` 中声明，聚合器自动包装路由：
```json
{
  "rateLimit": {
    "max": 100,
    "windowMs": 60000,
    "message": "请求过于频繁，请稍后再试"
  }
}
```
:::

### 数据库操作

通过 `server/src/utils/db.js` 访问 better-sqlite3 实例：

```javascript
var db = require('../../../server/src/utils/db');

// 同步 API（better-sqlite3 特性）

// 查询多行
var rows = db.prepare('SELECT * FROM users LIMIT 10').all();

// 查询单行
var user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);

// 插入
var info = db.prepare(
  'INSERT INTO posts (title, content, user_id) VALUES (?, ?, ?)'
).run(title, content, userId);
var newId = info.lastInsertRowid;

// 更新
var updated = db.prepare(
  'UPDATE posts SET title = ? WHERE id = ? AND user_id = ?'
).run(title, postId, userId);

// 删除
db.prepare('DELETE FROM posts WHERE id = ? AND user_id = ?').run(postId, userId);

// 事务
var tx = db.transaction(function() {
  var info1 = db.prepare('INSERT INTO ...').run(...);
  db.prepare('UPDATE ... SET parent_id = ?').run(info1.lastInsertRowid);
});
tx();  // 全成功或全回滚
```

::: warning SQL 注入防护
**所有用户输入必须使用参数化查询**（`?` 占位符），禁止字符串拼接。better-sqlite3 会自动转义。
:::

### 数据库迁移

迁移文件位于 `server/src/migrations/`，按版本号顺序执行：

```javascript
// server/src/migrations/002_add_index.js
module.exports = {
  version: 2,
  name: 'add-posts-index',
  up: function(db) {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    `);
  },
  down: function(db) {
    db.exec('DROP INDEX IF EXISTS idx_posts_user; DROP INDEX IF EXISTS idx_posts_created;');
  }
};
```

::: tip 迁移执行时机
服务启动时由 `migration-runner.js` 自动执行。已执行的迁移记录在 `migrations` 表中，不会重复执行。
:::

## 集成 API

### postMessage Bridge

#### 向 ClassIntra 发送消息

```javascript
window.parent.postMessage({
  source: 'external-app',
  event: 'navigate',
  data: { path: '/my-app' }
}, '*');  // 生产环境替换为具体 origin
```

#### 监听 ClassIntra 事件

```javascript
window.addEventListener('message', function(event) {
  // 校验 origin（生产环境必做）
  if (event.origin !== 'https://classintra.example.edu') return;

  var msg = event.data;
  if (!msg || msg.source !== 'classintra') return;

  switch (msg.event) {
    case 'auth':
      // 接收登录态
      localStorage.setItem('token', msg.data.token);
      break;
    case 'theme-change':
      // 主题变化
      document.documentElement.setAttribute('data-theme', msg.data.theme);
      break;
    case 'navigate':
      // 路由跳转
      router.push(msg.data.path);
      break;
  }
});
```

### Webhook 收发

#### 接收 Webhook（外部 → ClassIntra）

```bash
POST /api/integrations/webhook
Headers:
  X-ClassIntra-Token: <token>
  X-ClassIntra-Signature: <HMAC-SHA256(timestamp + body, secret)>
  X-ClassIntra-Timestamp: <unix-ms>
  X-ClassIntra-Event: custom.event
Body: { ...任意 JSON... }
```

响应：

```json
{
  "code": 200,
  "message": "webhook 接收成功",
  "data": {
    "event": "custom.event",
    "receivedAt": "2025-08-21T08:00:00.000Z"
  }
}
```

#### Node.js 发送 Webhook 示例

```javascript
var crypto = require('crypto');
var http = require('http');

function sendWebhook(options) {
  var body = JSON.stringify(options.payload);
  var timestamp = Date.now().toString();

  var signature = crypto
    .createHmac('sha256', options.secret)
    .update(timestamp + body)
    .digest('hex');

  var req = http.request({
    hostname: options.host,
    port: options.port || 9001,
    path: '/api/integrations/webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'X-ClassIntra-Token': options.token,
      'X-ClassIntra-Signature': signature,
      'X-ClassIntra-Timestamp': timestamp,
      'X-ClassIntra-Event': options.event || 'custom.event'
    }
  }, function(res) {
    var chunks = [];
    res.on('data', function(c) { chunks.push(c); });
    res.on('end', function() {
      var result = Buffer.concat(chunks).toString();
      console.log('Webhook 响应:', res.statusCode, result);
    });
  });

  req.on('error', function(e) {
    console.error('Webhook 发送失败:', e.message);
  });

  req.write(body);
  req.end();
}

// 使用
sendWebhook({
  host: 'localhost',
  port: 9001,
  token: 'integration-token',
  secret: 'integration-secret',
  event: 'notice.publish',
  payload: {
    title: '重要通知',
    content: '明天放假'
  }
});
```

::: warning 签名算法
HMAC-SHA256，输入为 `timestamp + rawBody`（**不是** JSON.parse 后的对象）。`timestamp` 是字符串形式的毫秒时间戳，必须与 header 中的 `X-ClassIntra-Timestamp` 完全一致。
:::

## 代码示例汇总

### 应用入口模板

```javascript
// apps/my-app/frontend/store.js
import api from '@/utils/api';
import { getEventBus } from '@/core/event-bus';
import { getDefaultStore } from '@/core/persistence-store';

var bus = getEventBus();
var store = getDefaultStore();

export default {
  namespaced: true,
  state: {
    items: []
  },
  mutations: {
    SET_ITEMS: function(state, items) {
      state.items = items;
      store.set('my-app:items', items);
    }
  },
  actions: {
    load: function(context) {
      var cached = store.get('my-app:items', []);
      if (cached.length) context.commit('SET_ITEMS', cached);

      return api.get('/api/my-app/items').then(function(res) {
        if (res.data.code === 200) {
          context.commit('SET_ITEMS', res.data.data.items);
          bus.emit('my-app:loaded', res.data.data.items);
        }
      });
    }
  }
};
```

### 后端服务模板

```javascript
// apps/my-app/backend/routes.js
var express = require('express');
var router = express.Router();

var auth = require('../../../server/src/middleware/auth');
var db = require('../../../server/src/utils/db');

// 列表
router.get('/items', auth.requireAuth, function(req, res) {
  var rows = db.prepare(
    'SELECT * FROM my_items WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.user_id);
  res.json({ code: 200, data: { items: rows } });
});

// 创建
router.post('/items', auth.requireAuth, function(req, res) {
  var title = req.body.title;
  if (!title || title.length > 200) {
    return res.status(400).json({ code: 400, message: 'title 不合法' });
  }
  var info = db.prepare(
    'INSERT INTO my_items (title, user_id, created_at) VALUES (?, ?, ?)'
  ).run(title, req.user.user_id, Date.now());
  res.json({ code: 200, data: { id: info.lastInsertRowid } });
});

module.exports = router;
```

## 下一步

- [第三方应用开发](./third-party) - 完整应用开发流程
- [调试技巧](./debugging) - 前后端调试方法
- [CLI 工具](./cli) - 命令行参考
- [API 参考](/api/) - 服务端 REST API 文档
- [核心概念](/concepts/) - 整体架构与设计
