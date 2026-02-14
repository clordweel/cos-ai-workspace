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
    isSessionLeftRoom,
  } = useChatSessions()

  const config = useRuntimeConfig()
  const chatProvider = (config.public?.chatProvider as string) || ''

  const {
    loadSessions,
    loadSessionMessages,
    createSession,
    inviteToSession,
    fetchInvitedSessions,
    fetchSessionMembers,
    kickFromSession,
    banFromSession,
    joinSession,
    deleteSession: deleteSessionApi,
  } = useChatSessionsApi()
  const { getWithTitle, contacts } = useContactsAndBots()
  const { openPanel, openNavPage, addTab, currentView, activeTab } = useAppView()

  const mockSessionListEnabled = useMockSessionListEnabled()

  /** Matrix 实时消息：token 可用时启动 sync（含 auth 晚于 mount 完成的情况）；失败时单次延迟重试 */
  const {
    hasSyncToken,
    startSyncClient,
    setCurrentRoomId,
    invitedRoomsFromSync,
    syncReady,
    syncClient,
    fillMessagesFromSyncTimeline,
  } = useMatrixSyncClient()
  let syncRetryTimer: ReturnType<typeof setTimeout> | null = null
  function tryStartSync() {
    if (!hasSyncToken.value) return
    startSyncClient()
      .then((client) => {
        if (client == null && hasSyncToken.value && !syncRetryTimer) {
          syncRetryTimer = setTimeout(() => {
            syncRetryTimer = null
            startSyncClient().catch(() => {})
          }, 2500)
        }
      })
      .catch(() => {})
  }
  watch(hasSyncToken, (v) => {
    if (syncRetryTimer) {
      clearTimeout(syncRetryTimer)
      syncRetryTimer = null
    }
    if (v) tryStartSync()
  }, { immediate: true })
  onBeforeUnmount(() => {
    if (syncRetryTimer) clearTimeout(syncRetryTimer)
  })

  function goToChat(id: string) {
    router.push(`/space/${id}`)
  }

  const creatingSession = ref(false)
  const createSessionError = ref<string | null>(null)
  const showCreateSessionDialog = ref(false)

  async function startNewChat() {
    createSessionError.value = null
    if (chatProvider === 'matrix') {
      creatingSession.value = true
      try {
        const id = await createSession('新会话')
        if (id) {
          ensureChat(id, '新会话')
          setConversationId(id, id)
          router.push(`/space/${id}`)
          return
        }
        createSessionError.value = '创建会话失败，请刷新后重试'
      } catch (e) {
        createSessionError.value = e instanceof Error ? e.message : '创建会话失败，请刷新后重试'
      } finally {
        creatingSession.value = false
      }
      return
    }
    const id = createNewChat()
    router.push(`/space/${id}`)
  }

  /** 点击「新会话」时打开弹窗选择 Solo 或对话人（Matrix 时）；mock 时直接创建 */
  function openCreateSessionDialog() {
    createSessionError.value = null
    if (chatProvider !== 'matrix') {
      startNewChat()
      return
    }
    showCreateSessionDialog.value = true
  }

  async function startNewChatWithContact(contact: { id: string; name: string }) {
    createSessionError.value = null
    creatingSession.value = true
    try {
      const id = await createSession(contact.name)
      if (!id) {
        createSessionError.value = '创建会话失败，请刷新后重试'
        return
      }
      const invited = await inviteToSession(id, contact.id)
      ensureChat(id, contact.name)
      setConversationId(id, id)
      router.push(`/space/${id}`)
      showCreateSessionDialog.value = false
      if (!invited) {
        createSessionError.value = '会话已创建，邀请对方失败，可在会话中重试'
      }
    } catch (e) {
      createSessionError.value = e instanceof Error ? e.message : '创建会话失败，请刷新后重试'
    } finally {
      creatingSession.value = false
    }
  }

  function onCreateSessionSelectSolo() {
    startNewChat()
    showCreateSessionDialog.value = false
  }

  const chatScrollElRef = ref<HTMLElement | null>(null)

  const invitedSessions = ref<{ id: string; title: string }[]>([])
  /** 接受/拒绝后乐观移除，避免列表残留（Sync 源需等下一轮 sync 才从 SDK 消失） */
  const optimisticRemovedInviteIds = ref<string[]>([])

  async function loadInvitedSessions() {
    const list = await fetchInvitedSessions()
    invitedSessions.value = list
  }

  /** 优先使用 Sync 实时邀请列表（Cinny 方案），未就绪时用 API 列表 */
  const effectiveInvitedSessions = computed(() => {
    const list =
      chatProvider === 'matrix' && syncReady.value && syncClient.value
        ? invitedRoomsFromSync.value
        : invitedSessions.value
    const removed = optimisticRemovedInviteIds.value
    return removed.length ? list.filter((inv) => !removed.includes(inv.id)) : list
  })

  watch(
    () =>
      chatProvider === 'matrix' && syncReady.value && syncClient.value
        ? invitedRoomsFromSync.value.map((i) => i.id)
        : invitedSessions.value.map((i) => i.id),
    (sourceIds) => {
      const set = new Set(sourceIds)
      const prev = optimisticRemovedInviteIds.value
      const next = prev.filter((id) => set.has(id))
      if (next.length !== prev.length) optimisticRemovedInviteIds.value = next
    },
  )

  async function onAcceptInvite(id: string, title: string) {
    const ok = await joinSession(id)
    if (!ok) return
    ensureChat(id, title)
    setConversationId(id, id)
    optimisticRemovedInviteIds.value = [...optimisticRemovedInviteIds.value, id]
    invitedSessions.value = invitedSessions.value.filter((inv) => inv.id !== id)
    await loadSessions()
    loadInvitedSessions().catch(() => {})
    let loaded = await loadSessionMessages(id).catch(() => false)
    if (!loaded && getMessages(id).length === 0) {
      await new Promise((r) => setTimeout(r, 400))
      loaded = await loadSessionMessages(id).catch(() => false)
    }
    if (getMessages(id).length === 0 && syncReady.value) {
      tryFillFromSyncWithRetry(id)
    }
    goToChat(id)
  }
  async function onDeclineInvite(id: string) {
    await deleteSessionApi(id)
    optimisticRemovedInviteIds.value = [...optimisticRemovedInviteIds.value, id]
    invitedSessions.value = invitedSessions.value.filter((inv) => inv.id !== id)
    loadInvitedSessions().catch(() => {})
  }

  const listApi = useSpaceSessionList({
    chatId,
    chats,
    getMessages,
    getNonReadCount,
    ensureChat,
    goToChat,
    startNewChat: openCreateSessionDialog,
    openPanel: (view?: string) => openPanel(view as any),
    openNavPage,
    addTab: (view: string, appId?: string) => addTab(view as any, appId),
    currentView,
    activeTab,
    invitedSessions: effectiveInvitedSessions,
    onAcceptInvite,
    onDeclineInvite,
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
    onRenameSession: listApi.onSessionRename,
    getChatScrollElement: () => chatScrollElRef.value,
  })

  const isSessionExpanded = inject<Ref<boolean>>('isSessionExpanded', ref(false))
  const appContentVisible = inject<Ref<boolean>>('appContentVisible', ref(false))
  const showAppPanel = inject<Ref<boolean>>('showAppPanel', ref(false))

  watch(chatId, (id) => {
    if (id) markChatAsRead(id)
  }, { immediate: true })

  /** 同步当前展示房间 id，供 Sync 端 TimelineRefresh（如加密房间解密完成）时仅重填该房间 */
  watch(chatId, (id) => {
    setCurrentRoomId(id ?? undefined)
  }, { immediate: true })

  /** 从 Sync 填充消息；加密房间解密可能滞后（对方回复的 key 晚到），故多次重试 */
  const FILL_RETRY_DELAYS_MS = [1500, 3000, 5000, 8000]
  function tryFillFromSyncWithRetry(roomId: string) {
    let attempt = 0
    function tryOnce() {
      fillMessagesFromSyncTimeline(roomId).then((filled) => {
        if (filled) return
        const delay = FILL_RETRY_DELAYS_MS[attempt]
        if (delay != null && chatId.value === roomId) {
          attempt += 1
          setTimeout(() => {
            if (chatId.value === roomId) tryOnce()
          }, delay)
        }
      })
    }
    tryOnce()
  }

  watch(chatId, async (id) => {
    if (!id || !isBackendSessionId(id)) return
    if (getMessages(id).length > 0) return
    await loadSessionMessages(id).catch(() => {})
    if (getMessages(id).length === 0 && chatProvider === 'matrix' && syncReady.value) {
      tryFillFromSyncWithRetry(id)
    }
  }, { immediate: true })

  /** Sync 就绪后若当前会话仍无消息（如加密房间 REST 无明文），用 Sync timeline 填充 */
  watch(syncReady, (ready) => {
    if (!ready) return
    const id = chatId.value
    if (!id || !isBackendSessionId(id) || getMessages(id).length > 0) return
    tryFillFromSyncWithRetry(id)
  }, { immediate: true })

  const sessionMembers = ref<import('~/composables/useChatSessionsApi').ApiSessionMember[]>([])
  watch(chatId, async (id) => {
    if (!id) {
      sessionMembers.value = []
      return
    }
    sessionMembers.value = await fetchSessionMembers(id)
  }, { immediate: true })

  async function refetchSessionMembers() {
    const id = chatId.value
    if (!id) return []
    const list = await fetchSessionMembers(id)
    sessionMembers.value = list
    return list
  }

  /** 有消息时立即显示聊天区，避免 placeholder 延迟导致聊天区未挂载 */
  watch(() => (chatId.value ? getMessages(chatId.value).length : 0), (len) => {
    if (chatId.value && len > 0) showChatPlaceholderOnFirstLoad.value = false
  })

  watch(() => route.query.app, (app) => {
    if (app === 'contacts' || app === 'bots') openPanel(app as any)
  })

  /** 切换到「待处理消息」时刷新邀请列表，确保能看到最新邀请提醒 */
  watch(listApi.listViewTab, (tab) => {
    if (tab === 'pending' && chatProvider === 'matrix') {
      loadInvitedSessions().catch(() => {})
    }
  })

  const { authLoading } = useAuth()
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
          loadSessionMessages(id).catch(() => {}).then(() => {
            if (getMessages(id).length === 0 && chatProvider === 'matrix' && syncReady.value) {
              tryFillFromSyncWithRetry(id)
            }
          })
        }
      }
    } else {
      const app = route.query.app as 'contacts' | 'bots' | undefined
      if (app === 'contacts' || app === 'bots') openPanel(app)
    }

    if (mockSessionListEnabled.value) seedMockMessages(getMessages, setMessages)

    function whenAuthReady() {
      loadSessions().then((result) => {
        if (result?.fetched) listApi.loadPinnedFromBackend()
        if (chatProvider === 'matrix') loadInvitedSessions().catch(() => {})
      }).catch(() => {})
    }
    if (!authLoading.value) {
      whenAuthReady()
    } else {
      watch(authLoading, (loading) => { if (loading === false) whenAuthReady() }, { once: true })
    }

    /** 邀请列表：未 Sync 前用 whenAuthReady 拉一次 API；Sync 就绪后仅用 invitedRoomsFromSync（Sync 每轮会触发 setOnSyncDone，故不再在此注册 API 请求避免周期性 /api/sessions/invited） */
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
    chatScrollElRef,
    openAddParticipant,
    openPanel,
    startNewChat,
    openCreateSessionDialog,
    showCreateSessionDialog,
    onCreateSessionSelectSolo,
    startNewChatWithContact,
    contacts,
    creatingSession,
    createSessionError,
    fetchSessionMembers,
    kickFromSession,
    banFromSession,
    inviteToSession,
    sessionMembers,
    refetchSessionMembers,
    isSessionLeftRoom,
    ...listApi,
    ...paneApi,
  }
}
