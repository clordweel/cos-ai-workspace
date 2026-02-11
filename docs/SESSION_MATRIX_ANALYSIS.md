# 会话设计 vs Matrix 能力：冲突分析与未实现功能

> 在完成 Logto 认证与用户配置管理的前提下，对**当前会话部分设计**与 **Matrix/Synapse 支持特性**做对比：是否存在冲突或难以实现的部分；以及会话部分**尚未设计但可利用 Matrix 实现**的能力。

---

## 一、当前会话设计的功能特性（简要）

依据 `SESSION_REQUIREMENTS.md`、`SESSION_ADAPTER_MATRIX.md` 与现有实现：

| 能力 | 设计/需求 | 当前实现状态 |
|------|-----------|--------------|
| 会话列表 | GET /api/sessions，NormalizedSession[] | 有；Matrix 适配器用 getJoinedRooms 拉房间列表 |
| 会话历史 | GET /api/sessions/:id/messages，分页 | 有；getRoomMessages 映射为 NormalizedMessage[] |
| 发消息（流式） | POST /api/chat/stream，SSE | 有；用户消息 + Dify 流式回复写入房间 |
| 创建会话 | 可选 POST /api/sessions；或首条消息隐式创建 | 仅隐式：无 roomId 时 streamMessage 内 createRoom |
| 参与模式 | solo / 1:1 / group（拉入 0/1/N 人） | 文档有映射，**未实现**：无 invite、无 memberCount/mode |
| 消息角色 | user / assistant；多用户时 sources.other_user | 模型支持；Matrix 侧目前仅用 sender 判 user/assistant |
| 身份 | Logto 用户 ↔ Matrix 用户（MXID）映射 | Logto→Matrix 同步有（ensureMatrixUser）；**会话 API 未按“当前用户 MXID”操作** |

---

## 二、与 Matrix 的冲突或难以实现的部分

### 2.1 身份模型：单服务账号 vs 每用户 MXID（核心冲突）

**现状：**

- 中间层 Matrix 调用统一使用**一个** Matrix 账号：`config.matrix.userId` + `MATRIX_PASSWORD` 或 `MATRIX_ACCESS_TOKEN`（管理员/服务账号）。
- 所有操作（getJoinedRooms、sendRoomMessage、createRoom、getRoomMessages）都以该账号身份执行。
- 请求里的 `userId` 是 Logto 的 `logtoSub`，仅用于 Dify 的 user_id 等，**未用于 Matrix 身份**。

**后果：**

1. **会话列表**：返回的是**该服务账号**加入的房间，而不是「当前 Logto 用户」加入的房间。若希望每个用户只看到自己的会话，与当前实现冲突。
2. **消息归属**：`listMessages` 中用 `currentUserId = config.matrix.userId || userId` 判断 role。`userId` 是 Logto sub，与 Matrix 的 `sender`（MXID）格式不同，实际只有 `config.matrix.userId` 会匹配，因此只有**服务账号发的消息**会被标为 `user`，其余均为 `assistant`。
3. **发送方**：用户在前端发消息时，在 Matrix 里实际是**服务账号**在发，不是该 Logto 用户对应的 MXID。
4. **1:1/群组**：若要做「拉入参与方」、区分「自己/对方/其他人」，必须能按**当前用户的 MXID** 发消息、拉列表、判角色。仅用单服务账号无法区分「当前用户」与「其他用户」，难以正确实现 1:1/group 与多端一致体验。

**结论：**  
当前「单 Matrix 服务账号」与设计中「会话按 Logto 用户隔离、参与模式与多用户」存在**根本性冲突**。要完全实现 SESSION_REQUIREMENTS 的参与模式与 SESSION_ADAPTER_MATRIX 的映射，需要引入**按当前用户 MXID 操作**的路径（见下文可选方案）。

---

### 2.2 会话列表 updatedAt 与真实“最后活动”

**设计：** NormalizedSession 有 `updatedAt`，用于排序与展示。

**现状：** Matrix 适配器里对所有房间使用 `updatedAt: Date.now()`，注释写明「按 updatedAt 需额外请求，此处简化为当前时间」。因此列表顺序**不是**按房间最后活动时间，而是请求时刻，与设计意图不一致。

**Matrix 能力：** 可通过 `/sync` 或房间 timeline 最后一条事件的 `origin_server_ts` 得到真实最后活动时间，但需要额外请求或维护状态（如每房间取最新事件），与当前“仅 REST、无 sync”的 matrixClient 设计有工作量冲突。

---

### 2.3 创建会话 API 与房间 preset

**设计：** 文档建议 `POST /api/sessions`（body: `title?`），适配器 createSession；SESSION_ADAPTER_MATRIX 提到 `createRoom({ name, preset: 'private_chat' })`。

**现状：**  
- 中间层**没有** `POST /api/sessions` 路由；创建会话仅发生在 `streamMessage` 无 roomId 时在适配器内 `createRoom()`。  
- matrixClient 的 `createRoom(name?)` 已使用 `preset: 'private_chat', visibility: 'private'`，与「私密会话」一致。

**冲突点：** 无直接冲突，只是「显式创建空会话」能力未在 API 层暴露，若产品需要「先建会话再发消息」需补路由并委托适配器 createSession。

---

### 2.4 消息模型：user/assistant 与「其他人」

**设计：** NormalizedMessage 有 `role: 'user' | 'assistant'` 和可选的 `sources: { type: 'other_user' | 'bot' | 'system'; label? }[]`，用于多用户时区分「自己 / 对方 / 其他人」。

**现状：** Matrix 适配器只按 `sender === currentUserId` 设为 `user`，否则 `assistant`；未填 `sources`，且 `currentUserId` 实际仅可能为服务账号 MXID（见 2.1）。因此无法正确表达「另一个真人用户」发送的消息（应为 other_user，而非 assistant）。

**结论：** 在单服务账号下，无法正确区分「当前用户」「其他用户」「机器人」；要支持 1:1/group，必须引入「当前用户 MXID」并在 listMessages 中按 MXID 填 role + sources。

---

### 2.5 流式与 Matrix 原生能力

**设计：** 流式打字机效果由中间层 SSE 提供；Dify 流式结果可写入 Matrix（完整一条或指针）。

**Matrix：** 协议层是事件制，无「流式文本块」原语；流式效果只能由客户端/中间层用多条 `m.room.message` 或一条完整消息实现。当前实现是 Dify 流式结束后**一次性**写一条消息进房间，与设计无冲突，仅需注意「流式过程」在 Matrix 时间线上的呈现方式（例如是否要占位事件或指针）。

---

## 三、可选方案（缓解身份冲突）

若要向「按用户隔离、支持 1:1/group」靠拢，可考虑：

1. **每用户 Matrix Token（推荐方向）**  
   - Logto 登录后，用该用户的 Matrix 密码（或 OIDC 换到的 token）在中间层为其获取 Matrix access token，并缓存在会话或 Redis 中。  
   - 会话相关请求（listSessions、listMessages、streamMessage、createRoom、invite）使用**该用户的 token** 调用 Matrix Client API，这样列表、发送方、角色都按 MXID 正确归属。  
   - 仍用服务账号做 Admin API（ensureMatrixUser、setPassword 等）和可选的后台操作。

2. **应用服务（Application Service）**  
   - 以应用服务身份代用户发消息、建房间、邀请，通过 Synapse 配置的 appservice 权限操作。  
   - 需要维护「虚拟用户」或 user_id 与 MXID 的映射，以及 Synapse 侧配置，复杂度较高。

3. **前端直连 Matrix + 中间层只做 AI/编排**  
   - 前端用 matrix-js-sdk 以当前用户 token 拉列表、历史、发消息；中间层仅负责 Dify 流式、写回 Matrix（可用服务账号发 bot 消息，或通过前端上传）。  
   - 身份与多用户自然正确，但架构与当前「会话全部经中间层」不一致，需明确分工与安全边界。

详细对比「每用户 Matrix Token」与「前端直连 Matrix」见**第五节**。

---

## 四、会话部分缺失的、本可利用 Matrix 实现的功能

以下能力在 Matrix 规范或 Synapse 中已支持，但当前会话设计与实现中**尚未设计或未实现**。

### 4.1 已设计未实现（文档有、代码无）

| 能力 | Matrix 支持 | 说明 |
|------|-------------|------|
| **显式创建会话** | `POST /createRoom` | 已有 createRoom(name?); 缺 `POST /api/sessions` 路由及适配器 createSession 契约。 |
| **拉入参与方（邀请）** | `POST /rooms/{roomId}/invite`、m.room.member invite | 文档 SESSION_ADAPTER_MATRIX 明确映射「拉入某人 → invite」；需 inviteToSession 或等价 API 及 Logto user → MXID 解析。 |
| **会话类型/模式** | 房间成员列表、DM 标记 | memberCount / mode (solo\|1:1\|group) 可由房间成员数推导；需 getRoomMembers 或 sync 中成员状态，并在 NormalizedSession 增加字段。 |

### 4.2 未在设计/实现中、但 Matrix 原生支持

| 能力 | Matrix 机制 | 可带来的体验 |
|------|-------------|--------------|
| **已读回执（read receipts）** | `POST /rooms/{roomId}/receipts`，m.read / m.fully_read | 某条消息「已读」状态、会话未读数；NormalizedMessage 已有 receiptStatus 占位，可对接。 |
| **正在输入（typing）** | `PUT /rooms/{roomId}/typing` | 房间内显示「对方正在输入」；需轮询或长连接，前端展示。 |
| **在线状态（presence）** | `GET /presence/{userId}/status`，可选推送 | 联系人/成员在线/离线/忙碌；需 presence 作用域与策略。 |
| **房间成员列表** | State `m.room.member`，或 `/rooms/{roomId}/members` | 展示成员、用于 invite/leave/kick、推导 solo/1:1/group。 |
| **离开/踢出房间** | `POST /rooms/{roomId}/leave`，m.room.member leave/kick | 用户主动退群、管理员踢人；可扩展适配器与 API。 |
| **消息编辑** | `m.room.message` 含 `m.new_content`（编辑） | 编辑历史消息；NormalizedMessage 有 editedAt，可映射。 |
| **消息反应（reactions）** | `m.annotation`（m.reaction） | 对某条消息点赞/表情；前端模型可扩展，适配器解析 reaction 事件。 |
| **富媒体/文件** | `m.room.message` msgtype 如 m.image、m.file，mxc:// | 图片、文件消息；当前仅 m.text，可扩展 content 与展示。 |
| **实时新消息推送** | `/sync` 或 SSE/WebSocket | 不轮询即可收到新消息、已读、typing；当前仅 REST 拉取，可增加 sync 或事件推送层。 |

### 4.3 与现有设计衔接建议

- **优先可做（与当前架构兼容）：**  
  - 显式 `POST /api/sessions` + createSession；  
  - 邀请成员 API + invite；  
  - 房间成员数 / 成员列表 → NormalizedSession.memberCount、mode。  

- **依赖「当前用户 MXID」后再做：**  
  - 已读回执、typing、presence、正确 role/sources（other_user）。  

- **协议/前端扩展：**  
  - 消息编辑、反应、富媒体：在 NormalizedMessage 与前端 ChatMessage 上扩展字段，适配器解析对应 Matrix 事件类型。  

- **实时性：**  
  - 新消息/已读/typing 的实时性依赖 Matrix `/sync` 或等效推送，与当前「仅 REST」的 matrixClient 是增量扩展（可单独 sync 服务或由前端直连 Matrix 收事件，中间层仍负责 AI 与写回）。

---

## 五、方案对比：每用户 Matrix Token vs 前端直连 Matrix

以下从架构、认证与 Token、安全、AI 消息写入、实时性、前端与运维等维度对比两种「按用户 MXID 操作」的可行路径。

### 5.1 方案简述

| 维度 | 每用户 Matrix Token | 前端直连 Matrix + 中间层只做 AI/编排 |
|------|---------------------|--------------------------------------|
| **核心思路** | 中间层为每个 Logto 用户维护其 Matrix access token，会话相关请求（列表/历史/发消息/建房间/邀请）全部经中间层，用**该用户的 token** 调 Matrix Client API。 | 前端用 matrix-js-sdk 持有一个 Matrix Client，用**当前用户的 token** 直接与 Synapse 通信；中间层只做 Dify 流式、权限与业务编排，不代理会话列表/历史/发消息。 |
| **Token 所在位置** | 中间层（会话存储或 Redis），按 logtoSub 索引。 | 前端（内存/IndexedDB），由前端登录 Matrix 获得或由中间层下发。 |
| **谁调 Matrix API** | 仅中间层（REST）。 | 列表/历史/发消息/typing/已读：前端直连 Synapse；AI 写回：中间层或前端。 |

### 5.2 架构与数据流

| 对比项 | 每用户 Matrix Token | 前端直连 Matrix |
|--------|----------------------|-----------------|
| **会话列表/历史** | 浏览器 → 中间层（带 Cookie）→ 中间层用该用户 token → Synapse → 中间层归一化 → 前端。 | 浏览器 → Synapse（带用户 Matrix token）；可选：前端再调中间层做归一化或直接用 SDK 对象。 |
| **发一条用户消息** | 前端 → POST /api/chat/stream（或 send）→ 中间层用该用户 token → Synapse send message。 | 前端用 SDK 直接 send；若该会话要触发 AI，再发请求到中间层（如 POST /api/chat/stream，传 roomId + 用户消息 id）。 |
| **AI 流式回复** | 前端 → 中间层 SSE；中间层调 Dify，用**该用户 token** 或**服务账号**把最终回复写入 Matrix 房间。 | 前端 → 中间层 SSE；流式结束后由**中间层用服务账号**写一条 bot 消息进房间，或由**前端**根据中间层返回内容调用 SDK 发一条（以用户身份发则不合适，一般用 bot）。 |
| **统一 API 面** | 保持：前端仍只认 GET /api/sessions、GET /api/sessions/:id/messages、POST /api/chat/stream，无感底层是 Matrix。 | 打破：前端同时对接「中间层（AI/编排）」和「Matrix（会话/IM）」，需约定何时走哪条通道。 |

### 5.3 认证与 Token 管理

| 对比项 | 每用户 Matrix Token | 前端直连 Matrix |
|--------|----------------------|-----------------|
| **Matrix 登录时机** | Logto 回调成功后，中间层在为用户建/更新 Matrix 账号后，用**该用户 Matrix 密码**调用 Matrix `/login` 拿 token；若未设密码则需其他方式（如 OIDC 登录 Matrix、或仅 Admin 创建账号不拿 token）。 | 用户打开工作台且要进会话时，前端用**用户输入的 Matrix 密码**或**中间层下发的短期 token** 登录 Matrix；或配置 Synapse OIDC 后前端用 Logto 换 Matrix token（视 Synapse 是否支持）。 |
| **Token 存储** | 中间层会话或 Redis，键为 logtoSub（或 sessionId），值含 access_token、refresh 若 Matrix 支持。过期由中间层刷新或要求用户重新登录 Matrix。 | 前端：matrix-js-sdk 可存内存或持久化（如 IndexedDB）；刷新由 SDK 或前端逻辑处理。 |
| **未设 Matrix 密码** | 新建用户为随机密码且不告知，中间层无法代用户登录拿 token；需用户先「设置 Matrix 密码」或走 OIDC 后才有 token。 | 同上：用户必须能登录 Matrix（密码或 OIDC），否则前端无法直连。 |
| **多设备** | 同一用户多设备共享「中间层会话」，若 token 存在服务端则多设备共用同一 Matrix token（或每设备一 token，看实现）。 | 每设备一个 Matrix Client，天然多设备多 token；Sync 由 Matrix 协议保证多端一致。 |

### 5.4 安全

| 对比项 | 每用户 Matrix Token | 前端直连 Matrix |
|--------|----------------------|-----------------|
| **Matrix 暴露面** | Synapse 仅对中间层服务器开放即可；前端不接触 Matrix，不暴露 Synapse URL/token。 | 前端需能访问 Synapse（同源或 CORS）；Matrix base URL 与 token 会出现在前端（或至少 token 在内存）。需配置 Synapse CORS、考虑 token 被 XSS 挟持风险。 |
| **密钥与敏感配置** | Dify API Key、Matrix 服务账号等仅存中间层；前端无 Matrix 凭证。 | 仅用户自己的 Matrix token 在前端；Dify Key 仍在中间层。若中间层向前端「下发」短期 token，需防泄露与滥用。 |
| **权限与审计** | 所有会话操作经中间层，便于统一鉴权（Cookie/session）、限流、审计日志。 | 会话操作直连 Synapse，中间层不记录每条消息发送；若需审计需在 Synapse 或前端埋点。 |

### 5.5 AI 消息写入 Matrix

| 对比项 | 每用户 Matrix Token | 前端直连 Matrix |
|--------|----------------------|-----------------|
| **谁把「用户消息」写进房间** | 中间层用该用户 token 发 m.room.message，发送方即该用户 MXID，时间线正确。 | 前端已用 SDK 发过，房间内已有该条消息；中间层无需再写用户消息。 |
| **谁把「Dify/助手回复」写进房间** | 中间层在流式结束后，用**该用户 token** 发一条（则显示为「用户自己发的」不合适），或用**服务账号/bot** 发一条（推荐：以 bot 身份发，role=assistant）。若用 bot，需确保该 bot 已加入房间（创建房间时邀请或服务账号自动 join）。 | **选项 A**：中间层用服务账号向该 room 发一条 bot 消息（需中间层能解析 roomId，且 bot 在房间内）。**选项 B**：中间层只把流式结果推给前端，由**前端**用 SDK 以「当前用户」身份发一条——则助手回复会错误地显示为「用户发的」。**选项 C**：前端用 SDK 以**第二个账号（bot）」**发——需该设备上再登录一个 bot 或通过中间层代理「代发 bot 消息」。通常选 A：中间层持有 bot token，流式结束后 POST 到 Synapse 发一条。 |
| **流式过程中的呈现** | 与现有一致：SSE 打字机；结束后中间层写一条完整（或指针）进 Matrix。 | 同上；若写回由中间层完成，体验一致。 |

### 5.6 实时性（sync、typing、已读）

| 对比项 | 每用户 Matrix Token | 前端直连 Matrix |
|--------|----------------------|-----------------|
| **/sync 长轮询或流** | 若在中间层实现 sync，需为每个在线用户维护一个到 Synapse 的长连接或轮询，并按用户 token 区分；实现与运维成本高。 | 前端一个 tab 一个 Matrix Client，SDK 内建 sync；typing、已读、新消息自然实时，无需中间层参与。 |
| **typing / 已读** | 中间层可代用户调 PUT typing、POST receipts，但需前端主动通知中间层「我开始输入/已读某条」，再转成 Matrix 调用；或中间层不实现，由前端直连 Matrix 仅做 typing/已读（则变成混合架构）。 | 前端 SDK 直接调 typing、receipts，协议原生支持，实现简单。 |

### 5.7 前端改动与一致性

| 对比项 | 每用户 Matrix Token | 前端直连 Matrix |
|--------|----------------------|-----------------|
| **API 面** | 前端继续只用 GET /api/sessions、GET /api/sessions/:id/messages、POST /api/chat/stream；适配器与路由在中间层统一，后端可换（如将来换非 Matrix）。 | 前端需引入 matrix-js-sdk，维护 Matrix Client 与登录状态；会话列表/历史来自 Matrix，AI 流式来自中间层；两套数据源要在 UI 层合并（例如同一会话：消息来自 Matrix，AI 状态来自 SSE）。 |
| **未登录 / 仅 Logto 未 Matrix** | 可降级：未拿 Matrix token 时中间层返回 401 或空列表，前端提示「设置 Matrix 密码」或「使用 Matrix 登录」。 | 前端必须能登录 Matrix 才能看到会话；否则只能看到「无会话」或仅 AI 通道。 |
| **Mock/多后端** | 中间层可继续用 mock/dify 等适配器，前端无感。 | 若保留「非 Matrix」模式，前端需分支：Matrix 模式走 SDK，其他模式走现有 API，逻辑更复杂。 |

### 5.8 运维与部署

| 对比项 | 每用户 Matrix Token | 前端直连 Matrix |
|--------|----------------------|-----------------|
| **Synapse 暴露** | 仅对中间层服务器开放；可内网、不对外。 | 浏览器要访问 Synapse，需公网或与前端同源；内网部署时需考虑前端如何到达（例如同机、或反向代理）。 |
| **CORS** | 不需要（前端不直连 Synapse）。 | 必须在 Synapse 或反向代理配置 CORS，允许前端源。 |
| **Token 与会话存储** | 中间层需可靠存储（Redis/DB）和刷新策略；重启或扩容时考虑 token 失效与重登。 | 前端持久化由 SDK/本地完成；服务端无 Matrix token 存储。 |

### 5.9 小结与选型建议

| 维度 | 每用户 Matrix Token | 前端直连 Matrix |
|------|----------------------|-----------------|
| **身份与多用户** | 正确：中间层按用户 token 操作，列表/发送方/role 自然对。 | 正确：前端即用户，多用户与 1:1/group 自然对。 |
| **实现成本** | 中高：中间层要维护每用户 token、刷新、以及「用对 token」的会话路由；需解决「新建用户无密码无法拿 token」的流程。 | 前端改动大：双通道、SDK、登录与状态同步；中间层相对简单（只做 AI + 可选 bot 写回）。 |
| **安全与管控** | 优：Matrix 不暴露给前端，审计与鉴权集中在中间层。 | 需注意：Synapse 与 token 暴露给前端，CORS 与 XSS 防护重要。 |
| **实时性** | 弱：typing/已读/sync 若经中间层实现复杂；可后续用「前端直连仅做 sync/typing/已读」做混合。 | 强：SDK sync 开箱即用。 |
| **统一 API 与多后端** | 优：前端仍只认一套会话 API，后端可换。 | 弱：前端与 Matrix 强绑定，换后端要改前端。 |

**建议：**

- **若优先「统一 API、安全与管控、可换后端」**：选**每用户 Matrix Token**；接受中间层 token 管理与「用户首次需设 Matrix 密码或 OIDC」的流程设计；实时性可先不做或后期用混合（前端直连仅做 sync/typing/已读）。
- **若优先「快速实现多用户与 1:1/group、实时 typing/已读/sync」且可接受前端双通道与 Synapse 暴露**：选**前端直连 Matrix**；中间层专注 Dify 流式 + 服务账号写回 bot 消息，并约定 roomId 的传递方式（如前端创建房间后把 roomId 传给中间层用于写回）。
- **若目标为「最大化发挥 Matrix 能力」**：推荐**前端直连 Matrix**。Matrix 的典型用法是「客户端持 token + 长连接 /sync」，一次 sync 即可拿到新消息、typing、已读、presence、成员变化等；matrix-js-sdk 已实现这些能力。若采用每用户 Token 且全部经中间层，要在中间层为每用户维护与 Synapse 的长连接并转发各类事件，实现与运维成本高，且易落后于协议扩展（如新事件类型）。前端直连则可按协议与 SDK 持续用齐 typing、已读、presence、反应、编辑、富媒体、多端同步等，无需在中间层重复实现。

### 5.10 直连方案的弊端（汇总）

采用「前端直连 Matrix」时，需主动接受或缓解以下弊端：

| 类别 | 弊端 | 说明 |
|------|------|------|
| **安全** | Synapse 与 Token 暴露给前端 | 浏览器必须能访问 Synapse（同源或 CORS）；用户 Matrix token 在前端内存或 IndexedDB，存在 XSS 挟持、泄露风险；需严格 CSP、避免第三方脚本、不把 token 写进 URL/日志。 |
| **安全** | 审计与管控弱 | 发消息、加房、邀请等直连 Synapse，中间层不经过这些请求，无法做统一鉴权、限流、操作审计；若需合规审计，只能依赖 Synapse 日志或前端埋点上报。 |
| **架构** | 统一 API 面被打破 | 前端同时对接「中间层（AI/编排）」和「Matrix（会话/IM）」两套通道；会话列表与历史来自 Matrix，AI 流式来自中间层，同一会话需在 UI 层合并两路数据，逻辑更复杂。 |
| **架构** | 与 Matrix 强绑定 | 若将来要换会话后端（如非 Matrix），前端需大改；Mock/多后端时需分支：Matrix 走 SDK，其他走现有 REST，维护成本高。 |
| **运维** | Synapse 需对前端可达 | 内网部署时，前端要能访问 Synapse（同机、VPN、或反向代理）；公网时需暴露 Synapse 或通过代理，攻击面增大。 |
| **运维** | 必须配置 CORS | Synapse 或前置反向代理必须对前端源开放 CORS；配置错误会导致直连失败，且需随部署环境调整。 |
| **体验与流程** | 依赖用户能登录 Matrix | 用户必须设 Matrix 密码或走 OIDC 才能直连；新建用户若未设密码，无法使用会话功能，需引导「设置 Matrix 密码」或先走 Matrix 登录。 |
| **实现** | 前端改动大 | 需引入 matrix-js-sdk、维护 Client 与登录状态、处理「仅 Logto 未 Matrix」的降级、以及 AI 与 IM 两路状态在界面上的协调（如 roomId 传递、bot 入房时机）。 |

权衡时：若**安全与审计、统一 API、可换后端**是硬约束，直连弊端较难接受，应优先考虑每用户 Token 或混合（直连仅做 sync/typing/已读，其余经中间层）。

### 5.11 混合方案的具体实施

混合方案 = **会话的读写与业务经中间层（每用户 Matrix Token）** + **仅实时类能力由前端直连 Matrix（sync / typing / 已读）**，在保留统一 API 与审计的前提下补足实时性。

#### 5.11.1 职责划分

| 能力 | 走中间层（每用户 Token） | 走前端直连 Matrix |
|------|---------------------------|---------------------|
| 会话列表 | ✅ GET /api/sessions | — |
| 会话历史 | ✅ GET /api/sessions/:id/messages | — |
| 发消息（用户） | ✅ POST /api/chat/stream（或 send） | ❌ 禁止用 SDK 发 |
| 创建会话 / 邀请 | ✅ POST /api/sessions、POST /api/sessions/:id/invite | — |
| AI 流式与写回 | ✅ 中间层调 Dify，写回房间（用户 token 或 bot） | — |
| 新消息 / 房间更新推送 | — | ✅ 前端用 SDK /sync 收 |
| 正在输入（typing） | — | ✅ 前端 SDK PUT /typing |
| 已读回执（receipts） | — | ✅ 前端 SDK POST /receipts |

原则：**写操作与列表/历史一律经中间层**；前端直连**只读** sync 并**仅**发 typing、receipts。

#### 5.11.2 Token 与接口约定

- **中间层**：Logto 回调后（或用户「设置 Matrix 密码」后）用该用户密码调 Matrix `/login`，将 `access_token` 存会话或 Redis（键为 logtoSub），用于上述所有经中间层的 Matrix 调用。
- **给前端的 Token**：前端需要 token 才能建 Matrix Client 做 sync/typing/receipts。两种做法：
  - **做法 A（常见）**：中间层在 `GET /api/auth/me`（或专用 `GET /api/auth/matrix/sync-token`）中返回当前用户的 Matrix `access_token`；前端**仅**用该 token 初始化 matrix-js-sdk，并约定**不**用该 Client 发消息、拉列表、拉历史。优点：实现简单；缺点：token 仍到前端，需防 XSS、CORS。
  - **做法 B（Token 不出服务端）**：中间层为每个在线用户维护到 Synapse 的 sync 长连接（或轮询），将收到的新消息/typing/已读等事件通过 SSE 或 WebSocket 推给对应用户的前端；前端不拿 Matrix token。优点：token 不暴露；缺点：中间层要维护每用户连接与转发逻辑，实现与运维成本高。

下面按 **做法 A** 写具体步骤（做法 B 仅作备选）。

#### 5.11.3 中间层实施要点

1. **每用户 Token 的获取与存储**
   - 在 Logto 回调或「设置 Matrix 密码」成功后，用 `getMatrixUserIdForLogtoSub(logtoSub)` 得到 MXID，用用户当前 Matrix 密码调 `POST /_matrix/client/v3/login`，拿到 `access_token`（及可选 `refresh_token`）。
   - 将 token 写入当前会话或 Redis（键如 `matrix_token:${logtoSub}`，TTL 与 Matrix token 有效期一致）；若支持 refresh，在过期前用 refresh 换新 token 并写回。
   - 未设 Matrix 密码时无法拿到 token，列表/历史/发消息可返回 401 并提示「请先设置 Matrix 密码」；sync 端同样无 token 可返回时不带 `matrixSyncToken`。

2. **会话 API 一律用该用户 Token**
   - `GET /api/sessions`、`GET /api/sessions/:id/messages`、`POST /api/chat/stream`、`POST /api/sessions`（创建）、`POST /api/sessions/:id/invite` 等，从 Cookie/session 解析出 logtoSub，从 Redis/会话取出对应用户的 Matrix token，用该 token 调 Synapse（不再用全局服务账号）。若 token 缺失或过期，返回 401 并引导设置密码或重登。

3. **对前端暴露「仅用于 sync」的 Token（做法 A）**
   - 在 `GET /api/auth/me` 的响应中，当 `CHAT_PROVIDER=matrix` 且当前用户有 Matrix token 时，增加字段如 `matrixSyncToken`（或 `matrix_base_url` + `matrix_sync_token`），供前端仅用于创建 Matrix Client 并启动 sync、发 typing、发 receipts。
   - 可选：单独提供 `GET /api/auth/matrix/sync-token`，返回短期有效的 token 或同一 token，减少在 /me 里长期携带；前端在进入会话区时请求一次并初始化 SDK。

4. **AI 写回**
   - 流式结束后，用当前用户的 token 以该用户身份发助手回复会错误地显示为「用户发的」，故建议用**服务账号/bot** 发一条 `m.room.message`；创建房间时需把 bot 邀请进房，或由中间层在首次写回前 `join` 该 room。

#### 5.11.4 前端实施要点

1. **保留现有 REST 调用**
   - 会话列表：继续用 `useChatSessionsApi.loadSessions()` → `GET /api/sessions`。
   - 会话历史：继续用 `loadSessionMessages()` → `GET /api/sessions/:id/messages`。
   - 发消息 / 触发 AI：继续用 `POST /api/chat/stream`（带 conversation_id/roomId）。**禁止**用 Matrix SDK 的 `room.sendTextMessage` 等发用户消息。

2. **初始化「仅 sync」的 Matrix Client**
   - 在进入工作台且 `GET /api/auth/me` 返回了 `matrixSyncToken`（及可选 `matrix_base_url`）时，用 matrix-js-sdk 创建 Client、用该 token 登录（`createClient` + `client.startClient()` 或仅 `client.startClient()` 若 SDK 支持仅 token 启动）。
   - 仅用该 Client 做三件事：**sync**（收新消息、房间更新）、**发 typing**（输入时调 `room.sendTyping(true)`）、**发已读**（阅读到某条时调 `client.sendReadReceipt`）。不在该 Client 上调用发送消息、拉房间列表、拉历史等。

3. **同步与合并策略**
   - 以 REST 数据为**权威**：列表与历史以 GET /api/sessions 与 GET /api/sessions/:id/messages 为准。
   - Sync 收到的新事件用于**增量更新**：例如当前房间收到 `m.room.message` 时，在本地消息列表追加一条并更新未读/已读；收到房间列表相关事件时，可刷新列表或仅更新排序/未读数。若与 REST 重复，以 event_id 去重或以服务端为准。
   - 进入某会话时：先 REST 拉历史，再依赖 sync 收该房间后续新消息；避免仅用 sync 历史替代 REST 拉取（保证审计与分页一致）。

4. **未拿到 matrixSyncToken 时**
   - 不创建 Matrix Client；列表/历史/发消息仍走 REST（中间层有 token 即可）。仅无实时推送、无 typing/已读，可降级为「轮询刷新」或不做。

#### 5.11.5 运维与安全

- **Synapse**：需对**前端**开放（用于 sync、typing、receipts），即 CORS 与网络可达要求与「全直连」相同；或通过同一域名反向代理，减少直接暴露 Synapse。
- **Token 在前端**：做法 A 下前端仍持有一份 Matrix token，XSS 可窃取；需严格 CSP、避免第三方脚本、不把 token 写进 URL/日志。若合规要求 token 不出服务端，采用做法 B（中间层 sync 并推送）。
- **审计**：发消息、加房、邀请、列表、历史均经中间层，可照常记录；仅 sync/typing/receipts 直连 Synapse，若需审计可依赖 Synapse 服务端日志或前端仅上报「已读到某条」等轻量事件。

#### 5.11.6 实施顺序建议

1. 先实现**每用户 Token** 路径：中间层拿 token、存 token、会话相关 API 全用该用户 token，前端不改，仅验证列表/历史/发消息归属正确。
2. 再实现**对前端下发 sync 用 token**（/me 或 /api/auth/matrix/sync-token）及前端「仅 sync/typing/receipts」的 Matrix Client；同步与合并策略先做「新消息追加」「已读更新」即可，typing 可选。
3. 最后按需补：已读回执在 UI 的展示、presence、或做法 B（中间层 sync 推送）以彻底避免 token 到前端。

#### 5.11.7 后期接入语音/视频通话时混合方案如何支持

Matrix 的语音/视频基于 **WebRTC**：信令通过房间内事件（`m.call.invite`、`m.call.answer`、`m.call.candidates`、`m.call.hangup` 等）在客户端与 Synapse 之间传递，**音视频流**走 WebRTC（P2P 或经 TURN），不经过 Synapse。matrix-js-sdk 提供 Call 与音视频流能力。

在混合方案下，前端已经持有一个「仅用于 sync/typing/已读」的 Matrix Client 和用户 token；**语音/视频通话可自然扩展为该 Client 的允许用途**，无需把通话信令经中间层转发。

| 能力 | 在混合方案中的归属 | 说明 |
|------|--------------------|------|
| **通话信令**（邀请/接听/候选/挂断） | **前端直连 Matrix** | 信令要求低延迟、多轮交互（offer/answer/candidates），适合由前端用同一 Matrix Client 收发 `m.call.*` 事件；若经中间层转发，延迟与实现复杂度都会上升。 |
| **音视频媒体流** | **WebRTC（P2P / TURN）** | 与 Matrix 信令分离；不经过 Synapse，也不经过中间层。仅需在部署侧配置 TURN（及可选 STUN）以穿透 NAT。 |
| **通话列表/历史** | 可选 | 若需「谁在何时与谁通话」的审计，可由前端在通话开始/结束时通知中间层（如 `POST /api/calls/log`），或由中间层解析房间内 `m.call.*` 事件（需额外拉取）；若无需审计可仅依赖 Matrix 房间时间线。 |

**具体做法：**

1. **扩展前端 Matrix Client 的允许用途**  
   在 5.11.1 的「走前端直连 Matrix」列表中，增加：**通话信令**（发送与接收 `m.call.invite`、`m.call.answer`、`m.call.candidates`、`m.call.hangup` 等）。仍**禁止**用该 Client 发普通聊天消息、拉列表/历史；仅增加与 Call 相关的发送与接收。

2. **前端实现**  
   - 使用 matrix-js-sdk 的 Call/WebRTC 能力（如 `room.createCall()`、处理 `m.call.*` 事件、连接本地/远端媒体流）。  
   - 信令：通过已有 Matrix Client 在**当前房间**内收发 m.call.*，无需新接口。  
   - 媒体：使用浏览器 WebRTC API，配置 STUN/TURN 服务器（可与中间层或运维约定 TURN 地址与凭证，或由中间层提供 `GET /api/webrtc/turn-config` 返回 TURN 信息）。

3. **中间层（可选）**  
   - **审计**：若需记录「谁在何时与谁发起/结束通话」，可提供 `POST /api/calls/start`、`POST /api/calls/end`，前端在通话开始/挂断时带 roomId、对方 userId、方向等上报；中间层只落库或打点，不参与信令。  
   - **TURN 配置**：若 TURN 需凭证或动态配置，可由中间层 `GET /api/webrtc/turn-config` 返回临时 credential 等，前端用其连接 TURN；否则前端直接使用固定 TURN/STUN 地址即可。

4. **部署与网络**  
   - Synapse 不提供 TURN；若需穿透 NAT，需自建或使用第三方 TURN 服务，并在前端或中间层配置中暴露给客户端。  
   - 语音/视频不增加对 Synapse 的「通话流」压力（媒体不走 Synapse），仅信令多几条 m.call.* 事件，与现有 sync 通道一致。

**小结**：混合方案下，语音/视频 = **前端已有 Matrix Client 增加 m.call.* 的收发 + WebRTC 媒体**；中间层不参与信令，可选做审计或 TURN 配置下发。无需为通话单独再开「全直连」或改混合职责划分。

---

## 六、小结

| 维度 | 结论 |
|------|------|
| **冲突/难点** | 身份模型是主要冲突：单 Matrix 服务账号无法实现「按 Logto 用户隔离的会话列表」「正确的 user/other_user 归属」和「1:1/group 参与模式」。其次为会话列表 updatedAt 非真实最后活动、无显式创建会话与邀请 API。 |
| **可缓解** | 引入「每用户 Matrix token」或应用服务/前端直连 Matrix，可使会话身份与多用户能力与设计对齐。**第五节**对「每用户 Matrix Token」与「前端直连 Matrix」做了详细对比与选型建议；**5.11** 给出混合方案（直连仅做 sync/typing/已读）的具体实施步骤。 |
| **未实现但可做** | 显式创建会话、邀请成员、会话模式/成员数、已读回执、typing、presence、成员列表、离开/踢出、消息编辑与反应、富媒体、实时同步等，均可在解决身份与实时通道后逐步接入。 |

建议下一步：在架构上确定「按用户 MXID 操作」的路径（每用户 token 或 appservice/前端直连），再在现有适配器与 API 上补 createSession、invite、memberCount/mode，并视需求增加已读、typing、同步等能力。
