---
title: 第三方应用开发
description: ClassIntra 第三方应用开发指南。涵盖两条接入路线（官方内置应用与市场应用）、manifest.json 字段、Chrome 80 兼容红线、同页面运行时契约、设计令牌一致性、能力披露与生命周期回收。
---

# 第三方应用开发

ClassIntra 的应用接入有**两条路线**，先明确你属于哪一条，再往下读。

| | 官方内置应用 | 市场应用（第三方） |
|---|---|---|
| 位置 | 主仓库 `apps/<name>/` | 独立市场仓库，安装到班级服务器 `market-apps/<name>/` |
| 语言 | `.vue` 单文件组件 | 纯 `.js`（**不过构建**） |
| 构建 | 经 Vite，有 postcss / legacy 兜底 | 源码直接下发，**无任何兜底** |
| 加载 | `import.meta.glob` 编译期扫描 | 运行时动态 `<script>` 注入 |
| 校验 | `shared/src/manifest-schema.js` | `_validateMarketManifest()`（独立实现） |
| 适用 | ClassIntra 核心功能 | 外部开发者分发 |

::: warning 两条路线的 manifest 校验器不共用
市场应用走 `client/src/core/market-registry.js` 的独立校验，**不经过** `shared/src/manifest-schema.js`。
给市场 manifest 新增字段，必须同步改 `_validateMarketManifest()`，否则字段被静默丢弃。
:::

本页主体面向**市场应用开发者**（绝大多数第三方属于这一类）。官方内置应用的开发约定见 [应用架构](/concepts/architecture)。

---

## 市场应用是什么

市场应用 = 一个目录 + 一个 `manifest.json` + 若干 `.js` / `.css` 文件。安装到班级服务器后，它与官方应用**运行在同一个页面上下文**，共享 DOM、`window`、`localStorage` 与主题令牌。

这不是沙箱模型。ClassIntra 的设计决策是**同页面自由**：

- 你有完整的 DOM 与 `window` 访问权；
- 你能读写 `localStorage`、注册全局事件、修改 `document` 样式；
- 相应地，**破坏性后果由你负责**——踩坏宿主页面不会被运行时拦住。

::: tip 为什么不做沙箱
`iframe` 沙箱会切断主题令牌继承、阻断 DOM 复用、并让「像系统原生应用一样」的观感无法实现。ClassIntra 选择信任开发者，用**契约 + 审查**替代**运行时隔离**（详见 [生态设计](/concepts/ecosystem)）。
:::

---

## 目录结构

```text
my-app/
├── manifest.json              # 必填
├── icon.svg                   # 可选
├── frontend/
│   ├── entry.js               # 必填，入口脚本（纯 ES5）
│   ├── style.css              # 可选
│   └── widgets/               # 可选，桌面小组件
│       └── widget.js
└── backend/
    └── routes.js              # 可选，Express 路由（CommonJS）
```

命名规范：目录名与 `name` 字段用 kebab-case（`my-app`），路由路径同（`/my-app`、`/api/my-app`）。

::: tip 用脚手架生成，别手写
```bash
pnpm create:app my-app --label "我的应用" --with-backend
```
生成的模板已预置 ES5 语法、`--ci-*` 令牌消费与 `onDestroy` 回收契约，开箱即可通过审查（0 错误 0 警告）。
比从零手写少踩三类最常见的坑。详见 [CLI 工具 § 应用脚手架](./cli#应用脚手架)。
:::

---

## 兼容红线（最重要的一节）

市场应用的 `entry.js` **不经过 Vite 构建**，因此拿不到 `@vitejs/plugin-legacy` 的语法降级，也拿不到 PostCSS 的 `-webkit-` 前缀与 flex-gap polyfill。

目标设备是 Android 9 平板 + 腾讯 X5/TBS（Chromium 89）以及 Chrome 80 非 X5 内核。**必须**遵守：

### 禁用语法（Chrome 80 无法解析，直接白屏）

| 禁用 | 替代 |
|---|---|
| `const` / `let` | `var` |
| 箭头函数 `() => {}` | `function () {}` |
| 模板字符串 `` `${x}` `` | `'a' + x + 'b'` |
| 可选链 `a?.b` | `a && a.b` |
| 空值合并 `a ?? b` | `a !== undefined && a !== null ? a : b` |
| `class` | 构造函数 + `prototype` |
| 逻辑赋值 `a \|\|= b` | `a = a \|\| b` |
| `async` / `await` | Promise 链 |
| 解构 `var { a } = o` | `var a = o.a` |
| 展开 `...args` | `arguments` |

### 禁用 CSS

| 禁用 | 原因 | 替代 |
|---|---|---|
| flex `gap` | 需 Chrome 84+ | 子元素 `margin` |
| `:is()` / `:where()` | 需 Chrome 88+ | 展开选择器 |
| `aspect-ratio` | 需 Chrome 88+ | padding-top 百分比撑高 |
| 容器查询 `@container` | 需 Chrome 105+ | 用 `ResizeObserver` 或媒体查询 |
| `backdrop-filter` 重依赖 | 中低端设备掉帧 | 提供不透明降级（见令牌章节） |

### 实时通道

**禁止直接用 WebSocket**。腾讯 X5/TBS 的长连接不可靠，会静默断开。

统一走 `context.data.realtime`（HTTP 长轮询封装）：

```javascript
var stop = context.data.realtime.subscribe('my-app.updated', function (payload) {
  render(payload);
});

// 卸载时务必取消
context.app.onDestroy(function () {
  stop();
});
```

---

## manifest.json

```json
{
  "name": "my-app",
  "label": "我的应用",
  "version": "1.0.0",
  "sdk": "1",
  "icon": "./icon.svg",
  "color": "#5856D6",
  "category": "desktop",
  "order": 20,
  "visibleRoles": [],
  "capabilities": ["data.storage", "ui.toast"],
  "layout": { "mode": "fullscreen" },
  "frontend": {
    "route": "/my-app",
    "entry": "./frontend/entry.js",
    "style": "./frontend/style.css"
  },
  "backend": {
    "mountPath": "/api/my-app",
    "entry": "./backend/routes.js"
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `name` | string | 是 | — | 唯一标识，kebab-case，须与目录名一致 |
| `label` | string | 是 | — | 桌面显示名 |
| `version` | string | 否 | `0.0.0` | 语义化版本，用于更新判断 |
| `sdk` | string | 否 | `"1"` | 所需 SDK 主版本。高于系统版本时**阻断安装** |
| `icon` | string | 否 | — | 相对路径图标（SVG 优先） |
| `color` | string | 否 | — | 主题色 hex，用于占位与强调 |
| `category` | string | 否 | `desktop` | `desktop` / `system` / `hidden` |
| `order` | number | 否 | `99` | 桌面排序，越小越靠前 |
| `visibleRoles` | string[] | 否 | `[]` | 可见角色白名单。**空数组 = 所有角色可见** |
| `capabilities` | string[] | 否 | `[]` | 能力披露清单，安装前展示（**不拦截**） |
| `layout` | object | 否 | — | 布局偏好，见下 |
| `frontend` | object | 否 | — | 前端配置 |
| `backend` | object | 否 | — | 后端配置 |

### `sdk` 版本约束

`sdk` 声明「本应用依赖的 SDK 主版本」。

- 等于或低于系统版本 → 正常。
- **高于**系统版本 → 安装被阻断，错误提示引导用户升级 ClassIntra。

比静默失败更好：应用做不到的事，在安装前就说清楚。

```json
{ "sdk": "2" }
```

若系统为 v1，安装时会得到：`此应用要求 SDK v2，当前系统为 v1——请升级 ClassIntra 后再安装`。

格式非法（如 `"abc"`）不会阻断，只产生警告并回落到 `"1"`。

### `visibleRoles` 角色可见性

控制哪些角色在桌面看到此应用：

```json
{ "visibleRoles": ["admin", "officer"] }
```

合法值：`admin`（班管）/ `officer`（班干部）/ `student`（学生）。空数组或不写 = 全部可见。

未知角色名会产生警告（不阻断），便于发现拼写错误。

### `layout` 布局偏好

```json
{
  "layout": {
    "mode": "fullscreen",
    "resizable": false,
    "minWidth": 320,
    "minHeight": 240
  }
}
```

| `mode` | 行为 |
|---|---|
| `fullscreen`（默认） | 占满可用区域，与官方应用一致 |
| `sheet` | 底部抽屉式，适合轻量交互 |
| `window` | 可浮窗，适合工具类应用 |

`resizable` 仅 `window` 模式有意义。`minWidth` / `minHeight` 为数字像素值。

非法 `mode` 会降级为 `fullscreen` 并产生警告；类型错误的字段被剔除。

### `capabilities` 能力披露

**这是披露，不是权限申请。** ClassIntra 不拦截未声明的能力，声明它只为了：

1. 安装前告诉班管「这个应用会用到什么」；
2. 市场审核的参考依据。

十六项已知能力（命名与 SDK 命名空间对齐）：

| 命名空间 | 能力 |
|---|---|
| 数据 | `data.storage` `data.realtime` `data.http` |
| 系统 | `system.notification` `system.clipboard` `system.share` `system.navigate` |
| 界面 | `ui.toast` `ui.modal` `ui.sheet` |
| 应用自身 | `app.config` `app.storage` |
| 设备 | `device.info` `device.filePicker` `device.camera` |

未知能力名产生警告但不阻断——便于我们扩展清单，也帮你发现拼写错误。

---

## 前端入口

市场前端入口通过全局 SDK 注册：

```javascript
window.ClassIntraMarket.define({
  name: 'my-app',
  mount: function (container, context) {
    var el = document.createElement('div');
    el.className = 'my-app-root';
    el.textContent = 'Hello ClassIntra';
    container.appendChild(el);

    // 注册清理：必须在 onDestroy 里回收一切
    context.app.onDestroy(function () {
      el.parentNode && el.parentNode.removeChild(el);
    });
  },
  unmount: function (container) {
    container.replaceChildren();
  }
});
```

### `context` 提供的能力

按命名空间分层，与 `capabilities` 清单一一对应。

| 命名空间 | 内容 | 对应能力 |
|---|---|---|
| `context.appName` | 当前应用名 | — |
| `context.app` | `onDestroy(fn)`、配置读写 | `app.config` `app.storage` |
| `context.data` | `get` / `post`（HTTP）、`realtime`（长轮询）、`storage`（命名空间存储） | `data.*` |
| `context.ui` | `toast` / `modal` / `sheet`，返回原生 DOM 片段 | `ui.*` |
| `context.system` | `notify` / `clipboard` / `share` / `navigate` | `system.*` |
| `context.device` | `info` / `filePicker` / `camera` | `device.*` |
| `context.theme` | 当前主题 id 与令牌读取 | — |
| `context.router` | 路由跳转 | `system.navigate` |

::: tip `context.ui.*` 返回的是 DOM 片段而非 Vue 组件
因为第三方不过构建，拿不到 `@vue/compiler`。UI 能力返回原生元素，你直接 `appendChild` 即可。这保证了零构建步骤。
:::

### 数据存储必须加命名空间

`localStorage` 是共享的。所有键名**必须**加 `ci:app:<name>:` 前缀：

```javascript
// 正确
localStorage.setItem('ci:app:my-app:settings', JSON.stringify(cfg));

// 错误：会污染宿主与其他应用
localStorage.setItem('settings', JSON.stringify(cfg));
```

运行时会在卸载时清理你的命名空间。用别的前缀，数据会残留。

---

## 生命周期与回收契约

同页面模型下，**卸载干净**是硬性要求。宿主不会替你兜底内存泄漏带来的卡顿。

### 必须回收的四类资源

| 资源 | 回收方式 |
|---|---|
| 事件监听 | `removeEventListener`（或用 `context.app.onDestroy` 统一清理） |
| 定时器 | `clearInterval` / `clearTimeout` |
| 实时订阅 | `context.data.realtime.subscribe()` 返回的取消函数 |
| DOM 节点 | `container.replaceChildren()` 或移除自建节点 |

### `context.app.onDestroy`

注册卸载回调，按**注册的逆序**执行：

```javascript
context.app.onDestroy(function () { clearInterval(timer); });
context.app.onDestroy(function () { removeEventListener('resize', onResize); });
```

### 运行时审计（开发期辅助）

开发模式下，运行时会对 `window` 键、计时器、监听器做前后快照对比，把未回收项打到控制台。这不阻断运行，只提示。**上线前请把它清零。**

---

## 视觉一致性：必须用设计令牌

第三方最常犯的错误是自建一套颜色和圆角，导致「这个应用一看就不是系统里的」。ClassIntra 通过 **AppShell 挂载时把 `--ci-*` 令牌注入到你的容器根节点**，你零代码即可跟随主题。

### 颜色

```css
.my-app-root {
  background: var(--ci-color-bg-elevated, #FFFFFF);
  color: var(--ci-color-text-primary, #000000);
  border: 1px solid var(--ci-color-border, rgba(0, 0, 0, 0.1));
}
```

`var()` 的第二个参数是**兜底值**。请让它与令牌真值一致，否则主题覆盖为空时会出现体系外数值。

### 圆角梯度（八档）

ClassIntra 只有八档圆角。**不要写裸 px**。

| 令牌 | 值 | 用途 |
|---|---|---|
| `--ci-shape-xs` | 4px | 小标签、徽标 |
| `--ci-shape-sm` | 8px | 按钮、输入框、列表项 |
| `--ci-shape-md` | 12px | 卡片内元素 |
| `--ci-shape-lg` | 16px | 卡片、弹窗 |
| `--ci-shape-xl` | 20px | 大面板 |
| `--ci-shape-2xl` | 24px | 容器、分组 |
| `--ci-shape-3xl` | 28px | 全屏面板、抽屉 |
| `--ci-shape-pill` | 9999px | 胶囊按钮、头像框、细线 |

两类合法例外：`50%`（正圆/头像）与 `0`（明确直角）。

细线（1–2px 高度）用 `pill`——这是 iOS 分隔线的常见做法，能避免细线两端出现可见的圆头瑕疵。

### 动效

三方禁用自造 `cubic-bezier`。用令牌：

| 令牌 | 值 | 场景 |
|---|---|---|
| `--ci-motion-spring-snappy` | `cubic-bezier(0.32, 1.28, 0.5, 1)` | 弹窗入场、面板展开、按钮反馈 |
| `--ci-motion-spring-bouncy` | `cubic-bezier(0.34, 1.72, 0.52, 1)` | **仅**偶发庆祝（点赞、徽章） |
| `--ci-motion-spring-smooth` | `cubic-bezier(0.22, 1, 0.36, 1)` | 文字与内容淡入、侧栏滑入 |
| `--ci-motion-spring-interactive` | `cubic-bezier(0.2, 0.9, 0.3, 1)` | 跟手反馈、`:active` |
| `--ci-motion-duration-fast` | `0.15s` | 即时反馈 |
| `--ci-motion-duration-normal` | `0.25s` | 常规过渡 |
| `--ci-motion-duration-slow` | `0.35s` | 大范围位移 |
| `--ci-motion-duration-stagger` | `0.05s` | 列表错开步长 |

::: warning 别全局用同一个 spring
`bouncy` 只给偶发庆祝。入场动画用 `bouncy` 会让界面显得玩具化。文字淡入用 `smooth`（无过冲）。
:::

对比：

```css
/* 错误：自造曲线 + 裸秒数 */
.card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }

/* 正确：令牌 + 显式属性 */
.card {
  transition: transform var(--ci-motion-duration-normal) var(--ci-motion-spring-snappy),
              box-shadow var(--ci-motion-duration-normal) var(--ci-motion-spring-snappy);
}
```

三条硬规则：

1. **不要 `transition: all`** —— 会连带布局属性，造成回流。
2. **不要过渡布局属性**（`width` / `height` / `top` / `left` / `margin`）—— 用 `transform` 与 `opacity`。
3. **不要从 `scale(0)` 起步** —— 用 `scale(0.96) + opacity: 0`。缩到零会产生「凭空崩坏」的观感。唯一例外是 `scaleX(0)` / `scaleY(0)`（进度条与波形条的「长度生长」）。

### 毛玻璃降级

`backdrop-filter` 在中低端设备上掉帧。当系统性能模式为 `low`、正在滚动、或用户手动设置时，容器会带上 `data-perf="low"` / `data-scrolling="1"` / `data-glass="flat"` 属性。

请主动响应：

```css
.my-app-header {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

[data-perf="low"] .my-app-header,
[data-scrolling="1"] .my-app-header,
[data-glass="flat"] .my-app-header {
  background: var(--ci-color-bg-elevated, #FFFFFF);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
```

---

## 后端路由

`backend/routes.js` 是 CommonJS 模块，导出 Express Router。

```javascript
// my-app/backend/routes.js
var express = require('express');
var router = express.Router();

var auth = require('../../../server/src/middleware/auth');
var db = require('../../../server/src/utils/db');

router.get('/items', auth.requireAuth, function (req, res) {
  var rows = db.prepare(
    'SELECT * FROM my_items WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.user_id);
  res.json({ code: 200, data: { items: rows } });
});

router.post('/items', auth.requireAuth, function (req, res) {
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

### 路径解析注意

`require('../../../server/...')` 中的层级取决于应用的**运行时安装位置**（`market-apps/<name>/backend/`）。

推荐在文件顶部集中声明核心路径：

```javascript
var CORE = '../../../../server/src';
var auth = require(CORE + '/middleware/auth');
```

### better-sqlite3 调用注意

statement 方法必须以 statement 自身为 `this`：

```javascript
// 错误：TypeError: Illegal invocation
stmt.all.apply(null, values);

// 正确
stmt.all.apply(stmt, values);
```

### 卸载后的行为

应用卸载后，其 API 返回 **JSON 404**，而不是前端 `index.html`。不要指望前端路由能兜住。

---

## 安装与生命周期

用户不需要克隆市场仓库。班级服务器读取 GitHub Raw 上的 catalog，按文件清单逐个下载：

```text
https://raw.githubusercontent.com/ClassIntra/market/main/index.json
https://raw.githubusercontent.com/ClassIntra/market/main/apps/my-app/manifest.json
```

安装流程：

1. 市场目录从 Local 或 GitHub source 读取 `index.json`；
2. 服务端校验应用名、manifest、文件路径、文件数量与大小；
3. 先写入临时目录，再**原子替换**运行时目录；
4. 服务端热挂载后端路由；
5. 客户端刷新市场 registry 与动态路由；
6. 应用出现在桌面入口，按需加载前端脚本与样式。

**全程不需重启服务。**

启用/禁用是**班级统一状态**。班管修改后服务端广播：

```json
{
  "type": "market_app_control_changed",
  "appName": "my-app",
  "enabled": false,
  "updatedBy": "999999"
}
```

客户端据此刷新 registry、动态路由、桌面布局、Dock、文件夹、小组件与运行实例。正在使用被禁用应用的成员会自动返回桌面。

### 动态路由与直接访问

市场应用注册是异步的。直接访问 `http://<host>/my-app` 时，Vue Router 可能先命中通配路由。入口会保存初始路径，在 registry 刷新并注册动态路由后恢复。

因此直接 URL 访问应能正常进入应用。加载失败时显示统一错误态，并提供重试与返回桌面。

---

## 完整示例

### 1. 目录

```text
my-app/
├── manifest.json
├── icon.svg
├── frontend/
│   ├── entry.js
│   └── style.css
└── backend/
    └── routes.js
```

### 2. `manifest.json`

```json
{
  "name": "my-app",
  "label": "计数器",
  "version": "1.0.0",
  "sdk": "1",
  "color": "#5856D6",
  "category": "desktop",
  "order": 50,
  "capabilities": ["data.storage", "data.realtime", "ui.toast"],
  "layout": { "mode": "fullscreen" },
  "frontend": {
    "route": "/my-app",
    "entry": "./frontend/entry.js",
    "style": "./frontend/style.css"
  },
  "backend": {
    "mountPath": "/api/my-app",
    "entry": "./backend/routes.js"
  }
}
```

### 3. `frontend/entry.js`

```javascript
/* 注意：全部使用 ES5 语法，此文件不经构建 */
window.ClassIntraMarket.define({
  name: 'my-app',

  mount: function (container, context) {
    var root = document.createElement('div');
    root.className = 'my-app-root';

    var title = document.createElement('h2');
    title.className = 'my-app-title';
    title.textContent = '计数器';
    root.appendChild(title);

    var value = document.createElement('p');
    value.className = 'my-app-value';
    value.textContent = '0';
    root.appendChild(value);

    var btn = document.createElement('button');
    btn.className = 'my-app-btn';
    btn.textContent = '加一';
    root.appendChild(btn);

    var count = 0;

    function onClick() {
      count += 1;
      value.textContent = String(count);
      localStorage.setItem('ci:app:my-app:count', String(count));

      context.data.post('/api/my-app/incr', { delta: 1 })
        .then(function (res) {
          if (res && res.code === 200) {
            context.ui.toast('已同步');
          }
        })
        .catch(function () {
          context.ui.toast('已离线保存');
        });
    }

    btn.addEventListener('click', onClick);
    container.appendChild(root);

    /* 实时事件 */
    var stop = context.data.realtime.subscribe('my-app.updated', function (payload) {
      count = payload.count;
      value.textContent = String(count);
    });

    /* 回收契约：逆序执行 */
    context.app.onDestroy(function () { stop(); });
    context.app.onDestroy(function () { btn.removeEventListener('click', onClick); });
    context.app.onDestroy(function () {
      root.parentNode && root.parentNode.removeChild(root);
    });
  },

  unmount: function (container) {
    container.replaceChildren();
  }
});
```

### 4. `frontend/style.css`

```css
.my-app-root {
  padding: 24px;
  background: var(--ci-color-bg-elevated, #FFFFFF);
  color: var(--ci-color-text-primary, #000000);
  border-radius: var(--ci-shape-lg, 16px);
}

.my-app-title {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 600;
}

.my-app-value {
  margin: 0 0 16px;
  font-size: 48px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  transition: transform var(--ci-motion-duration-normal) var(--ci-motion-spring-snappy);
}

.my-app-btn {
  padding: 12px 24px;
  border: none;
  border-radius: var(--ci-shape-pill, 9999px);
  background: var(--ci-color-primary, #007AFF);
  color: #FFFFFF;
  font-size: 16px;
  /* 只过渡 transform 与 box-shadow，不过渡布局属性 */
  transition: transform var(--ci-motion-duration-fast) var(--ci-motion-spring-interactive),
              box-shadow var(--ci-motion-duration-fast) var(--ci-motion-spring-interactive);
}

.my-app-btn:active {
  transform: scale(0.96);
}
```

### 5. `backend/routes.js`

```javascript
var express = require('express');
var router = express.Router();

var auth = require('../../../server/src/middleware/auth');
var db = require('../../../server/src/utils/db');

router.post('/incr', auth.requireAuth, function (req, res) {
  var user = req.user.user_id;
  var cur = db.prepare('SELECT count FROM my_counts WHERE user_id = ?').get(user);

  var next = (cur ? cur.count : 0) + 1;

  if (cur) {
    db.prepare('UPDATE my_counts SET count = ? WHERE user_id = ?').run(next, user);
  } else {
    db.prepare('INSERT INTO my_counts (user_id, count) VALUES (?, ?)').run(user, next);
  }

  res.json({ code: 200, data: { count: next } });
});

module.exports = router;
```

### 6. 自检清单

提交到市场前逐项确认：

- [ ] `entry.js` / `style.css` 中**无** `const` / `let` / 箭头函数 / 模板字符串 / `?.` / `??` / `class`
- [ ] 无 flex `gap`，无 `:is()` / `:where()`，无 `aspect-ratio`
- [ ] 无直接 `new WebSocket(...)`，实时数据走 `context.data.realtime`
- [ ] 所有 `localStorage` 键带 `ci:app:my-app:` 前缀
- [ ] 所有颜色、圆角、动效使用 `--ci-*` 令牌，未写裸值
- [ ] 无 `transition: all`，无布局属性过渡，无从 `scale(0)` 起步
- [ ] 毛玻璃有 `[data-perf="low"]` 降级
- [ ] `context.app.onDestroy` 已回收监听器、定时器、实时订阅、DOM
- [ ] `manifest.json` 的 `capabilities` 与实际调用一致
- [ ] 卸载后 API 返回 JSON 404 而非 HTML

### 7. 自动化检查

仓库内提供静态审查脚本（见 [CLI 工具](./cli#市场应用审查)）：

```bash
pnpm review:market market-apps/my-app          # 动效、兼容、危险 API、资源回收
node scripts/market-review.mjs <dir> --json    # 机器可读输出
```

审查脚本按五组检查：manifest 合规 / Chrome 80 语法 / CSS 兼容 / 危险 API / 资源回收。**它不做运行时隔离**——只是在你提交前把常见问题标出来。存在错误时退出码为 1，可用于 CI 门禁。

---

## 下一步

- [SDK 参考](./sdk) — `context.*` 全部 API 签名
- [市场应用生命周期](./market-apps) — 安装、更新、卸载、班级管控
- [Chrome 80 兼容](./chrome-80-compat) — 完整的语法与 CSS 降级对照
- [主题开发](./themes) — 令牌体系与自定义主题
- [调试技巧](./debugging) — 前后端调试方法
