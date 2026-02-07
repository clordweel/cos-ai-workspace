# 前端数据与 Mock 约定

## 消息数据结构（会话导出 / Mock 通用）

与 `useChatSessions` 的 `ChatMessage` 类型一致，便于导入导出与 mock 复用。

### JSON（推荐：存储、API、Mock）

- **用途**：运行时 mock、导出聊天、与服务端/中间层对齐。
- **单条消息**：`{ "role": "user" | "assistant", "content": string, "thinking"?: string }`
- **会话**：`ChatMessage[]`，按时间顺序排列。
- **文件**：`placeholder-messages.json` 为占位消息 mock，结构同上。

### Markdown（导出给人看）

- **用途**：导出为 `.md` 文件，便于阅读、分享、版本管理。
- **建议格式**：每条消息一个区块，用标题或粗体区分角色，思考过程可选折叠或引用块。
- **示例**：
  ```markdown
  ## 用户
  这是一条用户消息。

  ## 助手
  这是一条助手回复。
  > 思考过程：...
  ```
- 实现「导出 Markdown」时，可由当前会话的 `ChatMessage[]` 序列化为此格式。

### YAML（可选：配置 / 人工编辑 Mock）

- **用途**：需要人工编辑 mock 或配置时，可读性更好。
- **结构**：与 JSON 同构，数组 + `role` / `content` / `thinking`。
- 若引入 YAML 解析（如 `yaml`），可新增 `placeholder-messages.yaml` 并在开发时加载；与 JSON 二选一即可。

## 文件说明

| 文件 | 说明 |
|------|------|
| `placeholder-messages.json` | 占位消息列表，无真实消息时用于调试气泡与滚动。 |
