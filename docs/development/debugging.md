---
title: 调试技巧
description: ClassIntra 调试技巧指南，覆盖前端调试（Vue DevTools、Chrome DevTools、Console 日志）、后端调试（Node.js Inspector、PM2 日志、VERBOSE_LOG）、WebSocket 调试、数据库调试（sqlite3 CLI、WAL 模式）、常见问题排查与性能分析。
---

# 调试技巧

本页面汇总 ClassIntra 前后端的调试方法，从浏览器 DevTools 到 Node.js Inspector，再到数据库与 WebSocket 调试。

## 前端调试

### Vue DevTools

调试 Vue 2.7 应用需使用 [Vue DevTools 6+](https://devtools.vuejs.org/)，**不要**使用 Vue 3 版本（7+）。

#### 安装

| 浏览器 | 安装方式 |
|--------|---------|
| Chrome | [Chrome Web Store - Vue Devtools](https://chrome.google.com/webstore/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) |
| Firefox | [Mozilla Addons](https://addons.mozilla.org/firefox/addon/vue-js-devtools/) |
| Edge | [Edge Addons](https://microsoftedge.microsoft.com/addons/detail/vuejs-devtools/olifgggiajebpehcdnfmodhejfljcecm) |

#### 主要面板

| 面板 | 用途 |
|------|------|
| **Components** | 组件树，查看 props / data / computed / vuex 绑定 |
| **Vuex** | 实时查看 Vuex 状态、mutations 历史、time-travel 调试 |
| **Routes** | 路由表与当前路由信息 |
| **Performance** | 组件性能分析 |
| **Timeline** | 事件时间线 |
| **Inspect** | 检查 `$route`、`$store`、`$services` 等实例 |

::: tip 在隐私模式启用
默认 Vue DevTools 在 `http://localhost` 才启用。生产环境调试需在扩展设置中勾选「允许访问文件 URL」并启用「允许在生产模式」。
:::

### Chrome DevTools

#### 常用快捷键

| 快捷键 | 操作 |
|--------|------|
| `F12` / `Ctrl+Shift+I` | 打开 DevTools |
| `Ctrl+R` | 刷新页面（保留 DevTools） |
| `Ctrl+Shift+R` | 强制刷新（清缓存） |
| `Ctrl+P` | Sources 面板搜索文件 |
| `Ctrl+Shift+F` | 全局搜索 |
| `Esc` | 打开 Console 抽屉 |

#### 断点调试

1. **Sources 面板** → 找到 `.vue` 文件 → 行号点击设置断点
2. 触发操作（如点击按钮），断点会命中
3. 右侧面板查看 **Scope**（作用域变量）、**Call Stack**（调用栈）、**Watch**（自定义监听）

::: tip Source Map
Vite dev 模式默认启用 Source Map，断点直接命中 `.vue` 源码。生产模式需在 `vite.config.mjs` 中显式启用 `sourcemap: true`。
:::

#### Network 面板

排查 API 问题：

1. **Filter** → `Fetch/XHR` 过滤 AJAX 请求
2. **WS** 过滤 WebSocket 帧
3. 点击请求查看 **Headers** / **Payload** / **Response**
4. 右键 → **Copy as cURL** 复制为 curl 命令复现

#### Application 面板

- **Storage** → **Local Storage** 查看 PersistenceStore 写入
- **Cookies** 查看 JWT 等 cookie
- **Service Workers** 查看离线缓存

### Console 日志

#### 标准日志

```javascript
console.log('普通日志');
console.info('信息');
console.warn('警告');
console.error('错误');

// 带前缀，便于过滤
console.log('[my-app] 数据加载:', data);
console.warn('[my-app] 重试中...', attempt);
```

#### 分组与计时

```javascript
console.group('用户操作');
console.log('点击按钮');
console.log('发送请求');
console.groupEnd();

console.time('api-call');
api.get('/api/data').finally(function() {
  console.timeEnd('api-call');  // api-call: 234ms
});
```

#### 表格输出

```javascript
console.table([
  { id: 1, name: '张三' },
  { id: 2, name: '李四' }
]);
```

::: warning 生产环境日志
生产构建会通过 `terser` 移除 `console.log`，但 `console.warn` 与 `console.error` 保留。敏感信息（token、密码）**不可** console 输出。
:::

## 后端调试

### Node.js Inspector

通过 Chrome DevTools 调试 Node.js 进程：

#### 启动带 Inspector 的服务

```bash
# 开发模式（停顿等待连接）
node --inspect-brk src/app.js

# 立即启动，运行中可连接
node --inspect src/app.js

# 指定端口（默认 9229）
node --inspect=9230 src/app.js
```

#### 连接 Inspector

1. 打开 Chrome，访问 `chrome://inspect`
2. 在 **Remote Target** 中找到 `classintra-server`
3. 点击 **inspect** 打开 DevTools

主要面板：

| 面板 | 用途 |
|------|------|
| **Sources** | 设置断点，单步执行 |
| **Profiler** | CPU 性能分析 |
| **Memory** | 堆快照，排查内存泄漏 |
| **Console** | REPL 交互 |

::: tip VS Code 集成
在 VS Code 中创建 `.vscode/launch.json`：
```json
{
  "type": "node",
  "request": "launch",
  "name": "调试 ClassIntra Server",
  "program": "${workspaceFolder}/server/src/app.js",
  "cwd": "${workspaceFolder}/server"
}
```
按 F5 直接调试。
:::

### PM2 日志

#### 实时查看

```bash
# 实时日志（Ctrl+C 退出）
pm2 logs classintra-server

# 仅最近 N 行
pm2 logs classintra-server --lines 200

# 仅错误
pm2 logs classintra-server --err

# 同时查看 stdout + stderr
pm2 logs classintra-server --out --err
```

#### 日志文件位置

| 文件 | 路径 |
|------|------|
| stdout | `<project>/logs/server-out.log` |
| stderr | `<project>/logs/server-error.log` |

#### 日志搜索

```bash
# 搜索错误
grep -i "error" logs/server-error.log

# 搜索特定时间
grep "2025-08-21 08:" logs/server-out.log

# 搜索特定模块
grep "relay" logs/server-out.log
grep "websocket" logs/server-out.log
grep "auth" logs/server-out.log
```

### `VERBOSE_LOG`

启用详细日志：

```bash
# 临时启用
VERBOSE_LOG=1 pm2 restart classintra-server --update-env

# 或修改 .env 后重启
# server/.env: VERBOSE_LOG=1
pm2 restart classintra-server
```

::: warning 详细日志性能
`VERBOSE_LOG=1` 会记录每个 HTTP 请求、WebSocket 消息、Relay 同步事件，磁盘 I/O 显著上升。**仅排查时启用**，排查后立即恢复为 0。
:::

### 添加调试日志

临时排查时插入：

```javascript
router.post('/items', auth.requireAuth, function(req, res) {
  console.log('[debug] /items req.body:', req.body);
  console.log('[debug] /items req.user:', req.user);
  // ... 业务逻辑
});
```

::: tip 条件日志
避免日志污染，使用条件输出：
```javascript
if (process.env.VERBOSE_LOG === '1') {
  console.log('[debug] db query:', sql, params);
}
```
:::

## WebSocket 调试

### Chrome DevTools

1. 打开 **Network** 面板
2. 切换到 **WS** 过滤
3. 找到 WebSocket 连接（默认 `ws://host:10001`）
4. 点击查看 **Messages** 实时帧

#### 帧类型

| 类型 | 颜色 | 说明 |
|------|------|------|
| 绿色 ↓ | 入站 | 服务器 → 客户端 |
| 白色 ↑ | 出站 | 客户端 → 服务器 |

### 命令行工具

#### `wscat`

```bash
# 安装
npm install -g wscat

# 连接（带 JWT）
wscat -c "ws://localhost:10001?token=<your-jwt>"

# 连接后发送消息
> {"type":"chat","message":"hello","channel":"public"}
< {"type":"chat","message":"hello","from":"张三"}
```

#### Node.js 脚本

```javascript
// scripts/debug-ws.js
var WebSocket = require('ws');

var token = '<your-jwt>';
var ws = new WebSocket('ws://localhost:10001?token=' + token);

ws.on('open', function() {
  console.log('[ws] connected');
  ws.send(JSON.stringify({ type: 'ping' }));
});

ws.on('message', function(data) {
  console.log('[ws] ←', data.toString());
});

ws.on('close', function(code, reason) {
  console.log('[ws] closed:', code, reason.toString());
});

ws.on('error', function(err) {
  console.error('[ws] error:', err.message);
});

// 5 秒后断开
setTimeout(function() { ws.close(); }, 5000);
```

### 后端日志

```bash
# 查看连接日志
pm2 logs classintra-server --lines 1000 | grep "websocket"

# 查看特定用户
pm2 logs classintra-server | grep "user_id.*25010001"
```

## 数据库调试

### `sqlite3` CLI

#### 安装

| 平台 | 命令 |
|------|------|
| Ubuntu / Debian | `sudo apt-get install -y sqlite3` |
| macOS | `brew install sqlite`（系统自带） |
| Windows | [sqlite.org/download](https://sqlite.org/download.html) 下载 `sqlite-tools` |

#### 常用命令

```bash
# 打开数据库
sqlite3 server/database/classintra.db

# 进入后：
.help                              # 帮助
.tables                            # 列出所有表
.schema users                      # 查看 users 表结构
.headers on                        # 显示列名
.mode column                       # 列对齐模式
SELECT * FROM users LIMIT 5;       # 查询
SELECT COUNT(*) FROM messages;     # 计数
.quit                              # 退出
```

#### 一行命令

```bash
# 直接执行 SQL
sqlite3 server/database/classintra.db "SELECT user_id, name FROM users LIMIT 5;"

# 计数
sqlite3 server/database/classintra.db "SELECT COUNT(*) FROM messages WHERE created_at > strftime('%s', '2025-08-21') * 1000;"

# 导出 JSON
sqlite3 server/database/classintra.db ".mode json" "SELECT * FROM users WHERE user_id = '25010001';"
```

### WAL 模式查看

WAL 模式下，最新数据可能还在 WAL 文件中。查询前先 checkpoint：

```bash
sqlite3 server/database/classintra.db "PRAGMA wal_checkpoint(PASSIVE);"
```

::: tip WAL 文件
- `classintra.db-wal` —— 待合并的写入
- `classintra.db-shm` —— 共享内存索引

直接 `sqlite3 classintra.db` 会自动读取 WAL，但备份时必须三个文件一起。
:::

### Node.js 脚本调试

```javascript
// scripts/debug-db.js
var Database = require('better-sqlite3');
var db = new Database('./server/database/classintra.db', { readonly: true });

console.log('=== 表列表 ===');
var tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
).all();
tables.forEach(function(t) { console.log(t.name); });

console.log('\n=== users 表结构 ===');
var schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='users'").get();
console.log(schema.sql);

console.log('\n=== 最近 5 个用户 ===');
var users = db.prepare('SELECT user_id, name, created_at FROM users ORDER BY created_at DESC LIMIT 5').all();
console.table(users);

console.log('\n=== 各表行数 ===');
tables.forEach(function(t) {
  var count = db.prepare('SELECT COUNT(*) as c FROM ' + t.name).get();
  console.log(t.name + ':', count.c);
});

db.close();
```

### 数据库锁定排查

```bash
# 查看数据库状态
sqlite3 server/database/classintra.db "PRAGMA journal_mode;"
# 期望：wal

# 查看锁定
sqlite3 server/database/classintra.db "PRAGMA database_list;"

# 强制 checkpoint
sqlite3 server/database/classintra.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

## 常见问题排查

| 症状 | 排查方法 | 解决方案 |
|------|---------|---------|
| 前端白屏 | F12 → Console 查看错误 | 升级浏览器、检查后端是否运行 |
| 前端 401 | Network 面板查看响应 | JWT 过期，重新登录 |
| 前端 CORS 错误 | Console 查看 `Access-Control-Allow-Origin` | 配置 `CORS_ORIGINS` |
| API 返回 500 | `pm2 logs --err` | 查看堆栈定位错误 |
| API 返回 403 | 检查 `auth.requireAdmin` 中间件 | 用户非班管，或 `ADMIN_USER_IDS` 未配置 |
| WebSocket 不连接 | F12 → Network → WS | 检查 10001 端口、防火墙 |
| WebSocket 频繁断线 | `pm2 logs` 查看 `ws:close` | 网络不稳定、Nginx 超时配置 |
| 数据库锁定 | `PRAGMA wal_checkpoint` | 重启服务、检查长事务 |
| 数据库文件膨胀 | `ls -lh database/` | 执行 `VACUUM` |
| 内存持续上涨 | `pm2 monit` 长期观察 | 排查泄漏、降低 `--max-old-space-size` |
| Relay 不同步 | `pm2 logs \| grep relay` | 检查 `RELAY_SECRET` 一致性 |
| 主题切换无效 | F12 → Application → Local Storage | 检查 `classintra:theme` 值 |
| 快捷键不响应 | 焦点是否在 input 上 | 注册时设 `{ global: true }` |

## 性能分析

### 前端性能

#### Chrome DevTools Performance

1. F12 → **Performance** 面板
2. 点击 **Record**，操作页面
3. 停止录制，查看时间线
4. 重点关注：
   - **Main** 线程的红色长任务（> 50ms）
   - **FPS** 图表，掉帧处红色标记
   - **Network** 请求瀑布图

#### Lighthouse

```bash
# 命令行
npx lighthouse http://localhost:5001 --view

# 或在 Chrome DevTools 中
# F12 → Lighthouse → Generate report
```

关注指标：

| 指标 | 目标 |
|------|------|
| FCP（First Contentful Paint） | < 1.8s |
| LCP（Largest Contentful Paint） | < 2.5s |
| FID（First Input Delay） | < 100ms |
| CLS（Cumulative Layout Shift） | < 0.1 |

### 后端性能

#### CPU Profile

```bash
# 通过 PM2 启动 profile
pm2 profile classintra-server

# 或通过 Node.js 内置
node --prof src/app.js
# 运行一段时间后 Ctrl+C
# 处理 isolate-*.log
node --prof-process isolate-*.log > profile.txt
```

#### 堆快照

通过 Chrome DevTools 远程连接 Node.js Inspector：

1. `chrome://inspect` → connect
2. **Memory** 面板 → **Take heap snapshot**
3. 对比两次快照，找出增长对象

#### 内存监控

```bash
# 长期内存监控
watch -n 5 "pm2 describe classintra-server | grep -E 'memory|restarts'"

# 健康检查内存
curl -s http://localhost:9001/api/system/health | python -c "
import json, sys
data = json.load(sys.stdin)
mem = data['data']['checks']['memory']
print(f\"heap: {mem['heap_used_mb']}/{mem['heap_total_mb']} MB\")
print(f\"rss:  {mem['rss_mb']} MB\")
print(f\"status: {mem['status']}\")
"
```

::: tip 内存泄漏排查流程
1. 启动服务，记录初始 RSS
2. 压测模拟负载（如 100 并发持续 5 分钟）
3. 停止压测，等待 10 分钟（GC）
4. 若 RSS 未回落至初始值，可能有泄漏
5. 取堆快照对比，定位泄漏对象
:::

### 数据库性能

```bash
# 查询计划
sqlite3 server/database/classintra.db "EXPLAIN QUERY PLAN SELECT * FROM messages WHERE user_id = '25010001';"

# 慢查询统计（better-sqlite3 同步 API，可包装计时）
# 在代码中：
var start = Date.now();
var result = db.prepare('SELECT ...').all();
if (Date.now() - start > 100) {
  console.warn('[slow-query]', Date.now() - start, 'ms');
}

# 索引检查
sqlite3 server/database/classintra.db "SELECT * FROM sqlite_master WHERE type='index';"
```

::: tip 索引优化
- 经常 `WHERE` 的列建索引
- 经常 `JOIN` 的列建索引
- `ORDER BY` 的列考虑索引
- 避免在索引列上使用函数：`WHERE LOWER(name)` 不走索引
:::

## 下一步

- [SDK 参考](./sdk) - 前后端 API
- [CLI 工具](./cli) - 命令行参考
- [监控运维](/deployment/monitoring) - 生产环境监控
- [配置项参考](/deployment/configuration) - 环境变量
