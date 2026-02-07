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
  - 宽度可折叠：展开 `w-44`，折叠 `w-12`，带过渡。  
  - **自上而下**：  
    1. **内容区显隐**：图标按钮（展开/折叠右侧内容区）；侧栏展开时居左，折叠时居中。  
    2. **设置**：跳转应用内容区「设置」视图。  
    3. **导航列表**（可滚动）：导航（首页）、联系人、机器人、以及扩展应用入口（如物料助手、订单进度、BOM 状态、库存概览）。  
  - 右侧缘有**折叠/展开侧栏**的悬浮按钮（相对整条侧栏垂直居中）。

- **应用内容区**  
  - 当 `isContentVisible` 为 true 时显示：内层容器圆角 `rounded-xl`、浅底 `bg-zinc-50/50`、内阴影 + 边框外阴影。  
  - 由 **AppPanel** 根据 `useAppView()` 的 `currentView` 切换：**home**（导航页，应用卡片网格）、**contacts**（联系人列表）、**bots**（机器人列表）、**settings**（设置项）。

### 会话区（space 页）

- **布局模式**  
  - **展开模式**（`isSessionExpanded` 为 true：应用区关闭或应用内容区折叠）：会话列表与聊天区**左右并排**（列表 `w-64`，右侧主区 flex-1）。  
  - **收起模式**：列表在上、聊天在下，或仅显示其一；无会话时仅显示列表，选中会话后显示顶栏 + 消息流 + 输入框，顶栏带「返回」到列表。

- **会话列表**  
  - 顶部 **SessionListHeader**：Logo +「AI COS 工作台」标题、新会话按钮、搜索按钮。  
  - 下方为会话列表（头像、标题、最后一条预览），当前会话高亮（emerald）。

- **主区**  
  - 有 `chatId` 时：顶栏（可选返回、会话标题）、可滚动消息区（`ChatMessageBubble`）、底部输入框 + 发送。  
  - 无 `chatId` 时：居中提示「选择左侧会话或新建会话」+ 新会话按钮。

### 状态与注入

- **useAppView**：`isPanelOpen`、`isContentVisible`、`currentView`、`openPanel`、`openNavPage`、`toggleContentPanel` 等。  
- Layout 向子组件 provide **`isSessionExpanded`**（computed：当应用区关闭或应用内容区折叠时为 true），用于 space 页切换列表/聊天布局。

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
├── app.vue
├── app.config.ts
├── nuxt.config.ts
├── tailwind.config.ts
├── layouts/
│   ├── default.vue        # 备用布局（无会话区时）
│   └── workspace.vue     # 工作台布局：会话区 + 应用区
├── pages/
│   ├── index.vue          # 入口，重定向至 /space（可带 app、with 等 query）
│   └── space/
│       └── [[id]].vue     # 会话页（列表 + 聊天），layout: workspace
├── components/
│   ├── SessionListHeader.vue   # 会话列表顶栏（Logo、新会话、搜索）
│   ├── WorkspaceAppNav.vue     # 应用侧栏（导航、设置、应用入口、折叠）
│   ├── AppPanel.vue            # 应用内容区（home/contacts/bots/settings）
│   ├── ChatMessageBubble.vue   # 单条消息（含打字机）
│   ├── Logo.vue
│   ├── TaskCard/               # 任务卡片（订单、库存、BOM、物料确认）
│   │   ├── OrderProgress.vue
│   │   ├── InventorySummary.vue
│   │   ├── BomStatus.vue
│   │   └── MaterialConfirm.vue
│   └── ui/                     # 通用 UI（Shadcn 风格，基于 radix-vue）
│       ├── select/             # Select, SelectTrigger, SelectValue, SelectContent, SelectItem
│       └── checkbox/           # Checkbox（CheckboxRoot + CheckboxIndicator）
├── composables/
│   ├── useAppView.ts      # 应用区视图状态（面板、内容区、currentView）
│   ├── useChatSessions.ts # 会话与消息列表
│   ├── useChatStream.ts   # SSE 流式对话
│   ├── useContactsAndBots.ts
│   └── useTheme.ts
└── plugins/
    └── theme.client.ts
```

### 命名与组织约定

- **组件**：大驼峰（PascalCase），语义清晰（SessionListHeader、WorkspaceAppNav、ChatMessageBubble）。通用 UI 放在 `components/ui/` 下按原子组件分子目录（如 `ui/select/`、`ui/checkbox/`）。
- **页面**：`pages/` 下按路由划分；入口用 `index.vue`，动态路由用 `[[id]].vue` 等，避免冗余中间页（如已删除的 `list.vue` 由 index 的 query 处理）。
- **Composables**：`use` 前缀 + 功能名（useAppView、useChatSessions），单文件单职责。
- **废弃与清理**：未再被引用的组件或页面应及时移除，避免死代码（如已移除的 ChatFlow.vue、WorkspaceSessionList.vue）。

## 主题

- 当前布局与组件为**浅色**实现（如 `bg-zinc-50`、`border-zinc-200`、白底卡片）；可扩展**深色**切换。
- 与 Shadcn-vue 主题变量一致，保证对比度与可访问性。
