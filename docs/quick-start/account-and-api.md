---
title: 账号与 API 快速开始
description: ClassIntra 账号注册、登录、Token、Cookie、权限字段与 API 调用入门。
---

# 账号与 API 快速开始

本页帮助开发者用不含真实凭据的方式完成登录、认证请求和错误处理。完整接口说明见主仓库 [账号与 API 教程](https://github.com/ClassIntra/ClassIntra/blob/main/docs/account-and-api-guide.md)。

## 设置变量

```bash
BASE_URL="http://localhost:9001"
TOKEN="TOKEN_FROM_LOGIN_RESPONSE"
```

## 登录并调用接口

```bash
curl -c cookies.txt -X POST "$BASE_URL/api/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"account":"YOUR_ACCOUNT","password":"YOUR_PASSWORD"}'
curl "$BASE_URL/api/auth/check-status" -H "Authorization: Bearer $TOKEN"
```

登录响应同时返回 `data.token` 并设置 `httpOnly` Cookie。脚本使用 Bearer，浏览器 Cookie 请求使用 `credentials: 'include'`。

```js
var response = await fetch(BASE_URL + '/api/user/profile', { credentials: 'include' })
var result = await response.json()
if (!response.ok || result.code !== 200) throw new Error(result.message || '请求失败')
```

## 刷新与权限

`POST /api/auth/refresh-token` 接受 Cookie 或 Bearer，并返回新 Token。`401` 时最多刷新一次，失败后回到登录页。用户信息中的 `is_admin`、`is_class_admin`、`role`、`officer_permissions` 和 `officer_title` 可用于显示能力，但最终权限以服务端响应为准。

## 常见错误

- `400`：字段或格式错误，不要重试。
- `401`：未登录或过期，尝试一次刷新。
- `403`：账号禁用或无权限。
- `409`：网名冲突等资源冲突，使用最新数据恢复。
- `500/502`：服务端或市场源异常，幂等请求可退避重试。

不要在代码、URL、日志和问题反馈中保存真实密码、Cookie、JWT 或密钥。
