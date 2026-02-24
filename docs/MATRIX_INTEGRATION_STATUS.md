# Matrix 整合现状与问题梳理

> Matrix（Synapse）与 Logto 整合现状与已知问题。最后更新：2026-02-13。

**部署**：推荐 **Synapse 单机**（`deploy/matrix/bootstrap.sh`）。MAS 为可选扩展，实现与脚本见 `deploy/matrix/` 与 `docs/archive/mas/`，此处不展开。

---

## 一、整体架构

```
┌─────────────┐    Logto     ┌─────────────┐   Cookie/Session   ┌─────────────────┐
│   前端       │ ←─────────→ │  中间层      │ ←───────────────→  │ Session Store   │
│ (apps/web)  │   OIDC      │ (apps/api)  │                    │ (memory/Redis)  │
└─────────────┘              └──────┬──────┘                    └─────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
            ┌──────────────┐ ┌─────────────┐ ┌─────────────┐
            │ Synapse 8008  │ │ Logto        │ │ Dify        │
            │ (Matrix C-S、  │ │ Management   │ │ (流式 AI)   │
            │  Admin API)   │ │ API          │ │             │
            └──────────────┘ └─────────────┘ └─────────────┘
```

---

## 二、认证与 Token 流程

### 2.1 Logto 登录 → Matrix 用户同步

1. 用户在前端点击 Logto 登录，完成 OAuth 授权。
2. 中间层 `handleLogtoCallback` 用 code 换 token，调用 `syncMatrixUser`（异步）。
3. `ensureMatrixUser` 调用 **Synapse Admin API** `PUT /_synapse/admin/v2/users/{user_id}`：
   - 用户不存在 → 创建并设随机密码（不存、不告知）
   - 已存在 → 更新 displayname/external_ids/threepids，不修改密码

### 2.2 Matrix Token 获取（ensureMatrixTokenForSession）

| 优先级 | 方案 | 条件 | 说明 |
|--------|------|------|------|
| 1 | 缓存密码登录 | `matrixPasswordStore` 有该用户的密码 | 用户曾「设置 Matrix 密码」，缓存命中 |
| 2 | Admin 设密 + 登录 | 默认回退 | `setMatrixPasswordByAdmin` + `loginAsUser`，用户不存在时先 `ensureMatrixUser` 创建 |
| （可选） | MAS | 配置 `MAS_ADMIN_CLIENT_ID` / `MAS_ADMIN_CLIENT_SECRET` | 见 `masAdminApi.ts`、`docs/archive/mas/` |

### 2.3 Token 使用入口

- `GET /api/auth/me`：若无 `matrixAccessToken` 则调用 `ensureMatrixTokenForSession`
- `POST /api/chat/stream`、`GET /api/sessions`、`GET /api/sessions/:id/messages`、`POST /api/sessions`、`POST /api/sessions/:id/invite`：经 `requireMatrixToken` 确保有 token

### 2.4 设计约束：无 admin 代理会话

- **会话操作**（列表、历史、发消息、建房间、邀请）**一律使用当前用户 token**，不使用 admin。
- **MATRIX_USER_ID / MATRIX_ACCESS_TOKEN** 仅用于 Synapse Admin API（`ensureMatrixUser`、`setMatrixPasswordByAdmin`），不参与会话代理。
- **助手回复**：仅经 SSE 推给前端，不写入 Matrix 房间（避免引入 admin/bot 代理）。

---

## 三、配置与部署状态

### 3.1 中间层（工作区 .env）

| 变量 | 用途 |
|------|------|
| `CHAT_PROVIDER` | `mock`（默认）\| `matrix` |
| `MATRIX_BASE_URL` | Synapse 根 URL（如 `http://10.1.1.15:8008`） |
| `MATRIX_SERVER_NAME` | MXID 域名（如 `10.1.1.15`） |
| `MATRIX_USER_ID` + `MATRIX_PASSWORD` \| `MATRIX_ACCESS_TOKEN` | 仅 Admin API（ensureMatrixUser、setMatrixPasswordByAdmin、可选邀请直接加入），不参与会话 |
| `MATRIX_BOT_USER_ID` + `MATRIX_BOT_ACCESS_TOKEN` | 可选：助手回复写入房间时以该 bot 身份发送，不配则仅经 SSE 推前端 |

### 3.2 deploy/matrix 部署

- **推荐**：`bootstrap.sh` → Synapse + PostgreSQL（单机）
- 可选 MAS 扩展见本目录 `bootstrap-mas.sh`、`docker-compose.mas.yml`，不在此展开

---

## 四、邀请与发消息流程（已修复）

### 4.0.1 邀请制

- 仅使用 **Client API 邀请**（`/rooms/:id/invite`）：创建会话后邀请对方，对方会收到邀请事件，需在「待接受邀请」中**接受**后才加入房间并收消息。前端提供待接受邀请列表与接受/拒绝操作。

### 4.0.2 「邀请后发消息对方收不到」的修复

- **原因**：前端发流式消息时若未带 `conversation_id`（或映射未就绪），中间层会认为无当前会话而新建房间并发消息到新房间，导致对方仍在原房间收不到消息。
- **修复**：前端在调用 `POST /api/chat/stream` 时使用 `conversationId: getConversationId(currentId) ?? currentId`，确保有会话时始终带上房间 id，避免误建新会话。

---

## 五、发现的问题

### 5.1 【高】Matrix Token 过期未校验

**现象**：`requireMatrixToken` 和 `ensureMatrixTokenForSession` 仅检查 `session.matrixAccessToken` 是否存在，不检查 `matrixTokenExpiresAt`。

**影响**：Token 已过期时仍被使用，直到 Matrix API 返回 401；前端收到 401 后才可能触发重新获取，体验差。

**建议**：在 `ensureMatrixTokenForSession` 开头或 `requireMatrixToken` 中，若 `matrixTokenExpiresAt` 存在且 `< Date.now() + BUFFER_MS`，则清空 `matrixAccessToken` 并重新获取。

---

### 5.2 【中】用户名映射与历史用户不一致

**现象**：Logto 用户曾用 `logtoSub` 创建 Matrix 用户（如 `@usr_xyz:server`），现改用 `username`（如 `mahaibo`），MXID 变为 `@mahaibo:server`，与既有用户不一致。

**处理**：在 Logto 中保持 `username` 与 Matrix 既有 localpart 一致，或做别名/迁移。详见 `docs/LOGTO_MATRIX_USERNAME_MAPPING.md`。

---

### 5.3 【低】invite 时 inviteeUserId 的 MXID 解析

**代码**：`chat.ts` 中 `inviteeMxid = inviteeUserId.includes(':') ? inviteeUserId : getMatrixUserId(inviteeUserId)`。

**问题**：`getMatrixUserId(inviteeUserId)` 只接收一个参数，会当作 `logtoSub` 使用；若 `inviteeUserId` 是 username 而非 logtoSub，可能得到错误 MXID。当前 `getMatrixUserId(logtoSub, username)` 需要两个参数才能正确映射。

**建议**：若 `inviteeUserId` 可能为 username，需明确约定或增加 `getMatrixUserId(inviteeUserId, inviteeUserId)` 式调用，或要求调用方传完整 MXID。

---

### 5.4 【低】会话列表 updatedAt 非真实最后活动时间

**现象**：Matrix 适配器对所有房间使用 `updatedAt: Date.now()`，列表顺序不是按房间最后活动时间。需额外请求（如 `/sync` 或每房间最新事件）才能得到真实时间，见 `docs/SESSION_MATRIX_ANALYSIS.md` §2.2。

---

### 5.5 【低】Logto 未返回 username 时的 MXID

**现象**：`userProfile.username` 为空时回退到 `logtoSub`，得到类似 `@usr_abc123:server` 的 MXID。需在 Logto 管理台或 `claims_imports` 中配置 `username`。

---

## 六、相关文件速查

| 职责 | 文件 |
|------|------|
| 认证流程 | `docs/LOGTO_MATRIX_AUTH_FLOW.md` |
| 用户名映射 | `docs/LOGTO_MATRIX_USERNAME_MAPPING.md` |
| 会话设计 vs Matrix | `docs/SESSION_MATRIX_ANALYSIS.md` |
| Token 获取 | `apps/api/src/services/matrixSessionToken.ts` |
| 用户同步 | `apps/api/src/services/matrixUserSync.ts` |
| 配置 | `apps/api/src/config.ts` |
| 部署 | `deploy/matrix/README.md` |

---

## 六、前端实时消息（Sync）不可用排查

**现象**：聊天只在刷新时拉取消息，没有实时新消息。

**前端依赖**：`/api/auth/me` 返回 `matrixSyncToken`、`matrix_base_url`、`matrix_user_id` 时，前端才会启动 Matrix sync 客户端（`useMatrixSyncClient`），通过 `ClientEvent.Event` 接收新消息并 append 到当前会话。当前采用**方案二/三**（列表/历史/发消息走中间层，Sync 前端直连），sync 阶段已实现；baseUrl 优先用 API 下发的 `matrix_base_url`，缺省时用 `NUXT_PUBLIC_MATRIX_BASE_URL`。

| 可能原因 | 排查与处理 |
|----------|------------|
| **CHAT_PROVIDER 非 matrix** | 确认 `.env` 中 `CHAT_PROVIDER=matrix`；为 `mock` 时后端不返回 sync 用字段，前端不会启动 sync。 |
| **未登录或 /me 未带 Cookie** | 使用 Logto 登录；确保请求 `/api/auth/me` 时带 `credentials: 'include'`，且会话有效。 |
| **后端未返回 matrixSyncToken** | `/api/auth/me` 仅在 `config.chat?.provider === 'matrix'` 且能拿到 `matrixAccessToken` 时写入 `matrixSyncToken`。若 `ensureMatrixTokenForSession` 失败（用户未同步、已停用、无密码等），则不会返回 token。查看中间层日志中 `ensureMatrixUser` / `ensureMatrixTokenForSession` 相关错误。 |
| **前端 startClient 失败** | 开发环境下打开浏览器控制台，若看到 `[MatrixSync] startClient 失败，实时消息不可用:` 则说明 `matrix-js-sdk` 的 `startClient()` 抛错。若报错为「does not provide an export named 'default'」或「does not provide an export named 'EventEmitter'」等，属 **CJS/ESM 互操作**：将报错路径中的包名加入 apps/web 的 Webpack 配置（或见 `docs/MATRIX_SYNC_FRONTEND_APPROACH.md`）。apps/web 使用 Webpack，CJS 兼容性较好。其他报错根据内容修正（CORS、baseUrl、token 等）。 |
| **Sync 进入 ERROR 状态** | 控制台出现 `[MatrixSync] sync state ERROR` 表示与服务器的长轮询/同步出错，需检查网络与 Matrix 服务可用性。 |
| **initialSyncLimit 过小** | 前端默认 `initialSyncLimit: 50`；若房间很多且当前房间未在首屏 sync 中，可适当增大或后续用 filter 优化。 |

**验证**：登录后打开开发者工具 Console，无 `[MatrixSync] startClient 失败` 且能收到新消息即表示 sync 正常。

---

## 七、故障排查：Logto 授权后 Synapse Admin 无用户

**现象**：Logto 重新授权后，Synapse Admin 仍看不到该用户。

**可能原因与处理**：

| 原因 | 处理 |
|------|------|
| **Matrix 未配置** | 确认 `MATRIX_BASE_URL`、`MATRIX_SERVER_NAME`、`MATRIX_ACCESS_TOKEN` 或 `MATRIX_USER_ID`+`MATRIX_PASSWORD` 已正确填写。 |
| **Admin token 无权限** | 若 set-password 等报 "You are not a server admin"，在部署机用 `./issue-admin-token-synapse.sh` 签发 token 并配置 `MATRIX_ACCESS_TOKEN`。 |
| **网络/权限** | 检查中间层日志中的 `[auth] Matrix 用户同步失败` 或 `[matrixUserSync] ensureMatrixUser 失败`，查看 status 与 error。 |

**验证**：重新登录后查看中间层控制台，成功时应出现 `[auth] Matrix 用户已创建: @xxx:server` 或 `Matrix 用户已存在`。

## 八、建议的改进优先级

1. **P1**：增加 Matrix token 过期校验与自动刷新（或清空后重取）
2. **P2**：修正 invite 时 inviteeUserId 的 MXID 解析逻辑
3. **P3**：可选：会话列表按真实 last_active 排序（需额外 Matrix API 调用）
