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

### 1. 历史用户 localpart 不一致

**现象**：Logto 用户曾用 `logtoSub` 创建 Matrix 用户（如 `@usr_xyz:server`），现改用 `username`（如 `mahaibo`），查到的 MXID 变成 `@mahaibo:server`，与真实用户 `@usr_xyz:server` 不一致。

**处理**：
- 在 Logto 中保持 `username` 与 Matrix 既有 localpart 一致；或
- 在 Matrix/MAS 中为该用户建立别名或迁移（需按实际部署处理）

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

## 四、相关文件

- 映射逻辑：`middleware/src/services/matrixUserSync.ts`（`getMatrixUserId`、`toMatrixLocalpart`）
- 稳定用户 ID：`middleware/src/services/auth/sessionStore.ts`（`getStableUserId`）
- MAS 配置：`deploy/matrix/bootstrap-mas.sh`（`admin_users`、`can_request_admin`）
