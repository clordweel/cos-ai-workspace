# apps/

标准 monorepo 下的**应用**目录，参考 Element 等成熟项目的约定。

- **当前**：
  - **apps/middleware**：Fastify 中间层（已从根目录迁入）；根脚本 `dev:middleware`、`build:middleware` 通过 `pnpm --filter ai-workbench-middleware` 运行。
  - 根目录 **frontend**（Nuxt/Vue）暂不移动。
- **用途**：后续新增应用放在本目录下，例如：
  - **apps/web**：规划中的 React + Webpack 工作台前端（见 `docs/FRONTEND_REACT_WEBPACK_MIGRATION.md`）。
- **运行**：根目录 `package.json` 的 `dev`、`dev:frontend`、`dev:middleware` 不变；新增应用后可在根目录增加 script（如 `dev:web`）。
