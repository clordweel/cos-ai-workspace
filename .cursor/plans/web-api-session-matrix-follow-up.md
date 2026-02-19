# 计划：Web/API 会话与 Matrix 后续任务与建议

> 在完成「Element 风格会话功能接入（邀请/接受拒绝/离开/成员/邀请用户/正在输入）」后的建议改进与后续任务，供 Plan Mode 或新会话按计划执行。

---

## 一、已完成（对照验收用）

- **API**：`GET /api/sessions/invited`、`POST /api/sessions/:id/join|leave|invite`、`GET /api/sessions/:id/members`；Matrix/Mock 适配器扩展。
- **Web**：Space 接入 useSessions/useMessages/useChatStream + useMatrixSyncClient；邀请列表与接受/拒绝；typing 指示与 sendTyping；离开会话、成员 Sheet、邀请用户（MXID）；会话列表按 updatedAt 排序。

---

## 二、建议改进（来自 MATRIX_INTEGRATION_STATUS 与最佳实践）

### P1：Matrix Token 过期校验与刷新

- **范围**：`apps/api`（或 middleware）中 `ensureMatrixTokenForSession` / `requireMatrixToken`。
- **内容**：若 `matrixTokenExpiresAt` 存在且 `< Date.now() + BUFFER_MS`，则清空 `matrixAccessToken` 并重新获取；避免过期 token 直用至 401。
- **验收**：过期后请求会话/发消息会先刷新 token 再成功，或明确 401 并引导重登。

### P2：invite 时 inviteeUserId 的 MXID 解析

- **范围**：`apps/api` 的 `inviteToSession` 或路由层；若 middleware 有同类逻辑一并改。
- **内容**：若 `inviteeUserId` 可能为 username 而非 logtoSub，需明确约定或支持解析（如 `getMatrixUserId(inviteeUserId, inviteeUserId)` 或要求前端传完整 MXID 并在文档注明）。
- **验收**：用 username 或 MXID 邀请时均得到正确 MXID 或明确错误提示。

### P3：会话列表 updatedAt 与真实最后活动时间

- **说明**：当前 api 的 Matrix 适配器已用 `getRoomLastActivityTs` 写 `updatedAt`，列表已按真实时间排序；若仍有「所有房间 updatedAt 相同」的遗留实现，改为按每房间最新事件时间。
- **验收**：会话列表顺序与房间最后消息/活动时间一致。

### P4：请求超时与 429 处理（Matrix 最佳实践）

- **范围**：`apps/api` 的 `matrixClient` 或封装层。
- **内容**：为 Matrix 请求加合理超时（如 15–30s，AbortSignal）；对 429 使用 `Retry-After` 或 `retry_after_ms`，做安全上限与重试次数限制。参考 `docs/MATRIX_CLIENT_BEST_PRACTICES.md`。
- **验收**：限流或超时时行为可预期、不无限重试。

---

## 三、后续任务（Cursor 可执行）

### 任务 1：会话列表粘性当前房间（Element 行为）

- **目标**：当前选中的会话在列表中保持位置不随「未读/活动」排序跳动。
- **范围**：`apps/web`，Space 页会话列表排序逻辑（或 useSessions 的展示顺序）。
- **步骤**：在「按 updatedAt 排序」基础上，将当前选中的 sessionId 视为 sticky，固定在其当前索引（或置顶一档），其余房间按 updatedAt 排序；切换选中时更新 sticky。
- **验收**：选中某会话后，列表滚动或收到新消息时该会话不突然跳位。

### 任务 2：已读回执在 UI 的展示

- **目标**：在消息气泡或时间线旁展示「谁已读/未读」（Element 风格）。
- **范围**：`apps/web`：ChatPane / MessageTile；若需服务端聚合，可扩展 `apps/api` 的 messages 或单独 receipt 接口。
- **步骤**：Sync 已收 receipt 事件时，在 useMatrixSyncClient 或 store 中维护「每房间每消息的已读用户」；MessageTile 或 ChatPane 展示小头像/已读状态；可选：发送后对最后一条消息调 `sendReadReceipt`（当前 hook 已支持）。
- **验收**：本端发送的消息可看到对方已读状态；进入会话并滚动到底时发送已读。

### 任务 3：消息回复/引用（回复线）

- **目标**：支持「回复某条消息」并在时间线中展示引用线。
- **范围**：`apps/web`（MessageTile、ChatPane、输入区）+ `apps/api`（stream 已支持 reply_to_message_id）。
- **步骤**：MessageTile 支持 `replyToId` 并渲染引用块；输入区或气泡菜单「回复」写入 replyToMessageId；POST /api/chat/stream 已支持 `reply_to_message_id`，确认 Matrix 适配器写入 `m.in_reply_to`。
- **验收**：回复某条消息后，新消息显示引用与被引用关系。

### 任务 4：消息编辑

- **目标**：支持编辑已发送消息并在时间线显示「已编辑」。
- **范围**：`apps/api`（matrixClient 已有 editRoomMessage）；`apps/web`（MessageTile 编辑入口、编辑态、editedAt 展示）。
- **步骤**：新增 `PATCH /api/sessions/:id/messages/:messageId` 或 `PUT` 编辑接口，调适配器 editRoomMessage；前端消息气泡菜单「编辑」弹窗/行内编辑，提交后乐观更新并显示 editedAt。
- **验收**：编辑后时间线显示新内容及「已编辑」标识；Sync 收到 m.replace 时更新展示。

### 任务 5：联系人/邀请时 MXID 解析（可选）

- **目标**：邀请用户时支持从「联系人」选择，后端将 contact 解析为 MXID。
- **范围**：`apps/api`（invite 路由或适配器：username/logtoSub → MXID）；`apps/web`（SessionMembersSheet 或邀请弹窗：选择联系人而非手输 MXID）。
- **步骤**：约定联系人 id 为 logtoSub 或 username；api 层 getMatrixUserId 或等价解析；前端邀请弹窗下拉/搜索联系人并传 id，由后端解析为 MXID。
- **验收**：从联系人选择即可邀请，无需手输 MXID。

### 任务 6：语音与视频通话（Matrix WebRTC）

- **目标**：在当前会话内支持 1:1 语音/视频通话（Element 风格），信令走 Matrix 房间事件，媒体走 WebRTC。
- **范围**：`apps/web`（ChatHeader 已有语音/视频按钮占位；需接 matrix-js-sdk Call/WebRTC）；可选 `apps/api`（TURN 配置下发、通话审计）。
- **设计要点**（见 `docs/SESSION_MATRIX_ANALYSIS.md` §5.11.7）：
  - **信令**：前端用现有 Matrix Client（sync/typing 同一实例）在**当前房间**内收发 `m.call.invite`、`m.call.answer`、`m.call.candidates`、`m.call.hangup` 等；不经中间层转发。
  - **媒体**：浏览器 WebRTC API，音视频流 P2P 或经 TURN；需配置 STUN/TURN（固定或由 `GET /api/webrtc/turn-config` 下发）。
  - **中间层可选**：`POST /api/calls/start`、`POST /api/calls/end` 做通话审计；`GET /api/webrtc/turn-config` 返回 TURN 凭证。
- **步骤**：1）扩展 useMatrixSyncClient 或单独 useMatrixCall：允许同一 Client 收发 m.call.*，禁止用其发聊天消息；2）前端用 matrix-js-sdk 的 Call/WebRTC 能力（room.createCall、处理 m.call.*、本地/远端媒体流）；3）ChatHeader 语音/视频按钮触发发起或接听 UI；4）部署侧配置或对接 TURN；5）可选 api 提供 turn-config、calls/log。
- **验收**：同房间内可发起/接听/挂断语音或视频通话，音视频正常；与 Element 互通可选验证。

### 任务 7：E2EE 与加密房间（远期）

- **说明**：见 `docs/PROJECT_STATUS.md` 与 `docs/MATRIX_E2EE_PRINCIPLE_AND_PROJECT_STATUS.md`；当前仅未加密。后续可做：创建会话时可选「端到端加密」、列表加密标识等；密钥备份单独见任务 8。
- **范围**：`apps/api`、`apps/web`、matrix-js-sdk initRustCrypto/WASM。
- **验收**：按 E2EE 文档与产品需求单独验收。

### 任务 8：配置密钥备份（Key Backup）

- **目标**：在本项目内支持「创建密钥备份」与「从备份恢复」，使 E2EE 加密房间在换设备/重装后可用恢复密钥或恢复密码拉回 Megolm 密钥并解密历史消息。
- **范围**：`apps/web`（设置/安全相关 UI）；前端 Matrix Client 已持 token，需对接 matrix-js-sdk 的 Key Backup API（创建、上传、恢复）。服务端 Synapse 无需额外配置（见 `docs/MATRIX_KEY_BACKUP.md`）。
- **设计要点**：
  - **创建备份**：设置 → 安全与隐私 → 安全备份 → 启用备份；二选一：恢复密码（Key Passphrase）或恢复密钥（Recovery Key），完成后客户端将加密密钥上传至 Synapse（`room_keys` API）。
  - **从备份恢复**：本设备未持有密钥时（如新设备、重装），提示用户输入恢复密钥或恢复密码，调用 SDK 恢复流程从服务器拉取备份并导入，解密历史时间线。
- **步骤**：1）对接 matrix-js-sdk Key Backup 创建/上传（恢复密码或恢复密钥）；2）设置页或首次进入加密房间时提供「安全备份」入口与创建 UI；3）实现「从备份恢复」流程（输入框 + 调 SDK 恢复）；4）恢复成功后触发 TimelineRefresh 或重拉消息以解密历史。
- **参考**：`docs/MATRIX_KEY_BACKUP.md`、`docs/MATRIX_E2EE_PRINCIPLE_AND_PROJECT_STATUS.md` 第五节。
- **验收**：可在本项目内创建备份（恢复密码或恢复密钥）；新设备/清除数据后输入恢复密钥或密码可恢复并解密历史加密消息。

---

## 四、参考文档

| 主题       | 路径 |
|------------|------|
| Matrix 整合与已知问题 | `docs/MATRIX_INTEGRATION_STATUS.md` |
| Matrix 客户端最佳实践 | `docs/MATRIX_CLIENT_BEST_PRACTICES.md` |
| 会话与 Matrix 能力对比（含混合方案与**语音/视频**§5.11.7） | `docs/SESSION_MATRIX_ANALYSIS.md` |
| 项目状态总览         | `docs/PROJECT_STATUS.md` |
| **密钥备份**（Key Backup 创建/恢复说明） | `docs/MATRIX_KEY_BACKUP.md` |
| E2EE 原理与 Key Backup 恢复说明 | `docs/MATRIX_E2EE_PRINCIPLE_AND_PROJECT_STATUS.md` |

---

## 五、使用方式

- 新会话可引用本计划：「按 `.cursor/plans/web-api-session-matrix-follow-up.md` 实现 P1」或「按该计划执行任务 2（已读回执 UI）」。
- 每完成一项建议或任务，可在本文件底部增加「执行记录」注明日期与结果。
