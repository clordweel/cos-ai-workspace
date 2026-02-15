# Monorepo 标准结构：apps/ 与 packages/ 引入说明

> 以 Element 等成熟项目为参考，引入 pnpm monorepo 标准目录 `apps/`、`packages/`，**现有 frontend 与 middleware 保持不变**。最后更新：2026-02-15。

---

## 一、结论：可行且已落地

- **可行**：在不动现有 `frontend`、`middleware` 的前提下，仅扩展 pnpm workspace 的 `packages` 列表，新增 `apps/*` 与 `packages/*`，即可形成「根目录保留现有应用 + 标准 apps/packages 目录」的混合结构。
- **已做**：已更新 `pnpm-workspace.yaml`，并创建 `apps/`、`packages/` 目录及占位内容；根目录 `dev` / `dev:frontend` / `dev:middleware` 脚本不变，行为与引入前一致。

---

## 二、参考：Element 的约定

- **Element Web**（element-hq/element-web）采用 pnpm workspace，`pnpm-workspace.yaml` 中：
  - `packages: [".", "packages/*"]`：根目录 `"."` 即主应用，`packages/*` 为共享包。
  - 使用 `nodeLinker: hoisted`、`linkWorkspacePackages: true`、`catalog` 统一部分依赖版本。
- **本仓库**：需要保留根目录下的 `frontend`、`middleware` 不移动，因此采用「显式列出现有应用 + 标准 glob」的方式：
  - `packages: [frontend, middleware, "apps/*", "packages/*"]`
  - 现有应用仍在根目录；新应用放入 `apps/`，共享能力放入 `packages/`。

---

## 三、当前目录与职责

| 路径 | 说明 |
|------|------|
| **frontend** | 现有 Nuxt/Vue 前端，**不移动**；仍为 workspace 一员，根脚本 `dev:frontend`、`build:frontend` 继续指向此处。 |
| **middleware** | 现有 Fastify 中间层，**不移动**；仍为 workspace 一员，根脚本 `dev:middleware`、`build:middleware` 继续指向此处。 |
| **apps/** | 标准「应用」目录；含 **apps/api**（`@ai-workbench/api`，重构版后端）、**apps/web**（`ai-workbench-web`，重构版 React 前端）；见 `docs/REFACTOR_PLAN.md` 阶段 0。 |
| **packages/** | 标准「共享包」目录；已含占位包 `packages/tsconfig-base`，供各应用扩展共享 TS 配置；可继续增加 eslint-config、shared-types 等。 |

---

## 四、pnpm-workspace.yaml 变更

```yaml
packages:
  - frontend
  - middleware
  - "apps/*"
  - "packages/*"
```

- 保留 `frontend`、`middleware` 两项，确保现有 filter 与脚本无需修改。
- 新增 `"apps/*"`、`"packages/*"`，此后在 `apps/`、`packages/` 下新增的带 `package.json` 的子目录会自动成为 workspace 包。

---

## 五、使用约定

- **引用共享包**：在 frontend、middleware 或 apps/* 的 `package.json` 中可添加依赖，例如  
  `"@ai-workbench/tsconfig-base": "workspace:*"`，用于继承 `packages/tsconfig-base` 的配置。
- **根脚本**：已增加 `dev:api`、`dev:web`、`build:api`、`build:web`；原 `dev:frontend`、`dev:middleware` 不变。
- **CI/文档**：若 CI 或文档中有「前端路径」「中间层路径」的假设，仍以 `frontend`、`middleware` 为准；新应用以 `apps/<name>` 为准。

---

## 六、相关文件

| 文件 | 说明 |
|------|------|
| `pnpm-workspace.yaml` | workspace 包列表（含 apps/*、packages/*） |
| `apps/README.md` | apps/ 目录用途说明 |
| `packages/README.md` | packages/ 目录用途说明 |
| `packages/tsconfig-base/` | 共享 TS 基础配置占位包 |
| `docs/FRONTEND_REACT_WEBPACK_MIGRATION.md` | 前端迁移方案（React+Webpack，可落于 apps/web） |
