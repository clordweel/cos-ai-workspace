# Matrix 与 Markdown / 富文本消息

说明 Matrix 对消息富文本的支持方式，以及本项目中 Markdown 与 `formatted_body` 的用法与最佳方案。

---

## 一、Matrix 能否直接处理 Markdown？

**不能。** Matrix 协议里 **没有** 原生的 “markdown” 消息格式。

- **m.room.message** 的 content 中：
  - **`body`**：必填，**纯文本**（plain text），用于通知、搜索与纯文本客户端。
  - **`formatted_body`**：可选，**HTML**，用于富文本展示。
  - **`format`**：当使用 `formatted_body` 时，应设为 **`org.matrix.custom.html`**，表示 `formatted_body` 是 HTML。

因此，若要以富文本形式发送，必须把 **Markdown 转成 HTML**，再写入 `formatted_body`；`body` 仍保留纯文本。

---

## 二、最佳方案概览

| 环节 | 做法 |
|------|------|
| **接收（拉历史 / 收实时）** | 有 `formatted_body` 时优先用其作为 HTML，前端 **净化后** 渲染；无则用 `body` 做 Markdown 解析再渲染。已实现。 |
| **发送** | 若希望对方和本端都看到富文本：**先转成 HTML**，再发 `body`（纯文本）+ `formatted_body`（HTML）+ `format: "org.matrix.custom.html"`。 |

---

## 三、接收端（已实现）

- **中间层**：`listMessages` 从 Matrix 事件中读出 `body` 与 `formatted_body`，映射到 NormalizedMessage 的 `content` 与 `formattedBody`。
- **前端**：  
  - 有 `message.formattedBody` 时，用 `useMarkdownRender().renderFormattedBody()` 净化后以 HTML 渲染（用户/助手气泡均支持）。  
  - 无 `formattedBody` 时，对 `message.content` 做 Markdown 解析 + 净化后渲染（当前仅助手消息，用户消息亦可复用同一逻辑）。  
- 详见 `docs/MESSAGE_MARKDOWN_RENDERING.md` 与 apps/web 的 Markdown 渲染逻辑。

---

## 四、发送端（已实现：中间层独立处理）

apps/api 提供 **消息文本处理**（如 messageTextProcessor），在发送到 Matrix 前统一处理：

1. **指令解析**：识别并解析如 `[@id="assistant" label="AI 助手"]` 的指令块（支持 `key="value"` 属性），产出结构化 `instructions` 供业务使用；在 `body` 中用 `label` 或 `id` 替代，在 `formatted_body` 中渲染为带 `data-id`/`data-label` 的 `<span class="msg-instruction">`。
2. **Markdown → HTML**：对非指令的文本段用 markdown-it 转 HTML，再经 DOMPurify 白名单净化。
3. **输出**：`{ body, formattedBody, instructions }`；Matrix 发送时带 `body` + `formatted_body`（有则）+ `format: "org.matrix.custom.html"`。

Matrix 适配器在 **用户消息** 与 **助手回复写入房间** 时均调用 `processMessageText`，再通过 `sendRoomMessage(..., formattedBody)` 发送。前端无需再对发送内容做转换；若请求体将来扩展为可传 `formattedBody`，中间层也可选择透传或仍经此处理。

**安全**：不将未净化 HTML 写入 `formatted_body`；`body` 始终保留纯文本以符合协议与可访问性。

---

## 五、协议与安全参考

- Matrix Client-Server API：m.room.message 的 `body`、`formatted_body`、`format`（如 [spec.matrix.org](https://spec.matrix.org/latest/client-server-api/#mroommessage)）。
- 富文本仅支持 **HTML**（`format: org.matrix.custom.html`），标签/属性应限制在白名单内，避免 XSS；本项目前端使用 DOMPurify/isomorphic-dompurify 做净化。
