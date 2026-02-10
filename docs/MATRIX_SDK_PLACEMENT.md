# Matrix JS SDK 放置：Nuxt 与 Middleware 对比

## 当前状态

- **Middleware**：已通过 **纯 HTTP**（`matrixClient.ts`）对接 Matrix Client-Server API，实现登录、房间列表、消息历史、发消息、建房间；**未使用** matrix-js-sdk。
- **前端**：仅调用 `GET /api/sessions`、`GET /api/sessions/:id/messages`、`POST /api/chat/stream`，不直连 Matrix；已新增 `useMatrixClient`（封装 matrix-js-sdk）供可选使用。

---

## 两种整合方式对比

| 维度 | matrix-js-sdk 放在 **Middleware** | matrix-js-sdk 放在 **Nuxt（前端）** |
|------|-----------------------------------|-------------------------------------|
| **身份模型** | 一个后端账号（如 `MATRIX_USER_ID`），所有用户共用一个 Matrix 身份 | 每个用户一个 Matrix 身份（MXID），多端/多设备自然支持 |
| **实时性** | 可在中间层跑 sync 循环，再通过 SSE/WebSocket 推给前端；需自建「Matrix → 中间层 → 前端」链路 | SDK 在浏览器内直接 sync，打字、在线状态、新消息天然实时 |
| **E2EE** | 密钥在服务端，或需复杂代理，难以做真正的端到端加密 | 密钥在浏览器，适合 E2EE |
| **与现有架构** | 完全符合「前端只连中间层」；凭证只在服务端 | 前端直连 Synapse 需 CORS 或由中间层代理 Matrix API；若仅做 token 下发则仍以中间层为唯一后端入口 |
| **运维与资源** | 每用户一个 sync 连接会占满内存/连接数；当前「单 bot 账号」用 HTTP 足够 | 连接在各自浏览器，不占服务端长连接 |
| **会话抽象** | 与现有 ChatBackendAdapter 一致：Room → Session，统一 `/api/sessions`、`/api/chat/stream` | 若要做「统一会话列表」需前端或中间层做 Room ↔ 会话的映射与鉴权 |

---

## 结论与建议

### 当前产品形态（统一会话 + 单 Matrix 账号）

- **会话与消息**由中间层统一提供（GET/POST /api/sessions、/api/chat/stream），Matrix 只是其中一个 `CHAT_PROVIDER`。
- 此时 **不必**在任意一侧引入 matrix-js-sdk：**中间层继续用现有 HTTP 封装即可**，简单、稳定、易维护。
- 若将来需要「新消息实时推送到前端」，可优先在中间层做：**短轮询**或**单 sync 连接 + SSE 广播**，仍不必在前端跑 matrix-js-sdk。

### 若产品演进为「每用户独立 Matrix 身份 + 强实时」

- 需要：每用户自己的 MXID、实时 sync、打字/在线、可选 E2EE。
- 则 **matrix-js-sdk 更适合放在 Nuxt（前端）**：
  - 实时与 E2EE 在浏览器内实现最自然；
  - 中间层负责：Logto 鉴权 +（可选）Matrix 账号绑定 / token 下发，前端用 token 直连 Synapse（或经中间层代理 Matrix API）。
- 此时 **不建议**在中间层为每个用户起一个 matrix-js-sdk 实例：连接与内存成本高，且 E2EE 体验不如在端上。

### 简要对照

| 目标 | 更优方案 |
|------|----------|
| 维持当前「统一会话 API + 单 Matrix 账号」 | **Middleware 仅用 HTTP**，不引入 matrix-js-sdk |
| 每用户独立 Matrix、实时/E2EE 体验 | **Nuxt 用 matrix-js-sdk**；Middleware 做鉴权与可选 token/代理 |

当前仓库的 **SESSION_ADAPTER_MATRIX** 与中间层适配器是按「单账号 + 统一 API」设计的，因此 **整体上更优的是：Matrix 能力继续只在 Middleware 用 HTTP 整合**；前端的 `useMatrixClient` 可保留为**可选能力**，用于未来「直连 Matrix、每用户身份」的场景（例如设置页绑定 Matrix 或单独 Matrix 面板）。
