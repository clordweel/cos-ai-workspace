# AI 工作台中间层

- **Fastify**：HTTP + SSE，分层结构便于业务扩展
- **Dify**：使用官方 [dify-client](https://www.npmjs.com/package/dify-client)（ChatClient）做流式对话
- **职责**：Dify 流式代理、cos/ERPNext 编排、写入前确认与权限校验

## 目录结构

- `src/config.js` — 环境与常量（port、dify、cos）
- `src/lib/` — 工具（如 thinkingParser）
- `src/services/` — 业务逻辑（difyStream、cosClient、exportMarkdown）
- `src/routes/` — 路由（health、chat、material）
- `src/index.js` — 入口：挂载路由、监听端口、优雅退出

## 环境变量

从**工作区根目录**或**当前目录**的 `.env` 加载（根目录优先）。

| 变量 | 说明 |
|------|------|
| `PORT` | 服务端口，默认 3000 |
| `SHUTDOWN_TIMEOUT_MS` | 优雅退出最大等待时间（毫秒），默认 15000 |
| `DIFY_API_BASE` | Dify API 根地址（如 `https://api.dify.ai/v1`） |
| `DIFY_API_KEY` | Dify 应用 API Key（必填，否则流式接口返回 502） |
| **ERPNext 业务相关** | |
| `COS_ERP_BASE` | cos/ERPNext API 根地址（如 `https://erp.example.com/api`） |
| `COS_ERP_API_KEY` | 调用 cos 时的 Bearer Token（可选，按 Frappe/cos 约定） |
| `COS_ERP_API_SECRET` | 若使用 API Key + Secret 认证时填写（由 cos 侧约定） |
| `COS_ERP_TIMEOUT_MS` | 调用 ERPNext 接口超时（毫秒），可选，默认 15000 |

## 开发

```bash
pnpm install
pnpm run dev
```

## 调试

- **日志**：开发环境下默认 `logger.level = 'debug'`，可在 `.env` 中设置 `LOG_LEVEL=trace|debug|info|warn|error` 调节。路由内使用 `req.log.debug()` / `req.log.info()` 等打点。
- **Chrome/Edge 断点**：执行 `pnpm run dev:debug` 启动（带 `--inspect`），浏览器打开 `chrome://inspect` → 配置 target 为 `localhost:9229`，或 Cursor/VS Code 用下方「附加」配置。
- **Cursor / VS Code 断点**：根目录 `.vscode/launch.json` 已配置：
  - **Middleware: 启动并断点调试** — F5 直接启动中间层并命中断点；
  - **Middleware: 启动并等待调试器** — 启动后暂停在首行，再 F5 继续；
  - **Middleware: 附加到已运行进程** — 先执行 `pnpm run dev:debug`，再选此配置 Attach，对已运行进程下断点。
- **直接调 API**：不依赖前端，用 curl 或 REST 客户端测接口，例如：
  ```bash
  curl -s http://localhost:3000/health
  curl -s -X POST http://localhost:3000/api/chat/stream -H "Content-Type: application/json" -d '{"message":"hi","user_id":"test"}'  # SSE 流
  curl -s http://localhost:3000/api/diagnostics
  ```

## 接口

- `GET /health` — 健康检查
- `POST /api/chat/stream` — SSE 流式对话（Body: `message`, `conversation_id?`, `user_id?`）
- `POST /api/chat/export-markdown` — 导出会话为 Markdown（Body: `messages[]`，返回 `{ markdown }`）
- `POST /api/material/confirm` — 确认创建物料（Body: `draft_id`, `confirmed_by`），转发至 cos `create_from_draft`

详见项目根目录 `docs/FRONTEND_API_REQUIREMENTS.md`、`docs/STREAM_AND_SAFETY.md`、`docs/API_SPEC.md`。
