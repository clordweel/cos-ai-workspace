export type AppView = 'home' | 'contacts' | 'bots' | 'settings' | 'auth'

/** 侧栏「标签」：类似浏览器标签，可多开、切换、关闭 */
export interface AppTab {
  id: string
  view: AppView
  title: string
  appId?: string
  /** 认证标签：未登录时不可关闭 */
  isAuthRequired?: boolean
}

const VIEW_TITLES: Record<AppView, string> = {
  home: '首页',
  contacts: '联系人',
  bots: '机器人',
  settings: '设置',
  auth: '认证登录',
}

const APP_TITLES: Record<string, string> = {
  material: '物料助手',
  order: '订单进度',
  bom: 'BOM 状态',
  inventory: '库存概览',
}

function tabTitle(view: AppView, appId?: string): string {
  if (appId && APP_TITLES[appId]) return APP_TITLES[appId]
  return VIEW_TITLES[view]
}

const defaultHomeTab: AppTab = { id: 'tab-home-default', view: 'home', title: '首页' }

/** 已打开的标签列表（侧栏展示顺序）；默认一个首页标签 */
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

export function useAppView() {
  function genId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  /** 新增一个标签并选中（不复用同 view 的标签，类似浏览器新开） */
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

  /** 打开认证登录标签（未登录时不可关闭）；若已有认证标签则切换过去 */
  function openAuthTab() {
    isPanelOpen.value = true
    isContentVisible.value = true
    const authTab = tabs.value.find((t) => t.view === 'auth')
    if (authTab) {
      activeTabId.value = authTab.id
      return authTab.id
    }
    return addTab('auth', undefined, { isAuthRequired: true })
  }

  /** 关闭指定标签；若为当前标签则切换到相邻标签。认证标签（isAuthRequired）在未登录时不可关闭。 */
  function closeTab(id: string, options?: { force?: boolean }) {
    const list = tabs.value
    const tab = list.find((t) => t.id === id)
    if (!tab) return
    if (tab.isAuthRequired && !options?.force) return
    const index = list.findIndex((t) => t.id === id)
    const nextList = list.filter((t) => t.id !== id)
    if (nextList.length === 0) {
      isPanelOpen.value = false
      tabs.value = []
      activeTabId.value = null
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

  /** 兼容旧 API：在标签模型中「打开」某视图 = 新增标签并选中 */
  function setView(view: AppView) {
    addTab(view)
  }

  function openPanel(view?: AppView) {
    isPanelOpen.value = true
    isContentVisible.value = true
    if (view) {
      addTab(view)
    } else if (tabs.value.length === 0) {
      addTab('home')
    }
  }

  /** 打开/切换到「首页」标签：若已有首页标签则选中，否则新建 */
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
    tabs.value = []
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
    closeTab,
    switchTab,
    goBack,
    openPanel,
    openNavPage,
    openAuthTab,
    closePanel,
  }
}
