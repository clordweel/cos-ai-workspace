# apps/

标准 monorepo 下的**应用**目录，参考 Element 等成熟项目的约定。

- **当前**：根目录的 `frontend`（Nuxt/Vue）与 `middleware`（Fastify）**保持不变**，不迁入此处。
- **用途**：后续新增应用放在本目录下，例如：
  - `apps/web`：规划中的 React + Webpack 工作台前端（见 `docs/FRONTEND_REACT_WEBPACK_MIGRATION.md`）。
- **运行**：根目录 `package.json` 的 `dev` / `dev:frontend` / `dev:middleware` 仍指向 `frontend`、`middleware`；新增应用后可在根目录增加对应 script（如 `dev:web`）。
