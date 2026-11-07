---
title: 第三方应用开发
description: ClassIntra 第三方应用开发指南。涵盖两条接入路线、三种运行形态（微前端/静态站/独立端口服务）、manifest.json 字段、entry/overlay/widgets 契约、Chrome 80 兼容红线、同页面运行时 context、设计令牌一致性、能力披露与卸载清理钩子。
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
`iframe` 沙箱会切断主题令牌继承、阻断 DOM 复用、并让「像系统原生应用一样」的观感无法实现。ClassIntra 选择信任开发者，用**契约 + 审查**替代**运行时隔离**（详见 [外部系统集成](/development/integration)）。
:::

> 官方应用（`apps/`）与市场应用（`market-apps/`）的差异：市场应用不参与 Vite 构建，前端是运行时注入的原生 ES5 脚本；生命周期完全由市场管理（安装/更新/卸载/启停均不重启服务器）。

---

## 三种运行形态

市场应用有**三种运行形态**，按项目性质选择：

| 形态 | 适用 | 前端 | 后端 |
|---|---|---|---|
| **微前端**（默认） | 深度集成：要小组件/悬浮层/跟随主题/SDK | `frontend/entry.js`（define 契约） | 可选 express router 挂 `/api/<name>` |
| **静态站** `frontend.static` | 存量项目零适配迁入（vite/webpack 的 dist 拷入即跑） | `frontend/index.html`（iframe 同源加载） | 无 |
| **独立端口服务** `backend.process` | 自带进程的服务（游戏联机服务器、算法服务等） | 任意（常配静态站做壳） | 独立进程，主服务托管 + 反代 |

微前端形态是本页主线（[前端入口](#前端入口-微前端形态)起步）。静态站与独立端口服务的契约分别见
[静态站形态](#静态站形态-存量项目迁入) 与 [独立端口服务形态](#独立端口服务形态)；
已有独立项目迁入的手把手步骤见 [存量项目迁入指南](/development/migration)。

::: tip 用脚手架生成，别手写
统一脚手架入口覆盖全部形态：

```bash
node scripts/create.mjs app my-app --label "我的应用" --with-backend   # 微前端应用
node scripts/create.mjs site my-app        # 静态站（存量前端项目迁入）
node scripts/create.mjs service my-svc     # 独立端口服务（--lang python 可选）
```

生成的模板已预置 ES5 语法、`--ci-*` 令牌消费与 `onDestroy` 回收契约，开箱即可通过审查（0 错误 0 警告）。
比从零手写少踩三类最常见的坑。详见 [CLI 工具 § 应用脚手架](./cli#应用脚手架)。
:::

---

## 目录结构

微前端形态的完整目录（可选文件按需取用）：

```text
my-app/
├── manifest.json              # 必填
├── icon.svg                   # 可选
├── frontend/
│   ├── entry.js               # 微前端形态必需（entry 契约，纯 ES5）
│   ├── index.html             # 静态站形态入口（frontend.static 指向它）
│   ├── style.css              # 可选
│   └── overlay.js             # 可选（全局悬浮层，见下文）
└── backend/
    ├── routes.js              # 可选，Express 路由（CommonJS，挂 /api/<name>）
    ├── server.js              # 独立端口服务形态入口（独立进程）
    └── cleanup.js             # 可选（卸载清理钩子，见生命周期章节）
```

命名规范：目录名与 `name` 字段用 kebab-case（`my-app`），路由路径同（`/my-app`、`/api/my-app`）。

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
| `Element.replaceChildren()` | `container.innerHTML = ''`（Chrome 86+，构建也不可转译） |

### 禁用 CSS

| 禁用 | 原因 | 替代 |
|---|---|---|
| flex `gap` | 需 Chrome 84+ | 子元素 `margin` |
| `:is()` / `:where()` | 需 Chrome 88+ | 展开选择器 |
| `aspect-ratio` | 需 Chrome 88+ | padding-top 百分比撑高 |
| 容器查询 `@container` | 需 Chrome 105+ | 用 `ResizeObserver` 或媒体查询 |
| `backdrop-filter` 重依赖 | 中低端设备掉帧 | 提供不透明降级（见令牌章节） |

完整的语法与 CSS 降级对照见 [Chrome 80 兼容](./chrome-80-compat)。

### 实时通道

**禁止直接用 WebSocket**。腾讯 X5/TBS 的长连接不可靠，会静默断开。

统一走 `context.data.realtime`（内部复用核心 WS 连接，X5/TBS/不支持时自动降级为 HTTP 长轮询）：

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
  "type": "app",
  "label": "我的应用",
  "version": "1.0.0",
  "sdk": "1",
  "icon": "./icon.svg",
  "color": "#5856D6",
  "category": "desktop",
  "order": 20,
  "visibleRoles": [],
  "capabilities": ["data.storage", "data.realtime", "ui.toast"],
  "layout": { "mode": "fullscreen" },
  "frontend": {
    "route": "/my-app",
    "entry": "./frontend/entry.js",
    "style": "./frontend/style.css",
    "overlay": "./frontend/overlay.js",
    "widgets": [
      { "id": "clock", "name": "时钟", "defaultSize": { "w": 2, "h": 1 } }
    ]
  },
  "backend": {
    "mountPath": "/api/my-app",
    "entry": "./backend/routes.js",
    "rateLimit": { "max": 120, "windowMs": 60000 }
  },
  "config": [
    { "key": "API_KEY", "label": "上游密钥", "type": "secret", "required": true }
  ]
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
| `frontend` | object | 见下 | — | 前端配置 |
| `backend` | object | 否 | — | 后端配置 |
| `config` | array | 否 | `[]` | 应用配置声明（班管在管理端填写，密钥类型不回显明文） |

### `frontend` 前端配置

| 字段 | 说明 |
|---|---|
| `route` | 应用路由，**必填**，以 `/` 开头且全局唯一 |
| `entry` | 微前端入口脚本。`static` 与 `entry` **至少其一** |
| `static` | 静态站首页（包内相对路径，形如 `./frontend/index.html`）。声明时 `entry` 可省 |
| `style` | 可选样式表 |
| `overlay` | 可选全局悬浮层脚本（见 [全局悬浮层](#全局悬浮层-overlay)） |
| `widgets` | 可选桌面小组件声明数组（见 [桌面小组件](#桌面小组件-可选)） |

### `backend` 后端配置

| 字段 | 说明 |
|---|---|
| `mountPath` | API 挂载点，以 `/api/` 开头且全局唯一 |
| `entry` | Express Router 文件（express 形态）；进程形态下仅作包完整性锚点 |
| `process` | 独立端口服务声明 `{ command?, entry, port }`，`port` 取 1024–65535（安装期探测冲突），见 [独立端口服务形态](#独立端口服务形态) |
| `rateLimit` | 可选限流 `{ max, windowMs }` |

### 硬校验（不满足直接拒装）

- `frontend.route` 以 `/` 开头；`static` 与 `entry` 至少其一；
- `backend.mountPath` 以 `/api/` 开头；
- `sdk` 主版本 ≤ 当前系统版本；
- `visibleRoles` 只能是 `classAdmin` / `admin` / `officer` / `student`；
- `layout.mode` 不在枚举中 → 拒装。

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
{ "visibleRoles": ["classAdmin", "officer"] }
```

合法值：`classAdmin`（班管）/ `admin`（系统管理员）/ `officer`（班干部）/ `student`（学生）。空数组或不写 = 全部可见。

::: warning 未知角色名会阻断安装
写错角色名（如 `"teacher"`）会导致应用对所有人不可见——所以在安装阶段就拦截。合法值只有上面四个。
:::

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

**这是披露，不是权限申请。** ClassIntra 默认不拦截能力调用，声明它只为了：

1. 安装前告诉班管「这个应用会用到什么」；
2. 市场审核的参考依据。

十六项已知能力（命名与 SDK 命名空间对齐）：

| 命名空间 | 能力 |
|---|---|
| 数据 | `data.storage` `data.realtime` `data.http` |
| 系统 | `system.notification` `system.clipboard` `system.share` `system.navigate` |
| 界面 | `ui.toast` `ui.modal` `ui.sheet` `ui.overlay` |
| 应用自身 | `app.config` `app.storage` |
| 设备 | `device.info` `device.filePicker` `device.camera` |

未知能力名不阻断安装（静态审查会提示「披露不准确」，帮你发现拼写错误）。

::: info 部署端可以把披露升级为拦截
部署者配置环境变量 `MARKET_RESTRICTED_CAPABILITIES`（逗号分隔，如 `"device.camera,data.http"`）后，
声明了受限能力的应用**直接拒装**——敏感能力从「披露」升级为「默认拒绝」，强度由部署者决定。
:::

---

## 前端入口（微前端形态）

市场前端入口是一个 IIFE，通过全局 SDK 注册。宿主在用户进入应用路由时加载：

```javascript
(function() {
  var timers = [];

  function mount(container, context) {
    container.innerHTML = '<div class="my-root">你好</div>';
    timers.push(setInterval(tick, 1000));

    // 卸载契约：一切订阅/计时器在此登记，卸载时自动执行
    context.app.onDestroy(function() {
      timers.forEach(clearInterval);
    });
  }

  function unmount(container) {
    container.innerHTML = '';
  }

  window.ClassIntraMarket.define({ name: 'my-app', mount: mount, unmount: unmount });
})();
```

### `context` 提供的能力

按**七个命名空间**分层：

| 命名空间 | 内容 |
|---|---|
| `context.appName` | 当前应用名 |
| `context.app` | `name` / `version` / `manifest` / `config`（读 manifest.config 声明的配置）、`onDestroy(fn)`（逆序执行）、`onPause(fn)` / `onResume(fn)`（前后台切换）、`log` / `warn` / `error`（带 `[app:<name>]` 前缀，便于问题归因） |
| `context.data` | `api` / `get` / `post`（自动附带登录态的 HTTP）、`realtime`（WS 优先，长轮询兜底）、`storage`（**强制** `ci:app:<name>:` 前缀的命名空间存储）、`store`（服务端 KV + 文件，跟账号走） |
| `context.system` | `user` / `isLoggedIn`、`router` / `route`、`theme`（主题引擎）、`getToken(name)`（读当前主题令牌）、`eventBus`（订阅自动归属 `market:<name>`，销毁时整批退订）、`toast`（`alert` / `confirm` / `prompt`）、`modal`、`navigate(location)`、`goDesktop()`（返回桌面）、`notify(title, body)`（通知）、`clipboard.write/read`（剪贴板）、`share(data)`（分享）、`setBadge(n)`（桌面角标）、`openApp(name, params)`（打开其他应用）、`registerSearchProvider(p)`（被全局搜索收录） |
| `context.device` | `info()`（平台/视口/DPR/UA/在线状态）、`filePicker(options)`（选文件，返回 `File[]`，取消返回空数组）、`camera(options)`（拍照，返回 `Blob`）、`recordAudio(options)`（录音，返回 `{ blob, duration, mimeType }`）、`recordVideo(options)`（录像，返回 `{ blob, duration, mimeType, hasAudio }`）、`vibrate(pattern)`（触觉反馈）、`network()`（在线/网络类型/带宽/延迟）、`screen()`（尺寸/DPR/横竖屏） |
| `context.theme` | `current`（当前主题 id）、`getToken(name)`、`subscribe(fn)`（返回取消函数，销毁时自动退订）；同时透传 `setTheme` / `toggleColorScheme` 等引擎方法 |
| `context.ui` | 预制 DOM 片段工厂：`button` / `card` / `list` / `badge` / `segmented` / `toggle` / `searchBar` / `emptyState` / `spinner` / `toast` / `sectionTitle` / `toolbar` / `navbar` / `sheet` / `el` |
| `context.compat` | `chromeVersion` / `isX5` / `isBelowBaseline`、`has('flex-gap')` 等能力探测——按探测结果降级而非按 UA 猜 |

::: tip 这五项现在是真实现，不是能力目录里的空声明
`notify` / `clipboard` / `share` / `filePicker` / `camera` 在早期版本只有声明没有实现，
照着 SDK 文档写会拿到 `undefined`。自 2026-10 起全部落地：
- `notify`：页面在前台走宿主 Toast，后台且已授权走系统通知；用户拒绝后自动回落，不反复弹权限
- `clipboard.read`：`navigator.clipboard` 不可用时**明确 reject**（浏览器限制，无法伪造）
- `share`：没有 Web Share 时复制内容到剪贴板并提示，不会假装成功
- `filePicker`：取消返回 `[]` 而不是 reject，省掉一条错误分支
- `camera`：需要 HTTPS 或 localhost；权限拒绝 / 无摄像头会给出中文原因
:::


::: tip 想在控制台里直接摸 context？
执行 `localStorage.setItem('ci:devtools', '1')` 后重进应用，控制台可用
`__ciLastContext`（最近创建）或 `__ciContexts['<app>']` 直接调 `data.store` / `compat.has()` / `ui.*` 验证行为。
验证完记得 `localStorage.removeItem('ci:devtools')`。默认关闭，不给普通用户多一个全局句柄。
:::

::: tip `context.ui.*` 返回的是 DOM 片段而非 Vue 组件
因为第三方不过构建，拿不到 `@vue/compiler`。UI 能力返回原生元素，你直接 `appendChild` 即可。这保证了零构建步骤。
:::

::: info 向后兼容层
context 顶层还挂着一组 v1 旧字段（`context.realtime` / `context.router` / `context.theme` / `context.toast` / `context.modal` / `context.user` / `context.eventBus` 等），保证既有第三方应用不失效。**新代码请统一走命名空间**。
:::

全部 API 签名见 [SDK 参考 § 运行时 context](./sdk#运行时-context)。

### 数据存储必须走命名空间

`localStorage` 是共享的。所有键名**必须**加 `ci:app:<name>:` 前缀——`context.data.storage` 已强制加前缀，只用它存本地数据：

```javascript
// 正确：storage 自动加 ci:app:my-app: 前缀
context.data.storage.setItem('settings', JSON.stringify(cfg));

// 错误：裸写 localStorage 会污染宿主与其他应用，且卸载时清不到
localStorage.setItem('settings', JSON.stringify(cfg));
```

运行时会在卸载时清理你的命名空间。用别的前缀，数据会残留。

---

## 桌面小组件（可选）

在 manifest 的 `frontend.widgets[]` 声明（`id` / `name` / `description` / `defaultSize` / `minSize` / `maxSize` / `configSchema` / `permission`），并在 entry.js 的定义对象上提供渲染入口：

```javascript
window.ClassIntraMarket.define({
  name: NAME,
  mount: mount,          // 页面入口
  unmount: unmount,
  widgets: {             // 每个声明的小组件一个渲染器
    clock: {
      mount: function(el, config, context) { /* 往 el 里渲染，config 来自桌面配置 */ },
      unmount: function(el) { /* 清理计时器与 DOM */ }
    }
  }
});
```

- 用户在「桌面设置 → 小组件」里看到的名字是 `应用名 · 组件名`，添加后走桌面网格布局
- `configSchema` 与官方小组件同一套（select/text/bool/number 四类字段，桌面自动生成配置弹窗），字段定义见 [小组件开发](./widgets)
- 应用停用/卸载后，桌面布局里的该组件引用会被自动清理
- 注意：manifest 里 widgets 的 `component` 字段对市场应用**无效**（不参与构建），渲染入口只认 entry.js 的 `widgets`

---

## 全局悬浮层（overlay）

需要「桌宠」「倒计时浮窗」这类**任意页面都存在**的悬浮 UI 时，声明 `"frontend": { "overlay": "./frontend/overlay.js" }` + 能力披露 `ui.overlay`：

- 应用处于**已安装且启用**状态时，宿主在**任意页面**加载 overlay.js 并挂载到 `document.body` 下的全屏容器（`position:fixed; inset:0; pointer-events:none; z-index:9400`——低于超能岛 10000 / 模态 10001 / Toast 99997 / 锁屏 99999，不遮挡页面其余交互）
- 应用根元素**必须自带 `pointer-events:auto`** 才能接收点击
- 注册方式与 entry.js 同构：`window.ClassIntraMarket.defineOverlay({ name, mount, unmount })`；`mount(container, context)` 同样拿到五大命名空间 context
- 挂载/摘除/更新由宿主随市场清单自动同步（安装、卸载、启停、版本更新），**应用不要自己操纵 container 的存在性**
- 悬浮层应尊重性能与场景：`document.hidden` 时停帧；锁屏会自然盖住它
- 用户没「激活」你的悬浮功能时，`mount` 里可以什么都不渲染——零足迹是美德

---

## 生命周期与回收契约

同页面模型下，**卸载干净**是硬性要求。宿主不会替你兜底内存泄漏带来的卡顿。

### 必须回收的四类资源

| 资源 | 回收方式 |
|---|---|
| 事件监听 | `removeEventListener`（或用 `context.app.onDestroy` 统一清理） |
| 定时器 | `clearInterval` / `clearTimeout` |
| 实时订阅 | `context.data.realtime.subscribe()` 返回的取消函数 |
| DOM 节点 | `container.innerHTML = ''` 或移除自建节点 |

### `context.app.onDestroy`

注册卸载回调，按**注册的逆序**执行：

```javascript
context.app.onDestroy(function () { clearInterval(timer); });
context.app.onDestroy(function () { removeEventListener('resize', onResize); });
```

### eventBus 订阅自动归属

`context.system.eventBus` 的订阅被强制归属 `market:<name>`。即使你忘了退订，context 销毁时也会按归属**整批退订**——但这是兜底，不是许可，仍请显式退订。

### 运行时审计（开发期辅助）

开发模式下，运行时会审计你创建的计时器与监听器：卸载/挂起时自动回收；超阈值（默认 timers > 120 / listeners > 80）自动挂起应用。`window.__ciDiagnostics()` 可随时查看内核与市场状态。**上线前请把审计残留清零。**

### 卸载清理钩子（cleanup.js）

卸载时、删除应用目录之前，宿主执行 `backend/cleanup.js`（若存在）：

```javascript
// backend/cleanup.js —— 卸载即无痕的样板
var path = require('path');
var db = require(path.resolve(process.cwd(), 'src/utils/db'));
module.exports = function cleanup(ctx) {
  // ctx = { name, manifest }
  db.prepare('DROP TABLE IF EXISTS my_app_items').run();
  db.prepare("DELETE FROM user_kv_store WHERE key LIKE 'my-app:%'").run();
};
```

- 钩子**失败会中止卸载**（文件与记录都在，修复后可重试）——所以钩子里只做清理，别做有风险的写操作
- 你的后端（routes.js）自建了哪些表、写了哪些 kv，cleanup.js 就要清哪些——**这是市场应用的信誉分**

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

## 图标满铺规范

**硬性规范：图标资产不留白**——内容顶格铺满 100% 画布，圆角由 AppIcon 容器 CSS 统一裁切（72px + radius 20px + object-fit cover），**绝不在资产里烘焙圆角或透明边距**。

桌面图标容器按 72px + 20px 圆角裁切。若 SVG 根 `<rect>` 自带 `rx`，且其比例小于容器裁切比例（例如 116/512 ≈ 0.227 < 20/72 ≈ 0.278），四角会露出透明月牙缝隙，桌面上看就是「图标旁边有留白」：

```xml
<!-- 错误：根 rect 烘焙圆角，四角透明缝隙露出桌面背景 -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="116" fill="..."/>
</svg>

<!-- 正确：根 rect 直角满铺，圆角交给容器 CSS 裁切 -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="..."/>
</svg>
```

要点：

- **内部装饰元素**的 `rx` 不受限制（圆角小卡片等），禁的是**根 rect / 根画布层**
- manifest 的 `icon: './icon.svg'` 相对路径自动重写为 `/market-static/<name>/...`（官方应用为 `/apps-static/<name>/...`），改图标无需构建
- 存量位图去留白：`.\scripts\icon-trim.ps1`（检测 alpha 包围盒 → 裁剪 → 重采样回满画布，支持 PNG 与内嵌 base64 位图的 SVG，见 [CLI 工具](./cli#图标满铺体检-icon-trim)）
- 提交注意 500KB 单文件上限：大位图内嵌前先降采样（如 768/512px HighQualityBicubic 重编码）

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

### 数据库与清理配套

建表写在 routes.js 顶部（`CREATE TABLE IF NOT EXISTS`），**并配套 `backend/cleanup.js`**（见[生命周期与回收契约](#生命周期与回收契约)）——卸载即无痕是平台承诺，也是你的义务。

### 卸载后的行为

应用卸载后，其 API 返回 **JSON 404**，而不是前端 `index.html`。不要指望前端路由能兜住。

---

## 静态站形态（存量项目迁入）

已有 vite / webpack / 原生前端项目，想**零适配**跑进 ClassIntra——用静态站形态：

```json
{ "frontend": { "route": "/my-app", "static": "./frontend/index.html" } }
```

（声明 `static` 时 `entry` 可省。）把你项目的构建产物整个拷进 `frontend/`，宿主以**同源 iframe** 加载 `/market-static/<name>/...`：

- 直接 `fetch('/api/...')` 调主服务 API；登录 token 在 `localStorage.getItem('token')`（同源共享）
- 无需任何代码适配；Chrome 80 兼容红线**不适用**（那是你自己的构建产物，按你自己的目标浏览器来）
- 主题令牌在 iframe 内不可见——要跟随主题请加一行 `<script src="/ci-adapter.js"></script>`（`CI.theme()` / `CI.onTheme()` / `CI.user()` / `CI.back()` / `CI.toast()`），或升级到微前端形态

手把手步骤、CI 适配器用法与框架/语言矩阵见 [存量项目迁入指南](/development/migration)。

---

## 独立端口服务形态

自带进程的服务（游戏联机服务器、算法服务等、非 Node 语言实现）用进程形态。manifest：

```json
{
  "backend": {
    "mountPath": "/api/my-svc",
    "entry": "./backend/server.js",
    "process": { "entry": "./backend/server.js", "port": 41234 }
  }
}
```

主服务负责：

- **spawn 托管**：注入 `PORT` / `CI_APP_NAME` / `CI_APP_DIR` 环境变量；崩溃线性退避自动重启（上限 5 次，间隔 3s × 次数）
- **反代**：`/api/<name>/*` → `127.0.0.1:<port>`（仅 HTTP；WebSocket 暂不支持——联机类走 HTTP 轮询）
- **启停联动**：应用停用/卸载自动终止进程树（Windows `taskkill /T`）；重启服务器自动拉起
- **端口治理**：安装期探测端口冲突（已装应用声明冲突 / 系统占用都拒装）；只应绑定 `127.0.0.1`

你的服务端唯一要改的一行：读环境变量 `PORT` 并只绑 `127.0.0.1`：

```javascript
server.listen(Number(process.env.PORT || 41234), '127.0.0.1', function () { /* ... */ });
```

`process.command` 是任意启动命令，Python / Go / Java / Rust 均可——宿主运行时由部署者预装、依赖随包分发等注意事项见 [存量项目迁入指南 § 框架 / 语言 / 规模矩阵](/development/migration#框架--语言--规模矩阵)。

---

## 内置数据源（静态文件读取）

并非所有数据都落在 SQLite。部分系统应用直接读取仓库内的**静态数据文件**——改文件即改内容，
无需改代码、无需迁移。要复用同一份数据（例如给课程表做扩展视图），先认清**文件在哪、字段怎么命名**。

### 课程表：`Resources/public/kb.yml`

| 项 | 说明 |
| --- | --- |
| 位置 | 仓库根 `Resources/public/kb.yml`（服务端经 `config.resourcesDir` + `/public/kb.yml` 解析，随静态资源下发） |
| 读取 | `apps/timetable/backend/routes.js` **每次请求都重新读盘解析**（不缓存，保证实时）；使用为该文件定制的 YAML 子集解析器，而非通用 YAML 库 |
| 接口 | `GET /api/timetable`（需登录）→ `{ code, data: { version, subjects, schedules, holidays, adjustments } }` |

```yaml
version: 1
subjects:              # 学科字典
- name: 语文            # 全名（图例、下拉框显示）
  simplified_name: 语    # 单字简称（课表格子内显示）
  teacher: ''          # 任课教师（默认空串）
  room: ''             # 上课地点（默认空串）
schedules:             # 课表本体
- name: 标准课表1
  enable_day: 1        # 1=周一 … 7=周日
  weeks: all           # all / odd / even（单双周）
  classes:
  - subject: 早读       # 必须与某个 subjects[].name 完全一致
    start_time: '06:50:00'
    end_time: '07:33:00'
holidays: []           # { date, name }
adjustments: []        # { date, as_day, weeks, note }
```

字段命名约定（**新增展示前请先对齐**）：

| 字段 | 含义 | 当前使用位置 |
| --- | --- | --- |
| `subjects[].name` | 学科全名 | 图例、编辑下拉、筛选 |
| `subjects[].simplified_name` | 单字简称 | 课表格子（空间有限时） |
| `subjects[].teacher` | 任课教师 | 默认空串，前端暂未渲染 |
| `subjects[].room` | 上课地点 | 默认空串，前端暂未渲染 |
| `schedules[].classes[].subject` | 引用学科名 | 必须与某个 `subjects[].name` 完全一致，否则单元格显示原始字符串 |

::: tip 想展示「谁在哪上课」
`teacher` / `room` 目前是空串——前端只渲染 `simplified_name`。
先在 `kb.yml` 里把这两列填上，再让前端读取对应字段即可；**无需改后端**（`GET /api/timetable` 已原样返回整个 `subjects`）。
:::

---

## 开发循环与自检

### 开发循环速查

```bash
# 方式 A（推荐，外部开发者）：独立工具链，不需要克隆主仓
npx classintra-devkit create app <name> [--label 显示名] [--with-backend]
npx classintra-devkit check .            # manifest + Chrome 80 + 资源回收
npx classintra-devkit pack . --write <market>/index.json

# 方式 B（平台维护者）：在主仓内开发
# 微前端应用骨架默认生成在主仓 market-apps/<name>/（--dir 可换位置）；
# site / service / plugin / theme 直接生成在本地市场源（默认 <项目根>/../market，MARKET_LOCAL_DIR 可覆盖）
node scripts/create.mjs app <name> [--label 显示名] [--with-backend]

# 本地源开发循环：改代码 → 管理端市场 → 更新（重装）→ 前端硬刷新（/market-static 为 no-cache 直出）
node scripts/build-app.js <name> --watch   # lint + 直出检查，文件变化自动重跑
node scripts/diag.js market <name>         # 装前预检（与安装时同一校验器 + 文件完整性 + 路由冲突）
node scripts/diag.js compat <name>         # Chrome 80 兼容 lint（语法 + CSS）
pnpm review:market market-apps/<name>      # 静态审查五组检查（错误即退出码 1）
node scripts/market-lifecycle-probe.mjs    # 生命周期回归探针（需本地服务器运行中）
```

`classintra-devkit` 是零依赖的独立包，生成物与主仓脚手架同契约（ES5、令牌、`onDestroy`、`cleanup.js`），
`pack` 产出的 `files`/`hashes` 与安装期校验完全一致。详见 [Devkit 工具链](#devkit-工具链)。

调试工具一览：浏览器控制台 `window.__ciDiagnostics()`（内核/市场状态一站式输出）、管理员打开 `/dev/runtime`（运行时检查器）、服务端日志 `[proc:<name>]` 前缀（独立进程输出）。更多手段见 [调试技巧](./debugging)。

### Devkit 工具链

外部开发者不必克隆主仓。`classintra-devkit` 提供三个命令：

| 命令 | 作用 |
|---|---|
| `create app\|site\|service\|plugin\|theme` | 生成开箱即过体检的最小包 |
| `check [dir]` | manifest + Chrome 80 语法 + 危险 API + 资源回收 + 包体限制；`--json` 可接 CI |
| `pack [dir] --write index.json` | 生成文件清单与逐文件 sha256，直接合并进市场目录（保留截图/更新日志） |

它拦的正是「装不上」和「装上白屏」两类问题，因此可以直接当发布前的 CI 门禁。

### 云端数据（context.data.store）

`storage` 是本机缓存（卸载即清、不跨设备）；`store` 是**服务端数据**，按 (应用, 用户) 隔离：

```javascript
// KV：值可以是字符串或任意可 JSON 序列化的对象
context.data.store.set('settings', { theme: 'dark' }).then(function () {});
context.data.store.get('settings').then(function (v) { /* 不存在时返回 null */ });
context.data.store.all().then(function (map) {});     // 一次取回全部
context.data.store.remove('settings');

// 文件（≤5MB/个，≤50 个/人）
context.data.store.uploadBlob('avatar.png', file).then(function (meta) {});
context.data.store.getBlobUrl('avatar.png').then(function (url) {
  img.src = url;   // 用完不必手动 revoke，context 销毁时会统一释放
});
```

限额：单值 64KB、500 键/人/应用。数据**不随卸载删除**（用户重装后还在）；要彻底清理由 `backend/cleanup.js` 显式处理：

```javascript
// backend/cleanup.js
module.exports = function (ctx) {
  ctx.appData.usage();        // { keys, blobs, blobBytes }：先看看占了多少
  ctx.appData.purge();        // 删除本应用全部 KV 与文件
  // 其它自建表照旧 DROP
};
```
需要声明能力 `data.store`（安装页会显示「云端数据」）。

### 深度链接（带参数直达应用）

对标 iOS URL Scheme / Android App Links：把 `/<应用路由>?参数` 发给同学，点开就进到对应界面。

```javascript
// 1) 生成当前界面的链接并分享出去
var link = location.origin + context.system.route.fullPath +
  (context.system.route.fullPath.indexOf('?') === -1 ? '?' : '&') + 'room=' + roomId;
context.system.share({ title: '来一局', text: '房间号 ' + roomId, url: link });

// 2) 目标侧读取参数（刷新、分享、后退都不丢）
var room = context.system.route.query.room;
```

- **未登录访问会先跳登录页，登录成功后自动回到原目标**（含参数），不会退化成「登录后到桌面」。
- 只接受站内相对路径作为回跳目标，`//evil.com` 这类外站地址不会被采纳。
- 停用的应用无法被链接唤起（跳转前会经过应用管控检查）。

### 接收分享（shareTarget）

对标 Android 的 Share Target / iOS 的 Share Extension：让你的应用出现在系统分享面板里。

**1. 声明**（`manifest.json`）：

```json
{
  "capabilities": ["system.shareTarget"],
  "shareTarget": {
    "title": "存到我的笔记",
    "accept": ["text", "url"]
  }
}
```

**2. 接收**（应用内）：

```javascript
var off = context.app.onShare(function (data) {
  // data = { title, text, url, from }
  saveNote({ title: data.title, body: data.text, url: data.url });
});
// 应用被卸载时回调自动失效；也可主动 off()
```

**3. 发出**（别的应用）：

```javascript
context.system.share({ title: '看看这个', text: '...', url: '...' });
// 有系统分享面板 → 走系统；否则弹宿主面板，列出所有声明了 shareTarget 的应用
```

规则：

- 分享内容走 URL query：`ci_share_title` / `ci_share_text` / `ci_share_url` / `ci_share_from`，**可分享、刷新不丢**；应用收到后参数即从地址栏清除，不会重复触发。
- 若这次启动本就是被分享唤起的，`onShare()` 注册时会**立刻补发一次**，应用不必自己去读 URL。
- 发起方不会出现在自己的候选列表里（不会「分享给自己」）。
- 停用的应用不出现在分享面板里。

### 运行时权限（敏感能力授权）

能力披露（`manifest.capabilities`）只是「装前告知」。相机、麦克风、通知、剪贴板读取还要在**首次真正调用时**由使用者点一次「允许」：

| 能力 | 触发点 | 用户拒绝后的行为 |
|---|---|---|
| `device.camera` | `device.camera()` | reject（应用需降级） |
| `device.microphone` | `device.recordAudio()` | reject |
| `system.notification` | `system.notify()` | **不 reject**，降级为前台 Toast，返回 `{ denied: true }` |
| `system.clipboard.read` | `system.clipboard.read()` | reject（浏览器不支持时先 reject，不弹无用窗） |

```javascript
// 不需要自己画授权界面：SDK 会在首次调用时弹系统级授权层
context.device.recordAudio({ maxDuration: 60 }).then(function (rec) {
  // rec = { blob, duration, mimeType }
  return context.data.store.uploadBlob('homework.webm', rec.blob);
}).catch(function (err) {
  // 用户拒绝 / 没有麦克风 / 浏览器不支持 → 给出可操作提示，别静默失败
  context.ui.toast({ text: err.message, variant: 'error' });
});
```

规则：

- 授权按 **（应用 × 用户）** 记在服务端，换设备登录不必重新点。
- 应用必须在 `manifest.capabilities` 声明对应能力，否则服务端拒绝记录（400）——「没声明却来要」不成立。
- 声明 `system.clipboard` 即覆盖 `system.clipboard.read`（父能力覆盖）。
- 班管在市场页 **已安装 → 权限** 能看到谁授予了什么，可逐条或整应用撤销；撤销后应用下次调用会重新弹窗。
- **卸载不删授权记录**：用户重装后不必再点一遍。
- 浏览器原生权限（站点级）仍存在，但宿主这层是**按应用**的——同源下 A 应用拿到相机，不会让 B 应用静默拥有。

### 媒体采集（拍照 / 录音 / 录像）

三者都自带界面并负责清理（`track.stop()`），应用不必自己画相机 UI，也不会漏关麦克风。

```javascript
context.device.camera({ facingMode: 'environment' }).then(function (blob) { /* 照片 */ });

context.device.recordAudio({ maxDuration: 120 }).then(function (rec) {
  // rec = { blob, duration, mimeType }；底部录音条，可停止 / 取消
});

context.device.recordVideo({ audio: true, maxDuration: 60 }).then(function (rec) {
  // rec = { blob, duration, mimeType, hasAudio }；带预览窗口
});
```

- `maxDuration` 上限：录音 600s（默认 120s），录像 300s（默认 60s），到点自动停。
- 需要 `HTTPS` 或 `localhost`，否则浏览器不给设备权限。
- 需要的 manifest 能力：拍照/录像 `device.camera`；录音 `device.microphone`（录像带声音时两项都要）。

### 系统级操作（角标 / 打开应用 / 搜索收录 / 生命周期）

对标 iOS 的 `UIApplicationIconBadgeNumber`、URL Scheme，以及 Android 的 `BadgeDrawable`、`Intent`、App Search：

```javascript
// 1) 桌面角标：数字、'●' 或空（清除）。写 localStorage，刷新后仍在。
context.system.setBadge(3);
context.system.setBadge('');     // 清除

// 2) 打开别的应用并带参数（目标应用用 context.system.route.query 读取）
context.system.openApp('gomoku', { room: 'A12', from: 'pet' })
  .then(function (ok) { if (!ok) console.warn('目标应用不可用'); });

// 3) 让应用内容被全局搜索检索（不接也能被搜到应用本身）
var off = context.system.registerSearchProvider({
  id: 'notes',
  category: '我的笔记',
  search: function (query) {
    return myNotes.filter(function (n) { return n.title.indexOf(query) !== -1; })
      .slice(0, 5)
      .map(function (n) {
        return {
          id: n.id,
          title: n.title,
          description: n.summary,
          action: function () { openNote(n.id); }
        };
      });
  }
});
// 卸载 / 销毁时自动失效；也可主动 off()

// 4) 前后台生命周期（对应 viewWillDisappear / onPause）
context.app.onPause(function () { saveDraft(); });
context.app.onResume(function () { refresh(); });
```

说明：

- **应用本身**安装后即被全局搜索收录（按名称/显示名匹配），不需要任何代码。
- 搜索 provider 每次至多返回 10 条，标题会被截断到 80 字；`action` 缺省时点击无动作。
- `openApp` 的参数走 URL query（可分享、刷新不丢）；复杂对象会被 JSON 序列化。
- 停用的应用无法被打开或搜到；`canDisable: false` 的受保护应用不受影响。
- 这三项需要在 manifest 声明能力：`system.badge` / `system.openApp` / `system.search`（安装页会展示）。

### 定时任务（backend.jobs）

应用可以把自己的周期性工作交给宿主，而不是自己 `setInterval`（重启即丢、错过不补）：

```json
{
  "backend": {
    "mountPath": "/api/my-app",
    "entry": "./backend/routes.js",
    "jobs": [
      { "name": "daily-digest", "daily": "07:30", "handler": "./backend/jobs/digest.js" },
      { "name": "poll", "every": "5m", "handler": "./backend/jobs/poll.js" }
    ]
  }
}
```

```javascript
// backend/jobs/digest.js
module.exports = function (ctx) {
  ctx.log('开始生成日报');            // 日志前缀 [job:my-app/daily-digest]
  return doWork(ctx.appName);          // 返回 Promise 即视为异步任务
};
```

语义：`every` 最小 60 秒（重启重新计时）；`daily` 为服务器本地时间，启动时若「今天已过点且没跑过」会补跑一次；同一任务不重叠；执行结果写入 `app_jobs`，管理端 `GET /api/market/app-jobs` 可查。
多实例共库时用 `app_jobs.locked_until` 抢占，同一时刻只有一个实例会执行（锁 5 分钟自动过期）。

### 订阅业务事件（进程内）

应用/插件后端想对「新公告、有人发帖、自己被动停用」做反应，不必轮询数据库：

```javascript
var bus = require(require('path').resolve(process.cwd(), 'src/core/app-events'));

var off = bus.on('announcement.published', function (payload) {
  // payload: { id, title, type, author_id }
}, 'my-app');   // 第三个参数是归属，卸载时按它整批退订
```

可用事件与出站 Webhook 一致（见 [服务端 API § 出站 Webhook](/api/server#出站-webhook-事件推送)）。

### 应用健康度（本地可观测）

第三方最怕的不是报错，是**不知道有没有人在用、有没有崩**。平台在班级服务器本地提供最小闭环：

- 应用打开时前端上报一次心跳（`POST /api/market/app-usage`），记录人数与次数
- 运行期异常按应用归因：控制台打 `[app:<name>]` 前缀，并上报 `POST /api/market/app-error`（每会话每应用最多 5 条，服务端每小时上限 500 条）
- 管理端市场页的「已安装」列表展示：使用人数/次数、错误总数/24h 错误数
- 管理员可查 `GET /api/market/app-health`

::: info 为什么没有「全局安装量」
ClassIntra 是自托管模型：每个班级服务器各装各的。没有中心服务器，也就不存在跨校聚合的下载量。
健康数据是**本班视角**的——这比一个好看但虚构的排行更有用。
:::


market-apps 前端是**直出**：没有构建步骤，保存后刷新浏览器即生效；兼容性靠 [diag compat](./cli#校验器-diag) 与 `review:market` 把关，图标走 [图标满铺规范](#图标满铺规范)。

### 发布与上架

本地验证通过后，发布到市场源（`index.json` 生成、逐文件 sha256、ed25519 签名、推送）的完整流程见
[市场应用生命周期 § 发布到市场源](./market-apps#发布到市场源)；双仓同步（市场维护者）命令见
[CLI 工具 § 市场双仓同步](./cli#市场双仓同步-sync-market-市场维护者)。

### 自检清单

提交到市场前逐项确认：

- [ ] `entry.js` / `style.css` 中**无** `const` / `let` / 箭头函数 / 模板字符串 / `?.` / `??` / `class` / `replaceChildren`
- [ ] 无 flex `gap`，无 `:is()` / `:where()`，无 `aspect-ratio`
- [ ] 无直接 `new WebSocket(...)`，实时数据走 `context.data.realtime`
- [ ] 所有本地存储只经 `context.data.storage`（前缀强制，卸载才能清干净）
- [ ] 所有颜色、圆角、动效使用 `--ci-*` 令牌，未写裸值
- [ ] 无 `transition: all`，无布局属性过渡，无从 `scale(0)` 起步
- [ ] 毛玻璃有 `[data-perf="low"]` 降级
- [ ] `context.app.onDestroy` 已回收监听器、定时器、实时订阅、DOM
- [ ] 自建表 / 键值对有 `backend/cleanup.js` 对应清理
- [ ] `manifest.json` 的 `capabilities` 与实际调用一致
- [ ] 卸载后 API 返回 JSON 404 而非 HTML

### 安装与生命周期速览

用户不需要克隆市场仓库。班级服务器读取市场源 catalog（`GET /api/market/catalog`，自 v1.3.0 起需登录），校验后**原子替换**运行时目录并热挂载后端，全程不重启服务。启用/停用是班级统一状态，班管修改后广播同步到所有客户端。

安装、更新、卸载的完整流程、班级管控与「谁负责清什么」的生命周期表，见 [市场应用生命周期](./market-apps)。

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
    ├── routes.js
    └── cleanup.js
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
      context.data.storage.setItem('count', String(count));

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
    container.innerHTML = '';
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

### 6. `backend/cleanup.js`

```javascript
/* 卸载即无痕：与 routes.js 自建的数据一一对应 */
var path = require('path');
var db = require(path.resolve(process.cwd(), 'src/utils/db'));

module.exports = function cleanup(ctx) {
  db.prepare('DROP TABLE IF EXISTS my_counts').run();
  db.prepare("DELETE FROM user_kv_store WHERE key LIKE 'my-app:%'").run();
};
```

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
- [市场应用生命周期](./market-apps) — 安装、更新、卸载、班级管控、发布到市场源
- [应用包格式开放规范](./package-spec) — 包格式与运行时契约的规范全文
- [存量项目迁入指南](./migration) — 已有独立项目的四条迁入路径
- [Chrome 80 兼容](./chrome-80-compat) — 完整的语法与 CSS 降级对照
- [主题开发](./themes) — 令牌体系与自定义主题
- [调试技巧](./debugging) — 前后端调试方法
