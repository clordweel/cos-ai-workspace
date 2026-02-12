# Matrix Token 调试指南

当出现「token 不属于当前用户」或创建会话失败时，可用以下 curl 命令排查。

## 1. 确认 Admin 配置

```bash
curl -s http://127.0.0.1:3000/api/debug/matrix-admin | jq
```

返回示例：
```json
{
  "configured": true,
  "adminUserId": "@admin:10.1.1.15",
  "hasAccessToken": true,
  "hasUserId": false
}
```

- `adminUserId`：MATRIX_ACCESS_TOKEN 对应的 Matrix 用户（whoami 结果）
- 若 `adminUserId` 与当前登录用户相同，说明当前用户即 Matrix 管理员，token 应被采纳

## 2. 查看当前 Session 的 Matrix 状态

需要带 Cookie（从浏览器开发者工具复制，或登录后从响应头获取）：

```bash
curl -s -b "auth_session=YOUR_SESSION_ID" \
  http://127.0.0.1:3000/api/debug/matrix-session | jq
```

返回示例：
```json
{
  "sessionId": "sess_1770861132899_5j7...",
  "logtoSub": "xxx",
  "username": "chenwensong",
  "expectedMxid": "@chenwensong:10.1.1.15",
  "sessionMatrixUserId": null,
  "hasToken": true,
  "tokenUserId": "@admin:10.1.1.15",
  "adminUserId": "@admin:10.1.1.15",
  "tokenValid": false,
  "isAdminToken": true,
  "diagnosis": "token 为 admin，但当前用户非 admin，需清除并重新获取"
}
```

- `tokenValid: false` 且 `isAdminToken: true`：session 存的是 admin token，需强制刷新
- `diagnosis` 给出建议动作

## 3. 强制刷新 Token

清除 session 中的 matrixAccessToken 并重新调用 ensureMatrixTokenForSession：

```bash
curl -s -X POST -b "auth_session=YOUR_SESSION_ID" \
  http://127.0.0.1:3000/api/debug/matrix-force-refresh | jq
```

返回示例（成功）：
```json
{
  "ensured": "ok",
  "error": null,
  "hasTokenAfterRefresh": true,
  "tokenUserId": "@chenwensong:10.1.1.15",
  "adminUserId": "@admin:10.1.1.15",
  "isAdminToken": false,
  "hint": "刷新成功，建议重试 POST /api/sessions"
}
```

返回示例（仍为 admin）：
```json
{
  "ensured": "failed",
  "hasTokenAfterRefresh": true,
  "tokenUserId": "@admin:10.1.1.15",
  "isAdminToken": true,
  "hint": "刷新后仍为 admin token，请检查 MAS/Synapse 配置或用户是否即 admin"
}
```

## 4. 完整调试流程

1. `GET /api/debug/matrix-admin`：确认 admin user_id
2. 登录后 `GET /api/debug/matrix-session`：查看当前 token 状态
3. 若 `isAdminToken: true` 且 `expectedMxid !== adminUserId`：`POST /api/debug/matrix-force-refresh`
4. 刷新后再次 `GET /api/debug/matrix-session`，确认 `tokenValid: true`
5. 重试 `POST /api/sessions` 创建会话

## 5. Trace 逐步排查（matrix-trace）

需 Cookie，逐步跟踪 MAS/Admin 路径：

```bash
curl -s -b "auth_session=YOUR_SESSION_ID" \
  http://127.0.0.1:3000/api/debug/matrix-trace | jq
```

返回各步骤状态，包括：
- `1.getMasUserByUsername`：MAS 中是否有用户
- `2.ensureMatrixUser`：若 MAS 无用户则创建 Synapse 用户
- `3.getMasUserByUsername_retry`：ensure 后重查 MAS
- `4.createMasUser_fallback`：若 MAS 仍无则补建
- `5.createPersonalSession`：创建 Personal Session，含 `tokenUserId`、`isAdminToken`、`needsFallback`

若 `needsFallback: true` 表示 MAS 返回了 admin token，会回退到「MAS 设密 + login」路径（参考 Element/Cinny）。可调用 `POST /api/debug/matrix-force-refresh` 测试完整流程。

## 6. 获取 Cookie

- 浏览器：F12 → Application → Cookies → 复制 `auth_session` 值
- 或登录后从 `Set-Cookie` 响应头获取
