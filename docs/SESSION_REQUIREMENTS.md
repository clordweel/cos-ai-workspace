# 会话部分功能需求梳理

> 会话/聊天相关的能力边界、已实现项、未实现项与扩展方向。与前端 API 需求（FRONTEND_API_REQUIREMENTS）、后端方案（SESSION_BACKEND_AND_IM_OPTIONS、SESSION_MESSAGE_ABSTRACTION_FEASIBILITY）配合使用。

---

## 一、目标与范围

- **会话**：用户在工作台内看到的「会话列表」中的一项，对应一条可收发的消息流。
- **消息**：会话中的单条记录，有发送方（用户 / 助手 / 其他用户）、内容、可选状态（已读、思考过程等）。
- **本需求范围**：会话与消息的**创建、展示、发送、历史拉取、多端/多用户**等能力，不包含认证登录、物料确认、导出 Markdown 等独立接口（见 FRONTEND_API_REQUIREMENTS）。

---

## 二、已实现功能

| 能力 | 说明 | 依赖 |
|------|------|------|
| **当前用户 ↔ AI 对话** | 用户发消息，AI（Dify）流式回复；多轮上下文由 Dify conversation_id 维持 | Dify 适配器、POST /api/chat/stream |
| **会话列表展示** | 左侧展示会话列表；支持从后端拉取（GET /api/sessions）并合并，Dify 会话以 UUID 形式出现 | GET /api/sessions、useChatSessionsApi.loadSessions |
| **会话历史展示** | 进入某会话时拉取历史消息（GET /api/sessions/:id/messages）并展示；Dify 为 query+answer 展平为 user/assistant | GET /api/sessions/:id/messages、useChatSessionsApi.loadSessionMessages |
| **流式打字机效果** | 助手回复按 SSE 增量展示；支持思考过程（thinking）单独展示与保留 | POST /api/chat/stream、useChatStream、difyStream |
| **新会话与多轮** | 新建会话、发送首条消息后获得 conversation_id，后续同会话续聊 | 前端 conversation_id 映射、Dify conversation_id |
| **标准化模型与多后端抽象** | 会话/消息统一为 NormalizedSession、NormalizedMessage；Dify 以适配器接入，可扩展 Zulip/Matrix | adapters、config.chat.provider |
| **导出当前会话为 Markdown** | 将当前会话消息导出为 .md 文件 | POST /api/chat/export-markdown |
| **消息状态（前端）** | 已读/未读、发送中/已发送等在前端状态中维护，用于 UI 展示 | useChatSessions（receiptStatus 等） |

---

## 三、未实现 / 可选能力

| 能力 | 说明 | 可行方向 |
|------|------|----------|
| **会话与消息持久化（前端侧）** | 刷新后列表与历史依赖后端 API 再次拉取；若后端不支持（501）则仅本地内存 | 已通过 Dify 适配器 listSessions/listMessages 支持；其他后端需适配器实现 |
| **认证会话持久化** | 中间层重启后登录态丢失 | Redis/DB 存 auth_session，见 SESSION_BACKEND_AND_IM_OPTIONS |
| **组织内用户与用户沟通** | 用户 A 与用户 B 互相发消息、看到对方消息 | 见下文第四节 |
| **多端同步** | 同一用户多设备会话列表与已读一致 | 需后端支持多端 + 已读同步（如 Zulip/Matrix） |
| **创建会话 API** | 显式「创建会话」再发消息 | 可选 POST /api/sessions，由适配器实现；Dify 为隐式创建 |
| **非流式发送** | 部分后端仅支持一次性返回回复 | POST /api/chat/send + 中间层模拟 SSE 或直接返回 |

---

## 四、组织内用户沟通

### 4.1 含义

- 组织内**用户与用户**之间的 1:1 或群组沟通：用户 A 发送的消息对用户 B 可见，反之亦然；会话参与者为多个「人」或「人+机器人」。
- 与当前「用户 ↔ AI」对话的区别：当前仅「当前用户」与「同一个 AI」对话，没有「另一个用户」作为会话参与方。

### 4.2 当前方案是否支持

- **仅使用 Dify 适配器时：不支持。**  
  Dify 为「人 ↔ AI」对话模型，无「用户 ↔ 用户」会话与投递能力。

- **在现有标准化 + 适配器架构下：可支持。**  
  需接入**支持多用户、多参与方**的 IM 后端（如 Zulip、Matrix、Rocket.Chat），并实现对应适配器：
  - 会话 = 1:1 会话或群/频道；
  - 消息 = 带发送者身份，映射到 NormalizedMessage（含 `sources` 或扩展字段表示「谁发的」）；
  - 身份 = 将现有登录（Frappe/Logto）与 IM 用户关联。

### 4.3 若要实现所需补充

| 项 | 说明 |
|----|------|
| **后端** | 部署并配置多用户 IM 服务（Zulip / Matrix / Rocket.Chat 等）。 |
| **适配器** | 实现该后端的 ChatBackendAdapter：listSessions（含 1:1/群）、listMessages（含发送者）、sendMessage（指定会话与发送者）。 |
| **身份** | 将现有 auth 用户与 IM 用户 id 映射或 SSO。 |
| **前端** | 消息展示区分「自己 / 对方 / 其他人」；可选：会话类型（单聊/群）、未读数、@ 等。模型已预留 `sources.type: 'other_user'`。 |
| **实时性（可选）** | 新消息到达：轮询或 WebSocket/推送，由后端或适配器提供，前端统一成现有会话/消息模型。 |

---

## 五、与 API / 前端的对应关系

| 需求侧 | 中间层 API | 前端 | 备注 |
|--------|------------|------|------|
| 发消息（流式） | POST /api/chat/stream | useChatStream、streamReply | Body: message, conversation_id, user_id |
| 会话列表 | GET /api/sessions?user_id= | useChatSessionsApi.loadSessions | 501 时静默降级 |
| 会话历史 | GET /api/sessions/:id/messages | useChatSessionsApi.loadSessionMessages | 进入会话且无消息时拉取 |
| 导出 Markdown | POST /api/chat/export-markdown | 导出按钮 | Body: messages |
| 会话状态（列表/当前会话/消息列表） | — | useChatSessions | 内存状态；可与 API 拉取结果合并 |

---

## 六、文档索引

- **前端对中间层 API 的总体需求**：`FRONTEND_API_REQUIREMENTS.md`（流式对话、物料确认、导出 Markdown）。
- **会话后端现状与 IM 选型**：`SESSION_BACKEND_AND_IM_OPTIONS.md`（Dify/Zulip/Matrix 等对比、组织内用户沟通结论）。
- **标准化与多后端适配器设计**：`SESSION_MESSAGE_ABSTRACTION_FEASIBILITY.md`（领域模型、适配器接口、能力矩阵、实施顺序）。
- **Dify 适配器验收**：`DIFY_ADAPTER_ACCEPTANCE.md`（验收步骤与通过标准）。
