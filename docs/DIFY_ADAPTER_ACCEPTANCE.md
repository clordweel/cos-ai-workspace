# Dify 适配器验收指南

> **说明**：当前中间层默认使用 **Mock 适配器**（`CHAT_PROVIDER=mock`），未内置 Dify 适配器实现。本文档供**重新接入 Dify 适配器后**按步骤验收使用。

按下列步骤逐项执行，确认「会话消息标准化 + Dify 适配器」实现已正确落地。

---

## 一、前置条件

- 已配置 **Dify**：对话型应用，且能正常对话。
- 本仓库根目录 `.env` 中至少包含：
  - `DIFY_API_BASE`（如 `https://api.dify.ai/v1`）
  - `DIFY_API_KEY`（该应用的 API Key）
  - `CHAT_PROVIDER=dify`（启用 Dify 适配器；默认 mock 为调试用）。

---

## 二、中间层验收

### 2.1 启动中间层

```bash
# 在仓库根目录
pnpm --filter ai-workbench-middleware run dev
```

确认无报错、日志中有 `Middleware listening on http://0.0.0.0:3000`（或你配置的 PORT）。

### 2.2 健康检查

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health
```

**预期**：输出 `200`。

### 2.3 会话列表 API（GET /api/sessions）

```bash
curl -s "http://127.0.0.1:3000/api/sessions?user_id=default"
```

**预期**：

- HTTP 200。
- 响应为 JSON，且包含 `sessions` 数组。
- 每条会话有 `id`、`title`、`updatedAt`、`backendSessionId`、`provider: "dify"`。
- 若 Dify 中尚无任何会话，`sessions` 可为 `[]`。

**若返回 501**：说明当前未使用 Dify 适配器或适配器未实现 listSessions，需检查 `CHAT_PROVIDER` 与 Dify 配置。

### 2.4 会话历史 API（GET /api/sessions/:id/messages）

从 2.3 的响应里任选一个会话的 `id`（或使用你已知的 Dify conversation_id），执行：

```bash
# 将 <CONVERSATION_ID> 替换为实际 id
curl -s "http://127.0.0.1:3000/api/sessions/<CONVERSATION_ID>/messages?user_id=default&limit=20"
```

**预期**：

- HTTP 200。
- 响应为 JSON，包含 `messages` 数组。
- 每条消息有 `role`（`user` 或 `assistant`）、`content`，可有 `backendMessageId`、`createdAt`。
- 若该会话无消息，`messages` 可为 `[]`。

### 2.5 流式发送（POST /api/chat/stream）

```bash
curl -s -X POST "http://127.0.0.1:3000/api/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"message":"你好","user_id":"default"}' \
  --no-buffer
```

**预期**：

- HTTP 200。
- 响应体为 SSE 流：出现 `event: message`、`data: {"delta":"..."}` 等，最后有 `event: message_end`。
- 若 Dify 返回思考过程，会有 `event: thinking`。

**可选**：带 `conversation_id` 续聊（将上面命令中 body 改为 `{"message":"继续","conversation_id":"<上一步返回的 conversation_id>","user_id":"default"}`），确认多轮对话正常。

---

## 三、前端验收

### 3.1 启动前端

```bash
pnpm --filter frontend run dev
```

浏览器打开前端地址（如 http://localhost:3001），进入「工作台/会话」页（如 `/space` 或 `/space/xxx`）。

### 3.2 会话列表来自 Dify

- **预期**：左侧会话列表中，除本地「新会话」外，能看到在 Dify 中已有的会话（标题、时间与 2.3 中一致或接近）。
- **若只看到「当前会话」或本地会话**：检查浏览器控制台是否有 501/502；确认前端请求的 `apiBase` 指向已启动的中间层（如开发代理 `/api` 指向 3000 端口）。

### 3.3 点击历史会话拉取消息

- 点击一个「来自 Dify」的会话（id 通常为 UUID）。
- **预期**：右侧出现该会话的历史消息（用户/助手轮次），与 2.4 中拉取到的内容一致或接近。
- **若一直为空**：确认该会话 id 为 UUID 格式；在 Network 中查看是否有 `GET .../api/sessions/<id>/messages` 且返回 200 和 `messages` 数组。

### 3.4 发送新消息并收到流式回复

- 在当前会话或新会话中输入一条消息并发送。
- **预期**：助手回复以打字机形式流式出现，且无报错。
- **可选**：刷新页面后再次打开同一会话，确认刚发的消息出现在历史中（说明 Dify 侧会话与历史正常，且前端拉取历史逻辑生效）。

### 3.5 新会话与多轮

- 点击「新会话」，发一条消息。
- **预期**：能收到回复；再发第二条消息，应仍在同一会话中多轮对话（conversation_id 由前端在 message_end 后保存并下次带上）。
- 刷新后，在会话列表中应能看到该新会话（来自 3.2 的 loadSessions 再次拉取）。

---

## 四、验收结论

| 项 | 通过标准 |
|----|----------|
| 中间层健康 | GET /health 返回 200 |
| 会话列表 | GET /api/sessions 返回 200 且含标准化 sessions |
| 会话历史 | GET /api/sessions/:id/messages 返回 200 且含 messages |
| 流式发送 | POST /api/chat/stream 返回 SSE 流且含 message / message_end |
| 前端列表 | 会话页左侧能展示 Dify 会话 |
| 前端历史 | 点击 Dify 会话能加载并展示历史消息 |
| 前端发送 | 能发送消息并收到流式回复，多轮正常 |

以上全部通过即可认为 **Dify 适配器方案实现已完成并通过验收**。若某一项不通过，可根据对应小节排查配置、网络或代码逻辑。
