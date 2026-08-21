---
title: 教育场景部署
description: ClassIntra 教育场景部署指南，覆盖单班硬件要求、局域网网络拓扑、ADMIN_USER_IDS 班管 ID 配置、预注册名单、多班级 COHORT 届数配置、跨班 Relay 中继、Tailscale VPN 组网与平板浏览器兼容性。
---

# 教育场景部署

ClassIntra 为校园内网设计，一台普通服务器 + 学生平板即可支撑一个班级的完整 WebOS 体验。本页面面向教育场景的运维与老师，介绍单班部署、多班联动与跨校区组网的实战配置。

## 班级硬件要求

### 服务器（一台）

| 项目 | 单班（30~60 人） | 多班（200+ 人） | 说明 |
|------|-----------------|----------------|------|
| **CPU** | 双核 1.6 GHz+ | 四核 2.4 GHz+ | 长驻 Node.js 单进程 |
| **内存** | 1 GB | 2~4 GB | PM2 `max_memory_restart=512MB` |
| **硬盘** | 1 GB SSD | 10 GB SSD | 数据库 + 资源 + 日志 |
| **网卡** | 千兆有线 | 千兆有线 | 内网核心交换机 |
| **操作系统** | Windows 10 / Ubuntu 22.04 | Linux LTS | 跨平台均可 |
| **Node.js** | 18 LTS | 18/20 LTS | 必装 |
| **PM2** | 自带 | 自带 | 进程守护 |

### 学生终端（平板 / 笔记本）

| 项目 | 最低 | 推荐 | 说明 |
|------|------|------|------|
| **浏览器** | Chrome 80+ / Safari 14+ | Chrome 100+ / Safari 15+ | 兼容 ES2017 + Options API |
| **屏幕** | 1024×768 | 横屏 1280×800+ | 桌面横屏优化 |
| **网络** | Wi-Fi 4 / 有线 | Wi-Fi 5 / 千兆有线 | 局域网即可 |

::: tip 零客户端安装
学生端**无需安装任何 App**，平板浏览器访问 `http://<server-ip>:9001/` 即可使用。可添加到主屏幕以全屏 PWA 体验。
:::

## 网络拓扑

### 单班级局域网（推荐）

```
                    ┌──────────────────┐
                    │   班级 Wi-Fi AP   │
                    └─────────┬────────┘
                              │ 局域网 192.168.1.0/24
            ┌─────────────────┼─────────────────┐
            │                 │                 │
       ┌────┴────┐      ┌────┴────┐      ┌────┴────┐
       │ 平板 1  │      │ 平板 2  │ ...  │ 平板 N  │
       └─────────┘      └─────────┘      └─────────┘
                              │
                       ┌──────┴──────┐
                       │   服务器    │  192.168.1.100:9001
                       │ ClassIntra  │  192.168.1.100:10001 (WS)
                       └─────────────┘
```

::: tip 局域网无外网
ClassIntra 数据全部存储在服务器本地 SQLite，**不依赖任何公网服务**即可运行核心功能（聊天、社区、笔记、资源仓库、桌面、超能岛）。仅在需要 AI 聊天、天气、联网搜索时才访问外部 API。
:::

### 多班级联动拓扑

```
   ┌──────────────┐         ┌──────────────┐
   │  1 班服务器  │◄────────│  2 班服务器  │
   │  (Relay A)  │  TCP    │  (Relay B)  │
   │ :9001 :10011│  :10011 │ :9001 :10011 │
   └──────┬───────┘         └──────┬───────┘
          │                        │
       局域网 A                  局域网 B
       (1 班平板)               (2 班平板)
```

跨班级消息通过 Relay 中继端口（10011）双向同步，详见 [跨班级联动](#跨班级联动-relay-中继配置)。

## ADMIN_USER_IDS 配置

班管 ID 格式为 `YYCC00`：

| 段位 | 含义 | 取值 | 示例 |
|------|------|------|------|
| `YY` | 届数（毕业年后两位） | 00~99 | `25` = 2025 届 |
| `CC` | 班级编号 | 00~99 | `01` = 1 班 |
| `00` | 固定后缀 | `00` | 标识班管身份 |

示例：
- `250100` —— 25 届 01 班班管
- `250800` —— 25 届 08 班班管
- `250100,250200` —— 同时指定 25 届 01 班与 02 班班管（多班场景）

修改 `server/.env`：

```bash
# 单班班管
ADMIN_USER_IDS=250100

# 多班班管（逗号分隔）
ADMIN_USER_IDS=250100,250200,250800
```

::: warning 班管不预创建账号
班管**不需要单独创建账号**。流程：
1. 班管姓名已写入预注册名单（`server/config/pre-records.json`）
2. 班管访问注册页，使用真实姓名注册
3. 系统匹配 `ADMIN_USER_IDS`，自动授予管理员权限

请确保预注册名单中包含班管的姓名，否则注册后无法获得管理员权限。
:::

## 预注册名单配置

预注册名单存储在 `server/config/pre-records.json`，格式：

```json
{
  "class01": ["张三", "李四", "王五", "赵六"],
  "class08": ["钱七", "孙八", "周九"],
  "class18": ["吴十", "郑十一"]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `classNN` | 键名 | `NN` 为班级编号（01~99），需与 `ADMIN_USER_IDS` 中的 `CC` 段对齐 |
| 学生姓名数组 | `string[]` | 该班全部学生真实姓名 |

系统会自动为每位学生分配 `YYCCNN` 格式学号：
- 届数 `YY` —— 从 `.env` 的 `COHORT` 读取
- 班级 `CC` —— 从键名 `classNN` 读取
- 序号 `NN` —— 数组索引 +1（01, 02, 03...）

::: tip 首次配置向导
若不熟悉 JSON，可直接访问 `http://<server-ip>:9001/setup` 通过 Web 向导完成预注册名单导入，向导会自动写入 `pre-records.json`。
:::

::: warning 姓名真实性
学生注册时必须使用**与预注册名单完全一致的真实姓名**才能匹配学号。建议老师提前收集并核对名单。
:::

## 多班级部署

### COHORT 届数配置

`COHORT` 用于跨班级中继过滤——**只有同届班级之间才会同步消息**，避免不同届之间互相干扰。

```bash
# 25 届所有班级联动
COHORT=25

# 多届并存（逗号分隔）
COHORT=25,26
```

::: tip 自动推断
`COHORT` 留空时，系统会从 `ADMIN_USER_IDS` 自动推断（取首位 `YY`）。多班班管 ID 同届时建议显式设置以避免歧义。
:::

### 多班级独立部署

每班一台服务器时，各班 `.env` 独立：

```bash
# 1 班服务器 .env
ADMIN_USER_IDS=250100
COHORT=25
RELAY_SERVER_ID=class-1
RELAY_SERVERS=192.168.1.101:10011   # 2 班服务器
RELAY_SECRET=<共享密钥>

# 2 班服务器 .env
ADMIN_USER_IDS=250200
COHORT=25
RELAY_SERVER_ID=class-2
RELAY_SERVERS=192.168.1.100:10011   # 1 班服务器
RELAY_SECRET=<共享密钥>            # 必须与 1 班一致
```

## 跨班级联动 Relay 中继配置

Relay 中继用于在多台 ClassIntra 服务器之间同步聊天、社区、应用状态等数据。

### 配置项

| 变量 | 说明 | 示例 |
|------|------|------|
| `RELAY_SERVERS` | 对端服务器列表（逗号分隔，格式 `host:port`） | `192.168.1.101:10011,192.168.1.102:10011` |
| `RELAY_SECRET` | 共享密钥（所有节点必须一致） | `<32 字符随机串>` |
| `RELAY_SERVER_ID` | 本节点唯一标识 | `class-1` / `server-a` |
| `RELAY_PORT` | 本节点监听端口 | `10011` |
| `COHORT` | 届数过滤 | `25` |

### 启用流程

1. 在所有服务器上设置相同的 `RELAY_SECRET`：
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. 在每台服务器上配置对端地址：
   ```bash
   # 服务器 A
   RELAY_SERVER_ID=server-a
   RELAY_SERVERS=192.168.1.101:10011
   RELAY_SECRET=<共享密钥>

   # 服务器 B
   RELAY_SERVER_ID=server-b
   RELAY_SERVERS=192.168.1.100:10011
   RELAY_SECRET=<共享密钥>
   ```

3. 重启 PM2 服务：
   ```bash
   pm2 restart classintra-server
   ```

4. 验证中继状态：
   ```bash
   curl http://localhost:9001/api/system/health | jq .data.checks.relay
   # 期望 "status": "ok"
   ```

::: warning Relay 端口防火墙
`RELAY_PORT`（默认 10011）需要在服务器之间互相可达，但**不可暴露到公网**。在防火墙中限制源 IP 为对端服务器。
:::

::: tip 中继消息过滤
Relay 只同步以下类型消息：
- 聊天消息（公共频道）
- 社区帖子与评论
- 应用状态变更（如公告、桌面布局）
- 系统通知

学生私聊、个人笔记等**不同步**，保护隐私。
:::

## Tailscale VPN 组网（可选）

跨校区或跨网络部署时，使用 [Tailscale](https://tailscale.com/) 建立 WireGuard 隧道，无需开放公网端口。

### 安装 Tailscale

:::: details Linux 服务器
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```
::::

:::: details Windows 服务器
从 [tailscale.com/download](https://tailscale.com/download) 下载安装包，登录账号后启用。
::::

### 配置 ClassIntra 走 Tailscale

```bash
# server/.env
TAILSCALE_ENABLED=true
TAILSCALE_RELAY_IP=100.64.0.1   # 对端服务器的 Tailscale IP

# Relay 服务器地址改用 Tailscale IP
RELAY_SERVERS=100.64.0.2:10011
RELAY_SECRET=<共享密钥>
```

::: tip Tailscale 优势
- **零端口暴露**：所有节点走内网 IP，无需公网端口
- **加密传输**：WireGuard 自动加密
- **ACL 控制**：可限制哪些节点能互访
- **免费额度**：个人与小团队足够（100 设备）
:::

::: warning Tailscale 状态检查
ClassIntra 后端会调用 `tailscale status --json` 检查节点状态。确保 `tailscale` 命令在服务器 PATH 中可用。
:::

## 平板浏览器配置

### Chrome 兼容性

ClassIntra 前端代码刻意保留 `var` / `function` / Options API 写法，确保 Chrome 80+ 兼容（详见 [Chrome 80 兼容](/development/#chrome-80-兼容)）。

| 浏览器 | 最低版本 | 推荐版本 | 状态 |
|--------|---------|---------|------|
| Chrome | 80 | 100+ | ✅ 完全兼容 |
| Edge | 80 | 100+ | ✅ 完全兼容 |
| Safari (iOS) | 14 | 15+ | ✅ 完全兼容 |
| Firefox | 80 | 100+ | ✅ 完全兼容 |
| IE 11 | — | — | ❌ 不支持 |

### 平板浏览器优化设置

**Chrome Enterprise（推荐）**：
1. 关闭自动更新（避免上课期间弹窗）
2. 设置主页为 `http://<server-ip>:9001/`
3. 启用全屏模式（kiosk 模式）：
   ```bash
   chrome.exe --kiosk http://192.168.1.100:9001/ --noerrdialogs --disable-translate
   ```

**iPad Safari**：
1. 添加到主屏幕 → 全屏 PWA 体验
2. 关闭「请求桌面网站」
3. 启用横屏锁定

::: tip 离线缓存
首次加载后，前端核心资源会被 Service Worker 缓存。即使服务器短暂中断，已加载的学生仍可查看缓存内容。
:::

## 最佳实践

::: tip 教育场景部署清单

**硬件**
- ✅ 服务器接有线网络，避免 Wi-Fi 干扰
- ✅ 配置 UPS 不间断电源，避免突发断电损坏数据库
- ✅ 学生平板统一浏览器版本（建议 Chrome 100+）

**网络**
- ✅ 班级 Wi-Fi 独立 SSID，避免与其他班级抢占带宽
- ✅ 服务器 IP 固定（DHCP 静态绑定或手动配置）
- ✅ 仅在需要外网 API 时配置出口代理

**数据**
- ✅ 每周备份 `server/database/` 目录到外部存储
- ✅ `pre-records.json` 与 `.env` 备份保存
- ✅ 学期初测试一次完整恢复流程

**运维**
- ✅ 配置 PM2 开机自启（`pm2 startup && pm2 save`）
- ✅ 设置 `VERBOSE_LOG=0` 减少磁盘占用
- ✅ 定期 `pm2 flush` 清理旧日志

**安全**
- ✅ Wi-Fi 启用 WPA2/WPA3
- ✅ 服务器禁用默认账号、修改 RDP/SSH 密码
- ✅ 班管账号提醒学生保密
:::

::: warning 上课期间运维
- 课中**不要重启服务器**，会导致全体学生掉线
- 升级请在课后或周末进行
- 大版本升级前先在备用机测试
:::

## 下一步

- [生产部署](./production) - 完整生产环境配置
- [配置项参考](./configuration) - 全部环境变量
- [监控运维](./monitoring) - 日志、备份、故障排查
- [快速开始](/quick-start/) - 安装与首次配置向导
