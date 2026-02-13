# 会话消息标准化与多后端适配器 — 可行性研究

> 会话部分的功能需求总览见 **SESSION_REQUIREMENTS.md**（已实现/未实现、组织内用户沟通等）。

## 一、目标

- 对项目的**会话与消息**做**标准化封装**，形成与具体后端无关的领域模型与 API 面。
- 将 **Dify、Zulip、Matrix** 等作为**可插拔扩展模块**接入，通过适配器与统一接口交互，**降低对单一服务的耦合**。
- 前端与业务逻辑仅依赖「统一会话/消息 API」，不感知底层是 Dify、Zulip 还是 Matrix。
- **组织内用户沟通**（用户与用户 1:1/群聊）：当前 Dify 方案不支持，需接入 Zulip/Matrix 等多用户 IM 并实现适配器；详见 SESSION_REQUIREMENTS.md 第四节。

---

## 二、标准化领域模型（与后端无关）

### 2.1 核心实体

以下类型为**项目内统一契约**，所有后端适配器负责「外部 API ↔ 本模型」的转换。

```ts
// 会话（列表项 / 详情）
interface NormalizedSession {
  id: string              // 项目内唯一，可由 adapter 生成或映射后端 id
  title: string
  updatedAt: number       // 时间戳 ms
  /** 后端原始会话 id（如 Dify conversation_id、Zulip stream/topic、Matrix room_id） */
  backendSessionId?: string
  /** 来源：用于多后端并存时区分 */
  provider?: 'dify' | 'zulip' | 'matrix'
}

// 单条消息（与现有 ChatMessage 对齐并扩展）
interface NormalizedMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  /** 来源（多机器人/多用户时可填） */
  sources?: { type: 'other_user' | 'bot' | 'system'; label?: string }[]
  /** 接收/送达状态（可选，Zulip/Matrix 可提供已读等） */
  receiptStatus?: 'sending' | 'sent' | 'delivered' | 'read' | 'unread' | 'failed'
  editedAt?: number
  /** 后端原始消息 id */
  backendMessageId?: string
  /** 时间戳 ms */
  createdAt?: number
}
```

现有前端的 `ChatMessage`（含 `contentChunks`、`reactions` 等）可视为 **NormalizedMessage 的 UI 扩展**：适配器只负责填满上述必选与常用字段，前端在展示层再叠加动画、反应等。

### 2.2 统一 API 面（中间层对前端暴露）

| 能力 | 方法 | 说明 |
|------|------|------|
| 发送消息（流式） | `POST /api/chat/stream` | Body: `{ sessionId, message, userId? }`；SSE 事件保持现有约定（message/thinking/message_end 等）。 |
| 发送消息（非流式） | `POST /api/chat/send` | 可选；Zulip/Matrix 等无流式时走此路径，响应为完整消息。 |
| 会话列表 | `GET /api/sessions` | Query: `userId?`；返回 `NormalizedSession[]`。 |
| 会话历史 | `GET /api/sessions/:id/messages` | Query: `limit?, beforeId?`；返回 `NormalizedMessage[]`。 |
| 创建会话 | `POST /api/sessions` | Body: `{ title? }`；返回 `NormalizedSession`。 |

前端现有 `useChatSessions` 可逐步改为：**首次从 `GET /api/sessions` 拉列表**，**进入某会话时从 `GET /api/sessions/:id/messages` 拉历史**；发送仍走 `POST /api/chat/stream`（或按后端能力回退到 `POST /api/chat/send`）。这样前端只依赖「统一 API」，不关心底层是 Dify 还是 Zulip。

---

## 三、后端适配器接口（扩展模块契约）

中间层通过**适配器**与具体后端通信。适配器实现统一接口，由配置或策略选择当前使用的实现。

### 3.1 适配器接口定义（TypeScript 描述，中间层可用 JSDoc 或后续迁 TS）

```ts
interface ChatBackendAdapter {
  /** 适配器标识，与 config 中的 key 一致 */
  readonly name: 'dify' | 'zulip' | 'matrix'

  /** 是否支持流式发送（若否，则中间层用 sendMessage 并模拟或省略流式） */
  supportsStreaming(): boolean

  /** 是否支持拉取会话列表 */
  supportsListSessions(): boolean

  /** 是否支持拉取会话历史消息 */
  supportsListMessages(): boolean

  /** 流式发送：写入 send(event, data) 与 flush()，与现有 SSE 约定一致 */
  streamMessage(params: {
    sessionId: string
    backendSessionId?: string
    message: string
    userId: string
    send: (event: string, data: object) => void
    flush: () => void
  }): Promise<{ backendSessionId?: string; backendMessageId?: string } | void>

  /** 非流式发送（可选）；当 supportsStreaming() 为 false 时由中间层调用 */
  sendMessage?(params: {
    sessionId: string
    backendSessionId?: string
    message: string
    userId: string
  }): Promise<NormalizedMessage & { backendSessionId?: string }>

  /** 会话列表（可选） */
  listSessions?(params: { userId: string }): Promise<NormalizedSession[]>

  /** 会话历史（可选） */
  listMessages?(params: {
    sessionId: string
    backendSessionId?: string
    userId: string
    limit?: number
    beforeId?: string
  }): Promise<NormalizedMessage[]>

  /** 创建会话（可选）；若后端无显式创建，可用首条消息时隐式创建 */
  createSession?(params: { title?: string; userId: string }): Promise<NormalizedSession>
}
```

说明：

- **Dify**：`supportsStreaming() === true`，实现 `streamMessage`，在 `message_end` 中把 `conversation_id` 作为 `backendSessionId` 回传；可增加 `listSessions` / `listMessages` 调用 Dify 的 GET /conversations、GET /messages，并映射为 `NormalizedSession` / `NormalizedMessage`。
- **Zulip**：通常 `supportsStreaming() === false`，实现 `sendMessage`、`listSessions`（流/主题映射为会话）、`listMessages`；若需「打字机」效果，可在中间层对单次响应做分块模拟 SSE。
- **Matrix**：可实现 `sendMessage`、`listSessions`（房间列表）、`listMessages`（房间历史）；流式需看 Matrix Client SDK 是否支持流式输出，否则同样用 `sendMessage` + 中间层模拟。

### 3.2 中间层集成方式

- **配置**：在 `config` 中增加 `chat: { provider: 'dify' | 'zulip' | 'matrix', ... }`，各 provider 下挂该后端所需配置（如 Dify 的 apiKey/apiBase，Zulip 的 site/apiKey，Matrix 的 homeserver/token）。
- **注册表**：`adapters/dify.js`、`adapters/zulip.js`、`adapters/matrix.js` 各自导出实现 `ChatBackendAdapter` 的对象；入口根据 `config.chat.provider` 取用对应适配器。
- **路由**：`routes/chat.js` 中 `POST /api/chat/stream` 不再直接调 `runStream(req, reply, send, flush)`，而是先取 `getAdapter()`，若 `adapter.supportsStreaming()` 则 `adapter.streamMessage(...)`，否则用 `adapter.sendMessage` 并在中间层封装成 SSE 或 201 + 完整消息。
- **会话/历史**：`GET /api/sessions`、`GET /api/sessions/:id/messages` 在适配器支持时委托给 `adapter.listSessions` / `adapter.listMessages`，否则返回 501 或空数组并注明「当前后端不支持」。

这样 **Dify、Zulip、Matrix 仅作为扩展模块**：新增或切换后端只需新增/实现一个适配器并改配置，业务与前端不变。

---

## 四、各后端能力矩阵与适配要点

| 能力 | Dify | Zulip | Matrix |
|------|------|-------|--------|
| **流式发送** | ✅ 原生 SSE | ❌ 需中间层模拟 | ❌ 或有限支持，需中间层模拟 |
| **会话列表** | ✅ GET /conversations | ✅ 流/主题 → 会话映射 | ✅ 房间列表 |
| **会话历史** | ✅ GET /messages | ✅ 按流/主题拉消息 | ✅ 按房间拉历史 |
| **创建会话** | 隐式（首条消息） | 流/主题可预先创建 | 可创建房间 |
| **多轮上下文** | conversation_id | stream + topic | room_id |
| **思考过程** | ✅ thinking 事件 | ❌ 无 | ❌ 无 |
| **已读/回执** | ❌ | ✅ 可扩展 | ✅ 可扩展 |

- **Dify**：与现有实现最接近，适配器主要是把 `runStream` 抽成 `streamMessage`，并可选增加 listSessions/listMessages（调 Dify API），输出统一转为 `NormalizedSession` / `NormalizedMessage`。**可行性高，改动量小。**
- **Zulip**：无原生流式，需在中间层用 `sendMessage` 拿完整回复后，再按块或按句通过 SSE 推给前端以模拟打字机；会话/历史用 Zulip REST API 映射到统一模型。**可行，需接受「模拟流式」或放弃流式。**
- **Matrix**：同上，发送与历史用 Client SDK；若需流式需在中间层模拟。可行，集成与运维成本见 `docs/archive/research/`。

---

## 五、前端改动范围（最小化耦合）

- **useChatSessions**：  
  - 保留现有内存状态与 UI 状态（如 receiptStatus、contentChunks）。  
  - 增加「从 API 拉会话列表 / 拉某会话历史」的调用（`GET /api/sessions`、`GET /api/sessions/:id/messages`），并写入现有 chats / messagesByChatId；若当前后端不支持则降级为「仅本地新建会话、不持久化」。
- **useChatStream**：  
  - 继续消费现有 SSE 事件（message、thinking、message_end）；若中间层对非流式后端做了「模拟 SSE」，前端无需改。  
  - 可选：在 `message_end` 中解析 `backendSessionId` 并写入会话（与当前 `conversation_id` 等价），便于刷新后仍能续聊。
- **页面与组件**：  
  - 无需关心后端类型；仅在使用「会话列表/历史」时调用统一 API，由中间层与适配器负责与 Dify/Zulip/Matrix 的差异。

前端不直接依赖 Dify/Zulip/Matrix 的术语或字段，**耦合仅在于「统一会话/消息模型 + 统一 API」**，扩展新后端时前端可零改动（或仅做可选能力检测，如「是否展示已读」）。

---

## 六、可行性结论

| 维度 | 结论 |
|------|------|
| **标准化模型** | **可行**。现有 `ChatMessage` 与 Dify 的 message/thinking 已接近；补上 `NormalizedSession`、`NormalizedMessage` 与可选字段即可覆盖 Zulip/Matrix。 |
| **适配器接口** | **可行**。流式与非流式、有无会话列表/历史均可通过 `supports*` 与可选方法表达；中间层按能力做降级或模拟。 |
| **Dify 作为扩展模块** | **可行**。将现有 `difyStream.js` 封装为适配器，路由改为经 `getAdapter()` 调用，改动集中、风险小。 |
| **Zulip 作为扩展模块** | **可行**。需实现 `sendMessage` + `listSessions` + `listMessages`，流式用中间层模拟；Zulip 的流/主题与「会话/消息」映射清晰。 |
| **Matrix 作为扩展模块** | **可行**。实现方式类似 Zulip；协议与运维成本独立于本抽象层，适配器仅负责映射与调用。 |
| **多后端并存** | 可在配置中为「当前空间」选一个 provider；若未来需同一前端多 tab 或多空间用不同后端，可扩展为「按空间/会话类型选 adapter」，当前阶段单 provider 即可。 |

**综合结论**：对会话消息做标准化封装，并将 Dify、Zulip、Matrix 作为可插拔扩展模块接入，**在技术与架构上可行**，能明显降低这些服务对项目的耦合；建议优先落地「统一模型 + 适配器接口 + Dify 适配器」，再按需接入 Zulip/Matrix。

---

## 七、建议实施顺序

1. **定义并落地统一模型**  
   - 在中间层（或共享类型包）定义 `NormalizedSession`、`NormalizedMessage`（与 2.1 对齐）。  
   - 前端在保留现有 `ChatMessage` 的前提下，增加从统一 API 反序列化到本地状态的类型（或直接复用 NormalizedMessage 作为 ChatMessage 的基态）。

2. **定义适配器接口并实现 Dify 适配器**  
   - 在 middleware 中新增 `adapters/` 目录，`adapters/dify.js` 实现 `ChatBackendAdapter`，将现有 `runStream` 与（可选）Dify 的 conversations/messages API 封装进去。  
   - `routes/chat.js` 改为通过 `config.chat.provider` 选择适配器，调用 `adapter.streamMessage` 等。

3. **统一 API 路由**  
   - 新增 `GET /api/sessions`、`GET /api/sessions/:id/messages`（及可选的 `POST /api/sessions`），在适配器支持时委托给 adapter，否则返回 501 或空。  
   - 保持 `POST /api/chat/stream` 的请求/响应形态，仅将实现改为适配器驱动。

4. **前端对接统一 API（可选、渐进）**  
   - 在 useChatSessions 或新 composable 中增加「拉会话列表」「拉会话历史」的调用，写入现有状态；当后端不支持时跳过或降级。  
   - 确认 `message_end` 中若有 `backendSessionId` 则写回会话，便于刷新后续聊。

5. **按需接入 Zulip、Matrix 适配器**  
   - 实现 `adapters/zulip.js`、`adapters/matrix.js`，在 config 中增加对应配置项，通过切换 `config.chat.provider` 或按空间选择使用。

上述顺序可在不破坏现有 Dify 流式对话的前提下，逐步完成标准化与多后端扩展，并保持对 Dify、Zulip、Matrix 的低耦合。
