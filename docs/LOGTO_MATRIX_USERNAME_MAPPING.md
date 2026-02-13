# Logto 与 Matrix 用户名映射

> 统一说明 Logto 用户标识如何映射到 Matrix localpart（MXID 的 @ 前部分），以及可能出现的异常与处理。

## 一、映射规则

| 来源 | 优先级 | 说明 |
|------|--------|------|
| `userProfile.username` | 1 | Logto `/oidc/me` 返回的 `username`，通常为可读用户名 |
| `logtoSub` | 2 | Logto 的 `sub`（用户唯一 ID，如 `usr_xxx` 或 UUID） |
| `session.user` | 3 | 回退显示名 |

**实际使用**：`localpart = toMatrixLocalpart(username || logtoSub)`

- `toMatrixLocalpart` 仅保留字母数字、点、下划线、减号，其余替换为 `_`，最长 255 字符
- 示例：`mahaibo` → `@mahaibo:server`；`usr_abc123` → `@usr_abc123:server`

## 二、使用场景

| 场景 | 使用的映射 |
|------|------------|
| `getStableUserId`（会话隔离、API user_id） | username ?? logtoSub ?? user |
| `getMatrixUserId`（MXID、Admin API） | username ?? logtoSub |
| `ensureMatrixUser`（创建/更新 Matrix 用户） | username ?? logtoSub |

## 三、常见异常与处理

### 1. 历史用户 localpart 不一致 / 409 "External id is already in use"

**现象**：Logto 用户曾用 `logtoSub` 创建 Matrix 用户（如 `@bm3bzjhdyhon:server`），现改用 `username`（如 `chenwensong`），ensureMatrixUser 尝试创建 `@chenwensong:server` 时 Synapse 返回 409（external_id 已被旧用户占用）。在 Synapse Admin 中删除/停用用户后重授权，也会遇到 409（Synapse 停用不清理 external_ids）。

**自动迁移**：`ensureMatrixUser` 会检测 409，执行迁移：从占用者移除 external_id，创建 `@username:server` 并绑定 logtoSub，返回 `@username`。若预判的旧用户（@logtoSub）已被删除（404），会遍历用户列表（含停用账号）查找占用 external_id 的账号并解除绑定。

**缓存废弃**：`getMatrixUserIdForSession` 在有 username 时，仅当 `session.matrixUserId` 的 localpart 与 username 一致时采纳缓存，否则废弃并采用 `@username:server`。

### 2. Logto 未返回 username

**现象**：`userProfile.username` 为空，回退到 `logtoSub`，得到类似 `@usr_abc123:server` 的 MXID。

**处理**：在 Logto 管理台为用户设置 `username`（若 Logto 支持），或在 `claims_imports` 中配置从 OIDC 拉取。

### 3. set-password 报 "You are not a server admin"

**现象**：前端设置 Matrix 密码时，Synapse Admin API 返回 `M_FORBIDDEN`。

**处理**：在 Matrix 部署机执行 `./issue-admin-token-synapse.sh <admin_password>`，将输出的 token 写入工作区 `.env` 的 `MATRIX_ACCESS_TOKEN`。

### 4. set-password 报 "Password change disabled"

**现象**：Synapse 返回 "Password change disabled"（多见于启用 MAS 时将密码管理委托给 MAS）。

**处理**：本应用已实现自动回退：当 Synapse 返回此错误时，会改用 MAS Admin API 设密（需配置 `MAS_ADMIN_CLIENT_ID`、`MAS_ADMIN_CLIENT_SECRET`）。若使用 MAS 部署，详见 `deploy/matrix/` 与 `docs/archive/mas/`。

## 四、相关文件

- 映射逻辑：`middleware/src/services/matrixUserSync.ts`（`getMatrixUserId`、`getMatrixUserIdForSession`、`toMatrixLocalpart`、`ensureMatrixUser` 409 恢复）
- Session：`middleware/src/services/auth/sessionStore.ts`（`getStableUserId`、`matrixUserId`）
