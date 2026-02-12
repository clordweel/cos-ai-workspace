# 开发变更记录 (Development Changelog)

记录 AI 工作台项目的主要开发变更，按时间倒序。

---

## 2026-02-12

### 方案 A：禁用 MAS 回退纯 Synapse

- **deploy/matrix**：新增 `nginx-no-mas.conf`、`docker-compose.no-mas.yml`、`disable-mas.sh`。执行 `./disable-mas.sh` 并切换 compose 后，login/logout/refresh 直接转 Synapse，实现原生密码认证。
- **文档**：`README.md` 方案 A 步骤更新；`.env.example` 注明 MAS 禁用时勿配置 `MAS_ADMIN_*`。

### Matrix 密码持久化到 Logto

- **middleware**：配置 `MATRIX_PASSWORD_ENCRYPTION_KEY`（32+ 字符）时，Matrix 密码经 AES-256-GCM 加密后存入 Logto customData（`matrixPasswordEncrypted`），需 M2M。
- **matrixPasswordStore**：读时优先 Redis/内存，未命中则从 Logto 拉取并回填；写/删时同步 Logto。
- **config**：新增 `matrixPasswordEncryptionKey`。
- **文档**：`AUTH_AND_USER_CONFIG.md`、`LOGTO_MATRIX_AUTH_FLOW.md` 更新 customData 约定与 token 获取说明。

---

## 2026-02-10

### Agent 2026 最佳实践：工作流与结构优化

- **规则与导航**：新增 `.cursor/rules/agent-workflow.mdc`（Plan 优先、动态上下文、约 20 轮或新功能时新会话）；根目录新增 `AGENTS.md` 供 AI 快速定位架构/状态/文档与工作流约定；新增 `.cursor/plans/` 与 README，用于存放 Plan Mode 产出的实现计划。
- **项目规则**：`project-global.mdc` 增加「代码结构（便于 Agent 导航）」：单文件约 300 行内、文件名语义化、相关文件就近放置。
- **中间层 auth 拆分**：`services/auth.ts` 拆为 `auth/sessionStore.ts`（会话存储与 Cookie）、`auth/frappeLogin.ts`（用户名密码/Token 登录）、`auth/logto.ts`（Logto SSO 与 Matrix 同步），入口 `auth.ts` 仅 re-export，便于按需阅读与修改。
- **前端**：`useAppView` 的类型与常量抽至 `composables/useAppViewConstants.ts`，控制单文件行数；新增 `.cursor/plans/split-space-page.md` 作为后续拆分 `pages/space/[[id]].vue`（约 920 行）的参考计划。

### Space 页拆分（split-space-page 计划执行）

- **composables**：新增 `useSpaceSessionList.ts`（列表 Tab、搜索、置顶、Mock、应用抽屉）、`useSpaceChatPane.ts`（消息、虚拟滚动、流式发送、导出与单条消息操作）、`useSpacePage.ts`（组合二者 + 路由/注入/生命周期）。
- **页面**：`pages/space/[[id]].vue` 瘦身为「模板 + definePageMeta + useSpacePage() 解构 + style」，约 296 行；逻辑全部迁入上述 composable，单文件符合约 300 行内约定。

### 会话多用户支持

- **中间层**：会话/消息/流式发送按「当前用户」隔离。`userId` 优先从 Cookie 会话推导（`getStableUserId(session)`：Logto 用 `logtoSub`，Frappe/Token 用 `user`），无会话时使用 body/query 的 `user_id` 或 `'default'`。`GET /api/auth/me` 增加返回字段 `userId`。
- **auth**：新增 `getStableUserId(session)`；`/api/auth/me` 返回 `userId` 供前端与多用户逻辑使用。
- **chat 路由**：`GET /api/sessions`、`GET /api/sessions/:id/messages`、`POST /api/chat/stream` 均通过 `resolveUserId(req)` 得到 `userId` 并传入适配器，不再仅依赖前端传入的 `user_id`。
- **Mock 适配器**：按 `userId` 隔离会话与消息；每个用户独立会话列表与消息历史；`streamMessage` 无 `sessionId` 时为该用户创建新会话并写入消息。
- **前端**：`useAuth` 增加只读 `userId`（由 `/api/auth/me` 的 `userId` 同步）；`useChatSessionsApi` 的 `loadSessions`/`loadSessionMessages` 与 `useChatStream` 的 `streamChat` 在未显式传 `userId` 时使用当前登录用户的 `userId`，请求均带 `credentials: 'include'` 以便中间层从 Cookie 识别用户。
- **说明**：Matrix 适配器仍为单 bot 账号，`listSessions` 返回该 bot 的全体房间，暂未按应用用户隔离；后续可做「每用户 Matrix 凭证」或「房间归属标记」实现真正多用户 Matrix。

---

## 2026-02-09

### Nuxt 承载 Logto 认证：登录与回调走前端主地址

- **前端**：新增 `/logto`（发起登录，302 到 Logto）、`/logto-callback`（接收 code 后 302 到中间层换 token）；`useAuth().login()` 改为跳转当前页同源 `/logto`。需配置 `NUXT_PUBLIC_LOGTO_ENDPOINT`、`NUXT_PUBLIC_LOGTO_APP_ID`（与中间层一致，不包含 secret）。
- **中间层**：`GET /api/auth/logto/callback` 支持 query 参数 `redirect_uri`；当由 Nuxt 回调带入时，用该 `redirect_uri` 向 Logto 换 token，并依其 origin 做最终 302。保留无 `redirect_uri` 时的原有行为（中间层直接回调）。
- **Logto**：Nuxt 承载时在控制台 Redirect URIs 填「前端主地址」如 `https://yourapp.com/logto-callback` 或 `http://localhost:3001/logto-callback`。反向代理同域时用户全程只接触前端域名。
- **文档**：`.env.example` 与 `docs/REVERSE_PROXY_SINGLE_DOMAIN.md` 已区分「Nuxt 承载」与「中间层直接回调」两种配置方式。

### 前端：认证通用化，仅保留 Logto 唯一入口

- **useAuth**：移除 `loginWithPassword`、`loginWithToken`；唯一登录方式为 `login()`，跳转中间层 `GET /api/auth/logto`（Logto 授权后回调回前端）。注释改为「项目唯一认证入口为 Logto」。
- **认证面板**：应用区「认证登录」标签内不再展示账号密码 / Token / 单点登录 三选一；未登录时仅展示说明与一个「登录」按钮，点击即调用 `login()`；已登录仍展示当前用户与退出按钮。Logto 回调错误继续通过 `auth_error` 查询参数展示。
- **文档**：设计见 `docs/AUTH_GENERIC_LOGTO_DESIGN.md`；`docs/FRONTEND_AUTH_AND_PERMISSIONS.md` 已引用。中间层尚未移除 POST /api/auth/login、/api/auth/token 前，前端已不再调用。

---

## 2026-02-08

### 前端：应用区扩展标准化

- **扩展注册与类型**：新增 `types/app-extensions.ts`（`AppExtension` 接口）、`composables/useAppExtensions.ts`（`register`/`unregister`/`list`/`get`/`has`），支持第三方或项目内注册工作台应用。
- **视图与标签**：`useAppView` 增加视图类型 `'app'`；标签可带 `view: 'app'` 与 `appId`，标题与扩展名从注册表解析。
- **首页与内容区**：首页应用卡片改为基于 `useAppExtensions().list` 渲染，点击打开 `addTab('app', ext.id)`；`AppPanel` 在 `currentView === 'app'` 时渲染扩展的根组件，未注册时显示占位提示。
- **侧栏图标**：`WorkspaceAppNav` 对扩展标签从 `useAppExtensions().get(tab.appId)?.icon` 取图标。
- **内置占位**：`plugins/app-extensions.client.ts` 注册物料助手、订单进度、BOM 状态、库存概览四个占位应用，使用 `AppPlaceholder.vue`；可后续替换为真实组件。
- **文档**：`docs/APP_EXTENSIONS.md` 编写扩展开发指南（契约、类型、注册方式、根组件约定、懒加载示例）。

### 中间层：TypeScript 重构

- **全量 TypeScript**：middleware 源码由 JavaScript 迁移为 TypeScript（`src/**/*.ts`、`scripts/release-port.ts`），新增 `tsconfig.json`（target ES2022、module NodeNext、strict）。
- **类型与契约**：`adapters/types.ts` 定义 `NormalizedSession`、`NormalizedMessage`、`ChatBackendAdapter` 等接口；config、services、routes 补充入参与返回值类型。
- **构建与脚本**：`pnpm run build` 输出到 `dist/`；`pnpm run dev` 使用 `tsx watch` 直接运行 `src/index.ts`；`pnpm start` 运行 `node dist/src/index.js`；`predev`/`release-port` 使用 `tsx scripts/release-port.ts`。
- **测试**：`pnpm test` 先 build 再运行，用例改为引用 `dist/` 下编译产物；所有既有测试通过。
- **依赖**：devDependencies 增加 `typescript`、`tsx`、`@types/node`。

### 适配器：移除 Dify 实现、默认 Mock、自动化测试

- **保留适配器模式**：`adapters/types.js`、`adapters/index.js` 与路由的适配器驱动逻辑不变。
- **移除 Dify 适配器实现**：删除 `adapters/dify.js`，不再注册 `dify` provider；`POST /api/chat/stream` 仅通过适配器处理，无 Dify 直连回退。
- **默认 Mock 适配器**：新增 `adapters/mock.js`，实现流式发送（模拟逐字回复）、listSessions、listMessages，无外部依赖；`config.chat.provider` 默认改为 `mock`，便于功能调试。
- **自动化测试**：新增 `test/adapters/mock.test.js`、`test/adapters/getAdapter.test.js`、`test/routes/chat.test.js`，使用 Node 内置 `node:test`；`pnpm run test` 以 `CHAT_PROVIDER=mock` 运行，覆盖 Mock 适配器能力与 GET /api/sessions、GET /api/sessions/:id/messages、POST /api/chat/stream、export-markdown。
- **文档**：middleware README 补充 CHAT_PROVIDER、adapters、测试说明；.env.example 默认 mock；DIFY_ADAPTER_ACCEPTANCE 注明当前无 Dify 适配器、供后续重新接入时验收。

### 会话消息标准化与 Dify 适配器（多后端扩展）

- **标准化模型与适配器接口**：中间层新增 `adapters/types.js`（NormalizedSession、NormalizedMessage、ChatBackendAdapter 契约）、`adapters/index.js`（getChatAdapter、按 config.chat.provider 选择适配器）。
- **Dify 适配器**：`adapters/dify.js` 实现流式发送（复用 difyStream.runStreamWithParams）、GET 会话列表（Dify /conversations）、GET 会话历史（Dify /messages），并映射为统一模型；`services/difyStream.js` 抽离 `runStreamWithParams`/`consumeStream` 供适配器与原有路由共用。
- **配置与路由**：`config.chat.provider`（默认 `dify`，可选 `CHAT_PROVIDER`）；`POST /api/chat/stream` 改为适配器驱动（有适配器则调用 adapter.streamMessage，否则回退到原 runStream）；新增 `GET /api/sessions`、`GET /api/sessions/:id/messages`（501 当后端不支持）。
- **前端**：`useChatSessions` 增加 `setChatUpdatedAt`；新增 `useChatSessionsApi`（loadSessions、loadSessionMessages），拉取后合并到现有会话状态；会话页进入时拉取会话列表、进入后端会话 id（UUID）且无消息时拉取历史，均静默降级。
- **文档**：`.env.example` 增加 `CHAT_PROVIDER` 说明；可行性见 `docs/SESSION_MESSAGE_ABSTRACTION_FEASIBILITY.md`。

### 中间层：彻底解决 3000 端口断联后无法复用

- **listen 启用 reuseAddress**：`app.listen()` 增加 `reuseAddress: true`，使端口在进程退出后（含 TIME_WAIT）可被快速复用，减少「Address already in use」。
- **启动前自动释放端口**：新增 `scripts/release-port.js`，读取与中间层相同的 `PORT`/.env，用 `lsof -ti :PORT` 查找并 SIGTERM 占用进程；`predev` 钩子在执行 `pnpm run dev` 前自动运行该脚本，确保每次开发启动前 3000 端口已释放。
- **手动释放**：需要单独释放端口时可执行 `pnpm run release-port` 或 `node scripts/release-port.js`（支持 `PORT=3000`）。

---

## 2026-02-07

### 前端 + 中间层：认证登录

- **应用区认证登录应用**：新增「认证登录」视图（`auth`），支持三种方式：用户名与密码、Token（api_key:api_secret）、Logto 单点登录；认证信息由中间层 Cookie 保持（httpOnly，3 天）。
- **认证前不可关闭**：未登录时自动打开认证标签且该标签不可关闭；登录后或从抽屉主动打开的认证标签可关闭。`useAppView` 增加 `openAuthTab()`、标签 `isAuthRequired`，`WorkspaceAppNav` 在未登录时对认证标签隐藏关闭按钮。
- **需认证时跳转**：对话流、系统诊断、物料确认等接口需登录；未带有效 Cookie 时中间层返回 401，前端 `useAuth().requireAuth()` 打开认证应用。所有相关 fetch 增加 `credentials: 'include'`。
- **中间层**：`@fastify/cookie`、`routes/auth.js`（POST /api/auth/login、/api/auth/token，GET /api/auth/me、/api/auth/logto、/api/auth/logto/callback，POST /api/auth/logout）；`services/auth.js` 实现 Frappe 用户名密码登录、Token 校验、Logto OAuth 回调与会话存储；诊断/聊天/物料路由校验 Cookie，无会话则 401；物料确认使用当前会话的 Frappe 认证调用 cos。
- **前端**：`composables/useAuth.ts`（fetchUser、loginWithPassword、loginWithToken、loginWithLogto、logout、requireAuth）；布局 workspace 挂载时拉取当前用户，未登录则打开认证标签；处理 `?auth=ok` / `?auth_error`（Logto 回调）。应用抽屉增加「认证登录」入口。

### 前端：应用侧边栏改为浏览器标签式

- **useAppView**：用「标签列表」+「当前标签」替代原 appStack；新增 `tabs`、`activeTabId`、`addTab`、`closeTab`、`switchTab`，保留 `openPanel`、`openNavPage`、`closePanel` 等，打开视图时新增或切换对应标签。
- **WorkspaceAppNav**：侧栏改为展示已打开标签（图标 + 标题 + 悬停显示关闭按钮），点击标签切换、点击 × 关闭；底部固定「新标签」「设置」按钮，新标签打开首页、设置打开/切换到设置标签。
- **行为**：默认一个「首页」标签；关闭最后一个标签时收起应用区；从会话页抽屉打开联系人/机器人等仍会新增对应标签。

### 前端需求梳理与中间层重构

- **需求文档**：新增 `docs/FRONTEND_API_REQUIREMENTS.md`，梳理 frontend 对中间层的三类 API（流式对话、物料确认、导出 Markdown）。
- **中间层分层重构**：保留 Fastify，按业务拆分目录：`src/config.js` 环境与常量；`src/lib/thinkingParser.js` 思考块解析；`src/services/difyStream.js`、`cosClient.js`、`exportMarkdown.js` 业务逻辑；`src/routes/health.js`、`chat.js`、`material.js` 路由注册；入口 `src/index.js` 仅挂载与启动。
- **POST /api/material/confirm**：实现对接 cos `create_from_draft`。从环境读取 `COS_ERP_BASE`、`COS_ERP_API_KEY`，POST 到 cos 并返回 `item_code`/`item_name`/`name`；未配置时返回 503。
- **POST /api/chat/export-markdown**：由中间层实现，Body `{ messages }` 返回 `{ markdown }`；前端导出改为请求 `apiBase + '/api/chat/export-markdown'`，删除 `frontend/server/api/chat/export-markdown.post.ts`，失败时仍使用前端本地 `messagesToMarkdown` 兜底下载。

### 中间层：优雅退出

- **http-graceful-shutdown**：引入 `http-graceful-shutdown`，在 SIGINT/SIGTERM/SIGHUP 时停止接收新连接、等待进行中请求（含 SSE 流）结束后再执行 Fastify `onClose` 并退出。
- **配置**：支持环境变量 `SHUTDOWN_TIMEOUT_MS`（默认 15000ms）控制最大等待时间；`NODE_ENV=development` 时使用快速关闭。

### 根仓库：pnpm workspace 改造

- **pnpm workspace**：新增 `pnpm-workspace.yaml`，将 `frontend`、`middleware` 纳入统一 workspace；根目录一条 `pnpm install` 安装全仓库依赖，生成单一 `pnpm-lock.yaml`。
- **根 package.json**：`install:all` 改为 `pnpm install`；`dev:middleware` / `dev:frontend` / `build:*` 改为通过 `pnpm --filter <包名> run <script>` 执行，不再 `cd` 子目录。
- **锁文件**：移除根与子项目中的 `package-lock.json`，`.gitignore` 增加 `package-lock.json` 避免误提交；后续统一使用 pnpm。
- **README**：环境准备与启动说明更新为 pnpm 与 filter 用法。

### 前端：Shadcn 风格组件与源码清理

- **UI 组件**：新增 `components/ui/checkbox/Checkbox.vue`（基于 radix-vue CheckboxRoot + CheckboxIndicator），与现有 Select 风格一致；设置页「通知」由原生 `<input type="checkbox">` 改为该 Checkbox 组件。
- **废弃与移除**：删除未再引用的 `ChatFlow.vue`、`WorkspaceSessionList.vue`；删除冗余页面 `pages/list.vue`（由 `index.vue` 的 `?app=` query 处理跳转）。
- **文档与结构**：`README.md` 与 `docs/FRONTEND_SPEC.md` 更新为当前目录与命名约定；FRONTEND_SPEC 增补「命名与组织约定」与「废弃与清理」说明。

---

## 2026-02-06

### 前端：完全移除悬浮胶囊

- **会话顶栏**：已完全移除此前仿灵动岛的 sticky 悬浮胶囊；会话区顶栏改为常规固定顶栏（如 space 页有 chatId 时的顶栏：返回 + 标题），无悬浮胶囊样式。

---

## 2026-02-05

### 前端：应用化联系人与机器人

- **联系人 / 机器人改为应用区子应用**：不再跳转独立列表页 `/list`，改为在右侧应用区切换视图。
- 新增 **`useAppView`**：`currentView`（`home` | `contacts` | `bots`），`setView()` 切换应用区内容。
- **AppPanel**：支持三种视图——应用首页（物料/订单/BOM/库存等）、联系人应用、机器人应用；子应用顶栏提供「返回应用首页」。
- 会话列表左侧「联系人」「机器人」改为**快捷入口**：点击仅切换右侧应用视图；在应用内再点击某条进入 `/chat/contact-xx` 或 `/chat/bot-xx`。
- **`/list`**：保留为兼容入口，重定向至 `/?app=contacts` 或 `/?app=bots`。
- 首页支持 `?app=contacts` / `?app=bots` 打开对应应用视图。

### 前端：移动端 IM 式交互（无会话侧边栏）

- **移除会话侧边栏/抽屉**：删除 `SessionDrawer`、`SessionSidebar`，不再使用侧滑会话列表。
- **首页 `/`**：仅展示会话列表（仿 IM 首页）——顶栏「会话」+「新会话」，快捷入口「联系人」「机器人」，下方会话列表（头像、标题、最后一条预览）；点击某条进入该会话。
- **单聊页 `/chat/[id]`**：顶栏返回 + 标题，消息区 + 输入区；返回回到首页。
- **全局会话状态**：新增 **`useChatSessions`**，维护 `chats`、按 chatId 的 `messages`、`conversationIds`，供列表页与单聊页共用。
- 联系人/机器人列表页点击条目：`ensureChat` 后跳转 `/chat/contact-xx` 或 `/chat/bot-xx`。

### 前端：浅色主题与圆角容器

- 整体改为**浅色主题**：背景 `zinc-100`，白/浅灰容器，深色文字。
- 会话区、应用区统一为**圆角容器**（`rounded-xl`、`border-zinc-200`、`shadow-sm`）。
- 聊天气泡、会话抽屉、应用卡片等组件同步浅色样式。

### 前端：灵动岛式会话顶栏

- 会话区顶部由固定顶栏改为 **sticky 悬浮胶囊**（仿灵动岛）：置于可滚动消息区内部，`sticky top-3`，胶囊样式（`rounded-full`、`backdrop-blur`、阴影），滚动时贴顶。

### 前端：左右分栏与应用区

- 主界面**左右两栏**：左侧会话/聊天，右侧应用区（圆角容器）；会话区移动端风格、固定宽度，为应用区留出更多空间。
- 会话区改为**圆角容器**，与应用区视觉统一。

### 前端：联系人/机器人列表与路由

- 新增 **`/list`** 页：Tab「联系人」「机器人」，点击条目跳转会话。
- 新增 **`useContactsAndBots`**：维护联系人、机器人数据，`getWithTitle(withId)` 解析会话标题。
- 路由约定：`/?with=contact-xx` / `?with=bot-xx` 用于从列表跳转并创建/切换会话。

### 中间层：Dify 对接与思考块

- **Dify 官方包**：使用 `dify-client` 调用 Dify Chat API，流式响应转 SSE 给前端。
- **思考模型**：解析 `<think>...</think>`，拆分为 `thinking` 与 `message` 事件；兼容大小写、空格、HTML 实体（`&lt;think&gt;`）；流结束前发送 `fullText` 便于前端保留「思考过程」。
- **Dify 事件转发**：将 `agent_thought`、`tool_call` 等以 `dify_event` 转发，便于前端展示「正在调用 MCP 工具」等状态。
- **CORS**：SSE 响应头设置 `Access-Control-Allow-Origin` 等，支持前端跨域。
- **请求体**：Dify Chat 请求体使用 `inputs`、`query`、`response_mode`、`conversation_id`、`user` 等字段，与官方 API 一致。

### 文档与仓库

- **docs/DIFY_MCP.md**：Dify MCP 工具配置与「对话调用 MCP」说明。
- **Git**：仓库初始化，默认分支改为 `develop`，本地用户 `cos-dev` / `cos-dev@bit.js.cn`。
- **logs**：新增 `logs/` 目录，本文件记录主要开发变更。

---

## 格式说明

- 按**日期**分节，同一日内按**模块**（前端 / 中间层 / 文档等）与**功能点**罗列。
- 仅记录对产品行为、架构或协作有影响的变更，不记录琐碎样式或文案微调。
- 后续变更请在本文件顶部日期下追加，保持倒序。
