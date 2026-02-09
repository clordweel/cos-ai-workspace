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
  const isSm = useBreakpoint('sm')
  /** 视口 >= lg(1024px) 才会话区可左右双栏；低于 lg 为单栏（sm 且应用区折叠时仍为双栏） */
  const isSessionWide = useBreakpoint('lg')
  /** 仅客户端挂载后才使用断点，避免 SSR 与首屏 hydration 时不一致导致布局错乱 */
  const isMounted = ref(false)
  onMounted(() => { isMounted.value = true })
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

  /** 会话区是否「展开」：挂载后 >= lg 时 xl 或应用区折叠则双栏；< lg 时仅 sm 且应用区折叠则为双栏，否则单栏 */
  const isSessionExpanded = computed(() => {
    const appCollapsed = !isPanelOpen.value || !isContentVisible.value
    if (!isMounted.value) return appCollapsed
    if (isSessionWide.value) return isXl.value || appCollapsed
    return isSm.value && appCollapsed
  })

  /** 会话区宽度类：< lg 单栏时占满剩余；>= lg 按原逻辑；首屏与 SSR 一致 */
  const sessionAreaClass = computed(() => {
    if (!isPanelOpen.value) return 'max-w-none'
    if (isPanelOpen.value && !isContentVisible.value) return 'max-w-none mr-3'
    if (isMounted.value && !isSessionWide.value) return 'max-w-none mr-3'
    if (isMounted.value && isXl.value) return 'max-w-none mr-3'
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
