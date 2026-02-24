# Monorepo 标准结构：apps/ 与 packages/

> 以 Element 等成熟项目为参考，采用 pnpm monorepo 标准目录 `apps/`、`packages/`。原 frontend、middleware 已移除，当前仅保留 apps/* 与 packages/*。最后更新：2026-02-24。

---

## 一、结论：已落地

- **当前结构**：pnpm workspace 仅包含 `apps/*` 与 `packages/*`；根目录 `pnpm run dev` 同时启动 apps/api 与 apps/web。
- **环境变量**：apps/api 与 apps/web 仅加载各自目录下的 `.env`，不读取根目录 `.env`。部署/开发时需在各 app 目录配置对应变量，见各目录 `.env.example`。

---

## 二、参考：Element 的约定

- **Element Web**（element-hq/element-web）采用 pnpm workspace，`packages: [".", "packages/*"]`。
- **本仓库**：`packages: ["apps/*", "packages/*"]`，无根目录应用包。

---

## 三、当前目录与职责

| 路径 | 说明 |
|------|------|
| **apps/** | 应用目录；**apps/api**（`@cosai/api`，当前后端）、**apps/web**（`@cosai/web`，当前前端）。 |
| **packages/** | 共享包目录；含 `packages/tsconfig-base` 等；可扩展 eslint-config、shared-types。 |

---

## 四、pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## 五、使用约定

- **引用共享包**：在 apps/* 的 `package.json` 中可添加依赖，例如 `"@cosai/tsconfig-base": "workspace:*"`。
- **根脚本**：`dev`、`dev:api`、`dev:web`、`dev:matrix`（同 dev）、`build:api`、`build:web`。
- **CI/文档**：前端路径为 `apps/web`，中间层路径为 `apps/api`。

---

## 六、相关文件

| 文件 | 说明 |
|------|------|
| `pnpm-workspace.yaml` | workspace 包列表 |
| `apps/README.md` | apps/ 目录用途说明 |
| `packages/README.md` | packages/ 目录用途说明 |
| `docs/REFACTOR_PLAN.md` | 重构阶段与步骤 |
| `docs/FRONTEND_REACT_WEBPACK_MIGRATION.md` | 前端迁移方案（已落于 apps/web） |
