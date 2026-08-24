# ClassIntra 文档

ClassIntra 官方文档站，使用 VitePress 构建，内容覆盖安装、账号与 API、联机 Gomoku、第三方市场、开发、部署和 API 参考。

## 本地开发

```bash
npm install
npm run dev
npm run build
```

文档源文件位于 `docs/`。新增页面后，请在 `docs/.vitepress/config.mts` 中补充导航或侧边栏入口。账号与 API 约定见 `docs/quick-start/account-and-api.md`，联机 Gomoku 约定见 `docs/development/gomoku-online.md`。

第三方市场相关页面应说明市场源和应用生命周期；当前官方市场源为 `https://raw.githubusercontent.com/ClassIntra/market/main/`。涉及五子棋的交互、工具或实现参考时，请保留 [iFlyCompass](https://github.com/MoyuZJ912/iFlyCompass) 致谢，并遵守相关许可证和署名要求。
