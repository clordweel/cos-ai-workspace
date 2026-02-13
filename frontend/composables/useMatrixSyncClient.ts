/**
 * Matrix 仅 sync/typing/已读 客户端（混合方案二/三）
 * 使用 /api/auth/me 下发的 matrixSyncToken + matrix_base_url + matrix_user_id，
 * 仅用于：收 sync 新消息、发 typing、发已读回执。禁止用于发消息、拉列表、拉历史。
 */
import { nextTick } from 'vue'
import type { MatrixClient } from 'matrix-js-sdk'

const syncClient = ref<MatrixClient | null>(null)
const syncReady = ref(false)

export function useMatrixSyncClient() {
  const auth = useAuth()
  const config = useRuntimeConfig()
  const { appendMessage, ensureChat, getMessages, setMessages, updateLastMessage } = useChatSessions()

  watch(
    () => (auth.matrixSyncToken as { value?: string })?.value,
    (v) => {
      if (!v) stopSyncClient()
    }
  )

  /** 当前是否有 sync 用 token（有则可能已创建 client） */
  const hasSyncToken = computed(() => {
    const token = (auth.matrixSyncToken as { value?: string })?.value
    const userId = (auth.matrixUserId as { value?: string })?.value
    const fromApi = (auth.matrixBaseUrl as { value?: string })?.value
    const fromConfig = (config.public?.matrixBaseUrl as string) ?? ''
    const baseUrl = fromApi || fromConfig
    return !!(token && baseUrl && userId)
  })

  /** 解析得到的 baseUrl：优先 API 下发的 matrix_base_url，否则用 NUXT_PUBLIC_MATRIX_BASE_URL（浏览器可达） */
  function resolveBaseUrl(): string {
    const fromApi = (auth.matrixBaseUrl as { value?: string })?.value
    const fromConfig = (config.public?.matrixBaseUrl as string) ?? ''
    return fromApi || fromConfig
  }

  /** 启动仅 sync 的 Matrix Client（在 token 可用时调用，仅客户端） */
  async function startSyncClient(): Promise<MatrixClient | null> {
    if (import.meta.server) return null
    const token = (auth.matrixSyncToken as { value?: string })?.value
    const baseUrl = resolveBaseUrl()
    const userId = (auth.matrixUserId as { value?: string })?.value
    if (!token || !baseUrl || !userId) return null

    if (syncClient.value) {
      syncReady.value = true
      return syncClient.value
    }

    try {
      const sdk = await import('matrix-js-sdk')
      const noop = () => {}
      const silentLogger = {
        trace: noop,
        debug: noop,
        info: noop,
        warn: noop,
        error: (...args: unknown[]) => { if (import.meta.dev) console.error('[MatrixSync]', ...args) },
        getChild: function getChild(this: typeof silentLogger) { return this },
      } as unknown as InstanceType<typeof sdk.DebugLogger>
      const c = sdk.createClient({
        baseUrl,
        accessToken: token,
        userId,
        logger: silentLogger,
      })
      syncClient.value = c
      syncReady.value = false

      c.on(sdk.ClientEvent.Sync, (state: string) => {
        if (state === 'PREPARED' || state === 'SYNCING') {
          syncReady.value = true
          // 刷新所有已加入房间的显示名称，避免刷新后仅显示 roomId
          nextTick(() => {
            const rooms = c.getRooms?.() ?? []
            for (const room of rooms) {
              const roomId = room?.roomId
              if (!roomId) continue
              const name = (room?.name ?? '').trim()
              if (name) ensureChat(roomId, name)
            }
          })
        }
        if (state === 'ERROR' && import.meta.dev) {
          console.warn('[MatrixSync] sync state ERROR，实时消息可能不可用')
        }
      })

      // 房间名称变更（含初次 sync 后的名称）：及时更新聊天栏与列表标题
      c.on(sdk.RoomEvent.Name, (room: { roomId?: string; name?: string }) => {
        const roomId = room?.roomId
        const name = (room?.name ?? '').trim()
        if (!roomId || !name) return
        nextTick(() => ensureChat(roomId, name))
      })

      c.on(sdk.ClientEvent.Event, (event: {
        getRoomId?: () => string
        getType?: () => string
        getContent?: () => Record<string, unknown>
        getSender?: () => string
        getId?: () => string
        getStateKey?: () => string
        getTs?: () => number
      }) => {
        const roomId = event.getRoomId?.()
        if (!roomId) return
        const eventType = event.getType?.()
        const eventId = event.getId?.()
        const existing = getMessages(roomId)
        if (eventId && existing.some((m) => m.id === eventId)) return
        const ts = typeof event.getTs === 'function' ? event.getTs() : undefined
        const createdAt = ts && ts > 0 ? ts : Date.now()

        if (eventType === 'm.room.message') {
          const content = event.getContent?.() ?? {}
          const body = (content.body ?? (content as { msgtype?: string; body?: string }).body) as string | undefined
          if (body == null) return
          const relatesTo = (content as { 'm.relates_to'?: { rel_type?: string; event_id?: string } })['m.relates_to']
          // 编辑事件（m.replace）：在原消息上更新内容，不追加新消息
          if (relatesTo?.rel_type === 'm.replace' && relatesTo.event_id) {
            const newContent = (content as { 'm.new_content'?: { body?: string; formatted_body?: string } })['m.new_content']
            const newBody = typeof newContent?.body === 'string' ? newContent.body : body.replace(/^\s*\*\s*/, '')
            const newFormattedBody = typeof newContent?.formatted_body === 'string' ? newContent.formatted_body : undefined
            const list = getMessages(roomId)
            const idx = list.findIndex((m) => m.id === relatesTo.event_id)
            if (idx >= 0) {
              nextTick(() => {
                const next = [...list]
                next[idx] = {
                  ...next[idx]!,
                  content: newBody,
                  ...(newFormattedBody != null ? { formattedBody: newFormattedBody } : {}),
                }
                setMessages(roomId, next)
              })
              return
            }
          }
          const formattedBody = (content as { formatted_body?: string }).formatted_body
          const role = event.getSender?.() === userId ? 'user' : 'assistant'
          // 解析回复引用，便于刷新后从 sync 恢复时仍能展示引用内容（与中间层 getMessages 逻辑一致）
          const replyToId = (content as { 'm.relates_to'?: { 'm.in_reply_to'?: { event_id?: string } } })['m.relates_to']?.['m.in_reply_to']?.event_id
          let inReplyTo: { id: string; role: 'user' | 'assistant'; content?: string } | undefined
          if (replyToId) {
            const list = getMessages(roomId)
            const parentMsg = list.find((m) => m.id === replyToId)
            if (parentMsg) {
              inReplyTo = { id: replyToId, role: parentMsg.role, content: parentMsg.content }
            } else {
              const room = c.getRoom?.(roomId)
              const parentEv = room?.findEventById?.(replyToId) as { getContent?: () => { body?: string }; getSender?: () => string } | undefined
              const parentContent = parentEv?.getContent?.()
              const parentBody = typeof parentContent?.body === 'string' ? parentContent.body : ''
              const parentSender = parentEv?.getSender?.()
              const parentRole = parentSender === userId ? ('user' as const) : ('assistant' as const)
              inReplyTo = { id: replyToId, role: parentRole, content: parentBody || undefined }
            }
          }
          // 己方消息：后端可能改写 body/formatted_body，用「替换最后一条无 id 的 user 占位」避免新旧两条并存
          if (role === 'user' && eventId) {
            const list = getMessages(roomId)
            if (list.some((m) => m.id === eventId)) return
            const now = Date.now()
            const PENDING_WINDOW_MS = 15000
            let replaceIndex = -1
            for (let i = list.length - 1; i >= 0; i--) {
              const m = list[i]
              if (m?.role !== 'user') continue
              if (m.id) break
              const age = now - (m.createdAt ?? 0)
              if (age <= PENDING_WINDOW_MS) replaceIndex = i
              break
            }
            if (replaceIndex >= 0) {
              const existing = list[replaceIndex]
              const syncMsg = {
                role: 'user' as const,
                content: String(body),
                ...(typeof formattedBody === 'string' && formattedBody ? { formattedBody } : {}),
                id: eventId,
                createdAt,
                receiptStatus: 'sent' as const,
                inReplyTo: existing?.inReplyTo ?? inReplyTo,
              }
              nextTick(() => {
                const room = c.getRoom?.(roomId)
                const title = (room?.name ?? '').trim() || roomId
                ensureChat(roomId, title)
                const next = [...list]
                next[replaceIndex] = { ...existing, ...syncMsg }
                setMessages(roomId, next)
              })
              return
            }
          }
          const msg = {
            role: role as 'user' | 'assistant',
            content: String(body),
            ...(typeof formattedBody === 'string' && formattedBody ? { formattedBody } : {}),
            id: eventId ?? undefined,
            createdAt,
            ...(inReplyTo ? { inReplyTo } : {}),
          }
          nextTick(() => {
            const room = c.getRoom?.(roomId)
            const title = (room?.name ?? '').trim() || roomId
            ensureChat(roomId, title)
            appendMessage(roomId, msg)
          })
          return
        }

        if (eventType === 'm.room.name') {
          const content = event.getContent?.() ?? {}
          const name = (content.name as string)?.trim() || '未命名'
          nextTick(() => ensureChat(roomId, name))
          return
        }

        // 与 Cinny 一致：成员加入/离开等状态事件不放入聊天流，不展示为系统消息
        if (eventType === 'm.room.member') return
      })

      await c.startClient({ initialSyncLimit: 50 })
      return c
    } catch (e) {
      syncClient.value = null
      syncReady.value = false
      if (import.meta.dev) {
        console.warn('[MatrixSync] startClient 失败，实时消息不可用:', e)
      }
      return null
    }
  }

  /** 停止 sync 客户端（登出或 token 失效时） */
  function stopSyncClient(): void {
    if (syncClient.value) {
      try {
        syncClient.value.stopClient?.()
      } catch {
        // ignore
      }
      syncClient.value = null
    }
    syncReady.value = false
  }

  /** 发送正在输入状态（仅当 sync client 就绪时） */
  function sendTyping(roomId: string, isTyping: boolean): void {
    const client = syncClient.value
    if (!client) return
    const room = client.getRoom(roomId)
    if (!room) return
    try {
      room.sendTyping(isTyping)
    } catch {
      // ignore
    }
  }

  /** 发送已读回执（仅当 sync client 就绪时；需能解析到对应 MatrixEvent） */
  function sendReadReceipt(roomId: string, eventId: string): void {
    const client = syncClient.value
    if (!client) return
    const room = client.getRoom(roomId)
    const event = room?.findEventById(eventId) ?? null
    if (!event) return
    try {
      client.sendReadReceipt(event, 'm.read')
    } catch {
      // ignore
    }
  }

  return {
    syncClient: readonly(syncClient),
    syncReady: readonly(syncReady),
    hasSyncToken,
    startSyncClient,
    stopSyncClient,
    sendTyping,
    sendReadReceipt,
  }
}
