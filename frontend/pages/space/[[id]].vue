<template>
  <!--
    会话区布局（由 workspace layout 的 grid 左列承载）：
    - 外层：session-area-container，flex-col，占满 layout 给的宽度。
    - 内层：flex-row（sm+ 双栏）或 flex-col（< sm 单栏）。
    - 左：SessionSidebar，sm+ 时 w-72(288px)，否则 flex-1；v-show 控制显隐。
    - 右：main 聊天区，flex-1 min-w-0，与列表左右并排时占剩余宽度。
    - 注意：layout 在 xl+ 且应用区展开时会话列给 1fr，否则 md～lg 应用区展开时给 288px（仅列表可见）。
  -->
  <div class="session-area-container h-full w-full min-w-0 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
    <div
      class="flex min-h-0 min-w-0 flex-1"
      :class="isSessionExpanded ? 'flex-row w-full' : 'flex-col'"
    >
      <SpaceSessionSidebar
        :is-session-expanded="isSessionExpanded"
        :app-content-visible="appContentVisible && showAppPanel"
        :chat-id="chatId"
        :list-view-tab="listViewTab"
        :list-padding-top="listPaddingTop"
        :toolbar-top="toolbarTop"
        :pinned-collapsed="pinnedCollapsed"
        :pinned-chats="pinnedChats"
        :active-chats="activeChats"
        :pending-chats="pendingChats"
        :pinned-ids="pinnedIds"
        :search-query="searchQuery"
        :show-app-list="showAppList"
        :show-search-bar="showSearchBar"
        :app-drawer-height-rem="appDrawerHeightRem"
        :drawer-common-apps="drawerCommonApps"
        :drawer-favorite-apps="drawerFavoriteApps"
        :total-pending-count="totalPendingCount"
        :get-chat-date-label="getChatDateLabel"
        :get-non-read-count="getNonReadCount"
        :is-mock="isMockSession"
        :drawer-app-active="drawerAppActive"
        @update:pinned-collapsed="pinnedCollapsed = $event"
        @update:search-query="setSearchQuery"
        @update:list-view-tab="setListViewTab"
        @session-click="onSessionItemClick"
        @toggle-pin="togglePin"
        @rename="onSessionRename"
        @close="onSessionClose"
        @new-chat="startNewChat"
        @search="toggleSearchBar"
        @app="toggleAppList"
        @more="onDrawerMore"
        @drawer-select="onDrawerAppClick"
      />
      <main
        class="flex-1 min-h-0 flex flex-col overflow-hidden relative"
        :class="{ 'min-w-0': !(chatId && showChatPlaceholderOnFirstLoad) }"
        v-show="isSessionExpanded || !!chatId"
        :style="[
          { '--chat-text-scale': sessionAreaFontScale },
          chatId && showChatPlaceholderOnFirstLoad ? { minWidth: '20rem' } : {}
        ]"
      >
        <template v-if="chatId && !showChatPlaceholderOnFirstLoad">
          <SpaceChatPane
            :scroll-ref="scrollRef"
            :chat-title="chatTitle"
            :chat-user-name="chatUserName"
            :is-session-expanded="isSessionExpanded"
            :session-area-font-scale="sessionAreaFontScale"
            v-model:input="input"
            :streaming="streaming"
            @close="onCloseChat"
            @rename="onRenameChat"
            @share="onShareConversation"
            @copy-link="onCopySessionLink"
            @export-screen="onExportCurrentScreen"
            @export-screenshot="onExportLongScreenshot"
            @export-markdown="onExportMarkdown"
            @archive="onArchiveChat"
            @delete="onDeleteChat"
            @submit="send"
            @stop="stopStream"
            @clear="input = ''"
            @scroll-to-last="scrollToLastMessage"
            @add-participant="openAddParticipant"
          >
            <template v-if="virtualRows.length > 0">
              <div
                :style="{
                  height: `${virtualTotalSize}px`,
                  width: '100%',
                  position: 'relative',
                }"
              >
                <div
                  v-for="virtualRow in virtualRows"
                  :key="virtualRow.key"
                  :data-index="virtualRow.index"
                  class="flex w-full pb-3"
                  :class="
                    (displayMessages[virtualRow.index]?.role === 'user'
                      ? 'justify-end'
                      : 'justify-start')
                  "
                  :style="{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }"
                  :ref="
                    (el) => {
                      if (el) rowVirtualizerRef.measureElement(el)
                    }
                  "
                >
                  <ChatMessageBubble
                    v-if="displayMessages[virtualRow.index]"
                    :message="displayMessages[virtualRow.index]"
                    :message-index="virtualRow.index"
                    :streaming="
                      messages.length > 0 &&
                      displayMessages[virtualRow.index]?.role === 'assistant' &&
                      virtualRow.index === displayMessages.length - 1 &&
                      streaming
                    "
                    :can-edit-other-message="displayMessages[virtualRow.index] && canEditMessage(displayMessages[virtualRow.index])"
                    @retry="retryMessage(virtualRow.index)"
                    @edit="onEditMessage(virtualRow.index)"
                    @view-edit-history="onViewEditHistory(virtualRow.index)"
                    @edit-user-message="onEditUserMessage(virtualRow.index)"
                    @retry-user-message="onRetryUserMessage(virtualRow.index)"
                    @recall-message="onRecallMessage(virtualRow.index)"
                    @delete-message="onDeleteMessage(virtualRow.index)"
                    @copy-message="onCopyMessage(virtualRow.index)"
                    @favorite="onFavoriteMessage(virtualRow.index)"
                    @export-markdown="onExportMarkdown()"
                    @listen-reply="onListenReply(virtualRow.index)"
                  />
                </div>
              </div>
            </template>
            <div v-else class="space-y-3">
              <div
                v-for="(msg, i) in displayMessages"
                :key="'msg-' + i"
                class="flex"
                :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
              >
                <ChatMessageBubble
                  :message="msg"
                  :message-index="i"
                  :streaming="
                    messages.length > 0 &&
                    msg.role === 'assistant' &&
                    i === displayMessages.length - 1 &&
                    streaming
                  "
                  :can-edit-other-message="canEditMessage(msg)"
                  @retry="retryMessage(i)"
                  @edit="onEditMessage(i)"
                  @view-edit-history="onViewEditHistory(i)"
                  @edit-user-message="onEditUserMessage(i)"
                  @retry-user-message="onRetryUserMessage(i)"
                  @recall-message="onRecallMessage(i)"
                  @delete-message="onDeleteMessage(i)"
                  @copy-message="onCopyMessage(i)"
                  @favorite="onFavoriteMessage(i)"
                  @export-markdown="onExportMarkdown()"
                  @listen-reply="onListenReply(i)"
                />
              </div>
            </div>
          </SpaceChatPane>
        </template>
        <ChatEmptyState
          v-if="!chatId || showChatPlaceholderOnFirstLoad"
          @new-chat="startNewChat"
        />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage } from '~/composables/useChatSessions'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { BarChart3, Bot, ClipboardList, Home, Layers, LogIn, Package, Settings, Users } from 'lucide-vue-next'

definePageMeta({ layout: 'workspace' })

const route = useRoute()
const router = useRouter()
const chatId = computed(() => (route.params.id as string) || undefined)

/** 页面首次加载且有 chatId 时先显示 ChatEmptyState 占位，挂载后置为 false 以显示 SpaceChatPane */
const showChatPlaceholderOnFirstLoad = ref(true)
const scrollRef = ref<HTMLElement | null>(null)
const input = ref('')
const streaming = ref(false)
const searchQuery = ref('')
const showAppList = ref(false)
const showSearchBar = ref(false)
function toggleAppList() { showAppList.value = !showAppList.value }
function toggleSearchBar() { showSearchBar.value = !showSearchBar.value }
function setSearchQuery(v: string) { searchQuery.value = v }
function setListViewTab(v: 'active' | 'favorites' | 'pending' | 'settings') { listViewTab.value = v }
const listViewTab = ref<'active' | 'favorites' | 'pending' | 'settings'>('active')
const pinnedCollapsed = ref(false)
const { sessionAreaFontScale } = useUISettings()
/** 应用抽屉项：内置视图（view）、扩展应用（appId）或 mock（无 view/appId，点击跳转全部应用） */
type DrawerAppItem =
  | { id: string; title: string; icon: typeof Home; view: 'home' | 'auth' | 'contacts' | 'bots' | 'settings' }
  | { id: string; title: string; icon: import('vue').Component; appId: string }
  | { id: string; title: string; icon: import('vue').Component }

const { list: appExtensionsList } = useAppExtensions()
const { isAuthenticated } = useAuth()
const { favoriteIds } = useAppFavorites()

/** 抽屉常用：固定 5 项 */
const drawerCommonApps = computed<DrawerAppItem[]>(() => [
  { id: 'home', title: '导航', view: 'home', icon: Home },
  { id: 'auth', title: '认证登录', view: 'auth', icon: LogIn },
  { id: 'contacts', title: '联系人', view: 'contacts', icon: Users },
  { id: 'bots', title: '机器人', view: 'bots', icon: Bot },
  { id: 'settings', title: '设置', view: 'settings', icon: Settings },
])

/** 收藏区 mock 应用（点击跳转全部应用，用于展示与引导） */
const DRAWER_FAVORITE_MOCK_APPS: DrawerAppItem[] = [
  { id: 'mock-material', title: '物料助手', icon: Package },
  { id: 'mock-order', title: '订单进度', icon: ClipboardList },
  { id: 'mock-bom', title: 'BOM 状态', icon: Layers },
  { id: 'mock-inventory', title: '库存概览', icon: BarChart3 },
]

/** 抽屉收藏：已收藏的扩展 + mock 应用 */
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

/** 抽屉「更多」：打开全部应用并收起抽屉 */
function onDrawerMore() {
  openNavPage()
  showAppList.value = false
}
/** 抽屉固定高度（rem），与 CSS 变量一致，避免截断与顶栏错位 */
const appDrawerHeightRem = 24
const toolbarTop = computed(() => (showAppList.value ? `${appDrawerHeightRem}rem` : '0'))
const listPaddingTop = computed(() => `${showAppList.value ? appDrawerHeightRem + 3 : 3}rem`)
function onSessionItemClick(id: string) {
  goToChat(id)
}

/** 右键菜单：切换置顶 */
function togglePin(id: string) {
  const idx = pinnedIds.value.indexOf(id)
  if (idx >= 0) {
    pinnedIds.value = pinnedIds.value.filter((x) => x !== id)
  } else {
    pinnedIds.value = [...pinnedIds.value, id]
  }
}

/** 右键菜单：重命名会话；真实会话走 ensureChat，mock 仅前端覆盖标题预览 */
function onSessionRename(id: string) {
  const c = displayChats.value.find((x) => x.id === id)
  const currentTitle = c?.title ?? ''
  const next = window.prompt('重命名会话', currentTitle)
  if (next == null || next.trim() === '') return
  const title = next.trim()
  if (isMockSession(id)) {
    mockTitleOverrides.value = { ...mockTitleOverrides.value, [id]: title }
    return
  }
  ensureChat(id, title)
}

/** 右键菜单：关闭会话；若当前正在该会话则退出到列表；mock 时并从列表隐藏以作预览 */
function onSessionClose(id: string) {
  if (isMockSession(id)) {
    if (!mockHiddenIds.value.includes(id)) {
      mockHiddenIds.value = [...mockHiddenIds.value, id]
    }
  }
  if (chatId.value === id) {
    router.push('/space')
  }
}

const streamAbortRef = ref<AbortController | null>(null)
/** 流式内容缓冲，定时刷新到 UI，避免每 chunk 都触发渲染 */
const streamContentBuffer = ref('')
const config = useRuntimeConfig()

/** 结论流式：接收到的文字先入队，再按间隔从队列取出“打字”；流结束后加速打完剩余 */
const STREAM_TYPEWRITER_INTERVAL_MS = 80
const STREAM_TYPEWRITER_CHARS_PER_TICK = 1
const STREAM_TYPEWRITER_MIN_INTERVAL_MS = 16
const STREAM_TYPEWRITER_ACCELERATION = 0.92
let typewriterTimerId: ReturnType<typeof setTimeout> | null = null

const {
  chats,
  getMessages,
  setMessages,
  appendMessage,
  updateLastMessage,
  ensureChat,
  createNewChat,
  getConversationId,
  getNonReadCount,
  markChatAsRead,
} = useChatSessions()

const { loadSessions, loadSessionMessages } = useChatSessionsApi()
/** 是否像后端会话 id（UUID 或 Mock 适配器的 mock-session-*） */
function isBackendSessionId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || id.startsWith('mock-session-')
}

/** 顶栏三点菜单：导出 / 转发等（占位，暂不实现具体功能） */
function onExportCurrentScreen() {
  // TODO: 当前屏截图
}
function onExportLongScreenshot() {
  // TODO: 完整聊天内容长屏截图
}
/** 客户端兜底：服务端不可用时在浏览器内生成 Markdown */
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
function onShareConversation() {
  // TODO: 分享会话
}
function onCopySessionLink() {
  if (!chatId.value) return
  const url = `${window.location.origin}${route.fullPath}`
  navigator.clipboard.writeText(url).catch(() => {})
}
function onCloseChat() {
  router.push('/space')
}
function onRenameChat() {
  // TODO: 重命名会话
}
function onArchiveChat() {
  // TODO: 归档会话
}
function onDeleteChat() {
  // TODO: 删除会话
}

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

const filteredChats = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return chats.value
  return chats.value.filter((c) => {
    const title = (c.title ?? '').toLowerCase()
    const preview = lastPreview(c.id).toLowerCase()
    return title.includes(q) || preview.includes(q)
  })
})

import type { MockSessionItem } from '~/mock'
import {
  MOCK_SESSION_LIST_ENABLED,
  getMockSessionById,
  getMockSessionList,
  isMockSession,
  seedMockMessages,
} from '~/composables/useMockSessions'

type DisplayChatItem = { id: string; title: string; type?: MockSessionItem['type']; updatedAt?: number; participants?: MockSessionItem['participants'] }

/** Mock 预览：会话标题覆盖（右键重命名后展示） */
const mockTitleOverrides = ref<Record<string, string>>({})
/** Mock 预览：关闭后从列表隐藏的会话 id */
const mockHiddenIds = ref<string[]>([])

const displayChats = computed<DisplayChatItem[]>(() => {
  const real = filteredChats.value.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
  }))
  if (!MOCK_SESSION_LIST_ENABLED) return real
  const mockList = getMockSessionList()
    .filter((m) => !mockHiddenIds.value.includes(m.id))
    .map((m) => ({
      ...m,
      title: mockTitleOverrides.value[m.id] ?? m.title,
    }))
  return [...real, ...mockList]
})

/** 置顶会话 id 列表（可后续从设置/接口同步） */
const pinnedIds = ref<string[]>(['mock-private-zhangsan', 'mock-group-product'])
/** 置顶区会话（保持 displayChats 中的顺序） */
const pinnedChats = computed<DisplayChatItem[]>(() =>
  displayChats.value.filter((c) => pinnedIds.value.includes(c.id)),
)
/** 活动区会话：当前会话自动在顶部，其余按原序 */
const activeChats = computed<DisplayChatItem[]>(() => {
  const list = displayChats.value.filter((c) => !pinnedIds.value.includes(c.id))
  const current = chatId.value
  if (!current) return list
  const idx = list.findIndex((c) => c.id === current)
  if (idx <= 0) return list
  const item = list[idx]
  return [item, ...list.slice(0, idx), ...list.slice(idx + 1)]
})

/** 待处理：存在非已读消息的会话（未读、发送中、已送达等） */
const pendingChats = computed<DisplayChatItem[]>(() =>
  displayChats.value.filter((c) => getNonReadCount(c.id) > 0),
)
const totalPendingCount = computed(() =>
  displayChats.value.reduce((sum, c) => sum + getNonReadCount(c.id), 0),
)

function isMockSession(id: string) {
  return id.startsWith('mock-')
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
function getChatDateLabel(id: string): string {
  const mock = getMockSessionById(id)
  if (mock) return formatChatDate(mock.updatedAt)
  const c = chats.value.find((x) => x.id === id)
  return c?.updatedAt ? formatChatDate(c.updatedAt) : ''
}

const chatTitle = computed(() => {
  if (!chatId.value) return ''
  const mock = getMockSessionById(chatId.value)
  if (mock) return mock.title
  const c = chats.value.find((x) => x.id === chatId.value)
  return c?.title ?? '会话'
})

const chatUserName = computed(() => '张三')

function lastPreview(chatId: string): string {
  const list = getMessages(chatId)
  if (list.length === 0) return '点击开始对话'
  const last = list[list.length - 1]
  const text = last.content.trim()
  return text ? (text.length > 20 ? `${text.slice(0, 20)}…` : text) : '点击开始对话'
}

function goToChat(id: string) {
  router.push(`/space/${id}`)
}

/** 创建新会话：仅走真实会话逻辑（useChatSessions），不创建 mock；新建会话排在列表前 */
function startNewChat() {
  const id = createNewChat()
  router.push(`/space/${id}`)
}

const { getWithTitle } = useContactsAndBots()
const { openPanel, openNavPage, currentView, addTab, activeTab } = useAppView()

/** 向当前会话加人/机器人：打开应用区并进入联系人，后续可扩展为专属「加人」面板 */
function openAddParticipant() {
  openPanel('contacts')
}

function drawerAppActive(app: DrawerAppItem): boolean {
  if ('view' in app && app.view) return currentView.value === app.view
  if ('appId' in app && app.appId) return activeTab.value?.view === 'app' && activeTab.value?.appId === app.appId
  return false
}
/** 展开：会话列表与聊天区左右并排（由 layout provide） */
const isSessionExpanded = inject<Ref<boolean>>('isSessionExpanded', ref(false))
const appContentVisible = inject<Ref<boolean>>('appContentVisible', ref(false))
const showAppPanel = inject<Ref<boolean>>('showAppPanel', ref(false))

/** 进入会话时将该会话内收到的消息标记为已读 */
watch(chatId, (id) => {
  if (id) markChatAsRead(id)
}, { immediate: true })

/** 进入后端会话且无消息时拉取历史 */
watch(chatId, (id) => {
  if (id && isBackendSessionId(id) && getMessages(id).length === 0) {
    loadSessionMessages(id).catch(() => {})
  }
})

onMounted(() => {
  // 延迟关闭占位，确保首帧/布局稳定后用户能看见 ChatEmptyState，再切到真实聊天
  const t = setTimeout(() => { showChatPlaceholderOnFirstLoad.value = false }, 120)
  onBeforeUnmount(() => clearTimeout(t))
  const id = chatId.value
  if (id) {
    if (!isMockSession(id)) {
      const c = chats.value.find((x) => x.id === id)
      if (!c) {
        const title = getWithTitle(id) ?? '会话'
        ensureChat(id, title)
      }
      // 若为后端会话 id 且当前无消息，从 API 拉取历史（可选、静默失败）
      if (isBackendSessionId(id) && getMessages(id).length === 0) {
        loadSessionMessages(id).catch(() => {})
      }
    }
  } else {
    const app = route.query.app as 'contacts' | 'bots' | undefined
    if (app === 'contacts' || app === 'bots') openPanel(app)
  }
  // 拉取标准化会话列表并合并（当前后端不支持时静默跳过）
  loadSessions().catch(() => {})
  if (MOCK_SESSION_LIST_ENABLED) seedMockMessages(getMessages, setMessages)
})

watch(() => route.query.app, (app) => {
  if (app === 'contacts' || app === 'bots') openPanel(app)
})

onMounted(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && e.shiftKey && streaming.value) {
      e.preventDefault()
      stopStream()
    }
  }
  window.addEventListener('keydown', onKey)
  onUnmounted(() => window.removeEventListener('keydown', onKey))
})

const { streamChat } = useChatStream()

function stopStream() {
  if (streamAbortRef.value) {
    streamAbortRef.value.abort()
    streamAbortRef.value = null
  }
  streaming.value = false
}

/** 滚动到底部，使最后一条消息可见。behavior 为 'auto' 时立即滚动（用于流式打字跟随） */
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

/** 仅追加助手占位并流式回复，不追加用户消息（供 send / retry 复用） */
async function streamReply(id: string, text: string) {
  appendMessage(id, { role: 'assistant', content: '', thinking: '' })
  nextTick(() => scrollToLastMessage())
  streaming.value = true
  streamAbortRef.value = new AbortController()
  streamContentBuffer.value = ''
  const placeholder = '思考中…'
  updateLastMessage(id, (m) => { m.content = placeholder })

  let streamEnded = false
  let currentDelayMs = STREAM_TYPEWRITER_INTERVAL_MS

  /** 从队列取出一小段“打字”到界面；流结束后每 tick 缩短间隔（加速） */
  function typewriterTick() {
    const buf = streamContentBuffer.value
    if (buf) {
      const take = buf.slice(0, STREAM_TYPEWRITER_CHARS_PER_TICK)
      streamContentBuffer.value = buf.slice(STREAM_TYPEWRITER_CHARS_PER_TICK)
      updateLastMessage(id, (m) => {
        const base = m.content === placeholder ? '' : m.content
        m.content = base + take
        if (!m.contentChunks) m.contentChunks = []
        m.contentChunks.push(take)
      })
      scrollToLastMessage('auto')
    }

    if (buf === '' && streamEnded) {
      typewriterTimerId = null
      updateLastMessage(id, (m) => { m.contentChunks = undefined })
      const list = getMessages(id)
      const last = list[list.length - 1]
      if (last && !last.content) {
        updateLastMessage(id, (m) => { m.content = '（未收到任何内容，请检查中间层与 CORS 配置）' })
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
      (delta) => {
        streamContentBuffer.value += delta
      },
      {
        signal: streamAbortRef.value?.signal,
        conversationId: getConversationId(id),
        onThinking: () => {
          streamContentBuffer.value = ''
          updateLastMessage(id, (m) => {
            m.content = placeholder
            m.contentChunks = undefined
          })
        },
        onThinkingDelta: (delta) => {
          updateLastMessage(id, (m) => {
            if (!m.thinking) m.thinking = ''
            m.thinking += delta
          })
        },
        onThinkingDone: (fullText) => {
          updateLastMessage(id, (m) => { if (fullText) m.thinking = fullText })
        },
      }
    )
    streamEnded = true
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const friendly = /failed to fetch|networkerror|network error/i.test(msg)
      ? '网络错误，请确认中间层已启动且可访问（检查 NUXT_PUBLIC_API_BASE 或代理）'
      : msg
    updateLastMessage(id, (m) => {
      m.content = `请求失败：${friendly}`
    })
  } finally {
    if (!streamEnded) {
      if (typewriterTimerId) {
        clearTimeout(typewriterTimerId)
        typewriterTimerId = null
      }
      updateLastMessage(id, (m) => { m.contentChunks = undefined })
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
  input.value = ''
  appendMessage(id, { role: 'user', content: text })
  nextTick(() => scrollToLastMessage())
  await streamReply(id, text)
}

/** 重试该条助手消息：移除当前助手回复，用上一条用户消息重新请求 */
/** 是否拥有编辑对方消息的全局权限；后续可改为从权限/角色或接口获取 */
const canEditOtherMessage = ref(true)

/** 当前用户是否可编辑该条消息：有全局权限且该条未被标记为不可编辑（如对方为更高权限者） */
function canEditMessage(msg: ChatMessage): boolean {
  if (msg.role !== 'assistant') return false
  if (!canEditOtherMessage.value) return false
  return msg.editableByCurrentUser !== false
}

function onEditMessage(index: number) {
  const id = chatId.value
  if (!id) return
  const list = getMessages(id)
  if (index < 0 || index >= list.length) return
  const msg = list[index]
  if (msg.role !== 'assistant') return
  // TODO: 打开编辑态或弹窗，提交后调用接口更新该条消息
}

function onViewEditHistory(index: number) {
  const id = chatId.value
  if (!id) return
  const list = getMessages(id)
  if (index < 0 || index >= list.length) return
  const msg = list[index]
  if (msg.role !== 'assistant') return
  // TODO: 打开编辑历史弹窗，拉取该条消息的编辑历史并展示
}

function onEditUserMessage(index: number) {
  const id = chatId.value
  if (!id) return
  const list = getMessages(id)
  if (index < 0 || index >= list.length) return
  const msg = list[index]
  if (msg.role !== 'user') return
  // TODO: 将本条内容回填到输入框或打开编辑态，支持修改后重发
}

function onRetryUserMessage(index: number) {
  const id = chatId.value
  if (!id || streaming.value) return
  const list = getMessages(id)
  if (index < 0 || index >= list.length) return
  const msg = list[index]
  if (msg.role !== 'user' || msg.receiptStatus !== 'failed') return
  // TODO: 重新发送该条用户消息（调发送接口并更新 receiptStatus）
}

function onRecallMessage(index: number) {
  const id = chatId.value
  if (!id) return
  const list = getMessages(id)
  if (index < 0 || index >= list.length) return
  // TODO: 调用撤回接口后从 list 移除该条
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

function onFavoriteMessage(_index: number) {
  // TODO: 收藏该条消息
}

function onListenReply(_index: number) {
  // TODO: 朗读该条回复
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
  streamReply(id, userMsg.content)
}
</script>

<style scoped>
@media (max-width: 320px) {
  .session-area-container {
    border-radius: 0;
    border: none !important;
  }
}

.search-slide-enter-active,
.search-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.search-slide-enter-from,
.search-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
</style>
