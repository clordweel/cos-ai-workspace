# 开发变更记录 (Development Changelog)

记录 AI 工作台项目的主要开发变更，按时间倒序。

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
