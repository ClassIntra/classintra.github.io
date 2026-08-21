---
layout: home

hero:
  name: ClassIntra
  text: 校园内网 WebOS
  tagline: 校园内网 WebOS 平台 · 类 iOS 设计 · 横屏平板优化
  actions:
    - theme: brand
      text: 🚀 快速开始
      link: /quick-start/
    - theme: alt
      text: 📦 安装部署
      link: /quick-start/installation
    - theme: alt
      text: 📖 使用指南
      link: /quick-start/basic-usage
    - theme: alt
      text: GitHub
      link: https://github.com/ClassIntra/ClassIntra

features:
  - icon: 🖥️
    title: 桌面系统
    details: 类 iOS 启动台，应用图标分页排列、壁纸切换、锁屏密码、通知中心（超能岛），专为横屏平板优化。
    link: /quick-start/basic-usage
    linkText: 基本使用 →
  - icon: 💬
    title: 即时通讯
    details: 公共聊天、班级群聊（自动建群）、私聊、表情、消息撤回、群公告，基于 WebSocket 实时通信。
    link: /concepts/websocket
    linkText: WebSocket 通信 →
  - icon: 🤖
    title: AI 对话
    details: OpenAI 兼容 / DeepSeek 双引擎，Tavily 联网搜索，LaTeX 数学公式渲染，支持子模型切换。
    link: /development/
    linkText: 开发指南 →
  - icon: 📝
    title: 社区论坛
    details: 发帖、评论、点赞、收藏、Markdown + LaTeX 渲染，签到、发帖获取经验与排行榜。
    link: /concepts/
    linkText: 核心概念 →
  - icon: 📁
    title: 资源仓库
    details: 文件浏览与搜索、PDF 在线预览、MKV/MP4 视频流播放（自研 ffmpeg 流式转码）、云盘与客上传。
    link: /deployment/
    linkText: 部署运维 →
  - icon: 🎵
    title: 音乐播放
    details: 在线播放列表、LRC 歌词同步、背景播放、超能岛快捷控制。
    link: /quick-start/basic-usage
    linkText: 基本使用 →
  - icon: 📒
    title: 笔记系统
    details: Markdown 编辑器、代码高亮、Mermaid 流程图、KaTeX 数学公式，前后端同步。
    link: /ui/
    linkText: UI & 主题 →
  - icon: ⚙️
    title: 管理后台
    details: 用户管理、广播通知、班干委任、应用管控（远程启用/禁用桌面应用）、操作日志。
    link: /concepts/app-control
    linkText: 应用管控 →
---

## 快速导航

| 板块 | 描述 | 链接 |
|------|------|------|
| 🚀 快速开始 | 安装、启动、基本使用 | [进入](/quick-start/) |
| 🧠 核心概念 | 架构、应用、Manifest、主题、WebSocket、认证 | [进入](/concepts/) |
| 🛠 开发指南 | 第三方应用开发、SDK、CLI、调试 | [进入](/development/) |
| 🚢 部署运维 | 生产部署、教育场景、配置项、监控 | [进入](/deployment/) |
| 📡 API 参考 | 服务端 API、前端 API、类型定义 | [进入](/api/) |
| 🎨 UI & 主题 | 组件库、主题定制、图标系统 | [进入](/ui/) |

## 为什么选择 ClassIntra？

ClassIntra 为班级教室场景而生 —— 一台服务器 + 一台平板 = 完整的班级数字平台。无需外网，局域网即可运行。基于 **Vue 2.7 + Vite 5** 构建，采用类 iOS 设计语言，专为横屏平板（960×600）优化，同时适配桌面浏览器。

### 核心优势

- **校园内网优先**：局域网即可运行，无需外网，数据不出校
- **横屏平板优化**：专为 960×600 横屏平板设计，触控优先，最小触摸区域 44px
- **类 iOS 设计**：自研 `ios/` 组件库，启动台、Dock 栏、超能岛通知中心
- **完整班级生态**：桌面系统、即时通讯、AI 对话、社区论坛、资源仓库、音乐、笔记、管理后台 8 大模块
- **跨班级联动**：WebSocket 中继实现多班级公共聊天室实时同步（支持 Tailscale 组网）
- **应用管控**：管理员/班干可远程启用或禁用桌面上的每个应用
- **Chrome 80 兼容**：通过 `@vitejs/plugin-legacy` 适配老旧教育终端
- **深色/浅色主题**：跟随系统自动切换或手动选择

### 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | Vue 2.7 + Vue Router 3 + Vuex 3 |
| **构建工具** | Vite 5 + `@vitejs/plugin-vue2` + `@vitejs/plugin-legacy` |
| **UI 风格** | 类 iOS 设计系统（自研 `ios/` 组件库） |
| **后端框架** | Express 4 |
| **数据库** | better-sqlite3（嵌入式，零配置） |
| **实时通信** | ws（WebSocket） |
| **认证** | JWT（jsonwebtoken + bcryptjs） |
| **Markdown** | marked + highlight.js + KaTeX + Mermaid |
| **视频** | 自研流式转码（ffmpeg + fragmented MP4）+ Video.js |
| **包管理** | pnpm workspace（monorepo） |

### 适用场景

- 🏫 **班级教室**：一台服务器 + 多台平板，构建班级数字平台
- 🖥️ **机房部署**：Chrome 80 老旧教育终端兼容，局域网运行
- 📱 **横屏平板**：960×600 横屏优化，触控优先
- 🎓 **校园内网**：无需外网，数据不出校，安全可控
- 🔗 **跨班级联动**：多班级公共聊天室实时同步，Tailscale 组网

## 快速开始

只需 4 步即可在本地启动 ClassIntra：

```bash
# 1. 克隆仓库
git clone https://github.com/ClassIntra/ClassIntra.git
cd ClassIntra

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env，至少设置 JWT_SECRET（必填，否则拒绝启动）

# 4. 启动开发服务器（前后端并行）
pnpm dev
```

启动后访问 <http://localhost:5001>，首次使用请访问 `/setup` 完成班级初始化。

::: tip 完整指南
详细安装步骤、环境变量、首次配置、常见问题请参考 [安装指南](/quick-start/installation)。
:::

## 获取帮助

- 📌 **[GitHub Issues](https://github.com/ClassIntra/ClassIntra/issues)** — 提交 Bug 报告或功能建议
- 💬 **[GitHub Discussions](https://github.com/ClassIntra/ClassIntra/discussions)** — 讨论与问答
- 📖 **[官方文档](/quick-start/)** — 完整使用与开发指南
- 🔧 **[部署文档](https://github.com/ClassIntra/ClassIntra/blob/main/DEPLOY.md)** — 多机中继、Tailscale 组网、HTTPS 配置

## 社区与贡献

ClassIntra 采用 **Vibe Coding** 开发模式：人类负责构思产品形态、交互体验与功能规划，AI 辅助完成编码实现、测试与文档。欢迎社区贡献：

1. Fork 仓库并创建特性分支：`git checkout -b feature/your-feature`
2. 遵循 Vue 2 Options API 与 ES2017 JavaScript 风格
3. 单引号、2 空格缩进、kebab-case 文件名
4. 提交信息使用 conventional commits（`feat:` / `fix:` / `docs:` / `refactor:`）
5. 发起 Pull Request 并关联 issue

::: info 许可证
ClassIntra 基于 [MIT 协议](https://github.com/ClassIntra/ClassIntra/blob/main/LICENSE) 开源，可自由使用、修改、分发。
:::
