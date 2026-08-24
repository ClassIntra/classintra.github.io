---
title: 市场应用生命周期

description: ClassIntra 第三方市场应用的安装、运行、更新、启用、禁用、卸载和五子棋示例。
---

# 市场应用生命周期

ClassIntra 市场应用是独立于官方内置应用的第三方应用包。班管负责安装、更新和卸载，班级成员通过实时同步获得统一的应用状态。

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
3. 应用先写入临时目录，再原子替换运行时目录。
4. 服务端热挂载应用后端路由。
5. 客户端刷新市场注册表和动态路由。
6. 应用出现在桌面入口，并可按需加载前端脚本和样式。

安装不要求重启服务。

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

`context` 提供 HTTP API、路由、用户、主题、事件总线、提示和弹窗能力。应用必须实现可重复挂载和可安全卸载，不能把事件监听器或定时器遗留在全局页面中。

## 动态路由与直接访问

市场应用注册是异步过程。直接访问尚未注册的市场路由时，Vue Router 可能先命中通配路由。入口会保存浏览器初始路径，在市场 registry 刷新并注册动态路由后恢复原始路径。

因此下面的访问方式都应进入应用运行时：

```text
http://127.0.0.1:5174/gomoku
```

运行时加载失败时显示统一的加载或错误状态，并提供重试和返回桌面操作。

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
