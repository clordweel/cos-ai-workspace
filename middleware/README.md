# AI 工作台中间层

- **Fastify**：HTTP + SSE
- **Dify**：使用官方 [dify-client](https://www.npmjs.com/package/dify-client)（ChatClient）做流式对话
- **职责**：Dify 流式代理、cos/ERPNext 编排、写入前确认与权限校验

## 环境变量

从**工作区根目录**或**当前目录**的 `.env` 加载（根目录优先）。

| 变量 | 说明 |
|------|------|
| `PORT` | 服务端口，默认 3000 |
| `DIFY_API_BASE` | Dify API 根地址（如 `https://api.dify.ai/v1`，不要带 `/chat-messages`） |
| `DIFY_API_KEY` | Dify 应用 API Key（必填，否则返回 502） |
| `COS_ERP_BASE` | ERPNext + cos 的 API 根地址 |
| `COS_API_KEY` / `COS_API_SECRET` | 调用 cos 时的认证（按 Frappe 约定） |

## 开发

```bash
npm install
npm run dev
```

## 接口

- `GET /health` — 健康检查
- `POST /api/chat/stream` — SSE 流式对话（Body: `message`, `conversation_id?`, `user_id?`）
- `POST /api/material/confirm` — 确认创建物料（Body: `draft_id`, `confirmed_by`）

详见项目根目录 `docs/STREAM_AND_SAFETY.md`。
