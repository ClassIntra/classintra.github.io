---
title: CLI 工具参考
description: ClassIntra CLI 工具参考，覆盖 pnpm 命令（dev/build/start/install）、PM2 命令（start/stop/restart/logs/status/monit）、构建脚本（build.bat, start.sh）、版本管理（version.json 自动递增）与数据库迁移命令。
---

# CLI 工具参考

本页面汇总 ClassIntra 常用命令行工具，覆盖 pnpm、PM2、构建脚本、版本管理与数据库迁移。

## pnpm 命令

ClassIntra 使用 pnpm workspace 管理 monorepo，根目录 `package.json` 中定义了快捷脚本。

### 主要命令

| 命令 | 实际执行 | 说明 |
|------|---------|------|
| `pnpm dev` | `pnpm --parallel --filter server --filter client run dev` | 并行启动前后端开发服务器 |
| `pnpm dev:server` | `pnpm --filter server run dev` | 仅启动后端 |
| `pnpm dev:client` | `pnpm --filter client run dev` | 仅启动前端（Vite dev） |
| `pnpm build` | 更新 `version.json` + `cd client && pnpm run build` | 构建前端生产产物 |
| `pnpm start` | `pnpm --filter server run start` | 启动后端生产服务（`node src/app.js`） |
| `pnpm install` | 安装全部 workspace 依赖 | 含 `server` / `client` / `apps/*` |

### 各 workspace 内部脚本

| Workspace | 命令 | 说明 |
|-----------|------|------|
| `server` | `pnpm dev` / `pnpm start` | `node src/app.js`（同义） |
| `client` | `pnpm dev` | `vite` dev server，端口 5001 |
| `client` | `pnpm prebuild` | `node scripts/prebuild.js`（版本号递增） |
| `client` | `pnpm build` | `vite build`（构建产物到 `dist/`） |
| `client` | `pnpm preview` | `vite preview`（预览构建产物） |

### 用法示例

```bash
# 1. 全新部署
pnpm install
cp server/.env.example server/.env
# 编辑 .env 至少设置 JWT_SECRET

# 2. 开发
pnpm dev
# → 前端 http://localhost:5001
# → 后端 http://localhost:9001
# → WebSocket ws://localhost:10001

# 3. 生产构建
pnpm build

# 4. 启动生产服务
pnpm start
# → http://localhost:9001

# 5. 仅启动后端调试
pnpm dev:server

# 6. 仅启动前端调试（需后端已运行）
pnpm dev:client

# 7. 单独安装某 workspace 依赖
pnpm --filter server add <pkg>
pnpm --filter client add <pkg>
```

::: tip pnpm 加速
国内网络可在 `.npmrc` 配置淘宝镜像：
```ini
registry=https://registry.npmmirror.com
```
:::

## PM2 命令

PM2 用于生产环境进程守护，项目自带 `ecosystem.config.js` 配置。

### 进程管理

| 命令 | 说明 |
|------|------|
| `pm2 start ecosystem.config.js` | 启动 ClassIntra 服务 |
| `pm2 start ecosystem.config.js --update-env` | 重启并刷新环境变量 |
| `pm2 stop classintra-server` | 停止进程 |
| `pm2 restart classintra-server` | 重启进程 |
| `pm2 reload classintra-server` | 零停机重启（cluster 模式） |
| `pm2 delete classintra-server` | 从 PM2 列表移除 |
| `pm2 save` | 保存进程列表（用于 resurrect） |
| `pm2 resurrect` | 恢复上次保存的进程列表 |
| `pm2 startup` | 生成开机自启命令 |

### 查看状态

| 命令 | 说明 |
|------|------|
| `pm2 status` / `pm2 list` / `pm2 ls` | 进程列表 |
| `pm2 describe classintra-server` | 详细信息（路径、env、重启次数等） |
| `pm2 monit` | 实时监控面板（CPU/内存/日志） |
| `pm2 info classintra-server` | 进程元信息 |

### 日志

| 命令 | 说明 |
|------|------|
| `pm2 logs classintra-server` | 实时查看 stdout + stderr |
| `pm2 logs classintra-server --lines 200` | 最近 200 行 |
| `pm2 logs classintra-server --err` | 仅错误日志 |
| `pm2 logs classintra-server --out` | 仅标准输出 |
| `pm2 flush classintra-server` | 清空日志文件 |
| `pm2 reloadLogs` | 重新加载日志 |

### 完整流程示例

```bash
# 1. 启动
pm2 start ecosystem.config.js

# 2. 验证
pm2 status
pm2 logs classintra-server --lines 30

# 3. 保存（用于开机自启）
pm2 save

# 4. 配置开机自启
pm2 startup
# 按 PM2 返回的命令执行：
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u <user> --hp /home/<user>

# 5. 重启并刷新环境变量（修改 .env 后）
pm2 restart ecosystem.config.js --update-env

# 6. 停止
pm2 stop classintra-server

# 7. 完全移除
pm2 delete classintra-server
```

::: warning ecosystem.config.js 与 .env
`ecosystem.config.js` 会自动读取 `server/.env` 并注入到 PM2 进程环境变量。修改 `.env` 后必须 `--update-env` 重启，否则旧值仍生效。
:::

## 构建脚本

项目根目录提供多个一键脚本，简化部署操作。

### `build.bat`（Windows 一键构建）

```cmd
build.bat
```

执行流程：

1. 安装依赖（server 用 `--prod`，client 正常安装）
2. 更新 `server/version.json`（写入 `buildHash` 与 `buildTime`）
3. 在 `client/` 目录执行 `npx vite build`
4. 产物输出到 `client/dist/`

::: tip build.bat 用途
适合无 pnpm 的 Windows 服务器，自动降级到 npm。
:::

### `start.sh`（Linux 开发启动）

```bash
./start.sh
```

执行流程：

1. 初始化数据库（`node src/utils/init-db.js`）
2. 后台启动后端（`node src/app.js`，端口 9001）
3. 后台启动前端（`npx vite --host`，端口 5001）
4. `Ctrl+C` 优雅停止两个进程

::: warning start.sh 仅开发
`start.sh` 使用 Vite dev server，**仅用于开发**。生产环境请使用 `pnpm build && pnpm start` 或 PM2。
:::

### `start.bat`（Windows 开发启动）

```cmd
start.bat
```

在新窗口分别启动后端与前端 dev server。

### `start-prod.bat`（Windows 生产启动）

```cmd
start-prod.bat
```

生产模式一键启动（仅后端，无 Vite dev server）。

### `CI.bat`（CI 构建）

```cmd
CI.bat
```

CI 环境使用，自动安装依赖、构建、跑测试。

### `build-better-sqlite3.bat`（原生模块编译）

```cmd
build-better-sqlite3.bat
```

仅在预编译包不可用时手动编译 `better-sqlite3`，正常情况下 `.npmrc` 的 `build_from_source=false` 已自动处理。

## 版本管理

ClassIntra 使用 `server/version.json` 管理版本，由 `client/scripts/prebuild.js` 在每次 `pnpm build` 时自动维护。

### `version.json` 结构

```json
{
  "version": "1.0.5",
  "lastBuiltVersion": "1.0.4",
  "buildHash": "l1a2b3c4d5e6f7g8",
  "buildTime": "2025-08-21T08:00:00.000Z",
  "changelog": "fix: 修复 WebSocket 断线重连\nfeat: 添加主题切换快捷键",
  "minClientVersion": "1.0.0",
  "forceUpdate": false,
  "updateUrl": ""
}
```

| 字段 | 说明 |
|------|------|
| `version` | 当前版本号（MAJOR.MINOR.PATCH） |
| `lastBuiltVersion` | 上次构建版本号 |
| `buildHash` | 构建哈希（8 字符随机串） |
| `buildTime` | 构建时间（ISO 8601） |
| `changelog` | 自动从 git log 生成 |
| `minClientVersion` | 客户端最低兼容版本 |
| `forceUpdate` | 是否强制更新（前端检测后自动刷新） |
| `updateUrl` | 更新下载地址（可选） |

### 自动递增规则

`prebuild.js` 在每次 `pnpm build` 时执行：

1. 读取 `version.json` 当前版本
2. **PATCH 自动 +1**（如 `1.0.4` → `1.0.5`）
3. 若 MAJOR 或 MINOR 变化（手动修改），PATCH 归零
4. 从 `git log` 提取自上次构建以来的 commit message 生成 changelog
5. 写入 `buildHash`、`buildTime`、`changelog`
6. 同步更新根目录 `CHANGELOG.md`

::: tip 手动升版本
要发布大版本时，手动编辑 `version.json` 改 MAJOR/MINOR：
```json
{ "version": "2.0.0", ... }
```
下次 `pnpm build` 时，prebuild 会识别到 MAJOR/MINOR 已变化，PATCH 归零并保留新版本号。
:::

### 查询当前版本

```bash
# 命令行
cat server/version.json | python -m json.tool

# API
curl http://localhost:9001/api/system/version

# 前端
# 桌面 → 设置 → 关于
```

### 强制更新

将 `version.json` 的 `forceUpdate` 设为 `true`，前端通过 `/api/system/heartbeat` 检测后强制刷新：

```bash
# 通过 API 设置（仅班管）
curl -X POST http://localhost:9001/api/system/set-version \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0.5",
    "forceUpdate": true,
    "changelog": "紧急修复：修复 JWT 泄露漏洞，请立即更新",
    "minClientVersion": "1.0.5"
  }'
```

::: warning 强制更新影响
设为 `true` 后，所有客户端会在下一次心跳检测时自动刷新页面。建议仅在紧急修复时使用，避免上课期间强制刷新。
:::

## 数据库迁移

### 自动迁移

服务启动时，`server/src/utils/migration-runner.js` 自动扫描 `server/src/migrations/` 目录，按文件名顺序执行未应用的迁移。

```bash
# 启动服务即触发迁移
pnpm start
# 或
pm2 restart classintra-server

# 日志会输出：
# [migration-runner] 当前版本: 0
# [migration-runner] 执行迁移 001_baseline (version 1)
# [migration-runner] 执行迁移 002_add_index (version 2)
# [migration-runner] 迁移完成，当前版本: 2
```

### 手动执行

```bash
# 单独运行迁移脚本
cd server
node -e "
var runner = require('./src/utils/migration-runner');
runner.runAll().then(function() {
  console.log('迁移完成');
  process.exit(0);
}).catch(function(e) {
  console.error('迁移失败:', e);
  process.exit(1);
});
"
```

### 查看迁移状态

```bash
# 已执行的迁移
sqlite3 server/database/classintra.db "SELECT * FROM schema_version ORDER BY version;"

# 输出示例：
# 1|baseline|2025-08-01 08:00:00
# 2|add-posts-index|2025-08-15 14:30:00
```

### 重置数据库

::: warning 危险操作
以下操作会**清除所有数据**，仅在开发环境或确认数据已备份时使用。
:::

```bash
# 方式一：删除数据库文件后重启（自动重建）
cd server
rm -f database/classintra.db database/classintra.db-wal database/classintra.db-shm
node src/app.js
# 自动执行 init-db.js 与所有迁移

# 方式二：使用 reset-db.js（如存在）
node src/utils/reset-db.js

# 方式三：通过迁移 down 回滚（如迁移文件提供 down）
sqlite3 server/database/classintra.db "DELETE FROM schema_version WHERE version >= 2;"
# 删除迁移 2 创建的表/索引
# 再启动服务，会重新执行迁移 2
```

### 编写迁移文件

```javascript
// server/src/migrations/003_add_reminders.js
module.exports = {
  version: 3,
  name: 'add-reminders-table',
  up: function(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        remind_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        done INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
      CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(remind_at);
    `);
  },
  down: function(db) {
    db.exec('DROP TABLE IF EXISTS reminders;');
  }
};
```

::: tip 迁移规范
- **必须幂等**：使用 `CREATE TABLE IF NOT EXISTS`、`CREATE INDEX IF NOT EXISTS`
- **必须可回滚**：提供 `down` 函数（虽然目前 migration-runner 不会自动调用，但保留备用）
- **小步前进**：一个迁移只做一件事
- **不修改现有列**：使用新迁移加列（`ALTER TABLE ... ADD COLUMN`），避免数据迁移
:::

## 质量门与生态工具

ClassIntra 提供一组验证脚本，覆盖模块化、动效规范、manifest schema 与市场应用审查。

### 质量门

| 命令 | 脚本 | 检查内容 |
|------|------|---------|
| `pnpm verify:modules` | `scripts/modularity-verify.js` | 删除式自测：无插件 / 无可选业务模块时仍能 build + boot + 冒烟 |
| `pnpm verify:motion` | `scripts/motion-verify.js` | 动效与视觉规范（E1–E8，扫描 `client/src` + `apps/`） |
| `pnpm verify:schema` | `scripts/schema-verify.mjs` | manifest schema 前后端一致性 + 42 项断言 |
| `pnpm verify:all` | — | 依次跑上述三项 |

```bash
# 一次跑完全部质量门（提交前建议执行）
pnpm verify:all
```

### 市场应用审查

```bash
# 审查单个市场应用
pnpm review:market market-apps/gomoku

# 机器可读输出（CI 集成用）
node scripts/market-review.mjs market-apps/gomoku --json
```

按五组检查：**A** manifest 合规 · **B** Chrome 80 语法 · **C** CSS 兼容 · **D** 危险 API · **E** 资源回收。
存在错误时退出码为 1，可直接用于 CI 门禁。

### 应用脚手架

```bash
# 生成市场应用（纯 JS，第三方分发）
pnpm create:app my-tool --label "我的工具"

# 带后端路由与建表 SQL
pnpm create:app my-tool --label "我的工具" --with-backend

# 生成官方内置应用（.vue，进 apps/）
pnpm create:app my-app --label "我的应用" --kind official --dir apps
```

| 选项 | 说明 |
|------|------|
| `--label <名称>` | 显示名称（默认由应用名推导） |
| `--dir <路径>` | 输出目录（默认 `market-apps/`） |
| `--kind <类型>` | `market`（默认）或 `official` |
| `--with-backend` | 生成后端路由、建表 SQL 与后端 README |
| `--color <hex>` | 主题色（默认 `#007AFF`） |
| `--force` | 目标目录已存在时覆盖 |

生成的模板本身就是「正确示例」——已预置 ES5 语法、`--ci-*` 令牌消费、`context.app.onDestroy` 四类资源回收，可直接通过 `review:market` 审查（0 错误 0 警告）。

## 常用组合命令

### 一键开发环境

```bash
# Linux / macOS
git pull && pnpm install && pnpm dev

# Windows
git pull & pnpm install & pnpm dev
```

### 一键生产部署

```bash
# 拉取最新代码
git pull

# 安装依赖
pnpm install

# 构建前端
pnpm build

# 重启 PM2
pm2 restart ecosystem.config.js --update-env

# 验证
sleep 3
curl http://localhost:9001/api/system/health
```

### 升级后回滚

```bash
# 查看历史版本
git log --oneline -10

# 回滚到某 commit
git reset --hard <commit-hash>

# 重装依赖（依赖可能变化）
pnpm install

# 重建前端
pnpm build

# 重启
pm2 restart classintra-server
```

### 数据库备份脚本

```bash
#!/bin/bash
# backup-db.sh
set -e
cd /opt/ClassIntra

DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=/backup/classintra
mkdir -p $BACKUP_DIR

# 在线备份（无需停服）
sqlite3 server/database/classintra.db ".backup '$BACKUP_DIR/classintra-$DATE.db'"

# 保留最近 30 天
find $BACKUP_DIR -name "classintra-*.db" -mtime +30 -delete

echo "[$DATE] 备份完成: $BACKUP_DIR/classintra-$DATE.db"
```

加入 crontab：

```bash
# 每日凌晨 3 点备份
0 3 * * * /opt/ClassIntra/scripts/backup-db.sh >> /var/log/classintra-backup.log 2>&1
```

## 下一步

- [调试技巧](./debugging) - 前后端调试方法
- [SDK 参考](./sdk) - 核心 API
- [监控运维](/deployment/monitoring) - PM2 与日志
- [生产部署](/deployment/production) - 部署流程
- [配置项参考](/deployment/configuration) - 环境变量
