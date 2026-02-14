/**
 * 会话区左侧列表与抽屉状态：列表 Tab、搜索、置顶、Mock 会话、应用抽屉
 * 供 space 页 useSpacePage 使用，便于按需加载与维护
 */
import { BarChart3, Bot, ClipboardList, Home, Layers, LogIn, Package, Settings, Users } from 'lucide-vue-next'
import { restoreBodyStylesAfterDialog } from '~/composables/restoreBodyAfterDialog'
import type { MockSessionItem } from '~/mock'
import {
  getMockSessionById,
  getMockSessionList,
  useMockSessionListEnabled,
  isMockSession as isMockSessionId,
} from '~/composables/useMockSessions'
import { useAppExtensions } from '~/composables/useAppExtensions'

export type ListViewTab = 'active' | 'favorites' | 'pending' | 'settings'

export type DrawerAppItem =
  | { id: string; title: string; icon: import('vue').Component; view: 'home' | 'auth' | 'contacts' | 'bots' | 'settings' | 'profile' }
  | { id: string; title: string; icon: import('vue').Component; appId: string }
  | { id: string; title: string; icon: import('vue').Component }

export type DisplayChatItem = {
  id: string
  title: string
  type?: MockSessionItem['type']
  updatedAt?: number
  participants?: MockSessionItem['participants']
}

const APP_DRAWER_HEIGHT_REM = 24
/** 会话列表顶栏高度 (h-12)，与 SessionListHeader 一致 */
const SESSION_LIST_HEADER_HEIGHT_REM = 3

/** 置顶 ID 列表：模块级单例，避免点击会话导致页面/composable 重跑时被重新初始化为 [] */
const pinnedIds = ref<string[]>([])

export function useSpaceSessionList(options: {
  chatId: Ref<string | undefined>
  chats: Ref<Array<{ id: string; title?: string; updatedAt?: number }>>
  getMessages: (id: string) => Array<{ role: string; content: string }>
  getNonReadCount: (id: string) => number
  ensureChat: (id: string, title: string) => void
  goToChat: (id: string) => void
  startNewChat: () => void
  openPanel: (view?: string) => void
  openNavPage: () => void
  addTab: (view: string, appId?: string) => string
  currentView: Ref<string>
  activeTab: Ref<{ view: string; appId?: string } | null>
  /** Matrix 待接受邀请列表 */
  invitedSessions?: Ref<{ id: string; title: string }[]>
  onAcceptInvite?: (id: string, title: string) => void | Promise<void>
  onDeclineInvite?: (id: string) => void | Promise<void>
  /** 删除前回调（如弹出确认框）；若提供则不再直接调用 deleteSession */
  onBeforeDeleteSession?: (id: string) => void | Promise<void>
}) {
  const router = useRouter()
  const {
    chatId,
    chats,
    getMessages,
    getNonReadCount,
    ensureChat,
    goToChat,
    startNewChat,
    openPanel,
    openNavPage,
    addTab,
    currentView,
    activeTab,
    invitedSessions = ref([]),
    onAcceptInvite,
    onDeclineInvite,
    onBeforeDeleteSession,
  } = options

  const searchQuery = ref('')
  const showAppList = ref(false)
  const showSearchBar = ref(false)
  const listViewTab = ref<ListViewTab>('active')
  const pinnedCollapsed = ref(false)
  const mockCollapsed = ref(true)
  const mockTitleOverrides = ref<Record<string, string>>({})
  const mockHiddenIds = ref<string[]>([])

  const { list: appExtensionsList } = useAppExtensions()
  const { isAuthenticated } = useAuth()
  const { favoriteIds } = useAppFavorites()
  const mockSessionListEnabled = useMockSessionListEnabled()
  const { deleteSession, renameSession, fetchPinnedSessions, setPinnedSessions } = useChatSessionsApi()

  const drawerCommonApps = computed<DrawerAppItem[]>(() => [
    { id: 'home', title: '导航', view: 'home', icon: Home },
    { id: 'auth', title: '认证登录', view: 'auth', icon: LogIn },
    { id: 'contacts', title: '联系人', view: 'contacts', icon: Users },
    { id: 'bots', title: '机器人', view: 'bots', icon: Bot },
    { id: 'settings', title: '设置', view: 'settings', icon: Settings },
  ])

  const DRAWER_FAVORITE_MOCK_APPS: DrawerAppItem[] = [
    { id: 'mock-material', title: '物料助手', icon: Package },
    { id: 'mock-order', title: '订单进度', icon: ClipboardList },
    { id: 'mock-bom', title: 'BOM 状态', icon: Layers },
    { id: 'mock-inventory', title: '库存概览', icon: BarChart3 },
  ]

  const drawerFavoriteApps = computed<DrawerAppItem[]>(() => {
    const ids = favoriteIds.value
    const list: DrawerAppItem[] = appExtensionsList.value
      .filter((ext) => ids.includes(ext.id) && (!ext.requireAuth || isAuthenticated.value))
      .map((ext) => ({
        id: `ext-${ext.id}`,
        title: ext.name,
        icon: ext.icon,
        appId: ext.id,
      }))
    return [...list, ...DRAWER_FAVORITE_MOCK_APPS]
  })

  const filteredChats = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return chats.value
    return chats.value.filter((c) => {
      const title = (c.title ?? '').toLowerCase()
      const preview = lastPreview(c.id).toLowerCase()
      return title.includes(q) || preview.includes(q)
    })
  })

  const displayChats = computed<DisplayChatItem[]>(() => {
    const real = filteredChats.value.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
    }))
    if (!mockSessionListEnabled.value) return real
    const realIds = new Set(real.map((c) => c.id))
    const mockList = getMockSessionList()
      .filter((m) => !mockHiddenIds.value.includes(m.id) && !realIds.has(m.id))
      .map((m) => ({
        ...m,
        title: mockTitleOverrides.value[m.id] ?? m.title,
      }))
    return [...real, ...mockList]
  })

  const pinnedChats = computed<DisplayChatItem[]>(() =>
    displayChats.value.filter((c) => pinnedIds.value.includes(c.id))
  )
  const mockChats = computed<DisplayChatItem[]>(() => {
    if (!mockSessionListEnabled.value) return []
    return displayChats.value.filter(
      (c) => isMockSessionId(c.id) && !pinnedIds.value.includes(c.id)
    )
  })
  /** 仅按数据顺序展示，不因选中而置顶；排序由 touchChatUpdatedAt（发消息时）驱动 */
  const activeChats = computed<DisplayChatItem[]>(() => {
    const base = mockSessionListEnabled.value
      ? displayChats.value.filter((c) => !isMockSessionId(c.id))
      : displayChats.value
    return base.filter((c) => !pinnedIds.value.includes(c.id))
  })
  const pendingChats = computed<DisplayChatItem[]>(() =>
    displayChats.value.filter((c) => getNonReadCount(c.id) > 0)
  )
  const totalPendingCount = computed(() =>
    displayChats.value.reduce((sum, c) => sum + getNonReadCount(c.id), 0)
  )

  /** 顶栏在文档流中；抽屉推动整块下移，列表内容仅留顶栏高度 */
  const listPaddingTop = computed(() => `${SESSION_LIST_HEADER_HEIGHT_REM}rem`)

  const isMounted = ref(false)
  onMounted(() => { isMounted.value = true })

  function lastPreview(cid: string): string {
    const list = getMessages(cid)
    if (list.length === 0) return '点击开始对话'
    const last = list[list.length - 1]
    const text = last.content.trim()
    return text ? (text.length > 20 ? `${text.slice(0, 20)}…` : text) : '点击开始对话'
  }

  function formatChatDate(ts: number): string {
    const d = new Date(ts)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return '今天'
    if (d.toDateString() === yesterday.toDateString()) return '昨天'
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }

  /** 水合前返回空，避免服务端与客户端日期/时区/数据不一致导致 hydration mismatch；挂载后再显示日期 */
  function getChatDateLabel(id: string): string {
    if (!isMounted.value) return ''
    const mock = getMockSessionById(id)
    const ts = mock ? mock.updatedAt : chats.value.find((x) => x.id === id)?.updatedAt
    if (ts == null) return ''
    return formatChatDate(ts)
  }

  function isMockSession(id: string) {
    return id.startsWith('mock-')
  }

  function setSearchQuery(v: string) { searchQuery.value = v }
  function setListViewTab(v: ListViewTab) { listViewTab.value = v }
  function toggleAppList() { showAppList.value = !showAppList.value }
  function toggleSearchBar() { showSearchBar.value = !showSearchBar.value }

  function onSessionItemClick(id: string) {
    goToChat(id)
  }

  function togglePin(id: string) {
    const idx = pinnedIds.value.indexOf(id)
    if (idx >= 0) {
      pinnedIds.value = pinnedIds.value.filter((x) => x !== id)
    } else {
      pinnedIds.value = [...pinnedIds.value, id]
    }
    setPinnedSessions(pinnedIds.value).catch(() => {})
  }

  async function loadPinnedFromBackend() {
    const ids = await fetchPinnedSessions()
    const cur = pinnedIds.value
    if (ids.length !== cur.length || ids.some((id, i) => id !== cur[i])) {
      pinnedIds.value = ids
    }
  }

  function onDrawerAppClick(app: DrawerAppItem) {
    if (app.id.startsWith('mock-')) {
      onDrawerMore()
      return
    }
    if ('appId' in app && app.appId) {
      addTab('app', app.appId)
      return
    }
    if ('view' in app && app.view) {
      if (app.view === 'home') openNavPage()
      else openPanel(app.view)
    }
  }

  function onDrawerMore() {
    openNavPage()
    showAppList.value = false
  }

  const renameDialogOpen = ref(false)
  const renameSessionId = ref<string>('')
  const renameCurrentTitle = ref('')

  function onSessionRename(id: string) {
    const c = displayChats.value.find((x) => x.id === id)
    renameSessionId.value = id
    renameCurrentTitle.value = c?.title ?? ''
    renameDialogOpen.value = true
  }

  function closeRenameDialog() {
    renameDialogOpen.value = false
    renameSessionId.value = ''
    renameCurrentTitle.value = ''
    restoreBodyStylesAfterDialog()
  }

  async function confirmRename(title: string) {
    const id = renameSessionId.value
    const t = title.trim()
    if (!id || !t) {
      closeRenameDialog()
      return
    }
    if (isMockSession(id)) {
      mockTitleOverrides.value = { ...mockTitleOverrides.value, [id]: t }
    } else {
      await renameSession(id, t)
    }
    closeRenameDialog()
  }

  async function onSessionDelete(id: string) {
    if (onBeforeDeleteSession) {
      await onBeforeDeleteSession(id)
      return
    }
    if (isMockSession(id)) {
      if (!mockHiddenIds.value.includes(id)) {
        mockHiddenIds.value = [...mockHiddenIds.value, id]
      }
    }
    await deleteSession(id)
    if (chatId.value === id) {
      router.replace('/space')
    }
  }

  function drawerAppActive(app: DrawerAppItem): boolean {
    if ('view' in app && app.view) return currentView.value === app.view
    if ('appId' in app && app.appId) return activeTab.value?.view === 'app' && activeTab.value?.appId === app.appId
    return false
  }

  return {
    appDrawerHeightRem: APP_DRAWER_HEIGHT_REM,
    searchQuery,
    showAppList,
    showSearchBar,
    listViewTab,
    pinnedCollapsed,
    pinnedIds,
    mockCollapsed,
    mockTitleOverrides,
    mockHiddenIds,
    mockSessionListEnabled,
    drawerCommonApps,
    drawerFavoriteApps,
    displayChats,
    pinnedChats,
    mockChats,
    activeChats,
    pendingChats,
    totalPendingCount,
    listPaddingTop,
    getChatDateLabel,
    getNonReadCount,
    isMockSession,
    setSearchQuery,
    setListViewTab,
    toggleAppList,
    toggleSearchBar,
    onSessionItemClick,
    togglePin,
    onSessionRename,
    onSessionDelete,
    renameDialogOpen,
    renameSessionId,
    renameCurrentTitle,
    closeRenameDialog,
    confirmRename,
    loadPinnedFromBackend,
    onDrawerAppClick,
    onDrawerMore,
    drawerAppActive,
    invitedSessions,
    onAcceptInvite,
    onDeclineInvite,
  }
}
