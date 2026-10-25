---
title: web-proxy 插件（超能岛浏览器兼容模式）
description: ClassIntra web-proxy 插件：为 Chrome 80/X5 等老内核平板提供网页能力的静态反代与兼容模式（服务端无头渲染画面流），含架构、协议、资源治理与管理端点。
outline: [2, 3]
---

# web-proxy 插件（超能岛浏览器兼容模式）

`web-proxy` 是随主程序内置的插件（当前 v1.0.16，挂载 `/api/web-proxy`，随主程序自动启动；`WEB_PROXY_AUTOSTART=0` 可关闭），为**超能岛浏览器**提供两层网页能力：

1. **静态反代**：把任意网页剥掉 `X-Frame-Options` / CSP 等禁止内嵌的头，供超能岛浏览器以 iframe 直接内嵌；
2. **兼容模式**：面向 Chrome 80 / 腾讯 X5 等老内核无法运行现代网页的场景，由**服务端无头渲染**页面并推流画面，客户端只负责画布绘制与触控回传。

ClassIntra 桌面必须兼容 Chrome 80（见 [Chrome 80 兼容](./chrome-80-compat)），但外部网页早已普遍依赖新语法与新版 API。兼容模式把这些网页的执行环境挪到服务器侧的完整版浏览器里，平板上只跑一个轻量「远程画面」客户端。

## 架构与代码位置

插件源码位于主仓库 `plugins/web-proxy/`，运行时随 `plugins/` 目录由聚合器扫描挂载：

```
plugins/web-proxy/
├── manifest.json            # type: plugin，挂载 /api/web-proxy
├── backend/
│   ├── proxy-server.js      # 静态反代服务（独立端口 9101）
│   ├── render.js            # 兼容模式：无头浏览器生命周期 + CDP 推流
│   ├── routes.js            # 控制端点（status / start / stop / sessions）
│   ├── hook.js / rewrite.js # 注入与改写辅助
│   └── audio-inject.js      # 页面音频采集注入
├── frontend/bridge.js       # 宿主侧桥接
└── shared/contract.js       # iframe 联动契约 v1.0
```

客户端契约代码：

| 位置 | 职责 |
| --- | --- |
| `shared/contract.js` | 契约 v1.0：消息通道与结构定义（宿主与 iframe 共享） |
| `frontend/bridge.js` | 宿主侧桥接模块 |
| `client/src/integrations/web-proxy-client.js` | 超能岛浏览器侧集成入口（postMessage 协议） |

## 静态反代

静态反代是独立于主程序的 HTTP 服务，默认端口 **9101**（占用自动顺延，最多到 9105），路径规则：

```text
http://<host>:9101/<scheme>/<host>/<path>
# 例：https://example.com/a/page → http://<host>:9101/https/example.com/a/page
```

- 反代时剥离 `X-Frame-Options`、`Content-Security-Policy` 等阻止 iframe 内嵌的响应头；
- 超能岛浏览器以 iframe 引用该地址即可内嵌大多数站点；
- 兼容模式下页内跳转产生的子资源请求同样经由该端口回源。

## 兼容模式工作方式

兼容模式**复用本机已安装的 Edge / Chrome**（headless，`--remote-debugging-port=0`），**不下载 Chromium**——只要服务器上装了现代浏览器即可启用。服务端通过 CDP 驱动页面渲染，把画面推流给客户端。

客户端连 `ws://<host>:9101/__render__?url=&w=&h=&dpr=&touch=&uid=&uname=` 建立渲染会话：

- **画面**：二进制 JPEG 帧（`binaryType = arraybuffer`），客户端直接 `canvas` 绘制；
- **控制**：JSON 文本帧（触摸、缩放、按键等上行指令与 `page-info` 等下行事件）。

| 特性 | 说明 |
| --- | --- |
| 触摸仿真 + 移动 UA | `touch=1` 时启用触摸事件仿真并携带移动端 User-Agent |
| 双指缩放 | 1–3 倍 |
| 声音 | 可选开关，**默认关**；开启后页面音频以 24kHz 单声道 PCM（约 43ms/包）经 CDP 回传 |
| 自适应画质 | JPEG 质量三档 55 / 48 / 40，持续丢帧自动降档、稳定后回升 |
| 页内导航 | 点击链接跟随跳转，`page-info` 上报真实 URL 与标题 |
| 断线重连 | WS 断开后自动重连并恢复会话 |
| 视口自适应 | 客户端视口下发（320–1600 × 320–1200，DPR ≤ 2，缺省 1280×800） |

## 资源治理

无头浏览器是重资源进程，插件内置三道闸门：

| 规则 | 值 |
| --- | --- |
| 单会话上限 | 3（超过后新会话被拒绝） |
| 单会话回收 | 3 分钟无操作自动回收 |
| 浏览器进程退出 | 90 秒无任何会话自动退出浏览器 |

## 启用条件与管理端点

入口显隐由状态接口驱动：超能岛浏览器顶栏的「兼容模式」按钮，**仅当** `GET /api/web-proxy/status` 返回 `render.available` 为真时显示（即服务器上探测到了可用的 Edge / Chrome）。

管理端点（均要求管理员，`requireAdmin`）：

| 端点 | 说明 |
| --- | --- |
| `POST /api/web-proxy/start` | 启动渲染服务 |
| `POST /api/web-proxy/stop` | 停止渲染服务 |
| `GET /api/web-proxy/sessions` | 查看当前渲染会话 |
| `POST /api/web-proxy/sessions/close-all` | 关闭全部会话 |
| `POST /api/web-proxy/sessions/:id/close` | 关闭指定会话 |

## 与 Chrome 80 兼容页的关系

静态反代与兼容模式解决的是「外部网页跑不跑得起来」；ClassIntra 自身应用与市场应用的兼容红线（ES5 语法、CSS 降级）见 [Chrome 80 兼容](./chrome-80-compat)。给第三方应用选接入方式时可参考：

| 场景 | 建议 |
| --- | --- |
| 目标站点无反爬、无需执行复杂脚本 | 静态反代 + iframe 内嵌 |
| 目标站点依赖现代 JS 框架、老内核白屏 | 兼容模式（服务端渲染推流） |
| 站点提供开放 API | 不内嵌，直接用 `context.data.http` 拉数据自建 UI |
