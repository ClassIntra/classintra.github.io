---
title: 主题系统
description: ClassIntra 主题系统设计，包含 ThemeEngine 引擎、Token 双写策略（--ci-* 与旧别名并存）、主题切换流程、动画开关（单档设计）、主题目录结构（themes/ + manifest.json + tokens.js）、扩展主题架构（theme-extensions/）以及设计 Token 系统表格。
---

# 主题系统

ClassIntra 主题系统参考 Ditto 的 ThemeEngine，但做了简化：动画采用**单档设计**（开/关），主题包仅内置 light/dark，并通过**双写策略**实现从旧变量体系到新 `--ci-*` token 体系的平滑迁移。

源码位置：`client/src/core/theme-engine.js`、`shared/src/theme-tokens.js`、`themes/`

## 主题引擎设计（ThemeEngine）

源码：`client/src/core/theme-engine.js`

ThemeEngine 是单例 + 懒创建的核心模块，职责包括：

- 注册/列出/切换主题
- 通过 `data-theme` 属性触发 CSS 切换（旧机制）
- 通过 `flattenTokens` + `applyToElement` 写入 `--ci-*` 变量（新机制）
- 订阅主题变化（`subscribe`）
- 动画开关（`setMotionEnabled`）
- 扩展主题加载（`theme-extension-loader` 扫描 `theme-extensions/`）
- 动态色注入（`setDynamicColor`）

### 核心 API

| 方法 | 说明 |
|------|------|
| `registerTheme(id, options)` | 注册主题：`{ name, type, tokens, icons }` |
| `setTheme(id)` | 切换主题（写入 `data-theme` + `--ci-*` 变量 + 通知订阅者） |
| `getCurrentTheme()` | 获取当前主题 id |
| `listThemes()` | 列出所有已注册主题 |
| `subscribe(callback)` | 订阅主题变化，返回取消订阅函数 |
| `toggleColorScheme()` | 在 light/dark 间切换，返回切换后的主题 id |
| `setMotionEnabled(enabled)` | 开/关动画 |
| `isMotionEnabled()` | 查询动画状态 |
| `initMotion()` | 初始化动画状态（从 localStorage 或 `prefers-reduced-motion`） |
| `loadExternalTheme(url)` | 加载远程主题包（本期未实现，调用会 reject） |

::: tip 单例获取
所有 ThemeEngine 实例通过 `getThemeEngine()` 获取，由 ServiceRegistry 懒创建并缓存。组件内可通过 `this.$services.resolve('themeEngine')` 访问。
:::

## Token 双写策略

ClassIntra 经历了从"旧变量体系"到"新 token 体系"的迁移。为避免一次性迁移导致大量代码改动，采用**双写策略**：

### 双写机制

| 机制 | 变量前缀 | 来源 | 适用场景 |
|------|----------|------|----------|
| 旧机制 | `--primary-color` / `--bg-color` / `--text-color` 等 | `client/src/styles/global.scss` 的 `:root` 和 `[data-theme="dark"]` | 旧代码 |
| 新机制 | `--ci-*` | ThemeEngine 运行时调用 `applyToElement` 写入 inline style | 新代码 |

### 旧变量示例（global.scss）

```scss
// client/src/styles/global.scss
:root {
  --primary-color: #007AFF;
  --bg-color: #F2F2F7;
  --text-color: rgba(0, 0, 0, 0.90);
  --border-color: rgba(60, 60, 67, 0.12);
  // ... 共 80+ 旧变量
}

[data-theme="dark"] {
  --primary-color: #0A84FF;
  --bg-color: #000000;
  --text-color: rgba(235, 235, 245, 0.95);
  --border-color: rgba(84, 84, 88, 0.65);
  // ...
}
```

### 新变量示例（运行时 inline style）

由 ThemeEngine 调用 `applyToElement(document.documentElement, flatMap)` 写入：

```css
/* 运行时 inline style（由 JS 写入） */
html {
  --ci-color-primary: #007AFF;
  --ci-color-bg-base: #F2F2F7;
  --ci-color-text-primary: rgba(0, 0, 0, 0.90);
  /* ... */
}

html[data-theme="dark"] {
  --ci-color-primary: #0A84FF;
  --ci-color-bg-base: #000000;
  --ci-color-text-primary: rgba(235, 235, 245, 0.95);
  /* ... */
}
```

### 在 CSS 中使用

```scss
.my-component {
  /* ✓ 推荐：优先用新变量，降级到旧变量，再降级到硬编码 */
  color: var(--ci-color-text-primary, var(--text-color, rgba(0, 0, 0, 0.90)));
  background: var(--ci-color-bg-card, var(--bg-card-color, #FFFFFF));
  border: 1px solid var(--ci-color-border-default, var(--border-color, rgba(60, 60, 67, 0.12)));
}

/* ✓ 简化版（不降级，假设新变量一定存在） */
.my-component {
  color: var(--ci-color-text-primary);
}
```

::: warning 迁移清理路径
未来某个版本可以一次性清理：

1. 全局搜索替换：把所有 `var(--primary-color)` 替换为 `var(--ci-color-primary)`
2. 删除 `global.scss` 中 `:root` 和 `[data-theme="dark"]` 的旧变量声明
3. 保留 ThemeEngine 的 `--ci-*` 写入逻辑
:::

## 主题切换流程

```
用户点击"切换深色模式"
    ↓
store.dispatch('settings/setTheme', 'dark')
    ↓
store/modules/settings.js: SET_THEME mutation
    ↓ 调用 ThemeEngine.setTheme('dark')
    ↓
ThemeEngine.setTheme('dark')
    ↓
1. documentElement.setAttribute('data-theme', 'dark')
   → 触发 CSS 中 [data-theme="dark"] 选择器生效（旧变量切换）
    ↓
2. flattenTokens(DARK_TOKENS) → applyToElement(root, flatMap)
   → 写入新的 --ci-* 变量到 inline style（新变量切换）
   → 先 removeFromElement 清除旧 --ci-* 变量，避免残留
    ↓
3. 通知所有 subscribers（payload: { id, previous, type, icons }）
    ↓
4. EventBus.emit('theme:changed', payload)
   → 广播给非直接订阅者
    ↓
5. localStorage.setItem('theme', 'dark')
   → 持久化用户选择
```

### 多种触发方式

#### 通过 Vuex action（推荐）

```javascript
this.$store.dispatch('settings/setTheme', 'dark');
// 内部会调用 ThemeEngine.setTheme + 持久化
```

#### 直接调用 ThemeEngine

```javascript
import { getThemeEngine } from '@/core/theme-engine';
getThemeEngine().setTheme('dark');
// 注意：不会自动持久化，需手动 localStorage.setItem
```

#### 切换 light/dark

```javascript
getThemeEngine().toggleColorScheme();
// 返回切换后的主题 id
```

### 订阅主题变化

```javascript
import { getThemeEngine } from '@/core/theme-engine';

var unsubscribe = getThemeEngine().subscribe(function(payload) {
  console.log('主题切换:', payload.previous, '→', payload.id);
  // payload.type === 'dark' / 'light'
  // payload.icons === null（本期未实现图标主题）
});
```

或通过 EventBus：

```javascript
import { getEventBus } from '@/core/event-bus';
import { EVENT_NAMES } from '@shared/constants';

getEventBus().on(EVENT_NAMES.THEME_CHANGED, function(payload) {
  // ...
});
```

## 动画开关（单档设计）

ClassIntra 采用**单档动画**（开/关），不区分 fast/normal/slow（与 Ditto 的四档不同）：

- **启用**：所有 transition / animation 按正常时长播放
- **禁用**：所有 transition / animation 时长变为 `0.001s`，立即生效

### 实现机制

#### 设置 data 属性

```javascript
// 启用
documentElement.removeAttribute('data-no-motion');

// 禁用
documentElement.setAttribute('data-no-motion', 'true');
```

#### SCSS 全局规则

```scss
// client/src/styles/_motion.scss
[data-no-motion="true"] *,
[data-no-motion="true"] *::before,
[data-no-motion="true"] *::after {
  animation-duration: 0.001s !important;
  animation-delay: 0s !important;
  transition-duration: 0.001s !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
}
```

### 初始化

在 `App.vue` mounted 中调用：

```javascript
try { getThemeEngine().initMotion(); } catch (e) {}
```

**优先级**：

1. `localStorage.ci_motion_disabled === '1'` → 禁用
2. `window.matchMedia('(prefers-reduced-motion: reduce)').matches` → 禁用
3. 默认 → 启用

### 运行时切换

```javascript
import { getThemeEngine } from '@/core/theme-engine';

var themeEngine = getThemeEngine();

// 关闭动画
themeEngine.setMotionEnabled(false);
// → 设置 data-no-motion="true"
// → localStorage.ci_motion_disabled = '1'
// → EventBus.emit('theme:motion-toggled', { enabled: false })

// 查询状态
var enabled = themeEngine.isMotionEnabled();  // false

// 开启动画
themeEngine.setMotionEnabled(true);
```

### 在 CSS 中使用动画 token

```scss
.my-component {
  /* 使用 token 定义的时长和曲线 */
  transition: color var(--ci-motion-duration-normal, 0.25s) var(--ci-motion-ease-standard, ease);
  animation: fadeIn var(--ci-motion-duration-slow, 0.35s) var(--ci-motion-ease-decelerate, ease);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

::: tip 自动降级
使用 token 的动画在 `[data-no-motion="true"]` 时会自动被全局规则覆盖，无需额外处理。
:::

## 主题目录结构

ClassIntra 主题是独立的视觉层，与应用（`apps/`）和插件（`plugins/`）相互独立。

```
themes/
├── light/
│   ├── manifest.json    # 主题元数据（id/name/type/version/tokens 路径）
│   └── tokens.js        # 主题 Token 数据（color/shape/shadow/motion）
├── dark/
│   ├── manifest.json
│   └── tokens.js
└── README.md
```

### 主题 manifest.json 示例

```json
{
  "id": "dark",
  "name": "默认深色",
  "type": "dark",
  "version": "1.0.0",
  "description": "ClassIntra 默认深色主题，与 global.scss [data-theme=dark] 保持同步",
  "tokens": "./tokens.js",
  "icons": null
}
```

### 与 global.scss 的关系

主题 tokens 中的颜色值与 `client/src/styles/global.scss` 中 `:root`（浅色）和 `[data-theme="dark"]`（深色）的 CSS 变量值保持同步：

- `themes/light/tokens.js` ↔ `global.scss :root`
- `themes/dark/tokens.js` ↔ `global.scss [data-theme="dark"]`

### 加载机制

| 加载方 | 机制 | 说明 |
|--------|------|------|
| `client/src/core/theme-loader.js` | `import.meta.glob` 扫描 `themes/*/manifest.json` | 前端启动时一次性加载所有内置主题 |
| `client/src/core/theme-engine.js` | 通过 theme-loader 注册所有内置主题 | 注册到 `_themes` 字典 |
| `client/src/core/theme-extension-loader.js` | 扫描 `theme-extensions/` 目录 | 加载扩展主题（如 Material You） |

### 新增主题

1. 在 `themes/` 下新建目录（kebab-case，如 `ocean-blue/`）
2. 创建 `manifest.json`（参考 `dark/manifest.json`）
3. 创建 `tokens.js`，导出 `TOKENS` 对象（结构参考 `light/tokens.js`）
4. 主题自动被 ThemeEngine 注册，可在设置页切换

::: warning 不允许覆盖内置主题
内置主题（`light` / `dark`）不允许被外部主题包覆盖。`loadExternalTheme` 在加载时会检查 id 冲突，与内置主题同 id 会拒绝。
:::

## 扩展主题架构（theme-extensions/）

扩展主题是 ClassIntra 的进阶能力，允许第三方提供更复杂的视觉系统（如动态色彩、形状变换、tonal palette）。

```
theme-extensions/
└── material-you/
    ├── manifest.json       # 扩展主题元数据
    ├── apply.js            # apply(engine, manifest) 注册到 _themes
    ├── tokens.js           # 静态 token 数据
    ├── dynamic-color.js    # 动态色彩派生（从种子色生成完整 M3 配色）
    └── README.md
```

### 扩展主题 manifest.json 示例

```json
{
  "schema": "classintra-theme-extension/v1",
  "id": "material-you",
  "name": "Material You",
  "version": "0.1.0",
  "description": "Material Design 3 动态色彩扩展主题",
  "kind": "extension",
  "engine": { "min": "1.0.0" },
  "base": "auto",
  "type": "dynamic",
  "colorMode": "both",
  "defaultSeed": "#0061A4",
  "shape": {
    "xs": "8px", "sm": "12px", "md": "16px",
    "lg": "20px", "xl": "24px", "2xl": "28px",
    "3xl": "32px", "pill": "9999px"
  },
  "entry": "./apply.js",
  "tokens": "./tokens.js",
  "dynamicColor": "./dynamic-color.js",
  "icons": null,
  "capabilities": ["dynamic-color", "shape-shift", "tonal-palette"]
}
```

### 扩展主题能力

`capabilities` 字段声明扩展主题提供的能力：

| 能力 | 说明 |
|------|------|
| `dynamic-color` | 从种子色派生完整配色方案 |
| `shape-shift` | 自定义圆角系统（覆盖默认 `--ci-shape-*`） |
| `tonal-palette` | 提供 M3 tonal palette 色板 |

### 动态色注入

```javascript
// 从种子色重新生成扩展主题的 color token
getThemeEngine().setDynamicColor('#0061A4');
// 如果当前主题是该扩展主题，则立即重新写入 --ci-color-* 变量
```

## 设计 Token 系统表格

主题 token 采用**结构化对象**，由 `flattenTokens` 展平为 CSS 变量。命名规则：`--ci-<分类>-<子分类>-<名称>`（驼峰转 kebab）。

### Token 分类总览

| 分类 | 子分类 | 说明 |
|------|--------|------|
| `color.primary` | primary / primaryHover / primaryPressed / primaryRgb / primaryLight | 主色及衍生 |
| `color.accent` | music / weather / community / chat / notes / resource / settings / ai | 应用主题色 |
| `color.semantic` | success / warning / danger / info | 语义色 |
| `color.bg` | base / card / elevated / glass | 背景色 |
| `color.text` | primary / secondary / tertiary | 文字色 |
| `color.border` | default / separator | 边框色 |
| `color.glass` | dock / nav / island / sidebar | 毛玻璃材质色 |
| `color.onWallpaper` | text / shadow / dot | 壁纸上的文字色 |
| `shape` | xs / sm / md / lg / xl / 2xl / 3xl / pill | 圆角 |
| `shadow` | sm / md / lg / xl | 阴影 |
| `motion` | easeXxx / durationXxx | 动画曲线和时长 |

### 圆角 Token（shape）

| Token | CSS 变量 | Light 值 |
|-------|----------|----------|
| `shape.xs` | `--ci-shape-xs` | `4px` |
| `shape.sm` | `--ci-shape-sm` | `8px` |
| `shape.md` | `--ci-shape-md` | `12px` |
| `shape.lg` | `--ci-shape-lg` | `16px` |
| `shape.xl` | `--ci-shape-xl` | `20px` |
| `shape['2xl']` | `--ci-shape-2xl` | `24px` |
| `shape['3xl']` | `--ci-shape-3xl` | `28px` |
| `shape.pill` | `--ci-shape-pill` | `9999px` |

### 间距 Token

::: warning 间距未纳入 Token
ClassIntra 当前**未**把间距（spacing）抽取为 token，仍由各组件硬编码或使用 `global.scss` 中的零散变量。后续如需统一，可参考 shape 的结构添加 `spacing` 分类。
:::

### 字号 Token

::: warning 字号未纳入 Token
ClassIntra 当前**未**把字号（font-size）抽取为 token，仍由 `global.scss` 提供。后续如需统一，可添加 `typography.fontSize` 分类。
:::

### 缓动 Token（motion）

| Token | CSS 变量 | 值 |
|-------|----------|------|
| `motion.easeStandard` | `--ci-motion-ease-standard` | `cubic-bezier(0.25, 0.1, 0.25, 1)` |
| `motion.easeDecelerate` | `--ci-motion-ease-decelerate` | `cubic-bezier(0, 0, 0.2, 1)` |
| `motion.easeAccelerate` | `--ci-motion-ease-accelerate` | `cubic-bezier(0.4, 0, 1, 1)` |
| `motion.easeSpring` | `--ci-motion-ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| `motion.easeEmphasized` | `--ci-motion-ease-emphasized` | `cubic-bezier(0.32, 0.72, 0, 1)` |
| `motion.durationFast` | `--ci-motion-duration-fast` | `0.15s` |
| `motion.durationNormal` | `--ci-motion-duration-normal` | `0.25s` |
| `motion.durationSlow` | `--ci-motion-duration-slow` | `0.35s` |

## 调试技巧

### 查看当前主题

```javascript
// 浏览器控制台
__services.resolve('themeEngine').getCurrentTheme();
// 或
document.documentElement.getAttribute('data-theme');  // 'dark' / null（light）
```

### 查看所有已注册主题

```javascript
__services.resolve('themeEngine').listThemes();
// [{ id: 'light', name: '默认浅色', type: 'light', icons: null },
//  { id: 'dark', name: '默认深色', type: 'dark', icons: null }]
```

### 查看 inline style 中的 --ci-* 变量

```javascript
var style = document.documentElement.style;
for (var i = 0; i < style.length; i++) {
  var prop = style[i];
  if (prop.indexOf('--ci-') === 0) {
    console.log(prop, '=', style.getPropertyValue(prop));
  }
}
```

## 相关文档

- [架构概览](./)
- [应用架构详解](./architecture)
- [Manifest 清单](./manifest)
- [WebSocket 通信](./websocket)
- [认证与权限](./auth)
- [应用管控](./app-control)
- [快速开始](/quick-start/)
