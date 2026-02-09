/**
 * Workspace 全局布局状态与空间分配
 *
 * UI 区块状态（单一数据源）：
 * - 会话列表：始终展示
 * - 会话聊天：有 chatId 时展示（由 route 决定）
 * - 应用标签栏：折叠 | 展开（由 useAppView 侧栏状态决定）
 * - 应用内容区：展开 | 折叠（由 useAppView isContentVisible 决定）
 *
 * 四种典型布局模式：
 * 1. 会话列表 + 应用标签栏折叠 + 应用内容展开（默认）
 * 2. 会话列表 + 会话聊天 + 应用标签折叠 + 应用内容展开
 * 3. 会话列表 + 会话聊天 + 应用标签折叠 + 应用内容折叠
 * 4. 会话列表 + 会话聊天 + 应用标签展开 + 应用内容折叠
 *
 * 空间分配完全由当前 UI 状态推导，不依赖 ResizeObserver。
 */

export type WorkspaceLayoutMode =
  | 'list_app_content_expanded'           // 1. 列表 + 应用标签折叠 + 应用内容展开（默认）
  | 'list_chat_app_content_expanded'      // 2. 列表+聊天 + 应用标签折叠 + 应用内容展开
  | 'list_chat_app_tabs_content_collapsed' // 3. 列表+聊天 + 应用标签折叠 + 应用内容折叠
  | 'list_chat_app_sidebar_content_collapsed' // 4. 列表+聊天 + 应用标签展开 + 应用内容折叠

/** 应用区最大宽度（px），超出部分归会话区 */
export const WORKSPACE_APP_PANEL_MAX_WIDTH_PX = 1000

export function useWorkspaceLayout() {
  const route = useRoute()
  const isXl = useBreakpoint('xl')
  const {
    isPanelOpen,
    isContentVisible,
    appSidebarExpanded,
  } = useAppView()

  /** 当前是否有会话聊天（由路由 /space/:id 决定） */
  const hasChat = computed(() => {
    const path = route.path
    if (!path.startsWith('/space')) return false
    const rest = path.slice('/space'.length)
    const id = rest === '' || rest === '/' ? undefined : rest.replace(/^\//, '').split('/')[0]
    return !!id
  })

  /** 当前布局模式（由 UI 状态推导） */
  const layoutMode = computed<WorkspaceLayoutMode>(() => {
    const panelOpen = isPanelOpen.value
    const contentVisible = isContentVisible.value
    const sidebarExpanded = appSidebarExpanded.value

    if (!panelOpen) {
      return hasChat.value ? 'list_chat_app_content_expanded' : 'list_app_content_expanded'
    }
    if (contentVisible) {
      return hasChat.value ? 'list_chat_app_content_expanded' : 'list_app_content_expanded'
    }
    if (sidebarExpanded) {
      return 'list_chat_app_sidebar_content_collapsed'
    }
    return 'list_chat_app_tabs_content_collapsed'
  })

  /** 会话区是否「展开」：xl 断点及以上或应用区关闭/内容区折叠时为 true，会话列表与聊天左右并排 */
  const isSessionExpanded = computed(() => isXl.value || !isPanelOpen.value || !isContentVisible.value)

  /** 会话区宽度类：xl 时三栏（列表+聊天+应用）均展开，会话区占满除应用区外的空间；非 xl 且应用内容展开时会话区收窄为 max-w-sm */
  const sessionAreaClass = computed(() => {
    if (!isPanelOpen.value) return 'max-w-none'
    if (isPanelOpen.value && !isContentVisible.value) return 'max-w-none mr-3'
    if (isXl.value) return 'max-w-none mr-3'
    return 'max-w-sm mr-3'
  })

  /** 应用区是否需限制最大宽度（打开时始终限制） */
  const appPanelMaxWidthCss = `${WORKSPACE_APP_PANEL_MAX_WIDTH_PX}px`

  return {
    hasChat: readonly(hasChat),
    layoutMode: readonly(layoutMode),
    isSessionExpanded: readonly(isSessionExpanded),
    sessionAreaClass: readonly(sessionAreaClass),
    appPanelMaxWidthCss,
    appPanelMaxWidthPx: WORKSPACE_APP_PANEL_MAX_WIDTH_PX,
  }
}
