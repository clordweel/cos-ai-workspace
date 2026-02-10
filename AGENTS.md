# Agent 导航（AI 编码助手用）

本仓库为 **AI 驱动交互工作台** 的 monorepo：前端（Nuxt 3）、中间层（Fastify）、文档与日志。以下帮助 Agent 快速定位上下文，减少无关文件加载。

## 先读什么

| 目的 | 文件 |
|------|------|
| 整体架构与数据流 | `docs/ARCHITECTURE.md` |
| 当前状态与各模块说明 | `docs/PROJECT_STATUS.md` |
| 认证与用户配置（Logto、Matrix、偏好） | `docs/AUTH_AND_USER_CONFIG.md` |
| 会话持久化（重启保持认证） | `docs/SESSION_PERSISTENCE.md` |
| 前端布局与约定 | `.cursor/rules/frontend-spec.mdc`、`docs/FRONTEND_SPEC.md` |
| 提交规范 | `.cursor/rules/git-commit.mdc` |

## 目录与职责

- **frontend/** — Nuxt 3 + Vue 3，对话流与任务卡片；不直连 Frappe/Dify，经中间层。
- **middleware/** — Fastify，SSE 流式、鉴权、聊天适配器（mock/matrix）、cos/物料 API。
- **docs/** — 架构、API、认证、前端规范等；新需求先查 `PROJECT_STATUS.md` 与 `ARCHITECTURE.md`。
- **.cursor/rules/** — 团队约定与 Agent 规则（全局、前端、提交、Agent 工作流等）。
- **.cursor/plans/** — 可保存的实现计划，供 Plan Mode 产出与复用。
- **.cursor/agents/** — 专用 Agent 能力（如 commit）。

## 工作流约定

- **Plan 优先**：大功能/多文件改动先用 Plan Mode（Shift+Tab），再编码；计划可存 `.cursor/plans/`。
- **动态上下文**：用 @ 引用具体文件或行、语义搜索、grep，避免整仓或大段粘贴。
- **单次会话 scope 单一**：例如只改 `frontend` 或只改 `middleware`；约 20+ 轮或新功能时新开会话，用 commit/PR 接棒。

详见 `.cursor/rules/agent-workflow.mdc` 与 `.cursor/rules/project-global.mdc`。
