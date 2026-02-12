# Matrix 房间创建者问题与改进（基于开源客户端参考）

## 一、问题描述

Synapse Admin 中新建会话（房间）的创建者显示为 `@admin:10.1.1.15` 而非当前登录用户（如 `@chenwensong:10.1.1.15`）。

## 二、开源客户端架构对比

### 2.1 Element / Cinny / FluffyChat（前端直连）

```
浏览器 ──(user access_token)──> Matrix Homeserver
```

- **模式**：浏览器端使用 matrix-js-sdk，`MatrixClient` 以用户 token 初始化
- **创建房间**：`client.createClient({ baseUrl, accessToken: userToken, userId })` → `client.createRoom()` 自动使用该 token
- **关键点**：一个 Client 实例绑定单一用户，所有 API 调用（createRoom、sendMessage 等）均使用该用户的 token，**不存在 admin token 误用**

### 2.2 本项目中层代理架构

```
浏览器 ──(Cookie/session)──> 中间层 ──(session.matrixAccessToken)──> Matrix Homeserver
```

- **模式**：中间层为多用户代理，每次请求从 session 取出当前用户的 `matrixAccessToken`
- **风险**：若 `matrixAccessToken` 为空、错误或混入 admin token，createRoom/sendRoomMessage 会以 admin 身份执行

## 三、根因分析

1. **matrixClient 原逻辑**：`createRoom(name, userToken)` 在 `userToken` 为空时**隐式回退**到 `matrixFetch()`，即使用 `getAccessToken()` 获取的 admin token
2. **session 未写入**：首次登录或 MAS/Admin 流程异常时，`session.matrixAccessToken` 可能为空，导致误用 admin
3. **token 来源混淆**：MAS `createPersonalSession` 与 Admin 设密 + `loginAsUser` 两套流程，需确保返回的均为**用户 token**，而非 admin token

## 四、已实施的改进

### 4.1 matrixClient 禁止回退

- `createRoom`、`sendRoomMessage`：**不再**在 `userToken` 为空时回退到 admin，而是直接抛错
- 保证这两个接口**必须**显式传入用户 token

### 4.2 创建前验证 token 归属

- `createSession`、`streamMessage`（创建房间时）：调用 `verifyMatrixTokenUserId(userToken, currentUserMxid)` 校验
- 若 token 不属于当前用户（如实际为 admin），立即抛错并提示

### 4.3 路由层显式校验

- `POST /api/sessions`：在调用 adapter 前检查 `session.matrixAccessToken` 非空

## 五、进一步建议

### 5.1 参考 Element：前端直连 Matrix 创建房间（可选）

若希望完全对齐 Element 模式，可考虑：

- 前端持有用户 Matrix token（经 `/api/auth/me` 下发）
- 创建房间时由前端直接调用 `matrix-js-sdk` 的 `createRoom`，不经过中间层
- 中间层仅负责：登录、token 签发、消息历史拉取、流式回复等

**优点**：架构与开源客户端一致，token 使用路径清晰  
**缺点**：需调整现有代理模式，前端需接入 matrix-js-sdk 的完整 Client 能力

### 5.2 确保 token 来源单一可追溯

- 在 `ensureMatrixTokenForSession`、`createPersonalSession`、`loginAsUser` 的返回路径打日志，记录 `user_id`（来自 `/account/whoami`）
- 写入 session 前可做一次 `verifyMatrixTokenUserId`，确保绝非 admin

### 5.3 MAS Personal Session 说明

`createPersonalSession(actorUserUlid, humanName)` 的 `actor_user_id` 必须是**对应用户的 MAS ULID**，返回的 `access_token` 为该用户的 Matrix token。若 MAS 实现有误，理论上可能返回错误 token，需结合 MAS 文档与日志核查。

## 六、验证步骤

1. 清除浏览器 Cookie，重新通过 Logto 登录
2. 打开开发者工具 Network，确认 `POST /api/sessions` 请求带 Cookie
3. 新建会话，检查 Synapse Admin 中该房间的创建者
4. 若仍为 admin：在中间层对 `session.matrixAccessToken` 调用 `/account/whoami`，确认返回的 `user_id`
