# 加密房间会话消息无法拉取/展示 — 根因研究（含 Cinny 参考）

> 从 Cinny 与 matrix-js-sdk 行为梳理「加密房间消息不显示」的根因及与本项目的对应关系。最后更新：2026-02-14。

---

## 一、Cinny 中的现象与根因（Issue #742）

### 1.1 现象

- 多端同时使用、且经常在 E2EE 会话中收发消息时：若在 **Sync 尚未完成** 时就在 Cinny 中**点进**该加密房间，会先看到  
  `** Unable to decrypt: The sender's device has not sent us the keys for this message. **`
- **问题**：等密钥随 Sync 到达并解密后，这段「无法解密」的文案**不会自动变成明文**，必须**手动刷新该房间**才能看到解密后的内容。

### 1.2 根因（Cinny 侧）

- 时间线数据在 matrix-js-sdk 内部：密钥到达后，SDK 会对已有加密事件进行解密并**原地更新**同一 `MatrixEvent` 的 content，时间线仍是同一批事件。
- Cinny 的 UI 在「首次渲染时间线」时已经根据当时（仍加密）的状态渲染；**没有订阅「解密完成 / 时间线刷新」类事件**，因此 SDK 内部更新后，视图不会重新拉取或重绘。
- 即：**根因是「解密完成后未触发 UI 的 timeline 刷新」**，而不是拉取不到事件本身。

### 1.3 Cinny 的修复思路（#742 已关闭）

- 需要在密钥到达、事件解密后，让 UI 再次用**当前时间线**重绘。对应到 matrix-js-sdk：
  - **RoomEvent.TimelineRefresh**（`"Room.TimelineRefresh"`）：在时间线需要刷新时触发（例如解密后更新展示），回调为 `(room: Room, eventTimelineSet: EventTimelineSet) => void`。
  - 对**当前展示的房间**监听该事件，收到后从 `room.getLiveTimeline().getEvents()` 重新取事件并更新 UI，即可在解密完成后自动显示明文。

参考：  
- [cinnyapp/cinny#742](https://github.com/cinnyapp/cinny/issues/742) — New mid-sync encrypted messages will not update  
- matrix-js-sdk 中 `RoomEvent.TimelineRefresh` 的用途即「时间线应刷新」（含解密导致的内容变更）。

---

## 二、本项目中的两条路径

### 2.1 REST 拉取历史（加密房间必然无明文）

- 入口：`GET /api/sessions/:id/messages` → 中间层 `getRoomMessages()` → Matrix C-S `GET /_matrix/client/v3/rooms/:roomId/messages`。
- 中间层过滤逻辑（与 Cinny 一致，只做聊天流）：  
  `e.type === 'm.room.message' && e.content?.body != null`（见 `matrixClient.ts`）。
- **加密房间**：服务端下发的多为 `m.room.encrypted`（Megolm），或加密 payload，**没有明文 body**；解密仅在客户端用用户设备密钥完成。因此 REST 返回的 chunk 里**没有可用的明文消息**，过滤后 **events 为空**。
- **结论**：加密房间下「无法拉取展示」的**第一层原因**是 REST 路径本身就拿不到明文，这是 E2EE 设计使然，不是实现错误。

### 2.2 Sync 时间线填充（fillMessagesFromSyncTimeline）

- 前端在「REST 无消息」且 Sync 就绪时，用 **Sync 客户端的房间时间线** 补数：  
  `fillMessagesFromSyncTimeline(roomId)`（`useMatrixSyncClient.ts`）。
- 逻辑：从 `room.getLiveTimeline().getEvents()` 取事件，只保留 `getType() === 'm.room.message'` 且 `content.body != null` 的，再写入 `setMessages(roomId, messages)`。

可能情况：

1. **调用时密钥尚未到达**  
   - 时间线里已有加密事件，但尚未解密，`getContent().body` 为空，被过滤掉 → 写入 0 条消息，界面仍空或只显示「无法解密」类占位（若我们曾渲染过加密占位）。
2. **密钥随后到达**  
   - SDK 在后台解密，同一批事件变为明文，但**我们未监听 RoomEvent.TimelineRefresh（或等价事件）**，因此**从未再次调用 fillMessagesFromSyncTimeline**，UI 不会用解密后的时间线重填。
3. **ClientEvent.Event**  
   - 我们只对「新到达的**新**事件」用 ClientEvent.Event 做 append。「已有事件从加密变为解密」是**原地更新**，一般不会再次触发 ClientEvent.Event，因此也不会通过现有逻辑自动刷新。

**结论**：加密房间无法展示的**第二层根因**与 Cinny #742 一致——**解密完成后没有触发「用当前时间线重新填充消息列表」**。

---

## 三、根因汇总

| 层级 | 原因 | 说明 |
|------|------|------|
| 1 | REST 无明文 | 加密房间历史走 REST 时服务端无 body，过滤后为空，属 E2EE 设计。 |
| 2 | 仅用 Sync 补数一次 | 在 Sync 就绪且 REST 为空时我们会用 fillMessagesFromSyncTimeline 补数。 |
| 3 | 补数时可能尚未解密 | 若此时密钥未到，时间线里事件无 body，补数结果为 0 条。 |
| 4 | 解密后未再刷新（与 Cinny 同） | 未监听 RoomEvent.TimelineRefresh，密钥到达并解密后没有再次从时间线重填，导致界面不更新。 |

因此：**加密房间消息「无法拉取展示」的根因 = REST 路径拿不到明文（设计如此）+ 解密完成后未监听 TimelineRefresh 并重新用 Sync 时间线填充 UI（与 Cinny #742 同类问题）。**

**补充（2026-02-14）**：若启用 TimelineRefresh 后仍看不到加密消息，多半是**本项目当前未启用 E2EE**（未传 deviceId、未 initRustCrypto/CryptoStore），SDK 从不解密，时间线里事件始终无明文 body。详见 **`docs/MATRIX_E2EE_PRINCIPLE_AND_PROJECT_STATUS.md`**。

---

## 四、建议修复方向（对齐 Cinny 思路）

1. **对当前展示的加密房间监听 RoomEvent.TimelineRefresh**  
   - 在 `useMatrixSyncClient` 中，对 Sync 客户端的 Room 注册 `RoomEvent.TimelineRefresh`（或 SDK 文档中推荐的解密/刷新相关事件）。  
   - 若当前前端正在展示的 `chatId` 即该 `roomId`，在回调里调用 `fillMessagesFromSyncTimeline(roomId)`，用最新（已解密）时间线重填消息列表。

2. **可选：识别加密房间**  
   - 若可获知房间为加密（例如通过 `room.getEncryptionTargetMembers()` 或房间 state），可仅在加密房间上挂 TimelineRefresh，减少无效刷新。

3. **保持现有逻辑**  
   - REST 先拉、空时用 Sync 补数、ClientEvent.Event 追加新消息，均保持不变；仅增加「解密后刷新」这一条路径。

实现时需注意：TimelineRefresh 可能在非解密场景也会触发（例如服务端时间线更新），对当前房间重跑一次 fillMessagesFromSyncTimeline 是幂等的，可接受。

---

## 五、相关文件与参考

| 用途 | 文件 / 链接 |
|------|-------------|
| 后端拉取房间消息 | apps/api：matrixClient（getRoomMessages 及过滤） |
| 前端 Sync 与时间线填充 | apps/web：useMatrixSyncClient（fillMessagesFromSyncTimeline、ClientEvent） |
| 何时补数 | apps/web Space 页：sessionId/syncReady 时 loadMessages 后若空则 fillMessagesFromSyncTimeline |
| Cinny 问题与修复思路 | [cinnyapp/cinny#742](https://github.com/cinnyapp/cinny/issues/742) |
| matrix-js-sdk Room 事件 | [RoomEvent](https://matrix-org.github.io/matrix-js-sdk/enums/matrix.RoomEvent.html)（含 TimelineRefresh） |
