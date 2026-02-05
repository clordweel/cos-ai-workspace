# Dify MCP 工具集成说明

## 如何让对话调用 Dify 中设置的 MCP 工具

MCP（Model Context Protocol）工具在 **Dify 平台内** 配置，由 Dify 在推理时自动调用。当前工作台通过同一应用的 API Key 请求 Dify，只要该应用是 **Agent 应用** 且绑定了 MCP 工具，对话即可自动调用这些工具，**无需在中间层或前端写额外逻辑**。

### 1. 在 Dify 中配置 MCP（仅需做一次）

1. 进入工作空间 **Tools → MCP**。
2. 点击 **Add MCP Server (HTTP)**：
   - **Server URL**：MCP 服务地址（如 `https://your-mcp-server/mcp`）。
   - **Name / Icon**：便于识别的名称。
   - **Server ID**：唯一标识（小写、数字、下划线、连字符，最多 24 字符），**一旦被应用使用后不要修改**。
3. 保存后 Dify 会拉取该服务器提供的工具列表，并在应用编排里可用。

### 2. 使用 MCP 工具的应用类型

- **Agent 助手（推荐）**：在「构建」里创建或编辑 **Agent** 应用，在 Agent 节点中勾选需要的 MCP 工具（会按 MCP 服务器分组显示，如 "Notion MCP » Create Page"）。
- **Workflow**：在编排里使用 **Agent 节点**，同样可以选择已接入的 MCP 工具。
- **对话型应用**：若为普通「对话」应用（无 Agent 节点），则不会执行工具；需改为 Agent 或带 Agent 的 Workflow。

### 3. 工作台侧配置

- 在 **.env** 中配置的 `DIFY_API_BASE` 与 `DIFY_API_KEY` 必须来自 **上述已绑定 MCP 工具的 Agent（或 Workflow）应用**。
- 在 Dify 中进入该应用 → **发布** → **API 访问**，创建或复制 API Key，并填入 `DIFY_API_KEY`。
- 当前中间层 `POST /api/chat/stream` 已使用该 Key 调用 Dify，**无需改代码**即可在对话中触发 MCP 工具调用。

### 4. 流程小结

```
用户在前端发消息
  → 中间层 POST /api/chat/stream（带 DIFY_API_KEY）
  → Dify Agent 应用接收请求
  → Dify 在推理过程中按需调用已配置的 MCP 工具
  → 流式返回最终回答（及可选的 agent_thought / tool 等事件）
  → 中间层转发 answer/thinking，前端展示
```

### 5. 可选：在前端展示「正在调用工具」

若 Dify 流式返回中包含 `agent_thought`、`tool_call` 等事件，中间层会将其以 SSE 事件 `dify_event` 转发。前端可监听该事件，展示“正在调用 MCP 工具…”等状态（具体字段以 Dify 实际返回为准）。

### 6. 故障排查

| 现象 | 建议 |
|------|------|
| 对话没有调用工具 | 确认所用 API Key 对应的是 **Agent（或带 Agent 的 Workflow）** 应用，且该应用中已勾选对应 MCP 工具。 |
| 「未配置的服务器」 | 在 Dify Tools → MCP 中检查 MCP 服务器 URL、认证，并尝试「更新工具」。 |
| 导出/迁移后工具不可用 | 在新环境中用 **相同的 Server ID** 添加同一 MCP 服务器，再发布应用。 |

---

参考：[Dify - Using MCP Tools](https://docs.dify.ai/en/use-dify/build/mcp)
