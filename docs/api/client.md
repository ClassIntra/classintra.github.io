---
title: 前端 API 参考
description: ClassIntra 前端核心模块 API 完整参考：ServiceRegistry、ThemeEngine、EventBus、HotkeyManager、SearchRegistry、PersistenceStore 及 utils/api.js、utils/websocket.js 使用示例。
outline: [2, 3]
---

# 前端 API 参考

ClassIntra 前端核心模块位于 `client/src/core/`，覆盖服务编排、主题切换、事件总线、热键管理、全局搜索、持久化存储等能力。本页面是这些 API 的严谨参考手册，所有签名与源码保持一致。

## 目录

- [ServiceRegistry](#serviceregistry)
- [ThemeEngine](#themeengine)
- [EventBus](#eventbus)
- [HotkeyManager](#hotkeymanager)
- [SearchRegistry](#searchregistry)
- [PersistenceStore](#persistencestore)
- [HTTP 客户端（utils/api.js）](#http-客户端-utils-api-js)
- [WebSocket 客户端（utils/websocket.js）](#websocket-客户端-utils-websocket-js)

## ServiceRegistry

源码：`client/src/core/service-registry.js`

服务注册中心，负责管理前端各核心模块的实例化与生命周期。设计要点：

1. **懒创建**：`register` 仅注册工厂函数，`resolve` 时才实例化
2. **单例缓存**：首次 `resolve` 创建并缓存，后续返回同一实例
3. **生命周期**：factory 可返回 `{ instance, destroy }`，`shutdown` 时逆序调用 `destroy`
4. **异常隔离**：单个服务 `destroy` 异常不中断其他服务销毁
5. **异步支持**：`resolveAsync` 支持 factory 返回 Promise
6. **单例模式**：`getServiceRegistry()` 全局唯一实例

### 方法列表

| 方法 | 签名 | 说明 |
|------|------|------|
| `register` | `(name, factory, options?) => void` | 注册服务工厂（懒创建） |
| `resolve` | `(name) => any \| undefined` | 同步解析服务（首次调用时实例化） |
| `resolveAsync` | `(name) => Promise<any>` | 异步解析服务（factory 返回 Promise 时使用） |
| `has` | `(name) => boolean` | 检查服务是否已注册 |
| `list` | `() => string[]` | 列出所有已注册服务名 |
| `shutdown` | `() => Array<{name, error}>` | 逆序销毁所有已实例化的服务 |

### register

注册服务工厂（懒创建）。

```javascript
import { getServiceRegistry } from '@/core/service-registry';

var registry = getServiceRegistry();

registry.register('eventBus', function(registry) {
  // 通过 registry.resolve('xxx') 解析依赖
  return new EventBus();
});

// 返回 { instance, destroy } 时，shutdown 会调用 destroy
registry.register('store', function(registry) {
  var eventBus = registry.resolve('eventBus');
  return {
    instance: new Store(eventBus),
    destroy: function() { /* 清理逻辑 */ }
  };
});

// 非单例模式（每次 resolve 返回新实例）
registry.register('tempService', function() { return new TempService(); }, { singleton: false });
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 服务唯一 ID（如 `'eventBus'`、`'store'`、`'themeEngine'`） |
| `factory` | `function(registry)` | 是 | 工厂函数，参数为 registry 本身，可调用 `registry.resolve()` 解析依赖 |
| `options` | `{ singleton?: boolean }` | 否 | 默认 `{ singleton: true }`，`false` 时每次 resolve 创建新实例 |

::: tip factory 返回结构
`factory` 可返回：
- 普通实例：`return new Service()`
- 含销毁器的结构：`return { instance: new Service(), destroy: function() {...} }`
- 异步实例：`return Promise.resolve(new Service())`（需用 `resolveAsync`）
:::

### resolve

同步解析服务（首次调用时实例化并缓存）。

```javascript
var eventBus = registry.resolve('eventBus');
```

**异常**：未注册时返回 `undefined`（不抛错）

::: warning 懒创建
服务在第一次 `resolve` / `resolveAsync` 时才会被实例化。仅 `register` 不会触发工厂函数。
:::

### resolveAsync

异步解析服务（factory 返回 Promise 时使用）。

```javascript
registry.registerAsync('lazyModule', function() {
  return import('./heavy-module').then(function(m) { return new m.default(); });
});

registry.resolveAsync('lazyModule').then(function(service) {
  // service 已实例化并缓存
});
```

### has / list

```javascript
if (registry.has('eventBus')) { /* ... */ }
var allNames = registry.list();  // ['eventBus', 'store', 'themeEngine', ...]
```

### shutdown

逆序销毁所有已实例化的服务，返回销毁过程中收集的错误列表。

```javascript
var errors = registry.shutdown();
// errors: [{ name: 'store', error: Error }, ...]
```

- 按注册**逆序**调用每个实例的 `destroy()` 方法
- 单个 `destroy` 异常不中断（收集错误后统一 `console.error`）
- 清空 `_instances`、`_destroyers`、`_order`

## ThemeEngine

源码：`client/src/core/theme-engine.js`

主题引擎核心，管理主题注册、切换、CSS 变量注入、订阅通知。设计要点：

1. **双写策略**：`setAttribute('data-theme', id)` 触发旧 CSS 切换 + 写入 `--ci-*` 新变量
2. **运行时切换**：无需重新加载页面
3. **订阅机制**：`subscribe` 注册回调，主题变化时通知
4. **动画开关**：`setMotionEnabled` 控制全局动画启用
5. **扩展主题**：通过 `theme-extension-loader` 扫描 `theme-extensions/` 目录
6. **动态色注入**：`setDynamicColor(seedColor)` 重新生成扩展主题色板
7. **单例模式**：`getThemeEngine()` 全局唯一实例

### 方法列表

| 方法 | 签名 | 说明 |
|------|------|------|
| `registerTheme` | `(id, options) => void` | 注册主题 |
| `setTheme` | `(id) => void` | 切换当前主题 |
| `getTheme` | `() => string` | 获取当前主题 id |
| `subscribe` | `(callback) => () => void` | 订阅主题变化，返回取消订阅函数 |
| `setMotionEnabled` | `(enabled) => void` | 启用/禁用动画 |
| `loadExternalTheme` | `(url) => Promise<void>` | 加载远程主题包 JSON |
| `setDynamicColor` | `(seedColor) => void` | 动态色注入（扩展主题） |

### registerTheme

注册主题到引擎。通常由 `theme-loader` 在启动时批量调用。

```javascript
import { getThemeEngine } from '@/core/theme-engine';

var engine = getThemeEngine();

engine.registerTheme('dark', {
  name: '深色',
  type: 'dark',
  tokens: { color: { primary: '#0A84FF' }, /* ... */ },
  icons: { /* 可选：主题专属图标映射 */ }
});
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 主题唯一 ID（如 `'light'`、`'dark'`） |
| `options.name` | `string` | 否 | 显示名称，缺省为 id |
| `options.type` | `'light' \| 'dark'` | 否 | 主题类型，缺省 `'light'` |
| `options.tokens` | `object` | 否 | 主题 Token（详见 [UI — 主题定制](/ui/theme)） |
| `options.icons` | `object` | 否 | 主题专属图标映射 |

### setTheme

切换当前主题，立即生效。

```javascript
engine.setTheme('dark');  // 切换到深色主题
```

内部执行：
1. 校验主题是否已注册，未注册回退到 `'light'`
2. `setAttribute('data-theme', id)` 触发旧 CSS 切换
3. 调用 `flattenTokens` 展平 token，写入 `--ci-*` 新变量到 `document.documentElement`
4. 通知所有订阅者
5. 通过 `EventBus` 广播 `THEME_CHANGED` 事件

::: tip 内置主题
内置主题从 `themes/` 顶级目录通过 `theme-loader` 动态加载：
- `light`：浅色主题（默认）
- `dark`：深色主题
:::

### getTheme

```javascript
var currentId = engine.getTheme();  // 'dark'
```

### subscribe

订阅主题变化，返回取消订阅函数。

```javascript
var unsubscribe = engine.subscribe(function(payload) {
  console.log('主题切换为：', payload.id, '上一主题：', payload.previous);
  // payload: { id, previous, type, icons }
});

// Vue 组件中清理
onUnmounted(function() { unsubscribe(); });
```

### setMotionEnabled

启用或禁用全局动画（适合低性能设备或无障碍场景）。

```javascript
engine.setMotionEnabled(false);  // 关闭所有动画
```

::: tip 自动降级
ThemeEngine 会响应 `prefers-reduced-motion: reduce` 媒体查询，自动禁用动画。手动调用 `setMotionEnabled(false)` 会覆盖系统设置。
:::

### loadExternalTheme

异步加载远程主题包 JSON 并注册。

```javascript
engine.loadExternalTheme('/themes/custom-theme.json').then(function() {
  engine.setTheme('custom-theme');
});
```

### setDynamicColor

为扩展主题注入动态色（基于种子色重新生成色板）。

```javascript
engine.setDynamicColor('#FF6B6B');  // 重新生成扩展主题的 color token
```

::: warning 仅扩展主题生效
`setDynamicColor` 仅对当前主题为扩展主题时生效。内置主题（`light`/`dark`）的色板固定，不会受此方法影响。详见 [UI — 主题定制 → 扩展主题开发](/ui/theme#扩展主题开发)。
:::

## EventBus

源码：`client/src/core/event-bus.js`

事件总线，提供发布订阅机制。设计要点：

1. **handler 异常隔离**：单个 `handler throw` 不影响其他 handler
2. **快照遍历**：`emit` 时复制 handlers 数组，防止遍历中被修改
3. **`error:handler` 事件**：用于报告 handler 异常（避免递归）
4. **单例模式**：`getEventBus()` 全局唯一实例
5. **Chrome 80 兼容**：不使用可选链、空值合并等 ES2020+ 语法

### 方法列表

| 方法 | 签名 | 说明 |
|------|------|------|
| `on` | `(event, handler) => () => void` | 注册事件监听器，返回取消订阅函数 |
| `off` | `(event, handler) => void` | 移除事件监听器 |
| `emit` | `(event, ...args) => void` | 触发事件，所有参数透传给 handler |
| `once` | `(event, handler) => () => void` | 注册一次性监听器（触发后自动移除） |

### on / off

```javascript
import { getEventBus } from '@/core/event-bus';

var bus = getEventBus();

// 注册监听器
var unsubscribe = bus.on('user:login', function(user) {
  console.log('用户登录：', user);
});

// 取消订阅
unsubscribe();
// 或
bus.off('user:login', handler);
```

### emit

触发事件，所有参数（除事件名外）透传给 handler。

```javascript
bus.emit('user:login', { user_id: '2024001', net_name: '小明' });
bus.emit('theme:changed', { id: 'dark', previous: 'light' });
```

- 单个 handler 异常被 try/catch，不影响其他
- 异常通过 `error:handler` 事件报告（含 `{ event, error, handler }`）

::: tip 错误隔离
EventBus 会捕获单个 handler 的同步异常并派发 `error:handler` 事件，避免一个监听器抛错影响其他监听器。但异步错误（Promise rejection）不会被捕获，请 handler 内部自行 `try/catch`。
:::

### once

注册一次性监听器，触发后自动移除。

```javascript
bus.once('app:ready', function() {
  console.log('应用就绪（仅触发一次）');
});
```

::: warning 防止重入
`once` 内部会先移除 wrapper 再调用原 handler，防止 handler 内部再次触发导致重入。
:::

## HotkeyManager

源码：`client/src/core/hotkey-manager.js`

热键管理器，负责全局快捷键的注册、注销与分发。

### 方法列表

| 方法 | 签名 | 说明 |
|------|------|------|
| `register` | `({ id, combo, handler, global }) => () => void` | 注册热键，返回取消注册函数 |
| `unregister` | `(id) => void` | 按 id 注销热键 |

### register

注册热键。

```javascript
import { getHotkeyManager } from '@/core/hotkey-manager';

var hotkeys = getHotkeyManager();

// 注册全局搜索快捷键（Ctrl+K）
var unregister = hotkeys.register({
  id: 'global-search',
  combo: 'ctrl+k',
  handler: function(e) {
    e.preventDefault();
    store.commit('ui/SHOW_GLOBAL_SEARCH', true);
  },
  global: true  // 全局生效，不限制焦点
});

// 注销
unregister();
// 或
hotkeys.unregister('global-search');
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 热键唯一 ID，重复注册会覆盖 |
| `combo` | `string` | 是 | 组合键，格式 `'mod1+mod2+key'`（如 `'ctrl+k'`、`'alt+shift+p'`），`mod` 支持 `ctrl`/`alt`/`shift`/`meta` |
| `handler` | `function(event)` | 是 | 触发回调，参数为原生 `KeyboardEvent` |
| `global` | `boolean` | 否 | 是否全局生效（不限制焦点元素），默认 `false` |

::: tip 内置热键
ClassIntra 已注册以下全局热键：
- `ctrl+k` / `cmd+k`：全局搜索（`GlobalSearch.vue`）
- `esc`：关闭模态对话框
:::

## SearchRegistry

源码：`client/src/core/search-registry.js`

全局搜索注册中心，为 `GlobalSearch.vue` 提供命令与搜索结果来源。

### 方法列表

| 方法 | 签名 | 说明 |
|------|------|------|
| `registerCommand` | `({ id, title, action }) => () => void` | 注册命令项，返回注销函数 |
| `registerProvider` | `({ id, search }) => () => void` | 注册搜索结果来源，返回注销函数 |

### registerCommand

注册一个可被全局搜索直接调用的命令项（无需搜索词也会显示）。

```javascript
import { getSearchRegistry } from '@/core/search-registry';

var search = getSearchRegistry();

search.registerCommand({
  id: 'toggle-theme',
  title: '切换深色/浅色主题',
  action: function() {
    var engine = getThemeEngine();
    engine.setTheme(engine.getTheme() === 'dark' ? 'light' : 'dark');
  }
});
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 命令唯一 ID |
| `title` | `string` | 是 | 显示标题 |
| `action` | `function()` | 是 | 选中时执行的回调 |

### registerProvider

注册搜索结果来源（输入关键词时动态返回结果）。

```javascript
search.registerProvider({
  id: 'posts',
  search: function(query) {
    // 返回 Promise<Array<{ id, title, subtitle, action }>>
    return api.get('/community/search', { params: { q: query } })
      .then(function(res) {
        return res.data.data.map(function(post) {
          return {
            id: 'post-' + post.id,
            title: post.title,
            subtitle: '作者：' + post.author_name,
            action: function() { router.push('/post/' + post.id); }
          };
        });
      });
  }
});
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | Provider 唯一 ID |
| `search` | `function(query) => Promise<Array>` | 是 | 接收搜索词，返回 Promise，resolve 为结果数组 |

::: tip 全局搜索入口
`GlobalSearch.vue` 通过 `Ctrl+K` 唤起，会聚合所有已注册的命令项与 Provider 结果。详见 [UI — 组件库 → GlobalSearch](/ui/components#globalsearch)。
:::

## PersistenceStore

源码：`client/src/core/persistence-store.js`

持久化存储封装，基于 `localStorage`，支持订阅 key 变化。

### 方法列表

| 方法 | 签名 | 说明 |
|------|------|------|
| `get` | `(key, defaultValue) => any` | 读取 key，不存在时返回 `defaultValue` |
| `set` | `(key, value) => void` | 写入 key（自动 JSON 序列化） |
| `remove` | `(key) => void` | 删除 key |
| `onChange` | `(key, handler) => () => void` | 订阅 key 变化（同窗口 + 跨窗口 `storage` 事件），返回取消订阅函数 |

### 使用示例

```javascript
import { getPersistenceStore } from '@/core/persistence-store';

var store = getPersistenceStore();

// 读取（带默认值）
var theme = store.get('theme', 'light');  // 'dark' 或 'light'

// 写入（自动 JSON 序列化）
store.set('recentApps', ['chat', 'notes', 'weather']);

// 删除
store.remove('tempData');

// 订阅变化（同窗口 + 跨窗口）
var unsubscribe = store.onChange('theme', function(newValue, oldValue) {
  console.log('主题变化：', oldValue, '→', newValue);
});

// Vue 组件销毁时取消订阅
onUnmounted(function() { unsubscribe(); });
```

::: tip 跨窗口同步
`onChange` 同时监听 `storage` 事件，因此多标签页之间会同步：当用户在 A 标签页修改主题，B 标签页的 `onChange` 回调也会触发。
:::

## HTTP 客户端（utils/api.js）

源码：`client/src/utils/api.js`

基于 Axios 封装的 HTTP 客户端，是前端调用服务端 API 的统一入口。

### 基本用法

```javascript
import api from '@/utils/api';

// GET
api.get('/user/profile').then(function(res) {
  console.log(res.data.code, res.data.message, res.data.data);
});

// POST
api.post('/auth/login', { account: '张三', password: 'xxx' })
  .then(function(res) { /* ... */ });

// PUT
api.put('/user/change-password', { old_password: '...', new_password: '...' });

// DELETE
api.delete('/community/posts/123');
```

### 默认配置

| 配置项 | 值 | 说明 |
|------|----|-----|
| `baseURL` | `/api` | 所有请求自动拼接 `/api` 前缀 |
| `timeout` | `10000` | 10 秒超时 |
| `withCredentials` | `true` | 跨域携带 Cookie |

### 请求拦截器

请求拦截器自动完成：

1. **断网保护**：`store.state.network.online === false` 时，仅放行 `/auth/check-status` 心跳请求，其他请求直接 reject
2. **Token 注入**：从 `store.state.auth.token` 读取，写入 `Authorization: Bearer <token>` 头部
3. **缓存控制**：对 `/auth/`、`/chat/`、`/community/posts`、`/user/settings`、`/music/` 等路径禁用缓存，自动添加 `Cache-Control: no-cache, no-store` 与时间戳查询参数

### 响应拦截器

响应拦截器自动完成：

1. **网络恢复检测**：请求成功时重置失败计数，标记在线
2. **断网判定**：连续 5 次无响应（`!error.response`）时触发断网保护，添加 `offline-secure` class 隐藏内容
3. **401 自动跳转**：返回 401 且不在公开页面（`Login`/`Register`/`Banned`）时，自动登出并跳转登录页

::: warning 公开页面豁免
为避免心跳检测把未登录用户从注册页踢出，`Login`/`Register`/`Banned` 三个公开路由不受 401 自动跳转影响。
:::

### 完整示例

```javascript
import api from '@/utils/api';

async function fetchProfile() {
  try {
    var res = await api.get('/user/profile');
    if (res.data.code === 200) {
      return res.data.data;  // user_info 对象
    } else {
      throw new Error(res.data.message);
    }
  } catch (err) {
    // 网络错误或业务错误
    console.error('获取资料失败：', err);
    throw err;
  }
}
```

## WebSocket 客户端（utils/websocket.js）

源码：`client/src/utils/websocket.js`

WebSocket 客户端管理器，支持自动重连、心跳保活、HTTP 长轮询回退、离线消息队列。

### 方法列表

| 方法 | 签名 | 说明 |
|------|------|------|
| `connect` | `(url) => void` | 建立 WebSocket 连接（自动从 localStorage 读取 token 拼接查询参数） |
| `send` | `(type, data) => void` | 发送消息（JSON 序列化 `{ type, ...data }`） |
| `on` | `(type, handler) => () => void` | 订阅消息类型，返回取消订阅函数 |
| `disconnect` | `() => void` | 主动断开（不再自动重连） |

### connect

建立 WebSocket 连接。

```javascript
import wsManager from '@/utils/websocket';

// 连接时自动从 localStorage 读取 token，拼接为 ws://host:port/ws?token=xxx
wsManager.connect('ws://localhost:5001/ws');
```

连接成功后：
1. 启动心跳定时器（每 30 秒发送 `ping`，等待 `pong`）
2. 发送 `connect` 消息完成认证
3. 刷新离线消息队列（最多 50 条）

::: tip 自动重连
连接断开（非主动 `disconnect`）时，会按指数退避自动重连，最大重连 10 次，初始延迟 3 秒。
:::

::: warning HTTP 长轮询回退
当浏览器不支持 WebSocket（如极旧环境）或 WS 连接多次失败时，会自动切换到 HTTP 长轮询模式（`_transport = 'poll'`），通过定时 `GET /api/events/poll?since=<ts>` 拉取事件。
:::

### send

发送消息。

```javascript
wsManager.send('chat', {
  room_id: 'public',
  content: '你好'
});
// 实际发送：{ type: 'chat', room_id: 'public', content: '你好' }
```

::: warning 离线队列
未连接时 `send` 不会立即丢弃消息，而是放入 `_offlineQueue`（最多 50 条），连接恢复后自动 flush。
:::

### on

订阅消息类型。

```javascript
var unsubscribe = wsManager.on('chat', function(data) {
  console.log('收到消息：', data.content);
});

// 取消订阅
unsubscribe();
```

::: tip 内置事件类型
- `connected`：连接成功（含服务器返回的初始化数据）
- `pong`：心跳响应
- `chat`：聊天消息
- `notification`：通知推送
- `_connectionStateChange`：连接状态变化（`connected`/`disconnected`/`reconnecting`）
- `_wsOpen` / `_wsTimeout`：底层 WS 事件
:::

### disconnect

主动断开 WebSocket，不再自动重连。

```javascript
wsManager.disconnect();
```

::: tip Vue 组件清理
建议在根组件（`App.vue`）的 `beforeDestroy` 钩子中调用 `disconnect()`，避免组件销毁后 WebSocket 仍占用资源。
:::

### 完整使用示例

```javascript
import wsManager from '@/utils/websocket';
import store from '@/store';

// 启动连接
wsManager.connect('ws://' + location.host + '/ws');

// 监听消息
wsManager.on('chat', function(data) {
  store.commit('chat/ADD_MESSAGE', data);
});

wsManager.on('notification', function(data) {
  store.dispatch('toast/showToast', { message: data.title, type: 'info' });
});

wsManager.on('_connectionStateChange', function(payload) {
  store.commit('network/SET_WS_STATE', payload.state);
});

// 发送消息
function sendChat(content) {
  wsManager.send('chat', {
    room_id: store.state.chat.currentRoom,
    content: content
  });
}
```

## 相关文档

- [API 参考 — 总览](./index)
- [API 参考 — 服务端 API](./server)
- [API 参考 — 类型定义](./types)
- [核心概念 — 主题系统](/concepts/theme-system)
- [核心概念 — WebSocket 通信](/concepts/websocket)
- [UI — 组件库](/ui/components)
- [UI — 主题定制](/ui/theme)
