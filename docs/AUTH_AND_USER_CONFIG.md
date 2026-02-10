# 用户认证与配置管理（统一由 Logto）

## 原则

- **认证**：统一由 Logto 处理。前端通过 Logto 登录，中间层在回调中写 Cookie 会话，后续请求凭 Cookie 识别用户。
- **用户信息**：姓名、邮箱、头像等由 Logto 提供（OIDC / 用户资料），中间层在回调或 `/api/auth/me` 中返回给前端。
- **用户偏好**：主题、字体档位、通知开关等**额外信息**存放在 **Logto 自定义数据（customData）** 中，通过 Management API 读写；未登录时前端使用本地 localStorage / color-mode。
- **Matrix**：仅作为会话/聊天后端，用户身份来自 Logto；从 Logto 同步用户到 Matrix 所需配置见下。

## Logto 侧

- 应用配置：`LOGTO_ENDPOINT`、`LOGTO_APP_ID`、`LOGTO_APP_SECRET`（OAuth 回调、换 token）。
- 修改密码、读写用户 customData：需 **Management API**，即 M2M 应用：`LOGTO_M2M_APP_ID`、`LOGTO_M2M_APP_SECRET`（不填则沿用 APP_ID/APP_SECRET，需该应用具备 Management API 权限）。
- **授权**：在 Logto 控制台「授予用户数据权限」中需包含 **custom_data**，Management API（M2M）才能读写用户 customData；若后续用用户 access token 读 customData，也依赖该权限。当前实现仅用 M2M Management API。
- customData 中当前约定字段：`theme`（'light'|'dark'|'system'）、`uiFontSizeStep`（1–5）、`notificationsEnabled`（boolean）。  
  参考：[User data structure - Custom data](https://docs.logto.io/user-management/user-data#custom-data)。注意 Logto 的 PATCH custom-data 会**整体覆盖**，故中间层在更新偏好时先 GET 再合并后 PATCH，避免覆盖其他键。**勿在 customData 中存敏感信息**（JWT 为 base64、易被截获）。

## 中间层 API

| 能力 | 说明 |
|------|------|
| `GET /api/auth/me` | 返回当前会话 user、userId、type；**Logto 登录时**并配置 M2M 时，附加 `preferences`（来自 Logto customData）。 |
| `PATCH /api/auth/me/preferences` | 需 Logto 登录；body 部分字段 `theme`、`uiFontSizeStep`、`notificationsEnabled`，部分更新 Logto customData。 |

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

同步逻辑：Logto 回调成功后，中间层调用 `ensureMatrixUser(logtoSub, displayName, email)`，不存在则创建并设随机初始密码（不存、不告知），已存在则仅更新 displayname/threepids。用户可通过「设置 Matrix 密码」获得可知密码，详见 [LOGTO_MATRIX_AUTH_FLOW.md](./LOGTO_MATRIX_AUTH_FLOW.md)。

前端如需直连 Matrix（如 matrix-js-sdk、认证页 Matrix 登录）：配置 `NUXT_PUBLIC_MATRIX_BASE_URL`（与 `MATRIX_BASE_URL` 同源即可）。
