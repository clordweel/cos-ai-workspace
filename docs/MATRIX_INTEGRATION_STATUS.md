# Matrix 整合现状与问题梳理

> 梳理当前 Matrix（Synapse + MAS）与 Logto 整合的状态，并列出已发现的问题与改进建议。最后更新：2026-02-11。

---

## 一、整体架构

```
┌─────────────┐    Logto     ┌─────────────┐   Cookie/Session   ┌─────────────────┐
│   前端       │ ←─────────→ │  中间层      │ ←───────────────→  │ Session Store   │
│  (Nuxt 3)   │   OIDC      │ (Fastify)   │                    │ (memory/Redis)  │
└─────────────┘              └──────┬──────┘                    └─────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
            ┌──────────────┐ ┌─────────────┐ ┌─────────────┐
            │ Matrix 8008  │ │ Logto        │ │ Dify        │
            │ (nginx→MAS/  │ │ Management   │ │ (流式 AI)   │
            │  Synapse)    │ │ API          │ │             │
            └──────────────┘ └─────────────┘ └─────────────┘
```

### 流量路由（deploy/matrix/nginx-mas.conf）

| 路径 | 转发目标 | 用途 |
|------|----------|------|
| `/api/` | MAS:8080 | MAS Admin API（Personal Session、用户查询） |
| `/oauth2/` | MAS:8080 | OAuth2 client_credentials、token |
| `/_matrix/client/(v1\|v3\|r0)/(login\|logout\|refresh)` | MAS:8080 | 登录/登出/刷新 |
| `/_matrix`、`/_synapse` | Synapse:8008 | Matrix C-S API、Synapse Admin API |

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
| 1 | MAS Personal Session | `MAS_ADMIN_CLIENT_ID` + `MAS_ADMIN_CLIENT_SECRET` 且 `CHAT_PROVIDER=matrix` | 无密码，通过 MAS Admin API 签发 token |
| 2 | 缓存密码登录 | `matrixPasswordStore` 有该用户的密码 | 用户曾「设置 Matrix 密码」，缓存命中 |
| 3 | Admin 设密 + 登录 | 回退方案 | `setMatrixPasswordByAdmin` + `loginAsUser`，用户不存在时先 `ensureMatrixUser` 创建 |

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
| `MATRIX_BASE_URL` | Synapse/MAS 根 URL（如 `http://10.1.1.15:8008`） |
| `MATRIX_SERVER_NAME` | MXID 域名（如 `10.1.1.15`） |
| `MATRIX_USER_ID` + `MATRIX_PASSWORD` \| `MATRIX_ACCESS_TOKEN` | 仅 Admin API（ensureMatrixUser、setMatrixPasswordByAdmin），不参与会话 |
| `MAS_ADMIN_CLIENT_ID` + `MAS_ADMIN_CLIENT_SECRET` | MAS Personal Session（可选） |

### 3.2 deploy/matrix 部署

- **基础**：`bootstrap.sh` → Synapse + PostgreSQL
- **MAS 扩展**：`bootstrap-mas.sh` → MAS + nginx + syn2mas 用户迁移
- MAS 启用后：`/login` 由 MAS 处理，Synapse Admin API 仍为 Synapse

---

## 四、发现的问题

### 4.1 【高】Matrix Token 过期未校验

**现象**：`requireMatrixToken` 和 `ensureMatrixTokenForSession` 仅检查 `session.matrixAccessToken` 是否存在，不检查 `matrixTokenExpiresAt`。

**影响**：Token 已过期时仍被使用，直到 Matrix API 返回 401；前端收到 401 后才可能触发重新获取，体验差。

**建议**：在 `ensureMatrixTokenForSession` 开头或 `requireMatrixToken` 中，若 `matrixTokenExpiresAt` 存在且 `< Date.now() + BUFFER_MS`，则清空 `matrixAccessToken` 并重新获取。

---

### 4.2 【高】MAS 启用后：新用户仅在 Synapse，不在 MAS

**现象**：

- `ensureMatrixUser` 通过 **Synapse Admin API** 创建用户，用户只存在于 Synapse。
- `syn2mas` 仅做一次性迁移，**之后新创建的用户不会自动进 MAS**。
- nginx 将 `/_matrix/.../login` 转发到 MAS，MAS 负责认证；MAS 中无用户时，`loginAsUser` 会失败。

**影响**：启用 MAS 后，Admin 设密 + 登录 回退路径对「Logto 新用户」可能失败：Synapse 有用户，但 MAS 无，`/login` 到 MAS 认证失败。

**缓解**：

1. 若使用 MAS：优先依赖 Personal Session（`getMasUserByUsername` → `createPersonalSession`），新用户需先在 MAS 中存在。
2. MAS 用户来源：`syn2mas` 迁移 + 手动/脚本通过 MAS Admin API 创建，或配置 MAS `upstream_oauth2` 为 Logto 后由 OAuth 首次登录自动创建。
3. 文档需明确：启用 MAS 时，`ensureMatrixUser` 只在 Synapse 创建；若要走 Admin 设密回退，需保证该用户也在 MAS（或 MAS 能代理到 Synapse 认证）。

---

### 4.3 【中】set-password 的 Admin 权限（MAS 下）

**现象**：启用 MAS 后，Synapse 的 admin 判定由 MAS 负责；admin 密码登录获得的 token 可能不含 `urn:synapse:admin:*` scope。

**处理**：`bootstrap-mas.sh` 已设置 `admin_users` 和 `can_request_admin`；若仍报 "You are not a server admin"，需配置 `MATRIX_ACCESS_TOKEN`（用 `mas-cli manage issue-compatibility-token` 或 Synapse Admin 签发的 admin token）。详见 `docs/LOGTO_MATRIX_USERNAME_MAPPING.md` §3。

**"Password change disabled"**：MAS 启用后 Synapse Admin API 会返回此错误。本应用已实现自动回退到 **MAS Admin API** 设密；需配置 `MAS_ADMIN_CLIENT_ID`、`MAS_ADMIN_CLIENT_SECRET`。若仍失败，检查 MAS `account.password_change_allowed: true`。详见 `docs/LOGTO_MATRIX_USERNAME_MAPPING.md` §4。

---

### 4.4 【中】MAS baseUrl 与 Admin API 路径

**现状**：`config.mas.baseUrl` 使用 `MATRIX_BASE_URL`（如 `http://10.1.1.15:8008`）。nginx 将 `/api/`、`/oauth2/` 转发到 MAS，因此：

- `POST {baseUrl}/oauth2/token` → MAS ✓
- `GET {baseUrl}/api/admin/v1/users?...` → MAS ✓
- `POST {baseUrl}/api/admin/v1/personal-sessions` → MAS ✓

**结论**：配置正确；若 MAS 与 Synapse 分离部署，需单独配置 `MAS_BASE_URL`（当前无此变量）。

---

### 4.5 【中】用户名映射与历史用户不一致

**现象**：Logto 用户曾用 `logtoSub` 创建 Matrix 用户（如 `@usr_xyz:server`），现改用 `username`（如 `mahaibo`），MXID 变为 `@mahaibo:server`，与既有用户不一致。

**处理**：在 Logto 中保持 `username` 与 Matrix 既有 localpart 一致，或在 Matrix/MAS 中做别名/迁移。详见 `docs/LOGTO_MATRIX_USERNAME_MAPPING.md` §3.1。

---

### 4.6 【低】invite 时 inviteeUserId 的 MXID 解析

**代码**：`chat.ts` 中 `inviteeMxid = inviteeUserId.includes(':') ? inviteeUserId : getMatrixUserId(inviteeUserId)`。

**问题**：`getMatrixUserId(inviteeUserId)` 只接收一个参数，会当作 `logtoSub` 使用；若 `inviteeUserId` 是 username 而非 logtoSub，可能得到错误 MXID。当前 `getMatrixUserId(logtoSub, username)` 需要两个参数才能正确映射。

**建议**：若 `inviteeUserId` 可能为 username，需明确约定或增加 `getMatrixUserId(inviteeUserId, inviteeUserId)` 式调用，或要求调用方传完整 MXID。

---

### 4.7 【低】会话列表 updatedAt 非真实最后活动时间

**现象**：Matrix 适配器对所有房间使用 `updatedAt: Date.now()`，列表顺序不是按房间最后活动时间。需额外请求（如 `/sync` 或每房间最新事件）才能得到真实时间，见 `docs/SESSION_MATRIX_ANALYSIS.md` §2.2。

---

### 4.8 【低】Logto 未返回 username 时的 MXID

**现象**：`userProfile.username` 为空时回退到 `logtoSub`，得到类似 `@usr_abc123:server` 的 MXID。需在 Logto 管理台或 `claims_imports` 中配置 `username`。

---

## 五、相关文件速查

| 职责 | 文件 |
|------|------|
| 认证流程 | `docs/LOGTO_MATRIX_AUTH_FLOW.md` |
| 用户名映射 | `docs/LOGTO_MATRIX_USERNAME_MAPPING.md` |
| MAS/AS 调研 | `docs/MAS_AND_AS_RESEARCH.md` |
| 会话设计 vs Matrix | `docs/SESSION_MATRIX_ANALYSIS.md` |
| Token 获取 | `middleware/src/services/matrixSessionToken.ts` |
| MAS Admin API | `middleware/src/services/masAdminApi.ts` |
| 用户同步 | `middleware/src/services/matrixUserSync.ts` |
| 配置 | `middleware/src/config.ts` |
| 部署 | `deploy/matrix/README.md`、`bootstrap-mas.sh`、`nginx-mas.conf` |

---

## 六、故障排查：Logto 授权后 Synapse Admin 无用户

**现象**：Logto 重新授权后，Synapse Admin 仍看不到该用户。

**可能原因与处理**：

| 原因 | 处理 |
|------|------|
| **Admin token 无 Synapse admin 权限（MAS 下常见）** | 使用 `MATRIX_USER_ID`+`MATRIX_PASSWORD` 登录时，MAS 签发的 token 可能缺 `urn:synapse:admin:*` scope。在 `.env` 中改用 `MATRIX_ACCESS_TOKEN`（用 `mas-cli manage issue-compatibility-token` 或 Synapse Admin 签发具 admin 权限的 token）。 |
| **Matrix 未配置** | 确认 `MATRIX_BASE_URL`、`MATRIX_SERVER_NAME`、`MATRIX_ACCESS_TOKEN` 或 `MATRIX_USER_ID`+`MATRIX_PASSWORD` 已正确填写。 |
| **网络/权限** | 检查中间层日志中的 `[auth] Matrix 用户同步失败` 或 `[matrixUserSync] ensureMatrixUser 失败`，查看 status 与 error。 |

**验证**：重新登录后查看中间层控制台，成功时应出现 `[auth] Matrix 用户已创建: @xxx:server` 或 `Matrix 用户已存在`。

## 七、建议的改进优先级

1. **P0**：若启用 MAS 且 Admin API 仍 403，优先配置 `MATRIX_ACCESS_TOKEN` 替代密码登录
2. **P1**：增加 Matrix token 过期校验与自动刷新（或清空后重取）
3. **P2**：明确 MAS 启用时新用户创建策略（Synapse vs MAS），并更新文档与脚本
4. **P3**：修正 invite 时 inviteeUserId 的 MXID 解析逻辑
5. **P4**：可选：会话列表按真实 last_active 排序（需额外 Matrix API 调用）
