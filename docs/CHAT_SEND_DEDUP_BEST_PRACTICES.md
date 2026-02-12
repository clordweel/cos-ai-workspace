# 发送消息与去重：后端处理后的新旧消息并存

当中间层对消息做处理（如 Markdown/指令解析后写入 Matrix 的 `body`/`formatted_body`）时，前端若先乐观插入「用户输入原文」，再依赖 Matrix sync 收到「后端处理后的消息」，会出现 **content 不一致**：sync 的 `body` 可能是处理后的纯文本（如「AI 助手测试」），而本地是原文（如 `[@id="assistant" label="AI 助手"]测试`），按 content 相等合并会失败，导致 **同一条消息展示两次**（旧：乐观插入；新：sync 追加）。

本文档给出两种最佳实践及本项目的采用方式。

---

## 方案一：不预插，输入框 loading，等 Matrix sync 再展示

**做法**

- 用户点击发送后：输入框清空，按钮/输入区进入 **loading**（如「发送中」或禁用），**不** 向本地消息列表 append 任何一条。
- 请求照常发往后端；后端写入 Matrix 后，由 **Matrix sync** 将新事件推给前端。
- 前端仅在 **收到 sync 的 m.room.message** 时 append 该条消息，即 **唯一数据源是 sync**。

**优点**

- 绝不会重复；逻辑简单；与 Element/Cinny 等「以服务端事件为准」一致。
- 无需在 sync 里做「合并/替换」判断。

**缺点**

- 用户要等 sync 延迟（通常几百 ms 到 1s）才看到自己的消息，体感略慢。
- 需在 UI 上明确「发送中」状态（输入区 loading 或底部「发送中…」），否则易误以为没发出去。

**适用**

- 对一致性要求高、可接受稍晚展示的场景；或 sync 延迟很低的部署。

---

## 方案二：预插「发送中」占位，sync 到时替换该条（本项目采用）

**做法**

1. **发送时**：立即向本地列表 append 一条 **己方 user 消息**，内容为用户输入，并设 **receiptStatus: 'sending'**，**不设 id**（表示尚未得到服务端 event_id）。
2. **Sync 收到己方 user 消息时**：  
   - 若列表中已存在该 **event_id**，直接 return，不追加。  
   - 否则，查找 **最后一条**「role 为 user 且无 id（或为 sending 占位）且在合理时间窗内」的消息，视为本次发送的占位，用 **sync 的 event 整条替换** 该位置（id、content、formattedBody、createdAt、receiptStatus 等均以 sync 为准）。  
   - 若未找到占位（例如未开 sync 或先收到 sync 再渲染），则照常 append。
3. **后端可随意改写 body/formatted_body**：合并不依赖 content 相等，只依赖「最后一条无 id 的己方 user 消息」在时间窗内，用 sync 数据替换，避免重复。

**优点**

- 用户发送后立即看到自己的消息（乐观展示），体感好。
- 后端处理导致 body 变化也不会重复，因为用「替换占位」而不是「content 匹配后更新 id」。
- 不需要后端在 SSE 里回传 event_id。

**缺点**

- Sync 逻辑略复杂（需「找占位 + 替换」）；时间窗与「最后一条」的语义需约定清楚（如 15s 内、仅最后一条）。

**适用**

- 需要乐观展示、且后端会改写消息内容的场景；本项目因有 messageTextProcessor 改写 body/formatted_body，采用本方案。

---

## 本项目实现要点

- **useSpaceChatPane.send()**：append 的用户消息带 **receiptStatus: 'sending'**，不设 id。  
- **useMatrixSyncClient**（m.room.message 己方 user）：  
  - 若已存在相同 event_id → return。  
  - 否则找 **最后一条** role===user 且无 id 且 createdAt 在近 15s 内的消息；若找到则 **setMessages 替换该条** 为 sync 的完整消息（id、content、formattedBody、receiptStatus: 'sent' 等），并 return。  
  - 未找到则照常 append。  
- 发送失败时：可将该条 sending 占位的 receiptStatus 置为 'failed'，或从列表中移除，由产品决定。

这样即使用户输入含指令、后端写入 Matrix 的是处理后的 body/formatted_body，前端也只会展示一条消息，且以 sync 为准。
