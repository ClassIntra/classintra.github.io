---
title: UI & 主题
description: ClassIntra 校园内网 WebOS 的 UI 组件库、主题系统与图标系统总览。类 iOS 设计语言、横屏平板优化、双写策略的 CSS 变量驱动主题切换。
---

# UI & 主题

本章节介绍 ClassIntra 校园内网 WebOS 的 UI 组件库、主题系统与图标系统。ClassIntra 的 UI 层基于 **Vue 2.7 + CSS 变量驱动**，遵循「设计 Token → CSS 变量 → 组件消费」的链路，使主题切换可以在运行时即时生效，无需重新加载。

## 三大支柱

| 支柱 | 解决的问题 | 源码位置 |
|------|-----------|----------|
| **组件库**（`client/src/components/`） | 提供桌面、超能岛、GlobalSearch、ModalDialog 等开箱即用的 Vue 组件 | `client/src/components/*` |
| **主题系统**（`client/src/core/theme-engine.js`） | 通过 ThemeEngine 统一管理 token、运行时切换、扩展主题 | `client/src/core/theme-engine.js` + `themes/*` + `theme-extensions/*` |
| **图标系统**（`client/src/utils/icon-resolver.js` + `Resources/public/icons/`） | 自定义 SVG 图标库 + Font Awesome 兼容 | `Resources/public/icons/*` |

## 设计语言

ClassIntra 采用**类 iOS 设计语言**，专为横屏平板（960×600）优化，同时适配桌面浏览器：

- **触控优先**：最小触摸区域 44px（iOS HIG 标准）
- **类 iOS 启动台**：应用图标分页排列，底部 Dock 栏常驻
- **超能岛通知中心**：从屏幕边缘滑入的通知中心，包含通知面板、操作面板、历史面板
- **磨砂玻璃效果**：通过 `backdrop-filter: blur()` 实现半透明毛玻璃
- **圆角与阴影**：遵循 iOS 大圆角（`--ci-shape-lg`）与柔和阴影（`--ci-elevation-*`）
- **Chrome 80 兼容**：通过 `@vitejs/plugin-legacy` 适配老旧教育终端，对不支持 `backdrop-filter` 的浏览器降级为纯色背景

::: tip 横屏平板优化
所有布局均以 960×600 横屏为基础设计单位：
- 桌面图标网格默认 6 列 × 4 行（适配 960 宽度）
- Dock 栏常驻 4 个应用图标
- 超能岛默认高度 60vh，支持手势滑动展开/收起
:::

## 自研 iOS 组件库

ClassIntra 内置一套类 iOS 风格的组件库，位于 `client/src/components/ios/`：

| 组件 | 用途 |
|------|------|
| `IOSButton` | iOS 鷹摁按钮 |
| `IOSCard` | iOS 卡片容器 |
| `IOSList` / `IOSListItem` | iOS 列表（带分组、图标、披露指示器） |
| `IOSNavBar` | iOS 导航栏（标题 + 左右按钮） |
| `IOSSheet` | iOS 底部弹出表单 |
| `IOSearchBar` | iOS 搜索栏 |
| `IOSBadge` | iOS 数字徽章 |
| `IOSChip` | iOS 标签芯片 |
| `IOSSegmented` | iOS 分段控件 |
| `IOSSwitch` | iOS 开关 |
| `IOSToolbar` | iOS 工具栏 |

所有 iOS 组件都消费 `--ci-color-*` 与 `--ci-shape-*` CSS 变量，因此切换主题即对所有组件生效。

## 主题系统简介

ThemeEngine 是 ClassIntra 的主题核心，具备以下特性：

- **双写策略**：同时写入 `--ci-*` 新变量（inline style）与 `data-theme` 属性（触发旧 CSS 切换），向后兼容
- **CSS 变量驱动**：所有 token 展平为 `--ci-color-*` / `--ci-shape-*` / `--ci-motion-*` / `--ci-elevation-*` 注入 `document.documentElement`
- **运行时切换**：调用 `setTheme()` 立即生效，无需刷新
- **持久化**：用户选择自动保存到 `localStorage['theme']` 与服务端 `user_settings` 表
- **扩展主题**：通过 `theme-extensions/*/manifest.json` 加载第三方主题包，支持动态色注入
- **动画开关**：`setMotionEnabled` 控制全局动画，响应 `prefers-reduced-motion`

```javascript
import { getThemeEngine } from '@/core/theme-engine';

var engine = getThemeEngine();
engine.setTheme('dark');               // 切换主题
engine.setMotionEnabled(false);         // 关闭动画
engine.setDynamicColor('#FF6B6B');      // 动态色注入（扩展主题）
```

详见 [主题定制](./theme)。

## 组件库简介

`client/src/components/` 提供构建 WebOS 桌面体验所需的全部组件：

| 组件 | 描述 |
|------|------|
| `Desktop.vue` | 桌面系统（壁纸、网格页面、Dock、文件夹、分页） |
| `SuperIsland.vue` | 超能岛（通知面板、操作面板、历史面板） |
| `GlobalSearch.vue` | 全局搜索面板（Ctrl+K） |
| `ModalDialog.vue` | 模态对话框 |
| `ErrorBoundary.vue` | 错误边界 |
| `LoadingSkeleton.vue` | 加载骨架屏 |
| `AppIcon.vue` | 应用图标 |
| `UserAvatar.vue` | 用户头像 |
| `LockScreen.vue` | 锁屏界面 |
| `WeatherIcon.vue` | 天气图标 |
| `WeatherAnimation.vue` | 天气动画（粒子、雷电） |
| `EmojiPicker.vue` | 表情选择器 |
| `ConfirmDialog.vue` | 确认对话框 |
| `ImagePreview.vue` | 图片预览 |
| `RecordModal.vue` | 录制模态框 |
| `DrawCanvas.vue` | 绘图画布 |
| `DesktopFolder.vue` | 桌面文件夹 |
| `RainAlert.vue` | 降雨提醒 |
| `WarningCard.vue` | 警告卡片 |
| `LifeIndex.vue` / `AirQuality.vue` | 生活指数 / 空气质量 |

所有组件都通过消费 `--ci-*` CSS 变量来呈现视觉，因此切换主题即对所有组件生效。

详见 [组件库](./components)。

## 图标系统简介

ClassIntra 内置自定义 SVG 图标库（位于 `Resources/public/icons/`），并通过 `icon-resolver.js` 工具统一解析。同时兼容 Font Awesome class 与外部 URL。

```vue
<template>
  <!-- 1. 自定义 SVG（推荐） -->
  <img :src="resolveIcon('Chat.svg')" alt="聊天" />

  <!-- 2. Font Awesome class -->
  <i class="fa-solid fa-comment"></i>

  <!-- 3. URL 图片 -->
  <img src="https://example.com/icon.svg" alt="外部图标" />
</template>
```

应用 manifest 中的 `icon` 字段也使用同样的识别规则。应用图标规范为 **56×56px**，圆角使用 `--ci-shape-lg`。

详见 [图标系统](./icons)。

## 板块导航

| 板块 | 描述 |
|------|------|
| [组件库](./components) | 核心组件清单、桌面系统、超能岛、通用组件、各应用界面 |
| [主题定制](./theme) | ThemeEngine、Token 体系、双写策略、扩展主题开发 |
| [图标系统](./icons) | 自定义 SVG 库、Font Awesome 集成、应用图标规范 |

## 相关文档

- [核心概念 — 主题系统](/concepts/theme-system)：主题架构与初始化时机
- [核心概念 — 应用架构](/concepts/architecture)：组件加载与 manifest 注册
- [API 参考 — 前端 API](/api/client)：ThemeEngine 方法签名
- [API 参考 — 类型定义](/api/types)：ThemeTokens 结构
- [开发指南 — 第三方应用开发](/development/third-party)：在第三方应用中使用组件
