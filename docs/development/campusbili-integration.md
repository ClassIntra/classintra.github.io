---
title: CampusBili 集成
description: ClassIntra 内嵌 CampusBili 的免密码访问、返回导航和分享胶囊约定。
---

# CampusBili 集成

ClassIntra 通过 Browser iframe 内嵌 CampusBili 时，会给 CampusBili URL 添加 `classintra=1` 查询参数，并通过 `postMessage` 完成桥接握手。CampusBili 在识别该参数后自动跳过独立访问密码，不影响站点直接访问时的密码策略。

## 返回按钮

内嵌时有两个不同层级的返回操作：

- CampusBili 顶部的“返回”：返回 ClassIntra 桌面。
- CampusBili 视频页的“返回”：只返回 CampusBili 内部上一页，不离开 ClassIntra。

不要在视频页内部返回按钮中发送 `classintra-back`，否则会错误退出 ClassIntra 浏览器。

## 分享胶囊

CampusBili 视频详情页的分享操作在内嵌环境中通过桥接发送 `campusbili-share-request`，ClassIntra 仅展示分享胶囊，用于分享到聊天或社区。

播放进度、播放状态和播放控制不再同步到 ClassIntra 超能岛。

## 调试检查

1. 确认 iframe URL 包含 `classintra=1`。
2. 确认 CampusBili 不显示访问密码门禁。
3. 从视频页点击“返回”应停留在 CampusBili。
4. 从 CampusBili 顶部点击“返回”才返回 ClassIntra。
5. 分享视频时只出现分享胶囊，不出现播放状态岛。
