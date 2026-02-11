# 用户认证与配置管理（统一由 Logto）

## 原则

- **认证**：统一由 Logto 处理。前端通过 Logto 登录，中间层在回调中写 Cookie 会话，后续请求凭 Cookie 识别用户。
- **用户信息**：姓名、邮箱、头像等由 Logto 提供（OIDC / 用户资料），中间层在回调或 `/api/auth/me` 中返回给前端。
- **用户偏好**：主题、字体档位、通知开关等**额外信息**存放在 **Logto 自定义数据（customData）** 中，通过 Management API 读写；未登录时前端使用本地 localStorage / color-mode。
- **Matrix**：仅作为会话/聊天后端，用户身份来自 Logto；从 Logto 同步用户到 Matrix 所需配置见下。

## Logto 侧

- 应用配置：`LOGTO_ENDPOINT`、`LOGTO_APP_ID`、`LOGTO_APP_SECRET`（OAuth 回调、换 token）。
- **用户偏好（customData）**：优先用 Logto **Account API**（`/api/my-account`）+ 用户 token 读写；若返回「Account center is not enabled」或 403，则回退到 **Management API**（需配置 M2M）。因此：**若未在控制台启用 Account center**，须配置 `LOGTO_M2M_APP_ID`、`LOGTO_M2M_APP_SECRET`，偏好才能同步；若已启用 Account center 且 scope 含 `custom_data`，则无需 M2M。
- **修改 Logto 密码**：需 **Management API**，须配置独立的 M2M 应用（`LOGTO_M2M_APP_ID`、`LOGTO_M2M_APP_SECRET`）；不配置则「修改密码」功能不可用。
- **customData 结构约定**：仅使用顶层 key `preferences` 存放本应用用户偏好，其它顶层 key 预留给其它用途，本应用不读写。  
  - `preferences`：对象，字段为 `theme`（'light'|'dark'|'system'）、`uiFontSizeStep`（1–5）、`notificationsEnabled`（boolean）。  
  参考：[User data structure - Custom data](https://docs.logto.io/user-management/user-data#custom-data)。Logto 的 PATCH custom-data 会**整体覆盖**，故中间层在更新偏好时先 GET 再仅合并 `preferences` 后 PATCH，不覆盖其它键。**勿在 customData 中存敏感信息**（JWT 为 base64、易被截获）。

## 中间层会话与持久化

- 会话数据（含 Logto token、Frappe sid 等）当前存于**内存**，中间层重启后会话丢失、用户需重新登录。若需重启后保持认证，见 **[SESSION_PERSISTENCE.md](./SESSION_PERSISTENCE.md)**（文件/Redis 等方案与实现要点）。

## 中间层 API

| 能力 | 说明 |
|------|------|
| `GET /api/auth/me` | 返回当前会话 user、userId、type；**Logto 登录时**并配置 M2M 时，附加 `preferences`（来自 Logto customData）。 |
| `PATCH /api/auth/me/preferences` | 需 Logto 登录；body 部分字段 `theme`、`uiFontSizeStep`、`notificationsEnabled`，部分更新 Logto customData。 |
| `PATCH /api/auth/me/profile` | 需 Logto 登录且配置 M2M；body 可选 `email`、`phone`，更新 Logto 用户 primaryEmail/primaryPhone，并同步至 Matrix。 |

## 前端

- 认证状态与基础资料：`useAuth()`（`user`、`userId`、`isAuthenticated`、`fetchUser`）。
- 用户偏好（主题、字体、通知）：`useUserPreferences()`（`theme`、`uiFontSizeStep`、`notificationsEnabled`、`savePreferences`）；登录后从 `GET /api/auth/me` 的 `preferences` 加载，修改后通过 `PATCH /api/auth/me/preferences` 写回 Logto。
- 设置页主题、字体、通知开关已对接上述偏好；未登录时使用本地/默认值。

## Matrix 从 Logto 同步用户：所需配置

Matrix 仅作为聊天/会话后端，**用户身份与资料以 Logto 为准**。Logto 登录成功后，中间层将当前用户同步到 Synapse（创建/更新对应用户）。所需配置均在**中间层**环境变量中：

| 变量 | 说明 |
|------|------|
| `CHAT_PROVIDER` | 设为 `matrix` 时启用 Matrix 适配器及 Logto→Matrix 同步。 |
| `MATRIX_BASE_URL` | Synapse 地址（如 `http://10.1.1.15:8008`）。 |
| `MATRIX_SERVER_NAME` | MXID 域名（如 `10.1.1.15`），与 Synapse `server_name` 一致。 |
| `MATRIX_USER_ID` / `MATRIX_PASSWORD` 或 `MATRIX_ACCESS_TOKEN` | 中间层调用 Synapse 时使用的管理员账号（Admin API 创建/更新用户）。 |

同步逻辑：Logto 回调成功后，中间层调用 `ensureMatrixUser(logtoSub, displayName, email, phone, username)`。**Matrix localpart 优先使用 Logto username**（有则 `@username:server`，无则回退 `@sanitized_logtoSub:server`）。不存在则创建并设随机初始密码（不存、不告知），已存在则仅更新 displayname、threepids（含 email、msisdn）。手机号需在 Logto 授权 scope 中请求 `phone`，且用户在 Logto 中已绑定主手机号（primaryPhone）；中间层会从 /oidc/me 的 phone、primaryPhone、custom_data 等字段提取。**会话用 Matrix token**：用户仅需 Logto 登录；中间层在 `GET /api/auth/me` 或会话 API 首次调用时自动用 Admin API 设随机密码并登录，将 token 写入会话，无需用户再输入 Matrix 密码。详见 [LOGTO_MATRIX_AUTH_FLOW.md](./LOGTO_MATRIX_AUTH_FLOW.md)。

前端如需直连 Matrix（如 matrix-js-sdk、认证页 Matrix 登录）：配置 `NUXT_PUBLIC_MATRIX_BASE_URL`（与 `MATRIX_BASE_URL` 同源即可）。
