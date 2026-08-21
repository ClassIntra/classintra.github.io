---
title: 组件库
description: ClassIntra 组件库参考：桌面系统、超能岛、GlobalSearch、ModalDialog、ErrorBoundary、LoadingSkeleton 等核心组件清单、Props 表与使用示例。
outline: [2, 3]
---

# 组件库

ClassIntra 的组件库位于 `client/src/components/`，提供构建桌面体验所需的全部组件。所有组件都消费 `--ci-color-*` / `--ci-shape-*` / `--ci-motion-*` / `--ci-elevation-*` CSS 变量，因此切换主题即对所有组件即时生效。

## 引入方式

ClassIntra 组件为单文件 Vue 2.7 组件，通过相对路径或 `@/components/*` 别名引入：

```vue
<script>
import GlobalSearch from '@/components/GlobalSearch.vue';
import ModalDialog from '@/components/ModalDialog.vue';

export default {
  components: { GlobalSearch, ModalDialog }
};
</script>
```

::: tip 别名
`@` 别名指向 `client/src/`，在 `vite.config.mjs` 中配置。生产构建时所有组件按需引入，无额外配置。
:::

## 组件清单

### 核心组件列表

| 组件 | 路径 | 用途 | 关键 Props |
|------|------|------|-----------|
| `Desktop.vue` | `views/Desktop.vue` | 桌面系统主入口 | `wallpaper`、`apps`、`currentPage` |
| `SuperIsland.vue` | `components/SuperIsland.vue` | 超能岛通知中心 | `notifications`、`expanded` |
| `GlobalSearch.vue` | `components/GlobalSearch.vue` | 全局搜索面板 | `visible` |
| `ModalDialog.vue` | `components/ModalDialog.vue` | 模态对话框 | `visible`、`title`、`type` |
| `ErrorBoundary.vue` | `components/ErrorBoundary.vue` | 错误边界 | — |
| `LoadingSkeleton.vue` | `components/LoadingSkeleton.vue` | 加载骨架屏 | `rows`、`avatar` |
| `AppIcon.vue` | `components/AppIcon.vue` | 应用图标 | `app`、`size` |
| `UserAvatar.vue` | `components/UserAvatar.vue` | 用户头像 | `user`、`size` |
| `LockScreen.vue` | `components/LockScreen.vue` | 锁屏界面 | `locked` |
| `WeatherIcon.vue` | `components/WeatherIcon.vue` | 天气图标 | `code`、`isDay` |
| `WeatherAnimation.vue` | `components/WeatherAnimation.vue` | 天气动画 | `type`、`intensity` |
| `EmojiPicker.vue` | `components/EmojiPicker.vue` | 表情选择器 | `visible` |
| `ConfirmDialog.vue` | `components/ConfirmDialog.vue` | 确认对话框 | `title`、`message` |
| `ImagePreview.vue` | `components/ImagePreview.vue` | 图片预览 | `src`、`visible` |
| `RecordModal.vue` | `components/RecordModal.vue` | 录制模态框 | `visible`、`type` |
| `DrawCanvas.vue` | `components/DrawCanvas.vue` | 绘图画布 | `width`、`height` |
| `DesktopFolder.vue` | `components/DesktopFolder.vue` | 桌面文件夹 | `folder`、`apps` |
| `RainAlert.vue` | `components/RainAlert.vue` | 降雨提醒 | `data` |
| `WarningCard.vue` | `components/WarningCard.vue` | 警告卡片 | `level`、`message` |
| `LifeIndex.vue` | `components/LifeIndex.vue` | 生活指数 | `data` |
| `AirQuality.vue` | `components/AirQuality.vue` | 空气质量 | `aqi`、`pm25` |

### iOS 组件库

源码：`client/src/components/ios/`

| 组件 | 用途 |
|------|------|
| `IOSButton` | iOS 风格按钮（含触摸反馈） |
| `IOSCard` | iOS 卡片容器 |
| `IOSList` / `IOSListItem` | iOS 列表 |
| `IOSNavBar` | iOS 导航栏 |
| `IOSSheet` | iOS 底部弹出表单 |
| `IOSearchBar` | iOS 搜索栏 |
| `IOSBadge` | iOS 数字徽章 |
| `IOSChip` | iOS 标签芯片 |
| `IOSSegmented` | iOS 分段控件 |
| `IOSSwitch` | iOS 开关 |
| `IOSToolbar` | iOS 工具栏 |

## 桌面系统组件

### Desktop.vue — 桌面系统

源码：`client/src/views/Desktop.vue`

桌面系统主入口，集成壁纸、应用图标网格、Dock 栏、文件夹、分页等核心能力。

```vue
<template>
  <Desktop
    :wallpaper="currentWallpaper"
    :apps="enabledApps"
    :current-page="currentPage"
    @page-change="onPageChange"
    @app-launch="onAppLaunch"
  />
</template>
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `wallpaper` | `string \| object` | `'default'` | 壁纸 ID 或壁纸对象 |
| `apps` | `Array<App>` | `[]` | 应用列表（仅显示 `enabled` 的） |
| `currentPage` | `number` | `0` | 当前页码（0 起） |

| Event | Payload | 说明 |
|-------|---------|------|
| `page-change` | `number` | 翻页时触发 |
| `app-launch` | `App` | 应用图标被点击时触发 |

**功能模块**：

- **壁纸切换**：通过 Vuex `desktop` 模块管理，调用 `/api/assets/wallpapers` 获取列表
- **网格页面**：每页默认 6×4 网格，超出自动分页，左右滑动切换
- **Dock 栏**：底部常驻 4 个应用图标，从 `apps` 中按 `order` 排序前 4 个
- **文件夹**：`DesktopFolder.vue` 子组件，支持应用分组与展开/收起
- **分页指示器**：底部小圆点，反映当前页与总页数

::: tip 横屏优化
桌面网格默认 6 列 × 4 行，专为 960×600 横屏平板设计。在小屏设备上会自动降级为 4×3 或 5×3。
:::

### DesktopFolder.vue — 桌面文件夹

源码：`client/src/components/DesktopFolder.vue`

```vue
<template>
  <DesktopFolder
    :folder="folderData"
    :apps="folderApps"
    @app-launch="onLaunch"
  />
</template>
```

| Prop | 类型 | 说明 |
|------|------|------|
| `folder` | `object` | 文件夹信息（`id`、`name`） |
| `apps` | `Array<App>` | 文件夹内应用列表 |

### AppIcon.vue — 应用图标

源码：`client/src/components/AppIcon.vue`

```vue
<template>
  <AppIcon :app="appData" :size="56" @launch="onLaunch" />
</template>
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `app` | `App` | — | 应用对象（含 `icon`、`label`、`color`） |
| `size` | `number` | `56` | 图标尺寸（px），符合应用图标规范 |

| Event | Payload | 说明 |
|-------|---------|------|
| `launch` | `App` | 点击应用图标时触发 |

::: warning 应用图标规范
应用图标固定为 **56×56px**，圆角使用 `--ci-shape-lg`（28px）。`AppIcon` 内部通过 `icon-resolver.js` 解析 `app.icon`，支持 SVG、Font Awesome、URL 三种模式。详见 [图标系统](./icons)。
:::

## 超能岛组件

### SuperIsland.vue — 超能岛

源码：`client/src/components/SuperIsland.vue`

从屏幕边缘滑入的通知中心，集成通知面板、操作面板、历史面板三个 Tab。

```vue
<template>
  <SuperIsland
    :notifications="notifications"
    :expanded="isExpanded"
    @expand="onExpand"
    @collapse="onCollapse"
    @notification-click="onNotifClick"
  />
</template>
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `notifications` | `Array<Notification>` | `[]` | 通知列表 |
| `expanded` | `boolean` | `false` | 是否展开 |

| Event | Payload | 说明 |
|-------|---------|------|
| `expand` | — | 展开时触发 |
| `collapse` | — | 收起时触发 |
| `notification-click` | `Notification` | 通知项被点击时触发 |

**三大面板**：

- **通知面板**：聚合所有未读通知，按时间倒序排列，支持点击跳转与滑动删除
- **操作面板**：快捷操作（亮度、音量、WiFi、蓝牙、勿扰模式等）
- **历史面板**：已读通知历史，支持清空

::: tip 手势支持
超能岛支持以下手势（通过 `mixins/island-gestures.js` 实现）：
- 从屏幕顶部下滑：展开
- 从展开状态上滑：收起
- 左右滑动：切换面板
:::

## 通用组件

### GlobalSearch.vue — 全局搜索

源码：`client/src/components/GlobalSearch.vue`

类似 macOS Spotlight 的全局搜索面板，通过 `Ctrl+K` 唤起。

```vue
<template>
  <GlobalSearch :visible="searchVisible" @close="searchVisible = false" />
</template>
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `visible` | `boolean` | `false` | 是否显示 |

| Event | Payload | 说明 |
|-------|---------|------|
| `close` | — | 关闭时触发（ESC 或点击遮罩） |

**功能**：

- **命令模式**：无需输入关键词，直接列出所有已注册命令（来自 `SearchRegistry.registerCommand`）
- **搜索模式**：输入关键词后，聚合所有已注册 Provider 的结果（来自 `SearchRegistry.registerProvider`）
- **键盘导航**：上下箭头切换选中项，回车执行，ESC 关闭

::: tip 注册搜索来源
通过 `SearchRegistry` 注册命令与搜索 Provider，详见 [前端 API — SearchRegistry](/api/client#searchregistry)。
:::

### ModalDialog.vue — 模态对话框

源码：`client/src/components/ModalDialog.vue`

通用模态对话框，支持 `alert` / `confirm` / `prompt` / `custom` 四种模式。

```vue
<template>
  <ModalDialog
    :visible="visible"
    title="确认操作"
    type="confirm"
    @confirm="onConfirm"
    @cancel="onCancel"
  >
    <p>确定要执行此操作吗？</p>
  </ModalDialog>
</template>
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `visible` | `boolean` | `false` | 是否显示 |
| `title` | `string` | `''` | 标题 |
| `type` | `'alert' \| 'confirm' \| 'prompt' \| 'custom'` | `'alert'` | 对话框类型 |
| `defaultValue` | `string` | `''` | `prompt` 模式默认值 |
| `okText` | `string` | `'确定'` | 确认按钮文字 |
| `cancelText` | `string` | `'取消'` | 取消按钮文字 |

| Event | Payload | 说明 |
|-------|---------|------|
| `confirm` | `string \| undefined` | 确认时触发（`prompt` 模式携带输入值） |
| `cancel` | — | 取消时触发 |

::: tip 焦点陷阱
`ModalDialog` 内置焦点陷阱：Tab 键只能在对话框内部循环，避免背景元素被聚焦。ESC 键触发取消。
:::

### ErrorBoundary.vue — 错误边界

源码：`client/src/components/ErrorBoundary.vue`

捕获子组件渲染异常，展示友好错误提示，避免整个页面崩溃。

```vue
<template>
  <ErrorBoundary>
    <MyComponent />
  </ErrorBoundary>
</template>
```

| Slot | 说明 |
|------|------|
| default | 正常渲染内容 |
| `fallback` | 异常时展示的回退内容（可选） |

```vue
<template>
  <ErrorBoundary>
    <WeatherWidget />
    <template #fallback="{ error, retry }">
      <div class="error-card">
        <p>加载失败：{{ error.message }}</p>
        <button @click="retry">重试</button>
      </div>
    </template>
  </ErrorBoundary>
</template>
```

| Slot Prop | 类型 | 说明 |
|-----------|------|------|
| `error` | `Error` | 捕获的异常对象 |
| `retry` | `() => void` | 重试函数（清空错误状态） |

::: warning 异步错误
`ErrorBoundary` 仅捕获子组件**渲染期间**的同步异常（如 `render` 函数抛错、生命周期同步错误）。异步错误（Promise rejection、事件回调异常）不会被捕获，请业务代码内部 `try/catch`。
:::

### LoadingSkeleton.vue — 加载骨架屏

源码：`client/src/components/LoadingSkeleton.vue`

数据加载期间展示的占位骨架，模拟最终内容的形状。

```vue
<template>
  <LoadingSkeleton :rows="3" :avatar="true" />
</template>
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `rows` | `number` | `3` | 骨架行数 |
| `avatar` | `boolean` | `false` | 是否展示头像骨架 |
| `width` | `string` | `'100%'` | 整体宽度 |

骨架使用 `--ci-color-surface-raised` 作为底色，通过 `--ci-motion-*` 控制脉冲动画。

## 应用界面组件

ClassIntra 各应用的前端界面位于 `apps/<name>/frontend/`，作为独立模块通过 manifest 注册到路由。

| 应用 | 组件路径 | 用途 |
|------|---------|------|
| 聊天系统 | `apps/chat/frontend/Chat.vue` | 公共聊天、私聊、群聊界面 |
| AI 对话 | `apps/ai-chat/frontend/AIChat.vue` | AI 对话界面（多模型切换） |
| 社区论坛 | `apps/community/frontend/Community.vue` | 帖子列表、详情、发帖编辑器 |
| 云盘 | `apps/resource/frontend/CloudDrive.vue` | 文件浏览、上传、视频播放 |
| 笔记 | `apps/notes/frontend/Notes.vue` | Markdown 编辑器、目录树 |
| 音乐播放器 | `apps/music/frontend/Music.vue` | 播放列表、LRC 歌词同步 |
| 天气 | `apps/weather/frontend/Weather.vue` | 天气卡片、空气质量、降雨提醒 |
| 计算器 | `apps/calculator/frontend/Calculator.vue` | 科学计算器 |
| 日历 | `apps/calendar/frontend/Calendar.vue` | 班级日历、事件提醒 |
| 课程表 | `apps/timetable/frontend/Timetable.vue` | 周课表、节次切换 |
| 倒计时 | `apps/countdown/frontend/Countdown.vue` | 考试倒计时 |
| 设置 | `apps/settings/frontend/Settings.vue` | 系统设置、主题、壁纸 |
| 管理后台 | `apps/admin/frontend/Admin.vue` | 用户管理、广播、班干、应用管控 |

::: tip 应用加载流程
应用界面通过 `apps/<name>/manifest.json` 声明 `frontend.route` 与 `frontend.component`，由 `router-aggregator.js` 在启动时聚合到主路由。访问对应路径时按需加载组件，无需手动配置路由。
:::

### ChatBubble.vue — 聊天气泡

源码：`client/src/components/ChatBubble.vue`

聊天消息气泡，支持文本、图片、文件、系统消息等多种类型。

```vue
<template>
  <ChatBubble :message="msg" :is-self="isMe" @recall="onRecall" />
</template>
```

| Prop | 类型 | 说明 |
|------|------|------|
| `message` | `object` | 消息对象（`content`、`type`、`sender_name`、`created_at`、`recalled`） |
| `isSelf` | `boolean` | 是否为自己发送（决定左右对齐） |

### WeatherIcon.vue — 天气图标

源码：`client/src/components/WeatherIcon.vue`

根据天气代码渲染对应的 SVG 图标。

```vue
<template>
  <WeatherIcon :code="104" :is-day="true" :size="48" />
</template>
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `code` | `number` | — | 和风天气代码 |
| `isDay` | `boolean` | `true` | 是否白天（影响图标变体） |
| `size` | `number` | `48` | 图标尺寸（px） |

天气图标资源位于 `client/src/assets/weather-icons/`，包含 `drizzle.svg`、`fog-day.svg`、`rain.svg`、`sleet.svg`、`snow.svg` 等。

### WeatherAnimation.vue — 天气动画

源码：`client/src/components/WeatherAnimation.vue`

天气场景动画（雨滴、雪花、雷电、雾气等粒子效果）。

```vue
<template>
  <WeatherAnimation type="rain" :intensity="0.6" />
</template>
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | `'rain' \| 'snow' \| 'fog' \| 'thunder' \| 'drizzle'` | — | 动画类型 |
| `intensity` | `number` | `0.5` | 强度（0-1） |

::: warning 性能考量
天气动画使用 Canvas 渲染粒子，低端设备（树莓派）上建议关闭。可通过 `ThemeEngine.setMotionEnabled(false)` 全局禁用。
:::

## 完整使用示例

桌面入口组合使用示例：

```vue
<template>
  <div class="desktop-shell">
    <!-- 桌面 -->
    <Desktop
      :wallpaper="wallpaper"
      :apps="enabledApps"
      :current-page="currentPage"
      @app-launch="onAppLaunch"
    />

    <!-- 超能岛 -->
    <SuperIsland
      :notifications="notifications"
      :expanded="islandExpanded"
      @expand="islandExpanded = true"
      @collapse="islandExpanded = false"
    />

    <!-- 全局搜索 -->
    <GlobalSearch :visible="searchVisible" @close="searchVisible = false" />

    <!-- 锁屏 -->
    <LockScreen :locked="isLocked" @unlock="onUnlock" />

    <!-- 错误边界包裹的应用容器 -->
    <ErrorBoundary>
      <router-view />
    </ErrorBoundary>
  </div>
</template>

<script>
import Desktop from '@/views/Desktop.vue';
import SuperIsland from '@/components/SuperIsland.vue';
import GlobalSearch from '@/components/GlobalSearch.vue';
import LockScreen from '@/components/LockScreen.vue';
import ErrorBoundary from '@/components/ErrorBoundary.vue';

export default {
  components: { Desktop, SuperIsland, GlobalSearch, LockScreen, ErrorBoundary },
  data() {
    return {
      wallpaper: 'default',
      enabledApps: [],
      currentPage: 0,
      islandExpanded: false,
      searchVisible: false,
      isLocked: false,
      notifications: []
    };
  },
  methods: {
    onAppLaunch(app) {
      this.$router.push(app.frontend.route);
    },
    onUnlock() {
      this.isLocked = false;
    }
  }
};
</script>
```

## 浏览器兼容性

ClassIntra 目标浏览器为 Chrome 80+，已通过 `@vitejs/plugin-legacy` 适配老旧教育终端：

- `backdrop-filter` polyfill（不支持时降级为纯色背景）
- `ResizeObserver` polyfill
- `IntersectionObserver` polyfill
- `:focus-visible` polyfill
- ES2015+ 语法降级（通过 `@vitejs/plugin-legacy`）

无需手动引入 polyfill，Shell 入口已统一注入。

## 相关文档

- [UI & 主题](./)：三大支柱总览
- [主题定制](./theme)：CSS 变量与组件级覆盖
- [图标系统](./icons)：应用图标规范
- [核心概念 — 应用架构](/concepts/architecture)：组件加载与 manifest 注册
- [API 参考 — 前端 API](/api/client)：核心模块 API
