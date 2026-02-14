import {
  type AppView,
  type AppTab,
  VIEW_TITLES,
  isSingleInstanceView,
  defaultHomeTab,
} from './useAppViewConstants'

function tabTitle(view: AppView, appId?: string): string {
  if (view === 'app' && appId) {
    const ext = useAppExtensions().get(appId)
    return ext?.name ?? appId
  }
  if (appId) {
    const ext = useAppExtensions().get(appId)
    if (ext) return ext.name
  }
  return view === 'app' ? '应用' : VIEW_TITLES[view]
}

/** 已打开的标签列表；个人信息与设置不常驻，可从其它入口用 openView 打开 */
const tabs = ref<AppTab[]>([defaultHomeTab])
/** 当前选中的标签 id；null 表示无标签（面板可关闭） */
const activeTabId = ref<string | null>(defaultHomeTab.id)

/** 应用区是否展示 */
const isPanelOpen = ref(true)
/** 右侧应用内容区是否展示；为 false 时仅保留侧边栏 */
const isContentVisible = ref(true)
/** 侧边栏是否固定（锁定当前坍缩/展开状态，不随悬停变化） */
const isSidebarPinned = ref(false)
/** 固定时的展开状态：true=锁定展开，false=锁定坍缩（仅 isSidebarPinned 为 true 时有效） */
const sidebarPinnedExpanded = ref(true)
/** 侧边栏是否因鼠标悬浮而展开（由 WorkspaceAppNav 同步） */
const isSidebarHovered = ref(false)
/** 延迟收起侧栏的 timer，便于从 nav 移到工具栏时不立即折叠 */
let sidebarLeaveTimer: ReturnType<typeof setTimeout> | null = null
const SIDEBAR_LEAVE_DELAY_MS = 180
/** 延迟展开侧栏的 timer：悬停超过此时间才展开 */
let sidebarExpandTimer: ReturnType<typeof setTimeout> | null = null
const SIDEBAR_EXPAND_DELAY_MS = 500
/** 展开后在此时间内忽略收起，避免宽度动画导致 mouseleave 误触发而抖动 */
let lastExpandTime = 0
const SIDEBAR_LEAVE_GRACE_MS = 280

const currentView = computed<AppView>(() => {
  const id = activeTabId.value
  if (!id) return 'home'
  const tab = tabs.value.find((t) => t.id === id)
  return tab?.view ?? 'home'
})

/** 当前选中的标签（只读） */
const activeTab = computed(() => {
  const id = activeTabId.value
  return id ? tabs.value.find((t) => t.id === id) ?? null : null
})

const canGoBack = computed(() => tabs.value.length > 1)

/** 是否已挂载（客户端水合后为 true），用于延后应用断点逻辑，避免 SSR 与客户端首帧 isContentVisible 不一致导致水合告警 */
const isMounted = ref(false)

export function useAppView() {
  if (import.meta.client) {
    onMounted(() => { isMounted.value = true })
  }
  const isMd = useBreakpoint('md')
  const isLg = useBreakpoint('lg')
  const isXl = useBreakpoint('xl')
  /** 视口 < lg 时保持面板打开；md~lg 区间内应用区内容区初始为折叠。仅挂载后应用，保证 SSR 与客户端首帧一致。 */
  watch([isMounted, isMd, isLg], ([mounted, md, lg]) => {
    if (!mounted) return
    if (lg) return
    isPanelOpen.value = true
    const inMdLg = md && !lg
    if (inMdLg) {
      isContentVisible.value = false
    } else {
      isContentVisible.value = true
    }
  }, { immediate: true })
  /** xl 及以上强制应用区内容展开；仅挂载后应用。 */
  watch([isMounted, isXl], ([mounted, xl]) => {
    if (!mounted) return
    if (xl) isContentVisible.value = true
  }, { immediate: true })

  /** 应用标签栏是否展开：仅由用户手动操作决定（固定时的锁定状态 或 悬停展开） */
  const appSidebarExpanded = computed(() =>
    isSidebarPinned.value ? sidebarPinnedExpanded.value : isSidebarHovered.value
  )

  function genId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  /** 新增一个标签并选中，追加到列表末尾 */
  function addTab(view: AppView, appId?: string, opts?: { isAuthRequired?: boolean }) {
    const id = genId()
    const title = tabTitle(view, appId)
    const newTab: AppTab = { id, view, title, appId, isAuthRequired: opts?.isAuthRequired }
    tabs.value = [...tabs.value, newTab]
    activeTabId.value = id
    isPanelOpen.value = true
    isContentVisible.value = true
    return id
  }

  /**
   * 按「应用激活类型」打开视图：
   * - 单例视图（设置、用户信息、认证）：若已有该标签则仅切换过去，不新建
   * - 可重复创建（首页、联系人、机器人、应用扩展）：每次新建标签并选中
   */
  function openView(view: AppView, appId?: string, opts?: { isAuthRequired?: boolean }): string {
    isPanelOpen.value = true
    isContentVisible.value = true
    if (isSingleInstanceView(view)) {
      const same = (t: AppTab) =>
        t.view === view && (appId == null ? t.appId == null : t.appId === appId)
      const existing = tabs.value.find(same)
      if (existing) {
        activeTabId.value = existing.id
        return existing.id
      }
    }
    return addTab(view, appId, opts)
  }

  /** 打开认证登录标签（未登录时不可关闭）；若已有认证标签则切换过去 */
  function openAuthTab() {
    return openView('auth', undefined, { isAuthRequired: true })
  }

  /** 关闭指定标签；若为当前标签则切换到相邻标签。仅认证标签在未登录时不可关闭。 */
  function closeTab(id: string, options?: { force?: boolean }) {
    const list = tabs.value
    const tab = list.find((t) => t.id === id)
    if (!tab) return
    if (tab.isAuthRequired && !options?.force) return
    const index = list.findIndex((t) => t.id === id)
    const nextList = list.filter((t) => t.id !== id)
    if (nextList.length === 0) {
      tabs.value = [defaultHomeTab]
      activeTabId.value = defaultHomeTab.id
      return
    }
    tabs.value = nextList
    if (activeTabId.value === id) {
      const nextIndex = Math.min(index, nextList.length - 1)
      activeTabId.value = nextList[nextIndex].id
    }
  }

  /** 切换到指定标签 */
  function switchTab(id: string) {
    if (tabs.value.some((t) => t.id === id)) {
      activeTabId.value = id
      isPanelOpen.value = true
      isContentVisible.value = true
    }
  }

  /** 关闭除指定 id 外的全部标签，并选中该标签 */
  function closeOtherTabs(exceptId: string) {
    const tab = tabs.value.find((t) => t.id === exceptId)
    if (!tab || tabs.value.length <= 1) return
    tabs.value = [tab]
    activeTabId.value = exceptId
  }

  /** 关闭指定标签右侧的所有标签 */
  function closeTabsToTheRight(id: string) {
    const list = tabs.value
    const index = list.findIndex((t) => t.id === id)
    if (index < 0 || index >= list.length - 1) return
    const nextList = list.slice(0, index + 1)
    tabs.value = nextList
    if (!nextList.some((t) => t.id === activeTabId.value)) {
      activeTabId.value = nextList[nextList.length - 1].id
    }
  }

  /** 关闭全部标签，仅保留首页 */
  function closeAllTabs() {
    tabs.value = [defaultHomeTab]
    activeTabId.value = defaultHomeTab.id
  }

  /** 兼容旧 API：打开某视图（单例则切换已有标签，否则新建） */
  function setView(view: AppView) {
    openView(view)
  }

  function openPanel(view?: AppView) {
    isPanelOpen.value = true
    isContentVisible.value = true
    if (view) {
      openView(view)
    } else if (tabs.value.length === 0) {
      tabs.value = [defaultHomeTab]
      activeTabId.value = defaultHomeTab.id
    } else if (!activeTabId.value && tabs.value.length > 0) {
      activeTabId.value = tabs.value[0].id
    }
  }

  /** 打开/切换到「首页」标签：若已有无 appId 的首页标签则选中，否则新建（仅此入口单例；底部「新标签」仍用 addTab 可重复创建）。 */
  function openNavPage() {
    isPanelOpen.value = true
    isContentVisible.value = true
    const homeTab = tabs.value.find((t) => t.view === 'home' && !t.appId)
    if (homeTab) {
      activeTabId.value = homeTab.id
    } else {
      addTab('home')
    }
  }

  function closePanel() {
    isPanelOpen.value = false
    tabs.value = [defaultHomeTab]
    activeTabId.value = null
  }
  function toggleContentPanel() {
    isContentVisible.value = !isContentVisible.value
  }
  function toggleSidebarPinned() {
    if (isSidebarPinned.value) {
      isSidebarPinned.value = false
    } else {
      isSidebarPinned.value = true
      sidebarPinnedExpanded.value = isSidebarHovered.value
    }
  }
  /** 取消延迟展开（如悬停固定按钮时调用，避免触发展开） */
  function cancelSidebarExpand() {
    if (sidebarExpandTimer) {
      clearTimeout(sidebarExpandTimer)
      sidebarExpandTimer = null
    }
  }
  function setSidebarHovered(value: boolean) {
    if (sidebarExpandTimer) {
      clearTimeout(sidebarExpandTimer)
      sidebarExpandTimer = null
    }
    if (sidebarLeaveTimer) {
      clearTimeout(sidebarLeaveTimer)
      sidebarLeaveTimer = null
    }
    isSidebarHovered.value = value
  }
  /** 延迟展开侧栏：鼠标进入 nav 后悬停超过 500ms 才展开；已固定时不响应悬停 */
  function scheduleSidebarExpand() {
    if (isSidebarHovered.value || isSidebarPinned.value) return
    if (sidebarExpandTimer) return
    if (sidebarLeaveTimer) {
      clearTimeout(sidebarLeaveTimer)
      sidebarLeaveTimer = null
    }
    sidebarExpandTimer = setTimeout(() => {
      isSidebarHovered.value = true
      sidebarExpandTimer = null
      lastExpandTime = Date.now()
    }, SIDEBAR_EXPAND_DELAY_MS)
  }
  /** 延迟收起侧栏（从 nav 移出时调用，若在延迟内进入工具栏则取消） */
  function scheduleSidebarLeave() {
    if (sidebarExpandTimer) {
      clearTimeout(sidebarExpandTimer)
      sidebarExpandTimer = null
    }
    if (Date.now() - lastExpandTime < SIDEBAR_LEAVE_GRACE_MS) {
      if (sidebarLeaveTimer) {
        clearTimeout(sidebarLeaveTimer)
        sidebarLeaveTimer = null
      }
      return
    }
    if (sidebarLeaveTimer) clearTimeout(sidebarLeaveTimer)
    sidebarLeaveTimer = setTimeout(() => {
      isSidebarHovered.value = false
      sidebarLeaveTimer = null
    }, SIDEBAR_LEAVE_DELAY_MS)
  }
  /** 取消延迟收起（鼠标进入顶部工具栏时调用，保持侧栏展开以便点击固定） */
  function cancelSidebarLeave() {
    if (sidebarLeaveTimer) {
      clearTimeout(sidebarLeaveTimer)
      sidebarLeaveTimer = null
    }
  }
  /** 切换到「上一个」标签（按列表顺序） */
  function goBack() {
    const list = tabs.value
    if (list.length <= 1) return
    const idx = list.findIndex((t) => t.id === activeTabId.value)
    if (idx <= 0) return
    activeTabId.value = list[idx - 1].id
  }

  return {
    tabs: readonly(tabs),
    activeTabId: readonly(activeTabId),
    activeTab,
    currentView,
    canGoBack,
    isPanelOpen: readonly(isPanelOpen),
    isContentVisible: readonly(isContentVisible),
    appSidebarExpanded: readonly(appSidebarExpanded),
    isSidebarPinned: readonly(isSidebarPinned),
    sidebarPinnedExpanded: readonly(sidebarPinnedExpanded),
    isSidebarHovered: readonly(isSidebarHovered),
    setSidebarHovered,
    scheduleSidebarExpand,
    scheduleSidebarLeave,
    cancelSidebarLeave,
    cancelSidebarExpand,
    toggleContentPanel,
    toggleSidebarPinned,
    setView,
    addTab,
    openView,
    closeTab,
    closeOtherTabs,
    closeTabsToTheRight,
    closeAllTabs,
    switchTab,
    goBack,
    openPanel,
    openNavPage,
    openAuthTab,
    closePanel,
  }
}
