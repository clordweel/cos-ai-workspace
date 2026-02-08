<template>
  <!-- 会话区：展开时列表与聊天左右并排 -->
  <div class="h-full w-full min-w-0 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
    <div
      class="flex min-h-0 min-w-0 flex-1"
      :class="isSessionExpanded ? 'flex-row w-full' : 'flex-col'"
    >
      <aside
        v-show="isSessionExpanded || !chatId"
        class="flex flex-col min-h-0 shrink-0 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
        :class="isSessionExpanded ? 'w-64 border-r' : 'flex-1 min-w-0 overflow-hidden border-b border-zinc-200 dark:border-zinc-700'"
      >
        <div class="relative flex-1 min-h-0 flex flex-col min-w-0">
          <div class="session-list-scroll-area absolute inset-0 z-0 overflow-y-auto overscroll-contain pb-24">
            <template v-if="listViewTab === 'active'">
              <div class="min-h-full flex flex-col transition-[padding] duration-200" :style="{ paddingTop: listPaddingTop }">
                <section class="session-list-pinned border-b border-zinc-100 dark:border-zinc-700/80 bg-amber-50/60 dark:bg-amber-950/20 border-l-2 border-l-amber-400/70 dark:border-l-amber-500/50 rounded-r-md">
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 rounded-r-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 focus-visible:ring-inset"
                    @click="pinnedCollapsed = !pinnedCollapsed"
                  >
                    <component :is="pinnedCollapsed ? ChevronRight : ChevronDown" class="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <Pin class="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span class="flex-1">置顶</span>
                    <span v-if="pinnedChats.length > 0" class="shrink-0 min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-md bg-amber-200/80 dark:bg-amber-700/50 text-amber-800 dark:text-amber-200 text-[11px] font-semibold tabular-nums">
                      {{ pinnedChats.length }}
                    </span>
                  </button>
                  <ul v-show="!pinnedCollapsed && pinnedChats.length !== 0" class="divide-y divide-amber-100 dark:divide-amber-900/40">
                    <SessionListItem v-for="c in pinnedChats" :key="c.id" :item="c" :is-active="c.id === chatId && isSessionExpanded" :is-mock="isMockSession(c.id)" :date-label="getChatDateLabel(c.id)" @click="onSessionItemClick(c.id)" />
                  </ul>
                </section>
                <section class="flex-1 min-h-0 flex flex-col">
                  <template v-if="activeChats.length !== 0">
                    <ul class="divide-y divide-zinc-100 dark:divide-zinc-700 min-h-full">
                      <SessionListItem v-for="c in activeChats" :key="c.id" :item="c" :is-active="c.id === chatId && isSessionExpanded" :is-mock="isMockSession(c.id)" :date-label="getChatDateLabel(c.id)" @click="onSessionItemClick(c.id)" />
                    </ul>
                  </template>
                  <div v-else-if="searchQuery" class="flex-1 min-h-0 flex flex-col items-center justify-center py-12 px-4 text-center">
                    <Search class="h-10 w-10 text-zinc-300 dark:text-zinc-500 mb-2" />
                    <p class="text-sm text-zinc-500 dark:text-zinc-400">无匹配会话</p>
                    <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">试试其它关键词</p>
                  </div>
                </section>
              </div>
            </template>
            <template v-else-if="listViewTab === 'favorites'">
              <div class="min-h-full flex flex-col items-center justify-center py-12 px-4 text-center" :style="{ paddingTop: listPaddingTop }">
                <Archive class="h-10 w-10 text-zinc-300 dark:text-zinc-500 mb-2" />
                <p class="text-sm text-zinc-500 dark:text-zinc-400">收藏与归档</p>
                <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">暂无收藏或归档会话</p>
              </div>
            </template>
            <template v-else-if="listViewTab === 'pending'">
              <div class="min-h-full flex flex-col transition-[padding] duration-200" :style="{ paddingTop: listPaddingTop }">
                <section class="border-b border-zinc-100 dark:border-zinc-700/80 px-3 py-2">
                  <p class="text-xs font-medium text-zinc-500 dark:text-zinc-400">未读、发送中、已送达等（非已读）</p>
                </section>
                <section v-if="pendingChats.length > 0" class="flex-1 min-h-0 overflow-y-auto">
                  <ul class="divide-y divide-zinc-100 dark:divide-zinc-700">
                    <li
                      v-for="c in pendingChats"
                      :key="c.id"
                      role="button"
                      tabindex="0"
                      class="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/40 rounded-md"
                      @click="onSessionItemClick(c.id)"
                      @keydown.enter.prevent="onSessionItemClick(c.id)"
                    >
                      <SessionListThumb :type="c.type === 'group' ? 'group' : 'private'" :participants="c.participants ?? [{ name: c.title }]" />
                      <div class="min-w-0 flex-1">
                        <p class="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{{ c.title }}</p>
                        <p class="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{{ getChatDateLabel(c.id) }}</p>
                      </div>
                      <span class="shrink-0 min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-[11px] font-semibold tabular-nums">
                        {{ getNonReadCount(c.id) }}
                      </span>
                      <span class="text-zinc-400 dark:text-zinc-500 text-xs">›</span>
                    </li>
                  </ul>
                </section>
                <div v-else class="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Inbox class="h-10 w-10 text-zinc-300 dark:text-zinc-500 mb-2" />
                  <p class="text-sm text-zinc-500 dark:text-zinc-400">暂无待处理消息</p>
                  <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">已读以外的消息会出现在这里</p>
                </div>
              </div>
            </template>
            <template v-else-if="listViewTab === 'settings'">
              <div class="min-h-full flex flex-col items-center justify-center py-12 px-4 text-center" :style="{ paddingTop: listPaddingTop }">
                <Settings class="h-10 w-10 text-zinc-300 dark:text-zinc-500 mb-2" />
                <p class="text-sm text-zinc-500 dark:text-zinc-400">会话设置</p>
                <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">通知、提醒等（占位）</p>
              </div>
            </template>
          </div>
          <Transition name="fade">
            <div v-show="showAppList" class="app-drawer absolute left-0 right-0 z-20 flex max-h-[16rem] w-full shrink-0 flex-col border-b border-zinc-200/60 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800 shadow-lg transition-all duration-200 isolate" :style="{ top: '0' }">
              <div class="app-drawer-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pl-8 pr-7 pt-3 pb-8">
                <div class="mb-3 flex flex-col items-center gap-0">
                  <Logo :size="22" class="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span class="text-[10px] text-zinc-600 dark:text-zinc-400">由 COS AI 驱动</span>
                </div>
                <div class="grid auto-rows-[minmax(3.5rem,auto)] gap-1.5" :style="{ gridTemplateColumns: 'repeat(auto-fill, minmax(3.5rem, 1fr))' }">
                  <button v-for="app in drawerApps" :key="app.id" type="button" class="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors" :class="app.view && currentView === app.view ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''" @click="onDrawerAppClick(app)">
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-700" :class="app.view && currentView === app.view ? 'ring-2 ring-primary-500/50 text-primary-600 dark:text-primary-400' : ''">
                      <component :is="app.icon" class="h-4 w-4" />
                    </span>
                    <span class="text-xs">{{ app.title }}</span>
                  </button>
                </div>
              </div>
            </div>
          </Transition>
          <SessionListHeader class="absolute left-0 right-0 z-20 transition-[top] duration-200 ease-out bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md" :style="{ top: toolbarTop }" :app-drawer-open="showAppList" :search-bar-open="showSearchBar" v-model:search-query="searchQuery" @new-chat="startNewChat" @search="toggleSearchBar" @app="toggleAppList" />
          <SessionListBottomNav v-model="listViewTab" :pending-count="totalPendingCount" />
        </div>
      </aside>
      <!-- 右侧/下方：展开时始终显示，否则仅 chat 时显示 -->
      <main
        class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative"
        v-show="isSessionExpanded || !!chatId"
      >
        <template v-if="chatId">
          <ChatHeader
            :title="chatTitle"
            :user-name="chatUserName"
            :is-session-expanded="isSessionExpanded"
            @close="onCloseChat"
            @rename="onRenameChat"
            @share="onShareConversation"
            @copy-link="onCopySessionLink"
            @export-screen="onExportCurrentScreen"
            @export-screenshot="onExportLongScreenshot"
            @export-markdown="onExportMarkdown"
            @archive="onArchiveChat"
            @delete="onDeleteChat"
          />
          <!-- 滚动区：虚拟列表 + 可定制滚动条；虚拟未就绪时回退为普通列表 -->
          <div
            ref="scrollRef"
            class="chat-scroll-area absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain p-3 pl-5 pt-16 pb-52"
          >
            <!-- 虚拟列表就绪时：只渲染可见行 -->
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
                    :streaming="
                      messages.length > 0 &&
                      displayMessages[virtualRow.index]?.role === 'assistant' &&
                      virtualRow.index === displayMessages.length - 1 &&
                      streaming
                    "
                    @retry="retryMessage(virtualRow.index)"
                  />
                </div>
              </div>
            </template>
            <!-- 虚拟未就绪（如首帧 scrollRef 未挂载）或无虚拟行时：普通列表 -->
            <div v-else class="space-y-3">
              <div
                v-for="(msg, i) in displayMessages"
                :key="'msg-' + i"
                class="flex"
                :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
              >
                <ChatMessageBubble
                  :message="msg"
                  :streaming="
                    messages.length > 0 &&
                    msg.role === 'assistant' &&
                    i === displayMessages.length - 1 &&
                    streaming
                  "
                  @retry="retryMessage(i)"
                />
              </div>
            </div>
          </div>
          <ChatInputPanel
            v-model="input"
            :streaming="streaming"
            @submit="send"
            @stop="stopStream"
            @clear="input = ''"
            @scroll-to-last="scrollToLastMessage"
          />
        </template>
        <ChatEmptyState v-else @new-chat="startNewChat" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage } from '~/composables/useChatSessions'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { Archive, Bookmark, Bot, Calendar, CheckSquare, ChevronDown, ChevronRight, Cloud, FileText, Home, Image as ImageIcon, Inbox, LogIn, Music, Pin, Search, Settings, StickyNote, Users } from 'lucide-vue-next'

definePageMeta({ layout: 'workspace' })

const route = useRoute()
const router = useRouter()
const chatId = computed(() => (route.params.id as string) || undefined)

const scrollRef = ref<HTMLElement | null>(null)
const input = ref('')
const streaming = ref(false)
const searchQuery = ref('')
const showAppList = ref(false)
const showSearchBar = ref(false)
function toggleAppList() { showAppList.value = !showAppList.value }
function toggleSearchBar() { showSearchBar.value = !showSearchBar.value }
const listViewTab = ref<'active' | 'favorites' | 'pending' | 'settings'>('active')
const pinnedCollapsed = ref(false)
const drawerApps = [
  { id: 'home', title: '导航', view: 'home' as const, icon: Home },
  { id: 'auth', title: '认证登录', view: 'auth' as const, icon: LogIn },
  { id: 'contacts', title: '联系人', view: 'contacts' as const, icon: Users },
  { id: 'bots', title: '机器人', view: 'bots' as const, icon: Bot },
  { id: 'settings', title: '设置', view: 'settings' as const, icon: Settings },
  { id: 'mock-calendar', title: '日历', icon: Calendar },
  { id: 'mock-files', title: '文件', icon: FileText },
  { id: 'mock-notes', title: '笔记', icon: StickyNote },
  { id: 'mock-tasks', title: '任务', icon: CheckSquare },
  { id: 'mock-bookmark', title: '书签', icon: Bookmark },
  { id: 'mock-gallery', title: '图库', icon: ImageIcon },
  { id: 'mock-music', title: '音乐', icon: Music },
  { id: 'mock-weather', title: '天气', icon: Cloud },
]
function onDrawerAppClick(app: (typeof drawerApps)[number]) {
  if ('view' in app && app.view) { if (app.view === 'home') openNavPage(); else openPanel(app.view) }
}
const appDrawerHeightRem = 16
const toolbarTop = computed(() => (showAppList.value ? `${appDrawerHeightRem}rem` : '0'))
const listPaddingTop = computed(() => `${showAppList.value ? appDrawerHeightRem + 3 : 3}rem`)
function onSessionItemClick(id: string) {
  goToChat(id)
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
const displayChats = computed<DisplayChatItem[]>(() => {
  const real = filteredChats.value.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
  }))
  if (!MOCK_SESSION_LIST_ENABLED) return real
  return [...real, ...getMockSessionList()]
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
const { openPanel, openNavPage, currentView } = useAppView()
/** 展开：会话列表与聊天区左右并排（由 layout provide，应用区关闭或应用内容区折叠时为 true） */
const isSessionExpanded = inject<Ref<boolean>>('isSessionExpanded', ref(false))

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

function scrollToLastMessage() {
  const n = displayMessages.value.length
  if (n === 0) return
  if (virtualRows.value.length > 0) {
    rowVirtualizerRef.value.scrollToIndex(n - 1, { align: 'end', behavior: 'smooth' })
  } else {
    const el = scrollRef.value
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }
}

/** 仅追加助手占位并流式回复，不追加用户消息（供 send / retry 复用） */
async function streamReply(id: string, text: string) {
  appendMessage(id, { role: 'assistant', content: '', thinking: '' })
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
  await streamReply(id, text)
}

/** 重试该条助手消息：移除当前助手回复，用上一条用户消息重新请求 */
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 会话消息区选中：与气泡背景协调，主题色半透明 */
.chat-scroll-area *::selection {
  background: rgb(59 130 246 / 0.22);
  color: inherit;
}
.chat-scroll-area *::-moz-selection {
  background: rgb(59 130 246 / 0.22);
  color: inherit;
}
:global(.dark) .chat-scroll-area *::selection {
  background: rgb(96 165 250 / 0.28);
}
:global(.dark) .chat-scroll-area *::-moz-selection {
  background: rgb(96 165 250 / 0.28);
}

/* 可定制滚动条：细条、圆角、悬停显色，千条消息下仍流畅 */
.chat-scroll-area {
  scrollbar-gutter: stable;
}
.chat-scroll-area::-webkit-scrollbar {
  width: 2px;
}
.chat-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}
.chat-scroll-area::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: rgb(161 161 170 / 0.4);
}
.chat-scroll-area::-webkit-scrollbar-thumb:hover {
  background: rgb(161 161 170 / 0.6);
}
.chat-scroll-area::-webkit-scrollbar-thumb:active {
  background: rgb(161 161 170 / 0.8);
}
@supports (scrollbar-width: thin) {
  .chat-scroll-area {
    scrollbar-width: thin;
    scrollbar-color: rgb(161 161 170 / 0.5) transparent;
  }
}

/* 会话列表区选中：略柔和，与列表项悬停风格一致 */
.session-list-scroll-area *::selection {
  background: rgb(59 130 246 / 0.18);
  color: inherit;
}
.session-list-scroll-area *::-moz-selection {
  background: rgb(59 130 246 / 0.18);
  color: inherit;
}
:global(.dark) .session-list-scroll-area *::selection {
  background: rgb(96 165 250 / 0.22);
}
:global(.dark) .session-list-scroll-area *::-moz-selection {
  background: rgb(96 165 250 / 0.22);
}

.session-list-scroll-area { scrollbar-gutter: stable; }
.session-list-scroll-area::-webkit-scrollbar { width: 2px; }
.session-list-scroll-area::-webkit-scrollbar-track { background: transparent; }
.session-list-scroll-area::-webkit-scrollbar-thumb { border-radius: 4px; background: rgb(161 161 170 / 0.4); }
.session-list-scroll-area::-webkit-scrollbar-thumb:hover { background: rgb(161 161 170 / 0.6); }
.app-drawer-scroll { scrollbar-width: none; }
.app-drawer-scroll::-webkit-scrollbar { display: none; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
