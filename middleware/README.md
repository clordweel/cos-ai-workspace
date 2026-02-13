# AI 工作台中间层

- **Fastify**：HTTP + SSE，分层结构便于业务扩展
- **聊天后端适配器**：会话/消息标准化，可插拔后端（默认 **mock** 用于功能调试；可扩展 dify、zulip、matrix 等）
- **职责**：流式对话代理、cos/ERPNext 编排、写入前确认与权限校验

## 目录结构

- **TypeScript 源码**（`src/**/*.ts`）：编译到 `dist/`，运行与测试使用编译产物。
- `src/config.ts` — 环境与常量（port、chat.provider、dify、cos）
- `src/adapters/` — 聊天后端适配器（types、index、mock）
- `src/lib/` — 工具（如 thinkingParser）
- `src/services/` — 业务逻辑（cosClient、exportMarkdown 等）
- `src/routes/` — 路由（health、chat、material）
- `src/index.ts` — 入口：挂载路由、监听端口、优雅退出
- `scripts/release-port.ts` — 开发前释放端口（由 predev 调用）
- `test/` — 自动化测试（适配器与会话 API，引用 `dist/`）

## 环境变量

从**工作区根目录**或**当前目录**的 `.env` 加载（根目录优先）。

| 变量 | 说明 |
|------|------|
| `PORT` | 服务端口，默认 3000 |
| `CHAT_PROVIDER` | **mock**（默认）\| **matrix**（当前仅此二者已注册） |
| `SHUTDOWN_TIMEOUT_MS` | 优雅退出最大等待时间（毫秒），默认 15000 |
| `DIFY_API_BASE` | Dify API 根地址（接入 Dify 适配器时使用） |
| `DIFY_API_KEY` | Dify 应用 API Key（接入 Dify 适配器时使用） |
| **ERPNext 业务相关** | |
| `COS_ERP_BASE` | cos/ERPNext API 根地址（如 `https://erp.example.com/api`） |
| `COS_ERP_API_KEY` | 调用 cos 时的 Bearer Token（可选，按 Frappe/cos 约定） |
| `COS_ERP_API_SECRET` | 若使用 API Key + Secret 认证时填写（由 cos 侧约定） |
| `COS_ERP_TIMEOUT_MS` | 调用 ERPNext 接口超时（毫秒），可选，默认 15000 |
| **Matrix（CHAT_PROVIDER=matrix 时）** | |
| `MATRIX_BASE_URL` | Synapse 根地址（如 `http://10.1.1.15:8008`），默认 10.1.1.15:8008 |
| `MATRIX_USER_ID` | Matrix 用户 ID（如 `@workbench:10.1.1.15`） |
| `MATRIX_PASSWORD` | 登录密码（与 MATRIX_ACCESS_TOKEN 二选一） |
| `MATRIX_ACCESS_TOKEN` | 已有 access token 时可直接填，免登录 |
| `MATRIX_INVITE_USE_ADMIN_JOIN` | 邀请方式：不设或 `true` = Admin API 直接将会员加入房间（免邀请）；`false` = Client API 发送邀请，对方需接受 |

## 开发

```bash
pnpm install
pnpm run dev   # 使用 tsx watch 直接运行 src/index.ts，无需先 build
```

- **生产/测试**：`pnpm run build` 编译 TypeScript 到 `dist/`；`pnpm start` 运行 `node dist/src/index.js`；`pnpm test` 会先 build 再运行测试（测试引用 `dist/`）。

## 调试

- **日志**：开发时默认 `logger.level = 'debug'`；可设 `LOG_LEVEL` 调节。路由内 `req.log.debug()` 等。
- **断点**：`pnpm run dev:debug`（`--inspect`）；浏览器 `chrome://inspect` 或 Cursor/VS Code 附加。根目录 `.vscode/launch.json` 已配置：
  - **Middleware: 启动并断点调试** — F5 直接启动中间层并命中断点；
  - **Middleware: 启动并等待调试器** — 启动后暂停在首行，再 F5 继续；
  - **Middleware: 附加到已运行进程** — 先执行 `pnpm run dev:debug`，再选此配置 Attach，对已运行进程下断点。
- **直接调 API**：curl 示例：`curl -s http://localhost:3000/health`；`POST /api/chat/stream` 见接口节。

## 接口

- `GET /health` — 健康检查
- `POST /api/chat/stream` — SSE 流式对话（Body: `message`, `conversation_id?`, `user_id?`）
- `POST /api/chat/export-markdown` — 导出会话为 Markdown（Body: `messages[]`，返回 `{ markdown }`）
- `POST /api/material/confirm` — 确认创建物料（Body: `draft_id`, `confirmed_by`），转发至 cos `create_from_draft`

详见项目根目录 `docs/FRONTEND_API_REQUIREMENTS.md`、`docs/STREAM_AND_SAFETY.md`、`docs/API_SPEC.md`。

## 测试

会话适配器与聊天路由的自动化测试（依赖 Mock 适配器）：

```bash
pnpm run test
```

测试会先执行 `pnpm run build`，再设置 `CHAT_PROVIDER=mock` 运行 `test/adapters/*.test.js`、`test/routes/chat.test.js`（用例引用 `dist/` 下的编译产物）。新增适配器或修改会话 API 时请保持或补充用例。
