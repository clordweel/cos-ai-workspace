# 基于当前前端设计的 ERPNext v16 与 Dify 接入功能研究

> 依据现有前端功能与文档（ARCHITECTURE、FRONTEND_SPEC、API_SPEC、STREAM_AND_SAFETY、DIFY_MCP 等），梳理 ERPNext v16（cos App）与 Dify 需要接入的能力及与前端、中间层的对应关系。

---

## 一、当前前端已设计的功能

### 1.1 对话与流式

| 功能 | 实现位置 | 说明 |
|------|----------|------|
| 流式对话 | `useChatStream.ts` → `POST /api/chat/stream` | 消费 SSE，打字机效果 |
| 思考过程 | `thinking` 事件（delta / fullText），`onThinkingDone` 保留完整内容 | 支持 `<think>` 解析（含 HTML 实体等） |
| 状态与事件 | `status`（如 thinking）、`message`（delta）、`dify_event`、`message_end`、`error` | 规范见 API_SPEC、STREAM_AND_SAFETY |
| 会话多轮 | `conversation_id` 传入流式接口；前端 `useChatSessions` 管理 chatId | 需将 Dify 返回的 `conversation_id` 持久化到前端会话 |

### 1.2 任务卡片（UI 已就绪，数据路径待打通）

| 卡片类型 | 组件 | 预期数据来源 | 当前状态 |
|----------|------|--------------|----------|
| 待确认物料 | `MaterialConfirm.vue` | `draft_id`、`item_name`；确认后调 `POST /api/material/confirm` | 仅确认 API 已对接；卡片需由流式/工具结果注入 |
| 订单进度 | `OrderProgress.vue` | `summary` 或结构化 orders 列表 | 仅 UI，无数据绑定 |
| 库存摘要 | `InventorySummary.vue` | `summary` 或 items 列表 | 仅 UI，无数据绑定 |
| BOM 状态 | `BomStatus.vue` | `summary` 或 bom 详情 | 仅 UI，无数据绑定 |

消息结构（`ChatMessage`）当前仅有 `content`、`thinking`、`sources`、`contentChunks`，**没有** `cards` 或 `tool_result` 等结构化附件，因此无法在 `ChatMessageBubble` 内根据类型渲染上述任务卡片。

### 1.3 其他

- 导出 Markdown：`POST /api/chat/export-markdown`，前端已用。
- 应用区：首页 / 联系人 / 机器人 / 设置；侧栏有「物料助手、订单进度、BOM 状态、库存概览」等入口（设计上有，具体入口以 WorkspaceAppNav 为准）。

---

## 二、ERPNext v16（cos App）需接入的功能

以下与 **API_SPEC.md** 一致，按实现优先级排列。

### 2.1 只读接口（优先：支撑 Dify 查询类工具与中间层编排）

| 接口 | 方法路径（建议） | 用途 | 对应前端展示 |
|------|------------------|------|--------------|
| 按参数查物料是否已存在 | `GET /method/cos.api.material.find_by_params` | 生成草稿前查重，避免重复创建 | 对话/卡片中“已存在 xxx”提示 |
| 订单进度 | `GET /method/cos.api.production.order_status` | 查询订单状态、进度、交期 | OrderProgress 任务卡片 |
| 库存状态 | `GET /method/cos.api.inventory.status` | 按物料组/物料/仓库查库存 | InventorySummary 任务卡片 |
| BOM 状态 | `GET /method/cos.api.bom.status` | 按成品/半成品查 BOM | BomStatus 任务卡片 |

**中间层现状**：仅实现 `createFromDraft`（见 `cosClient.js`），**未实现**上述只读接口的代理。若 Dify 通过 MCP/自定义 API 工具直连 cos，则可在 Dify 侧配置工具 URL 为 cos；否则建议在中间层增加对应路由，统一鉴权与 CORS，再由 Dify 工具调中间层。

### 2.2 物料参数化（草稿 → 确认）

| 接口 | 方法路径（建议） | 用途 | 对应前端 |
|------|------------------|------|----------|
| 创建草稿（不落库） | `POST /method/cos.api.material.create_draft` | 根据模数、材质、规格等生成草稿，供用户确认 | 待确认物料卡片（draft_id、item_name） |
| 确认创建（写入） | `POST /method/cos.api.material.create_from_draft` | 用户确认后写入 Item | MaterialConfirm「确认创建」→ 已实现 |

**中间层现状**：仅调用 cos 的 `create_from_draft`；**未实现** `create_draft`。草稿通常由 **Dify 侧工具** 在意图识别后调用（或中间层提供 `/api/material/draft` 再被 Dify 工具调用），返回 `draft_id`、`item_name` 等，再经 SSE `tool_result` 或结构化事件传到前端，用于渲染 MaterialConfirm 并调 `/api/material/confirm`。

### 2.3 安全与权限（与现有规范一致）

- 所有 GET：仅允许具备对应 DocType 读权限的角色。
- `create_draft`：具备「物料草稿」权限的角色。
- `create_from_draft`：建议仅特定角色（如 Item Manager）或经中间层二次校验后再调；cos 内部可校验 `draft_id` 与当前用户/会话。

---

## 三、Dify 需接入的功能

### 3.1 应用类型与 API

- **应用类型**：需为 **Agent 助手**（或带 Agent 节点的 Workflow），才能使用工具/MCP，实现「意图识别 → 调工具 → 流式回复」。
- **API**：当前中间层使用 **Chat API**（`/v1/chat-messages`），`response_mode: 'streaming'`，与前端 SSE 约定一致。
- **API Key**：必须来自上述 Agent 应用的「API 访问」，并配置在中间层（如 `DIFY_API_KEY`），前端不直连 Dify。

### 3.2 工具（供 Agent 调用）

为支撑前端设计的能力，Dify Agent 需要能调用以下能力之一（二选一或组合）：

| 能力 | 实现方式 | 说明 |
|------|----------|------|
| 查物料是否已存在 | MCP 工具 或 自定义 API 工具 | 调用 cos `find_by_params`（经中间层或直连 cos） |
| 订单进度 | 同上 | 调用 cos `order_status` |
| 库存状态 | 同上 | 调用 cos `inventory.status` |
| BOM 状态 | 同上 | 调用 cos `bom.status` |
| 创建物料草稿 | 同上 | 调用 cos `create_draft`，返回 draft_id、item_name 等，用于前端「待确认物料」卡片 |

**MCP**：若使用 MCP，需在 Dify 的 Tools → MCP 中配置 MCP Server（如中间层暴露的 MCP 或独立 MCP 服务），在 Agent 节点中勾选对应工具。工具执行结果会随流式响应返回。

**自定义 API 工具**：在 Dify 中配置 HTTP 工具，URL 指向中间层或 cos（建议经中间层统一鉴权），方法/参数与 API_SPEC 对齐。

### 3.3 流式事件与前端约定

| Dify 流式事件 | 中间层转发 | 前端用途 |
|---------------|------------|----------|
| 文本 delta | `message`（delta） | 打字机正文 |
| 思考内容 | 解析后 `thinking`（delta / fullText） | 思考过程展示、onThinkingDone 保留 |
| `agent_thought` / `tool_call` 等 | `dify_event` | 展示「正在调用工具」等状态 |
| 工具结果 | 需约定为 `tool_result` 或结构化 payload | 渲染任务卡片（当前前端未解析，见下节） |
| `message_end` | `message_end`（含 conversation_id、message_id） | 前端应保存 conversation_id 到当前 chatId，供下一轮对话 |

**现状**：中间层已转发 `dify_event`，并解析思考与正文；**未**将工具执行结果以统一 `tool_result` 形式推给前端，前端也未消费 `tool_result` 或把卡片挂到消息上。

### 3.4 知识库（可选）

若希望「根据文档回答」或「引用知识库」，需在 Dify 应用中配置知识库并启用检索，与当前对话流、任务卡片无强依赖，按需接入。

---

## 四、前后端与中间层缺口汇总

### 4.1 前端

- **消息模型**：`ChatMessage` 无 `cards` / `tool_result` 等字段，无法在 `ChatMessageBubble` 中根据类型渲染 OrderProgress、InventorySummary、BomStatus、MaterialConfirm。
- **流式消费**：`useChatStream.ts` 未处理 `tool_result` 事件，未把结构化结果写入当前助手消息的「附件」。
- **conversation_id**：未在收到 `message_end` 时把 `conversation_id` 写回 `useChatSessions`（如 setConversationId(chatId, cid)），多轮对话可能无法正确带上下文。

### 4.2 中间层

- **cos 只读**：未实现对 cos 只读接口的封装/代理（find_by_params、order_status、inventory.status、bom.status）；若 Dify 工具不直连 cos，需在此增加路由并转发。
- **物料草稿**：未实现调用 cos `create_draft` 的接口（如 `POST /api/material/draft`），供 Dify 工具或工作流调用。
- **SSE 工具结果**：未从 Dify 流中解析工具执行结果并以 `tool_result`（或约定结构）推给前端，导致前端无法渲染任务卡片。

### 4.3 Dify 配置

- 使用 **Agent 应用**（或带 Agent 的 Workflow），并绑定上述 **工具**（MCP 或自定义 API）。
- 工具实现与 **API_SPEC** 一致：参数、返回格式需支持前端卡片所需字段（如订单进度返回 orders 列表，草稿返回 draft_id、item_name）。

### 4.4 ERPNext v16 / cos App

- 在 cos 中实现 **API_SPEC.md** 所列全部接口（只读 + create_draft + create_from_draft），并配置权限。
- 若通过中间层访问，需支持中间层携带的认证（如 Bearer Token）。

---

## 五、建议实现顺序

1. **cos**：实现只读接口（find_by_params、order_status、inventory.status、bom.status）及 create_draft、create_from_draft（后者已约定，可先有）。
2. **中间层**：  
   - 增加 cos 只读接口的代理（或 Dify 工具直连 cos 时跳过）；  
   - 增加 `POST /api/material/draft` 调用 cos create_draft；  
   - 在 Dify 流式处理中解析工具结果，以 `tool_result` 事件推送（含类型与 payload）。
3. **Dify**：创建 Agent 应用，配置 MCP 或 API 工具，对应上述 cos/中间层能力；测试流式与工具调用。
4. **前端**：  
   - 在 `ChatMessage` 中增加卡片/附件结构；  
   - 在 `useChatStream` 中处理 `tool_result`，写入当前消息的卡片列表；  
   - 在 `ChatMessageBubble` 中根据卡片类型渲染 TaskCard（OrderProgress、InventorySummary、BomStatus、MaterialConfirm）；  
   - 在 `message_end` 时保存 `conversation_id` 到当前会话。

按此顺序可形成闭环：用户提问 → Dify 识别意图并调工具 → cos 返回数据 → 中间层转发为 `tool_result` → 前端渲染对应任务卡片；物料创建走草稿 → 确认 → create_from_draft，与现有安全规范一致。
