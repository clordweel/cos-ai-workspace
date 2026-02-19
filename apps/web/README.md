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

**登录页报「认证服务不可用（404）」时**：说明前端请求不到 `/api/auth/logto/config`。  
1. **推荐**：启动中间层，并在 `.env` 中设置 `WEBPACK_PROXY_TARGET` 指向中间层（如 `http://localhost:3000`），然后重启 `pnpm run dev`。  
2. **仅跑前端时**：在 `.env` 中设置 `LOGTO_ENDPOINT`、`LOGTO_APP_ID`（见 `.env.example`），重新执行 `pnpm run dev` 或 `pnpm run build`；登录跳转可用，但回调换 token 仍需中间层。

## 测试版邀请码门控

为避免测试版部署后被非测试人员访问，可在构建时启用邀请码门控：

- **环境变量**：构建前设置 `INVITE_CODE=你的邀请码`（如 `INVITE_CODE=test2025`），则访问任意路径会先进入「邀请码验证」页，输入正确邀请码后才可继续。
- **通过后**：同会话内不再询问（`sessionStorage`）；关闭浏览器后再次访问需重新输入。
- **懒加载**：未通过门控时，主应用路由（首页、会话页等）不加载，仅加载门控页与登录相关页，降低被直接抓包分析业务逻辑的风险。

不设置 `INVITE_CODE` 或置空时，不展示门控页，行为与原有一致。

**开发模式下调试门控页**：

1. **推荐**：在 `apps/web` 下将 `INVITE_CODE=你的邀请码` 写入 `.env`（或从 `.env.example` 复制并取消注释该行），保存后执行 `pnpm run dev`。
2. **方式二（跨平台）**：在 **仓库根目录** 执行 `pnpm run dev:web:invite`，或在 **apps/web** 下执行 `pnpm run dev:invite`，会以邀请码 `test2025` 启用门控并启动 dev（Windows/Linux/macOS 均生效）；如需其它邀请码可改 `apps/web/package.json` 中 `dev:invite` 脚本里的 `INVITE_CODE` 值。
3. 访问 http://localhost:3001 会先进入邀请码页，输入与 `INVITE_CODE` 一致的内容即可继续。
4. 需要再次调试门控页时：在地址栏加上 `?forceInviteGate=1`（如 `http://localhost:3001/#/?forceInviteGate=1`）并刷新，或清除 Session Storage 中的 `app_invite_verified` 后刷新。

## 反向代理部署

同域代理时，将 `/` 指向前端（如 3001）即可，Hash 路由不依赖服务端路径。详见仓库根目录 `docs/REVERSE_PROXY_SINGLE_DOMAIN.md`。
