# Element 风格消息列表对齐说明

本文档记录 apps/web 消息列表与 Element 客户端消息列表（Timeline/EventTile）的设计与功能对齐情况。

## 对齐的功能点

| 功能 | Element | apps/web 实现 |
|------|---------|----------------|
| 日期分隔 | 按日分组，居中分隔线 + 日期文案 | `buildChatDisplayItems` 插入 `date` 项，ChatPane 渲染分隔线 |
| 系统消息 | 居中、弱化样式、无头像 | `MessageTile` → `SystemMessageTile` |
| 用户消息右对齐 | 气泡在右、头像在右 | `BubbleMessageTile` `isUser` 时 `flex-row-reverse` |
| 他人消息左对齐 | 头像在左、发送者名 + 时间 + 气泡 | 左侧 Avatar、发送者标签、时间、气泡 |
| 时间戳 | 每条消息旁 | `formatTime(ts)`，今日仅时分 |
| 发送状态 | 发送中/已发送/已送达/失败 | `ReceiptStatusIcon`（Loader2/Check/CheckCheck/AlertCircle） |
| 已读回执 | 气泡外小头像或底部 | `ReadReceiptAvatars`，用户消息右侧 |
| 消息来源 | bot/用户/系统标签 | `SourceLabels`，助手消息下方 |
| 反应 | 气泡下方 emoji/文字 | `ReactionPills`（like/dislike 计数） |
| 编辑标识 | 「已编辑」+ 编辑者 | 气泡内 `editedAt`/`editedBy` |
| 回复引用 | 引用线 + 被引用内容摘要 | `replyToId`，气泡内「引用消息」占位（可扩展为解析被引用内容） |

## 数据模型

- **ChatMessageItem**（`chatMessageTypes.ts`）：与 Element/Matrix 常见字段对齐，含 `id/role/content/createdAt` 及可选 `readBy/sources/reactions/editedAt/editedBy/receiptStatus/replyToId` 等。
- **全场景 Mock**：`apps/web/src/data/mockMessagesFullScenario.ts` 提供 `FULL_SCENARIO_MESSAGES` 与 `FULL_SCENARIO_SESSION_ID`，覆盖上述所有展示状态，便于调试。

## 会话入口

- 会话列表新增「【调试】全场景 Element」会话（`FULL_SCENARIO_SESSION_ID`），选中后加载全场景消息。

## 参考

- Element Web / matrix-react-sdk：Timeline、EventTile、消息气泡布局与已读/反应等交互。
- 本仓库 `ELEMENT_MATRIX_COMPOSER_RESEARCH.md`：输入框（CIDER）调研；消息列表为独立模块。
