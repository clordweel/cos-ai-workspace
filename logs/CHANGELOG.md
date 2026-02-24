# 开发变更记录 (Development Changelog)

记录 AI 工作台项目的主要开发变更，按时间倒序。

---

## 2026-02-24

### chore: 移除废弃包 frontend、middleware 并清理文档（分支 chore/remove-deprecated）

- **删除**：从仓库移除 **frontend/**、**middleware/** 目录及全部文件。
- **pnpm-workspace.yaml**：移除 frontend、middleware，仅保留 `apps/*`、`packages/*`。
- **根 package.json**：`dev`、`dev:matrix` 改为同时启动 apps/api + apps/web；移除 dev:frontend、dev:middleware、build:frontend、build:middleware。
- **文档**：DEPRECATED_PACKAGES 改为「已移除」说明；PROJECT_STATUS 移除「已废弃包」节，架构表改为 apps/web、apps/api；MONOREPO_APPS_PACKAGES 重写为仅 apps/packages；PROJECT_PHASE_SUMMARY、AGENTS、MATRIX_SESSION_VERIFICATION、REFACTOR_PLAN 去除对 frontend/middleware 的保留与过渡表述。
- **.cursor/rules**：project-global、agent-workflow、git-commit 中 frontend/middleware 引用改为 apps/web、apps/api。

### docs: 阶段性梳理总结与清理整理

- **PROJECT_PHASE_SUMMARY.md**：新增阶段性梳理总结文档，含项目定位、目录与职责、重构阶段 0–6 进度、文档索引、技术债与待办、清理建议、下一步建议与快速命令。
- **PROJECT_STATUS.md**：更新「最后更新」日期；快速入口增加「阶段梳理与下一步」指向 PROJECT_PHASE_SUMMARY，并注明当前开发以 apps/api + apps/web 为准。
- **MATRIX_SESSION_VERIFICATION.md**：推荐验证方式改为 **apps/api + apps/web**（两终端 dev:api + dev:web）；「一键启动」改为过渡方案（dev:matrix）；前提与故障排查中「middleware」改为「后端」或「apps/api / middleware」。
- **apps/README.md**：更新为当前后端/前端即 apps/api、apps/web，并指向 REFACTOR_PLAN 与 PROJECT_PHASE_SUMMARY。
- **AGENTS.md**：首句与 Matrix 验证说明改为以 apps/web、apps/api 为准；先读什么表增加「阶段梳理与下一步」条目。

---

## 2026-02-15

### Matrix 在 apps/api 内完整迁移（不依赖 middleware）

- **原则**：重构不启动、不依赖旧 frontend/middleware，仅作迁移参照；Matrix 等能力在 **apps/api** 中重新实现。
- **文档**：REFACTOR_PLAN 与 MATRIX_SESSION_VERIFICATION 已更新，明确验证使用 apps/api + apps/web，迁移完成后无需启动 middleware。
- **config**：api 补全 matrix 配置（serverName、userId、accessToken、password、botUserId、botAccessToken）。
- **adapters**：迁移 matrixClient（REST：getMatrixAccessToken、loginAsUser、getJoinedRooms、getRoomName、getRoomMessages、sendRoomMessage、createRoom、leaveRoom、setRoomName、verifyMatrixTokenUserId 等）；新增 matrixChat 适配器（listSessions、listMessages、streamMessage、createSession）；adapters/index 提供 getChatAdapter()（按 config.chat.provider 返回 mock 或 matrix）。
- **types**：StreamMessageParams、ListSessionsParams、ListMessagesParams、CreateSessionParams 增加 matrixAccessToken、currentUserMxid。
- **services**：matrixUserSync（ensureMatrixUser、setMatrixPasswordByAdmin，仅 Synapse Admin、无 MAS）；matrixPasswordStore（内存缓存）；matrixSessionToken（ensureMatrixTokenForSession：缓存密码登录或 Admin 设密 + login）；sessionStore 增加 updateSession、matrixTokenExpiresAt。
- **routes**：chat 使用 getChatAdapter() 并传入 session.matrixAccessToken、session.matrixUserId；auth GET /me 在 provider=matrix 时调用 ensureMatrixUser + ensureMatrixTokenForSession，返回 matrixSyncToken、matrix_base_url、matrix_user_id、matrix_device_id。

### 阶段 5.2：设置与偏好（apps/api + apps/web）

- **apps/api**：config 增加 `logto.m2mAppId`、`logto.m2mAppSecret`；新增 `services/logtoPreferences.ts`（getPreferencesFromCustomData、mergePreferencesIntoCustomData、Account API 获取/更新 customData、M2M 获取/更新 customData、M2M token 缓存）。GET /api/auth/me 在 session.logtoSub 时从 Logto 拉取 customData 并填充 `payload.preferences`（先 Account API 再 M2M 回退）。新增 PATCH /api/auth/me/preferences，接受 theme、uiFontSizeStep、notificationsEnabled，先 Account API 写回，401/403 时回退 M2M。
- **apps/web**：useAuth 增加 `preferences` 状态与 `updatePreferences(patch)`（PATCH /api/auth/me/preferences 后更新本地状态）；设置页使用 SettingsPanel（主题 light/dark/system、字体档位、通知开关），修改后即写 Logto 并展示保存结果。

### 阶段 5.1：应用区标签与 currentView 切换（apps/web）

- **constants/appView.ts**：AppView 类型、AppTab、VIEW_TITLES、isSingleInstanceView、defaultHomeTab，与现 frontend useAppViewConstants 对照。
- **AppViewContext**：扩展 tabs、activeTabId、activeTab、currentView、openView、switchTab、closeTab、setView、openAuthTab；单例视图（settings/auth/profile）再次打开时切换已有标签。
- **WorkspaceLayout**：应用区增加侧栏导航（首页、联系人、机器人、设置、认证）、标签条（可切换/关闭）、按 currentView 渲染的 AppPanelContent（各视图占位，设置/偏好与扩展留待 5.2/5.4）。

### 阶段 4.2 / 4.3：新前端 Matrix Sync 与构建（apps/web）

- **4.3 构建**：安装 `matrix-js-sdk@^39.4.0`；Webpack 增加 `experiments.asyncWebAssembly: true`、`resolve.conditionNames` 含 `matrix-org:wasm-esm`，开发与生产构建通过，WASM 正常产出。
- **useAuth**：从 `/api/auth/me` 解析并暴露 `matrixSyncToken`、`matrixBaseUrl`、`matrixUserId`、`matrixDeviceId`。
- **messagesByRoomStore**：按房间维度的消息存储（getMessages、setMessages、appendMessage、appendStreamingContent、commitStreamingMessage、discardStreamingMessage、subscribe、getSnapshot），供 useMessages 与 Sync 共用。
- **useMessages**：改为基于 store + `useSyncExternalStore` 读取当前 sessionId 的消息，保证 Sync 写入任意房间后当前房间视图可更新。
- **useSessions**：新增 `addOrUpdateSession(id, title)`，供 Sync 发现新房间或房间名变更时更新会话列表。
- **useMatrixSyncClient**：React Hook，接收 token/baseUrl/userId/deviceId 与 ensureSession；创建 client、startClient、订阅 ClientEvent.Sync/Room/Event、RoomEvent.TimelineRefresh/Name；暴露 syncReady、setCurrentRoomId、fillMessagesFromSyncTimeline、sendTyping、sendReadReceipt；可选 initRustCrypto（deviceId 时）。
- **Space**：当 `hasSyncToken` 且已登录时调用 `startSyncClient()`；随 sessionId 更新 `setCurrentRoomId`；在 syncReady 且 sessionId 存在时调用 `fillMessagesFromSyncTimeline(sessionId)`。

### 阶段 4.1：新后端 /api/auth/me 返回 Matrix 相关字段（apps/api）

- **config**：新增 `chat.provider`（`CHAT_PROVIDER`，默认 mock）、`matrix.baseUrl`（`MATRIX_BASE_URL`），与现 middleware 对齐。
- **sessionStore**：SessionData 增加可选字段 `matrixUserId`、`matrixAccessToken`、`matrixDeviceId`，供后续接入 Matrix token 逻辑。
- **GET /api/auth/me**：当 `chat.provider === 'matrix'` 且配置了 `matrix.baseUrl` 时，响应中增加 `matrix_base_url`；若 session 带 `matrixAccessToken`，则一并返回 `matrixSyncToken`、`matrix_user_id`、`matrix_device_id`。当前未接入 ensureMatrixTokenForSession，仅返回 base_url，前端可据此判断 API 已就绪。

### 阶段 3.3：SSE 流式与错误态（apps/web）

- **useChatStream**：4xx/5xx 时读取响应 body 的 `error` 或 `message` 作为抛出文案；解析 SSE `event: error` 并抛出 `data.message`；流读取异常时抛出「连接中断，请重试」。
- **useMessages**：新增 `discardStreamingMessage()`，流式出错时移除未完成的助手占位消息。
- **Space**：发送失败时调用 `discardStreamingMessage()` 并展示错误文案；错误条旁增加「清除」按钮可关闭错误提示。

### 阶段 3.2：新前端会话列表与聊天区（apps/web）

- **useSessions**：GET /api/sessions、POST /api/sessions，sessions / loading / error、createSession、fetchSessions。
- **useMessages**：GET /api/sessions/:id/messages，messages / loading / error、appendStreamingContent、commitStreamingMessage、appendUserMessage。
- **useChatStream**：POST /api/chat/stream，解析 SSE（session_created、message delta），返回完整回复文本。
- **Space 页**：顶栏用户/登录 +「新建会话」；会话列表（链接到 /space/:id）；消息区（历史 + 流式追加）+ 输入框 + 发送；无会话时发送自动创建并流式结束后跳转新会话。

### 阶段 3.1：新后端会话与聊天 API（apps/api）

- **Mock 适配器**：`src/adapters/types.ts`（NormalizedSession、NormalizedMessage、StreamMessageParams 等）、`src/adapters/mockChat.ts`（按 userId 内存存储，listSessions、listMessages、createSession、streamMessage 逐字 echo）。
- **路由**：`GET /api/sessions`、`POST /api/sessions`、`GET /api/sessions/:id/messages`、`POST /api/chat/stream`；与现 middleware 路径与响应结构对齐；userId 由 Cookie 会话 getStableUserId 或 'default'。
- **SSE**：`/api/chat/stream` 返回 text/event-stream，发送 session_created、status、message(delta)、message_end、error。

### 阶段 2.4：shadcn-ui 与 Button 组件（apps/web）

- **依赖**：class-variance-authority、clsx、tailwind-merge、lucide-react、@radix-ui/react-slot。
- **路径别名**：tsconfig 与 webpack 配置 `@/*` → `./src/*`。
- **工具**：`src/lib/utils.ts` 提供 `cn()`；`src/components/ui/button.tsx` 提供 Button（variant：default/outline/ghost/link/secondary/destructive，size：default/sm/lg/icon），支持 `asChild`。
- **页面**：Logto 页使用 Button「重试」、LogtoCallback 使用 Button「重新登录」「返回工作台」、WorkspaceLayout 顶栏主题切换使用 Button ghost+icon+Lucide Sun/Moon、Home/Space 导航使用 Button link + asChild。
- **base 层**：button/role=button 默认 cursor: pointer。

### 阶段 2.2：Workspace 布局与主题（apps/web）

- **Tailwind CSS v4**：接入 `@tailwindcss/postcss`、`postcss-loader`，`src/index.css` 含 `@theme` 主色与 `@custom-variant dark`，与 `docs/UI_DESIGN_SYSTEM.md` 一致。
- **主题**：`useTheme` 读写 localStorage（`cosai-theme`）、切换浅色/深色；`index.html` 首屏脚本防闪。
- **布局**：`WorkspaceLayout` 顶栏（品牌 + 主题切换）、会话区（左栏，圆角卡片）+ 应用区（右栏，md+ 显示、可折叠）、底栏（md+）；`AppViewProvider` 管理应用区展开/折叠状态；/space、/space/:id 使用该布局。
- **视觉**：bg-zinc-50/dark:bg-zinc-900、卡片 rounded-xl/rounded-2xl、border-zinc-200/dark:border-zinc-700，与现前端可对照。

### 阶段 2.1：新前端认证流（apps/web）

- **apps/api**：新增 `getLogtoAuthUrl`、`GET /api/auth/logto/url`（返回 Logto 授权 URL，redirect_uri 为前端 `/logto-callback`），供前端 /logto 跳转。
- **apps/web**：/logto 请求 `/api/auth/logto/url` 后重定向到 Logto；/logto-callback 收到 code 后重定向到 `/api/auth/logto/callback?code=…&redirect_uri=…`，由后端写 Cookie 并重定向到 /space?auth=ok；新增 `useAuth` 拉取 `/api/auth/me`（credentials: 'include'）；Space 页展示当前用户或登录入口；devServer 代理 /api 默认指向 `http://localhost:3000`（新后端）。

### 阶段 1 完成：新后端鉴权与 /api/auth/me

- **apps/api**：实现环境与配置（`src/config.ts`，从根或本目录加载 .env）、内存会话存储（`src/services/sessionStore.ts`，与现 middleware Session 结构可对照）、Logto 回调（`src/services/logto.ts`：code 换 token、/oidc/me、建会话）、认证路由（`src/routes/auth.ts`）。
- **路由**：`GET /api/auth/logto/callback`（写 Cookie、重定向到前端）、`GET /api/auth/me`（带 Cookie 返回 ok、user、userId、type、preferences 占位；Matrix 相关字段暂未实现）。
- **依赖**：`@fastify/cookie`、`@fastify/cors`；入口注册 CORS（credentials: true）与 cookie，并挂载 auth 路由。
- **验收**：同一 Logto 应用经新后端 callback 可登录并写 Cookie；带 Cookie 调 `GET /api/auth/me` 可得与现网可比的响应结构（preferences 为 {}，无 matrix 字段）。

### 还原 middleware 迁入，明确重构方式与计划

- **还原**：此前将 `middleware/` 迁入 `apps/middleware/` 的改动已还原；**原 middleware 保持根目录不动**，作为直接参考。
- **重构方式**：在 `apps/` 下**新建**后端应用（新包名、可更换技术栈），以原 middleware 为参考重构，而非迁移现有代码。
- **计划**：详见 `docs/REFACTOR_PLAN.md`：分阶段与步骤、技术栈需先讨论确认（如 React 下 shadcn 用原生版或更合适方案）、故障点与可介入修复策略。

### 阶段 0 完成：技术栈结论与脚手架

- **技术栈结论**：在 `docs/REFACTOR_PLAN.md` §2.4 写入推荐默认（新后端 `@cosai/api`、Node+Fastify；新前端 `@cosai/web`、React 18+Webpack 5+shadcn-ui+Zustand）。
- **apps/api**：Fastify + TypeScript，`GET /health`，端口 3000（或 `API_PORT`/`PORT`）；根脚本 `dev:api`、`build:api`。
- **apps/web**：React 18 + Webpack 5 + React Router，路由占位 /、/space、/space/:id、/logto、/logto-callback；devServer 代理 /api → 现 middleware（可配置）；根脚本 `dev:web`、`build:web`。
- **根 package.json**：新增 `dev:api`、`dev:web`、`build:api`、`build:web`；`apps/README.md`、`docs/MONOREPO_APPS_PACKAGES.md` 更新。

---

## 2026-02-12

### 聊天区接入 Nuxt UI ChatMessages

- **frontend**：接入 @nuxt/ui，聊天区用 **UChatMessages** 替代自定义 CSS 反转滚动 + 虚拟列表。
- **useSpaceChatPane**：新增 `uiMessages`（displayMessages → UIMessage）、`chatStatus`、`getMessageIndexByUiId`；移除 scrollRef、rowVirtualizerRef、virtualRows、virtualTotalSize。
- **ChatPane**：移除 scrollRef、scaleY 与滚轮处理；使用 `<UChatMessages>`，`#content` 插槽转发给页面渲染 ChatMessageBubble。
- **space/[[id]].vue**：传入 uiMessages、chatStatus；单一 `#content` 插槽内按 `getMessageIndexByUiId(message.id)` 渲染气泡并绑定 retry/edit/delete 等事件。
- **app.vue**：根节点包裹 `<UApp>`；**tailwind.css**：增加 `@import "@nuxt/ui"`。
- **说明**：挂载滚到底、流式跟滚、「回到底部」按钮由 UChatMessages 提供；无虚拟列表，适合单会话数百条级。

### 前端升级至 Nuxt 4

- **frontend**：`nuxt` 从 ^3.14 升级至 ^4.3.1，构建与现有模块（shadcn-nuxt、@nuxtjs/color-mode、@logto/nuxt）兼容。
- **nuxt.config**：显式设置 `srcDir: '.'`、`dir: { app: '.' }` 以保留当前目录结构（不采用 Nuxt 4 默认的 `app/` 作为 srcDir）；保留 `experimental.appManifest: false`。
- **说明**：升级后可使用 @nuxt/ui v4（含 ChatMessages）等依赖 Nuxt 4 的生态。

### Matrix 部署可选：Synapse 单机与 MAS 扩展

- **deploy/matrix**：新增 `nginx-no-mas.conf`、`docker-compose.no-mas.yml`、`disable-mas.sh`，支持纯 Synapse 原生认证；MAS 为可选扩展，见 `docs/archive/mas/`。

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
