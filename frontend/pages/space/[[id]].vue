<template>
  <!-- 会话区：展开时列表与聊天左右并排 -->
  <div class="h-full w-full min-w-0 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
    <div
      class="flex min-h-0 min-w-0 flex-1"
      :class="isSessionExpanded ? 'flex-row w-full' : 'flex-col'"
    >
      <!-- 列表：展开时始终显示，否则仅无 chat 时显示 -->
      <aside
        v-show="isSessionExpanded || !chatId"
        class="flex flex-col min-h-0 shrink-0 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
        :class="isSessionExpanded ? 'w-64 border-r' : 'flex-1 min-w-0 overflow-hidden border-b border-zinc-200 dark:border-zinc-700'"
      >
        <div class="relative flex-1 min-h-0 flex flex-col">
          <div class="session-list-scroll-area absolute inset-0 z-0 overflow-y-auto overscroll-contain">
            <template v-if="displayChats.length > 0">
              <ul
                class="divide-y divide-zinc-100 dark:divide-zinc-700 min-h-full transition-[padding] duration-200"
                :style="{ paddingTop: listPaddingTop }"
              >
              <li
                v-for="c in displayChats"
                :key="c.id"
                role="button"
                tabindex="0"
                class="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:ring-offset-2 rounded-md"
                :class="[
                  c.id === chatId && isSessionExpanded ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 active:bg-zinc-100 dark:active:bg-zinc-700',
                  isMockSession(c.id) ? 'opacity-80' : '',
                ]"
                @click="onSessionItemClick(c.id)"
                @keydown.enter.prevent="onSessionItemClick(c.id)"
              >
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300 text-xs font-medium">
                {{ c.title.charAt(0) }}
              </span>
              <p class="min-w-0 flex-1 text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{{ c.title }}</p>
              <span v-if="getChatDateLabel(c.id)" class="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">{{ getChatDateLabel(c.id) }}</span>
              <span class="text-zinc-400 dark:text-zinc-500 text-xs">›</span>
            </li>
              </ul>
            </template>
            <div
              v-else-if="searchQuery"
              class="flex flex-col items-center justify-center py-12 px-4 text-center min-h-full transition-[padding] duration-200"
              :style="{ paddingTop: listPaddingTop }"
            >
              <Search class="h-10 w-10 text-zinc-300 dark:text-zinc-500 mb-2" />
              <p class="text-sm text-zinc-500 dark:text-zinc-400">无匹配会话</p>
              <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">试试其它关键词</p>
            </div>
          </div>
          <!-- 应用抽屉：整块可滚动（含「应用 / 更多」行 + 网格），展开时顶栏下移 -->
          <Transition name="fade">
            <div
              v-show="showAppList"
              class="app-drawer absolute left-0 right-0 z-20 flex max-h-[16rem] w-full shrink-0 flex-col border-b border-zinc-200/60 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800 shadow-lg transition-all duration-200 isolate"
              :style="{ top: '0' }"
            >
              <div class="app-drawer-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pl-8 pr-7 pt-3 pb-8">
                <!-- 由 logo + COS AI 驱动（跟随滚动） -->
                <div class="mb-3 flex flex-col items-center gap-0">
                  <Logo :size="22" class="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span class="text-[10px] text-zinc-600 dark:text-zinc-400">由 COS AI 驱动</span>
                </div>
                <div
                  class="grid auto-rows-[minmax(3.5rem,auto)] gap-1.5"
                  style="grid-template-columns: repeat(auto-fill, minmax(3.5rem, 1fr));"
                >
                <button
                  v-for="app in drawerApps"
                  :key="app.id"
                  type="button"
                  class="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors"
                  :class="app.view && currentView === app.view ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''"
                  @click="onDrawerAppClick(app)"
                >
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-700"
                    :class="app.view && currentView === app.view ? 'ring-2 ring-primary-500/50 text-primary-600 dark:text-primary-400' : ''"
                  >
                    <component :is="app.icon" class="h-4 w-4" />
                  </span>
                  <span class="text-xs">{{ app.title }}</span>
                </button>
              </div>
              </div>
            </div>
          </Transition>
          <!-- 顶栏：随应用展开整体下移，搜索条从搜索按钮向左展开 -->
          <SessionListHeader
            class="absolute left-0 right-0 z-20 transition-[top] duration-200 ease-out bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md"
            :style="{ top: toolbarTop }"
            :app-drawer-open="showAppList"
            :search-bar-open="showSearchBar"
            v-model:search-query="searchQuery"
            @new-chat="startNewChat"
            @search="toggleSearchBar"
            @app="toggleAppList"
          />
        </div>
      </aside>
      <!-- 右侧/下方：展开时始终显示，否则仅 chat 时显示 -->
      <main
        class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative"
        v-show="isSessionExpanded || !!chatId"
      >
        <template v-if="chatId">
          <!-- 顶部导航：半透明亚克力 -->
          <header
            class="absolute top-0 left-0 right-0 z-20 grid h-12 shrink-0 grid-cols-[1fr_1fr_1fr] items-center gap-2 px-3 border-b border-zinc-200/60 dark:border-zinc-700/60 backdrop-blur-md bg-white/75 dark:bg-zinc-800/75"
            aria-label="会话标题"
          >
            <div class="flex min-w-0 items-center gap-2">
              <NuxtLink
                v-if="!isSessionExpanded"
                to="/space"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                aria-label="返回会话列表"
              >
                <ChevronLeft class="h-4 w-4" />
              </NuxtLink>
            </div>
            <div class="flex min-w-0 items-center justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger class="max-w-[14rem]" aria-label="会话菜单">
                  <span class="truncate">{{ chatTitle }}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" :side-offset="4">
                  <DropdownMenuItem text-value="重命名会话" @select="onRenameChat">
                    <Pencil class="h-3.5 w-3.5 shrink-0 opacity-70" />
                    重命名会话
                  </DropdownMenuItem>
                  <DropdownMenuItem text-value="分享此会话" @select="onShareConversation">
                    <Share2 class="h-3.5 w-3.5 shrink-0 opacity-70" />
                    分享此会话
                  </DropdownMenuItem>
                  <DropdownMenuItem text-value="复制会话链接" @select="onCopySessionLink">
                    <Link class="h-3.5 w-3.5 shrink-0 opacity-70" />
                    复制会话链接
                  </DropdownMenuItem>
                  <DropdownMenuItem text-value="关闭会话" @select="onCloseChat">
                    <X class="h-3.5 w-3.5 shrink-0 opacity-70" />
                    关闭会话
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger text-value="导出为...">
                      <Download class="h-3.5 w-3.5 shrink-0 opacity-70" />
                      导出为…
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem text-value="当前屏" @select="onExportCurrentScreen">
                        当前屏
                      </DropdownMenuItem>
                      <DropdownMenuItem text-value="长屏截图" @select="onExportLongScreenshot">
                        长屏截图
                      </DropdownMenuItem>
                      <DropdownMenuItem text-value="导出 markdown" @select="onExportMarkdown">
                        导出 Markdown
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem text-value="归档会话" @select="onArchiveChat">
                    <Archive class="h-3.5 w-3.5 shrink-0 opacity-70" />
                    归档会话
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    text-value="删除会话"
                    class="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    @select="onDeleteChat"
                  >
                    <Trash2 class="h-3.5 w-3.5 shrink-0 opacity-80" />
                    删除会话
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div class="flex min-w-0 items-center justify-end gap-1.5">
            <span class="shrink-0 text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[8rem]" :title="chatUserName">{{ chatUserName }}</span>
            <span
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 text-xs font-medium"
              aria-hidden
            >
              <template v-if="chatUserName?.trim()">{{ chatUserName.trim().slice(0, 1) }}</template>
              <User v-else class="h-3.5 w-3.5" />
            </span>
            </div>
          </header>
          <!-- 滚动区：虚拟列表 + 可定制滚动条；虚拟未就绪时回退为普通列表以显示调试占位 -->
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
            <!-- 虚拟未就绪（如首帧 scrollRef 未挂载）或无虚拟行时：普通列表，保证调试占位可见 -->
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
          <!-- 底部：向上渐变遮盖 + 编辑框 -->
          <div class="absolute bottom-0 left-0 right-0 z-20 flex flex-col">
            <div
              class="h-16 pointer-events-none shrink-0 bg-gradient-to-t from-white to-transparent dark:from-zinc-800 dark:to-transparent"
              aria-hidden
            />
            <div class="shrink-0 p-3 pt-0 bg-white dark:bg-zinc-800">
            <div class="rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-sm overflow-hidden">
              <!-- 顶栏：流式时显示 Stop、快捷键、清空、Review -->
              <div
                v-if="streaming"
                class="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-700"
              >
                <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <button
                    type="button"
                    class="font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
                    @click="stopStream"
                  >
                    停止
                  </button>
                  <span>Ctrl+Shift+Enter 停止</span>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    aria-label="清空输入"
                    @click="input = ''"
                  >
                    <X class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    class="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                    @click="scrollToLastMessage"
                  >
                    回顾
                  </button>
                </div>
              </div>
              <!-- 主输入 -->
              <form @submit.prevent="send" class="flex flex-col">
                <textarea
                  v-model="input"
                  rows="2"
                  placeholder="说点什么？"
                  class="min-h-[72px] w-full resize-none border-0 bg-transparent px-3 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-0"
                  :disabled="streaming"
                  @keydown.enter.exact.prevent="send()"
                  @keydown.enter.shift.exact.prevent="input += '\n'"
                />
                <!-- 底栏：Agent / Auto 选择 + 右侧图标与发送 -->
                <div class="flex items-center justify-between gap-2 px-3 pb-2 pt-0">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700/50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <Infinity class="h-3.5 w-3.5" />
                      <span>Agent</span>
                      <ChevronDown class="h-3.5 w-3.5 opacity-60" />
                    </button>
                    <button
                      type="button"
                      class="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700/50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <span>自动</span>
                      <ChevronDown class="h-3.5 w-3.5 opacity-60" />
                    </button>
                  </div>
                  <div class="flex items-center gap-1">
                    <span
                      v-if="streaming"
                      class="flex h-8 w-8 items-center justify-center text-zinc-400"
                      aria-hidden
                    >
                      <Loader2 class="h-4 w-4 animate-spin" />
                    </span>
                    <button
                      type="button"
                      class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      title="联网"
                      aria-label="联网"
                    >
                      <Globe class="h-4 w-4 text-primary-500" />
                    </button>
                    <button
                      type="button"
                      class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      title="图片"
                      aria-label="上传图片"
                    >
                      <ImageIcon class="h-4 w-4" />
                    </button>
                    <button
                      v-if="streaming"
                      type="button"
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      aria-label="停止"
                      @click="stopStream"
                    >
                      <Square class="h-4 w-4" />
                    </button>
                    <button
                      v-else
                      type="submit"
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                      :disabled="!input.trim()"
                      aria-label="发送"
                    >
                      <Send class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
            <!-- 免责提示 -->
            <p class="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 text-center">
              AI 的回答未必正确无误，请注意核查
            </p>
            </div>
          </div>
        </template>
        <div v-else class="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-zinc-500 dark:text-zinc-400">
          <p class="text-sm">选择左侧会话或新建会话</p>
          <button
            type="button"
            class="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-500 transition-colors"
            @click="startNewChat"
          >
            新会话
          </button>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage } from '~/composables/useChatSessions'
import placeholderMessagesJson from '~/data/placeholder-messages.json'
import { useVirtualizer } from '@tanstack/vue-virtual'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '~/lib/dropdown-menu'
import { Archive, Bookmark, Bot, Calendar, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Cloud, Download, FileText, Globe, Home, Image as ImageIcon, Infinity, Link, Loader2, Music, Pencil, Search, Send, Settings, Share2, Square, StickyNote, Trash2, User, Users, X } from 'lucide-vue-next'

const PLACEHOLDER_MESSAGES = placeholderMessagesJson as ChatMessage[]

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
function toggleAppList() {
  showAppList.value = !showAppList.value
}
function toggleSearchBar() {
  showSearchBar.value = !showSearchBar.value
}

/** 应用抽屉列表：前 4 个为真实入口，其余为 mock 填充 */
const drawerApps = [
  { id: 'home', title: '导航', view: 'home' as const, icon: Home },
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
  if ('view' in app && app.view) {
    if (app.view === 'home') openNavPage()
    else openPanel(app.view)
  }
}

/** 应用抽屉可见高度固定，内容超出可滚动 */
const appDrawerHeightRem = 16
/** 顶栏 top：应用抽屉高度随内容，展开时顶栏整体下移 */
const toolbarTop = computed(() => {
  const rem = showAppList.value ? appDrawerHeightRem : 0
  return `${rem}rem`
})
/** 列表内容区顶部留白：顶栏下移量 + 工具栏 3rem，避免被抽屉遮挡 */
const listPaddingTop = computed(() => {
  const above = showAppList.value ? appDrawerHeightRem : 0
  return `${above + 3}rem`
})
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
} = useChatSessions()

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

const displayMessages = computed(() => {
  const list = messages.value
  if (list.length > 0) return list
  return chatId.value ? PLACEHOLDER_MESSAGES : []
})

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

/** 调试用：mock 会话列表，便于调试会话列表滚动样式。设为 false 可关闭。 */
const MOCK_SESSION_LIST_DEBUG = true
const mockSessionList: Array<{ id: string; title: string }> = Array.from({ length: 18 }, (_, i) => ({
  id: `mock-session-${i + 1}`,
  title: `调试会话 ${i + 1} 预览标题`,
}))
const displayChats = computed(() =>
  MOCK_SESSION_LIST_DEBUG ? [...mockSessionList, ...filteredChats.value] : filteredChats.value,
)
function isMockSession(id: string) {
  return id.startsWith('mock-')
}
function onSessionItemClick(id: string) {
  if (isMockSession(id)) return
  goToChat(id)
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
function getChatDateLabel(chatId: string): string {
  const c = chats.value.find((x) => x.id === chatId)
  return c?.updatedAt ? formatChatDate(c.updatedAt) : ''
}

const chatTitle = computed(() => {
  if (!chatId.value) return ''
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

function startNewChat() {
  const id = createNewChat()
  router.push(`/space/${id}`)
}

const { getWithTitle } = useContactsAndBots()
const { isPanelOpen, openPanel, openNavPage, currentView } = useAppView()
/** 展开：会话列表与聊天区左右并排（由 layout provide，应用区关闭或应用内容区折叠时为 true） */
const isSessionExpanded = inject<Ref<boolean>>('isSessionExpanded', ref(false))


onMounted(() => {
  const id = chatId.value
  if (id) {
    const c = chats.value.find((x) => x.id === id)
    if (!c) {
      const title = getWithTitle(id) ?? '会话'
      ensureChat(id, title)
    }
    return
  }
  const app = route.query.app as 'contacts' | 'bots' | undefined
  if (app === 'contacts' || app === 'bots') openPanel(app)
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
    updateLastMessage(id, (m) => {
      m.content = `请求失败：${e instanceof Error ? e.message : String(e)}`
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

/* 左侧会话列表滚动条：与聊天区一致 2px */
.session-list-scroll-area {
  scrollbar-gutter: stable;
}
.session-list-scroll-area::-webkit-scrollbar {
  width: 2px;
}
.session-list-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}
.session-list-scroll-area::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: rgb(161 161 170 / 0.4);
}
.session-list-scroll-area::-webkit-scrollbar-thumb:hover {
  background: rgb(161 161 170 / 0.6);
}
.session-list-scroll-area::-webkit-scrollbar-thumb:active {
  background: rgb(161 161 170 / 0.8);
}
@supports (scrollbar-width: thin) {
  .session-list-scroll-area {
    scrollbar-width: thin;
    scrollbar-color: rgb(161 161 170 / 0.5) transparent;
  }
}

/* 应用抽屉滚动区：滚动条隐藏 */
.app-drawer-scroll {
  scrollbar-width: none;
}
.app-drawer-scroll::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
</style>
