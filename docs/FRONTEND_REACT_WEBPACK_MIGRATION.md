# 前端迁移方案：Vue/Nuxt → React + Webpack

> 在「已决定前端改为 React、打包使用 Webpack」的前提下，给出迁移范围评估、技术选型与分阶段方案。最后更新：2026-02-15。

---

## 一、当前前端规模与依赖

### 1.1 技术栈（迁移前）

| 类别 | 当前 | 说明 |
|------|------|------|
| 框架 | Nuxt 4 + Vue 3 | 文件路由、布局、自动导入、SSR 可选 |
| 样式 | Tailwind 4 + @tailwindcss/vite | 设计令牌见 UI_DESIGN_SYSTEM.md |
| UI 组件 | shadcn-nuxt（Radix-vue、Reka-ui） | Button、Dialog、Select、Dropdown、Tooltip、Input、Checkbox、Slider、Empty、Accordion |
| 认证 | @logto/nuxt | 实际流程：/logto 跳 Logto → /logto-callback 收 code → 重定向到中间层 /api/auth/logto/callback 写 Cookie；用户态来自 GET /api/auth/me |
| 聊天/会话 | 自研 composables + 中间层 API | useChatSessions、useChatSessionsApi、useChatStream、useSpacePage、useSpaceChatPane |
| 实时 | matrix-js-sdk（仅前端 Sync） | useMatrixSyncClient、useMatrixClient；Vite 下 CJS/ESM 需 optimizeDeps 修补 |
| 状态 | 全局 ref + composables | useAppView、useWorkspaceLayout、useAuth、useUserPreferences 等 |
| 其它 | @vueuse/core、@tanstack/vue-virtual、markdown-it、dompurify、lucide-vue-next | 虚拟列表、Markdown、图标 |

### 1.2 规模（约）

- **文件数**：约 150+（.vue、.ts、.tsx），含约 50+ 业务/布局组件、30+ UI 原子组件（shadcn）、20+ composables。
- **路由**：`/`、`/space`、`/space/[[id]]`、`/logto`、`/logto-callback` 及可能的扩展。
- **核心能力**：workspace 布局（会话区 + 应用区）、会话列表与聊天、SSE 流式、Matrix Sync/typing/已读/E2EE、应用标签与扩展、主题与用户偏好、任务卡片（如物料确认）。

---

## 二、迁移后技术选型建议

### 2.1 核心栈

| 类别 | 建议 | 说明 |
|------|------|------|
| 框架 | **React 18+** + TypeScript | 与现有中间层 API、类型定义兼容 |
| 路由 | **React Router v6** | 声明式路由，替代 Nuxt 文件路由 |
| 构建 | **Webpack 5** | 已明确要求；matrix-js-sdk 在 Webpack 下 CJS 兼容性优于 Vite，可减轻 optimizeDeps 类问题 |
| 样式 | **Tailwind CSS** | 保留；设计令牌与 UI_DESIGN_SYSTEM.md 延续，仅把类名从 Vue 模板迁到 JSX |
| UI 组件 | **shadcn-ui（React）** | Radix React 系，与当前 shadcn-vue 的 variant/size 语义对齐，便于 1:1 替换 Button/Dialog/Select 等 |

### 2.2 状态与数据

| 用途 | 建议 | 说明 |
|------|------|------|
| 全局 UI 状态 | **Zustand** 或 **React Context + useReducer** | 会话列表、当前 chatId、应用区开关、标签栈等（对应 useChatSessions、useAppView、useWorkspaceLayout） |
| 认证与用户 | **Context + 单次 fetch** 或 **Zustand** | 与现有「GET /api/auth/me + Cookie」一致；可先不引入 @logto/react，保留「/logto、/logto-callback 仅做跳转 + 中间层写 Cookie」 |
| 服务/副作用 | **自定义 Hooks** | 对应现有 composables：useChatStream、useMatrixSyncClient、useApiBase 等 |
| 服务端/环境 | **import.meta.env** 或 **process.env** | 由 Webpack DefinePlugin / dotenv 注入，替代 useRuntimeConfig().public |

### 2.3 认证（延续现有设计）

- **登录入口**：保留 `/logto` 页面，在 React 中改为「挂载后重定向到 Logto OIDC URL」（与当前 logto.vue 逻辑一致）。
- **回调**：保留 `/logto-callback`，收到 `code` 后重定向到同源 `GET /api/auth/logto/callback?code=...&redirect_uri=...`，由中间层写 Cookie；**不要求**在前端使用 @logto/react，用户信息仍通过 `GET /api/auth/me`（credentials: 'include'）获取。
- **若后续需要**在前端直接使用 id_token 或 Logto 提供的 React 能力，再引入 **@logto/react** 并调整回调与 /me 的职责划分。

### 2.4 Matrix 与构建

- **matrix-js-sdk**：继续在前端使用；**Webpack 5** 对 CJS 依赖更友好，可显著减少或取消当前在 Vite 下为 matrix-js-sdk 维护的 `optimizeDeps.include` / `exclude`（WASM 仍须按官方/Element 方式配置，避免 WASM 被错误打包）。
- 业务逻辑（useMatrixSyncClient 等价）可迁移为 **React Hooks**（如 `useMatrixSyncClient`），事件与状态用 useState/useEffect 或 Zustand 连接。

### 2.5 不迁移或可替换

- **@logto/nuxt** → 无需对等替换；用普通 React 页面 + 中间层回调即可。
- **Nuxt Layout / NuxtPage** → React Router `<Outlet />` + 布局组件。
- **radix-vue / reka-ui** → **Radix UI (React)** 或 **shadcn-ui** 的 React 版。
- **@tanstack/vue-virtual** → **@tanstack/react-virtual**（同一生态，API 相似）。

---

## 三、分阶段迁移方案

### 阶段 0：React + Webpack 脚手架（约 1–2 天）

- 在仓库中新建 **frontend-react**（或临时目录，待稳定后替换 frontend），避免与现有 Nuxt 并行开发时冲突。
- 初始化：**Create React App (CRA)** 或 **自定义 Webpack 5 + React**（若 CRA 已不维护，可用 **Vite + React** 再在后续替换为 Webpack，或直接 Webpack 模板）。
- 配置：TypeScript、Tailwind、环境变量（REACT_APP_* 或自定义前缀）、代理到中间层（如 `/api` → `http://localhost:3000`）。
- 路由：React Router 6，先占位 `/`、`/space`、`/space/:id`、`/logto`、`/logto-callback`。
- **产出**：可运行的空壳 React 应用，能访问上述路由并代理 /api。

### 阶段 1：核心壳（布局、认证、API、主题）（约 3–5 天）

- **布局**：实现 **WorkspaceLayout**（会话区 + 应用区网格），从 `useWorkspaceLayout` 的 layoutMode / grid 逻辑用 React state 或 Zustand 复刻；提供「会话区是否展开」等给子组件（props 或 Context）。
- **认证**：
  - 实现 **GET /api/auth/me** 的 Hook（如 `useAuth`），存 isAuthenticated、user、userId、preferences、matrixSyncToken、matrix_base_url、matrix_user_id、matrix_device_id 等；与现有 useAuth 字段对齐。
  - 实现 **/logto**、**/logto-callback** 页面（逻辑与现有 Vue 一致）；未登录时可选重定向到 /logto 或展示「打开登录」入口。
- **API 基址**：从环境变量读取并导出，供后续 useChatSessions、useChatStream 等使用。
- **主题**：浅色/深色/跟随系统，与 useTheme、useUserPreferences 行为一致；可沿用 class 或 data-theme，并保留与 UI_DESIGN_SYSTEM 一致的令牌。
- **产出**：登录流程可走通、/me 数据可用、布局骨架与主题可切换。

### 阶段 2：应用区与导航（约 3–4 天）

- **useAppView 等价**：标签列表（tabs）、currentView（home | contacts | bots | settings | auth | app）、isPanelOpen、isContentVisible、侧栏固定/悬停逻辑；用 Zustand 或 Context 实现。
- **WorkspaceAppNav**：侧栏折叠/展开、悬停延迟、固定按钮、导航项与扩展入口。
- **AppPanel**：按 currentView 切换首页/联系人/机器人/设置/认证/扩展；先做占位页，内容可后续补齐。
- **产出**：从 Vue 的「应用区 + 标签 + 侧栏」行为可在 React 中复现。

### 阶段 3：会话列表与聊天（约 5–7 天）

- **会话状态**：useChatSessions 等价（会话列表、当前 chatId、消息列表、appendMessage、setMessages、ensureChat 等）→ Zustand store 或 Context + Hooks。
- **API 层**：useChatSessionsApi（listSessions、getMessages、createSession 等）→ 普通 async 函数或 Hook，请求带 credentials: 'include'。
- **流式**：useChatStream（POST /api/chat/stream、SSE 解析、打字机）→ React Hook，状态与 UI 绑定。
- **页面**：Space 页（会话列表 + 聊天主区）、ChatPane（消息列表 + 输入框）、ChatMessageBubble、空态与顶栏。
- **产出**：可创建会话、拉历史、发消息并看到流式回复。

### 阶段 4：Matrix Sync（约 3–4 天）

- **useMatrixSyncClient 迁移**：用 React Hooks 包装 matrix-js-sdk 的 createClient、startClient、ClientEvent、RoomEvent；状态（syncReady、invitedRoomsFromSync、incomingCall）用 useState 或 Zustand；保留 TimelineRefresh、fillMessagesFromSyncTimeline、sendTyping、sendReadReceipt 等逻辑。
- **E2EE**：保留 deviceId + initRustCrypto、cryptoDatabasePrefix 及解密后刷新时间线；在 Webpack 中按官方/Element 方式配置 WASM。
- **产出**：实时新消息、typing、已读、来电条、加密房间解密后刷新可工作。

### 阶段 5：任务卡片、扩展、设置与收尾（约 4–6 天）

- **任务卡片**：物料确认等卡片组件由 Vue 改为 React，与 POST /api/material/confirm 等接口对接。
- **应用扩展**：useAppExtensions、扩展注册与标签打开逻辑在 React 中复刻。
- **设置与用户偏好**：useUserPreferences、PATCH /api/auth/me/preferences；设置页表单与主题/字体/通知等选项。
- **联系人/机器人**：列表与占位内容。
- **邀请/会话管理**：邀请列表、接受/拒绝、删除会话、重命名等（若当前有对应 API）。
- **产出**：功能与当前 Vue 版本对齐，可下线旧 frontend 或切换构建入口。

### 阶段 6：清理与交付（约 2–3 天）

- 删除或归档原 **frontend**（Vue/Nuxt）；或将 **frontend-react** 更名为 **frontend**，并更新根目录 package.json、CI、文档中的前端路径。
- 更新 **docs/PROJECT_STATUS.md**、**docs/ARCHITECTURE.md**、**docs/FRONTEND_SPEC.md** 为 React + Webpack；更新 **.cursor/rules** 中前端相关规则（如 frontend-spec.mdc、frontend-ui-design.mdc）。
- 回归：登录、会话 CRUD、流式对话、Matrix 实时、主题、设置、任务卡片、扩展入口。

---

## 四、风险与应对

| 风险 | 应对 |
|------|------|
| **Webpack 配置复杂** | 优先用 CRA 或社区 React+Webpack 模板起步；Tailwind、Router、env 按文档配置；matrix-js-sdk 与 WASM 参考 Element 或官方示例。 |
| **状态分散** | 在阶段 1 就确定「Zustand 还是 Context」并统一；把原 composables 与 store 的对应关系列成表，避免漏迁。 |
| **Logto 行为差异** | 保持「前端只做跳转 + 中间层写 Cookie」不改；若未来接入 @logto/react，再单独评估回调与 /me 的职责。 |
| **Matrix WASM** | Webpack 下 WASM 需正确 copy/rule；参考 matrix-js-sdk 与 Element 的 Webpack 配置，避免 404 或 CJS 错误。 |
| **UI 细节差异** | 严格按 UI_DESIGN_SYSTEM.md 的令牌与组件约定实现；shadcn-ui React 与 shadcn-vue 的 API 略有差异，需逐组件对照。 |
| **SSR 缺失** | 若当前 Nuxt 未强依赖 SSR，迁移为 SPA 即可；若需 SEO/首屏，后续可考虑 Next.js 或预渲染。 |

---

## 五、工作量粗估

| 阶段 | 内容 | 人天（约） |
|------|------|------------|
| 0 | React + Webpack 脚手架、路由、Tailwind、代理 | 1–2 |
| 1 | 布局、认证、/me、主题、API 基址 | 3–5 |
| 2 | 应用区、标签、侧栏、AppPanel 占位 | 3–4 |
| 3 | 会话列表、聊天、SSE 流式、消息 UI | 5–7 |
| 4 | Matrix Sync Hook、E2EE、typing/已读/来电 | 3–4 |
| 5 | 任务卡片、扩展、设置、联系人/机器人、邀请等 | 4–6 |
| 6 | 文档与规则更新、回归、替换/归档旧 frontend | 2–3 |
| **合计** | | **约 21–31 人天** |

实际可根据「是否先做 MVP（仅会话+流式+基础布局）」压缩阶段 2/5 部分内容，或并行开发以缩短日历时间。

---

## 六、建议执行顺序与文档

1. **先定目录策略**：新开 `frontend-react` 与现有 `frontend` 并存，待稳定后再替换；或直接新分支重写 `frontend`，旧版打 tag 备份。
2. **先做阶段 0–1**：保证能登录、能拿到 /me、布局与主题可用，再推进会话与 Matrix。
3. **Composables → Hooks/Store 映射表**：在迁移前列一表（如 useAuth → useAuth + AuthContext；useChatSessions → useChatSessionsStore），便于不遗漏且便于多人分工。
4. **中间层与 API 不变**：迁移期间保持现有 /api/* 与 Cookie 鉴权不变，仅前端技术栈替换。
5. **文档**：本方案写入 **docs/FRONTEND_REACT_WEBPACK_MIGRATION.md**；阶段完成后在 **logs/CHANGELOG.md** 与 **docs/PROJECT_STATUS.md** 中更新前端技术栈说明。

---

## 七、相关文件

| 主题 | 文件 |
|------|------|
| 当前前端规范 | `docs/FRONTEND_SPEC.md`、`docs/UI_DESIGN_SYSTEM.md` |
| 认证与用户 | `docs/AUTH_AND_USER_CONFIG.md` |
| Matrix 与 SDK | `docs/MATRIX_INTEGRATION_STATUS.md`、`docs/MATRIX_JS_SDK_RESEARCH.md` |
| 项目状态 | `docs/PROJECT_STATUS.md`、`docs/ARCHITECTURE.md` |
