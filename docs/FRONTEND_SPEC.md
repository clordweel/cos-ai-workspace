# 前端规范（Nuxt 3 + 对话流 + 任务卡片）

## 技术栈

- **Vue 3** + **Nuxt 3** + **Tailwind CSS** + **Shadcn-vue**
- 跨端：**Tauri**（桌面）/ **Capacitor**（移动/PWA）

## UX 原则（De-ERP）

- **极简、抽象、深色模式**；严禁传统密集表格。
- 主界面以**对话流**为主，结构化结果以**任务卡片**形式嵌入对话。
- 卡片类型示例：订单进度、库存摘要、BOM 状态、**待确认物料**（带「确认创建」按钮）。

## 与中间层交互

- **对话**：`POST /api/chat/stream`，消费 **SSE**，将 `message` 事件做打字机展示。
- **确认创建物料**：用户点击卡片「确认」→ 前端调用 `POST /api/material/confirm`（携带 `draft_id`、当前用户标识），成功后刷新卡片状态或追加一条系统消息。

## SSE 消费示例（概念）

```ts
// 使用 fetch + ReadableStream 或 EventSource
const res = await fetch('/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: userInput, user_id: currentUser }),
});
const reader = res.body.getReader();
const decoder = new TextDecoder();
// 解析 SSE 行，根据 event 类型更新 UI：message → 追加文本；tool_result → 渲染任务卡片
```

## 目录建议（Nuxt 3）

```
frontend/
├── app.vue
├── nuxt.config.ts
├── pages/
│   └── index.vue          # 主对话页
├── components/
│   ├── ChatFlow.vue       # 对话流容器
│   ├── MessageBubble.vue  # 单条消息（含打字机）
│   └── TaskCard/
│       ├── OrderProgress.vue
│       ├── InventorySummary.vue
│       ├── BomStatus.vue
│       └── MaterialConfirm.vue  # 待确认物料 + 确认按钮
├── composables/
│   └── useChatStream.ts   # SSE 封装
└── tailwind.config.js / shadcn 配置
```

## 主题

- 默认**深色**；可提供浅色切换。
- 与 Shadcn-vue 深色主题变量一致，保证对比度与可访问性。
