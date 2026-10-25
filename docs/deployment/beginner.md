---
title: 10 分钟部署上线（保姆级）
description: 面向零基础使用者的完整部署教程。从装 Node、克隆仓库、配置、首次初始化向导、开机自启，到让全班平板连上，每一步都有可复制的命令、预期输出和出错排查。
outline: [2, 3]
---

# 10 分钟部署上线（保姆级）

这份教程假设你**没有任何服务器经验**，只用一台 Windows 电脑（班主任的办公机、机房的一台机器都可以）。
照着做，最后全班平板打开浏览器就能进入班级桌面。

全程分三段：**装（约 5 分钟）→ 初始化（约 3 分钟）→ 开进教室（约 2 分钟）**。
Linux 用户跳到 [附录：Linux 差异](#附录linux-差异)。

::: tip 部署前先确认三件事
1. 这台电脑**不会关机**、**和学生的平板在同一个局域网**（同一个 WiFi 或同一台路由器）。
2. 你知道这台电脑的**局域网 IP**（下面第 6 步教你查）。
3. 你有全班同学的**真实姓名名单**（Excel 或 txt 都行），初始化时要导入。
:::

## 第一段：装（5 分钟）

### 第 1 步：装 Node.js

打开 [nodejs.org](https://nodejs.org)，下载 **LTS 版本**（左边那个绿色按钮），一路「下一步」装完。

装完**关掉所有窗口**，重新打开命令提示符（按 `Win + R`，输入 `cmd`，回车），输入：

```bash
node -v
```

看到 `v20.x.x` 这样的输出就成了。（**看不到、报"不是内部或外部命令"**，说明装的时候没勾选加入 PATH，重装一遍并保持默认选项。）

### 第 2 步：装 pnpm

在同一个窗口里：

```bash
npm install -g pnpm
pnpm -v
```

看到版本号（如 `10.x.x`）即成功。

### 第 3 步：下载 ClassIntra

选一个**路径里没有中文和空格**的目录，比如 `D:\`。执行：

```bash
D:
git clone https://github.com/ClassIntra/ClassIntra.git
cd ClassIntra
```

如果 `git` 也没装，去 [git-scm.com](https://git-scm.com) 下载安装，或者直接下载 ZIP 解压——
叫「ClassIntra」的文件夹出现在你选的位置就对了。

### 第 4 步：安装依赖

```bash
pnpm install
```

这一步会下载依赖，**首次大约 1~5 分钟**，屏幕上滚很多行是正常的。
结束时看到 `Done in xx.xs` 就成功了。

> **卡住或报错？** 多半是网络。国内建议先设置镜像：
> ```bash
> pnpm config set registry https://registry.npmmirror.com
> ```
> 然后重新 `pnpm install`。
>
> 如果报 `better-sqlite3` 编译失败，执行 `pnpm rebuild better-sqlite3` 再试一次。

### 第 5 步：构建前端

```bash
pnpm build
```

结束时产物在 `client/dist/`。看到 `✓ built in xx.xxs` 即成功。

> 这一步是整个流程里最慢的（约 1~3 分钟），**别中途关窗口**。

## 第二段：初始化（3 分钟）

### 第 6 步：查这台电脑的局域网 IP

新开一个命令提示符窗口：

```bash
ipconfig
```

在输出里找 **「IPv4 地址」**，形如 `192.168.1.23` 或 `10.0.0.15`。记下来，后面学生就用这个地址访问。

::: warning 一定要用局域网 IP，不要用 127.0.0.1
`127.0.0.1` 只代表「本机」，别的平板打不开。要选 `192.168.x.x` / `10.x.x.x` 这类开头的那条。
如果你看到多个，选和你们 WiFi 网关同网段的那个。
:::

### 第 7 步：启动服务（第一次）

**保持这个窗口开着**，它就是服务器：

```bash
pnpm start
```

正常会打印一串日志，最后出现类似：

```text
[init-db] 迁移完成: 应用 0 个，当前版本 v1
[Server] HTTP 服务运行在 9001
[WebSocket] 服务器运行在 10001
```

> **关于 .env**：一般**不需要手动配**。JWT 密钥会在首次启动时自动生成到 `server/keys/`，
> 数据库会自动创建到 `server/database/`。
> 只有在需要自定义（比如带宽更高的天气源、多班中继）时才去改 `server/.env`，
> 参照 `server/.env.example` 的注释。**要改先停服务（Ctrl+C），改完再启动。**

### 第 8 步：打开初始化向导

在这台电脑的浏览器里访问：

```text
http://localhost:9001/setup
```

你会看到一个四步向导：

| 步骤 | 填什么 | 注意 |
|---|---|---|
| **1. 届数** | 毕业年份后两位，如 `25` | 决定用户 ID 前两位（25 届 → `25xxxx`） |
| **2. 班级** | 班级号如 `08`，班级名如「8班」 | 用户 ID 形如 `250801`（25 届 08 班 01 号） |
| **3. 名单** | 点「导入名单」，粘贴全班真实姓名 | 每个班一份；有重复会自动跳过 |
| **4. 班管** | 从名单里点选班管 | 班管 ID 末两位固定为 `00`，即 `250800` |

最后点「确认」→ 看到「配置完成」。

::: tip 这一步在做什么
初始化只做一件事：把**真实姓名 → 学生编号**的对应关系写进数据库。
学生之后自己注册时，填真实姓名就会被自动匹配到编号——不需要你一个个建账号。
:::

### 第 9 步：注册你自己（班管）

打开 `http://localhost:9001`，点注册，**真实姓名填你在第 8 步选为班管的那个人**，设定密码。

注册完自动成为管理员——进桌面后能看到「设置」「管理」等管理入口。

## 第三段：开进教室（2 分钟）

### 第 10 步：平板连上来

让每个学生在平板浏览器输入：

```text
http://192.168.1.23:9001
```

（把 `192.168.1.23` 换成第 6 步查到的 IP。）

家长/学生自备设备也能用，只要连的是同一个 WiFi。

### 第 11 步：验证一切正常

在**任意一台平板**上依次确认：

- [ ] 能打开登录页，能注册/登录
- [ ] 桌面图标显示正常，能点开聊天
- [ ] 发一条消息，另一台平板能立刻收到（这说明 WebSocket 通了）
- [ ] 超能岛（右上角）能拉下来

**发消息收不到**是最常见的问题，见下面的排查表。

### 第 12 步：设成开机自启

现在服务靠第 7 步那个黑窗口活着——关了就停了，重启电脑也就没了。用 PM2 托管：

```bash
npm install -g pm2
pm2 start ecosystem.config.js --only classintra-server,classintra-https
pm2 save
pm2 startup
```

`pm2 startup` 会打印一行 `sudo ...` 或 `pm2 ...` 命令，**复制它并执行一次**。

检查状态：

```bash
pm2 status
```

应该看到 `classintra-server` 和 `classintra-https` 两个进程都是 `online`。

::: danger 必须用 `--only`
`ecosystem.config.js` 里有五个进程，另外三个（`tunnel-gateway`、`chmlfrp-frpc`、`pcagent`）
是项目实际部署站点用的**公网隧道与远程运维配套**，里面写死了某台机器的绝对路径
（`C:\Users\...\ChmlFrp-...`、`D:\NetWork\noVNC\...`）。普通班级部署直接
`pm2 start ecosystem.config.js` 会让这三个进程报 `errored` 并不断重启。

所以：**只启动 `classintra-server` 和 `classintra-https`**。如果已经误启动了，执行：

```bash
pm2 delete tunnel-gateway chmlfrp-frpc pcagent
pm2 save
```
:::

从此以后，**电脑重启后服务会自己起来**，不用再手动开窗口。

## 日常运维（收藏这一节）

### 每天要看一眼

```bash
pm2 status                  # 两个进程是否是 online
curl http://localhost:9001/api/system/health   # status 应为 healthy
```

`health` 返回里 `database` / `websocket` 都是 `ok` 就没问题。

### 更新到新版本

```bash
cd D:\ClassIntra
git pull
pnpm install
pnpm build
pm2 restart all --update-env
```

> `--update-env` 不能省：改了 `server/.env` 之后没有它就还是老配置。

### 备份（每周一次，两分钟）

需要备份的只有三样：

| 备份什么 | 路径 | 为什么 |
|---|---|---|
| 数据库 | `server/database/classintra.db` | 所有用户、消息、帖子 |
| 配置 | `server/.env` | 端口、密钥、中继设置 |
| **JWT 私钥** | `server/keys/` | 丢了全班都要重新登录；这也是安全敏感文件 |

一条命令打包（PowerShell）：

```powershell
$d = Get-Date -Format "yyyyMMdd-HHmm"
Compress-Archive -Path server\database\classintra.db, server\.env, server\keys `
  -DestinationPath "D:\backup\classintra-$d.zip"
```

恢复就是把这三样放回原位置，然后 `pm2 restart all`。

### HTTPS（可选，想让平板地址栏出现小锁时做）

局域网内 HTTP 也能正常用。如果你需要 HTTPS（比如某些浏览器限制），简要步骤：

1. 确认 `mkcert.exe` 在仓库根目录（已自带）；
2. 执行 `mkcert -install` 安装本地根证书；
3. 运行 `server/scripts/generate-certs.ps1` 生成本机证书到 `server/certs/`；
4. `pm2 restart classintra-https`；
5. 平板访问 `https://<你的IP>:9443`。

::: warning 注意端口是 9443
HTTPS 默认用 **9443**，不是 443——这是刻意的，避免和机器上其他服务抢 443。
证书用的是本地自签，**每台平板首次访问要手动信任一次**（点「高级」→「继续访问」）。
详细说明见 [HTTPS 配置](https://github.com/ClassIntra/ClassIntra/blob/main/docs/HTTPS-%E9%85%8D%E7%BD%AE%E8%AF%B4%E6%98%8E.md)。
:::

## 出问题了？按这张表查

| 症状 | 最可能的原因 | 怎么修 |
|---|---|---|
| 本机能开，平板打不开 | 用了 `localhost` / `127.0.0.1`，或不在同一网络 | 改用局域网 IP（第 6 步）；确认平板连的是同一个 WiFi |
| 页面能开但一直转圈 | 前端没构建 | 在项目根目录跑 `pnpm build` |
| 能登录，但发消息没反应 | WebSocket 的 10001 端口不通 | Windows 防火墙放行 9001 和 10001；见下 |
| 提示端口被占用 | 9001 已被别的程序占用 | 服务会自动顺延，看启动日志里实际端口；或改 `server/.env` 的 `PORT` |
| `/setup` 打不开 | 已经初始化过了 | 初始化只用一次；之后改配置在管理端做 |
| 启动报数据库错误 | 权限不足或磁盘满 | 确认有写权限；`server/database/` 可删后重启自动重建（**会清空数据，先备份**） |
| 服务启动后秒退 | 端口全被占 / Node 版本过低 | `node -v` 至少 18；`pm2 logs classintra-server` 看报错 |
| 平板页面白屏 | 老内核兼容问题 | 见 [Chrome 80 兼容](/development/chrome-80-compat) |

### 放行防火墙端口（Windows）

以**管理员身份**打开 PowerShell，执行：

```powershell
New-NetFirewallRule -DisplayName "ClassIntra HTTP" -Direction Inbound -LocalPort 9001 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "ClassIntra WS"   -Direction Inbound -LocalPort 10001 -Protocol TCP -Action Allow
```

### 看日志

```bash
pm2 logs classintra-server --lines 100     # 最近 100 行
pm2 logs classintra-server --err           # 只看错误
```

## 附录：Linux 差异

整体流程相同，只有这几处不同：

| 步骤 | Windows | Linux |
|---|---|---|
| 装 Node | 官网安装包 | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash - && sudo apt install -y nodejs` |
| 查 IP | `ipconfig` | `ip addr`（看 `eth0` / `wlan0` 的 `inet`） |
| 防火墙 | `New-NetFirewallRule` | `sudo ufw allow 9001/tcp && sudo ufw allow 10001/tcp` |
| 开机自启 | `pm2 startup` 后执行提示命令 | 同上，按提示带 `sudo` 执行 |
| 后台常驻 | pm2 即可 | 推荐再用 `systemd` 包一层，或直接 `pm2 startup systemd` |

更细的生产环境选项（Nginx 反代、系统服务、监控）见 [生产部署](/deployment/production)。

## 下一步

| 你想做 | 去哪 |
|---|---|
| 管理用户、应用、广播 | [基本使用](/quick-start/basic-usage) |
| 改端口、配置天气源、多班中继 | [配置项](/deployment/configuration) |
| 给班里装第三方应用 | [市场应用生命周期](/development/market-apps) |
| 自己写一个应用 | [第一个应用：从零到上架](/development/first-app) |
| 多班互联（跨班聊天/共享云盘） | [教育场景部署](/deployment/education) |
