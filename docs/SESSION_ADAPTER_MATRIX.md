# 会话适配器选型：Matrix 优先

> 在**会话核心流程与参与模式**（见 SESSION_REQUIREMENTS.md 第二节）与**适配器体系**（会话 / 认证 / 应用数据 / 三方服务）的前提下，将会话服务适配器的优先方向确定为 **Matrix**。本文描述该选型的依据、会话模型与 Matrix 的映射关系，以及 Matrix 会话适配器的契约与实现要点。

---

## 一、选型结论

- **会话服务适配器**优先采用 **Matrix** 作为后端协议/服务实现。
- 会话核心流程（创建者随意建会话、可不引入交谈方、拉入 1 人→1:1、拉入多人→群组）与 Matrix 的 **Room + 成员邀请** 模型天然对齐：房间可由创建者单独使用，邀请 1 人为 DM，邀请多人为群聊。
- 其余适配器（认证、应用数据、三方服务）与会话适配器并列，不替代本选型；认证适配器负责身份，应用数据适配器负责 Frappe/ERPNext 等，三方服务适配器负责 Dify 等，会话存储与投递由 Matrix 会话适配器统一承接。

---

## 二、会话核心流程在 Matrix 上的映射

以下与 SESSION_REQUIREMENTS.md 第二节一致，并直接对应到 Matrix 概念。

| 业务概念 | Matrix 映射 | 说明 |
|----------|-------------|------|
| **会话** | **Room** | 一个会话 = 一个 Matrix 房间（room_id）；创建会话 = 创建房间（createRoom）。 |
| **仅自己（solo）** | 房间内仅创建者一名成员 | 不邀请任何人；创建者可在房间内发消息、仅自己可见，相当于「用户只跟自己对话」。 |
| **一对一（1:1）** | 房间内 2 人 | 创建者邀请 1 人（invite）；两人互为成员，消息对彼此可见。Matrix 可对 1:1 房间做 DM 标记（可选）。 |
| **群组（group）** | 房间内 3 人及以上 | 创建者邀请 2 人及以上；所有人共享同一时间线，符合一对多群组模式。 |
| **拉入某人** | `invite` 到房间 | 对应「拉入第一个/多个人」的操作；邀请后对方接受即成为成员，参与模式由当前成员数自然得到（1 他人→1:1，2+ 他人→group）。 |
| **消息** | Room 内 Event（如 `m.room.message`） | 每条消息对应 Matrix 事件；发送方、内容、时间等映射到 NormalizedMessage（含 sources 区分自己/对方/系统）。 |

因此，**会话核心流程**可在 Matrix 上完整实现：创建房间（可选标题/名称）→ 可选邀请 0/1/N 人 → 在房间内发送与拉取消息；适配器负责将「创建会话 / 邀请成员 / 发消息 / 拉列表与历史」映射为 Matrix Client API 的 createRoom、invite、sendMessage、sync/rooms/events 等。

---

## 三、Matrix 会话适配器契约要点

适配器需实现现有 **ChatBackendAdapter** 接口（见 `middleware/src/adapters/types.ts`），并将 Matrix 的 Room / Event 映射为 NormalizedSession / NormalizedMessage。在「Matrix 优先」的前提下，建议契约与能力做如下对齐与扩展。

### 3.1 已有契约（必须实现）

- **name**：`'matrix'`（ProviderKind 已包含 matrix）。
- **supportsStreaming()**：Matrix 原生为事件投递，非流式文本块；若需「AI 打字机」效果，由中间层或 Dify 等三方服务流式生成后，通过适配器以**多条消息或单条完整消息**写入房间；可返回 `false`，由中间层对 AI 回复做 SSE 模拟。
- **supportsListSessions()** / **listSessions**：拉取当前用户参与的 rooms，映射为 NormalizedSession 列表（id ← room_id，title ← room name 或首条消息摘要，updatedAt ← 最后活动时间，backendSessionId ← room_id，provider ← `'matrix'`）。
- **supportsListMessages()** / **listMessages**：按 room_id 拉取房间内消息事件（分页），映射为 NormalizedMessage 列表（role/sources 根据 sender 与当前 user 比较得出 user/assistant/other_user）。
- **streamMessage**：若 supportsStreaming() 为 false，可由中间层改为调用 **sendMessage**（见下）；若需支持流式，可在适配器内缓冲 Dify/上游的 delta 后一次性发送一条消息，或按 chunk 发多条（前端按需聚合）。

### 3.2 建议扩展（与核心流程对应）

- **创建会话**：适配器需支持「创建房间」能力。可在现有接口上增加 **createSession**（若 ChatBackendAdapter 已预留可选方法），或由中间层新增 `POST /api/sessions` 调 adapter.createSession；参数含 `title?`、`userId`，返回 NormalizedSession（id/backendSessionId 为新建的 room_id）。Matrix：`createRoom({ name, preset: 'private_chat' })` 等。
- **拉入参与方**：适配器需支持「邀请成员」。可扩展 **inviteToSession(sessionId, userId, inviteeId)** 或由上层 API 直接调 Matrix invite；inviteeId 需映射为 Matrix 用户（如 MXID 或应用内用户 id → MXID 的映射表）。拉入第一人即 1:1，拉入多人即 group，无需额外类型字段，由房间成员数推导。
- **会话类型/模式**：NormalizedSession 可增加可选字段如 `memberCount?: number` 或 `mode?: 'solo' | '1:1' | 'group'`，由适配器在 listSessions/createSession 时根据房间成员数填充，供前端展示「单人 / 单聊 / 群聊」等。

### 3.3 身份与认证

- Matrix 使用 **MXID**（如 `@user:homeserver`）；现有登录用户（如 Frappe/Logto）需通过**认证适配器**解析，再经**用户 id → MXID 映射**（或 Matrix 账号绑定）由会话适配器在 invite、send、list 时使用。认证适配器与会话适配器解耦：认证负责「当前是谁」，会话适配器负责「用该身份在 Matrix 上的操作」。

---

## 四、会话中的 Dify Agent 消息：存储策略

当会话内既有**用户/成员消息**又有 **Dify Agent 回复**时，有两种管理方式；推荐采用**存 Dify 消息指针**，以保留更多发展空间。

### 4.1 策略 A：全部交给 Matrix

- **做法**：Dify 流式结束后，将 agent 的**完整正文**（及可选 thinking 拍平为一段）作为一条普通消息写入 Matrix 房间（如以 bot 身份发 `m.room.message`）。
- **优点**：单一事实源、时间线完全在 Matrix、多端/离线一致、不依赖 Dify 可用性即可展示历史。
- **缺点**：Dify 的**思考过程、工具调用、引用、分块**等富结构要么丢失要么被拍平；无法按 Dify 维度做「同一会话内换应用/换模型」或复用 Dify 的 conversation 历史；后续若要做「在 Dify 侧编辑/回放/审计」需再同步回 Matrix，耦合重。

### 4.2 策略 B：存 Dify 消息指针（推荐）

- **做法**：Agent 回复**不**把完整内容写入 Matrix，而是在 Matrix 房间内写入一条**引用型消息**，其内容为**结构化数据**，描述「这条消息来自 Dify」，并携带**指针**，用于在展示或详情时向 Dify（或中间层代理）拉取完整内容。
- **指针建议字段**（示例，可落库或放在 Matrix 的 message body / 自定义 event type 中）：
  - `provider: 'dify'`
  - `conversation_id`：Dify 会话 id
  - `message_id`：Dify 消息 id
  - `app_id` 或 `api_base`（可选）：同一会话内多 Dify 应用时区分
  - `query` 或 `user_message_id`（可选）：对应哪条用户提问，便于前后关联
- **展示逻辑**：时间线拉取时，对「指针消息」可先显示占位（如「AI 回复」+ 摘要或首句）；前端或中间层按指针请求 Dify API（或中间层 `GET /api/dify/messages/:message_id` 等）拉取**完整内容**（含 thinking、引用、工具调用记录），再渲染。流式进行中仍走现有 SSE，结束后写入的仅是这条指针。
- **优点**：
  - **保留 Dify 全量能力**：思考过程、工具调用、引用、分块均可按 Dify 原生结构展示与扩展。
  - **同一会话内多 Dify 来源**：不同消息可指向不同 conversation_id / app_id，支持「同一房间内混用多应用/多模型」。
  - **发展空间大**：后续可做「在 Dify 侧编辑/再生成」、审计/合规按 Dify 维度查询、回放某次 agent 调用、或把指针扩展为通用「外部消息引用」格式（其他 AI 服务也可用同一套指针结构）。
- **缺点**：展示历史时依赖 Dify（或中间层缓存）可用；需约定指针数据格式与解析契约、以及缓存/降级策略（如 Dify 不可用时仅展示「已生成，内容暂不可用」或最后一次快照）。

### 4.3 数据格式与契约建议（指针方案）

- **统一「外部消息引用」结构**（便于后续扩展非 Dify 的 agent)：  
  - `messageRef: { provider: 'dify' | string; conversationId: string; messageId: string; appId?: string; apiBase?: string; ... }`  
  - 展示端根据 `provider` 决定拉取接口（如 dify → GET Dify messages API 或中间层代理）。
- **NormalizedMessage 扩展**：在现有字段上增加可选字段，例如 `externalRef?: MessageRef`；当 `role === 'assistant'` 且存在 `externalRef` 时，视为「指针消息」，内容可仅存摘要或空，完整内容按 ref 拉取。
- **Matrix 中的落点**：可用 `m.room.message` 的 body 中存上述 JSON，或使用自定义 event type（如 `io.workspace.agent_ref`）专门表示「这是一条指向外部 agent 的引用」，便于过滤与同步。

### 4.4 小结

- **推荐采用「存 Dify 消息指针」**：会话时间线仍由 Matrix 统一承载，但 Dify agent 消息以**指针 + 可选摘要**形式存在，完整内容与富结构留在 Dify 侧按需拉取，有利于保留能力、多应用混用与后续扩展。
- 若短期内只求「历史可读、不依赖 Dify」且不需要思考/引用/多应用，可先用策略 A 作为过渡；中长期更建议落地指针方案与统一 `messageRef` 契约。

---

## 五、实现与运维注意点（与现有文档衔接）

- **SESSION_BACKEND_AND_IM_OPTIONS.md** 已对 Matrix（Synapse/Dendrite）的运维成本、存储（PostgreSQL）、联邦与数据膨胀等做过评估；采用 Matrix 即接受其部署与运维复杂度，建议单实例内网先行，再考虑联邦或桥接。
- **SESSION_MESSAGE_ABSTRACTION_FEASIBILITY.md** 中的标准化模型（NormalizedSession、NormalizedMessage）与适配器接口保持不变；Matrix 适配器作为 `provider: 'matrix'` 的一种实现，将 Room/Event 映射到该模型，并与现有 `GET /api/sessions`、`GET /api/sessions/:id/messages`、`POST /api/chat/stream`（或 send）等 API 对接。
- **流式与 AI**：若 AI 回复来自 Dify 等三方服务，流式输出仍在中间层以 SSE 给前端；采用**存 Dify 消息指针**时，Matrix 仅写入指针（及可选摘要），不写入完整正文；完整内容由 Dify 侧保留，按需拉取。若未来 Matrix 侧有 bot 或应用服务发流式消息，可再扩展适配器或事件订阅。

---

## 六、文档索引

- **会话核心流程与参与模式**：[SESSION_REQUIREMENTS.md](SESSION_REQUIREMENTS.md) 第二节。
- **适配器体系（会话 / 认证 / 应用数据 / 三方）**：[SESSION_REQUIREMENTS.md](SESSION_REQUIREMENTS.md) 第七节。
- **会话后端与 IM 选型（Matrix 对比与运维）**：[SESSION_BACKEND_AND_IM_OPTIONS.md](SESSION_BACKEND_AND_IM_OPTIONS.md)。
- **标准化模型与适配器接口**：[SESSION_MESSAGE_ABSTRACTION_FEASIBILITY.md](SESSION_MESSAGE_ABSTRACTION_FEASIBILITY.md)。
- **适配器类型定义**：`middleware/src/adapters/types.ts`。
