# 前端对中间层 API 需求梳理

> 由 frontend 模块实际调用归纳，供 middleware 实现与联调参考。

## 1. 流式对话

| 项目 | 说明 |
|------|------|
| **路径** | `POST /api/chat/stream` |
| **Body** | `{ message: string, conversation_id?: string, user_id?: string }` |
| **响应** | SSE，`Content-Type: text/event-stream` |
| **事件** | `status`（如 thinking）、`thinking`（delta / fullText）、`message`（delta）、`dify_event`（工具等）、`message_end`、`error` |
| **前端** | `useChatStream.ts` → 打字机效果、思考过程保留、lastEvent 不重置 |

## 2. 物料确认创建

| 项目 | 说明 |
|------|------|
| **路径** | `POST /api/material/confirm` |
| **Body** | `{ draft_id: string, confirmed_by: string }` |
| **响应** | 成功 `{ item_code?, item_name?, name? }`；失败 4xx/5xx + 统一错误格式 |
| **前端** | `MaterialConfirm.vue` 点击「确认创建」后调用，成功后 `emit('confirmed')` |
| **后端** | 中间层权限校验后调用 cos `create_from_draft`，见 API_SPEC.md |

## 3. 导出会话为 Markdown

| 项目 | 说明 |
|------|------|
| **路径** | `POST /api/chat/export-markdown` |
| **Body** | `{ messages: { role: 'user' \| 'assistant', content: string, thinking?: string }[] }` |
| **响应** | `{ markdown: string }` |
| **前端** | `pages/space/[[id]].vue` 导出按钮，下载 .md 文件 |

## 前端代理与环境

- `nuxt.config` 将 `/api` 代理到 `NUXT_PUBLIC_API_BASE`（默认 `http://localhost:3000`）。
- 流式与物料确认为 `fetch(apiBase + '/api/...')`；导出当前为 Nuxt server API，可迁至中间层统一入口。
