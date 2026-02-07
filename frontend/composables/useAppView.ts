export type AppView = 'home' | 'contacts' | 'bots' | 'settings'

export interface AppCard {
  id: string
  view: AppView
}

const defaultCard: AppCard = { id: 'home', view: 'home' }

/** 应用卡片栈，栈顶为当前展示；空栈时视为仅有一张 home 卡 */
const appStack = ref<AppCard[]>([])
/** 应用区是否展示；默认展示并打开导航页（导航页视作一种应用） */
const isPanelOpen = ref(true)
/** 右侧应用内容区是否展示；为 false 时仅保留侧边栏 */
const isContentVisible = ref(true)
/** 侧边栏是否固定为展开（不随鼠标移出收起） */
const isSidebarPinned = ref(false)
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
  const stack = appStack.value
  return stack.length > 0 ? stack[stack.length - 1].view : defaultCard.view
})

const canGoBack = computed(() => appStack.value.length > 1)

export function useAppView() {
  const maxStackSize = 3

  function pushCard(view: AppView) {
    const id = `${view}-${Date.now()}`
    appStack.value = [...appStack.value, { id, view }].slice(-maxStackSize)
  }
  function goBack() {
    if (appStack.value.length <= 1) return
    appStack.value = appStack.value.slice(0, -1)
  }
  /** 移除指定索引的卡片；若为栈顶则展示下一张 */
  function removeCard(index: number) {
    const next = appStack.value.filter((_, i) => i !== index)
    if (next.length === 0) {
      isPanelOpen.value = false
      appStack.value = []
    } else {
      appStack.value = next
    }
  }
  function setView(view: AppView) {
    if (view === 'home' && appStack.value.length > 1) {
      goBack()
      return
    }
    if (view === 'home') {
      appStack.value = []
      return
    }
    pushCard(view)
  }
  function openPanel(view?: AppView) {
    isPanelOpen.value = true
    isContentVisible.value = true
    if (view) pushCard(view)
    else if (appStack.value.length === 0) {
      appStack.value = [defaultCard] // 默认打开导航页（home）
    }
  }
  /** 切换到导航页（视作一种应用） */
  function openNavPage() {
    isPanelOpen.value = true
    isContentVisible.value = true
    appStack.value = [defaultCard]
  }
  function closePanel() {
    isPanelOpen.value = false
    appStack.value = []
  }
  function toggleContentPanel() {
    isContentVisible.value = !isContentVisible.value
  }
  function toggleSidebarPinned() {
    isSidebarPinned.value = !isSidebarPinned.value
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
  /** 延迟展开侧栏：鼠标进入 nav 后悬停超过 500ms 才展开 */
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
  return {
    appStack: readonly(appStack),
    currentView,
    canGoBack,
    isPanelOpen: readonly(isPanelOpen),
    isContentVisible: readonly(isContentVisible),
    isSidebarPinned: readonly(isSidebarPinned),
    isSidebarHovered: readonly(isSidebarHovered),
    setSidebarHovered,
    scheduleSidebarExpand,
    scheduleSidebarLeave,
    cancelSidebarLeave,
    toggleContentPanel,
    toggleSidebarPinned,
    setView,
    pushCard,
    goBack,
    removeCard,
    openPanel,
    openNavPage,
    closePanel,
  }
}
