---
title: 主题开发
description: ClassIntra 主题开发指南，覆盖内置主题（themes/ 目录、manifest + tokens.js）、Token 结构（color/shape/shadow/motion）、扩展主题（theme-extensions/、classintra-theme-extension/v1 schema、apply.js 入口、动态色彩）与完整创建流程。
---

# 主题开发

ClassIntra 的主题系统基于 **CSS 变量 + 结构化 Token**，分两类：

- **内置主题**：`themes/` 目录下的 `light` / `dark`，启动时加载，缺一不可
- **扩展主题**：`theme-extensions/` 目录下的独立安装包（如 Material You），按需加载，支持动态色彩

源码位置：`client/src/core/theme-loader.js`、`client/src/core/theme-extension-loader.js`、`client/src/core/ThemeEngine.js`、`shared/src/theme-extension-schema.js`

## 工作原理

```
themes/*/manifest.json ──→ theme-loader.js ──→ ThemeEngine（单例）
                                                    │ registerTheme(id, {type, tokens})
theme-extensions/*/manifest.json                    │ flattenTokens → --ci-* CSS 变量
        │                                           │ 写入 <html> inline style
        └─→ theme-extension-loader.js               │
              验证 schema → apply(engine, manifest) ┘
```

1. **加载**：`theme-loader.js` 用 `import.meta.glob` eager 加载所有 `themes/*/manifest.json` 与 `tokens.js`
2. **注册**：ThemeEngine 构造时调用 `registerTheme(id, { name, type, tokens, icons })`
3. **应用**：`flattenTokens` 把结构化 token 展平为 `--ci-*` CSS 变量，写入 DOM inline style
4. **切换**：`setTheme(id)` 切换主题，带加载动画；`setDynamicColor(extensionId, seed)` 重算动态色

::: tip Token 双写兼容
`--ci-*` 变量同时驱动新代码与旧代码（旧代码用 `--primary-color` 等别名，由 global.scss 的 `var(--ci-*, fallback)` 自动跟随）。
:::

## Token 结构

主题 tokens 是结构化 JS 对象，分四个维度（静态变量如 font/spacing/z 不进入主题，硬编码在 global.scss）：

```javascript
// themes/<id>/tokens.js
var TOKENS = {
  color: {
    primary: '#0A84FF',
    primaryHover: '#409CFF',
    primaryPressed: '#0066CC',
    primaryRgb: '10, 132, 255',       // 供 rgba() 使用的 R,G,B 字符串
    accent: {                          // 应用强调色
      music: '#FF2D55',
      weather: '#4A90D9'
    },
    semantic: {                        // 语义色
      success: '#34C759',
      warning: '#FF9500',
      danger: '#FF3B30',
      info: '#5AC8FA'
    },
    bg: { base: '#000000', card: '#1C1C1E' },
    text: { primary: '...', secondary: '...' },
    border: { default: '...' },
    glass: { dock: '...', island: '...' },        // iOS 材质
    onWallpaper: { text: '#FFFFFF' }              // 壁纸上的前景
  },
  shape: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '20px', '2xl': '24px', '3xl': '28px', pill: '9999px' },
  shadow: { sm: '...', md: '...', lg: '...', xl: '...' },
  motion: {
    easeStandard: 'cubic-bezier(0.32,0.72,0,1)',
    easeSpring: 'cubic-bezier(0.34,1.56,0.64,1)'
  }
};

export default TOKENS;
```

展平后的 CSS 变量命名规则：

| 结构化路径 | CSS 变量 |
|-----------|---------|
| `color.primary` | `--ci-color-primary` |
| `color.accent.music` | `--ci-color-accent-music` |
| `shape.md` | `--ci-shape-md` |
| `motion.easeSpring` | `--ci-motion-ease-spring` |

## 创建内置主题

内置主题必须成对提供 light/dark 变体认知（每个主题只声明一种 `type`）。

### 1. 创建目录

```
themes/ocean/
├── manifest.json
└── tokens.js
```

### 2. manifest.json

```json
{
  "id": "ocean",
  "name": "海洋",
  "type": "dark",
  "version": "1.0.0",
  "description": "深海蓝色调深色主题",
  "tokens": "./tokens.js",
  "icons": null
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 是 | 主题唯一标识，**不能是 `light` / `dark`**（与内置冲突） |
| `name` | 是 | 设置页显示名 |
| `type` | 是 | `light` 或 `dark`（加载器强校验，其他值跳过） |
| `tokens` | 是 | token 文件路径，导出结构化对象 |

### 3. tokens.js

从现有主题复制后修改（保持键结构完整，缺失的键会导致对应组件回退到 fallback 值）：

```bash
# 以 dark 为底稿
cp themes/dark/tokens.js themes/ocean/tokens.js
```

重点调整 `color.primary*`、`color.accent.*`、`color.bg.*`、`color.glass.*` 四组；`shape` / `shadow` / `motion` 通常沿用。

### 4. 验证

重启 dev server 后设置页「主题」出现「海洋」选项，切换后：

- ✅ 控制台无 `[theme-loader]` 警告
- ✅ 主色、背景、强调色变化
- ✅ 深色主题下文字对比度足够

::: warning 必须成对
内置主题体系要求 light/dark 两个变体。如果你的主题只有一种模式，建议发布为**扩展主题**（`colorMode: 'both'` 由 apply.js 注册两个变体）。
:::

## 创建扩展主题

扩展主题是独立安装包，与内置主题互不影响，支持动态色彩。参考实现：`theme-extensions/material-you/`。

### 1. 目录结构

```
theme-extensions/my-theme/
├── manifest.json        # 必填，schema 声明
├── apply.js             # 必填，应用入口
├── tokens.js            # 可选，静态 token（shape/motion 等）
└── dynamic-color.js     # type=dynamic 时必填，动态色生成
```

### 2. manifest.json

```json
{
  "schema": "classintra-theme-extension/v1",
  "id": "my-theme",
  "name": "我的主题",
  "version": "1.0.0",
  "description": "自定义扩展主题",
  "kind": "extension",
  "engine": { "min": "1.0.0" },
  "base": "auto",
  "type": "static",
  "colorMode": "both",
  "shape": {
    "xs": "4px", "sm": "8px", "md": "12px",
    "lg": "16px", "xl": "20px", "2xl": "24px",
    "3xl": "28px", "pill": "9999px"
  },
  "motion": {
    "easeStandard": "cubic-bezier(0.2, 0, 0, 1)",
    "easeEmphasized": "cubic-bezier(0.3, 0, 0, 1)"
  },
  "entry": "./apply.js",
  "tokens": "./tokens.js",
  "icons": null
}
```

### manifest 字段校验规则

由 `shared/src/theme-extension-schema.js`（`classintra-theme-extension/v1`）校验：

| 字段 | 必填 | 校验规则 |
|------|------|---------|
| `schema` | 是 | 必须为 `classintra-theme-extension/v1` |
| `id` | 是 | 唯一标识，**禁止 `light` / `dark`**（防覆盖内置） |
| `name` | 是 | 显示名 |
| `entry` | 是 | 入口文件路径 |
| `type` | 是 | `static` 或 `dynamic` |
| `dynamicColor` | type=dynamic 时必填 | 动态色模块路径 |
| `base` | 否 | `auto` = 继承当前 light/dark，仅覆盖声明的维度 |
| `colorMode` | 否 | `light` / `dark` / `both` |
| `defaultSeed` | type=dynamic 时建议 | 默认种子色 `#RRGGBB` |

校验失败会在控制台打印 `[theme-extension-loader] manifest 验证失败` 并跳过该扩展。

### 3. apply.js 入口

`apply(engine, manifest, options)` 由加载器调用，负责向 ThemeEngine 注册主题：

```javascript
// theme-extensions/my-theme/apply.js
import { TOKENS } from './tokens.js';

function apply(engine, manifest, options) {
  options = options || {};
  var extensionId = manifest.id;

  // 注册浅色变体
  engine.registerTheme(extensionId + '-light', {
    name: manifest.name + ' 浅色',
    type: 'light',
    tokens: TOKENS.light,   // 结构化 token
    icons: null
  });

  // 注册深色变体
  engine.registerTheme(extensionId + '-dark', {
    name: manifest.name + ' 深色',
    type: 'dark',
    tokens: TOKENS.dark,
    icons: null
  });

  // options.apply 为 true 时立即切换（跟随当前明暗模式）
  if (options.apply) {
    var currentType = engine.getCurrentThemeType ? engine.getCurrentThemeType() : 'light';
    engine.setTheme(currentType === 'dark' ? extensionId + '-dark' : extensionId + '-light');
  }

  return [extensionId + '-light', extensionId + '-dark'];
}

export { apply };
```

### 4. 动态色彩（type: dynamic）

动态主题需要额外提供 `dynamicColor` 模块与 `engine.registerExtension`：

```javascript
// apply.js（动态主题部分）
engine.registerExtension(extensionId, {
  seedColor: seed,
  lightId: lightId,
  darkId: darkId,
  manifest: manifest,
  // 引擎调用此函数重算 token（用户换种子色时）
  buildTokens: function(isDark, newSeed) {
    return generateTokens(newSeed || seed, isDark);
  }
});
```

用户切换种子色：

```javascript
// 前端调用：重算 tokens，若当前主题是扩展变体则立即生效
themeEngine.setDynamicColor('my-theme', '#0947FA');
```

::: tip base=auto 策略
扩展主题继承当前 light/dark 主题，仅覆盖 shape / motion / color / shadow。iOS 组件库特有 token（glass 材质、onWallpaper）自动保留，无需全部重写。
:::

### 5. Chrome 80 兼容

动态色模块必须使用 **ES5 风格**代码：无可选链（`?.`）、无空值合并（`??`）、无 BigInt、无原生 `oklch()`（用 HSL 近似 HCT 色彩空间）。

## 验证清单

- ✅ 控制台无 `[theme-loader]` / `[theme-extension-loader]` 警告
- ✅ 设置页出现新主题，切换带加载动画
- ✅ 明暗模式切换正常（扩展主题需两个变体都注册）
- ✅ 主要界面（桌面、聊天、设置、超能岛）颜色均跟随
- ✅ 动态主题：切换种子色后立即重算生效

## 下一步

- [主题系统概念](/concepts/theme-system) - 架构与设计思想
- [UI 主题定制](/ui/theme) - 使用者视角
- [小组件开发](./widgets) - 桌面小组件
