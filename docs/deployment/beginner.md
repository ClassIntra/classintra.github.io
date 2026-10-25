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

## 先选一条路：两种部署方式

| | **方式 A：运维控制台（推荐给零基础）** | **方式 B：命令行** |
|---|---|---|
| 需要敲命令 | 几乎不用，全程点鼠标 | 需要 |
| 装依赖 / 构建 | 控制台代劳，实时回显进度 | 自己跑 `pnpm install` / `pnpm build` |
| 密钥配置 | 图形表单（自动打码、留空不覆盖） | 手改 `server/.env` |
| 看日志 / 查状态 | 界面里看 | `pm2 logs` / `curl` |
| 适用 | 班主任、机房管理员、第一次部署 | 有开发经验、要精确控制、Linux 服务器 |

两条路**最终跑起来的是同一个东西**，学会一条就行。下面先讲方式 A（大多数人该走的），
方式 B 从 [第 1 步](#方式-b第-1-步装-nodejs) 开始。

::: tip 部署前先确认三件事
1. 这台电脑**不会关机**、**和学生的平板在同一个局域网**（同一个 WiFi 或同一台路由器）。
2. 你知道这台电脑的**局域网 IP**（方式 B 第 6 步 / 方式 A 第 A5 步教你查）。
3. 你有全班同学的**真实姓名名单**（Excel 或 txt 都行），初始化时要导入。
:::

---

# 方式 A：用运维控制台（零命令行）

**ClassIntraOps** 是一个 Windows 单文件程序，负责「拉代码 → 装依赖 → 构建 → 启动服务 → 日常运维」的全流程。
它不是什么第三方工具，是 ClassIntra 官方仓库的一部分（[ClassIntra-Ops](https://github.com/ClassIntra/ClassIntra-Ops)）。

::: warning 当前是测试版
v0.2 测试阶段，配置格式可能变化。**升级前备份 `ClassIntraOps.config.json`**。
:::

## 第 A1 步：下载并打开

去 [Releases 页面](https://github.com/ClassIntra/ClassIntra-Ops/releases) 下载
`ClassIntraOps-v0.2-win-x64.exe`，**双击即用**，不需要安装 .NET、不需要命令行。

首次打开会进「欢迎页」。窗口点 ✕ 不会退出（收进托盘），真正退出要走托盘右键菜单。

## 第 A2 步：让控制台拿到 CI 仓库

欢迎页有两个按钮，按情况选：

| 你的情况 | 点哪个 | 它会做什么 |
|---|---|---|
| 还没有 ClassIntra 代码 | **下载并安装 CI** | git 拉取 → 装依赖 → 构建 → PM2 启动，全程实时回显 |
| 已经有代码（比如手动 git clone 过） | **选择已有 CI 目录** | 直接指向那个文件夹即可 |

判定标准是目录里同时有 `ecosystem.config.js` 和 `server/`。

## 第 A3 步：检查环境依赖

控制台会自动检测这四项，并在欢迎页给出可用性结论：

| 工具 | 用途 | 没有的话 |
|---|---|---|
| node | 运行 CI 本体 | 去 [nodejs.org](https://nodejs.org) 装 LTS |
| pnpm | 装依赖、构建前端 | `npm install -g pnpm` |
| git | 拉取源码 | 去 [git-scm.com](https://git-scm.com) 装 |
| pm2 | 托管进程 | `npm install -g pm2` |

四个**全部变绿**才能继续。有红的就按表格装，装完点刷新重新检测。

## 第 A4 步：走完安装

在「安装更新」页点安装。进度会实时刷出来，大约 1~5 分钟，**别关窗口**。

结束时 PM2 会把 CI 的进程拉起来。

::: danger 这里有个坑：一定要只留两个进程
安装时控制台执行的是 `pm2 start ecosystem.config.js`（**不带 `--only`**），会把 `ecosystem.config.js`
里的**五个**进程全部拉起来。其中三个是项目实际站点用的公网隧道与远程运维配套
（`tunnel-gateway`、`chmlfrp-frpc`、`pcagent`），里面写死了某台机器的绝对路径
（`C:\Users\...\ChmlFrp-...`、`D:\NetWork\noVNC\...`）——在你的电脑上必然启动失败并反复重启。

**处理**：装完后打开「总览」页，看到那三个进程是 `errored` / `stopped`，直接在命令行清理一次：

```bash
pm2 delete tunnel-gateway chmlfrp-frpc pcagent
pm2 save
```

或者用控制台里对应的进程操作把它们删掉。**只保留 `classintra-server` 和 `classintra-https` 两个进程 online 即可**，
它们才是提供班级服务的主体。
:::

## 第 A5 步：查局域网 IP

方式 A 同样需要知道这台电脑的 IP，因为学生要用它访问。控制台的「环境设置」页会显示本机网络信息；
或者按 `Win + R` 输入 `cmd`，执行 `ipconfig`，找「IPv4 地址」（`192.168.x.x` / `10.x.x.x`）。

::: warning 别用 127.0.0.1
`127.0.0.1` 只代表本机，平板打不开。必须是局域网 IP。
:::

## 第 A6 步：配置密钥（可选）

仓库就位后进入「密钥配置」页。表单是根据 `server/.env.example` 自动推导出来的：

- **留空 = 不覆盖**，所以不填也能正常跑（JWT 密钥会自动生成、数据库会自动建）
- 密钥输入框**打码**显示，不会回显明文
- 保存时**自动备份**

需要填的通常只有天气源（`QWEATHER_KEY`）。改完之后**必须点「应用配置重启」**——
它执行的是 `pm2 restart ecosystem.config.js --update-env`。普通重启不会重新加载环境变量，这是常见的踩坑点。

## 第 A7 步：初始化班级（两种做法选一种）

**做法一：在控制台里填（推荐）**

进「**班级初始化**」页，一次填完：届数 → 班级 → 班管 → 导入全班真实姓名名单。
学号由 CI 自动分配（班管 `YYCC00`、学生 `YYCCnn`），填完**直接就能用，不用再去浏览器打开 `/setup`**。

**做法二：浏览器打开向导**

```
http://localhost:9001/setup
```

四步填完：**届数 → 班级 → 名单（导入全班真实姓名）→ 班管**，看到「配置完成」即成功。

两种方式背后是同一套初始化逻辑（Ops 的表单最终也是调 CI 的 `/api/setup/save`），
所以用哪种都行。然后打开 `http://localhost:9001` 用班管的真实姓名注册，自动获得管理员权限。

详细说明见 [方式 B 第 8 步](#第-8-步打开初始化向导)。

## 第 A8 步：日常运维就在控制台里

| 要做的事 | 去哪 |
|---|---|
| 看服务是否活着、CPU/内存占用 | **总览**页（还有历史曲线） |
| 改完 `.env` 让配置生效 | 总览页「**应用配置重启**」 |
| 拉取新版本 | **安装更新**页 |
| 看服务日志 | **服务日志**页 |
| 跨班对端探活 | **跨班对端**页 |
| 备份 | **备份**页（覆盖数据库、`.env`、`version.json`、config；**不含 `server/keys/`，JWT 私钥需自己另存**） |

::: tip 遇到闪退或异常
控制台本身出问题会写 `logs/crash.log`（不会静默闪退）。反馈问题时附上这个文件。
:::

## 备选：Web 控制台

如果桌面版本打不开（比如公司电脑限制了 exe），仓库里还有零依赖的 Web 控制台：

```bash
cd ClassIntra-Ops/ops-server
node server.js
```

默认只监听 `127.0.0.1:9099`——**只能本机访问**，这是刻意的，因为它能读写 `.env` 里的全部密钥。
访问 `http://127.0.0.1:9099`。

---

# 方式 B：命令行

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
| 用图形界面做日常运维 | [运维控制台（ClassIntraOps）](/ops/) |
| 给班里装第三方应用 | [市场应用生命周期](/development/market-apps) |
| 自己写一个应用 | [第一个应用：从零到上架](/development/first-app) |
| 多班互联（跨班聊天/共享云盘） | [教育场景部署](/deployment/education) |
