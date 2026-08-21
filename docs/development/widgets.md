---
title: 小组件开发
description: ClassIntra 桌面小组件开发指南，覆盖 manifest widgets 声明、组件规范（config / refreshKey props）、configSchema 配置表单、网格尺寸系统、布局持久化（user_settings.desktop_layout）与完整示例。
---

# 小组件开发

小组件（Widget）是显示在桌面网格中的轻量信息卡片，无需打开应用即可展示摘要内容（如最近的倒数日、今日课表）。本页面介绍如何为应用开发桌面小组件。

源码位置：`client/src/core/widget-aggregator.js`、`client/src/views/Desktop.vue`、`client/src/store/modules/desktop.js`

## 工作原理

小组件的生命周期由三部分协作完成：

```
apps/*/manifest.json          widget-aggregator.js         Desktop.vue
      │                              │                          │
      │  frontend.widgets 声明        │                          │
      ├────────────────────────────→ │                          │
      │                              │ 注册到 WIDGET_REGISTRY    │
      │                              ├────────────────────────→ │
      │                              │                          │ 渲染 <component :is>
      │                              │                          │ :config + :refresh-key
```

1. **聚合**：启动时 `widget-aggregator.js` 扫描所有 `apps/*/manifest.json`，把 `frontend.widgets` 数组中的每项注册到全局 `WIDGET_REGISTRY`
2. **渲染**：桌面（`Desktop.vue`）从布局数据中读取已添加的小组件实例，通过动态组件渲染：
   ```html
   <component :is="resolveWidget(w.type)" :config="w.config || {}" :refresh-key="widgetRefreshKey" />
   ```
3. **持久化**：布局（分页、位置、尺寸、配置）保存到服务端 `user_settings` 表的 `desktop_layout` 字段，并以 `classintra_desktop_layout` 为 key 缓存到 localStorage

## manifest 声明

小组件依附于应用，在 `manifest.json` 的 `frontend.widgets` 数组中声明：

```json
{
  "name": "my-app",
  "frontend": {
    "route": "/my-app",
    "routeName": "MyApp",
    "component": "./frontend/MyApp.vue",
    "widgets": [
      {
        "id": "my-app-widget",
        "name": "我的应用组件",
        "component": "./frontend/widgets/MyAppWidget.vue",
        "defaultSize": { "w": 2, "h": 1 },
        "minSize": { "w": 1, "h": 1 },
        "maxSize": { "w": 4, "h": 2 },
        "description": "显示我的应用摘要",
        "permission": null,
        "configSchema": {
          "fields": [
            {
              "key": "filter",
              "label": "显示范围",
              "type": "select",
              "options": [
                { "value": "all", "label": "全部" },
                { "value": "pinned", "label": "仅置顶" }
              ],
              "default": "all"
            }
          ]
        }
      }
    ]
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | string | 是 | — | 小组件唯一标识（全局，建议 `<app>-<用途>` 命名避免冲突） |
| `name` | string | 是 | — | 添加面板中显示的名称 |
| `component` | string | 是 | — | 组件文件路径（相对应用根目录） |
| `defaultSize` | object | 否 | `{w:2,h:2}` | 初始占格（宽 × 高，单位为网格格数） |
| `minSize` | object | 否 | `{w:1,h:1}` | 最小占格 |
| `maxSize` | object | 否 | `{w:4,h:4}` | 最大占格 |
| `description` | string | 否 | `''` | 添加面板中的描述文字 |
| `permission` | string\|null | 否 | `null` | 权限限制，拥有该 permission 的用户才能查看/添加（`null` 不限制） |
| `configSchema` | object | 否 | `null` | 用户可配置项表单 |

::: tip 尺寸经验值
- 单行信息条（如倒数日）：`2×1`，max `4×2`
- 列表摘要（如课表）：`2×2`，max `4×4`
- 小组件高度自适应文字溢出会被裁剪，建议 `overflow: hidden`
:::

## 组件规范

小组件组件是一个普通 Vue 组件，接收两个 props：

```vue
<!-- apps/my-app/frontend/widgets/MyAppWidget.vue -->
<template>
  <div class="my-widget">
    <div class="widget-header">
      <span class="title">{{ config.title || '我的应用' }}</span>
    </div>
    <div class="widget-body">
      <div v-for="item in items" :key="item.id" class="item">{{ item.name }}</div>
      <div v-if="!loading && items.length === 0" class="empty">暂无数据</div>
    </div>
  </div>
</template>

<script>
import api from '@/utils/api';

export default {
  name: 'MyAppWidget',
  props: {
    // 用户在配置表单中保存的值，如 { filter: 'all', count: 5 }
    config: { type: Object, default: function() { return {}; } },
    // 桌面「编辑模式」下点击刷新按钮时递增，用于重新拉取数据
    refreshKey: { type: Number, default: 0 }
  },
  data: function() {
    return { loading: true, items: [] };
  },
  methods: {
    load: function() {
      var self = this;
      self.loading = true;
      api.get('/api/my-app/items', { params: { count: self.config.count || 5 } })
        .then(function(res) {
          if (res.data.code === 200) self.items = res.data.data.items;
        })
        .finally(function() { self.loading = false; });
    }
  },
  watch: {
    // 配置变更后重新加载
    config: { handler: function() { this.load(); }, deep: true },
    // 桌面手动刷新
    refreshKey: function() { this.load(); }
  },
  mounted: function() { this.load(); }
};
</script>

<style scoped>
.my-widget {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
}
.widget-body { flex: 1; overflow-y: auto; }
</style>
```

### 规范要点

| 要点 | 说明 |
|------|------|
| **根元素占满** | 根元素设置 `height: 100%`，由桌面容器决定实际尺寸 |
| **溢出处理** | 内容超出时 `overflow: hidden` 或内部滚动，避免撑破网格 |
| **三态覆盖** | 加载中（loading）/ 空数据（empty）/ 加载失败（error）三种状态都要有 UI |
| **遵循代码风格** | Options API + `var` / `function`，与 [开发约定](./#代码风格约定) 一致 |
| **主题适配** | 颜色使用 CSS 变量（如 `var(--primary-color)`），避免硬编码导致深色模式失效 |

## configSchema 配置表单

声明 `configSchema` 后，用户长按小组件可打开配置面板，面板根据 `fields` 自动生成表单，保存的值通过 `config` prop 传回组件。

### 支持的字段类型

| type | 控件 | 附加字段 | 示例 |
|------|------|---------|------|
| `select` | 下拉选择 | `options: [{value, label}]`、`default` | 显示范围筛选 |
| `number` | 数字输入 | `default`、`min`、`max` | 显示数量 |
| `bool` | 开关 | `default` | 是否显示头像 |
| `text` | 文本输入 | `default`、`placeholder` | 自定义标题 |

### 完整示例

```json
"configSchema": {
  "fields": [
    {
      "key": "filter",
      "label": "显示范围",
      "type": "select",
      "options": [
        { "value": "all", "label": "全部" },
        { "value": "pinned", "label": "仅置顶" },
        { "value": "today", "label": "仅今天" }
      ],
      "default": "all"
    },
    {
      "key": "count",
      "label": "显示数量",
      "type": "number",
      "default": 5,
      "min": 1,
      "max": 20
    },
    {
      "key": "showAvatar",
      "label": "显示头像",
      "type": "bool",
      "default": true
    }
  ]
}
```

::: tip 读取配置
组件内用 `this.config.<key>` 读取，如 `this.config.count || 5`。未配置时取字段的 `default`，建议在组件内再做一次兜底。
:::

## 布局持久化

小组件布局由 Vuex `desktop` 模块管理：

| 操作 | 实现方式 |
|------|---------|
| 添加 / 删除 | `dispatch('desktop/addWidget')` / `dispatch('desktop/removeWidget')` |
| 拖拽排序 / 缩放 | 桌面编辑模式，写入布局数据 |
| 保存 | `POST /user/settings`，body 为 `{ desktop_layout: layout }` |
| 读取 | 用户信息接口返回 `desktop_layout`，本地缓存 key 为 `classintra_desktop_layout` |

布局数据结构（简化）：

```json
{
  "pages": [
    {
      "id": "page-1",
      "widgets": [
        { "id": "w-1680000000000", "type": "countdown", "config": { "filter": "all" }, "size": { "w": 2, "h": 1 } }
      ]
    }
  ]
}
```

其中 `type` 对应 manifest 中的小组件 `id`，`config` 为用户保存的配置值。

## 动态注册（插件预留）

`widget-aggregator.js` 导出 `registerWidget(manifest)` 供插件在运行时动态注册小组件：

```javascript
import { registerWidget } from '@/core/widget-aggregator';

registerWidget({
  id: 'my-plugin-widget',
  name: '插件小组件',
  component: function() { return import('./MyPluginWidget.vue'); },
  defaultSize: { w: 2, h: 1 },
  configSchema: null
});
```

`component` 需为返回 Promise 的懒加载函数（与 manifest 声明的组件一致）。重复 `id` 会覆盖旧注册并打印警告。

## 验证清单

- ✅ `pnpm build` 无错误
- ✅ 桌面进入编辑模式，添加面板出现你的小组件
- ✅ 添加后正常渲染，拖拽 / 缩放在 min/max 范围内
- ✅ 修改配置并保存，`config` prop 更新且数据重新加载
- ✅ 清空数据源后显示空状态，断开后端显示错误状态
- ✅ 深色 / 浅色主题下颜色均正常

## 下一步

- [第三方应用开发](./third-party) - 完整应用开发流程
- [插件开发](./plugins) - 联动插件与动态注册
- [主题开发](./themes) - 内置主题与扩展主题
