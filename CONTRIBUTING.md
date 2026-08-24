# 文档贡献指南

- 使用 `npm install` 安装依赖，提交前运行 `npm run build`。
- 页面使用现有 VitePress Markdown 结构和中文术语；新增页面后同步更新 `docs/.vitepress/config.mts` 的导航或侧边栏。
- 账号与 API 示例只能使用占位账号、密码、Token、Cookie 和密钥，不得提交真实凭据。
- 联机 Gomoku 文档应覆盖房间 API、棋盘规则、WebSocket 事件和断线恢复。
- 第三方市场文档应说明市场源、安装/更新/启用/禁用/卸载流程及 iFlyCompass 致谢。
- 不修改或覆盖主仓库的 CHANGELOG、logo 和用户未提交内容；文档仓库只提交与本次功能相关的页面、导航和构建配置。
