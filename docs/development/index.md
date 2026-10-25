---
title: 开发指南
description: ClassIntra 开发文档总入口。按受众分三组：应用开发（写第三方应用/插件/主题/小组件）、市场与生态（发布上架与对外集成）、平台开发（改主仓库本身）。本页同时是平台开发概述，含开发环境、项目结构、工作流与代码风格。
---

# 开发指南

ClassIntra 的开发文档按**你要做什么**分成三组，先对号入座，再往下读。

## 应用开发 —— 写应用、插件、主题、小组件

给 ClassIntra **写东西**的人。不需要改主仓库，产物通常以市场包分发。

| 页面 | 什么时候看 |
|---|---|
| [第一个应用：从零到上架](/development/first-app) | **第一次写应用，从这篇开始** —— 30 分钟走完脚手架到发布 |
| [第三方应用开发](/development/third-party) | 主线参考：三种形态、manifest、entry/overlay/widgets 契约 |
| [存量项目迁入指南](/development/migration) | 手上已有项目，想搬进 ClassIntra |
| [小组件开发](/development/widgets) | 做桌面网格里的信息卡片 |
| [插件开发](/development/plugins) | 只做后端、没有页面的扩展 |
| [主题开发](/development/themes) | 做主题包（纯数据 JSON） |
| [SDK 参考](/development/sdk) | 查 `context.*` 全部 API 签名 |
| [Chrome 80 兼容](/development/chrome-80-compat) | 目标设备是老内核平板，必读 |
| [调试技巧](/development/debugging) | 排查问题 |

## 市场与生态 —— 发布上架、对外集成

应用写完之后怎么发布，以及 ClassIntra **与外部系统**怎么对接。

| 页面 | 什么时候看 |
|---|---|
| [市场应用生命周期](/development/market-apps) | 发布到市场源、安装/更新/卸载、完整性签名 |
| [应用包格式开放规范](/development/package-spec) | 包格式契约全文（给宿主实现者与生态工具作者） |
| [外部系统集成](/development/integration) | postMessage + webhook 双向集成协议 |
| [AstrBot 机器人接入](/development/astrbot) | 接一个机器人同学进来 |
| [CampusBili 集成](/development/campusbili-integration) | 内嵌 CampusBili |
| [Cluss 集成](/development/cluss-integration) | Cluss 旁挂系统的四条集成通道 |
| [联机五子棋开发](/development/gomoku-online) | 联机类应用的实时事件实践 |
| [网易云音乐插件](/development/netease-music) | 内网环境下接外部曲库的范例 |

## 平台开发 —— 改 ClassIntra 主仓库本身

贡献内核、改官方应用、动构建与工具链。**只写第三方应用的话，这一组可以跳过。**

| 页面 | 什么时候看 |
|---|---|
| 平台开发概述（本页） | 开发环境、项目结构、工作流、代码风格 |
| [CLI 工具](/development/cli) | pnpm 脚本、PM2、版本管理与迁移工具 |
| [web-proxy 兼容模式](/development/web-proxy) | 超能岛浏览器的服务端无头渲染插件 |

---

# 平台开发概述

以下内容面向**改主仓库**的开发者：介绍项目结构、开发环境、工作流与代码风格约定。
首次接触 ClassIntra 建议先看 [核心概念 - 架构概览](/concepts/)。

## 开发环境要求

| 工具 | 最低版本 | 推荐版本 | 用途 |
|------|---------|---------|------|
| **Node.js** | 18.0.0 | 18 LTS / 20 LTS | 前后端运行时 |
| **pnpm** | 8.0.0 | 8.15+ / 9.x | monorepo 包管理 |
| **Git** | 2.20+ | 最新版 | 版本管理 |
| **VS Code** | 最新版 | 最新版 | 推荐 IDE |
| **Vue DevTools** | 6+ | 最新版 | Vue 调试（兼容 Vue 2.7） |
| **Chrome** | 80+ | 100+ | 浏览器调试 |

### VS Code 推荐插件

| 插件 | 用途 |
|------|------|
| **Vetur** | Vue 2 文件支持（不要用 Volar） |
| **ESLint** | 代码检查 |
| **Prettier** | 代码格式化 |
| **Better Comments** | 代码注释高亮 |
| **SQLite Viewer** | 数据库文件查看 |

::: tip 项目已带配置
项目根目录 `.vscode/settings.json` 已配置编辑器推荐设置，克隆后 VS Code 会自动应用。
:::

## 项目结构概览

ClassIntra 是 pnpm monorepo，主要 workspace 如下：

```
ClassIntra/
├── apps/                    # 应用（前端页面 + 可选后端 + 小组件）
│   ├── admin/               # 管理后台
│   ├── calendar/            # 日历
│   ├── calculator/          # 计算器
│   ├── chat/                # 聊天
│   ├── community/           # 社区
│   ├── countdown/           # 倒计时
│   ├── integration/         # 集成管理后台
│   ├── music/               # 音乐
│   ├── profile/             # 个人主页
│   ├── resource/            # 资源仓库 + 云盘
│   ├── settings/            # 设置
│   ├── timetable/           # 课表
│   ├── weather/             # 天气
│   ├── package.json         # apps workspace 元信息
│   └── .gitkeep
├── client/                  # Vue 2.7 前端（桌面、登录、路由、Vuex）
│   ├── src/
│   │   ├── components/      # 通用组件 + iOS 风格组件库
│   │   ├── core/            # 核心服务（ServiceRegistry、EventBus、ThemeEngine 等）
│   │   ├── integrations/    # 集成层
│   │   ├── mixins/          # 通用 mixin
│   │   ├── router/          # 路由聚合
│   │   ├── store/           # Vuex 状态管理
│   │   ├── styles/          # 全局样式
│   │   ├── utils/           # 工具函数（API、缓存、富文本等）
│   │   ├── views/           # 页面视图
│   │   ├── App.vue
│   │   └── main.js
│   ├── public/              # 静态资源
│   ├── scripts/prebuild.js  # 构建前递增版本
│   ├── index.html
│   ├── package.json
│   └── vite.config.mjs
├── server/                  # Node.js + Express 后端
│   ├── src/
│   │   ├── config/          # 配置加载
│   │   ├── core/            # 应用加载、清单解析、生命周期
│   │   ├── integrations/    # Webhook 接收、Token 管理
│   │   ├── middleware/      # 鉴权、限流
│   │   ├── migrations/       # 数据库迁移
│   │   ├── routes/          # API 路由（system、auth、user、admin 等）
│   │   ├── services/        # 天气、转码、中继总线等
│   │   ├── utils/           # JWT、DB、密码、Relay 等
│   │   ├── ws/              # WebSocket 服务
│   │   ├── app.js           # HTTP 入口
│   │   └── app-https.js     # HTTPS 入口
│   ├── config/
│   │   └── pre-records.example.json   # 预注册名单模板
│   ├── public/              # 静态资源 + setup.html
│   ├── scripts/             # 工具脚本（证书生成、迁移）
│   ├── .env.example         # 环境变量模板
│   └── package.json
├── shared/                  # 前后端共享层
│   └── src/
│       ├── constants.js     # 常量
│       ├── errors.js        # 错误码
│       ├── manifest-schema.js    # manifest 校验
│       └── theme-tokens.js       # 主题 Token
├── plugins/                 # 插件运行时目录（源码维护于 market 仓库，如 campusbili-bridge）
├── theme-extensions/        # 主题扩展（material-you）
├── themes/                  # 内置主题（dark / light）
├── Resources/               # 用户管理的静态资源
│   ├── photos/              # 照片
│   ├── cloud/               # 云盘文件
│   ├── public/icons/        # 应用图标
│   └── wallpaper/           # 壁纸
├── docs/                    # 项目内文档（独立于 ClassIntra_docs）
├── .npmrc                   # build_from_source=false
├── pnpm-workspace.yaml      # workspace 声明
├── ecosystem.config.js      # PM2 配置
├── build.bat                # Windows 构建脚本
├── start.sh                 # Linux 启动脚本
├── start.bat / start-prod.bat  # Windows 启动脚本
└── package.json
```

### 核心 workspace

| Workspace | 路径 | 说明 |
|-----------|------|------|
| `server` | `server/` | 后端，Express + better-sqlite3 + ws |
| `client` | `client/` | 前端，Vue 2.7 + Vite 5 + Vuex |
| `apps/*` | `apps/` | 应用包，每个应用一个目录 |
| `plugins/*` | `plugins/` | 插件包（运行时目录，源码在 market 仓库） |
| `shared` | `shared/` | 前后端共享代码 |

::: tip workspace 链接
`pnpm install` 会自动建立 workspace 内部链接。例如 `apps/weather` 引用 `shared/src/constants.js` 时，直接 `require('../../../shared/src/constants')` 即可，无需发布。
:::

## 开发工作流

### 分支策略

ClassIntra 采用简化版 Git Flow：

| 分支 | 用途 | 命名规范 |
|------|------|----------|
| `main` | 稳定发布分支 | 固定 |
| `dev` | 开发集成分支 | 固定 |
| `feature/*` | 功能分支 | `feature/message-recall` |
| `fix/*` | 修复分支 | `fix/websocket-reconnect` |
| `hotfix/*` | 紧急修复 | `hotfix/jwt-leak` |

```bash
# 开始新功能
git checkout dev
git pull
git checkout -b feature/my-feature

# 开发完成
git add -A
git commit -m "feat: 添加 XXX 功能"
git push origin feature/my-feature

# 创建 PR 到 dev
```

::: tip 项目自带快捷命令
项目 `.gitconfig` 提供了快捷命令（详见 [GIT-WORKFLOW.md](https://github.com/ClassIntra/ClassIntra/blob/main/GIT-WORKFLOW.md)）：
- `git save` —— 自动提交全部文件，带时间戳
- `git undo` —— 软回滚（保留文件）
- `git hard-undo` —— 硬回滚（完全丢弃）
- `git snap` —— 临时快照到 stash
- `git health` —— 代码检查
:::

### 提交规范

ClassIntra 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

| type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(chat): 添加消息撤回` |
| `fix` | 修复 | `fix(ws): 修复断线重连` |
| `docs` | 文档 | `docs: 更新部署指南` |
| `style` | 格式 | `style: 统一缩进` |
| `refactor` | 重构 | `refactor(auth): 提取 JWT 工具` |
| `perf` | 性能 | `perf(db): 添加索引` |
| `test` | 测试 | `test: 添加单元测试` |
| `chore` | 杂项 | `chore: 升级依赖` |
| `build` | 构建 | `build: 优化 Vite 配置` |
| `ci` | CI | `ci: 添加 GitHub Actions` |
| `revert` | 回滚 | `revert: 撤销 PR #123` |

::: warning 提交检查
- subject 行 ≤ 50 字符，使用中文或英文均可
- body 解释 **为什么** 而非 **是什么**（代码已说明是什么）
- 涉及 breaking change 必须在 footer 标注 `BREAKING CHANGE:`
- 一次提交只做一件事，避免「大杂烩」提交
:::

### 开发循环

```bash
# 1. 拉取最新代码
git checkout dev && git pull

# 2. 创建功能分支
git checkout -b feature/my-feature

# 3. 启动开发服务器
pnpm dev
# 后端 → http://localhost:9001
# 前端 → http://localhost:20001

# 4. 编码、调试、自测

# 5. 构建验证
pnpm build

# 6. 提交
git add -A
git commit -m "feat(my-app): 添加 XXX 功能"

# 7. 推送并创建 PR
git push origin feature/my-feature
```

## 代码风格约定

ClassIntra 有严格的代码风格约定，**所有新代码必须遵守**。

### Chrome 80 兼容

ClassIntra 必须兼容 Chrome 80+（教育终端常见版本），详见 [Chrome 80 兼容](./chrome-80-compat)。

| 类别 | 禁用 | 替代 |
|------|------|------|
| 可选链 | `?.` | `obj && obj.prop` |
| 空值合并 | `??` | `\|\|` 配合显式 null 检查 |
| 逻辑赋值 | `??=` / `\|\|=` / `&&=` | 显式赋值 |
| 类字段 | `class { x = 1 }` | 构造函数中 `this.x = 1` |
| 私有字段 | `#field` | 命名约定 `_field` |
| 顶层 await | 顶层 `await` | IIFE 或 module.exports 包装 |

### 项目风格约定

与 Chrome 80 无关，但项目强制要求：

| 类别 | 约定 | 示例 |
|------|------|------|
| 变量声明 | `var`（禁用 `let` / `const`） | `var count = 0;` |
| 函数 | `function`（禁用箭头函数 `=>`） | `function add(a, b) { ... }` |
| 字符串 | 单引号 `'...'`（禁用模板字符串） | `'Hello ' + name` |
| 类 | 构造函数 + prototype（禁用 `class`） | `function Foo() {}` + `Foo.prototype.bar = ...` |
| 缩进 | 2 空格 | `if (x) {\n  y();\n}` |
| 分号 | 行尾分号 | `var x = 1;` |
| Vue 组件 | Options API（禁用 Composition API） | `export default { data: function() { ... } }` |

### 正确示例

```javascript
// ✅ 正确
var self = this;
var items = data.list || [];
for (var i = 0; i < items.length; i++) {
  var item = items[i];
  if (item && item.id) {
    self.process(item.id);
  }
}

function processData(input) {
  return input ? input.toUpperCase() : '';
}

module.exports = processData;
```

```vue
<!-- ✅ 正确：Options API -->
<template>
  <div class="my-component">
    <p>{{ message }}</p>
  </div>
</template>

<script>
export default {
  name: 'MyComponent',
  props: {
    title: { type: String, default: '' }
  },
  data: function() {
    return {
      message: 'Hello'
    };
  },
  methods: {
    handleClick: function() {
      var self = this;
      api.get('/api/data').then(function(res) {
        self.message = res.data.data.message;
      });
    }
  },
  mounted: function() {
    console.log('mounted');
  }
};
</script>
```

### 错误示例

```javascript
// ❌ 错误：使用 let / const
const x = 1;
let y = 2;

// ❌ 错误：箭头函数
const add = (a, b) => a + b;

// ❌ 错误：模板字符串
const greeting = `Hello ${name}`;

// ❌ 错误：可选链
const id = user?.id;

// ❌ 错误：class 字段
class Foo {
  x = 1;
}

// ❌ 错误：私有字段
class Bar {
  #secret = 42;
}
```

::: warning 后端代码
后端运行在 Node.js（不受 Chrome 80 约束），但**同样遵守项目代码风格约定**（`var` / 单引号 / `function` / 2 空格缩进）。
例外：可以安全使用 Node.js 内置的现代 API（如 `crypto.timingSafeEqual`、Node 18+ 的 `fetch`）。
:::

### Vue 2.7 注意事项

ClassIntra 使用 Vue 2.7（最后一个 Vue 2 版本），支持 Composition API 但**项目禁用**：

| 特性 | Vue 2.7 支持 | 项目约定 |
|------|-------------|----------|
| Options API | ✅ | ✅ **必须使用** |
| Composition API (`setup`) | ✅ | ❌ 禁用 |
| `<script setup>` | ✅ | ❌ 禁用 |
| `defineComponent` | ✅ | ❌ 禁用 |

::: tip Vue DevTools 版本
调试 Vue 2.7 需使用 [Vue DevTools 6+](https://devtools.vuejs.org/)，不要使用 Vue 3 版本（7+）。
:::

## 下一步

- [第三方应用开发](./third-party) - 完整应用开发指南（含计数器完整示例）
- [小组件开发](./widgets) - 桌面小组件、configSchema 配置表单
- [插件开发](./plugins) - 联动插件、通信契约与握手协议
- [主题开发](./themes) - 内置主题与扩展主题、动态色彩
- [SDK 参考](./sdk) - 前后端核心 API
- [CLI 工具](./cli) - 命令行参考
- [调试技巧](./debugging) - 前后端调试方法
- [核心概念 - 架构概览](/concepts/) - 整体架构
- [Chrome 80 兼容](./chrome-80-compat) - 兼容性完整文档
