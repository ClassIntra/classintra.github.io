---
title: 主题定制
description: ClassIntra 主题系统完整参考：ThemeEngine 架构、Token 体系（圆角/间距/字号/缓动）、双写策略、主题定制指南、扩展主题开发。
outline: [2, 3]
---

# 主题定制

ClassIntra 的主题系统由 `client/src/core/theme-engine.js` 提供，基于 **CSS 变量驱动 + 双写策略**，支持运行时切换、扩展主题、动态色注入。

本页内容覆盖以下主题：

- [ThemeEngine 架构](#themeengine-架构)
- [Token 体系](#token-体系)
- [双写策略详解](#双写策略详解)
- [主题定制指南](#主题定制指南)
- [扩展主题开发](#扩展主题开发)

## ThemeEngine 架构

源码：`client/src/core/theme-engine.js`

ThemeEngine 是 ClassIntra 的主题引擎核心，负责管理主题注册、切换、CSS 变量注入、订阅通知。

### 核心特性

- **双写策略**：同时写入 `--ci-*` 新变量（inline style）与 `data-theme` 属性（触发旧 CSS 切换），向后兼容
- **CSS 变量驱动**：所有 token 展平为 `--ci-color-*` / `--ci-shape-*` / `--ci-motion-*` / `--ci-elevation-*` 注入 `document.documentElement`
- **运行时切换**：调用 `setTheme()` 立即生效，无需刷新页面
- **持久化**：用户选择自动保存到 `localStorage['theme']` 与服务端 `user_settings` 表
- **订阅机制**：通过 `subscribe` 注册回调，主题变化时通知
- **动画开关**：`setMotionEnabled` 控制全局动画，响应 `prefers-reduced-motion`
- **扩展主题**：通过 `theme-extension-loader` 扫描 `theme-extensions/` 目录加载第三方主题包
- **动态色注入**：`setDynamicColor(seedColor)` 重新生成扩展主题色板

### 获取实例

```javascript
import { getThemeEngine } from '@/core/theme-engine';

// 单例工厂：首次调用创建实例并应用保存的主题
var engine = getThemeEngine();
```

### 内置主题

源码：`themes/light/` + `themes/dark/`

| 主题 ID | 名称 | 类型 | 路径 |
|---------|------|------|------|
| `light` | 浅色 | `light` | `themes/light/manifest.json` + `tokens.js` |
| `dark` | 深色 | `dark` | `themes/dark/manifest.json` + `tokens.js` |

内置主题通过 `theme-loader.js` 在应用启动时动态加载，注册到 ThemeEngine。

::: tip 设计动机
将所有视觉数值抽离为 token，让 UI 组件只消费 `var(--ci-*)` 而不写死颜色，从而实现「一处变更、全局生效」。这也是运行时切换主题无需刷新的根本原因。
:::

## Token 体系

ClassIntra 的设计 Token 体系遵循 **前缀分类 + 语义命名** 原则，所有 token 注入为 CSS 变量。

### Token 前缀

| 前缀 | 用途 | 示例 |
|------|------|------|
| `--ci-color-*` | 颜色（主色、表面、文字、边框、语义） | `--ci-color-primary`、`--ci-color-surface-base` |
| `--ci-shape-*` | 形状（圆角、半径） | `--ci-shape-xs`、`--ci-shape-3xl` |
| `--ci-motion-*` | 动画（时长、缓动、开关） | `--ci-motion-duration-fast`、`--ci-motion-easing-spring` |
| `--ci-elevation-*` | 阴影层级 | `--ci-elevation-sm`、`--ci-elevation-lg` |

### 圆角（Shape）

| Token | 值 | 说明 |
|------|----|----|
| `--ci-shape-xs` | `4px` | 极小圆角（徽章、标签） |
| `--ci-shape-sm` | `8px` | 小圆角（按钮、输入框） |
| `--ci-shape-md` | `12px` | 中圆角（卡片、面板） |
| `--ci-shape-lg` | `16px` | 大圆角（应用图标、模态框） |
| `--ci-shape-xl` | `20px` | 超大圆角（超能岛） |
| `--ci-shape-2xl` | `24px` | 巨大圆角（窗口） |
| `--ci-shape-3xl` | `28px` | 极大圆角（应用图标占位） |
| `--ci-shape-full` | `9999px` | 全圆角（头像、胶囊按钮） |

::: tip 应用图标规范
应用图标固定 56×56px，圆角使用 `--ci-shape-lg`（16px）或 `--ci-shape-3xl`（28px），符合 iOS 圆角视觉。详见 [图标系统](./icons)。
:::

### 间距（Spacing）

| Token | 值 | 说明 |
|------|----|----|
| `--ci-spacing-xs` | `4px` | 极小间距（图标内） |
| `--ci-spacing-sm` | `8px` | 小间距（按钮内） |
| `--ci-spacing-md` | `12px` | 中间距（卡片内） |
| `--ci-spacing-lg` | `16px` | 大间距（面板内） |
| `--ci-spacing-xl` | `24px` | 超大间距（区块间） |
| `--ci-spacing-xxl` | `48px` | 巨大间距（页面级） |

### 字号（Typography）

| Token | 值 | 说明 |
|------|----|----|
| `--ci-font-caption` | `12px` | 注释、辅助文字 |
| `--ci-font-body` | `14px` | 正文（默认） |
| `--ci-font-title` | `17px` | 卡片标题 |
| `--ci-font-headline` | `20px` | 区块标题 |
| `--ci-font-large` | `24px` | 大标题 |
| `--ci-font-largeTitle` | `40px` | 超大标题（页面级） |

::: tip 字号阶梯
字号阶梯遵循 iOS 字体规范，从 12px 到 40px 共 6 级，覆盖从注释到大标题的所有场景。
:::

### 缓动（Easing）

| Token | 值 | 说明 |
|------|----|----|
| `--ci-motion-easing-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | 标准缓动（默认） |
| `--ci-motion-easing-spring` | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | 弹性缓动（强调动画） |

| Token | 值 | 说明 |
|------|----|----|
| `--ci-motion-duration-fast` | `150ms` | 快速动画（按钮、悬停） |
| `--ci-motion-duration-normal` | `250ms` | 标准动画（卡片展开） |
| `--ci-motion-duration-slow` | `350ms` | 慢速动画（模态框、超能岛） |

### 颜色（Color）

颜色 token 按类别分组，每类有多个语义化子键：

| 类别 | 子键 | 示例 CSS 变量 |
|------|------|-------------|
| 主色 | `primary` / `primaryLight` / `primaryDark` | `--ci-color-primary` |
| 表面 | `background` / `surface` / `surfaceRaised` | `--ci-color-surface` |
| 文字 | `textPrimary` / `textSecondary` / `textDisabled` | `--ci-color-text-primary` |
| 边框 | `border` / `borderSubtle` | `--ci-color-border` |
| 语义 | `success` / `warning` / `error` / `info` | `--ci-color-success` |

::: tip 优先使用语义化 token
应用 CSS 中应优先使用语义化 token（如 `--ci-color-text-primary`），而非具体的 `--ci-color-primary`。前者会在主题切换时自动适配深色模式。
:::

## 双写策略详解

ClassIntra 主题系统的核心是**双写策略**：同时维护两套 CSS 变量入口，确保新旧代码都能正常工作。

### 写入流程

`ThemeEngine.setTheme(id)` 的执行流程：

1. **校验主题**：未注册则回退到 `'light'`
2. **旧机制写入**：`setAttribute('data-theme', id)` 触发旧 CSS 选择器（`:root` / `[data-theme="dark"]`）切换
3. **新变量写入**：调用 `flattenTokens` 展平 token，通过 `applyToElement(document.documentElement, flatMap)` 写入 `--ci-*` inline style
4. **清旧写新**：先 `removeFromElement(root)` 清除旧的 `--ci-*` 变量，再写入新的
5. **通知订阅者**：遍历 `_subscribers` 调用回调（异常隔离）
6. **EventBus 广播**：通过 `getEventBus().emit('THEME_CHANGED', payload)` 通知非直接订阅者

### 两套变量对照

| 旧别名（向后兼容） | 新变量（推荐） | 用途 |
|------------------|---------------|------|
| `--primary-color` | `--ci-color-primary` | 主色 |
| `--bg-color` | `--ci-color-background` | 背景色 |
| `--text-color` | `--ci-color-text-primary` | 主文字色 |
| `--border-color` | `--ci-color-border` | 边框色 |

::: warning 新代码请用 --ci-*
新代码应统一使用 `--ci-*` 前缀变量。旧别名（`--primary-color` 等）仅为向后兼容保留，未来版本可能移除。两套变量在主题切换时都会被同步更新。
:::

### CSS 中使用示例

```css
.my-card {
  /* 推荐使用新变量 */
  background: var(--ci-color-surface);
  color: var(--ci-color-text-primary);
  border: 1px solid var(--ci-color-border-subtle);
  border-radius: var(--ci-shape-md);
  padding: var(--ci-spacing-lg);
  box-shadow: var(--ci-elevation-sm);
  transition: all var(--ci-motion-duration-fast) var(--ci-motion-easing-standard);
}

.my-card:hover {
  box-shadow: var(--ci-elevation-md);
}

/* 旧代码兼容（不推荐新代码使用） */
.legacy-button {
  background: var(--primary-color);
  border-radius: var(--ci-shape-sm);
}
```

## 主题定制指南

### 创建自定义主题（3 种方式）

#### 方式一：通过 registerTheme 注册（推荐用于变体）

```javascript
import { getThemeEngine } from '@/core/theme-engine';

var engine = getThemeEngine();

engine.registerTheme('ocean', {
  name: '海洋蓝',
  type: 'light',
  tokens: {
    color: {
      primary: '#0EA5E9',
      primaryLight: '#38BDF8',
      primaryDark: '#0284C7',
      background: '#F0F9FF',
      surface: '#FFFFFF'
    }
  }
});

engine.setTheme('ocean');
```

#### 方式二：通过扩展主题包（推荐用于分发）

创建 `theme-extensions/ocean/` 目录：

```
theme-extensions/ocean/
├── manifest.json
├── apply.js
├── tokens.js
└── README.md
```

启动时 `theme-extension-loader.js` 会自动扫描并加载，详见 [扩展主题开发](#扩展主题开发)。

#### 方式三：通过主题目录（推荐用于内置主题）

在 `themes/` 顶级目录创建新主题子目录：

```
themes/ocean/
├── manifest.json
└── tokens.js
```

`theme-loader.js` 启动时扫描 `themes/*/manifest.json` 加载。

### 主题定制步骤

完整创建自定义主题的步骤：

1. **设计 token**：根据设计稿定义颜色、圆角、间距、字号、缓动等 token
2. **选择注册方式**：变体用 `registerTheme`，分发用扩展主题包，内置用 `themes/` 目录
3. **编写 tokens.js**：导出 token 对象（结构需符合 `flattenTokens` 展平规则）
4. **编写 manifest.json**（仅扩展主题与内置主题）：声明主题元数据
5. **注册到引擎**：通过 `registerTheme` 或自动加载
6. **测试切换**：调用 `setTheme(id)` 验证视觉效果
7. **持久化验证**：刷新页面确认主题被正确恢复

::: tip flattenTokens 展平规则
token 对象的嵌套结构会被展平为 `--ci-{category}-{key}-{subkey}` 格式（驼峰转 kebab-case）：
- `color.primary` → `--ci-color-primary`
- `color.surfaceRaised` → `--ci-color-surface-raised`
- `motion.durationFast` → `--ci-motion-duration-fast`
:::

### 示例：考试模式主题

```javascript
import { getThemeEngine } from '@/core/theme-engine';

var engine = getThemeEngine();

// 极简、低干扰、无动画的考试模式
engine.registerTheme('exam', {
  name: '考试模式',
  type: 'light',
  tokens: {
    color: {
      primary: '#6B7280',     // 中性灰主色
      background: '#FAFAFA',
      surface: '#FFFFFF'
    }
  }
});

function startExamMode() {
  engine.setTheme('exam');
  engine.setMotionEnabled(false);  // 关闭所有动画
}
```

## 扩展主题开发

源码：`client/src/core/theme-extension-loader.js` + `theme-extensions/`

扩展主题是 ClassIntra 的核心扩展能力，第三方可以创建独立的主题包，通过 `theme-extensions/` 目录加载。

### 目录结构

```
theme-extensions/material-you/
├── manifest.json       # 主题元数据
├── apply.js            # 应用逻辑（注册到 ThemeEngine）
├── tokens.js           # Token 定义
└── README.md           # 说明文档
```

### manifest.json

```json
{
  "id": "material-you",
  "name": "Material You",
  "version": "1.0.0",
  "description": "Material You 动态色主题",
  "author": "ClassIntra Community",
  "type": "extension",
  "light": {
    "id": "material-you-light",
    "name": "Material You Light"
  },
  "dark": {
    "id": "material-you-dark",
    "name": "Material You Dark"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 扩展唯一 ID |
| `name` | `string` | 是 | 显示名称 |
| `version` | `string` | 是 | 版本号 |
| `description` | `string` | 否 | 描述 |
| `author` | `string` | 否 | 作者 |
| `type` | `'extension'` | 是 | 固定为 `extension` |
| `light` | `object` | 是 | 浅色主题配置（`id`、`name`） |
| `dark` | `object` | 是 | 深色主题配置（`id`、`name`） |

### apply.js

扩展主题的入口，由 `theme-extension-loader.js` 在加载时调用。

```javascript
// theme-extensions/material-you/apply.js
import tokens from './tokens.js';

export default function apply(engine, manifest) {
  // 注册浅色主题
  engine.registerTheme(manifest.light.id, {
    name: manifest.light.name,
    type: 'light',
    tokens: tokens.light
  });

  // 注册深色主题
  engine.registerTheme(manifest.dark.id, {
    name: manifest.dark.name,
    type: 'dark',
    tokens: tokens.dark
  });

  // 可选：注册扩展状态（用于动态色注入）
  engine.registerExtensionState({
    extensionId: manifest.id,
    lightId: manifest.light.id,
    darkId: manifest.dark.id,
    manifest: manifest,
    applyFn: apply,
    buildTokensFn: function(seedColor, type) {
      // 基于种子色动态生成色板
      return generatePaletteFromSeed(seedColor, type);
    }
  });
}

function generatePaletteFromSeed(seedColor, type) {
  // 实现动态色生成逻辑（HSL 明度调整）
  return {
    color: {
      primary: seedColor,
      primaryLight: lighten(seedColor, 0.15),
      primaryDark: darken(seedColor, 0.15)
    }
  };
}
```

### tokens.js

```javascript
// theme-extensions/material-you/tokens.js
export default {
  light: {
    color: {
      primary: '#6750A4',
      primaryLight: '#7E5DCC',
      primaryDark: '#4F3D7E',
      background: '#FEF7FF',
      surface: '#FFFFFF',
      surfaceRaised: '#F7F2FA'
    }
  },
  dark: {
    color: {
      primary: '#D0BCFF',
      primaryLight: '#E5DDFF',
      primaryDark: '#A794E6',
      background: '#141218',
      surface: '#211F26',
      surfaceRaised: '#2C2A33'
    }
  }
};
```

### 加载流程

`theme-extension-loader.js` 在应用启动时的执行流程：

1. 扫描 `theme-extensions/*/manifest.json` 文件
2. 解析 manifest，校验 `type === 'extension'`
3. 动态 `import()` 扩展的 `apply.js`
4. 调用 `apply(engine, manifest)` 注册主题到 ThemeEngine
5. 可选：注册扩展状态，用于后续 `setDynamicColor` 动态色注入

::: warning 异步加载
扩展主题使用动态 `import()` 异步加载，加载完成后才会注册到 ThemeEngine。若用户在加载完成前切换到该主题，ThemeEngine 会回退到 `light` 并在加载完成后自动切换。
:::

### 动态色注入

扩展主题支持动态色注入：通过 `ThemeEngine.setDynamicColor(seedColor)` 重新生成色板。

```javascript
import { getThemeEngine } from '@/core/theme-engine';

var engine = getThemeEngine();

// 假设当前主题为 material-you-light
engine.setDynamicColor('#FF6B6B');
// 内部流程：
// 1. 读取当前主题对应的扩展状态
// 2. 调用 buildTokensFn('#FF6B6B', 'light') 生成新 token
// 3. 重新调用 registerTheme 更新 token
// 4. 若当前主题是该扩展主题，立即重新写入 --ci-color-* 变量
```

::: tip 动态色应用场景
- 用户从相册选取壁纸颜色，自动生成匹配的主题色
- 季节性主题（春节红、圣诞绿）
- 班级品牌色定制
:::

### 完整示例：Material You 扩展

参考 `theme-extensions/material-you/`，已实现：

- 浅色 / 深色双主题注册
- 基于种子色的动态色板生成
- README 说明文档

```javascript
// 使用示例
import { getThemeEngine } from '@/core/theme-engine';

var engine = getThemeEngine();

// 切换到 Material You 浅色主题
engine.setTheme('material-you-light');

// 动态注入种子色
engine.setDynamicColor('#FF9800');

// 切换到深色变体
engine.setTheme('material-you-dark');
```

## 相关文档

- [UI & 主题](./)：三大支柱总览
- [组件库](./components)：消费 `--ci-*` 变量的所有 UI 组件
- [图标系统](./icons)：应用图标规范与 `--ci-shape-lg`
- [核心概念 — 主题系统](/concepts/theme-system)：架构与初始化时机
- [API 参考 — 前端 API → ThemeEngine](/api/client#themeengine)：方法签名
- [开发指南 — 第三方应用开发](/development/third-party)：在应用中使用主题
