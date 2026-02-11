# 项目状态总览

本文从**架构、前端、中间层、认证与配置、文档与规则**多维度梳理当前项目状态，便于新成员上手与后续迭代对齐。最后更新日期：2026-02-10。

---

## 1. 架构与数据流

| 维度 | 状态 | 说明 |
|------|------|------|
| **前端** | Vue 3 + Nuxt 3 + Tailwind + Shadcn-vue | 对话流 + 任务卡片，浅色主题（可深色）；不直连 Frappe/Dify |
| **中间层** | Node.js (Fastify) + TypeScript | SSE 流式、聊天适配器（mock/matrix）、Logto 鉴权、cos/物料/诊断 |
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
| **路由** | auth, chat, material, diagnostics, health, options | 认证（Logto 回调、/me、logout）、流式聊天、物料确认、诊断、健康、选项 |
| **配置** | 环境变量 | `config.ts` 读 `.env`；chat、matrix、dify、cos、logto、middlewarePublicOrigin 等 |
| **会话** | Cookie | Logto 登录后写 Cookie；仍保留 Frappe 登录/Token 路由实现，前端已不调用 |

Dify 相关：`services/difyStream.ts` 仍存在，供未来 Dify 适配器或编排使用；当前流式对话完全经适配器（mock/matrix）。

---

## 4. 认证与配置

| 维度 | 状态 | 说明 |
|------|------|------|
| **用户可见** | 仅 Logto | 前端唯一入口「登录」→ Logto；认证页可提供 Matrix 登录（用户名/邮箱/手机号+密码），需配置 `NUXT_PUBLIC_MATRIX_BASE_URL` |
| **中间层** | Logto + 保留 Frappe 接口 | `/api/auth/logto`、callback、/me、logout 已用；`GET /api/auth/me` 在 Logto 且配置 M2M 时附带 `preferences`；`PATCH /api/auth/me/preferences` 部分更新 Logto customData（先 GET 再合并再 PATCH）；POST login/token 仍在，未移除 |
| **Session** | 含 type、user、logtoSub、frappeSid/frappeToken 等 | 与 ERPNext 仍耦合；通用化见 `docs/AUTH_GENERIC_LOGTO_DESIGN.md` |
| **系统配置** | 仅 env | 无独立配置库；Matrix 仅作聊天后端，不负责系统配置 |
| **用户配置** | Logto customData | 用户偏好（主题、字体档位、通知开关）存 Logto 自定义数据，经 Management API（M2M）读写；前端 `useUserPreferences()` 与 `GET/PATCH /api/auth/me(preferences)` 对接；未登录用本地/color-mode。**勿在 customData 存敏感信息** |
| **Matrix 同步** | 从 Logto 同步 | Logto 登录成功后中间层将用户同步到 Synapse（创建/更新）；所需变量见 `docs/AUTH_AND_USER_CONFIG.md`；Matrix 密码设置与修改流程见 `docs/LOGTO_MATRIX_AUTH_FLOW.md` |

详见 **`docs/AUTH_AND_USER_CONFIG.md`**（原则、API、customData 约定、Matrix 同步配置）、**`docs/LOGTO_MATRIX_AUTH_FLOW.md`**（Matrix 密码流程）；另见 `docs/CONFIG_AND_AUTH_RESEARCH.md`、`docs/AUTH_GENERIC_LOGTO_DESIGN.md`。

---

## 5. 文档与规则

| 类型 | 路径 | 用途 |
|------|------|------|
| **总览** | `PROJECT.md` | 技术栈、仓库结构、核心要求 |
| **架构** | `docs/ARCHITECTURE.md` | 数据流、约束、适配器与认证 |
| **认证与用户配置** | `docs/AUTH_AND_USER_CONFIG.md` | Logto 统一认证、用户偏好 customData、API、Matrix 同步配置 |
| **Logto + Matrix 流程** | `docs/LOGTO_MATRIX_AUTH_FLOW.md` | Matrix 密码设置/修改、与 Logto 的关系 |
| **MAS 与 AS 调研** | `docs/MAS_AND_AS_RESEARCH.md` | MAS/Appservice 对改进 Matrix token 获取的可行性 |
| **前端** | `docs/FRONTEND_SPEC.md` | 布局、目录、视图、主题、扩展 |
| **鉴权** | `docs/FRONTEND_AUTH_AND_PERMISSIONS.md` | 免认证/需认证/分权限、usePermissions |
| **扩展** | `docs/APP_EXTENSIONS.md` | 应用扩展契约、注册、懒加载 |
| **API** | `docs/API_SPEC.md` | cos App REST 接口（物料、生产辅助） |
| **流式与安全** | `docs/STREAM_AND_SAFETY.md` | SSE、写入确认、权限校验 |
| **配置与认证研究** | `docs/CONFIG_AND_AUTH_RESEARCH.md` | 系统/用户配置、Matrix/Logto/ERP 角色、连接器与解耦建议 |
| **变更记录** | `logs/CHANGELOG.md` | 开发变更倒序 |
| **Cursor 规则** | `.cursor/rules/*.mdc` | project-global、frontend-spec、frontend-auth、git-commit、shadcn-vue-cli |

---

## 6. 与目标的偏差与待办

- **认证与 ERP 解耦**：中间层尚未移除 Frappe 登录/Token 及 session 中的 frappe 字段；业务（物料/诊断）仍直接依赖 cos 与 Session 的 Frappe 凭证。按 `AUTH_GENERIC_LOGTO_DESIGN.md` 需引入连接器、认证仅 Logto。
- **Dify**：当前无 Dify 适配器注册；若需 Dify 对话，可再实现适配器并注册，或由编排调用 `difyStream`。
- **用户/组织持久化**：当前无工作台独立数据库；若需工作台用户列表、组织树、连接器绑定、Session 持久化，需引入独立后端（见 `CONFIG_AND_AUTH_RESEARCH.md` §6）。

---

## 7. 快速入口

- 新人：先读 `PROJECT.md`、`docs/ARCHITECTURE.md`，再按 `README.md` 安装与启动。
- 改前端：遵循 `docs/FRONTEND_SPEC.md` 与 `.cursor/rules/frontend-spec.mdc`；鉴权见 `frontend-auth.mdc`。
- 改中间层：适配器在 `middleware/src/adapters/`；配置在 `config.ts`；路由在 `routes/`。
- 提交：遵循 `.cursor/rules/git-commit.mdc`（type(scope): 描述，scope 用目录名）。
