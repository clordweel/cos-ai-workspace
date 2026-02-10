# 计划：拆分 space 页（pages/space/[[id]].vue）

## 目标
将 `frontend/pages/space/[[id]].vue`（约 920 行）拆成更小模块，符合「单文件约 300 行内」的 AI 友好结构，便于 Agent 按需加载上下文。

## 当前状态
- 单文件包含：模板（会话区 + 侧栏 + 聊天区 + 虚拟列表/fallback）、script 中大量 ref/computed/方法（会话列表、抽屉、流式、导出、消息操作等）。
- 相关 composable 已有：`useChatSessions`、`useChatSessionsApi`、`useAppView`、`useUISettings` 等。

## 建议拆分步骤
1. **提取 `useSpacePage` composable**  
   将会话列表状态（listViewTab、pinnedIds、mock 相关、searchQuery、drawer 相关）、聊天区状态（input、streaming、virtualizer、streamContentBuffer、typewriter 等）、以及所有事件处理（onSessionItemClick、togglePin、send、retryMessage、onExportMarkdown 等）迁入 `composables/useSpacePage.ts`。页面仅保留 `definePageMeta`、`useSpacePage()` 与模板。
2. **若 useSpacePage 仍超 300 行**  
   可再拆为 `useSpaceSessionList.ts`（列表、置顶、mock、抽屉）与 `useSpaceChatPane.ts`（当前会话、消息、流式、虚拟列表、导出）。
3. **模板**  
   保持或适度拆分为子组件（如已有 SpaceSessionSidebar、SpaceChatPane、ChatEmptyState）；避免单文件 template 过长时可再拆出 `SpaceChatVirtualList.vue` 等。

## 验收
- 页面行为与当前一致；构建与 E2E/手动测试通过。
- 单文件行数控制在约 300 行内；新 composable 命名语义化，便于搜索与引用。

## 执行记录（2026-02-10）
- 已拆分为 **useSpaceSessionList**（列表、置顶、mock、抽屉）、**useSpaceChatPane**（消息、流式、虚拟列表、导出与消息操作）、**useSpacePage**（组合二者 + 路由/注入/生命周期）。
- 页面 **pages/space/[[id]].vue** 现仅保留 `definePageMeta`、`useSpacePage()` 解构与模板，约 296 行（含 template + script + style）。
- 验收：前端 `pnpm run build` 通过；行为与拆分前一致。
