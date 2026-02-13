# COS&AI 工作空间 — 前端

Nuxt 3 + Vue 3 + Tailwind，对话流 + 任务卡片，深色模式。

## 开发

```bash
npm install
npm run dev
```

默认运行在 `http://localhost:3000`（与 Nuxt 默认端口一致；若与中间层冲突，Nuxt 会提示改用 3001）。  
请确保中间层运行在另一端口（如 3000），并设置 `NUXT_PUBLIC_API_BASE=http://localhost:3000`，或通过 `nuxt.config.ts` 中代理将 `/api` 转发到中间层。

## 结构

- `pages/index.vue` — 入口，重定向至 `/space`（可带 `app`、`with` 等 query）
- `pages/space/[[id]].vue` — 会话页（列表 + 聊天），主对话区
- `layouts/workspace.vue` — 工作台布局（会话区 + 应用区）
- `composables/useChatStream.ts` — SSE 流式对话；`useAppView.ts` — 应用区状态；`useChatSessions.ts` — 会话与消息
- `components/ChatMessageBubble.vue` — 单条消息气泡
- `components/SessionListHeader.vue`、`WorkspaceAppNav.vue`、`AppPanel.vue` — 会话顶栏、应用侧栏、应用内容
- `components/TaskCard/*` — 订单进度、库存、BOM、物料确认卡片
- `components/ui/` — 通用 UI（Select、Checkbox，基于 radix-vue）
