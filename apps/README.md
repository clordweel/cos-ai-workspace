# apps/

标准 monorepo 下的**应用**目录，参考 Element 等成熟项目的约定。**当前开发与运行以本目录下应用为准**，原 frontend、middleware 已废弃、保留根目录仅作参考。

- **apps/api**（`@cosai/api`）：当前后端，Fastify + TypeScript；鉴权、/api/auth/me、会话与聊天适配器（mock + matrix）、SSE 流式、用户偏好、Matrix 同步。根脚本 `dev:api`、`build:api`，端口 3000。
- **apps/web**（`@cosai/web`）：当前前端，React 18 + Webpack 5 + TypeScript；Workspace 布局、认证、会话与聊天、Matrix Sync、应用区与设置。根脚本 `dev:web`、`build:web`，端口 3001，/api 代理到 3000。
- **运行**：根目录 `pnpm run dev:api`、`pnpm run dev:web`（推荐两终端联调）；阶段进度见 `docs/REFACTOR_PLAN.md` 与 `docs/PROJECT_PHASE_SUMMARY.md`。
