# At 机器人助手功能：前后端实现研究

本文梳理「@ 机器人助手」在前后端的实现方式，以及如何与 Dify/流式回复结合。**以下建议已实现**（仅 @ 机器人时请求流式、前端传 bot_ids、Mock/Matrix 使用 bot 信息）。

---

## 一、功能概览

- 用户在输入框中输入 `@` 可弹出**提及候选**（联系人 + 机器人），选择后插入 `@名称 `。
- 仅当消息中 **@ 了机器人** 时，前端才会创建助手占位并请求流式回复；未 @ 机器人时仍会请求 `/api/chat/stream`，但前端不创建 assistant 气泡（见下节注意点）。
- 当前中间层**不解析 @**，也不按「被 @ 的机器人」路由到不同 Dify 应用；Mock 适配器一律回显，Matrix 适配器只写用户消息、不产生助手流。

---

## 二、前端实现

### 2.1 数据来源：联系人 & 机器人列表

| 文件 | 说明 |
|------|------|
| `frontend/composables/useContactsAndBots.ts` | 提供 `contacts`、`bots`（当前为**硬编码**）；类型 `Contact` / `Bot` 含 id、name、description、avatar 等。 |

当前机器人示例：

- `assistant` — AI 助手（通用对话与任务）
- `material` — 物料助手（参数化创建物料）
- `order` — 订单助手（查询订单与进度）

应用区「机器人」标签页、@ 提及候选、以及「是否展示 assistant 工具栏」均依赖该列表。

### 2.2 输入与 @ 提及

| 文件 | 说明 |
|------|------|
| `frontend/components/ChatInputPanel.vue` | 输入 `@` 后解析光标前文本，弹出 **mention 候选列表**（联系人 + 机器人），支持键盘上下键选择；选择后插入 `@名称 `；`parseAtMention`、`insertMention`、`onMentionSelect`。 |
| 同上 | **showAssistantToolbar**：`computed` 当 `modelValue` 包含任意 `@${b.name}` 时为 true，用于控制是否显示与「助手」相关的工具栏。 |

提及候选与输入框为同一套逻辑，联系人显示「联系人」标签，机器人显示「机器人」标签（Bot 图标）。

### 2.3 发送与「是否请求助手回复」

| 文件 | 说明 |
|------|------|
| `frontend/composables/useSpaceChatPane.ts` | **messageContainsBotMention(text)**：`bots.some(b => text.includes(\`@${b.name}\`))`，用于判断消息是否 @ 了机器人。 |
| 同上 | **send()**：先 append 一条 user 消息，再调用 `streamReply(id, text, messageContainsBotMention(text), replyToId)`。 |
| 同上 | **streamReply(id, text, hasBotMention, replyToMessageId)**：无论 hasBotMention 与否都会调用 `streamChat(...)` 请求 SSE；只有 **hasBotMention === true** 时才会在收到流前/流中执行 **ensureAssistantMessage()**，即创建「思考中…」的 assistant 占位并仅更新该条。 |

因此：

- **@ 了机器人**：会创建 assistant 消息，SSE 的 `message`/`thinking` 等通过 `updateLastMessage` 更新这条 assistant。
- **未 @ 机器人**：不会创建 assistant 占位，但 **仍然会发起** `POST /api/chat/stream`；Mock 会照常发 `thinking` + message delta，前端会把 `updateLastMessage` 作用在「当前最后一条」上（即刚发的 user 消息），导致**流式内容被错误地追加到用户消息上**。若仅在使用「@ 机器人才期望回复」的交互下使用，可视为预期；否则建议前端在未 @ 时不请求流式，或后端根据内容不返回助手流。

### 2.4 流式请求参数（与后端约定）

| 文件 | 说明 |
|------|------|
| `frontend/composables/useChatStream.ts` | **streamChat(message, onDelta, options)** 请求 `POST /api/chat/stream`，body 仅：`message`、`conversation_id`、`user_id`、`reply_to_message_id`。 |

前端**未**向中间层传递「被 @ 的机器人 id/name」或「是否 @ 了机器人」等字段；后端若需按机器人路由，只能从 `message` 文本中自行解析 `@机器人名`。

### 2.5 消息展示

| 文件 | 说明 |
|------|------|
| `frontend/components/ChatMessageBubble.vue` | 支持消息来源 `sources` 含 `type: 'bot'`，展示机器人图标与「机器人」标签；引用、思考过程、流式展示等与是否 @ 机器人无直接耦合。 |

---

## 三、中间层实现

### 3.1 流式接口

| 文件 | 说明 |
|------|------|
| `middleware/src/routes/chat.ts` | **POST /api/chat/stream**：从 body 取 `message`、`conversation_id`、`reply_to_message_id`（及可选的 user_id）；调用 `adapter.streamMessage({ sessionId, message, userId, send, flush, replyToMessageId, ... })`。 |
| `middleware/src/adapters/types.ts` | **StreamMessageParams** 仅包含：sessionId、backendSessionId、message、userId、send、flush、replyToMessageId、matrixAccessToken、currentUserMxid；**无 bot_id / bot_name / mention 等字段**。 |

即：中间层与适配器**不接收**「被 @ 的机器人」信息，只收到原始 `message` 文本。

### 3.2 Mock 适配器

| 文件 | 说明 |
|------|------|
| `middleware/src/adapters/mock.ts` | **streamMessage**：不解析 @；先发 `status: thinking`，再 `streamEcho` 一段 `"[Mock] 收到：${message}"`，最后写入内存中的 assistant 消息并发送 `message_end`。即无论是否 @、@ 谁，行为一致。 |

### 3.3 Matrix 适配器

| 文件 | 说明 |
|------|------|
| `middleware/src/adapters/matrix.ts` | **streamMessage**：仅把用户消息通过 `sendRoomMessage` 写入 Matrix 房间，然后 **return**，不发起任何 Dify/流式回复。注释写明：「AI 回复后续接入」；与 `docs/MATRIX_INTEGRATION_STATUS.md` 中「助手回复仅经 SSE 推给前端，不写入 Matrix」一致。 |

因此当前 Matrix 下，@ 机器人后前端会创建助手占位并等待 SSE，但中间层不会推送任何助手流，占位会一直处于「思考中…」或空内容，直到前端超时或占位文案处理。

### 3.4 Dify 相关（未接入当前 At 流程）

- `middleware/src/adapters/dify.ts` 存在，但**未在 `adapters/index.ts` 中注册**；`getChatAdapter()` 仅返回 mock 或 matrix。
- `middleware/src/services/difyStream.ts` 提供 `runStreamWithParams`，可供未来「按应用 id 调用 Dify 流」使用。
- `middleware/src/routes/options.ts` 有 **GET /api/dify-apps**，可返回 Dify 应用列表（id、name），前端若要动态拉取「可 @ 的机器人」列表可考虑复用或扩展。

---

## 四、前后端结合要点小结

| 环节 | 现状 | 说明 |
|------|------|------|
| 前端 @ 输入 | 已实现 | 输入 @ → 候选（联系人+机器人）→ 插入 `@名称 `；数据来自 useContactsAndBots 硬编码。 |
| 前端「是否要助手回复」 | 已实现 | 仅当 `messageContainsBotMention(text)` 为 true 时创建 assistant 占位并更新该条；仍始终请求 /api/chat/stream。 |
| 前端请求 body | 无 bot 信息 | 只传 message、conversation_id、reply_to_message_id、user_id。 |
| 中间层/适配器 | 不解析 @ | StreamMessageParams 无 bot 相关字段；Mock 不区分 @；Matrix 不产生助手流。 |
| Dify 路由 | 未接入 | 无适配器注册；若接入需在中间层或适配器内根据 message/bot 选择 Dify 应用并调用 difyStream。 |

---

## 五、实现建议（结合前后端）

若要完整实现「@ 某机器人 → 该机器人（如对应 Dify 应用）回复」：

### 5.1 前端（可选但推荐）

- **显式传被 @ 的机器人**：在 `streamChat` 的请求 body 中增加字段，例如 `bot_ids: string[]` 或 `bot_names: string[]`，由前端在发送前从 `message` 中解析出的 `@名称` 与 `useContactsAndBots().bots` 匹配得到，避免后端重复解析与名称不一致。
- **未 @ 不请求流式**：当 `!messageContainsBotMention(text)` 时可不调用 `streamChat`，仅追加 user 消息，避免 Mock 流式内容误追到 user 消息上；若希望「无 @ 也有一律回复」，则需在流式回调里区分「是否有 assistant 占位」再决定更新哪条消息。

### 5.2 中间层

- **Body 扩展**：若前端传了 `bot_ids`/`bot_names`，在 chat 路由里解析并传入适配器或编排层。
- **StreamMessageParams 扩展**：在 `types.ts` 中为 `StreamMessageParams` 增加可选字段，如 `botIds?: string[]` 或 `botNames?: string[]`，供适配器/编排选择 Dify 应用或不同策略。
- **解析 @ 机器人（备选）**：若前端暂不传，可在中间层对 `message` 做简单解析（例如匹配 `@(\S+)` 再与配置或 Dify 应用名映射），再路由到对应 Dify app。

### 5.3 适配器 / Dify 编排

- **Mock**：可按 `botIds`/解析结果返回不同占位或不同 echo 文案，便于联调。
- **Matrix**：保持「用户消息写 Matrix；助手回复仅 SSE」；在 `streamMessage` 内根据 message 或传入的 bot 信息调用 `difyStream.runStreamWithParams`（或封装），向当前请求的 `send`/`flush` 推送 thinking、message delta 等，实现与现有前端的 SSE 约定一致。
- **Dify 适配器**：若重新启用并注册，可在一层内完成「按 bot 选应用 → 调 difyStream → 转发 SSE」；或由 chat 路由统一做「选应用 + 调 difyStream」，适配器只负责会话/历史（若需要）。

### 5.4 机器人列表与配置

- 若希望「可 @ 的机器人」与 Dify 应用一致，可复用/扩展 **GET /api/dify-apps**，前端用其替代或补全 `useContactsAndBots` 中的 `bots`。
- 若存在「机器人 id → Dify 应用 id」映射，建议放在中间层配置（如 env 或配置文件），由中间层在流式请求时查表选择应用。

---

## 六、相关文件索引

| 层级 | 文件 | 职责 |
|------|------|------|
| 前端 | `composables/useContactsAndBots.ts` | 联系人/机器人列表（当前硬编码） |
| 前端 | `components/ChatInputPanel.vue` | @ 输入、提及候选、showAssistantToolbar |
| 前端 | `composables/useSpaceChatPane.ts` | send、streamReply、messageContainsBotMention |
| 前端 | `composables/useChatStream.ts` | streamChat、POST /api/chat/stream 参数 |
| 前端 | `components/ChatMessageBubble.vue` | 消息气泡、bot 来源展示 |
| 中间层 | `routes/chat.ts` | POST /api/chat/stream、调用 adapter.streamMessage |
| 中间层 | `adapters/types.ts` | StreamMessageParams、ChatBackendAdapter |
| 中间层 | `adapters/mock.ts` | Mock 流式回复（不解析 @） |
| 中间层 | `adapters/matrix.ts` | Matrix 发用户消息，不产生助手流 |
| 中间层 | `services/difyStream.ts` | Dify 流式调用（可供编排使用） |
| 中间层 | `routes/options.ts` | GET /api/dify-apps |
| 文档 | `docs/MATRIX_INTEGRATION_STATUS.md` | Matrix 设计约束（助手仅 SSE） |

以上为 At 机器人助手功能在当前前后端中的实现情况与扩展建议。
