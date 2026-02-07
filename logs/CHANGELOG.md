# 开发变更记录 (Development Changelog)

记录 AI 工作台项目的主要开发变更，按时间倒序。

---

## 2026-02-07

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
