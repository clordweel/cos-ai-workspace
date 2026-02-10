/**
 * Workspace 全局布局状态与空间分配
 *
 * 使用 CSS Grid 管理左栏（会话区）与右栏（应用区），由语义化断点与 UI 状态决定列宽。
 *
 * 断点（语义化，从窄到宽）：
 * - xxs: viewport ≤ 320px — 默认仅会话列表，点击会话切换到聊天（仅列表 / 仅聊天二选一）
 * - xs:  ≥ 320px
 * - sm:  ≥ 640px
 * - md:  ≥ 768px
 * - lg:  ≥ 1024px
 * - xl:  ≥ 1280px
 *
 * 左栏（会话区）行为：
 * | 视口   | 应用区关闭 | 应用区展开                 |
 * |--------|------------|----------------------------|
 * | < sm   | 1fr        | 1fr（应用区不显示，单栏会话） |
 * | sm~md  | 1fr        | 1fr（应用区不显示，双栏会话） |
 * | md~lg  | 1fr        | 1fr + 应用区（auto 适应宽度） |
 * | lg+    | 1fr        | 1fr + 应用区（auto 适应宽度） |
 *
 * 右栏（应用区）：关闭或 < md 不渲染；否则 grid 列为 auto，由内容与 max-width 约束自适应。
 *
 * 会话区内部（列表 vs 聊天）：由 isSessionExpanded 控制。
 * - < sm：单栏（仅列表或仅聊天）
 * - sm+（含 xl）：双栏，列表 w-72 与聊天左右并排
 */

export type WorkspaceLayoutMode =
  | 'list_app_content_expanded'
  | 'list_chat_app_content_expanded'
  | 'list_chat_app_tabs_content_collapsed'
  | 'list_chat_app_sidebar_content_collapsed'

/** 应用区最大宽度（px），右栏 grid 列宽上限 */
export const WORKSPACE_APP_PANEL_MAX_WIDTH_PX = 1000
/** 会话列表固定宽度（折叠会话区时左栏宽度），与 w-72 一致 */
const SESSION_LIST_WIDTH_PX = 288

export function useWorkspaceLayout() {
  const route = useRoute()
  const isXxs = useBreakpoint('xxs')
  const isXl = useBreakpoint('xl')
  const isSm = useBreakpoint('sm')
  const isMd = useBreakpoint('md')
  const isLg = useBreakpoint('lg')
  const isMounted = ref(false)
  onMounted(() => { isMounted.value = true })

  const {
    isPanelOpen,
    isContentVisible,
    appSidebarExpanded,
  } = useAppView()

  const hasChat = computed(() => {
    const path = route.path
    if (!path.startsWith('/space')) return false
    const rest = path.slice('/space'.length)
    const id = rest === '' || rest === '/' ? undefined : rest.replace(/^\//, '').split('/')[0]
    return !!id
  })

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

  /** 会话区是否「展开」：列表与聊天左右并排，列表固定 w-72。断点 ≤ sm 完全单栏；≥ md 双栏；有 chat 时首屏双栏（挂载后 ≤ sm 仍单栏） */
  const isSessionExpanded = computed(() => {
    if (hasChat.value) {
      if (isMounted.value && (isXxs.value || (!isMd.value && !isLg.value))) return false
      return true
    }
    if (!isMounted.value) return !isPanelOpen.value || !isContentVisible.value
    if (isXxs.value) return false
    if (isMd.value || isLg.value) return true
    return false
  })

  /** 应用区内容是否展开（面板打开且内容区可见）；用于应用区展开时隐藏会话聊天区 */
  const appContentVisible = computed(() => isPanelOpen.value && isContentVisible.value)

  /**
   * Grid 两列 [会话区 | 应用区]：
   * - xl+ 且应用区展开：'1fr auto'，会话列 1fr（列表 w-72 + 聊天 flex-1 共享）
   * - md～lg 且应用区展开：'288px 1fr'，会话列仅 288px（仅列表，聊天被挤出）
   * - 其他：'1fr auto' 或 '1fr 0fr'
   * layout 内用 isXlFromViewport 覆盖为 effectiveGridColumns，保证挂载后 xl 正确。
   */
  const gridTemplateColumns = computed(() => {
    const open = isPanelOpen.value
    const contentVisible = isContentVisible.value
    if (!open) return '1fr 0fr'
    if (isMounted.value && !isMd.value && !isLg.value) return '1fr 0fr'
    if (open && contentVisible) {
      if (isXl.value) return '1fr auto'
      return `${SESSION_LIST_WIDTH_PX}px 1fr`
    }
    return '1fr auto'
  })

  /** < md 不渲染应用区；md~lg 与 lg+ 渲染，折叠按钮控制内容区展开/折叠 */
  const showAppPanel = computed(() => isPanelOpen.value && (isMounted.value ? (isMd.value || isLg.value) : true))

  const appPanelMaxWidthCss = `${WORKSPACE_APP_PANEL_MAX_WIDTH_PX}px`

  return {
    hasChat: readonly(hasChat),
    layoutMode: readonly(layoutMode),
    isSessionExpanded: readonly(isSessionExpanded),
    appContentVisible: readonly(appContentVisible),
    gridTemplateColumns: readonly(gridTemplateColumns),
    showAppPanel: readonly(showAppPanel),
    isXxs: readonly(isXxs),
    isXl: readonly(isXl),
    appPanelMaxWidthCss,
    appPanelMaxWidthPx: WORKSPACE_APP_PANEL_MAX_WIDTH_PX,
  }
}
