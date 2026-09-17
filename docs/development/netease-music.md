---
title: 网易云音乐插件
description: ClassIntra 音乐应用接入网易云音乐的插件架构、API 契约、部署与内网配置。
---

# 网易云音乐插件

网易云音乐插件（`netease-music`）让 ClassIntra 音乐应用接入网易云音乐曲库：扫码登录、搜索、每日推荐、热歌榜、歌单浏览与红心收藏。插件以「服务器中转网关」为核心设计——客户端不直连任何外部域名，所有网易云流量都经 ClassIntra 服务器同源转发，因此在**内网环境**中，只要服务器侧能出网（直连、HTTP 代理或上游 API 服务任选其一），全部功能即可使用。

## 功能总览

| 功能 | 说明 | 依赖登录 |
|------|------|---------|
| 扫码登录 | 网易云 App 扫码，服务端保存 MUSIC_U cookie | - |
| 搜索 | 单曲搜索（回车触发），支持翻页语义的 limit | 否 |
| 每日推荐 | 登录后为个性化日推，未登录自动回退热歌榜 | 建议 |
| 热歌排行榜 | 云音乐热歌榜（3778678）前 100 首 | 否 |
| 网易云收藏 | 我喜欢的音乐列表（离线回退本地镜像） | 是 |
| 网易云歌单 | 浏览登录账号的网易云歌单并播放 | 是 |
| 红心收藏 | 在线同步网易云红心，离线写本地镜像 | 建议 |
| 歌词 | 原文 + 官方翻译（按时间戳合并为双语歌词） | 否 |
| 音频/封面 | 服务器同源中转，支持 Range 断点续传与磁盘缓存 | 否 |

## 架构

```
plugins/netease-music/
├── manifest.json           # type: plugin，挂载 /api/netease-music
└── backend/
    ├── routes.js           # Express 路由（鉴权、票据、错误统一出口）
    ├── gateway.js          # 三引擎网关 + SQLite 缓存 + stale 兜底
    ├── stream.js           # 音频/图片中转（Range、磁盘缓存、LRU 清理）
    ├── store.js            # SQLite 存储层（复用主库）
    └── ncm/                # 网易云协议层（零第三方依赖，纯 Node 内置模块）
        ├── crypto.js       # weapi（AES-CBC 双重加密）/ eapi（AES-ECB + MD5）
        ├── engine.js       # HTTP 引擎（直连/代理、cookie、响应容错）
        ├── api.js          # 18 个网易云端点封装
        └── qrcode.js       # 自研 QR 编码器（ISO/IEC 18004，离线生成登录码）
```

### 三级网关引擎

`gateway.call(endpoint, args, userId, options)` 按配置的引擎顺序调用，网络级失败自动降级，最终回退过期缓存（stale），全部失败才抛 `{code: 503}`：

| 引擎 | 行为 |
|------|------|
| `builtin` | 插件内置 ncm 协议直连 `music.163.com`（默认，无需额外部署） |
| `upstream` | 转发到 api-enhanced / NeteaseCloudMusicApi 兼容服务（模块名自动映射） |
| `auto` | builtin 网络级失败回退 upstream，再回退 stale 缓存（默认值） |

缓存 TTL：搜索 5 分钟、播放地址 12 分钟（官方 URL 约 20 分钟有效）、歌曲详情/歌词 24 小时、榜单 6 小时等。缓存以「端点 + 参数 + cookie 指纹」为键，不同网易云账号互不串扰。

### 播放链路与短时票据

`<audio>` 标签无法携带 `Authorization` 头，且 VIP 曲目必须用登录用户的 cookie 取流。播放链路设计为：

1. 前端请求 `GET /api/netease-music/song/url?id=<ncmId>`（带 ClassIntra 登录态）；
2. 服务端用当前用户的网易云 cookie 解析真实播放地址，然后铸造一张 **15 分钟短时票据**（`crypto.randomBytes`，存入缓存表，绑定 userId + songId），返回同源地址 `/api/netease-music/stream?id=...&quality=...&ticket=...`；
3. `<audio>` 直接播放该同源地址，`/stream` 验票后按票据内的用户身份取流，支持 Range 与磁盘缓存。

票据过期后前端重新走 `/song/url` 铸新票即可。

## API 契约

挂载路径 `/api/netease-music`，除 `/image` 外均需 ClassIntra 登录态（Bearer Token）。

| 端点 | 方法 | 返回（axios `res.data`） |
|------|------|--------------------------|
| `/status` | GET | `{ code:200, loggedIn, profile, config }` |
| `/login/qr/create` | POST | `{ code:200, unikey, qrurl, size, rows }`（rows 为 0/1 矩阵，前端 CSS 渲染） |
| `/login/qr/check?key=` | GET | `{ code: 801等待 / 802已扫 / 803成功 / 800过期, profile? }` |
| `/logout` | POST | `{ code:200 }` |
| `/search?keywords=&type=1&limit=&offset=` | GET | 网易云原始结构 `{ code, result: { songs, songCount } }` |
| `/song/detail?ids=` | GET | `{ code, songs }` |
| `/song/url?id=` | GET | `{ code:200, data: [{ id, url, level, size, type }] }`（url 为带票据的同源地址） |
| `/stream?id=&ticket=` | GET | 音频流（票据鉴权，支持 Range） |
| `/lyric?id=` | GET | `{ code, lrc: { lyric }, tlyric: { lyric } }` |
| `/like` | POST | body `{ id, like, song? }` → `{ code:200, like, online, loggedIn }`（业务失败 HTTP 400） |
| `/like/list` | GET | `{ code:200, ids, offline? }` |
| `/like/check?ids=` | GET | `{ code, checkInfo: [{ id, liked }] }`（分块 ≤200 个 id） |
| `/playlist/track/all?id=&limit=&offset=` | GET | builtin：`{ code, songs, playlist }`；upstream：`{ code, playlist }` |
| `/user/playlist` | GET | `{ code, playlist: [...], more }` |
| `/recommend/songs` | GET | `{ code, data: { dailySongs } }` |
| `/personalized?limit=` | GET | `{ code, result: [...] }` |
| `/toplist` | GET | `{ code, list: [...] }` |
| `/image?u=` | GET | 图片流（白名单 `*.music.126.net`，无 ClassIntra 鉴权） |
| `/admin/config` | GET/POST | 插件配置（仅管理员） |

### 前端歌曲对象约定

网易云歌曲在进入 Vuex 与播放器前统一规范化（`normalizeNcmSong`）：

```js
{
  id: 'ncm-<网易云id>',   // 加前缀避免与本地歌曲 id 冲突
  ncmId: <网易云id>,
  source: 'netease',
  title, artist, album,
  coverUrl: '/api/netease-music/image?u=<enc>',  // 封面经服务器中转
  hasLyrics: true,
  audioUrl: undefined,    // 不预取，播放时经票据换流动态赋值
  isFavorite: false,
  format: 'VIP' | ''      // fee === 1 显示 VIP 角标
}
```

播放队列隔离：播放在线歌曲时 `playQueue` 对齐当前网易云列表，切回本地歌曲时清空在线队列，保证自动连播不串源。

## 存储与配置

复用 ClassIntra 主 SQLite 库，新增 4 张表：

| 表 | 用途 |
|----|------|
| `netease_accounts` | 网易云登录态（user_id 主键，cookie / csrf / profile） |
| `netease_cache` | 网关缓存（cache_key 主键，payload JSON，expires_at 索引） |
| `netease_config` | 插件配置键值 |
| `netease_likes` | 本地收藏镜像（离线兜底与未登录收藏） |

配置键（管理员通过 `POST /api/netease-music/admin/config` 修改）：

| 键 | 默认 | 说明 |
|----|------|------|
| `engine` | `auto` | builtin / upstream / auto |
| `upstreamUrl` | 空 | upstream 引擎的上游服务地址 |
| `proxy` | 空 | 出网 HTTP 代理（如 `http://host:port`） |
| `quality` | `standard` | 音质（standard / higher / exhigh / lossless / hires） |
| `cacheEnabled` | `1` | 网关缓存开关 |
| `audioCache` | `1` | 音频磁盘缓存开关 |
| `cacheDir` | `<数据库目录>/netease-cache` | 音频缓存目录 |
| `audioCacheMaxMB` | `512` | 缓存上限（按 atime LRU 清理） |
| `requestTimeout` | `8000` | 网易云请求超时（ms） |

## 内网部署场景

| 场景 | 配置 |
|------|------|
| 服务器可直连公网 | 默认 `builtin` + `auto` 即可，无需改动 |
| 服务器经 HTTP 代理出网 | 设置 `proxy` |
| 完全隔离，仅 DMZ 有一台 api-enhanced | 设置 `engine: upstream` + `upstreamUrl` 指向上游 |
| 网络间歇可用 | 依赖缓存与 stale 兜底，已收藏歌曲的详情/歌词离线仍可读 |

## 安全说明

- 网易云 cookie（MUSIC_U）仅存服务端 SQLite，永不下发前端。
- 播放票据 15 分钟过期且绑定用户 + 歌曲，不能跨用户、跨曲目复用。
- 图片中转有域名白名单，音频取流仅接受 gateway 解析出的地址。
- 插件配置仅 ClassIntra 管理员可读写。
