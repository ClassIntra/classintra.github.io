---
title: 监控运维
description: ClassIntra 监控运维指南，覆盖 PM2 状态查看、健康检查端点、数据库维护、日志管理、性能监控、常见故障排查与备份恢复。
---

# 监控运维

本页面介绍 ClassIntra 生产环境的监控、运维与故障排查方法，覆盖 PM2 进程管理、健康检查、数据库维护、日志轮转与备份恢复。

## PM2 状态查看

### 基础命令

```bash
# 查看所有进程列表
pm2 status

# 同义命令
pm2 list
pm2 ls

# 实时监控面板（CPU/内存/日志）
pm2 monit

# 查看进程详细信息
pm2 describe classintra-server

# 实时查看日志（Ctrl+C 退出）
pm2 logs classintra-server

# 仅查看最近 100 行
pm2 logs classintra-server --lines 100

# 仅查看错误日志
pm2 logs classintra-server --err

# 清空日志文件
pm2 flush classintra-server
```

### `pm2 status` 输出示例

```
┌────────────────────┬────┬───────┬──────────┬──────────┬──────────┬──────────┐
│ name               │ id │ mode  │ ↺        │ status   │ cpu      │ memory   │
├────────────────────┼────┼───────┼──────────┼──────────┼──────────┼──────────┤
│ classintra-server  │ 0  │ fork  │ 0        │ online   │ 0.5%     │ 120mb    │
└────────────────────┴────┴───────┴──────────┴──────────┴──────────┴──────────┘
```

| 字段 | 含义 |
|------|------|
| `name` | 进程名（`ecosystem.config.js` 中定义） |
| `↺` | 重启次数（异常退出自动重启计数） |
| `status` | `online` / `stopped` / `errored` / `launching` |
| `cpu` | CPU 占用率 |
| `memory` | RSS 内存占用 |

::: tip 重启次数监控
- `↺` 字段持续增长说明进程频繁崩溃，需查看 `pm2 logs --err` 排查
- 正常运行时该值应为 0，部署后短期内可能为 1~2 次
:::

## 健康检查端点

ClassIntra 提供三个监控端点，按需选择：

### `GET /api/system/health`

综合健康检查，包含数据库、WebSocket、Relay、内存状态：

```bash
curl http://localhost:9001/api/system/health | python -m json.tool
```

```json
{
  "code": 200,
  "data": {
    "status": "healthy",
    "timestamp": "2025-08-21T08:30:00.000Z",
    "uptime": 86400,
    "checks": {
      "database": { "status": "ok" },
      "websocket": { "status": "ok", "online_count": 42 },
      "relay": { "status": "ok", "details": { ... } },
      "memory": {
        "status": "ok",
        "heap_used_mb": 80,
        "heap_total_mb": 200,
        "rss_mb": 120
      }
    }
  }
}
```

| 检查项 | `ok` 含义 | `error` 含义 |
|--------|----------|--------------|
| `database` | SQLite 可读写 | 数据库文件损坏或路径错误 |
| `websocket` | WS 服务运行中 | WebSocket 端口未启动 |
| `relay` | 中继已配置并运行 | 未配置 / 握手失败 |
| `memory` | heap < 500 MB | 接近上限，建议重启 |

::: warning HTTP 状态码
- `200` —— 整体健康
- `503` —— 至少一项检查异常，需立即处理
:::

### `GET /api/system/heartbeat`

轻量心跳，适合外部监控脚本（如 UptimeRobot）：

```bash
curl http://localhost:9001/api/system/heartbeat
```

```json
{
  "code": 200,
  "data": {
    "status": "running",
    "version": "1.0.0",
    "minClientVersion": "1.0.0",
    "forceUpdate": false,
    "action": "none",
    "timestamp": 1692604200000
  }
}
```

### `GET /api/system/version`

完整版本信息：

```bash
curl http://localhost:9001/api/system/version
```

```json
{
  "code": 200,
  "data": {
    "version": "1.0.0",
    "buildHash": "l1a2b3c4d5e6f7g8",
    "buildTime": "2025-08-21T08:00:00.000Z",
    "minClientVersion": "1.0.0",
    "changelog": "fix: 修复聊天断线重连",
    "forceUpdate": false,
    "updateUrl": "",
    "timestamp": 1692604200000
  }
}
```

::: tip 监控集成
将 `/api/system/heartbeat` 接入 [Uptime Kuma](https://github.com/louislam/uptime-kuma) 或学校现有监控系统，每 30 秒探测一次：
```bash
# 探测脚本
curl -fsS -m 5 http://localhost:9001/api/system/heartbeat > /dev/null || \
  echo "ClassIntra down" | mail -s "Alert" admin@school.edu
```
:::

## 数据库维护

### WAL 模式

ClassIntra 默认启用 SQLite WAL（Write-Ahead Logging）模式，提升并发读写性能。WAL 文件位置：

```
server/database/
├── classintra.db       # 主数据库
├── classintra.db-wal   # WAL 日志（活跃写入先存这里）
└── classintra.db-shm   # 共享内存索引
```

::: tip WAL 优势
- **读不阻塞写**：多个读连接可与一个写连接并发
- **写入更快**：顺序追加写入而非随机
- **崩溃恢复**：异常断电后 SQLite 自动恢复
:::

### VACUUM 重建

长期使用后数据库可能产生碎片，定期 VACUUM 重建可释放空间、提升性能：

```bash
# 进入 server 目录
cd server

# 方式一：sqlite3 CLI（需安装 sqlite3）
sqlite3 database/classintra.db "VACUUM;"

# 方式二：Node.js 脚本
node -e "
var Database = require('better-sqlite3');
var db = new Database('./database/classintra.db');
db.pragma('wal_checkpoint(TRUNCATE)');
db.exec('VACUUM');
db.close();
console.log('VACUUM 完成');
"
```

::: warning VACUUM 锁表
- VACUUM 期间数据库锁定，**无法读写**
- 建议在低峰期执行（如深夜）
- 大数据库可能耗时几分钟，请耐心等待
- 执行前务必备份
:::

### WAL Checkpoint

手动触发 WAL checkpoint 将日志合并到主库：

```bash
sqlite3 database/classintra.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

| 模式 | 行为 |
|------|------|
| `PASSIVE`（默认） | 不阻塞读写，尽可能合并 |
| `FULL` | 阻塞写，等待所有读者完成 |
| `RESTART` | 阻塞写，等待读者完成后重启 WAL |
| `TRUNCATE` | 合并后截断 WAL 文件为 0 字节 |

### 数据库检查

```bash
# 完整性检查
sqlite3 database/classintra.db "PRAGMA integrity_check;"
# 期望：ok

# 查看表列表
sqlite3 database/classintra.db ".tables"

# 查看表结构
sqlite3 database/classintra.db ".schema users"

# 查看数据库大小
ls -lh database/classintra.db
```

## 日志管理

### PM2 日志路径

| 文件 | 路径 | 说明 |
|------|------|------|
| 标准输出 | `<project>/logs/server-out.log` | 正常日志（含 console.log） |
| 错误输出 | `<project>/logs/server-error.log` | 错误日志（含 console.error） |

::: tip 日志路径自定义
`ecosystem.config.js` 中通过 `out_file` 与 `error_file` 指定。默认在项目根目录 `logs/`，生产环境建议改为 `/var/log/classintra/`。
:::

### 日志轮转

PM2 内置日志轮转模块，避免日志文件无限增长：

```bash
# 安装日志轮转模块
pm2 install pm2-logrotate

# 配置轮转策略
pm2 set pm2-logrotate:max_size 50M          # 单文件最大 50 MB
pm2 set pm2-logrotate:retain 30             # 保留 30 份历史日志
pm2 set pm2-logrotate:compress true         # 压缩历史日志
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD # 文件名后缀
pm2 set pm2-logrotate:workerInterval 30     # 检查间隔（秒）
pm2 set pm2-logrotate:rotateInterval '0 * * * *'  # 每小时检查
```

::: warning 日志磁盘占用
未配置轮转时，繁忙服务器一周内日志可能占用数 GB。**强烈建议**生产环境启用 `pm2-logrotate`。
:::

### `VERBOSE_LOG` 开关

排查问题时启用详细日志：

```bash
# 临时启用（无需重启）
VERBOSE_LOG=1 pm2 restart classintra-server --update-env

# 排查完毕恢复
VERBOSE_LOG=0 pm2 restart classintra-server --update-env
```

::: warning 详细日志性能影响
`VERBOSE_LOG=1` 会记录每个 HTTP 请求与 WebSocket 消息，磁盘 I/O 显著上升。**仅排查时启用**。
:::

## 性能监控

### 内存

PM2 自带内存监控：

```bash
# 实时
pm2 monit

# 单次
pm2 describe classintra-server | grep memory
```

代码层面通过 `process.memoryUsage()` 查询：

```bash
curl http://localhost:9001/api/system/health | python -c "
import json, sys
data = json.load(sys.stdin)
mem = data['data']['checks']['memory']
print(f\"heap: {mem['heap_used_mb']} / {mem['heap_total_mb']} MB\")
print(f\"rss:  {mem['rss_mb']} MB\")
print(f\"status: {mem['status']}\")
"
```

::: warning 内存阈值
- `ecosystem.config.js` 设置 `max_memory_restart=1G`，RSS 超过 1 GB 自动重启
- `node_args=--max-old-space-size=768` 限制 V8 堆上限为 768 MB
- 长期内存持续上涨可能是泄漏，需排查
:::

### CPU

```bash
# PM2 CPU 监控
pm2 monit

# 系统级（Linux）
top -p $(pgrep -f "src/app.js")

# 系统级（Windows）
typeperf "\Process(node)\% Processor Time" -sc 5
```

### 连接数

查看 WebSocket 在线连接数：

```bash
curl -s http://localhost:9001/api/system/health | python -c "
import json, sys
data = json.load(sys.stdin)
print(f\"WebSocket 在线: {data['data']['checks']['websocket']['online_count']}\")
"
```

查看 TCP 连接数：

```bash
# Linux
ss -tn state established '( sport = :10001 )' | wc -l
ss -tn state established '( sport = :9001 )' | wc -l

# Windows
netstat -ano | findstr :10001 | findstr ESTABLISHED | find /c ":"
netstat -ano | findstr :9001  | findstr ESTABLISHED | find /c ":"
```

## 常见故障排查

| 症状 | 可能原因 | 排查方法 | 解决方案 |
|------|---------|---------|---------|
| 服务无法启动 | `JWT_SECRET` 未设置 | `pm2 logs --err` | 编辑 `.env` 设置 ≥32 字符随机串 |
| 服务无法启动 | 端口被占用 | `netstat -ano \| findstr :9001` | 修改 `PORT` 或结束占用进程 |
| 服务无法启动 | `better-sqlite3` 加载失败 | `pm2 logs --err` | 重新 `pnpm install`，确认 Node ≥18 |
| 前端白屏 | 后端未启动 | `curl http://localhost:9001/api/system/health` | 启动后端服务 |
| 前端白屏 | 浏览器版本过低 | F12 查看 Console 错误 | 升级 Chrome 至 80+ |
| WebSocket 连接失败 | WS_PORT 被防火墙拦截 | `telnet localhost 10001` | 开放 10001 端口 |
| 跨班消息不同步 | `RELAY_SECRET` 不一致 | 检查各节点 `.env` | 统一密钥后重启 |
| 跨班消息不同步 | `COHORT` 届数不匹配 | 对比各节点 `COHORT` | 设置为相同届数 |
| AI 聊天报错 | `AI_API_KEY` 无效 | `pm2 logs --err` 查看 401 | 检查 API Key 与 URL |
| 天气加载失败 | `QWEATHER_KEY` 无效 | `pm2 logs --err` | 重新申请 Key |
| 内存持续增长 | 可能泄漏 | `pm2 monit` 长期观察 | 重启服务，反馈 issue |
| 数据库锁定 | 长事务阻塞 | `sqlite3 .db ".databases"` | 重启服务，启用 WAL |
| `/setup` 不可访问 | 已完成首次配置 | — | 删除 `classintra.db` 重置（清数据） |

::: tip 日志关键词搜索
```bash
# 搜索错误
pm2 logs classintra-server --err --lines 1000 | grep -i "error"

# 搜索特定模块
pm2 logs classintra-server --lines 5000 | grep "relay"
pm2 logs classintra-server --lines 5000 | grep "websocket"
pm2 logs classintra-server --lines 5000 | grep "auth"

# 按时间过滤
grep "2025-08-21 08:" logs/server-error.log
```
:::

## 备份与恢复

### 数据库备份

#### 方式一：文件复制（停服备份）

最简单可靠，适合夜间低峰期：

```bash
# 1. 停止服务
pm2 stop classintra-server

# 2. 备份数据库目录（必须包含三个文件）
cp -r server/database/ /backup/classintra-$(date +%Y%m%d)/

# 3. 重启服务
pm2 start classintra-server
```

::: warning WAL 文件必须一起复制
SQLite 备份**必须**包含：
- `classintra.db`
- `classintra.db-wal`
- `classintra.db-shm`

缺失 WAL 文件可能导致最近写入丢失。
:::

#### 方式二：在线备份（热备）

不停服备份，使用 SQLite Online Backup API：

```bash
# 方式一：sqlite3 CLI
sqlite3 server/database/classintra.db ".backup '/backup/classintra-$(date +%Y%m%d).db'"

# 方式二：Node.js 脚本
node -e "
var Database = require('better-sqlite3');
var fs = require('fs');
var src = './server/database/classintra.db';
var dst = '/backup/classintra-' + new Date().toISOString().slice(0,10) + '.db';
var db = new Database(src, { readonly: true });
db.backup(dst)
  .then(function() { console.log('备份完成:', dst); })
  .catch(function(e) { console.error('备份失败:', e); })
  .finally(function() { db.close(); });
"
```

#### 方式三：自动定时备份

Linux crontab：

```bash
# 每日凌晨 3 点备份
0 3 * * * cd /opt/ClassIntra && sqlite3 server/database/classintra.db ".backup '/backup/classintra-$(date +\%Y\%m\%d).db'" && find /backup -name "classintra-*.db" -mtime +30 -delete
```

Windows 任务计划：

```powershell
# backup.ps1
$date = Get-Date -Format "yyyyMMdd"
$src = "D:\ClassIntra\server\database\classintra.db"
$dst = "D:\backup\classintra-$date.db"
sqlite3 $src ".backup '$dst'"
# 保留 30 天
Get-ChildItem "D:\backup\classintra-*.db" | 
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | 
  Remove-Item
```

### 资源备份

资源目录（`Resources/`）包含照片、云盘、壁纸等用户文件：

```bash
# 完整备份（含资源）
tar -czf /backup/classintra-full-$(date +%Y%m%d).tar.gz \
  server/database/ \
  server/config/pre-records.json \
  server/.env \
  Resources/

# 仅资源
rsync -avz --delete Resources/ /backup/resources/
```

::: tip 资源同步
若已配置 Syncthing（见 [配置项 - 同步配置](./configuration#同步配置)），资源会自动同步到对端服务器，无需手动备份。
:::

### 恢复

```bash
# 1. 停止服务
pm2 stop classintra-server

# 2. 恢复数据库
cp /backup/classintra-20250821.db server/database/classintra.db
# 注意删除旧 WAL 文件，避免冲突
rm -f server/database/classintra.db-wal server/database/classintra.db-shm

# 3. 恢复配置（可选）
cp /backup/.env server/.env
cp /backup/pre-records.json server/config/pre-records.json

# 4. 恢复资源
rsync -avz /backup/resources/ Resources/

# 5. 重启服务
pm2 start classintra-server

# 6. 验证
curl http://localhost:9001/api/system/health
```

::: warning 恢复后验证
- 数据库恢复后必须删除旧的 `.db-wal` 与 `.db-shm` 文件
- 恢复后访问 `/api/system/health` 确认 `database: ok`
- 抽查用户登录、聊天记录、资源列表是否正常
:::

## 数据安全提示

::: warning 数据安全清单

**备份**
- ✅ 每日自动备份到独立磁盘（非同一服务器）
- ✅ 每周备份到外部存储（NAS / 云盘 / 移动硬盘）
- ✅ 每月测试一次完整恢复流程
- ✅ 备份保留至少 30 天

**权限**
- ✅ `server/.env` 文件权限 600（仅属主）
- ✅ `server/database/` 目录权限 700
- ✅ 备份文件加密存储（含 JWT_SECRET 等敏感信息）

**传输**
- ✅ 远程备份走 SFTP / SCP，禁止明文 FTP
- ✅ 跨校区备份走 Tailscale VPN

**销毁**
- ✅ 退役硬盘彻底擦除（如 `shred -vzn 3 /dev/sda`）
- ✅ 过期备份定期销毁，避免长期累积

**审计**
- ✅ 记录备份/恢复操作日志
- ✅ 班管权限变更需有审批记录
:::

## 下一步

- [生产部署](./production) - 部署流程
- [配置项参考](./configuration) - 全部环境变量
- [教育场景](./education) - 班级部署
- [CLI 工具](/development/cli) - 命令行参考
