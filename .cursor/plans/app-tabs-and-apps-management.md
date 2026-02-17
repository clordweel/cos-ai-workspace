# 应用标签与应用管理 — 实现计划

## 目标

在 apps/web 中实现「应用标签」与「应用」的完整管理，与 frontend 的 useAppView 行为对齐：多标签、单例/可重复、关闭/切换/新建，并保持代码可维护。

## 当前状态（apps/web）

- **Space.tsx** 内用 `useState` 维护：
  - `activeAppTab: string` — 当前仅 `'home' | 'me'`，无 id
  - `appAreaCollapsed`、`appTagsBarPinned`、`tagBarHovered`
- 标签栏为**固定项**：首页、创建新标签（占位）、用户项；无动态标签列表、无关闭/切换逻辑。
- 应用内容区按 `activeAppTab === 'me'` 分支渲染用户配置或 AuthPanel，其余为占位。

## 参考实现（frontend）

- **useAppView.ts**：全局单例状态（ref）
  - `tabs: AppTab[]`、`activeTabId: string | null`
  - 面板：`isPanelOpen`、`isContentVisible`；侧栏：`isSidebarPinned`、`isSidebarHovered`、延迟展开/收起
  - 方法：`addTab`、`openView`（单例/可重复）、`closeTab`、`switchTab`、`closeOtherTabs`、`closeTabsToTheRight`、`closeAllTabs` 等
- **useAppViewConstants.ts**：`AppView`、`AppTab`、`VIEW_TITLES`、`SINGLE_INSTANCE_VIEWS`、`defaultHomeTab` 等
- **WorkspaceAppNav.vue**：标签列表 + 新标签按钮 + 固定/折叠；调用 useAppView 的 tabs/activeTabId/closeTab/switchTab/addTab
- **AppPanel.vue**：按 `currentView` 渲染 home/contacts/bots/settings/profile/auth/app

---

## 一、是否拆分组件 — **建议：是**

### 1.1 拆分范围

| 组件 | 职责 | 建议路径 |
|------|------|----------|
| **AppTagsBar** | 应用区左侧：折叠/固定、标签列表（可滚动）、「创建新标签」、用户项 | `apps/web/src/components/app/AppTagsBar.tsx` |
| **AppContent** | 应用区右侧：按当前标签类型渲染 home/me/contacts/bots/settings/auth/app | `apps/web/src/components/app/AppContent.tsx` |
| **常量/类型** | AppView、AppTab、VIEW_TITLES、SINGLE_INSTANCE_VIEWS、defaultHomeTab | `apps/web/src/constants/appView.ts` 或 `apps/web/src/types/appView.ts` |

Space.tsx 保留：布局（PageGrid、Frame、会话区 + 应用区容器）、会话列表/聊天区状态、以及**应用区状态**的持有与下传（或从 store 消费）。

### 1.2 拆分带来的好处

- Space 体积可控，应用区逻辑边界清晰。
- 标签栏与内容区可单独测试、替换。
- 与 frontend 的 WorkspaceAppNav + AppPanel 结构对应，便于对照验收。

---

## 二、是否引入状态管理器 — **建议：分阶段**

### 2.1 现阶段：不引入 Zustand/Redux，优先「组件拆分 + useState 上提」

- **理由**：
  - 应用区状态目前**仅 Space 页**使用，入口单一。
  - 标签列表、当前选中 id、侧栏折叠/固定等，用 **Space 内 useState + props/callbacks** 即可满足。
  - 与 frontend 的「composable 内 ref」等价：状态集中在一处，通过 props 下发给 AppTagsBar / AppContent。
- **做法**：
  - 在 Space 中维护：`tabs: AppTab[]`、`activeTabId: string | null`、`appAreaCollapsed`、`appTagsBarPinned`、`tagBarHovered`。
  - 实现 `addTab`、`openView`、`closeTab`、`switchTab` 等纯函数或 useCallback，通过 props 传给 AppTagsBar / AppContent。
  - 用户项、个人中心空态按钮等需要「打开 me 标签」时，调用 `openView('profile')`（或当前约定的 view 名）。

### 2.2 何时考虑 Context 或 Zustand

在以下任一情况出现时，再引入 **React Context** 或 **Zustand** 更合适：

- **多入口打开标签**：例如从会话列表、从聊天内链、从路由 deep link 打开某个应用标签，且这些调用方与 Space 不在同一棵「通过 props 下传」的子树内。
- **需要持久化**：例如刷新后恢复「已打开标签列表」与当前选中 id（存 localStorage 或服务端）。
- **应用区状态在多个页面/布局复用**：例如非 Space 的某页也要展示同一套标签栏与内容区。

**推荐**：若只做「多入口打开标签」且仍仅在 Space 内，可先用 **React Context**（如 `AppViewContext`）提供 `openView`、`switchTab`，避免多层 props；若后续有持久化或跨页面，再迁到 **Zustand** 单 store（如 `useAppViewStore`），与 frontend 的 useAppView 能力一一对应。

---

## 三、数据结构与行为（与 frontend 对齐）

### 3.1 类型与常量

```ts
// AppView 与 frontend 一致，可按需先裁剪（如先不实现 bots/app 扩展）
type AppView = 'home' | 'contacts' | 'bots' | 'settings' | 'auth' | 'profile' | 'app'

interface AppTab {
  id: string
  view: AppView
  title: string
  appId?: string
  isAuthRequired?: boolean
}

const VIEW_TITLES: Record<...> = { home: '首页', contacts: '联系人', ... }
const SINGLE_INSTANCE_VIEWS: AppView[] = ['profile', 'settings', 'auth']
const defaultHomeTab: AppTab = { id: 'tab-home-default', view: 'home', title: '首页' }
```

### 3.2 核心行为

- **openView(view, appId?, opts?)**：单例视图若已有则 switchTab，否则 addTab；可重复视图每次 addTab。
- **addTab(view, appId?, opts?)**：生成 id，追加 tab，设为 active，打开面板/内容区。
- **closeTab(id)**：认证标签未登录时不可关闭（可选）；若关闭的是当前 tab 则切到相邻；若无标签则还原为 [defaultHomeTab]。
- **「创建新标签」**：固定为 addTab('home')。
- **用户项**：openView('profile')（单例，不重复建标签）。

---

## 四、实现步骤建议

1. **新增常量/类型**  
   在 `apps/web/src/constants/appView.ts`（或 `types/appView.ts`）中定义 `AppView`、`AppTab`、`VIEW_TITLES`、`SINGLE_INSTANCE_VIEWS`、`defaultHomeTab`、`isSingleInstanceView`。
2. **在 Space 中引入标签状态**  
   用 `tabs: AppTab[]`（初值 `[defaultHomeTab]`）、`activeTabId`，以及 `addTab`/`openView`/`closeTab`/`switchTab` 逻辑（可先放在 Space 内或抽成 `useAppTabs` hook）。
3. **拆分 AppTagsBar**  
   接收 `tabs`、`activeTabId`、`onSwitchTab`、`onCloseTab`、`onNewTab`、侧栏展开/固定/折叠相关 props 和 user；内部渲染：折叠/固定按钮、可滚动标签列表、创建新标签、用户项。
4. **拆分 AppContent**  
   接收 `activeTab`（或 activeTabId + tabs）、user；根据 `activeTab.view` 渲染 home | profile | auth | contacts | settings | app。
5. **接好「用户项」与「个人中心空态」**  
   用户项点击 → openView('profile')；个人中心空态「打开应用区」→ openView('profile') 并展开内容区。
6. **（可选）后续**  
   若有多处需要 openView/switchTab 且不便 props 下传，再引入 AppViewContext 或 useAppViewStore（Zustand）。

---

## 五、验收要点

- 首页、用户信息、创建新标签、多标签关闭/切换行为与 frontend 一致（单例 profile 不重复建标签）。
- 至少保留一个标签；关闭当前标签时自动切到相邻。
- 应用区折叠/固定、标签栏悬停展开与 frontend 体验一致（可按需分步做延迟展开/收起）。
- Space.tsx 行数明显减少，应用区逻辑集中在 AppTagsBar + AppContent + 常量/类型。

---

## 六、小结

| 问题 | 建议 |
|------|------|
| 是否拆分组件？ | **是**：拆出 AppTagsBar、AppContent，并抽常量/类型。 |
| 是否引入状态管理器？ | **当前不必**：用 Space 内 useState + props 即可。 |
| 何时用 Context/Zustand？ | 多入口打开标签、持久化或跨页面复用应用区状态时再引入。 |

先完成「数据结构 + 组件拆分 + 标签 CRUD 与单例逻辑」，再视需要加 Context 或 Zustand，可减少前期复杂度并便于与 frontend 对照验收。
