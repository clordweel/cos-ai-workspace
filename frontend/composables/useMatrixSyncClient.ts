/**
 * Matrix 仅 sync/typing/已读 客户端（混合方案二/三）
 * 使用 /api/auth/me 下发的 matrixSyncToken + matrix_base_url + matrix_user_id，
 * 仅用于：收 sync 新消息、发 typing、发已读回执。禁止用于发消息、拉列表、拉历史。
 */
import { nextTick } from 'vue'
import type { MatrixClient } from 'matrix-js-sdk'

const syncClient = ref<MatrixClient | null>(null)
const syncReady = ref(false)
/** 当前前端正在展示的会话/房间 id，用于 TimelineRefresh 时仅重填当前房间（加密房间解密后刷新，见 ENCRYPTED_ROOM_MESSAGES_ROOT_CAUSE.md） */
const currentRoomIdRef = ref<string | undefined>(undefined)
/** Sync 完成（PREPARED/SYNCING）时触发的回调，用于刷新邀请列表等 */
const onSyncDoneCallbacks = ref<Array<() => void>>([])
/** 从 Sync 客户端实时派生的待接受邀请列表（Cinny 方案：数据源与 sync 一致，新邀请随 sync 到达即更新） */
const invitedRoomsFromSync = ref<{ id: string; title: string }[]>([])

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

  /** 启动仅 sync 的 Matrix Client（在 token 可用时调用，仅客户端）；有 deviceId 时启用 E2EE 解密 */
  async function startSyncClient(): Promise<MatrixClient | null> {
    if (import.meta.server) return null
    const token = (auth.matrixSyncToken as { value?: string })?.value
    const baseUrl = resolveBaseUrl()
    const userId = (auth.matrixUserId as { value?: string })?.value
    const deviceId = (auth.matrixDeviceId as { value?: string })?.value?.trim() || undefined
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
        ...(deviceId ? { deviceId } : {}),
        logger: silentLogger,
      })
      syncClient.value = c
      if (deviceId && typeof c.initRustCrypto === 'function') {
        try {
          await c.initRustCrypto()
        } catch (e) {
          if (import.meta.dev) {
            console.warn('[MatrixSync] initRustCrypto 失败，加密房间消息将无法解密:', e)
          }
        }
      }
      syncReady.value = false
      invitedRoomsFromSync.value = []

      function refreshInvitedRoomsFromSync() {
        const client = syncClient.value
        if (!client?.getRooms) return
        const rooms = client.getRooms()
        const list: { id: string; title: string }[] = []
        for (const room of rooms) {
          const id = room?.roomId
          if (!id) continue
          const membership = typeof room.getMyMembership === 'function' ? room.getMyMembership() : ''
          if (String(membership) !== 'invite') continue
          const name = (typeof room.name === 'string' ? room.name : '')?.trim() || id
          list.push({ id, title: name })
        }
        invitedRoomsFromSync.value = list
      }

      /** 已绑定 TimelineRefresh 的房间 id，避免重复绑定（加密房间解密后重填当前房间） */
      const timelineRefreshBoundRooms = new Set<string>()
      function bindTimelineRefreshForRoom(room: { roomId?: string; on?: (ev: string, fn: () => void) => void }) {
        if (!room?.roomId || timelineRefreshBoundRooms.has(room.roomId)) return
        timelineRefreshBoundRooms.add(room.roomId)
        if (typeof room.on === 'function') {
          room.on(sdk.RoomEvent.TimelineRefresh, () => {
            if (room.roomId === currentRoomIdRef.value) {
              nextTick(() => fillMessagesFromSyncTimeline(room.roomId!))
            }
          })
        }
      }

      c.on(sdk.ClientEvent.Sync, (state: string) => {
        if (state === 'PREPARED' || state === 'SYNCING') {
          syncReady.value = true
          // 刷新所有已加入房间的显示名称，避免刷新后仅显示 roomId；并为已有房间补绑 TimelineRefresh
          nextTick(() => {
            const rooms = c.getRooms?.() ?? []
            for (const room of rooms) {
              const roomId = room?.roomId
              if (!roomId) continue
              const name = (room?.name ?? '').trim()
              if (name) ensureChat(roomId, name)
              bindTimelineRefreshForRoom(room)
            }
            refreshInvitedRoomsFromSync()
            const fns = onSyncDoneCallbacks.value
            for (const fn of fns) {
              try {
                fn()
              } catch {
                // ignore
              }
            }
          })
        }
        if (state === 'ERROR' && import.meta.dev) {
          console.warn('[MatrixSync] sync state ERROR，实时消息可能不可用')
        }
      })

      // 新房间加入（含被邀请）：实时更新邀请列表（Cinny 方案）；绑定 TimelineRefresh；若为当前展示房间则立即尝试填充消息（解决先点进房间再 sync 到时消息为空）
      c.on(sdk.ClientEvent.Room, (room: { roomId?: string; on?: (ev: string, fn: () => void) => void }) => {
        nextTick(refreshInvitedRoomsFromSync)
        bindTimelineRefreshForRoom(room)
        if (room?.roomId && room.roomId === currentRoomIdRef.value) {
          nextTick(() => fillMessagesFromSyncTimeline(room.roomId!))
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
    invitedRoomsFromSync.value = []
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

  /** 注册 Sync 完成后的回调（如刷新邀请列表）；每次 PREPARED/SYNCING 会调用 */
  function setOnSyncDone(fn: () => void) {
    onSyncDoneCallbacks.value = [...onSyncDoneCallbacks.value, fn]
  }

  /** 设置当前前端展示的会话/房间 id，TimelineRefresh（如解密完成）时仅重填该房间 */
  function setCurrentRoomId(roomId: string | undefined) {
    currentRoomIdRef.value = roomId
  }

  /**
   * 从 Sync 客户端的房间 timeline 取已解密消息并写入 setMessages（用于加密房间等 REST 无法拿到明文历史的场景）
   * 会先触发 room.decryptCriticalEvents() 再读时间线，便于加密房间能解密后展示
   * @returns 是否写入了至少一条消息
   */
  async function fillMessagesFromSyncTimeline(roomId: string): Promise<boolean> {
    const client = syncClient.value
    if (!client?.getRoom) return false
    const room = client.getRoom(roomId)
    if (!room) return false
    const roomDecrypt = room as { decryptCriticalEvents?: () => Promise<unknown> }
    if (typeof roomDecrypt.decryptCriticalEvents === 'function') {
      try {
        await roomDecrypt.decryptCriticalEvents()
      } catch {
        // 无 crypto 或解密失败时忽略，继续用当前时间线填充
      }
    }
    const timeline = (room as { getLiveTimeline?: () => { getEvents?: () => unknown[] } }).getLiveTimeline?.()
    const rawEvents = timeline?.getEvents?.() ?? []
    const userId = (auth.matrixUserId as { value?: string })?.value ?? ''
    const byTs = (a: unknown, b: unknown) => {
      const ta = typeof (a as { getTs?: () => number }).getTs === 'function' ? (a as { getTs(): number }).getTs() : 0
      const tb = typeof (b as { getTs?: () => number }).getTs === 'function' ? (b as { getTs(): number }).getTs() : 0
      return ta - tb
    }
    const sortedEvents = [...rawEvents].sort(byTs)
    const eventMap = new Map<string, { role: 'user' | 'assistant'; content: string; formattedBody?: string; id: string; createdAt: number; inReplyTo?: { id: string; role?: 'user' | 'assistant'; content?: string } }>()
    const evProto = {
      getType: (e: unknown) => typeof (e as { getType?: () => string }).getType === 'function' ? (e as { getType(): string }).getType() : '',
      getContent: (e: unknown) => typeof (e as { getContent?: () => Record<string, unknown> }).getContent === 'function' ? (e as { getContent(): Record<string, unknown> }).getContent() : {},
      getSender: (e: unknown) => typeof (e as { getSender?: () => string }).getSender === 'function' ? (e as { getSender(): string }).getSender() : '',
      getId: (e: unknown) => typeof (e as { getId?: () => string }).getId === 'function' ? (e as { getId(): string }).getId() : '',
      getTs: (e: unknown) => typeof (e as { getTs?: () => number }).getTs === 'function' ? (e as { getTs(): number }).getTs() : 0,
    }
    for (const ev of sortedEvents) {
      if (evProto.getType(ev) !== 'm.room.message') continue
      const content = evProto.getContent(ev)
      const body = (content.body ?? (content as { body?: string }).body) as string | undefined
      if (body == null) continue
      const rel = (content as { 'm.relates_to'?: { rel_type?: string } })['m.relates_to']
      if (rel?.rel_type === 'm.replace') continue
      const sender = evProto.getSender(ev)
      const role = sender === userId ? ('user' as const) : ('assistant' as const)
      const eventId = evProto.getId(ev)
      const ts = evProto.getTs(ev)
      const createdAt = ts > 0 ? ts : Date.now()
      const formattedBody = (content as { formatted_body?: string }).formatted_body
      const replyToId = (content as { 'm.relates_to'?: { 'm.in_reply_to'?: { event_id?: string } } })['m.relates_to']?.['m.in_reply_to']?.event_id
      let inReplyTo: { id: string; role?: 'user' | 'assistant'; content?: string } | undefined
      if (replyToId) {
        const parent = eventMap.get(replyToId)
        inReplyTo = parent ? { id: replyToId, role: parent.role, content: parent.content } : { id: replyToId }
      }
      eventMap.set(eventId, { role, content: String(body), formattedBody: typeof formattedBody === 'string' ? formattedBody : undefined, id: eventId, createdAt, inReplyTo })
    }
    const sorted = [...eventMap.values()].sort((a, b) => a.createdAt - b.createdAt)
    if (sorted.length === 0) return false
    const messages = sorted.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.formattedBody ? { formattedBody: m.formattedBody } : {}),
      id: m.id,
      createdAt: m.createdAt,
      ...(m.inReplyTo ? { inReplyTo: m.inReplyTo } : {}),
    }))
    nextTick(() => setMessages(roomId, messages))
    return true
  }

  return {
    syncClient: readonly(syncClient),
    syncReady: readonly(syncReady),
    hasSyncToken,
    startSyncClient,
    stopSyncClient,
    setOnSyncDone,
    /** 设置当前展示的会话 id，用于 TimelineRefresh 时仅重填该房间（加密房间解密后刷新） */
    setCurrentRoomId,
    /** 从 Sync 实时派生的待接受邀请列表；Sync 未就绪时为空，优先用此替代 API 拉取以获实时性 */
    invitedRoomsFromSync: readonly(invitedRoomsFromSync),
    sendTyping,
    sendReadReceipt,
    /** 从 Sync timeline 填充加密房间等 REST 无明文时的历史消息 */
    fillMessagesFromSyncTimeline,
  }
}
