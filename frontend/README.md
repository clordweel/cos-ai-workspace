# AI COS 工作台 — 前端

Nuxt 3 + Vue 3 + Tailwind，对话流 + 任务卡片，深色模式。

## 开发

```bash
npm install
npm run dev
```

默认运行在 `http://localhost:3000`（与 Nuxt 默认端口一致；若与中间层冲突，Nuxt 会提示改用 3001）。  
请确保中间层运行在另一端口（如 3000），并设置 `NUXT_PUBLIC_API_BASE=http://localhost:3000`，或通过 `nuxt.config.ts` 中代理将 `/api` 转发到中间层。

## 结构

- `pages/index.vue` — 主对话页
- `composables/useChatStream.ts` — SSE 流式对话
- `components/ChatMessageBubble.vue`、`ChatFlow.vue` — 对话 UI
- `components/TaskCard/*` — 订单进度、库存、BOM、物料确认卡片
