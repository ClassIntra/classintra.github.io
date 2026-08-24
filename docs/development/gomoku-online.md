---
title: 联机五子棋开发
description: ClassIntra Gomoku 房间 API、棋盘规则、WebSocket 事件与断线恢复。
---

# 联机五子棋开发

Gomoku 通过 `/api/gomoku` 提供房间 HTTP API，并复用 `10001` WebSocket 推送状态。完整示例见主仓库 [gomoku-online.md](https://github.com/ClassIntra/ClassIntra/blob/main/docs/gomoku-online.md)。

## 房间 API

支持 15、19、21 三种棋盘。创建：

```bash
curl -X POST "$BASE_URL/api/gomoku/rooms" \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"size":15}'
```

使用返回的 `data.roomCode` 获取状态、加入、落子或观战：

```bash
curl "$BASE_URL/api/gomoku/rooms/$ROOM_CODE" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/api/gomoku/rooms/$ROOM_CODE/join" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/api/gomoku/rooms/$ROOM_CODE/move" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"row":7,"col":7}'
```

第三名成员及之后的成员为观战者。房主才能重开或关闭房间；房主离开后由最早留下的成员接任。

## WebSocket 事件

认证后发送：

```js
socket.send(JSON.stringify({ type: 'gomoku_subscribe', room_code: ROOM_CODE }))
socket.send(JSON.stringify({ type: 'gomoku_move', room_code: ROOM_CODE, row: 7, col: 7 }))
```

客户端处理 `gomoku_room_state`、`gomoku_room_changed`、`gomoku_move_rejected` 和 `gomoku_game_continued`。断线重连时重新发送 `connect`，再订阅并 GET 房间状态，避免漏掉广播。

## 调试

落子坐标从 0 开始；非法坐标、非当前回合、已有棋子和观战者落子分别按服务端错误处理。不要重放未知结果的落子请求，先读取最新状态确认。
