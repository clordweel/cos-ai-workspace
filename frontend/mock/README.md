# Mock 会话模块

会话列表与演示消息由 **mock 数据库** 统一提供，与页面逻辑解耦，支持 Faker 与 MSW 最佳实践。

## 结构

- **types.ts** — 类型：`MockSessionItem`、`MockParticipant`、`MockSessionType`
- **db.ts** — **Mock 数据库**：基于 `@faker-js/faker` 生成会话与消息（固定 seed 保证可复现），内存存储；暴露 `getSessionList()`、`getSessionById(id)`、`getMessages(sessionId)`
- **sessionList.ts** — 从 db 读取并导出 `mockSessionList`、`getMockSessionById`
- **sessionMessages.ts** — 从 db 读取并导出 `getMockSessionMessages`
- **handlers.ts** — **MSW** 处理器：将 mock 数据库以 REST 暴露为 `GET /api/mock/sessions`、`GET /api/mock/sessions/:id`、`GET /api/mock/sessions/:id/messages`
- **composables/useMockSessions.ts** — 开关、列表、消息与注入（`seedMockMessages`）

## 依赖

- **@faker-js/faker** — 生成时间、条数等，配合内置中文短语生成会话与消息
- **msw** — 开发环境下通过 `plugins/mock-worker.client.ts` 启动 Worker，拦截 `/api/mock/*` 并返回 db 数据

## 使用方式

- **应用内**：`useMockSessions()` 与页面直接读 `~/mock`（sessionList / sessionMessages），数据均来自 db。
- **通过 API**：开发环境下可请求 `GET /api/mock/sessions`、`GET /api/mock/sessions/:id/messages`，由 MSW 返回同一 mock 数据库内容。
- **扩展**：修改 `db.ts` 可改用 `@faker-js/faker/locale/zh_CN`、更多 Faker 方法或外部数据源；MSW handlers 无需改动。

## 群组与多人参与

- **群组内 @ 拉入机器人**：`MockParticipant` 支持 `kind: 'user' | 'bot'`，群组参与者可包含用户与机器人；列表缩略图四宫格中机器人用紫色格与 Bot 图标区分。
- **消息多人参与**：`ChatMessage` 支持 `reactions`（点赞/反对及谁点的）、`editedAt` / `editedBy`（有编辑权限者的修改）、`sources` 多来源（多机器人协作回复时多人头像堆叠）。Mock 数据中部分群组消息带点赞与“已编辑”示例。
