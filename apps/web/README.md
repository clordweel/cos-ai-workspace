# 工作台前端（React + Webpack）

当前使用 **Hash 路由**（`HashRouter`），地址形如 `http://localhost:3001/#/space`、`http://localhost:3001/#/space/!roomId%3Ahost`。服务端无需 SPA fallback，任意路径均返回 `index.html` 即可。

## 开发

```bash
pnpm install
pnpm run dev
```

访问 **http://localhost:3001**，会话页为 **http://localhost:3001/#/space**。

## 生产构建与预览

```bash
pnpm run build
pnpm run preview
```

## Logto 登录（Hash 路由）

- 若由**前端承载回调**（Redirect URI 指向前端）：在 Logto 应用里配置 Redirect URI 为 `http://localhost:3001/#/logto-callback`（生产环境替换为实际域名）。前端会从 hash 中解析 `code` 并交给中间层换 token。
- 若由**中间层承载回调**（默认）：Redirect URI 为中间层地址（如 `http://localhost:3000/api/auth/logto/callback`），登录成功后中间层会 302 到前端 `/space?auth=ok`；前端会检测并跳转到 `#/space`。

## 反向代理部署

同域代理时，将 `/` 指向前端（如 3001）即可，Hash 路由不依赖服务端路径。详见仓库根目录 `docs/REVERSE_PROXY_SINGLE_DOMAIN.md`。
