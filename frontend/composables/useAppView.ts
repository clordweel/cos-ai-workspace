export type AppView = 'home' | 'contacts' | 'bots'

export interface AppCard {
  id: string
  view: AppView
}

const defaultCard: AppCard = { id: 'home', view: 'home' }

/** 应用卡片栈，栈顶为当前展示；空栈时视为仅有一张 home 卡 */
const appStack = ref<AppCard[]>([])
/** 应用区是否展示；默认展示并打开导航页（导航页视作一种应用） */
const isPanelOpen = ref(true)

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
    if (view) pushCard(view)
    else if (appStack.value.length === 0) {
      appStack.value = [defaultCard] // 默认打开导航页（home）
    }
  }
  /** 切换到导航页（视作一种应用） */
  function openNavPage() {
    isPanelOpen.value = true
    appStack.value = [defaultCard]
  }
  function closePanel() {
    isPanelOpen.value = false
    appStack.value = []
  }
  return {
    appStack: readonly(appStack),
    currentView,
    canGoBack,
    isPanelOpen: readonly(isPanelOpen),
    setView,
    pushCard,
    goBack,
    removeCard,
    openPanel,
    openNavPage,
    closePanel,
  }
}
