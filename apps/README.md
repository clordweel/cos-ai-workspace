# apps/

标准 monorepo 下的**应用**目录，参考 Element 等成熟项目的约定。重构产物在此新建，原 frontend、middleware 保留根目录不动。

- **apps/api**（`@cosai/api`）：重构版后端，Fastify + TypeScript；根脚本 `dev:api`、`build:api`。阶段 0 仅 `GET /health`，鉴权与 /api/* 在阶段 1 起实现。
- **apps/web**（`@cosai/web`）：重构版前端，React 18 + Webpack 5 + TypeScript；根脚本 `dev:web`、`build:web`。阶段 0 为路由占位与 /api 代理，认证与布局在阶段 2 实现。
- **运行**：根目录 `pnpm run dev:api`、`pnpm run dev:web`；现有 `dev:frontend`、`dev:middleware` 不变。
