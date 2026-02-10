/**
 * Space 页（会话区）状态与逻辑：组合 useSpaceSessionList 与 useSpaceChatPane，并处理路由、注入与生命周期
 */
import { isMockSession as isMockSessionId, seedMockMessages } from '~/composables/useMockSessions'

function isBackendSessionId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    || id.startsWith('mock-session-')
    || (id.startsWith('!') && id.includes(':'))
}

export function useSpacePage() {
  const route = useRoute()
  const router = useRouter()
  const chatId = computed(() => (route.params.id as string) || undefined)

  const showChatPlaceholderOnFirstLoad = ref(true)
  const { sessionAreaFontScale } = useUISettings()

  const {
    chats,
    getMessages,
    setMessages,
    appendMessage,
    updateLastMessage,
    ensureChat,
    createNewChat,
    getConversationId,
    setConversationId,
    getNonReadCount,
    markChatAsRead,
  } = useChatSessions()

  const { loadSessions, loadSessionMessages } = useChatSessionsApi()
  const { getWithTitle } = useContactsAndBots()
  const { openPanel, openNavPage, addTab, currentView, activeTab } = useAppView()

  const mockSessionListEnabled = useMockSessionListEnabled()

  function goToChat(id: string) {
    router.push(`/space/${id}`)
  }

  function startNewChat() {
    const id = createNewChat()
    router.push(`/space/${id}`)
  }

  const listApi = useSpaceSessionList({
    chatId,
    chats,
    getMessages,
    getNonReadCount,
    ensureChat,
    goToChat,
    startNewChat,
    openPanel: (view?: string) => openPanel(view as any),
    openNavPage,
    addTab: (view: string, appId?: string) => addTab(view as any, appId),
    currentView,
    activeTab,
  })

  const paneApi = useSpaceChatPane({
    chatId,
    route,
    chats,
    getMessages,
    setMessages,
    appendMessage,
    updateLastMessage,
    ensureChat,
    getConversationId,
    setConversationId,
  })

  const isSessionExpanded = inject<Ref<boolean>>('isSessionExpanded', ref(false))
  const appContentVisible = inject<Ref<boolean>>('appContentVisible', ref(false))
  const showAppPanel = inject<Ref<boolean>>('showAppPanel', ref(false))

  watch(chatId, (id) => {
    if (id) markChatAsRead(id)
  }, { immediate: true })

  watch(chatId, (id) => {
    if (id && isBackendSessionId(id) && getMessages(id).length === 0) {
      loadSessionMessages(id).catch(() => {})
    }
  })

  watch(() => route.query.app, (app) => {
    if (app === 'contacts' || app === 'bots') openPanel(app as any)
  })

  onMounted(() => {
    const t = setTimeout(() => { showChatPlaceholderOnFirstLoad.value = false }, 120)
    onBeforeUnmount(() => clearTimeout(t))

    const id = chatId.value
    if (id) {
      if (!isMockSessionId(id)) {
        const c = chats.value.find((x) => x.id === id)
        if (!c) {
          const title = getWithTitle(id) ?? '会话'
          ensureChat(id, title)
        }
        if (isBackendSessionId(id) && getMessages(id).length === 0) {
          loadSessionMessages(id).catch(() => {})
        }
      }
    } else {
      const app = route.query.app as 'contacts' | 'bots' | undefined
      if (app === 'contacts' || app === 'bots') openPanel(app)
    }

    loadSessions().catch(() => {})
    if (mockSessionListEnabled.value) seedMockMessages(getMessages, setMessages)
  })

  onMounted(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.ctrlKey && e.shiftKey && paneApi.streaming.value) {
        e.preventDefault()
        paneApi.stopStream()
      }
    }
    window.addEventListener('keydown', onKey)
    onUnmounted(() => window.removeEventListener('keydown', onKey))
  })

  function openAddParticipant() {
    openPanel('contacts')
  }

  return {
    chatId,
    showChatPlaceholderOnFirstLoad,
    sessionAreaFontScale,
    isSessionExpanded,
    appContentVisible,
    showAppPanel,
    openAddParticipant,
    ...listApi,
    ...paneApi,
  }
}
