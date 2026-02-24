# 项目阶段性梳理总结

> 用于阶段性彻底梳理与下一步清理、整理的单一入口。最后更新：2026-02-24。

---

## 一、项目定位与主栈（一句话）

**AI 驱动交互工作台**：前端（React + Webpack，`apps/web`）与中间层（Fastify，`apps/api`）经 SSE 流式对话、Logto 认证、Matrix 会话后端，对接 ERPNext/cos；**当前开发与运行以 apps/api + apps/web 为准**，原 frontend/middleware 已从仓库移除。

---

## 二、目录与职责

| 路径 | 状态 | 职责 |
|------|------|------|
| **apps/api** | ✅ 当前后端 | `@cosai/api`，鉴权、/api/auth/me、会话与聊天适配器（mock + matrix）、SSE 流式、用户偏好、Matrix 同步；端口 3000。 |
| **apps/web** | ✅ 当前前端 | `@cosai/web`，React 18 + Webpack 5，Workspace 布局、认证流、会话列表与聊天、Matrix Sync、应用区标签与设置；端口 3001。 |
| **packages/** | 共享包 | `tsconfig-base` 等；可扩展 shared-types、eslint-config。 |
| **docs/** | 文档 | 架构、状态、API、认证、Matrix、前端规范、重构计划等。 |
| **.cursor/rules/** | 规则 | 全局、前端、提交、工作流、产品化等 Agent 约定。 |
| **logs/** | 变更 | CHANGELOG.md 等。 |

---

## 三、重构阶段进度（REFACTOR_PLAN）

| 阶段 | 内容 | 状态 | 备注 |
|------|------|------|------|
| **0** | 技术栈确认与脚手架 | ✅ 完成 | apps/api、apps/web 可运行，根脚本 dev:api、dev:web。 |
| **1** | 新后端核心能力（鉴权、/me、健康） | ✅ 完成 | Logto 回调、Cookie、GET /api/auth/me。 |
| **2** | 新前端壳（认证、布局、路由、主题） | ✅ 完成 | /logto、/logto-callback、WorkspaceLayout、shadcn-ui、useTheme。 |
| **3** | 会话与聊天（列表、历史、SSE、适配器） | ✅ 完成 | mock + matrix 适配器，流式、错误态。 |
| **4** | Matrix 实时（Sync、typing、已读、构建） | ✅ 完成 | useMatrixSyncClient、WASM、/me 返回 Matrix 字段。 |
| **5** | 应用区、扩展、设置、任务卡片 | 🔶 部分完成 | 5.1 应用区标签、5.2 设置与偏好 ✅；**5.3 任务卡片、5.4 扩展** 待补齐。 |
| **6** | 切换流量、文档与运维收尾 | ⏳ 未开始 | 契约与回归、可选切换、文档与 CHANGELOG 收尾。 |

---

## 四、文档与规则索引（精简）

| 用途 | 文件 |
|------|------|
| 架构与数据流 | `docs/ARCHITECTURE.md` |
| 状态总览（多维度） | `docs/PROJECT_STATUS.md` |
| 本阶段总结与下一步 | `docs/PROJECT_PHASE_SUMMARY.md`（本文） |
| 重构阶段与步骤 | `docs/REFACTOR_PLAN.md` |
| Monorepo 与 env | `docs/MONOREPO_APPS_PACKAGES.md` |
| 认证与用户配置 | `docs/AUTH_AND_USER_CONFIG.md`、`docs/LOGTO_MATRIX_AUTH_FLOW.md` |
| Matrix 验证步骤 | `docs/MATRIX_SESSION_VERIFICATION.md` |
| 前端迁移方案 | `docs/FRONTEND_REACT_WEBPACK_MIGRATION.md` |
| 前端规范与 UI | `docs/FRONTEND_SPEC.md`、`docs/UI_DESIGN_SYSTEM.md`、`.cursor/rules/frontend-spec.mdc` |
| 提交与任务执行 | `.cursor/rules/git-commit.mdc`、`.cursor/rules/task-execution.mdc` |
| Agent 导航 | `AGENTS.md` |

---

## 五、已知技术债与待办（提炼）

- **认证与 ERP**：Session 仍含 frappeSid/frappeToken 等；通用化见 `docs/archive/research/AUTH_GENERIC_LOGTO_DESIGN.md`。
- **Dify**：未注册适配器；`services/difyStream.ts` 仍在，可后续扩展或编排。
- **用户/组织持久化**：无工作台独立库；若需见 `docs/archive/research/CONFIG_AND_AUTH_RESEARCH.md`。
- **E2EE**：仅做未加密主路径；创建加密房间、锁图标、Key Backup 等留待后续迭代，见 `docs/MATRIX_E2EE_PRINCIPLE_AND_PROJECT_STATUS.md`。
- **重构回归清单**：REFACTOR_PLAN 建议在 docs 或 .cursor/plans 维护「登录、/me、会话 CRUD、流式、Matrix Sync、设置、任务卡片」等勾选清单，**当前尚未单独建表**，建议在进入阶段 6 前补一份。

---

## 六、清理建议（已执行或待办）

- **根脚本、验证文档、PROJECT_STATUS、apps/README、废弃包**：已在分支 `chore/remove-deprecated` 中完成（dev = api+web，frontend/middleware 已移除，文档已更新）。
- **文档持续清理**：将 docs 中残留的 `frontend/`、`middleware/` 路径与「现 frontend/middleware」表述改为 **apps/web**、**apps/api** 或「原实现已移除，见 apps/web/apps/api」；迁移/历史类文档可保留上下文并加一句「当前实现为 apps/web、apps/api」。

---

## 七、下一步建议（优先级）

1. **补齐阶段 5 剩余**
   - **5.3**：任务卡片（物料确认等）与 POST /api/material/confirm 等对接，与设计/文档中的 TaskCard 对照。
   - **5.4**：应用扩展注册与入口，与 APP_EXTENSIONS 文档对照。

2. **建立重构回归清单**
   - 在 `docs/REFACTOR_REGRESSION_CHECKLIST.md` 或 `.cursor/plans/refactor-regression.md` 中列出：登录、GET /me、会话 CRUD、流式、Matrix Sync、设置与偏好、任务卡片、扩展；每阶段/每迭代勾选。

3. **阶段 6 准备**
   - 整理 apps/api 与原有 API 契约的差异；全量回归后再做流量切换与文档收尾。

---

## 八、快速命令参考

| 目的 | 命令 |
|------|------|
| 仅后端 | `pnpm run dev:api`（端口 3000） |
| 仅前端 | `pnpm run dev:web`（端口 3001，/api 代理到 3000） |
| 联调（推荐） | `pnpm run dev` 或 `pnpm run dev:matrix`（同时启动 api + web） |
| 构建 | `pnpm run build:api`、`pnpm run build:web` |
