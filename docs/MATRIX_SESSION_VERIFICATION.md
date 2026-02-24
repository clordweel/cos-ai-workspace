# Matrix 会话功能验证（优先）

用于优先通过 Matrix 会话相关功能验证：会话列表、历史消息、发消息、流式回复、前端 Sync。

- **目标**：Matrix 相关能力在 **apps/api** 中实现；验证使用 **apps/api + apps/web** 联调，根目录 `pnpm run dev` 或 `pnpm run dev:matrix` 可同时启动两者。

---

## 前提

- Synapse 已部署并可访问（见 [MATRIX_INTEGRATION_GUIDE.md](./MATRIX_INTEGRATION_GUIDE.md) 第一、二步）。
- 后端环境变量：在 **apps/api/.env** 配置。需包含：
  - `CHAT_PROVIDER=matrix`
  - `MATRIX_BASE_URL`、`MATRIX_SERVER_NAME`、`MATRIX_USER_ID`、`MATRIX_PASSWORD`（或 `MATRIX_ACCESS_TOKEN`）
  - Logto：`LOGTO_ENDPOINT`、`LOGTO_APP_ID`、`LOGTO_APP_SECRET` 等
- Logto 控制台已为该应用配置 Redirect URI：`http://<前端访问地址>/logto-callback`（如 `http://localhost:3001/logto-callback`）。

---

## 推荐验证方式：apps/api + apps/web

**终端 1：apps/api**

```bash
cd /home/frappe/workspace
pnpm run dev:api
```

确认输出无报错，监听 3000。需在 **apps/api/.env** 中配置 `CHAT_PROVIDER=matrix` 及 `MATRIX_*`、Logto 等（见该目录 `.env.example`）。

**终端 2：apps/web**

```bash
cd /home/frappe/workspace
pnpm run dev:web
```

默认将 `/api` 代理到 `http://localhost:3000`（api）。浏览器打开：**http://localhost:3001/space**。

**一键启动**：在根目录执行 `pnpm run dev` 或 `pnpm run dev:matrix`，会同时启动 api（3000）与 web（3001）。

---

## 验证步骤

### 1. 登录

- 打开 http://localhost:3001/space ，若未登录点击「登录」跳转 Logto。
- 完成 Logto 登录后应回到 `/space?auth=ok`，顶栏显示当前用户名。

### 2. /api/auth/me 含 Matrix 字段

- 打开浏览器开发者工具 → Network，刷新或进入 /space。
- 找到请求 `GET /api/auth/me`，查看响应 JSON。
- **预期**：当 **apps/api** 配置了 `CHAT_PROVIDER=matrix` 且当前用户已同步到 Matrix 时，响应中应包含：
  - `matrix_base_url`
  - `matrixSyncToken`（access_token，用于前端 Sync）
  - `matrix_user_id`
  - `matrix_device_id`（若已下发）
- 若无 `matrixSyncToken`：检查 apps/api 日志中 `ensureMatrixUser` / `ensureMatrixTokenForSession` 相关错误；或用户尚未被同步到 Matrix（见 [AUTH_AND_USER_CONFIG.md](./AUTH_AND_USER_CONFIG.md)、[LOGTO_MATRIX_AUTH_FLOW.md](./LOGTO_MATRIX_AUTH_FLOW.md)）。

### 3. 会话列表（Matrix 房间）

- 在 /space 左侧「会话列表」区域查看。
- **预期**：能拉取到会话列表（来自 Matrix 房间）；若为空，可先发一条消息产生新会话后再看。
- 若显示「拉取会话列表失败」：检查 Network 中 `GET /api/sessions` 状态与响应；确认 apps/api 的 Matrix 配置与 Synapse 可达。

### 4. 发消息与流式回复

- 在输入框输入内容并发送（可先不选会话，会自动建新会话）。
- **预期**：用户消息立即展示；助手回复以流式（打字机）形式出现；无整段一次性蹦出。
- 若 502 或流式异常：查看 Network 中 `POST /api/chat/stream` 与后端日志；确认 Dify 配置（若使用）或 mock/Matrix 流式实现正常。

### 5. 历史消息

- 点击左侧已有会话，进入该会话。
- **预期**：右侧消息区拉取并展示该会话历史（`GET /api/sessions/:id/messages`）。
- 若为空或报错：检查 `conversation_id` 与 Matrix room_id 对应关系及后端的 listMessages 实现。

### 6. 前端 Sync（可选）

- 当 `GET /api/auth/me` 返回了 `matrixSyncToken` 且前端无报错时，新前端会启动 Matrix Sync 客户端。
- **预期**：其他端（如 Element）在同一房间发消息时，本页面在对应会话下能实时看到新消息（或刷新后可见）；加密房间需 device_id 与 E2EE 配置支持。
- 若未拿到 token：先完成「2. /api/auth/me 含 Matrix 字段」；若 token 有但 Sync 不工作：查看浏览器控制台是否有 `[MatrixSync]` 相关报错。

---

## 故障排查

| 现象 | 建议 |
|------|------|
| 前端 404 / 白屏 | 确认访问的是 http://localhost:3001/space 且 dev:web 已启动。 |
| /api 请求 404 或未代理 | 确认 dev:web 的 proxy target 为后端（3000）；检查 `apps/web/.env` 或环境变量 `WEBPACK_PROXY_TARGET`。 |
| 401 未登录 | 先完成 Logto 登录；检查后端 Cookie 与 Logto 回调配置。 |
| /api/sessions 502 或 501 | 后端未用 Matrix 或 Matrix 未配置：确认 **apps/api/.env** 中 `CHAT_PROVIDER=matrix` 且 `MATRIX_*` 正确，重启 apps/api。 |
| /api/auth/me 无 matrixSyncToken | 用户未同步到 Matrix 或 token 获取失败：查后端日志；确认 Logto 与 Matrix 同步流程（见 [LOGTO_MATRIX_AUTH_FLOW.md](./LOGTO_MATRIX_AUTH_FLOW.md)）。 |
| 流式一次性蹦出 | 见项目 CHANGELOG / 阶段 3.3：前端需关闭 devServer 压缩（`compress: false`）；后端可加 `Cache-Control: no-transform`、`X-Accel-Buffering: no`。 |
