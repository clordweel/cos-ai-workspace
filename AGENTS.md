# Agent 导航（AI 编码助手用）

本仓库为 **AI 驱动交互工作台** 的 monorepo：前端（Nuxt 3）、中间层（Fastify）、文档与日志。以下帮助 Agent 快速定位上下文，减少无关文件加载。

## 先读什么

| 目的 | 文件 |
|------|------|
| 架构与状态 | `docs/ARCHITECTURE.md`、`docs/PROJECT_STATUS.md` |
| 已废弃包（勿改勿引用） | `docs/DEPRECATED_PACKAGES.md` — frontend/、middleware/ 由 apps/web、apps/api 替代 |
| 认证与配置 | `docs/AUTH_AND_USER_CONFIG.md`、`docs/LOGTO_MATRIX_AUTH_FLOW.md` |
| 前端 | `.cursor/rules/frontend-spec.mdc`、`docs/FRONTEND_SPEC.md` |
| 前端视觉/UI 组件 | `docs/UI_DESIGN_SYSTEM.md`、`.cursor/rules/frontend-ui-design.mdc` |
| Matrix | `docs/MATRIX_INTEGRATION_STATUS.md`、`docs/MATRIX_CLIENT_BEST_PRACTICES.md`、`docs/MATRIX_JS_SDK_RESEARCH.md`（SDK 困境多角度调研）；**会话功能验证** `docs/MATRIX_SESSION_VERIFICATION.md`（middleware + apps/web 联调步骤与 `pnpm run dev:matrix`） |
| 前端迁移（Vue→React+Webpack） | `docs/FRONTEND_REACT_WEBPACK_MIGRATION.md` |
| Monorepo（apps/packages） | `docs/MONOREPO_APPS_PACKAGES.md` |
| 重构计划（阶段/步骤/技术栈确认） | `docs/REFACTOR_PLAN.md` |
| apps/web 组件源 | **coss 为最高优先级**；主界面已用 Frame/Empty 与 coss 对齐 |
| 验证 api 接口（仅本地） | `apps/api/scripts/README.md` — 本地测试脚本约定；涉及认证时可绕过或写明需求（如 Cookie 环境变量） |
| 其它 | 会话持久化 `SESSION_PERSISTENCE.md`；滚动参考 `CHAT_SCROLL_IMPROVEMENTS.md`；提交 `.cursor/rules/git-commit.mdc`；任务执行与提交 `.cursor/rules/task-execution.mdc`（下一步任务时先 commit、每步完成给检验方式与效果说明） |

## 目录与职责

- **apps/web/** — 当前前端（React + Webpack），对话流与任务卡片；不直连 Frappe/Dify，经 apps/api。
- **apps/api/** — 当前中间层（Fastify），SSE 流式、鉴权、聊天适配器（Matrix）、cos/物料 API。
- **frontend/** — **已废弃**。请勿修改或引用；仅作历史参考，由 apps/web 替代。
- **middleware/** — **已废弃**。请勿修改或引用；仅作历史参考，由 apps/api 替代。
- **docs/** — 架构、API、认证、前端规范等；先查 `PROJECT_STATUS.md`、`ARCHITECTURE.md`。研究/选型已归档至 `docs/archive/research/`、`docs/archive/mas/`。
- **.cursor/rules/** — 团队约定与 Agent 规则（全局、前端、提交、Agent 工作流等）。
- **.cursor/plans/** — 可保存的实现计划，供 Plan Mode 产出与复用。
- **.cursor/agents/** — 专用 Agent 能力（如 commit）。

## 工作流约定

- **Plan 优先**：大功能/多文件改动先用 Plan Mode（Shift+Tab），再编码；计划可存 `.cursor/plans/`。
- **动态上下文**：用 @ 引用具体文件或行、语义搜索、grep，避免整仓或大段粘贴。
- **单次会话 scope 单一**：例如只改 `apps/web` 或只改 `apps/api`；约 20+ 轮或新功能时新开会话，用 commit/PR 接棒。
- **Matrix 参考**：涉及 Matrix 时，允许从 Element、Cinny、FluffyChat 等开源客户端搜索参考方案。

详见 `.cursor/rules/agent-workflow.mdc` 与 `.cursor/rules/project-global.mdc`。
