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
  const { appendMessage, ensureChat, getMessages } = useChatSessions()

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
        if (state === 'PREPARED' || state === 'SYNCING') syncReady.value = true
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
          const formattedBody = (content as { formatted_body?: string }).formatted_body
          const role = event.getSender?.() === userId ? 'user' : 'assistant'
          const msg = {
            role: role as 'user' | 'assistant',
            content: String(body),
            ...(typeof formattedBody === 'string' && formattedBody ? { formattedBody } : {}),
            id: eventId ?? undefined,
            createdAt,
          }
          nextTick(() => {
            ensureChat(roomId, roomId)
            appendMessage(roomId, msg)
          })
          return
        }

        if (eventType === 'm.room.name') {
          const content = event.getContent?.() ?? {}
          const name = (content.name as string)?.trim() || '未命名'
          const systemMsg = {
            role: 'system' as const,
            content: `会话已改名为「${name}」`,
            id: eventId ?? undefined,
            createdAt,
          }
          nextTick(() => {
            ensureChat(roomId, name)
            appendMessage(roomId, systemMsg)
          })
          return
        }

        if (eventType === 'm.room.member') {
          const content = event.getContent?.() ?? {}
          const membership = (content.membership as string) ?? ''
          const stateKey = (event.getStateKey?.() ?? event.getSender?.() ?? '') as string
          const displayName = (content.displayname as string)?.trim() || stateKey.replace(/^@/, '').split(':')[0] || stateKey
          let contentText: string
          if (membership === 'join') {
            contentText = `${displayName} 加入了会话`
          } else if (membership === 'leave') {
            contentText = `${displayName} 离开了会话`
          } else if (membership === 'invite') {
            contentText = `${displayName} 被邀请加入`
          } else {
            return
          }
          const systemMsg = {
            role: 'system' as const,
            content: contentText,
            id: eventId ?? undefined,
            createdAt,
          }
          nextTick(() => {
            ensureChat(roomId, roomId)
            appendMessage(roomId, systemMsg)
          })
        }
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
