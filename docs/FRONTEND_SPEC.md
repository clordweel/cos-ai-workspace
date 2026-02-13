# 前端规范（Nuxt 3 + 对话流 + 任务卡片）

## 技术栈

- **Vue 3** + **Nuxt 3** + **Tailwind CSS** + **Shadcn-vue**
- 跨端：**Tauri**（桌面）/ **Capacitor**（移动/PWA）

## UI 布局（当前实现）

主界面采用 **workspace 布局**（`layouts/workspace.vue`），全屏 `h-screen`、背景 `bg-zinc-50`，主体为横向 flex + 内边距 `p-3`。

### 整体结构

- **左侧：会话区**  
  - 由 layout 的 `<slot />` 渲染（一般为 `pages/space/[[id]].vue`）。  
  - 当应用区打开且内容区展开时，会话区宽度限制为 `max-w-sm`，右侧留出应用区；当应用区关闭或仅侧栏可见时，会话区占满剩余宽度。

- **右侧：应用区**（可选）  
  - 一块 `section`：圆角 `rounded-2xl`、白底、边框 `border-zinc-200`、外阴影。  
  - 内部为 **应用侧栏 + 应用内容区** 横向拼接。  
  - 通过 `useAppView()` 的 `isPanelOpen`、`isContentVisible` 控制显隐与宽度；出场/离场使用 `app-panel` 过渡动画。

### 应用区内部

- **WorkspaceAppNav（应用侧栏）**  
  - 宽度可折叠：展开 `w-44`，折叠 `w-12`；宽度过渡 200ms，用 `contain: layout style` 限制布局影响。  
  - **悬停展开**（`useAppView`）：鼠标进入 nav 后**悬停 500ms** 才展开；移出后 180ms 延迟收起；若在 180ms 内移入顶部工具栏则取消收起（便于点击固定）。展开后约 280ms 内忽略误触的 mouseleave，避免宽度动画导致抖动。  
  - **固定态**：顶部工具栏有「固定侧栏」按钮，固定后侧栏常开、不随鼠标收起。  
  - **自上而下**：  
    1. **设置**：跳转应用内容区「设置」视图。  
    2. **导航列表**（可滚动）：导航（首页）、联系人、机器人、以及扩展应用入口（如物料助手、订单进度、BOM 状态、库存概览）。  
  - **文字与布局**：列表项文字在展开后**延后 140ms** 再挂载并淡入，减轻与宽度动画同帧造成的卡顿。收起时按钮保持「展开布局」（图标居左）约 200ms，再切换为居中，避免图标在宽条时瞬间回中的不良观感。  
  - 固定/展开按钮在 **workspace 布局**的顶部工具栏（侧栏上方），不在 nav 内。

- **应用内容区**  
  - 当 `isContentVisible` 为 true 时显示：内层容器圆角 `rounded-xl`、浅底 `bg-zinc-50/50`、内阴影 + 边框外阴影。  
  - 由 **AppPanel** 根据 `useAppView()` 的 `currentView` 切换：**home**（导航页，应用卡片网格）、**contacts**（联系人列表）、**bots**（机器人列表）、**settings**（设置项）、**auth**（认证登录，未登录时可选强制打开）、**app**（扩展应用，由 `appId` 指定）。
- **应用标签栏布局**：可滚动区为全部已打开标签（含首页、用户信息、设置、联系人、应用等，均可关闭；至少保留一个标签）；分割线下方仅「新标签」按钮。个人信息与设置不常驻，需从抽屉等其它入口通过 openView 打开。
- **应用标签激活类型**（`useAppView.openView` / `useAppViewConstants.SINGLE_INSTANCE_VIEWS`）：  
  - **单例**（只能创建一次）：**profile**（用户信息）、**settings**（设置）、**auth**（认证登录）。再次激活时仅切换到已有标签，不新建。  
  - **可重复创建**：**home**、**contacts**、**bots**、**app**（扩展）。每次激活可新建标签；底部「新标签」固定为新建首页标签。

### 会话区（space 页）

- **布局模式**  
  - **展开模式**（`isSessionExpanded` 为 true：应用区关闭或应用内容区折叠）：会话列表与聊天区**左右并排**（列表 `w-64`，右侧主区 flex-1）。  
  - **收起模式**：列表在上、聊天在下，或仅显示其一；无会话时仅显示列表，选中会话后显示顶栏 + 消息流 + 输入框，顶栏带「返回」到列表。

- **会话列表**  
  - 顶部 **SessionListHeader**：Logo +「COS&AI 工作空间」标题、新会话按钮、搜索按钮。  
  - 下方为会话列表（头像、标题、最后一条预览），当前会话高亮（emerald）。

- **主区**  
  - 有 `chatId` 时：顶栏（可选返回、会话标题）、可滚动消息区（`ChatMessageBubble`）、底部输入框 + 发送。  
  - 无 `chatId` 时：居中提示「选择左侧会话或新建会话」+ 新会话按钮。

### 状态与注入

- **useAppView**：  
  - 面板与内容：`isPanelOpen`、`isContentVisible`、`currentView`、`openPanel`、`openNavPage`、`closePanel`、`toggleContentPanel`。  
  - 侧栏悬浮/固定：`isSidebarPinned`、`isSidebarHovered`、`toggleSidebarPinned`、`setSidebarHovered`；  
  - 侧栏延迟逻辑：`scheduleSidebarExpand()`（nav mouseenter 时调用）、`scheduleSidebarLeave()`（nav/工具栏 mouseleave）、`cancelSidebarLeave()`（工具栏 mouseenter，取消延迟收起）。  
  - 卡片栈：`appStack`、`pushCard`、`goBack`、`removeCard`、`canGoBack`。  
- Layout 向子组件 provide **`isSessionExpanded`**（computed：当应用区关闭或应用内容区折叠时为 true），用于 space 页切换列表/聊天布局。
- **认证与用户偏好**：认证用 `useAuth()`（唯一入口 Logto）；用户偏好用 `useUserPreferences()`（主题、字体、通知），登录后与 Logto customData 同步。详见 **`docs/AUTH_AND_USER_CONFIG.md`**。

## UX 原则（De-ERP）

- **极简、抽象**；支持浅色/深色模式；严禁传统密集表格。
- 主界面以**对话流**为主，结构化结果以**任务卡片**形式嵌入对话。
- 卡片类型示例：订单进度、库存摘要、BOM 状态、**待确认物料**（带「确认创建」按钮）。

## 与中间层交互

- **对话**：`POST /api/chat/stream`，消费 **SSE**，将 `message` 事件做打字机展示。
- **确认创建物料**：用户点击卡片「确认」→ 前端调用 `POST /api/material/confirm`（携带 `draft_id`、当前用户标识），成功后刷新卡片状态或追加一条系统消息。

## SSE 消费示例（概念）

```ts
// 使用 fetch + ReadableStream 或 EventSource
const res = await fetch('/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: userInput, user_id: currentUser }),
});
const reader = res.body.getReader();
const decoder = new TextDecoder();
// 解析 SSE 行，根据 event 类型更新 UI：message → 追加文本；tool_result → 渲染任务卡片
```

## 目录与源码组织（Nuxt 3）

```
frontend/
├── app.vue, app.config.ts, nuxt.config.ts, tailwind.config.ts
├── layouts/
│   ├── default.vue        # 备用布局（无会话区时）
│   └── workspace.vue      # 工作台布局：会话区 + 应用区（useWorkspaceLayout 驱动 grid）
├── pages/
│   ├── index.vue          # 入口，重定向至 /space（可带 app、with 等 query）
│   ├── logto.vue           # Logto 登录发起（前端承载时 302 到 Logto）
│   ├── logto-callback.vue  # Logto 回调（收 code 后 302 到中间层换 token）
│   └── space/
│       └── [[id]].vue      # 会话页（列表 + 聊天），layout: workspace
├── components/
│   ├── SessionListHeader.vue, SessionListItem.vue, SessionListThumb.vue
│   ├── SessionListBottomNav.vue, SessionSearchBar.vue
│   ├── space/                  # 会话区子组件
│   │   ├── SessionListContent.vue, SessionSidebar.vue
│   │   ├── ChatPane.vue, AppDrawer.vue
│   │   └── SessionListSettings.vue
│   ├── ChatHeader.vue, ChatMessageBubble.vue, ChatInputPanel.vue, ChatEmptyState.vue
│   ├── WorkspaceAppNav.vue     # 应用侧栏（标签式、折叠、固定）
│   ├── AppPanel.vue            # 应用内容区（currentView: home|contacts|bots|settings|auth|app）
│   ├── AppPlaceholder.vue       # 扩展占位
│   ├── Logo.vue
│   ├── TaskCard/               # 任务卡片（订单、库存、BOM、物料确认）
│   │   ├── OrderProgress.vue, InventorySummary.vue, BomStatus.vue, MaterialConfirm.vue
│   └── ui/                     # Shadcn-vue 组件（仅通过 CLI 安装）
│       ├── select/, checkbox/, button/, dropdown-menu/, accordion/, slider/, tooltip/, empty/
├── composables/
│   ├── useAppView.ts       # 应用区（tabs、currentView、openAuthTab、addTab…）
│   ├── useWorkspaceLayout.ts   # 布局模式与 grid 列宽（layoutMode、appPanelMaxWidthCss）
│   ├── useChatSessions.ts, useChatSessionsApi.ts
│   ├── useChatStream.ts    # SSE 流式对话
│   ├── useAuth.ts, usePermissions.ts
│   ├── useAppExtensions.ts, useAppFavorites.ts
│   ├── useContactsAndBots.ts, useTheme.ts, useBreakpoint.ts
│   ├── useApiBase.ts, useUISettings.ts, useWorkspaceOptions.ts
│   └── useMockSessions.ts  # Mock 会话（开发/MSW）
├── types/
│   └── app-extensions.ts   # AppExtension 等
├── plugins/
│   ├── theme.client.ts, app-extensions.ts
│   ├── mock-worker.client.ts, ssr-width.client.ts, suppress-anonymous-warn.ts
└── mock/                    # MSW 与占位数据（可选）
```

### 命名与组织约定

- **组件**：大驼峰（PascalCase），语义清晰（SessionListHeader、WorkspaceAppNav、ChatMessageBubble）。通用 UI 放在 `components/ui/` 下按原子组件分子目录（如 `ui/select/`、`ui/checkbox/`）。
- **页面**：`pages/` 下按路由划分；入口用 `index.vue`，动态路由用 `[[id]].vue` 等，避免冗余中间页（如已删除的 `list.vue` 由 index 的 query 处理）。
- **Composables**：`use` 前缀 + 功能名（useAppView、useChatSessions），单文件单职责。
- **废弃与清理**：未再被引用的组件或页面应及时移除，避免死代码（如已移除的 ChatFlow.vue、WorkspaceSessionList.vue）。扩展开发见 `docs/APP_EXTENSIONS.md`；鉴权与权限见 `docs/FRONTEND_AUTH_AND_PERMISSIONS.md`。

## 主题

- 当前布局与组件为**浅色**实现（如 `bg-zinc-50`、`border-zinc-200`、白底卡片）；可扩展**深色**切换。
- 与 Shadcn-vue 主题变量一致，保证对比度与可访问性。
