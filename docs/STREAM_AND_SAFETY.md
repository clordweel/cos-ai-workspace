# 流式输出与安全规范

## 1. SSE 流式输出（Stream-Oriented）

### 1.1 目标

- 所有 AI 对话必须实现**打字机流式效果**，避免 Raven 式卡顿。
- 前端只消费 SSE，不直接轮询或一次性拉取长文本。

### 1.2 中间层职责

- 接收前端「发送消息」请求，转发至 **Dify Chat API**（stream=true）。
- 将 Dify 的 **SSE 流** 原样或按约定事件名转发给前端（如 `message`、`message_end`、`tool_calls`）。
- 若 Dify 返回工具调用（如查询库存、生成物料草稿），中间层可：
  - 执行工具并注入结果回 Dify，继续流式输出；或
  - 将工具结果以单独 SSE 事件推送给前端，由前端展示为任务卡片。

### 1.3 事件约定（建议）

| 事件名 | 说明 |
|--------|------|
| `message` | 文本片段（delta），前端追加到当前回复 |
| `message_end` | 当前回复结束，可带 `message_id` 等 |
| `tool_call` | 工具调用开始，可带 name、params |
| `tool_result` | 工具结果，前端可展示为卡片 |
| `error` | 错误信息，JSON 体 |

### 1.4 前端

- 使用 `EventSource` 或 `fetch + ReadableStream` 消费 SSE。
- 将 `message` 事件内容逐字/逐块追加到 UI，实现打字机效果。
- 将 `tool_result` 或结构化数据渲染为**任务卡片**（订单进度、库存、BOM、待确认物料等）。

---

## 2. 安全（Safety）

### 2.1 解耦

- 前端**不直连** ERPNext/Frappe，不持有 ERP 账号密码或 API Secret。
- 所有与 ERP 的交互经 **Node.js 中间层** 或 **Dify 服务端工具**（由 Dify 或中间层调用 cos/ERPNext）。

### 2.2 写入前确认

- **物料创建**：必须经过「草稿 → 用户确认 → 再调用 create_from_draft」。
- 在 Dify 工作流中可设计为：  
  工具「创建物料草稿」→ 返回草稿摘要 → 对话中展示「是否确认创建？」→ 用户确认后由中间层调用写入接口。
- 其他写操作（如订单状态更新、库存调整）同样建议：**AI 建议 → 用户确认 → 权限校验 → 写入**。

### 2.3 权限校验

- 中间层在调用 cos/ERPNext **写入接口**前，必须：
  - 校验当前请求的会话/用户是否有权执行该操作；且
  - 可选：校验 Dify 返回的「确认」标识或二次 Token。
- cos App 内对 `create_from_draft` 等写接口做 **Frappe 权限**（Role/Permission）控制，并可选校验 `draft_id` 与请求用户一致性。

### 2.4 审计

- 建议在 cos 或中间层对「草稿生成」「确认创建」做简单日志（谁、何时、draft_id、item_code），便于追溯与审计。
