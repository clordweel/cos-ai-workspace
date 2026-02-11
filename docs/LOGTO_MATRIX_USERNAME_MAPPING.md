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
| `getMatrixUserId`（MXID、MAS 查询、Admin API） | username ?? logtoSub |
| `ensureMatrixUser`（创建/更新 Matrix 用户） | username ?? logtoSub |
| `getMasUserByUsername`（MAS 用户查询） | localpart（来自 username ?? logtoSub） |

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

**原因**：启用 MAS 后，Synapse 的 admin 判定由 MAS 负责；admin 用户密码登录获得的 token 默认可能不含 `urn:synapse:admin:*` scope。

**处理**：
1. 在 MAS 配置中为 admin 加入 `policy.data.admin_users: ["admin"]`
2. 在 MAS 数据库执行：`UPDATE users SET can_request_admin = true WHERE username = 'admin';`
3. 重启中间层，使其用新 token 调用 Admin API（或等当前 token 过期后自动重新登录）
4. 若仍失败，使用 `MATRIX_ACCESS_TOKEN`：通过 `mas-cli manage issue-compatibility-token` 或 Synapse Admin 签发具 admin 权限的 token，写入 `.env`

### 4. set-password 报 "Password change disabled" / "密码更改功能已禁用"

**现象**：登录用户在「设置 Matrix 密码」表单提交时，前端显示「Password change disabled 密码更改功能已禁用」或类似错误。

**可能原因与处理**：

1. **MAS 下 Synapse Admin API 禁用**：启用 MAS (MSC3861) 后，Synapse 将密码管理委托给 MAS，Synapse Admin API 的 `PUT users/{id}` 会返回 "Password change disabled"。本应用已实现**自动回退**：当 Synapse 返回此错误时，改用 **MAS Admin API** `POST /api/admin/v1/users/{ulid}/set-password` 设密。需在 `.env` 配置 `MAS_ADMIN_CLIENT_ID`、`MAS_ADMIN_CLIENT_SECRET`（与 `bootstrap-mas.sh` 生成的 admin client 一致），MAS 已启用 `adminapi` 并加入 `admin_clients`。

2. **MAS 账户配置**：MAS `account.password_change_allowed` 为 `false` 时，用户自助修改密码被禁用。`bootstrap-mas.sh` 已默认写入 `account.password_change_allowed: true`。若为存量部署，可在 `mas-config/override.yaml` 中增加：
   ```yaml
   account:
     password_change_allowed: true
   ```
   然后重启 MAS 容器。

3. **Admin API 权限**：本应用的 set-password 先尝试 Synapse Admin API，403 时回退到 MAS Admin API。若报 `M_FORBIDDEN` 或 "You are not a server admin"，按 §3 配置 `MATRIX_ACCESS_TOKEN`（Synapse 路径）或 MAS admin client（MAS 路径）。

4. **Logto 与 Matrix 区分**：若提示来自 Logto 账户页（如点击「重新授权」后），属 Logto Account API 的密码权限设置，与本应用的 Matrix set-password 无关。本应用 Matrix 密码通过 `POST /api/auth/matrix/set-password` 设置。

## 四、相关文件

- 映射逻辑：`middleware/src/services/matrixUserSync.ts`（`getMatrixUserId`、`getMatrixUserIdForSession`、`toMatrixLocalpart`、`ensureMatrixUser` 409 恢复）
- Session：`middleware/src/services/auth/sessionStore.ts`（`getStableUserId`、`matrixUserId`）
- MAS 配置：`deploy/matrix/bootstrap-mas.sh`（`admin_users`、`can_request_admin`）
