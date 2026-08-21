---
title: 图标系统
description: ClassIntra 图标系统参考：自定义 SVG 图标库、Font Awesome 兼容、icon-resolver 使用、应用图标规范（56x56px + --ci-shape-lg）、图标资源路径。
outline: [2, 3]
---

# 图标系统

ClassIntra 的图标系统基于**自定义 SVG 图标库**构建，位于 `Resources/public/icons/`，并通过 `client/src/utils/icon-resolver.js` 统一解析。同时兼容 Font Awesome class 与外部 URL，使应用可以灵活选择图标来源。

## 目录

- [图标系统概览](#图标系统概览)
- [Font Awesome 集成](#font-awesome-集成)
- [自定义图标使用](#自定义图标使用)
- [应用图标规范](#应用图标规范)
- [图标资源路径](#图标资源路径)

## 图标系统概览

ClassIntra 提供 3 种图标来源，由 `icon-resolver.js` 自动识别：

| 来源 | 识别规则 | 渲染方式 | 适用场景 |
|------|---------|---------|---------|
| 自定义 SVG | 以 `.svg` 结尾或匹配 `Resources/public/icons/` 中的文件 | `<img src="...">` | 系统应用、品牌图标 |
| Font Awesome class | 以 `fa-` 开头（如 `fa-solid fa-star`） | `<i class="fa-solid fa-star">` | 通用 UI 图标、第三方应用 |
| 外部 URL | 以 `http://`、`https://` 开头 | `<img src="...">` | 远程图标、动态图标 |
| Emoji | 不满足上述条件，且为短字符串（≤4 字符） | `<span>` 包裹 | 临时原型、教育场景 |

::: tip 识别优先级
按 **自定义 SVG → Font Awesome → URL → Emoji** 顺序判断。`icon-resolver` 会优先匹配本地 SVG 文件，未匹配再按其他规则识别。
:::

## Font Awesome 集成

Font Awesome 6 Free 已内置在前端项目中，通过 CSS 全局加载：

```javascript
// 在 main.js 中引入
import '@fortawesome/fontawesome-free/css/all.min.css';
```

包含三种样式：

| 样式前缀 | 说明 | 图标数量 |
|---------|------|---------|
| `fa-solid` | 实心图标（默认） | 1500+ |
| `fa-regular` | 线性图标 | 200+ |
| `fa-brands` | 品牌图标（GitHub、Twitter 等） | 460+ |

### 使用示例

```vue
<template>
  <!-- Solid 样式 -->
  <i class="fa-solid fa-star"></i>

  <!-- Regular 样式 -->
  <i class="fa-regular fa-heart"></i>

  <!-- Brands 样式 -->
  <i class="fa-brands fa-github"></i>
</template>
```

::: tip Pro 版本
如需 FontAwesome Pro 图标，可在 `client/src/main.js` 中替换 CSS 引入路径：

```javascript
import '@fortawesome/fontawesome-pro/css/all.min.css';
// 不再引入 free 版本
// import '@fortawesome/fontawesome-free/css/all.min.css';  // 注释掉
```

Pro 版本提供 `fa-light`、`fa-thin`、`fa-duotone` 等更多样式，`icon-resolver` 自动识别以 `fa-` 开头的所有 class。
:::

## 自定义图标使用

### icon-resolver.js API

源码：`client/src/utils/icon-resolver.js`

`icon-resolver` 提供图标路径解析与统一渲染入口。

```javascript
import { resolveIcon } from '@/utils/icon-resolver';

// 解析图标路径（自动从 Resources/public/icons/ 查找）
var iconUrl = resolveIcon('Chat.svg');
// 返回 '/icons/Chat.svg' 或完整 URL

// 在模板中使用
// <img :src="resolveIcon('Chat.svg')" alt="聊天" />
```

### 在组件中使用

```vue
<template>
  <button class="my-btn">
    <!-- 自定义 SVG -->
    <img :src="resolveIcon('Settings.svg')" alt="设置" class="icon" />

    <!-- Font Awesome -->
    <i class="fa-solid fa-cog"></i>

    <!-- 外部 URL -->
    <img src="https://example.com/logo.svg" alt="logo" />
  </button>
</template>

<script>
import { resolveIcon } from '@/utils/icon-resolver';

export default {
  methods: {
    resolveIcon
  }
};
</script>

<style scoped>
.icon {
  width: 20px;
  height: 20px;
  /* 让 SVG 继承父元素颜色（仅 inline SVG 有效，<img> 不支持） */
  filter: var(--ci-color-text-primary-filter, none);
}
</style>
```

### 在 manifest 中使用

应用 `manifest.json` 中的 `icon` 字段使用同样的识别规则：

```json
{
  "name": "ai-chat",
  "label": "AI 对话",
  "icon": "AI-Chat.svg"
}
```

`icon-resolver` 会自动从 `Resources/public/icons/` 查找 `AI-Chat.svg`，未找到时回退到 Font Awesome 或 URL 解析。

::: warning SVG 颜色继承
通过 `<img>` 加载的 SVG **不会**继承父元素的 `color`，因此无法通过 CSS 变量动态着色。如需主题感知的矢量图标，建议：
- 使用 Font Awesome class 模式（依赖 FA 提供的 `currentColor` 继承）
- 或将 SVG inline 到 Vue 模板中，使用 `fill="currentColor"`

`icon-resolver` 的 URL 模式不支持颜色继承，但能确保图标始终可见，适合品牌 logo 等固定颜色的图标。
:::

## 应用图标规范

ClassIntra 对应用图标有明确的视觉规范，确保桌面整体一致性。

### 尺寸与圆角

| 项目 | 值 | 说明 |
|------|----|----|
| 尺寸 | `56×56px` | 应用图标标准尺寸 |
| 圆角 | `--ci-shape-lg`（16px）或 `--ci-shape-3xl`（28px） | iOS 风格大圆角 |
| 内边距 | `12px` | 图标内容与容器边缘的距离 |
| 阴影 | `--ci-elevation-sm` | 轻微阴影增加层次感 |

### AppIcon.vue 渲染

`AppIcon.vue` 组件按上述规范渲染：

```vue
<template>
  <AppIcon :app="appData" :size="56" />
</template>
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `app` | `object` | — | 应用对象（含 `icon`、`label`、`color`、`name`） |
| `size` | `number` | `56` | 图标尺寸（px） |

渲染逻辑：

1. 容器使用 `app.color` 作为背景色（缺省为 `--ci-color-primary`）
2. 图标通过 `icon-resolver` 解析，渲染为 `<img>`（SVG/URL）或 `<i>`（Font Awesome）
3. 容器圆角应用 `--ci-shape-lg`
4. 鼠标悬停时应用 `--ci-elevation-md` 阴影与轻微缩放动画
5. 点击触发 `launch` 事件

### 应用图标命名约定

应用 `manifest.json` 中的 `icon` 字段建议遵循：

| 场景 | 推荐 | 示例 |
|------|------|------|
| 系统应用 | 自定义 SVG | `"Chat.svg"`、`"Weather.svg"` |
| 第三方应用 | 自定义 SVG 或 Font Awesome | `"MyApp.svg"` 或 `"fa-solid fa-cube"` |
| 临时原型 / 内部工具 | Emoji 或 Font Awesome | `"📦"` 或 `"fa-solid fa-flask"` |
| 教育场景低龄应用 | Emoji | `"🎨"`、`"🎵"` |

::: tip SVG 优化
提交自定义 SVG 图标前，建议通过 `scripts/optimize-icons.js` 优化（移除元数据、简化路径），减小体积。详见仓库 `scripts/` 目录。
:::

## 图标资源路径

ClassIntra 的图标资源按类别组织在 `Resources/public/icons/` 下：

### 应用图标

路径：`Resources/public/icons/`

| 图标文件 | 对应应用 |
|---------|---------|
| `AI-Chat.svg` / `AI-Chat.png` | AI 对话 |
| `Calculator.svg` | 计算器 |
| `Calendar.svg` / `Calendar.png` | 日历 |
| `Chat.svg` / `Chat.png` | 聊天 |
| `Community.svg` / `Community.png` | 社区论坛 |
| `Control.svg` | 控制中心 |
| `Countdown.svg` / `Countdown.png` | 倒计时 |
| `Files.svg` / `Files.png` | 云盘 |
| `Music.svg` / `Music.png` | 音乐播放器 |
| `Note.svg` / `Note.png` | 笔记 |
| `Settings.svg` / `Settings.png` | 设置 |
| `Timetable.svg` / `Timetable.png` | 课程表 |
| `ToolBox.svg` / `ToolBox.png` | 工具箱 |

::: tip PNG 与 SVG 双版本
部分图标同时提供 SVG 与 PNG 版本：SVG 用于现代浏览器（矢量、可缩放），PNG 用于 Chrome 80 等老旧浏览器（SVG 渲染兼容性问题）。`icon-resolver` 会根据浏览器能力自动选择。
:::

### 等级图标

路径：`Resources/public/icons/level/`

| 图标文件 | 对应等级 |
|---------|---------|
| `Lv0.svg` | 等级 0（新手） |
| `Lv1.svg` | 等级 1 |
| `Lv2.svg` | 等级 2 |
| `Lv3.svg` | 等级 3 |
| `Lv4.svg` | 等级 4 |
| `Lv5.svg` | 等级 5 |
| `Lv6.svg` | 等级 6（最高） |

等级图标用于论坛、个人主页等场景，根据 `levels` 表的 `level` 字段动态加载：

```javascript
import { resolveIcon } from '@/utils/icon-resolver';

var levelIcon = resolveIcon('level/Lv' + user.level + '.svg');
// 等级 5 → '/icons/level/Lv5.svg'
```

### 天气图标

路径：`client/src/assets/weather-icons/`

| 图标文件 | 对应天气 |
|---------|---------|
| `drizzle.svg` | 毛毛雨 |
| `fog-day.svg` | 雾（白天） |
| `rain.svg` | 雨 |
| `sleet.svg` | 雨夹雪 |
| `snow.svg` | 雪 |

天气图标由 `WeatherIcon.vue` 组件根据和风天气代码渲染，详见 [组件库 → WeatherIcon](./components#weathericon-vue-—-天气图标)。

### 服务端镜像

路径：`server/public/icons/`

服务端 `server/public/icons/` 目录镜像了部分应用图标（用于 setup 页面、邮件模板等非前端场景），文件名与应用图标一致。

## 常用图标速查

以下列出 ClassIntra 内置应用图标的快速查找表：

| 应用 | 图标文件 | Font Awesome 替代 |
|------|---------|------------------|
| 聊天 | `Chat.svg` | `fa-solid fa-comment` |
| AI 对话 | `AI-Chat.svg` | `fa-solid fa-robot` |
| 社区论坛 | `Community.svg` | `fa-solid fa-users` |
| 云盘 | `Files.svg` | `fa-solid fa-folder` |
| 笔记 | `Note.svg` | `fa-solid fa-sticky-note` |
| 音乐 | `Music.svg` | `fa-solid fa-music` |
| 天气 | `Weather.svg` | `fa-solid fa-cloud-sun` |
| 计算器 | `Calculator.svg` | `fa-solid fa-calculator` |
| 日历 | `Calendar.svg` | `fa-solid fa-calendar` |
| 课程表 | `Timetable.svg` | `fa-solid fa-table` |
| 倒计时 | `Countdown.svg` | `fa-solid fa-clock` |
| 设置 | `Settings.svg` | `fa-solid fa-gear` |
| 工具箱 | `ToolBox.svg` | `fa-solid fa-toolbox` |
| 控制中心 | `Control.svg` | `fa-solid fa-sliders` |

::: tip 完整图标库
访问 [Font Awesome 官网](https://fontawesome.com/icons) 查找更多图标，搜索后复制 `class` 字符串即可使用。自定义 SVG 图标请遵循应用图标规范（56×56px、`--ci-shape-lg` 圆角）。
:::

## 自定义图标库

### 添加新图标

向 `Resources/public/icons/` 添加 SVG 文件即可：

1. 设计或获取 SVG 图标（建议 viewBox 为 `0 0 24 24`）
2. 通过 `scripts/optimize-icons.js` 优化
3. 放入 `Resources/public/icons/` 目录
4. 在 manifest 或组件中引用：`"icon": "MyIcon.svg"`
5. `icon-resolver` 自动识别并解析

### SVG 转换为 PNG

为兼容老旧浏览器，可通过 `scripts/svg-to-png.js` 生成 PNG 版本：

```bash
node scripts/svg-to-png.js Resources/public/icons/Chat.svg
# 生成 Resources/public/icons/Chat.png（多个分辨率）
```

::: warning Chrome 80 SVG 兼容性
Chrome 80 对部分 SVG 特性（如 `filter`、复杂 mask）支持不完善，建议：
- 生产环境对关键应用图标同时提供 SVG 与 PNG
- 复杂 SVG 简化为基础路径后使用
- 老旧浏览器场景可全部使用 PNG
:::

### 引入其他图标库

如需使用其他图标库（如 Material Icons），可在 `client/src/main.js` 中引入对应 CSS：

```javascript
// client/src/main.js
import 'material-icons/iconfont/material-icons.css';

// 然后在模板中使用
// <i class="material-icons">home</i>
```

::: warning 识别规则限制
`icon-resolver` 默认识别 `fa-` 开头为 Font Awesome。其他图标库的 class 需修改 `icon-resolver` 内部识别逻辑，或直接在模板中用 `<i :class="name">` 渲染。
:::

## 无障碍

图标渲染时建议考虑无障碍访问：

- 装饰性图标设置 `aria-hidden="true"`（`AppIcon` 默认行为）
- 含义图标设置 `title` 或 `aria-label`

```vue
<template>
  <!-- 含义图标 -->
  <img
    :src="resolveIcon('Chat.svg')"
    alt="聊天应用"
    title="打开聊天"
  />

  <!-- 装饰性图标 -->
  <i class="fa-solid fa-bell" aria-hidden="true"></i>
</template>
```

## 相关文档

- [UI & 主题](./)：三大支柱总览
- [组件库](./components)：AppIcon 与其他组件的配合使用
- [主题定制](./theme)：通过 `--ci-color-text-primary` 等变量控制图标颜色
- [API 参考 — 类型定义](/api/types)：Manifest Schema 的 `icon` 字段定义
- [Font Awesome 官网](https://fontawesome.com/icons)：完整图标库检索
