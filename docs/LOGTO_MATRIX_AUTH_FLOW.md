# Logto 与 Matrix 认证流程说明

> 用户认证与配置管理统一由 Logto；Matrix 仅作会话后端，从 Logto 同步用户。整体原则与 Matrix 所需配置见 [AUTH_AND_USER_CONFIG.md](./AUTH_AND_USER_CONFIG.md)。

## 问题：用户如何知晓 Matrix 密码？

- 用户通过 **Logto** 登录后，中间层会在 Synapse 中**自动创建/更新**对应用户（Admin API）。
- 新建用户时，Synapse 要求必填密码，中间层会生成**随机初始密码**且**不存储、不告知用户**，因此用户默认**不知道**自己在 Matrix 里的密码。

## 流程梳理

### 1. Logto 登录 → Matrix 账号同步

1. 用户在前端点击「Logto 登录」，完成 Logto 授权。
2. 中间层在 Logto 回调中换 token、写 Cookie 会话，并（在 `CHAT_PROVIDER=matrix` 时）调用 `ensureMatrixUser(logtoSub, displayName, email)`。
3. 若该 Logto 用户在 Matrix 中**不存在**：用 Admin API 创建用户，并设置**随机初始密码**（不存、不告知）。
4. 若已存在：仅更新 displayname / threepids / external_ids，**不修改密码**。

### 2. 用户如何获得/使用 Matrix 密码？

| 场景 | 做法 |
|------|------|
| **首次使用 / 忘记当前密码** | 已 Logto 登录时，在应用区「用户信息」→ **「设置 Matrix 密码」**。中间层用 **Admin API 直接设置** 该用户的 Matrix 密码（无需当前密码），设置成功后用户即知晓自己设置的密码，可用于 Matrix 登录或后续修改。 |
| **修改 Logto 登录密码** | 「用户信息」→ **「修改 Logto 密码」**，仅填写新密码 + 确认，无需当前密码；中间层用 Logto Management API 直接更新。 |
| **用密码登录 Matrix（含 Element 等）** | 在认证登录页使用 **「Matrix 登录」** 表单（用户名/邮箱/手机号 + 密码），或任意 Matrix 客户端用同一账号与密码登录。 |

### 3. 接口与前端入口

| 能力 | 接口 | 说明 |
|------|------|------|
| 修改 Logto 密码 | `POST /api/auth/logto/change-password` | 需 Logto 登录；body: `{ new_password }`；无需当前密码，使用 Management API。 |
| 设置 Matrix 密码 | `POST /api/auth/matrix/set-password` | 需 Logto 登录；body: `{ new_password }`；中间层用 Admin API 为该用户设密。 |
| Matrix 登录 | `POST /api/auth/matrix/login` | 无需 Logto；body: `{ identifier, password }`（identifier 支持用户名/邮箱/手机号）。 |

前端入口：

- **用户信息**（应用区首标签，侧栏底部头像/用户）：已 Logto 登录时展示「修改 Logto 密码」；配置 Matrix 时另展示「设置 Matrix 密码」。
- **认证登录**：Logto 登录按钮 + Matrix 登录表单（用户名/邮箱/手机号 + 密码）。

## 推荐使用顺序（Logto 用户）

1. 使用 **Logto 登录** 进入工作台。
2. 打开 **用户信息** → 在「设置 Matrix 密码」中**设置并牢记**密码。
3. 之后可用该密码在认证页进行 **Matrix 登录**。修改 Logto 登录密码在「用户信息」→ **修改 Logto 密码**（仅新密码 + 确认，无需当前密码）。

这样既保证 Synapse 新建用户时有合法密码，又让用户通过「设置 Matrix 密码」一步获得可知、可用的密码。

## SDK 使用

- **中间层**：使用 `@logto/api` 的 `createManagementApi` 调用 Logto Management API（如修改用户密码）。自建实例需配置 `baseUrl`、`apiIndicator`（见 `middleware/src/services/logtoManagement.ts`）。
- **前端**：使用 `@logto/nuxt` 模块，提供 `useLogtoUser()`、`useLogtoClient()` 等；当前登录流程仍为「/logto → Logto → /logto-callback → 中间层回调写 Cookie」，与模块 pathnames（/sign-in、/callback）分离，避免冲突。若日后改为由模块处理回调，可启用 `POST /api/auth/logto/sync-session` 将 Nuxt 侧 Logto session 同步为中间层 Cookie。
