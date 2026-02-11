# Logto 与 Matrix 认证流程说明

> 用户认证与配置管理统一由 Logto；Matrix 仅作会话后端，从 Logto 同步用户。整体原则与 Matrix 所需配置见 [AUTH_AND_USER_CONFIG.md](./AUTH_AND_USER_CONFIG.md)。

## 会话用 Matrix token（无需用户再输入 Matrix 密码）

- 用户通过 **Logto** 登录后，中间层会在 Synapse 中**自动创建/更新**对应用户（Admin API），并生成随机初始密码（不存、不告知）。
- **本应用内会话**：用户仅需 Logto 登录。中间层在 `GET /api/auth/me` 或会话 API 首次调用时，若无 Matrix token 则自动用 Admin API 为该用户设随机密码并登录，将 `matrixAccessToken` 写入会话；前端不展示任何 Matrix 登录或「设置 Matrix 密码」入口。

## 流程梳理

### 1. Logto 登录 → Matrix 账号同步

1. 用户在前端点击「Logto 登录」，完成 Logto 授权。
2. 中间层在 Logto 回调中换 token、写 Cookie 会话，并（在 `CHAT_PROVIDER=matrix` 时）调用 `ensureMatrixUser(logtoSub, displayName, email)`。
3. 若该 Logto 用户在 Matrix 中**不存在**：用 Admin API 创建用户，并设置**随机初始密码**（不存、不告知）。
4. 若已存在：仅更新 displayname / threepids / external_ids，**不修改密码**。

### 2. 会话用 token 的自动获取

- 当 `GET /api/auth/me` 或会话相关 API（如 `GET /api/sessions`、`POST /api/chat/stream`）被调用且会话有 `logtoSub` 但无 `matrixAccessToken` 时，中间层调用 `ensureMatrixTokenForSession(session)`：用 Admin API 为该用户设**新的随机密码**并调用 Matrix Client-Server 登录，将返回的 `access_token` 写入会话。用户无需在前端进行任何 Matrix 登录或设置密码操作。

### 3. 接口与前端入口

| 能力 | 接口 | 说明 |
|------|------|------|
| 修改 Logto 密码 | `POST /api/auth/logto/change-password` | 需 Logto 登录；body: `{ new_password }`；无需当前密码，使用 Management API。 |
| 设置 Matrix 密码（可选） | `POST /api/auth/matrix/set-password` | 需 Logto 登录；body: `{ new_password }`。若需在 Element 等客户端用同一 Matrix 账号，可调此接口设可知密码；本应用内会话不依赖此项。 |
| Matrix 登录（可选） | `POST /api/auth/matrix/login` | 无需 Logto；body: `{ identifier, password }`。前端已移除该入口；本应用仅用 Logto 登录。 |

前端入口：

- **用户信息**（应用区首标签）：已 Logto 登录时展示「修改 Logto 密码」；**不再展示**「设置 Matrix 密码」或 Matrix 登录。
- **认证登录**：仅 **Logto 登录** 按钮。

## SDK 使用

- **中间层**：使用 `@logto/api` 的 `createManagementApi` 调用 Logto Management API（如修改用户密码）。自建实例需配置 `baseUrl`、`apiIndicator`（见 `middleware/src/services/logtoManagement.ts`）。
- **前端**：使用 `@logto/nuxt` 模块，提供 `useLogtoUser()`、`useLogtoClient()` 等；当前登录流程仍为「/logto → Logto → /logto-callback → 中间层回调写 Cookie」，与模块 pathnames（/sign-in、/callback）分离，避免冲突。若日后改为由模块处理回调，可启用 `POST /api/auth/logto/sync-session` 将 Nuxt 侧 Logto session 同步为中间层 Cookie。
