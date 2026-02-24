# 中间层 Matrix 相关代码审查报告

审查日期：2025-02-12。对照 Matrix 规范与 Element/Cinny 等开源客户端最佳实践。

---

## 一、明显错误（需修复）

### 1. msisdn 3PID 格式违反规范 ✅ 已修复

**位置**：`apps/api/src/services/matrixUserSync.ts` 第 119 行

**问题**：Matrix 规范明确要求 msisdn 的 `address` 字段**不得包含前导 `+`**（"MSISDNs do not include a leading '+' character"）。`toE164()` 返回 `+8613800138000` 格式，直接传入会导致 3PID 绑定失败或与规范不一致。

**修复**：传入 Synapse Admin API 的 `threepids` 时，对 msisdn 的 address 去除前导 `+`。

### 2. 消息分页 `beforeId` 与 Matrix `from` 语义不符

**位置**：`apps/api/src/adapters/matrixChat.ts` 或 matrix `listMessages` → `getRoomMessages`

**问题**：Matrix API `/rooms/{roomId}/messages` 的 `from` 参数要求的是**分页 token**（上一页响应的 `end` / `prev_batch`），不是 `event_id`。当前适配器将 `beforeId` 直接映射为 `from`。若前端将来实现「加载更多」并传 `event_id` 作为 `before_id`，会得到错误结果。

**建议**：
- 在 `ListMessagesParams` 或相关文档中注明：Matrix 适配器下 `beforeId` 应为上一页返回的 `nextToken`，不是 event_id。
- 前端 `loadSessionMessages` 若需分页，应使用接口返回的 `nextToken` 作为下次请求的 `before_id`。
- 或引入独立字段 `fromToken`，与 `beforeId`（event_id 语义）区分。

### 3. Admin token 缓存永不过期

**位置**：`apps/api/src/adapters/matrixClient.ts` `cachedToken` / `getAccessToken()`

**问题**：`cachedToken` 一经设置永不清理。若 `MATRIX_ACCESS_TOKEN` 过期，中间层会持续使用无效 token 请求，导致 401，且无自动重试。

**建议**：
- 在收到 401 时清除 `cachedToken` 并尝试重新登录（若为密码登录）。
- 或支持 token 过期时间配置，定期刷新；至少对 401 做一次「清缓存 + 重试」。

---

## 二、不符合开源客户端最佳实践

### 4. 429 限流处理不一致

**位置**：
- `matrixClient.ts`：`loginAsUser` 对 429 有重试，`getAccessToken` 有单次重试；
- `matrixAuth.ts`：`matrixLoginWithIdentifier` 无 429 处理。

**建议**：统一对 429 的处理策略，按 `retry_after_ms` 等待后重试（参考 Element 等客户端的指数退避或至少单次重试）。

### 5. 部分 API 在缺少 userToken 时回退到 admin token

**位置**：`matrixClient.ts` 中的 `getRoomName`、`getRoomMessages`、`sendRoomMessage`、`createRoom`、`inviteToRoom`、`joinRoom` 等

**问题**：当 `userToken` 未传时，这些函数会使用 admin token。在当前适配器实现中，调用方始终传入 userToken 并校验，因此不会出错，但 API 设计上存在误用风险。

**建议**：
- 对必须按用户身份执行的接口，在 `userToken` 为空时直接抛出，禁止回退到 admin token；
- 或明确区分「用户级」与「管理员级」接口，避免隐式切换。

### 6. HTTP 请求无超时

**位置**：所有 `fetch` 调用（matrixClient、matrixUserSync、matrixAuth、masAdminApi）

**问题**：未设置 `AbortSignal` 或超时，网络异常时请求可能长时间挂起。

**建议**：为 Matrix/Synapse 请求增加合理超时（如 15–30 秒），使用 `AbortController`。

### 7. m.id.phone 登录格式可能不当

**位置**：`matrixAuth.ts` `buildLoginIdentifier`

**问题**：MSC829 及部分实现中，`m.id.phone` 的 `phone` 字段通常为**国内号码**（不含国家码）。当前对 `+86 138 1234 5678` 一类输入可能得到 `country: 'CN', phone: '8613812345678'`，部分 Synapse 部署可能不接受带国家码的 phone。

**建议**：参考 Element / matrix-js-sdk 的实现，在检测到 `country` 与 `phone` 中国家码重复时，对 `phone` 做规范化（去除国家码前缀）。

---

## 三、其他建议

### 8. 错误码处理

**建议**：Matrix/Synapse 响应中 `errcode` 比 `error` 更稳定，建议分支逻辑优先使用 `errcode`，`error` 用于日志或用户提示。

### 9. Admin API 用户列表分页

**位置**：`matrixUserSync.ts` 409 处理中遍历 `?from=0&limit=100&deactivated=true`

**问题**：若占用 `external_id` 的用户超过 100 且不在首页，可能无法找到占用者。

**建议**：按 `next_token` 分页遍历，直至找到占用者或遍历结束。

### 10. localpart 字符集

**位置**：`matrixUserSync.ts` `toMatrixLocalpart`

**说明**：当前使用 `[a-zA-Z0-9._=-]`，符合 Matrix 规范中 localpart 的字符集要求。

---

## 四、已正确实现的部分

- Token 与 MXID 校验：`verifyMatrixTokenUserId` 正确区分用户 token 与 admin token。
- 会话操作一律使用用户 token，避免消息/房间归属错误。
- 修改密码流程：先登录取 token，再调 `/account/password`，auth 对象格式正确。
- 房间消息 `dir: 'b'` 与前端 `reverse()` 的配合正确。
- 可选 MAS 路径见 `masAdminApi.ts`。

---

## 五、参考来源

- **开发规范**：提取后的最佳实践见 [MATRIX_CLIENT_BEST_PRACTICES.md](./MATRIX_CLIENT_BEST_PRACTICES.md)
- Matrix Client-Server API：<https://spec.matrix.org/>
- Matrix 3PID 规范：msisdn 无前导 `+`
- Element Web、Cinny、matrix-js-sdk 等开源客户端的登录、分页、错误处理实现
