# Monorepo 标准结构：apps/ 与 packages/ 引入说明

> 以 Element 等成熟项目为参考，引入 pnpm monorepo 标准目录 `apps/`、`packages/`；**中间层已迁入 apps/middleware**，frontend 暂留根目录。最后更新：2026-02-15。

---

## 一、结论：可行且已落地

- **可行**：扩展 pnpm workspace，新增 `apps/*` 与 `packages/*`；中间层已迁入 `apps/middleware`，根脚本通过 `pnpm --filter ai-workbench-middleware` 不变。
- **已做**：`pnpm-workspace.yaml` 含 `frontend`、`apps/*`、`packages/*`（middleware 由 `apps/*` 覆盖）；根目录 `dev` / `dev:frontend` / `dev:middleware` 脚本不变。

---

## 二、参考：Element 的约定

- **Element Web**（element-hq/element-web）采用 pnpm workspace，`packages: [".", "packages/*"]`；根即主应用，`packages/*` 为共享包。
- **本仓库**：根目录保留 `frontend`；应用统一放入 `apps/*`（中间层已为 `apps/middleware`），共享能力放入 `packages/*`：
  - `packages: [frontend, "apps/*", "packages/*"]`

---

## 三、当前目录与职责

| 路径 | 说明 |
|------|------|
| **frontend** | 现有 Nuxt/Vue 前端，暂留根目录；根脚本 `dev:frontend`、`build:frontend` 指向此处。 |
| **apps/middleware** | Fastify 中间层（原根目录 middleware）；根脚本 `dev:middleware`、`build:middleware` 通过 `--filter ai-workbench-middleware` 指向此处。源码路径：`apps/middleware/src/`。 |
| **apps/** | 标准「应用」目录；含 `apps/middleware`，后续可新增 `apps/web`（React+Webpack，见 `docs/FRONTEND_REACT_WEBPACK_MIGRATION.md`）。 |
| **packages/** | 标准「共享包」目录；已含 `packages/tsconfig-base`，可继续增加 eslint-config、shared-types 等。 |

---

## 四、pnpm-workspace.yaml

```yaml
packages:
  - frontend
  - "apps/*"
  - "packages/*"
```

- `apps/*` 覆盖 `apps/middleware` 等；根脚本仍用包名 `ai-workbench-middleware`，无需改 script。

---

## 五、使用约定

- **引用共享包**：在 frontend 或 apps/* 的 `package.json` 中可添加 `"@ai-workbench/tsconfig-base": "workspace:*"` 等。
- **根脚本**：`dev:middleware` / `build:middleware` 不变；待 `apps/web` 创建后再增加 `dev:web` 等。
- **CI/文档**：中间层路径为 **apps/middleware**（如脚本、文档中的「middleware 目录」指 `apps/middleware`）。

---

## 六、相关文件

| 文件 | 说明 |
|------|------|
| `pnpm-workspace.yaml` | workspace 包列表（含 apps/*、packages/*） |
| `apps/README.md` | apps/ 目录用途说明 |
| `packages/README.md` | packages/ 目录用途说明 |
| `packages/tsconfig-base/` | 共享 TS 基础配置占位包 |
| `docs/FRONTEND_REACT_WEBPACK_MIGRATION.md` | 前端迁移方案（React+Webpack，可落于 apps/web） |
