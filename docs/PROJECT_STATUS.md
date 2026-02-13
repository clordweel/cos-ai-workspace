# 项目状态总览

当前状态与入口索引，便于上手与迭代。最后更新：2026-02-13。

---

## 1. 架构与数据流

| 维度 | 状态 | 说明 |
|------|------|------|
| **前端** | Vue 3 + Nuxt 3 + Tailwind + Shadcn-vue | 对话流 + 任务卡片，浅色主题（可深色）；不直连 Frappe/Dify |
| **中间层** | Node.js (Fastify) + TypeScript | SSE 流式、聊天适配器（mock/matrix）、Logto 鉴权、cos/物料 |
| **聊天后端** | 适配器驱动 | 当前注册：**mock**（默认）、**matrix**；Dify 适配器已移除，可后续扩展 |
| **认证** | Logto 唯一入口 | 前端可承载登录/回调（`/logto`、`/logto-callback`），中间层用 code 换 token 与 Cookie |
| **ERP** | ERPNext v16 + cos App | Headless，仅经中间层调用 cos REST API；写入路径：草稿 → 确认 → 权限校验 → 写入 |

详见 `docs/ARCHITECTURE.md`。

---

## 2. 前端

| 维度 | 状态 | 说明 |
|------|------|------|
| **布局** | workspace | `layouts/workspace.vue` + `useWorkspaceLayout`（grid、layoutMode）；会话区 + 应用区 |
| **会话页** | `pages/space/[[id]].vue` | 列表 + 聊天；会话/消息状态：`useChatSessions`、`useChatSessionsApi` |
| **应用区** | 标签式 | `useAppView`：tabs、currentView（`home` \| `contacts` \| `bots` \| `settings` \| `auth` \| `app`） |
| **认证** | 仅 Logto | `useAuth().login()` 跳转 Logto；未登录时可选强制打开「认证登录」标签；401 统一 `requireAuth()` |
| **权限** | 预留 | `usePermissions().can()`、`canAccessApp()`；后端 `/api/auth/me` 尚未返回 permissions |
| **扩展** | 应用扩展 | `useAppExtensions`、`types/app-extensions.ts`；首页卡片与侧栏标签；见 `docs/APP_EXTENSIONS.md` |
| **主题** | 浅色为主 | 可切换深色/跟随系统；`useTheme`、`theme.client.ts` |

目录与约定见 `docs/FRONTEND_SPEC.md`；鉴权见 `docs/FRONTEND_AUTH_AND_PERMISSIONS.md`。

---

## 3. 中间层

| 维度 | 状态 | 说明 |
|------|------|------|
| **语言** | TypeScript | `src/**/*.ts`，构建输出 `dist/`，dev 用 `tsx watch` |
| **适配器** | mock + matrix | `adapters/index.ts` 注册；`CHAT_PROVIDER` 默认 `mock`；无 Dify 注册 |
| **路由** | auth, chat, material, health, options | 认证、流式聊天、物料确认、健康、选项（另有 diagnostics API） |
| **配置** | 环境变量 | `config.ts` 读 `.env`；chat、matrix、cos、logto 等 |
| **会话** | Cookie | Logto 登录后写 Cookie；遗留 Frappe 登录/Token 路由（前端已不调用） |

Dify 相关：`services/difyStream.ts` 仍存在，供未来 Dify 适配器或编排使用；当前流式对话完全经适配器（mock/matrix）。

---

## 4. 认证与配置

| 维度 | 状态 | 说明 |
|------|------|------|
| **用户可见** | 仅 Logto | 前端唯一入口「登录」→ Logto；认证页可提供 Matrix 登录（用户名/邮箱/手机号+密码），需配置 `NUXT_PUBLIC_MATRIX_BASE_URL` |
| **中间层** | Logto + 保留 Frappe 接口 | `/api/auth/logto`、callback、/me、logout 已用；`GET /api/auth/me` 在 Logto 且配置 M2M 时附带 `preferences`；`PATCH /api/auth/me/preferences` 部分更新 Logto customData（先 GET 再合并再 PATCH）；POST login/token 仍在，未移除 |
| **Session** | 含 type、user、logtoSub、frappeSid/frappeToken 等 | 与 ERPNext 仍耦合；通用化见 `docs/archive/research/AUTH_GENERIC_LOGTO_DESIGN.md` |
| **系统配置** | 仅 env | 无独立配置库；Matrix 仅作聊天后端，不负责系统配置 |
| **用户配置** | Logto customData | 用户偏好（主题、字体档位、通知开关）存 Logto 自定义数据，经 Management API（M2M）读写；前端 `useUserPreferences()` 与 `GET/PATCH /api/auth/me(preferences)` 对接；未登录用本地/color-mode。**勿在 customData 存敏感信息** |
| **Matrix 同步** | 从 Logto 同步 | Logto 登录成功后中间层将用户同步到 Synapse（创建/更新）；所需变量见 `docs/AUTH_AND_USER_CONFIG.md`；Matrix 密码设置与修改流程见 `docs/LOGTO_MATRIX_AUTH_FLOW.md` |

详见 `docs/AUTH_AND_USER_CONFIG.md`、`docs/LOGTO_MATRIX_AUTH_FLOW.md`。

---

## 5. 文档与规则

| 类型 | 路径 | 用途 |
|------|------|------|
| **总览/架构** | `PROJECT.md`、`docs/ARCHITECTURE.md` | 技术栈、数据流、约束 |
| **认证与配置** | `docs/AUTH_AND_USER_CONFIG.md`、`docs/LOGTO_MATRIX_AUTH_FLOW.md` | Logto、用户偏好、Matrix 同步与密码 |
| **Matrix** | `docs/MATRIX_INTEGRATION_STATUS.md`、`docs/MATRIX_CLIENT_BEST_PRACTICES.md`、`docs/MIDDLEWARE_MATRIX_REVIEW.md` | 整合现状、最佳实践、中间层审查 |
| **前端** | `docs/FRONTEND_SPEC.md`、`docs/FRONTEND_AUTH_AND_PERMISSIONS.md`、`docs/APP_EXTENSIONS.md` | 布局与鉴权、扩展 |
| **前端视觉/UI** | `docs/UI_DESIGN_SYSTEM.md`、`.cursor/rules/frontend-ui-design.mdc` | 统一按钮/输入/圆角/颜色，Agent 与开发按同一风格开发组件 |
| **业务/安全** | `docs/API_SPEC.md`、`docs/STREAM_AND_SAFETY.md` | cos API、SSE 与写入安全 |
| **变更与规则** | `logs/CHANGELOG.md`、`.cursor/rules/*.mdc` | 变更记录、提交与前端规则 |
| **研究/选型归档** | `docs/archive/research/`、`docs/archive/mas/` | 配置与认证研究、会话选型、MAS 调研等 |

---

## 6. 与目标的偏差与待办

- **认证与 ERP 解耦**：中间层仍保留 Frappe 登录/Token 路由（前端已不调用）；业务依赖 cos 与 Session 凭证。通用化设计见 `docs/archive/research/AUTH_GENERIC_LOGTO_DESIGN.md`。
- **Dify**：无 Dify 适配器注册；若需可实现并注册，或由编排调用 `difyStream`。
- **用户/组织持久化**：无工作台独立数据库；若需见 `docs/archive/research/CONFIG_AND_AUTH_RESEARCH.md`。

---

## 7. 快速入口

- 新人：`PROJECT.md`、`ARCHITECTURE.md` → `README.md` 安装启动。
- 前端：`docs/FRONTEND_SPEC.md`、`.cursor/rules/frontend-spec.mdc`；鉴权 `frontend-auth.mdc`。
- 中间层：适配器 `adapters/`，配置 `config.ts`，路由 `routes/`。
- 提交：`.cursor/rules/git-commit.mdc`（type(scope): 描述）。
