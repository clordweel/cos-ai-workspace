# 原 frontend 界面布局与响应式断点（参照）

供 apps/web 及后续前端对齐用。原实现见 `frontend/layouts/workspace.vue`、`frontend/composables/useWorkspaceLayout.ts`、`frontend/composables/useBreakpoint.ts`。

## 断点定义（useBreakpoint）

| 断点 | 含义 | 媒体查询 |
|------|------|----------|
| **xxs** | 最窄档 | `max-width: 320px` |
| xs | 小屏起 | `min-width: 320px` |
| sm | 中屏起 | `min-width: 640px` |
| md | 大屏起 | `min-width: 768px` |
| lg | 更大屏 | `min-width: 1024px` |
| xl | 宽屏 | `min-width: 1280px` |
| 2xl | 超宽 | `min-width: 1536px` |

- xxs 为 **max-width**，其余为 **min-width**。
- Tailwind 的 `theme.extend.screens` 与上述一致（见 `frontend/tailwind.config.ts`）。

## 主布局 Grid（左栏会话区 | 右栏应用区）

- **基础列**（`gridTemplateColumns`）：
  - 应用区关闭或 **&lt; md**：`1fr 0fr`（右栏不渲染）。
  - 应用区展开：
    - **md～lg**：`288px 1fr`（会话列固定 288px，仅列表可见，聊天被挤出；右栏 1fr 为应用区）。
    - **xl+**：`1fr auto`（会话列 1fr，应用区 auto 由内容与 max-width 约束）。
- **生效列**（`effectiveGridColumns`）：当应用区展开且（**xl 或当前为会话页且有 chatId**）时覆盖为 `minmax(0, 940px) 1fr`，限制会话区最大 940px，避免过宽留白。
- **右栏应用区**：&lt; md 不渲染；md+ 由 `showAppPanel`（isPanelOpen && (isMd \|\| isLg)）控制；有 max-width（如 1000px）约束。

## 会话区内部（Space 页）

- **isSessionExpanded**（Layout provide）：
  - 有 chatId 时：xxs 或（&lt; md 且 &lt; lg）为 false（单栏）；否则 true（列表与聊天左右并排）。
  - 无 chatId 时：未挂载用 `!isPanelOpen || !isContentVisible`；挂载后 xxs 为 false，md/lg 为 true。
- **SessionSidebar**（列表容器）：
  - **展开**（isSessionExpanded）：`w-72`（288px）、`border-r`，与聊天区左右并排。
  - **收起**：`flex-1 min-w-0 overflow-hidden border-b`，列表在上、聊天在下。
- **space 页根**：`isSessionExpanded ? 'flex-row w-full' : 'flex-col'`，列表与聊天区同层 flex。

## 应用区内部

- 顶部工具栏：固定侧栏按钮（侧栏/内容都折叠时可隐藏）、折叠内容区按钮；mouseenter 取消侧栏延迟收起。
- **WorkspaceAppNav**：展开 w-44、折叠 w-12；悬停 500ms 展开、移出 180ms 延迟收起、280ms 内忽略误触 mouseleave；固定后常开。
- 应用内容区：圆角 `rounded-xl`、浅底 `bg-zinc-50/50`、内阴影+外阴影。

## CSS 媒体查询（workspace.vue 内）

- **max-width: 767px**：grid 强制 `1fr 0fr`，应用区 `display: none`（首屏即单栏，避免闪动）。
- **max-width: 639px**：会话区列居中，内层 `max-width: 32rem`。
- **max-width: 320px**：grid 去 padding，应用区去 border。
- **max-height: 860px**：底栏隐藏，为主内容留空间。

## 与 apps/web 的对应

| 原 frontend | apps/web |
|-------------|----------|
| useBreakpoint('md') | useMediaMd()，768px |
| isSessionExpanded | WorkspaceLayoutContext.isSessionExpanded（!showAppPanel \|\| !isContentVisible） |
| 会话列 max 940px（xl 或有 chat） | 会话区容器应用区展开时 max-w-sm |
| 列表 w-72 | Space 展开时列表 w-64（可改为 w-72 与 frontend 一致） |
| showFooter（md+） | 底栏 md+ 显示 |
