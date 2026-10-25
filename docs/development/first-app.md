---
title: 第一个应用：从零到上架
description: 第三方开发者保姆级教程。从安装环境、选择形态、生成脚手架、写第一个页面、加后端接口、调试自检，到发布到市场源并让班级服务器装上，每一步都有可复制的命令和预期结果。
outline: [2, 3]
---

# 第一个应用：从零到上架

这是一份**跟着做就能出结果**的教程：结束时你会有一个安装在自己班级服务器上、出现在同学桌面上的应用，
并且知道怎么改、怎么更新、怎么发布给别人用。

全程大约 30 分钟。每一步都写了**你会看到什么**，看不到就去查那一步的「出问题了」小节。

::: tip 先确认你要走哪条路
- 班里的服务器已经部署好、你只是想写个应用 → **本页**。
- 你手上已经有跑着的项目，想搬进来 → [存量项目迁入指南](/development/migration)。
- 想把包格式做给别的系统用 → [应用包格式开放规范](/development/package-spec)。
:::

## 第 0 步：准备环境（10 分钟）

你需要一台电脑（Windows / macOS / Linux 都行）和一个**你自己的**班级服务器或本地开发环境。

### 0.1 装 Node.js 和 pnpm

| 软件 | 版本要求 | 检查命令 |
|---|---|---|
| Node.js | 18 以上（推荐 20 LTS） | `node -v` |
| pnpm | 8 以上 | `pnpm -v` |

`node -v` 输出形如 `v20.11.0` 即成功。没有的话去 [nodejs.org](https://nodejs.org) 装 LTS 版；
pnpm 用 `npm install -g pnpm` 安装。

### 0.2 拿到 ClassIntra 主仓库

脚手架和自检脚本都在主仓库里，所以第一步一定是克隆它：

```bash
git clone https://github.com/ClassIntra/ClassIntra.git
cd ClassIntra
pnpm install
```

`pnpm install` 结束时会打印 `Done in xx s`。首次可能编译 `better-sqlite3`，慢一两分钟属正常。

### 0.3 确认脚手架能用

```bash
node scripts/create.mjs
```

不带参数会打印六类入口的用法：

```text
  node scripts/create.mjs app <name> [--label 显示名] [--with-backend] [--force]   市场应用（entry.js 微前端）
  node scripts/create.mjs site <name>                                             静态站点（iframe 零适配迁入）
  node scripts/create.mjs service <name> [--lang node|python]                    独立端口服务（任意语言进程托管）
  node scripts/create.mjs plugin <name> [--dir 目录]                              市场插件（纯后端热挂载）
  node scripts/create.mjs theme <id> [--type light|dark] [--dir 目录]              市场主题（纯数据 JSON）
  node scripts/create.mjs official-app <name> [...]                               官方应用（.vue 随主仓构建）
```

看到这段就说明环境好了。

## 第 1 步：选形态（2 分钟）

ClassIntra 的市场应用有**三种运行形态**，选错了后面会反复返工，所以先花两分钟对号入座：

| 你想要 | 选这个 | 前言 |
|---|---|---|
| 集成感强：跟随主题、有桌面小组件、能加全局悬浮层、用系统 SDK | **微前端**（`app`） | 写 `entry.js`，宿主在路由容器里加载 |
| 已有前端项目（Vue/React/原生都行），不想改动代码 | **静态站**（`site`） | 构建产物拷进去，同源 iframe 跑 |
| 有一个自己的服务要用（联机服务器、算法服务、任意语言的程序） | **独立端口服务**（`service`） | 主服务托管进程并反代 |
| 只是一些接口，不需要页面 | **插件**（`plugin`） | 后端热挂载 |

本教程走**微前端**——它能力最全，学会了另外两种是降级使用，很容易理解。

::: warning 重要认知：市场应用不参与主仓库构建
主仓库 `apps/` 下的是**官方应用**（`.vue`，跟着主仓一起 Vite 构建）。
你写的**市场应用**是运行时注入的原生 ES5 脚本，安装/更新/卸载都**不需要重启服务器**。
这就是为什么下面生成的代码里全是 `var` 和 `function`，别用 `const`、箭头函数、可选链。
:::

## 第 2 步：生成脚手架（1 分钟）

```bash
node scripts/create.mjs app hello-ci --label "你好 CI" --with-backend
```

约定：应用名必须是 kebab-case（小写字母 + 连字符），否则会报 `应用名非法（kebab-case）`。

生成位置默认在主仓库的 `market-apps/hello-ci/`（微前端应用默认生成在主仓，方便调试；
`--dir` 可改）。目录长这样：

```text
market-apps/hello-ci/
  manifest.json              # 应用清单，宿主靠它认识你的应用
  frontend/
    entry.js                 # 页面入口（mount/unmount 契约）
    style.css                # 样式（可选）
  backend/
    routes.js                # 后端路由（--with-backend 才有）
    cleanup.js               # 卸载清理钩子（有建表就必须实现）
  README.md
```

## 第 3 步：认识 manifest（3 分钟）

打开 `market-apps/hello-ci/manifest.json`，关键字段：

```json
{
  "name": "hello-ci",
  "type": "app",
  "version": "1.0.0",
  "label": "你好 CI",
  "frontend": { "route": "/hello-ci", "entry": "./frontend/entry.js", "style": "./frontend/style.css" },
  "backend": { "mountPath": "/api/hello-ci", "entry": "./backend/routes.js" },
  "sdk": "1",
  "category": "desktop",
  "visibleRoles": ["classAdmin", "admin", "officer", "student"]
}
```

三条硬校验，不满足会**直接拒装**：

1. `frontend.route` 必须 `/` 开头且不与已有应用重复；
2. `backend.mountPath` 必须 `/api/` 开头；
3. `visibleRoles` 只能取 `classAdmin` / `admin` / `officer` / `student`。

改完 manifest 想确认格式对不对：

```bash
node scripts/diag.js market hello-ci
```

输出以 `✓` 开头即为通过；有 `✗` 会直接告诉你是哪条规则。

## 第 4 步：写第一个页面（5 分钟）

打开 `frontend/entry.js`。核心就两个函数：`mount` 负责把界面塞进容器，`unmount` 负责收拾干净。

```js
(function () {
  var NAME = 'hello-ci';
  var timer = null;

  function mount(container, context) {
    // context 五大命名空间：ui / data / system / app / compat
    var user = context.system.user;
    container.innerHTML =
      '<div class="hello-root">' +
      '<h2>你好，' + (user ? user.net_name : '同学') + '</h2>' +
      '<p class="hello-time"></p>' +
      '</div>';

    var timeEl = container.querySelector('.hello-time');
    timer = setInterval(function () {
      timeEl.textContent = new Date().toLocaleTimeString('zh-CN');
    }, 1000);

    // 统一登记销毁动作，卸载时宿主自动执行
    context.app.onDestroy(function () {
      if (timer) { clearInterval(timer); timer = null; }
    });
  }

  function unmount(container) {
    container.innerHTML = '';
  }

  window.ClassIntraMarket.define({ name: NAME, mount: mount, unmount: unmount });
})();
```

配套 `frontend/style.css`：

```css
.hello-root { padding: 24px; font-family: -apple-system, "PingFang SC", sans-serif; }
.hello-root h2 { margin: 0 0 8px; font-size: 22px; color: var(--ci-color-text, #1c1c1e); }
.hello-time { font-size: 15px; color: var(--ci-color-text-secondary, #8e8e93); }
```

::: tip 用 `var(--ci-*)` 就自动跟随主题
宿主会把主题令牌注入成 CSS 变量。**不要写死颜色**，否则换主题时你的应用像块补丁。
可用令牌见 [主题开发](/development/themes)。
:::

## 第 5 步：加一个后端接口（3 分钟）

打开 `backend/routes.js`，脚手架已经给了骨架。写一个读当前登录用户的接口：

```js
var express = require('express');
var path = require('path');
var router = express.Router();

// 复用系统认证中间件（路径相对服务器工作目录解析）
var requireAuth = require(path.resolve(process.cwd(), 'src/middleware/auth')).requireAuth;

router.get('/me', requireAuth, function (req, res) {
  res.json({
    code: 200,
    data: { user_id: req.user.user_id, net_name: req.user.net_name, role: req.user.role }
  });
});

module.exports = router;
```

前端调用它（`context.data.api` 已自动带认证头）：

```js
context.data.api.get('/api/hello-ci/me').then(function (res) {
  console.log('当前用户：', res.data.net_name);
});
```

**如果你在这里建了表**，必须在 `backend/cleanup.js` 里删掉它，否则「卸载即无痕」这条承诺就破了：

```js
module.exports = function cleanup(ctx) {
  var path = require('path');
  var db = require(path.resolve(process.cwd(), 'src/utils/db'));
  db.prepare('DROP TABLE IF EXISTS hello_ci_records').run();
};
```

## 第 6 步：装到自己的服务器上看效果（5 分钟）

这一步需要**你自己的班级服务器正在运行**（还没部署？先去 [10 分钟部署上线](/deployment/beginner)）。

1. 打开管理端 → 应用市场 → 找到「本地源」区域；
2. 刷新目录，你应该能看到「你好 CI」；
3. 点安装；
4. 回到桌面，图标出现了；点开，能看到问候语和跳动的时钟。

看不到应用时按顺序排查：

| 现象 | 原因 | 处理 |
|---|---|---|
| 市场里没有你的应用 | 生成位置不在市场源目录 | 确认在 `<项目根>/../market/apps/hello-ci`，或设 `MARKET_LOCAL_DIR` 指向 `market-apps` 的父目录 |
| 市场页报 401 | 自 v1.3.0 起目录接口需要登录 | 用管理员账号登录后再进市场 |
| 装了但桌面没图标 | `category` 不是 `desktop` 或被管控禁用 | 检查 manifest 的 `category`；管理端应用管控里确认已启用 |
| 点开白屏 | 用了 Chrome 80 不支持的语法 | 跑 `node scripts/diag.js compat hello-ci` |

### 改完怎么生效？

```bash
# 前端改动：市场页点「更新」重装 → 浏览器硬刷新（Ctrl+Shift+R）
# 后端改动：需要重启服务器；开发期可开热重载
CLASSINTRA_HOT_RELOAD=1 pnpm start
```

## 第 7 步：自检（2 分钟）

发布之前跑这两个脚本，它们和安装时的校验器是同一套：

```bash
# 装前预检：manifest 规则 + 文件完整性 + 路由冲突
node scripts/diag.js market hello-ci

# Chrome 80 兼容体检：语法与 CSS 红线
node scripts/diag.js compat hello-ci
```

再人工过一遍这份清单：

- [ ] 没有 `const` / `let` / 箭头函数 / 可选链 / 模板字符串（Chrome 80 会直接白屏）
- [ ] 没有 `Element.replaceChildren()`（Chrome 86+）
- [ ] CSS 没用 `gap`（flex gap 需 84+）；毛玻璃用 `context.compat.has()` 探测后降级
- [ ] 所有 `setInterval` / `setTimeout` / 事件订阅都在 `onDestroy` 里清理
- [ ] 本地存储只走 `context.data.storage`（它会强制 `ci:app:<name>:` 前缀，卸载时才能清干净）
- [ ] 建了表就写了 `cleanup.js`
- [ ] 颜色用 `var(--ci-*)`，没写死

想看更细的运行时状态，浏览器控制台执行 `window.__ciDiagnostics()`；
管理员访问 `/dev/runtime` 还能看到你应用的实时资源占用。

## 第 8 步：发布给别人用（5 分钟）

市场源就是一个 Git 仓库，结构是：

```text
<市场仓库>/
  index.json                 # 目录：列出全部包
  index.json.sig             # 目录签名（可选但推荐）
  apps/hello-ci/...          # 你的应用
```

### 8.1 把包放进市场源

```bash
# 在 ClassIntra 主仓库根目录执行
node scripts/market-index-gen.mjs
```

它会扫描市场源，为每个包写入 `files` 清单和**逐文件 sha256** 到 `index.json`。
安装时服务端会逐文件比对哈希，不匹配就拒装——这层保护零配置默认生效。

### 8.2 签名（推荐）

```bash
node scripts/market-sign.mjs --genkey   # 第一次：生成 ed25519 密钥对
node scripts/market-sign.mjs            # 以后每次发布：签名 index.json → index.json.sig
```

::: warning 私钥纪律
私钥（`server/.market-signing-key.pem`）**绝不入仓**、绝不推到市场仓库。
部署端配置 `MARKET_SIGNING_PUBLIC_KEY`（PEM 文本或文件路径）后，Gitee / GitHub 源必须验签通过才可用。
轮换密钥时先发新公钥到部署端，再用新私钥重签目录。
:::

### 8.3 推送

```bash
cd <市场仓库>
git add apps/hello-ci index.json index.json.sig
git commit -m "feat(hello-ci): 首个版本"
git push
```

同学的班级服务器在市场页点「刷新目录」就能看到，点安装即可——**不需要重启服务器**。
若用 Gitee，建议顺手连上 Gitee 的 Webhook，更新会有提示。

### 8.4 版本更新

改完代码后：

1. 抬高 `manifest.json` 的 `version`（比如 `1.0.0` → `1.0.1`）；
2. 重新跑 `market-index-gen.mjs` 和 `market-sign.mjs`；
3. push；
4. 各班级在市场页看到更新提示后点「更新」。

已装用户的数据会保留，启用状态也保留。

## 常见问题

**Q1：应用装上后，别的班的同学看不到？**
市场安装是**每个班级服务器各自安装**的。要全班统一，让各班的班管都装一次；
或者把应用做成官方应用提 PR 进主仓库 `apps/`。

**Q2：我的应用需要 WebSocket 联机怎么办？**
独立端口服务形态的反代**仅支持 HTTP**，不支持 WS。联机类请用 `context.data.realtime`
（内部复用主站 WS 连接，无 WS 环境自动降级长轮询），见 [WebSocket 通信](/concepts/websocket)。

**Q3：能不能用 Vue/React 写？**
微前端形态不行（要原生 ES5）。用 Vue/React 的话走**静态站形态**：构建出 `dist/`，
`node scripts/create.mjs site my-app` 后把产物拷进 `frontend/`，同源 iframe 跑，
再加一行 `<script src="/ci-adapter.js">` 就能拿用户、主题和系统能力。

**Q4：应用打包多大算合理？**
默认限制：单应用 ≤300 文件、单文件 ≤15MB、总量 ≤80MB，可在部署端用
`MARKET_MAX_FILES` / `MARKET_MAX_FILE_MB` / `MARKET_MAX_TOTAL_MB` 调整。
大资源建议让部署者手动放到目标机，应用从 `CI_APP_DIR` 相对路径读取。

**Q5：卸载后数据真的没了吗？**
执行顺序是：`cleanup.js` → 清 `app_control` / `app_config` → 删目录 → 清客户端
`ci:app:<name>:*` 存储。只要你的表在 `cleanup.js` 里删了、本地数据走了 `context.data.storage`，
就是真正无痕。官方有探针脚本逐项断言这个行为（`scripts/market-lifecycle-probe.mjs`）。

## 下一步读什么

| 你想做 | 去哪 |
|---|---|
| 加桌面小组件、全局悬浮层 | [第三方应用开发](/development/third-party) |
| 查 `context` 的完整 API | [SDK 参考](/development/sdk) |
| 让界面和系统视觉一致 | [主题开发](/development/themes) / [UI 组件库](/ui/components) |
| 理解安装/更新/卸载全过程 | [市场应用生命周期](/development/market-apps) |
| 把已有项目搬进来 | [存量项目迁入指南](/development/migration) |
| 确保兼容班里的老平板 | [Chrome 80 兼容](/development/chrome-80-compat) |
