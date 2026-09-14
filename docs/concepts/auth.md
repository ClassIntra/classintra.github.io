---
title: 认证与权限
description: ClassIntra 认证与权限系统，包含 JWT 签发与校验流程、requireAuth 中间件工作原理、权限分级表格（管理员/班管/班干/普通用户）、用户 ID 格式（YYCCNN：届+班+序号）、预注册名单机制、班管自动授权流程以及路由守卫与前端权限检查。
---

# 认证与权限

ClassIntra 采用 **JWT + Cookie** 双通道认证，权限分级基于**用户 ID 格式**（`YYCCNN`：届+班+序号）和**数据库字段**（`is_admin` / `role` / `officer_permissions`）共同判定。预注册名单机制确保只有名单内学生才能注册，班管通过 ID 末两位 `00` 自动获得本班管理权限。

源码位置：`server/src/utils/jwt.js`、`server/src/middleware/auth.js`、`server/src/routes/auth.js`、`server/src/utils/constants.js`

## JWT 签发与校验流程

### JWT 工具

源码：`server/src/utils/jwt.js`

```javascript
var jwt = require('jsonwebtoken');
var config = require('../config');

function generateToken(userInfo) {
  return jwt.sign(userInfo, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

function verifyToken(token) {
  try {
    return { valid: true, data: jwt.verify(token, config.jwt.secret) };
  } catch (err) {
    return { valid: false, data: null };
  }
}
```

### JWT Payload 结构

`buildTokenPayload(row)` 构建 JWT 载荷（见 `server/src/routes/auth.js`）：

```javascript
{
  user_id: '230801',           // 用户 ID（YYCCNN 格式）
  net_name: '小明',
  real_name: '张三',
  is_admin: 0,                 // 是否管理员（数据库字段）
  is_class_admin: true,        // 是否班管（由 user_id 格式判定）
  role: 'officer',             // 角色：'user' / 'officer' / 'admin'
  officer_permissions: '[]',  // 班干权限列表（JSON 字符串）
  officer_title: '班长',       // 班干头衔
  gender: '男'
}
```

### 签发流程

```
POST /api/auth/login 或 POST /api/auth/register
    ↓
1. 校验账号 + 密码（bcryptjs）
    ↓
2. 检查用户状态（status === 'disabled' → 拒绝）
    ↓
3. buildTokenPayload(user) 构建 payload
    ↓
4. jwtUtil.generateToken(payload) 签发 JWT
    ↓
5. setAuthCookie(res, token) 设置 httpOnly cookie
    ↓
6. 返回 { user_info, token }（token 同时返回响应体，供前端存 localStorage）
```

### Cookie 配置

```javascript
res.cookie('token', token, {
  httpOnly: true,                              // JS 不可读，防 XSS
  secure: isSecure,                            // 生产 + HTTPS 时启用
  sameSite: 'lax',                             // 防 CSRF
  maxAge: 7 * 24 * 60 * 60 * 1000              // 7 天
});
```

::: tip 双通道认证
ClassIntra 同时支持 Cookie 和 Bearer Token 两种方式传递 JWT：

- **浏览器请求**：自动携带 httpOnly cookie（同源）
- **fetch 请求**：前端从 localStorage 读取 token，附加到 `Authorization: Bearer <token>` header
- **WebSocket 连接**：token 作为 URL 参数传递
- **特殊场景**：URL query 参数 `?token=xxx`（仅在必要时使用，如文件下载）

`constants.extractToken(req)` 按优先级提取：cookie → Authorization header → query。
:::

### 校验流程

```
请求到达
    ↓
constants.extractToken(req) 提取 token
    ↓
jwt.verify(token, config.jwt.secret)
    ↓
失败 → 401 '登录已过期'
    ↓
成功 → req.user = decoded（写入用户信息）
    ↓
查数据库补充：status / role / officer_permissions / officer_title / is_admin
    ↓
status === 'disabled' → 检查 ban_expires_at
    ├─ 已过期 → 自动解封，next()
    └─ 未过期 → 403 '该账号已被禁用'
    ↓
next()
```

## requireAuth 中间件工作原理

源码：`server/src/middleware/auth.js`

### requireAuth

```javascript
function requireAuth(req, res, next) {
  var token = constants.extractToken(req);
  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }
  try {
    var decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    req.user.is_class_admin = constants.isClassAdmin(req.user.user_id);
    // 查数据库补充 role / officer_permissions / status
    // 处理 status === 'disabled' 的自动解封
    next();
  } catch (err) {
    return res.status(401).json({ code: 401, message: '登录已过期' });
  }
}
```

### requireAdmin

```javascript
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ code: 401, message: '未登录' });
  // 班管或管理员始终通过
  if (req.user.is_class_admin || req.user.is_admin === 1) return next();
  // 班干（role === 'officer'）通过，officer_permissions 已在 requireAuth 解析
  if (req.user.role === 'officer') {
    req.user.officer_permissions = JSON.parse(req.user.officer_permissions || '[]');
    return next();
  }
  // 再次从数据库确认
  // ... 否则 403
}
```

### requirePermission

```javascript
function requirePermission(permission) {
  return function(req, res, next) {
    if (!req.user) return res.status(401);
    // 班管或管理员始终通过
    if (req.user.is_class_admin || req.user.is_admin === 1) return next();
    // 班干检查具体权限
    if (req.user.role === 'officer' && Array.isArray(req.user.officer_permissions)) {
      if (req.user.officer_permissions.indexOf(permission) !== -1) return next();
    }
    return res.status(403).json({ code: 403, message: '无权限执行此操作' });
  };
}
```

## 权限分级表格

ClassIntra 权限分为四级，按优先级从高到低：

| 等级 | 标识 | 判定方式 | 权限范围 |
|------|------|----------|----------|
| **管理员** | `is_admin === 1` | 数据库 `users.is_admin` 字段，或配置 `config.adminUserIds` | 全部权限（跨班级） |
| **班管** | `is_class_admin === true` | `constants.isClassAdmin(user_id)`：ID 格式 `YYCC00`（末两位为 `00`） | 本班全部权限 |
| **班干** | `role === 'officer'` | 数据库 `users.role` 字段，需配合 `officer_permissions` 数组 | 由 `officer_permissions` 列表细粒度控制 |
| **普通用户** | `role === 'user'` | 默认 | 仅基础功能（聊天、社区、个人设置） |

::: tip 班管 vs 管理员
- **班管**：仅能管理**本班**用户（通过 `canAdminManageUser` 校验 user_id 班级前缀）
- **管理员**：可管理**所有**用户（跨班级）

开发者账号 `999999` 自动拥有管理员权限（在 `constants.isClassAdmin` 中特判）。
:::

### 班干权限（officer_permissions）

`officer_permissions` 是 JSON 字符串数组，常见权限包括：

| 权限标识 | 说明 |
|----------|------|
| `manage_users` | 用户管理（查看/封禁/解封本班用户） |
| `manage_announcements` | 公告管理 |
| `manage_broadcasts` | 广播管理 |
| `manage_app_control` | 应用管控 |
| `manage_officers` | 班干委任/撤销 |

使用示例：

```javascript
// 路由级权限校验
router.post('/users/:id/ban', auth.requireAuth, auth.requireAdmin, auth.requirePermission('manage_users'), function(req, res) {
  // 仅管理员、班管、或拥有 manage_users 权限的班干可访问
});
```

## 用户 ID 格式（YYCCNN）

ClassIntra 用户 ID 采用 **6 位数字** 格式 `YYCCNN`：

| 位置 | 含义 | 示例 |
|------|------|------|
| `YY`（1-2 位） | 入学届号（年份后两位） | `23` = 2023 届 |
| `CC`（3-4 位） | 班级号 | `08` = 8 班 |
| `NN`（5-6 位） | 序号 | `01` = 1 号 |

### 特殊格式

| 格式 | 含义 | 说明 |
|------|------|------|
| `YYCC00` | 班管 | 末两位为 `00`，自动获得本班管理权限 |
| `YYCCNN`（NN ≠ 00） | 普通学生 | 序号为 01-99 |
| `999999` | 开发者账号 | 自动拥有管理员权限，密码由 `DEV_PASSWORD` 环境变量设置 |

### 班管判定逻辑

源码：`server/src/utils/constants.js`

```javascript
function isClassAdmin(userId) {
  if (!userId) return false;
  if (userId === '999999') return true;           // 开发者账号
  if (userId.length !== 6) return false;
  if (!/^\d{6}$/.test(userId)) return false;
  var cc = userId.substring(2, 4);
  var nn = userId.substring(4, 6);
  return nn === '00' && cc !== '00';              // 末两位为 00 且中间两位不为 00
}

function getAdminClass(userId) {
  if (userId.length === 6 && /^\d{6}$/.test(userId)) {
    var cc = userId.substring(2, 4);
    var nn = userId.substring(4, 6);
    if (nn === '00' && cc !== '00') return cc;    // 返回班级号 CC
  }
  return null;
}
```

::: warning 班管只能管理本班
`admin.js` 中的 `canAdminManageUser(adminUserId, targetUserId)` 强制班管只能操作 user_id 第 3-4 位（`CC`）与自己相同的用户。这防止班管越权管理其他班级用户。
:::

## 预注册名单机制

ClassIntra 采用**预注册名单**机制：管理员预先把所有学生的姓名、user_id、性别录入 `pre_records` 表，学生注册时必须使用名单内的姓名，系统自动分配对应的 user_id。

### pre_records 表结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER | 自增主键 |
| `real_name` | TEXT | 真实姓名（UNIQUE） |
| `user_id` | TEXT | 用户 ID（UNIQUE，YYCCNN 格式） |
| `gender` | TEXT | 性别 |

### 名单来源

名单数据存储在 `server/config/pre-records.json`，按班级分组：

```json
{
  "class08": [
    { "real_name": "张三", "user_id": "230801", "gender": "男" },
    { "real_name": "李四", "user_id": "230802", "gender": "女" }
  ],
  "class18": [
    { "real_name": "王五", "user_id": "231801", "gender": "男" }
  ]
}
```

### 名单导入流程

`init-db.js` 在数据初始化时（每次启动）：

1. 动态读取 `pre-records.json` 中所有 `classXX` 键
2. **清除** `pre_records` 表所有旧记录（`DELETE FROM pre_records`）
3. 重新导入全部名单（`INSERT OR IGNORE`，避免覆盖已注册用户的 user_id）

::: warning 名单清除策略
每次启动都会 `DELETE FROM pre_records` 后重新导入，但这**不影响** `users` 表中已注册的用户。已注册用户保留原 user_id 和密码，预注册名单仅用于注册时的姓名校验和 user_id 分配。
:::

## 班管自动授权流程

班管不需要预先在数据库创建账号，由真实用户通过预注册名单注册后**自动**获得 `is_admin = 1`。

### 授权流程

```
1. 管理员在 pre-records.json 中录入班管姓名 + user_id（YYCC00 格式）
    ↓
2. 管理员在 config.adminUserIds 中添加该 user_id
    ↓
3. 班管本人通过注册页面注册（使用名单内姓名 + 自定义密码）
    ↓
4. 注册时 is_admin = config.adminUserIds.indexOf(user_id) !== -1 ? 1 : 0
    ↓
5. 数据库插入 users 表，is_admin = 1
    ↓
6. 后续每次启动，init-db.js 检查 config.adminUserIds 中的 id
    ↓
7. 已注册的班管保持 is_admin = 1（UPDATE users SET is_admin = 1）
    ↓
8. 未注册的班管不创建占位账号，等用户在注册页面注册
```

::: tip 自动清理非配置管理员
`init-db.js` 会清理非 `config.adminUserIds` 列表中的 `is_admin = 1` 用户：

```javascript
var allAdmins = db.prepare('SELECT user_id FROM users WHERE is_admin = 1').all();
for (var i = 0; i < allAdmins.length; i++) {
  if (adminIds.indexOf(allAdmins[i].user_id) === -1) {
    db.prepare('UPDATE users SET is_admin = 0 WHERE user_id = ?').run(allAdmins[i].user_id);
  }
}
```

这确保管理员权限只来自配置，不会被数据库手动修改授予。
:::

### 开发者账号

`DEV_PASSWORD` 环境变量设置时，自动创建开发者账号：

```javascript
// init-db.js
var devPassword = process.env.DEV_PASSWORD || '';
if (devPassword) {
  var devHash = bcrypt.hashSync(devPassword, 10);
  insertDev.run('开发者', '开发账号', '999999', '', devHash, 'active', 1, '{"dev":true}');
  console.log('[init-db] Dev account created: 999999');
}
```

## 路由守卫与前端权限检查

源码：`client/src/router/index.js`

### 前端路由守卫流程

```
router.beforeEach(to, from, next)
    ↓
1. 读取 localStorage.token 和 localStorage.user
    ↓
2. user.status === 'disabled' && to.name !== 'Banned' → 跳转 Banned
    ↓
3. to.meta.requiresAuth && !token → 跳转 Login
    ↓
4. 应用管控检查：
   var appName = ROUTE_APP_MAP[to.path]
   if (appName && to.meta.requiresAuth && token) {
     // 管理员/班干不受应用管控限制
     if (isAdminUser) proceedWithAdminCheck(to, next)
     // 超能岛浏览器：检查 per-user browser_enabled
     else if (appName === 'browser') { ... }
     // 其他应用：调用 /api/system/app-control 检查
     else getEnabledApps().then(...) 
   }
    ↓
5. proceedWithAdminCheck(to, next)
   if (to.meta.requiresAdmin) {
     // 检查 is_admin / role === 'officer'
     // 失败则调用 /api/auth/check-status 重新获取
   }
```

### 应用管控缓存

前端缓存启用应用列表，避免每次路由跳转都请求后端：

```javascript
var enabledAppsCache = null;       // null=未加载，数组=已加载
var enabledAppsLoading = null;     // 进行中的请求

function getEnabledApps() {
  if (enabledAppsCache !== null) return Promise.resolve(enabledAppsCache);
  if (enabledAppsLoading) return enabledAppsLoading;
  enabledAppsLoading = api.get('/system/app-control').then(function(response) {
    enabledAppsCache = response.data.data.enabled_apps || [];
    enabledAppsLoading = null;
    return enabledAppsCache;
  }).catch(function() {
    // 降级：全部启用
    enabledAppsCache = ['chat', 'community', 'ai-chat', 'notes', 'resource', ...];
    return enabledAppsCache;
  });
  return enabledAppsLoading;
}
```

::: tip 缓存清除
管理员修改应用管控后，前端通过 `router.clearAppControlCache()` 清除缓存，下次路由跳转会重新请求 `/api/system/app-control`。详见 [应用管控](./app-control)。
:::

### 前端权限检查降级

前端权限检查失败时（如 `localStorage.user` 损坏或权限字段缺失），会调用 `GET /api/auth/check-status` 重新获取用户信息：

```javascript
function proceedWithAdminCheck(to, next) {
  if (to.meta.requiresAdmin) {
    var user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user && (user.is_admin === 1 || user.role === 'officer')) {
      next();
    } else if (token) {
      // 重新获取用户状态
      api.get('/auth/check-status').then(function(response) {
        var userInfo = response.data.data.user_info;
        localStorage.setItem('user', JSON.stringify(userInfo));
        router.app.$store.commit('auth/SET_USER', userInfo);
        if (userInfo.is_admin === 1 || userInfo.role === 'officer') next();
        else next({ name: 'Desktop' });
      });
    } else {
      next({ name: 'Desktop' });
    }
  } else {
    next();
  }
}
```

::: warning 前端权限检查的局限性
前端权限检查仅为 UX 优化（避免用户进入无权限页面后再被拒绝），**真实权限校验在后端**。即使前端绕过检查，后端 `requireAuth` / `requireAdmin` / `requirePermission` 仍会拦截无权限请求。
:::

## 跨班登录与账号切换

多班部署（relay 联动）场景下，A 班设备可以登录 B 班账号（本地查不到该账号时，向配置的对端发起 `POST /api/auth/relay-verify` 验证，成功后把对端用户写入本地 `users` 表）。

### 账号匹配顺序

登录支持「学号 / 网名 / 真实姓名」三种输入。由于 `net_name` 与 `real_name` 各自有 UNIQUE 约束，但**不同字段之间可以重名**（A 的姓名恰好是 B 的网名），同一输入可能命中多行。服务端按以下顺序处理：

1. 取出全部匹配行，按「学号精确匹配 > 有本地密码 > 建号顺序」排序
2. 逐个校验密码，**任一通过即以该用户登录**（密码决定身份，而非行序）
3. 全部不通过：若存在无本地密码的行（跨班同步行）→ 转对端验证；否则返回 401
4. 多候选且非学号输入时，401 提示「匹配到多个同名账号，建议用学号登录」

### 名称冲突消解

跨班登录/同步把对端用户写入本地时，若其姓名或网名与本班用户重复，会自动追加班级标记（如 `张伟(18班)`），避免 UNIQUE 约束导致写入失败——登录路径不再报错，同步路径不再整行跳过。

### 切换账号

- 登录页在已登录状态下会显示「当前已登录：XXX（N班），登录其他账号将自动切换」，直接输入另一账号即可切换
- 设置页「退出登录」会同时清除 localStorage 与服务端 httpOnly cookie（两者缺一会残留登录态）
- 跨班登录成功时会弹提示告知当前登录的是他班账号，避免与自己的账号混淆

## 相关文档

- [架构概览](./)
- [应用架构详解](./architecture)
- [Manifest 清单](./manifest)
- [主题系统](./theme-system)
- [WebSocket 通信](./websocket)
- [应用管控](./app-control)
- [快速开始](/quick-start/)
