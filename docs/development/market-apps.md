---
title: 市场应用生命周期

description: ClassIntra 第三方市场应用的安装、运行、更新、启用、禁用、卸载和五子棋示例。含能力披露、角色可见性与提交前静态审查。
---

# 市场应用生命周期

ClassIntra 市场应用是独立于官方内置应用的第三方应用包。班管负责安装、更新和卸载，班级成员通过实时同步获得统一的应用状态。

::: tip 先读开发指南
本页讲**生命周期与管控**。写应用本身（兼容红线、令牌、`context.*`）请看 [第三方应用开发](./third-party)。
:::

## 相关仓库

- [ClassIntra 主仓库](https://github.com/ClassIntra/ClassIntra)
- [ClassIntra 文档仓库](https://github.com/ClassIntra/classintra.github.io)
- [ClassIntra 市场仓库](https://github.com/ClassIntra/market)
- [五子棋应用目录](https://github.com/ClassIntra/market/tree/main/apps/gomoku)

## 用户如何获取应用

用户不需要克隆或下载整个 `market` 仓库，也不需要 ClassIntra 官方提供一台公共服务器。运行 ClassIntra 的班级服务器会直接读取 GitHub Raw 上的 catalog，并按应用文件清单逐个下载：

```text
https://raw.githubusercontent.com/ClassIntra/market/main/index.json
https://raw.githubusercontent.com/ClassIntra/market/main/apps/gomoku/manifest.json
```

应用文件下载到班级服务器的本地运行时目录后，前端和后端都从本地加载。GitHub 只承担公开文件托管和版本来源，ClassIntra 负责安装、缓存、更新和卸载。

## 安装流程

1. 市场目录从 Local 或 GitHub source 读取 `index.json`。
2. 服务端校验应用名、manifest、文件路径、文件数量和文件大小。
3. 服务端校验 `sdk` 版本、能力声明、角色白名单与布局偏好（详见下节）。
4. 应用先写入临时目录，再原子替换运行时目录。
5. 服务端热挂载应用后端路由。
6. 客户端刷新市场注册表和动态路由。
7. 应用出现在桌面入口，并可按需加载前端脚本和样式。

安装不要求重启服务。

## 安装前校验：能力披露与约束

ClassIntra 采**开放模型**——不设沙箱，不拦截能力调用。但安装前仍会做四类校验，目的是**把问题说清楚**而不是静默失败。

| 校验项 | 行为 |
|---|---|
| `sdk` 版本 | 高于当前系统主版本 → **阻断安装**，提示升级 ClassIntra |
| `capabilities` | 未知能力名 → **警告**（不阻断），披露不准确但不影响运行 |
| `visibleRoles` | 未知角色名 → **阻断安装**（会产生「谁都看不到」的静默 bug） |
| `layout.mode` | 不在枚举中 → **阻断安装** |

### 能力披露展示

`capabilities` 字段用于在安装确认页向班管展示「这个应用会用到什么」。**它是披露，不是权限申请**——不声明也能调用，只是审核与信任链会缺一环。

十六项已知能力清单见 [第三方应用开发 § capabilities](./third-party#capabilities-能力披露)。

### 角色可见性

`visibleRoles` 控制哪些角色能看到该应用：

```json
{ "visibleRoles": ["admin", "officer"] }
```

合法值：`admin` / `officer` / `student`。空数组 = 全部可见。

::: warning 未知角色名会阻断安装
写错角色名（如 `"teacher"`）会导致应用对所有人不可见，且不报错——所以在安装阶段就拦截。合法值只有这三个。
:::

## 提交前静态审查

仓库提供审查脚本，用于在提交市场前自查：

```bash
# 从 ClassIntra 主仓库根目录运行
node scripts/market-review.mjs <应用目录>

# 机器可读输出
node scripts/market-review.mjs market-apps/gomoku --json
```

脚本按五组检查：

| 组 | 检查内容 |
|---|---|
| A. manifest | 必填字段、路由前缀、`sdk` 版本、能力/角色合法性 |
| B. Chrome 80 语法 | `const`/`let`/箭头函数/模板字符串/`?.`/`??`/`class`/`async` |
| C. CSS 兼容 | flex `gap`、`:is()`、`aspect-ratio`、`transition: all`、布局属性过渡、自造圆角与曲线 |
| D. 危险 API | `eval`、`new Function`、`innerHTML` 直插、`document.write` |
| E. 资源回收 | 用了监听器/定时器/实时订阅却未调 `context.app.onDestroy` |

输出示例：

```text
市场应用静态审查: market-apps/gomoku
============================================================

能力披露（安装页将向班管展示）
------------------------------------------------------------
  · data.http
  · data.realtime
  · data.storage
  · ui.toast
  · ui.modal
  · app.storage
布局模式: fullscreen
所需 SDK: v1

============================================================
错误 0 项，警告 0 项
未发现问题。
```

::: info 这是审查辅助，不是运行时隔离
脚本只做静态扫描。它帮你在提交前发现问题，**不在运行期拦截任何行为**。同页面自由模型下，最终责任在开发者。
:::

## 本地开发与双仓同步

market-apps 前端是**直出型**：服务器从 `/market-static/<name>/` 以 no-cache 头直接下发源码文件，**没有构建步骤**——保存后刷新浏览器即生效。因此本地开发循环非常短：

```bash
# 边改边查：自动跑 Chrome 80 兼容 lint，文件变化时重跑并提示刷新（防抖 300ms）
node scripts/build-app.js my-app --watch

# backend/ 有改动时单独提示需重启服务器（或用 CLASSINTRA_HOT_RELOAD=1 启动实现后端热重载）
```

完整的开发循环（生成骨架 → 直出调试 → 静态审查 → 双仓同步）见 [第三方应用开发 § 开发循环速查](./third-party#开发循环速查)。

::: info 双仓模型（市场维护者）
主仓 `.gitignore` 忽略 `plugins/` 与 `market-apps/`，插件与市场应用文件只进 market 仓。在主仓工作区开发后必须用 `.\scripts\sync-market.ps1 -App <name> [-Commit "msg"]` 镜像同步到 market 仓 `apps/<name>/`（robocopy `/MIR`，退出码 0–7 视为成功），再推 market 仓发布 catalog。命令详见 [CLI 工具 § 市场双仓同步](./cli#市场双仓同步-sync-market-市场维护者)。
:::

## 运行时协议

市场前端入口通过全局 SDK 注册定义：

```javascript
window.ClassIntraMarket.define({
  name: 'example',
  mount: function(container, context) {
    container.textContent = 'Hello ClassIntra';
  },
  unmount: function(container) {
    container.replaceChildren();
  }
});
```

`context` 按能力域分层（`app` / `data` / `ui` / `system` / `device` / `theme` / `router`），完整签名见 [SDK 参考 § 运行时 context](./sdk#运行时-context)。

应用必须实现可重复挂载和可安全卸载。所有监听器、定时器与实时订阅**必须**在 `context.app.onDestroy` 中回收——卸载后的残留会直接表现为界面卡顿。

## 动态路由与直接访问

市场应用注册是异步过程。直接访问尚未注册的市场路由时，Vue Router 可能先命中通配路由。入口会保存浏览器初始路径，在市场 registry 刷新并注册动态路由后恢复原始路径。

因此下面的访问方式都应进入应用运行时：

```text
http://127.0.0.1:5174/gomoku
```

运行时加载失败时显示统一的加载或错误状态，并提供重试和返回桌面操作。

## 图标与静态资源代理

市场安装的应用/插件，其 `manifest.icon` 与静态资源路径**不走源站直连**：安装时市场服务会把相对路径统一改写为 `/api/market/asset?source=<源>&path=<路径>` 格式，由 ClassIntra 服务器中转下发。

- 开发者在 manifest 里照常写相对路径（如 `icon.png`），无需感知代理细节
- 好处：图标与应用安装包同源校验、避免浏览器相对路径解析导致的 404、路径穿越防护与 SVG CSP 均在服务端统一收口
- 图标加载失败时桌面显示占位拼图图标，不会留空白色块

## 班级统一管控

启用/禁用是班级统一状态。班管修改状态后，服务端广播：

```json
{
  "type": "market_app_control_changed",
  "appName": "gomoku",
  "enabled": false,
  "updatedBy": "999999"
}
```

客户端收到事件后刷新：

- 市场 registry；
- 动态路由；
- 桌面布局；
- Dock；
- 文件夹；
- 小组件；
- 当前运行实例。

正在使用被禁用应用的成员会自动返回桌面。普通成员不需要自行安装或维护应用包。

## 更新与卸载

更新使用相同的 manifest 和文件校验，并进行原子替换；成功后重新加载新版本 JS/CSS，不重启服务。

卸载时清理：

- 当前运行实例；
- 动态后端路由；
- 前端脚本；
- 前端样式；
- 桌面、Dock、文件夹和小组件入口；
- 动态路由映射。

已卸载应用的 API 返回 JSON 404，而不是前端 `index.html`。

## 五子棋示例

五子棋应用位于 `market/apps/gomoku`，manifest 包含：

```json
{
  "name": "gomoku",
  "version": "1.0.0",
  "frontend": {
    "route": "/gomoku",
    "entry": "./frontend/entry.js",
    "style": "./frontend/style.css"
  },
  "backend": {
    "mountPath": "/api/gomoku",
    "entry": "./backend/routes.js"
  }
}
```

接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/gomoku/state` | 查询 15×15 棋盘状态 |
| POST | `/api/gomoku/move` | 使用 `row`、`col` 落子 |
| POST | `/api/gomoku/reset` | 重置棋局 |

错误状态包括非法坐标 `400`、重复落子或结束棋局 `409`、禁用/卸载后的 `404`。

## 验证

服务端：

```bash
cd server
pnpm test
```

客户端：

```bash
cd client
pnpm run build
```

浏览器验收至少包括：直接访问、棋盘渲染、落子、重开、离开、启用、禁用、更新、卸载，以及卸载后的 API/静态资源 404。

## 致谢与来源

五子棋市场应用的游戏方向、交互参考和部分实现思路来自 [MoyuZJ912/iFlyCompass](https://github.com/MoyuZJ912/iFlyCompass)。感谢 iFlyCompass 提供的开源代码和产品探索，为 ClassIntra 第三方应用生态建设提供了有价值的参考。

ClassIntra 的市场协议、市场目录、动态运行时、班级统一管控和生命周期实现由 ClassIntra 项目独立完成。使用或再分发相关代码时，请遵守各自仓库的许可证和署名要求。
