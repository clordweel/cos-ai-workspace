/**
 * 会话区聊天面板：消息列表、虚拟滚动、流式发送、导出与单条消息操作
 * 供 space 页 useSpacePage 使用
 */
import type { ChatMessage } from '~/composables/useChatSessions'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { getMockSessionById } from '~/composables/useMockSessions'
import { useContactsAndBots } from '~/composables/useContactsAndBots'

const STREAM_TYPEWRITER_INTERVAL_MS = 80
const STREAM_TYPEWRITER_CHARS_PER_TICK = 1
const STREAM_TYPEWRITER_MIN_INTERVAL_MS = 16
const STREAM_TYPEWRITER_ACCELERATION = 0.92

export function useSpaceChatPane(options: {
  chatId: Ref<string | undefined>
  route: ReturnType<typeof useRoute>
  chats: Ref<Array<{ id: string; title?: string }>>
  getMessages: (id: string) => ChatMessage[]
  setMessages: (id: string, messages: ChatMessage[]) => void
  appendMessage: (id: string, msg: ChatMessage) => void
  updateLastMessage: (id: string, updater: (m: ChatMessage) => void) => void
  ensureChat: (id: string, title: string) => void
  getConversationId: (id: string) => string | undefined
  setConversationId: (id: string, conversationId: string | undefined) => void
  /** 重命名会话回调（会话列表右键或顶栏菜单触发） */
  onRenameSession?: (sessionId: string) => void
}) {
  const {
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
    onRenameSession,
  } = options

  const config = useRuntimeConfig()
  const router = useRouter()
  const scrollRef = ref<HTMLElement | null>(null)
  const input = ref('')
  const streaming = ref(false)
  const streamAbortRef = ref<AbortController | null>(null)
  const streamContentBuffer = ref('')
  let typewriterTimerId: ReturnType<typeof setTimeout> | null = null

  const messages = computed(() => (chatId.value ? getMessages(chatId.value) : []))
  const displayMessages = computed(() => messages.value)

  const rowVirtualizerRef = useVirtualizer({
    count: computed(() => displayMessages.value.length),
    getScrollElement: () => scrollRef.value ?? null,
    estimateSize: () => 120,
    overscan: 5,
  })
  const virtualRows = computed(() => rowVirtualizerRef.value.getVirtualItems())
  const virtualTotalSize = computed(() => rowVirtualizerRef.value.getTotalSize())

  const chatTitle = computed(() => {
    if (!chatId.value) return ''
    const mock = getMockSessionById(chatId.value)
    if (mock) return mock.title
    const c = chats.value.find((x) => x.id === chatId.value)
    return c?.title ?? '会话'
  })

  const { user: authUser } = useAuth()
  const chatUserName = computed(() => {
    const u = authUser.value
    if (typeof u === 'string') return u
    if (u && typeof u === 'object' && 'name' in u && typeof (u as { name?: string }).name === 'string') {
      return (u as { name: string }).name
    }
    return ''
  })
  const chatUserAvatar = computed(() => {
    const u = authUser.value
    if (u && typeof u === 'object' && 'avatar' in u && typeof (u as { avatar?: string }).avatar === 'string') {
      return (u as { avatar: string }).avatar
    }
    return ''
  })

  const { streamChat } = useChatStream()
  const { sendTyping, sendReadReceipt } = useMatrixSyncClient()
  const { bots } = useContactsAndBots()

  /** 消息中是否 @ 了机器人（只有 @ 了机器人才会触发 assistant 回复） */
  function messageContainsBotMention(text: string): boolean {
    return bots.some((b) => text.includes(`@${b.name}`))
  }

  let typingTimeoutId: ReturnType<typeof setTimeout> | null = null
  function scheduleTyping(roomId: string, isTyping: boolean) {
    if (typingTimeoutId) clearTimeout(typingTimeoutId)
    typingTimeoutId = null
    if (isTyping) {
      typingTimeoutId = setTimeout(() => sendTyping(roomId, true), 300)
    } else {
      sendTyping(roomId, false)
    }
  }

  watch(input, (v) => {
    const id = chatId.value
    if (!id) return
    const roomId = getConversationId(id) ?? id
    if (v.trim()) scheduleTyping(roomId, true)
    else sendTyping(roomId, false)
  })

  watch([chatId, messages], () => {
    const id = chatId.value
    if (!id) return
    const list = getMessages(id)
    const last = list[list.length - 1]
    if (last?.id) sendReadReceipt(getConversationId(id) ?? id, last.id)
  }, { flush: 'post' })

  function stopStream() {
    if (streamAbortRef.value) {
      streamAbortRef.value.abort()
      streamAbortRef.value = null
    }
    streaming.value = false
  }

  function scrollToLastMessage(behavior: ScrollBehavior = 'smooth') {
    const n = displayMessages.value.length
    if (n === 0) return
    if (virtualRows.value.length > 0) {
      rowVirtualizerRef.value.scrollToIndex(n - 1, { align: 'end', behavior })
    } else {
      const el = scrollRef.value
      if (el) el.scrollTo({ top: el.scrollHeight, behavior })
    }
  }

  const replyTarget = ref<{ id: string; role: string; content: string } | null>(null)

  async function streamReply(
    id: string,
    text: string,
    hasBotMention: boolean,
    replyToMessageId?: string
  ) {
    let currentId = id
    const placeholder = '思考中…'
    let assistantCreated = false

    function ensureAssistantMessage() {
      if (!hasBotMention || assistantCreated) return
      assistantCreated = true
      appendMessage(currentId, { role: 'assistant', content: placeholder, thinking: '', createdAt: Date.now() })
      nextTick(() => scrollToLastMessage())
    }

    streaming.value = true
    streamAbortRef.value = new AbortController()
    streamContentBuffer.value = ''
    let streamEnded = false
    let currentDelayMs = STREAM_TYPEWRITER_INTERVAL_MS

    function typewriterTick() {
      const buf = streamContentBuffer.value
      if (buf) {
        ensureAssistantMessage()
        const take = buf.slice(0, STREAM_TYPEWRITER_CHARS_PER_TICK)
        streamContentBuffer.value = buf.slice(STREAM_TYPEWRITER_CHARS_PER_TICK)
        updateLastMessage(currentId, (m) => {
          const base = m.content === placeholder ? '' : m.content
          m.content = base + take
          if (!m.contentChunks) m.contentChunks = []
          m.contentChunks.push(take)
        })
        scrollToLastMessage('auto')
      }

      if (buf === '' && streamEnded) {
        typewriterTimerId = null
        if (assistantCreated) {
          updateLastMessage(currentId, (m) => { m.contentChunks = undefined })
          const list = getMessages(currentId)
          const last = list[list.length - 1]
          if (last && last.role === 'assistant') {
            if (!last.content) {
              updateLastMessage(currentId, (m) => { m.content = '（未收到任何内容，请检查中间层与 CORS 配置）' })
            }
          }
        }
        streamAbortRef.value = null
        streaming.value = false
        nextTick(() => {
          const n = displayMessages.value.length
          if (n > 0) rowVirtualizerRef.value?.scrollToIndex(n - 1, { align: 'end', behavior: 'smooth' })
        })
        return
      }

      if (streamEnded) {
        currentDelayMs = Math.max(STREAM_TYPEWRITER_MIN_INTERVAL_MS, currentDelayMs * STREAM_TYPEWRITER_ACCELERATION)
      }
      typewriterTimerId = setTimeout(typewriterTick, currentDelayMs)
    }

    typewriterTimerId = setTimeout(typewriterTick, currentDelayMs)

    try {
      await streamChat(
        text,
        (delta) => { streamContentBuffer.value += delta },
        {
          signal: streamAbortRef.value?.signal,
          conversationId: getConversationId(currentId),
          replyToMessageId,
          onSessionCreated: (payload) => {
            const realId = payload.backend_session_id ?? payload.session_id
            if (realId === currentId) return
            const title = chats.value.find((c) => c.id === currentId)?.title ?? '新会话'
            ensureChat(realId, title)
            setMessages(realId, getMessages(currentId))
            setConversationId(realId, realId)
            chats.value = chats.value.filter((c) => c.id !== currentId)
            router.replace(`/space/${realId}`)
            currentId = realId
          },
          onThinking: () => {
            ensureAssistantMessage()
            streamContentBuffer.value = ''
            updateLastMessage(currentId, (m) => {
              m.content = placeholder
              m.contentChunks = undefined
            })
          },
          onThinkingDelta: (delta) => {
            ensureAssistantMessage()
            updateLastMessage(currentId, (m) => {
              if (!m.thinking) m.thinking = ''
              m.thinking += delta
            })
          },
          onThinkingDone: (fullText) => {
            updateLastMessage(currentId, (m) => { if (fullText) m.thinking = fullText })
          },
        }
      )
      streamEnded = true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const friendly = /failed to fetch|networkerror|network error/i.test(msg)
        ? '网络错误，请确认中间层已启动且可访问（检查 NUXT_PUBLIC_API_BASE 或代理）'
        : msg
      ensureAssistantMessage()
      updateLastMessage(currentId, (m) => { m.content = `请求失败：${friendly}` })
    } finally {
      if (!streamEnded) {
        if (typewriterTimerId) {
          clearTimeout(typewriterTimerId)
          typewriterTimerId = null
        }
        updateLastMessage(currentId, (m) => { m.contentChunks = undefined })
        streamAbortRef.value = null
        streaming.value = false
      }
    }
    if (!streamEnded) {
      nextTick(() => {
        const n = displayMessages.value.length
        if (n > 0) rowVirtualizerRef.value?.scrollToIndex(n - 1, { align: 'end', behavior: 'smooth' })
      })
    }
  }

  async function send() {
    const id = chatId.value
    const text = input.value.trim()
    if (!id || !text || streaming.value) return
    const roomId = getConversationId(id) ?? id
    sendTyping(roomId, false)
    const target = replyTarget.value
    input.value = ''
    replyTarget.value = null
    appendMessage(id, {
      role: 'user',
      content: text,
      createdAt: Date.now(),
      inReplyTo: target ? { id: target.id, role: target.role as 'user' | 'assistant', content: target.content } : undefined,
    })
    nextTick(() => scrollToLastMessage())
    await streamReply(id, text, messageContainsBotMention(text), target?.id)
  }

  function onReplyToMessage(msg: { id?: string; role: string; content: string }) {
    const id = msg.id || (msg as ChatMessage).backendMessageId
    if (!id) return
    replyTarget.value = { id, role: msg.role, content: msg.content }
  }

  function onCancelReply() {
    replyTarget.value = null
  }

  const canEditOtherMessage = ref(true)
  function canEditMessage(msg: ChatMessage): boolean {
    if (msg.role !== 'assistant') return false
    if (!canEditOtherMessage.value) return false
    return msg.editableByCurrentUser !== false
  }

  function messagesToMarkdown(list: ChatMessage[]): string {
    const lines: string[] = []
    for (const msg of list) {
      const roleLabel = msg.role === 'user' ? '用户' : '助手'
      lines.push(`## ${roleLabel}\n`)
      if (msg.content.trim()) lines.push(msg.content.trim(), '\n')
      if (msg.thinking?.trim()) {
        lines.push('> **思考过程**\n> ', msg.thinking.trim().replace(/\n/g, '\n> '), '\n')
      }
      lines.push('\n')
    }
    return lines.join('').trimEnd()
  }

  function triggerMarkdownDownload(markdown: string, filename: string) {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function onExportMarkdown() {
    const list = chatId.value ? getMessages(chatId.value) : []
    const title = chatTitle.value || '会话'
    const filename = `${title.replace(/[/\\?%*:|"<>]/g, '-')}-${Date.now()}.md`
    const apiBase = (config.public.apiBase as string) || ''
    try {
      const { markdown } = await $fetch<{ markdown: string }>(`${apiBase}/api/chat/export-markdown`, {
        method: 'POST',
        body: { messages: list },
      })
      triggerMarkdownDownload(markdown, filename)
    } catch {
      triggerMarkdownDownload(messagesToMarkdown(list), filename)
    }
  }

  function onExportCurrentScreen() { /* TODO */ }
  function onExportLongScreenshot() { /* TODO */ }
  function onShareConversation() { /* TODO */ }
  function onCopySessionLink() {
    if (!chatId.value) return
    const url = `${window.location.origin}${route.fullPath}`
    navigator.clipboard.writeText(url).catch(() => {})
  }
  function onCloseChat() { router.push('/space') }
  function onRenameChat() {
    if (chatId.value && onRenameSession) onRenameSession(chatId.value)
  }
  function onArchiveChat() { /* TODO */ }
  function onDeleteChat() { /* TODO */ }

  function onEditMessage(_index: number) { /* TODO */ }
  function onViewEditHistory(_index: number) { /* TODO */ }
  function onEditUserMessage(_index: number) { /* TODO */ }
  function onRetryUserMessage(_index: number) { /* TODO */ }
  function onFavoriteMessage(_index: number) { /* TODO */ }
  function onListenReply(_index: number) { /* TODO */ }

  function onRecallMessage(index: number) {
    const id = chatId.value
    if (!id) return
    const list = getMessages(id)
    if (index < 0 || index >= list.length) return
    const next = list.filter((_, i) => i !== index)
    setMessages(id, next)
  }

  function onDeleteMessage(index: number) {
    const id = chatId.value
    if (!id) return
    const list = getMessages(id)
    if (index < 0 || index >= list.length) return
    const next = list.filter((_, i) => i !== index)
    setMessages(id, next)
  }

  function onCopyMessage(index: number) {
    const list = chatId.value ? getMessages(chatId.value) : []
    const msg = list[index]
    if (msg?.content) navigator.clipboard.writeText(msg.content).catch(() => {})
  }

  function retryMessage(index: number) {
    const id = chatId.value
    if (!id || streaming.value) return
    const list = getMessages(id)
    if (index < 1 || index >= list.length) return
    const assistantMsg = list[index]
    const userMsg = list[index - 1]
    if (assistantMsg.role !== 'assistant' || userMsg.role !== 'user') return
    setMessages(id, list.slice(0, index))
    streamReply(id, userMsg.content, messageContainsBotMention(userMsg.content))
  }

  return {
    scrollRef,
    input,
    streaming,
    messages,
    displayMessages,
    rowVirtualizerRef,
    virtualRows,
    virtualTotalSize,
    chatTitle,
    chatUserName,
    chatUserAvatar,
    replyTarget,
    onReplyToMessage,
    onCancelReply,
    send,
    stopStream,
    scrollToLastMessage,
    onExportMarkdown,
    onExportCurrentScreen,
    onExportLongScreenshot,
    onShareConversation,
    onCopySessionLink,
    onCloseChat,
    onRenameChat,
    onArchiveChat,
    onDeleteChat,
    canEditMessage,
    onEditMessage,
    onViewEditHistory,
    onEditUserMessage,
    onRetryUserMessage,
    onRecallMessage,
    onDeleteMessage,
    onCopyMessage,
    onFavoriteMessage,
    onListenReply,
    retryMessage,
  }
}
