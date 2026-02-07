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
        <SessionListHeader
          @new-chat="startNewChat"
          @search="onSessionSearch"
        />
        <!-- 搜索栏：类似微信下拉，点击搜索后展开 -->
        <Transition name="search-slide">
          <div
            v-show="showSearchBar"
            class="shrink-0 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-2 py-2"
          >
            <div class="flex items-center gap-2 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 px-2.5 py-1.5">
              <Search class="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                placeholder="搜索会话"
                class="min-w-0 flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
              />
              <button
                v-if="searchQuery"
                type="button"
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                aria-label="清空"
                @click="searchQuery = ''"
              >
                <X class="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                class="shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                @click="closeSearch"
              >
                取消
              </button>
            </div>
          </div>
        </Transition>
        <div class="flex-1 overflow-y-auto overscroll-contain min-h-0">
          <template v-if="filteredChats.length > 0">
            <ul class="divide-y divide-zinc-100 dark:divide-zinc-700">
              <li
                v-for="c in filteredChats"
                :key="c.id"
                role="button"
                tabindex="0"
                class="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-2 rounded-md"
                :class="[
                  c.id === chatId && isSessionExpanded ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 active:bg-zinc-100 dark:active:bg-zinc-700',
                ]"
                @click="goToChat(c.id)"
                @keydown.enter.prevent="goToChat(c.id)"
              >
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300 text-xs font-medium">
                {{ c.title.charAt(0) }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{{ c.title }}</p>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 truncate leading-tight">{{ lastPreview(c.id) }}</p>
              </div>
              <span class="text-zinc-400 dark:text-zinc-500 text-xs">›</span>
            </li>
          </ul>
          </template>
          <div
            v-else-if="searchQuery"
            class="flex flex-col items-center justify-center py-12 px-4 text-center"
          >
            <Search class="h-10 w-10 text-zinc-300 dark:text-zinc-500 mb-2" />
            <p class="text-sm text-zinc-500 dark:text-zinc-400">无匹配会话</p>
            <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">试试其它关键词</p>
          </div>
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
            class="absolute top-0 left-0 right-0 z-20 flex h-12 shrink-0 items-center gap-2 px-3 py-2 border-b border-zinc-200/60 dark:border-zinc-700/60 backdrop-blur-md bg-white/75 dark:bg-zinc-800/75"
            aria-label="会话标题"
          >
            <NuxtLink
              v-if="!isSessionExpanded"
              to="/space"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
              aria-label="返回会话列表"
            >
              <ChevronLeft class="h-4 w-4" />
            </NuxtLink>
            <span class="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate min-w-0">{{ chatTitle }}</span>
            <DropdownMenuRoot>
              <DropdownMenuTrigger
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-2"
                aria-label="更多操作"
              >
                <MoreVertical class="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuPortal to="body">
                <DropdownMenuContent
                  class="z-[100] min-w-[200px] rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-1 shadow-lg"
                  :side-offset="6"
                  align="end"
                >
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger
                      class="flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 outline-none data-[highlighted]:bg-zinc-100 dark:data-[highlighted]:bg-zinc-700 data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-zinc-700"
                      text-value="导出聊天"
                    >
                      <Download class="h-3.5 w-3.5 shrink-0 opacity-70" />
                      导出聊天
                      <ChevronRight class="ml-auto h-3.5 w-3.5 opacity-60" />
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal to="body">
                      <DropdownMenuSubContent
                        class="z-[100] min-w-[180px] rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-1 shadow-lg"
                        :side-offset="4"
                      >
                        <DropdownMenuItem
                          class="flex cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          text-value="当前屏"
                          @select="onExportCurrentScreen"
                        >
                          当前屏
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          class="flex cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          text-value="长屏截图"
                          @select="onExportLongScreenshot"
                        >
                          长屏截图
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          class="flex cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          text-value="导出 markdown"
                          @select="onExportMarkdown"
                        >
                          导出 Markdown
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuItem
                    class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    text-value="分享"
                    @select="onShareConversation"
                  >
                    <Share2 class="h-3.5 w-3.5 shrink-0 opacity-70" />
                    分享
                  </DropdownMenuItem>
                  <DropdownMenuSeparator class="my-1 h-px bg-zinc-200 dark:bg-zinc-600" />
                  <DropdownMenuItem
                    class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    text-value="重命名会话"
                    @select="onRenameChat"
                  >
                    <Pencil class="h-3.5 w-3.5 shrink-0 opacity-70" />
                    重命名会话
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-red-600 dark:text-red-400 outline-none hover:bg-red-50 dark:hover:bg-red-900/20"
                    text-value="删除会话"
                    @select="onDeleteChat"
                  >
                    <Trash2 class="h-3.5 w-3.5 shrink-0 opacity-80" />
                    删除会话
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenuRoot>
          </header>
          <!-- 滚动区：虚拟列表 + 可定制滚动条，支持千条以上消息 -->
          <div
            ref="scrollRef"
            class="chat-scroll-area absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain p-3 pt-12 pb-40"
          >
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
                  <span>Ctrl+Shift+</span>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    aria-label="清空"
                    @click="input = ''"
                  >
                    <X class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    class="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
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
                  placeholder="添加追问"
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
                      <Globe class="h-4 w-4 text-blue-500" />
                    </button>
                    <button
                      type="button"
                      class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      title="图片"
                      aria-label="上传图片"
                    >
                      <Image class="h-4 w-4" />
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
            class="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
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
import { useVirtualizer } from '@tanstack/vue-virtual'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from 'radix-vue'
import { ChevronLeft, ChevronDown, ChevronRight, Download, Globe, Image, Infinity, Loader2, MoreVertical, Pencil, Search, Send, Share2, Square, Trash2, X } from 'lucide-vue-next'

definePageMeta({ layout: 'workspace' })

const route = useRoute()
const router = useRouter()
const chatId = computed(() => (route.params.id as string) || undefined)

const scrollRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const input = ref('')
const streaming = ref(false)
const showSearchBar = ref(false)
const searchQuery = ref('')

const {
  chats,
  getMessages,
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
function onExportMarkdown() {
  // TODO: 导出为 Markdown
}
function onShareConversation() {
  // TODO: 分享会话
}
function onRenameChat() {
  // TODO: 重命名会话
}
function onDeleteChat() {
  // TODO: 删除会话
}

const messages = computed(() => (chatId.value ? getMessages(chatId.value) : []))

/** 占位消息气泡，用于无消息时会话区的样式调试 */
const PLACEHOLDER_MESSAGES: { role: 'user' | 'assistant'; content: string; thinking?: string }[] = [
  { role: 'user', content: '这是一条用户消息占位，用于调试气泡样式与布局。' },
  {
    role: 'assistant',
    content: '这是一条助手回复占位。可在此调试助手气泡的圆角、边距与思考块展示。',
    thinking: '思考过程占位：用于调试可折叠思考块的样式。展开后可见多行内容，便于检查滚动与折叠区域。',
  },
  { role: 'user', content: '再发一条，方便测滚动。' },
  {
    role: 'assistant',
    content: '第二条助手回复。多几条气泡后，消息列表会变长，可以调试滚动条、触底与 overscroll 行为。',
    thinking: '思考过程示例：\n1. 解析用户意图\n2. 检索上下文\n3. 组织回复\n4. 流式输出',
  },
  { role: 'user', content: '第三条用户消息，拉长列表。' },
  {
    role: 'assistant',
    content: '第三条助手回复。若仍不够长，可继续在 PLACEHOLDER_MESSAGES 里追加。',
    thinking: '长思考块占位，用于调试思考区域展开时的滚动与布局。可折叠块应不影响整体滚动体验。',
  },
  { role: 'user', content: '第四条。' },
  {
    role: 'assistant',
    content: '第四条助手消息，用于撑满视口并测试滚动。',
  },
]
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

const chatTitle = computed(() => {
  if (!chatId.value) return ''
  const c = chats.value.find((x) => x.id === chatId.value)
  return c?.title ?? '会话'
})

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
const { isPanelOpen, openPanel } = useAppView()
/** 展开：会话列表与聊天区左右并排（由 layout provide，应用区关闭或应用内容区折叠时为 true） */
const isSessionExpanded = inject<Ref<boolean>>('isSessionExpanded', ref(false))

function onSessionSearch() {
  showSearchBar.value = true
  nextTick(() => searchInputRef.value?.focus())
}

function closeSearch() {
  showSearchBar.value = false
  searchQuery.value = ''
}

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

const { streamChat } = useChatStream()

function stopStream() {
  // TODO: 与 useChatStream 的 AbortController 联动
  streaming.value = false
}

async function send() {
  const id = chatId.value
  const text = input.value.trim()
  if (!id || !text || streaming.value) return
  input.value = ''
  appendMessage(id, { role: 'user', content: text })
  appendMessage(id, { role: 'assistant', content: '', thinking: '' })
  streaming.value = true
  const placeholder = '思考中…'
  updateLastMessage(id, (m) => { m.content = placeholder })
  try {
    await streamChat(
      text,
      (delta) => {
        updateLastMessage(id, (m) => {
          if (m.content === placeholder) m.content = delta
          else m.content += delta
        })
      },
      {
        conversationId: getConversationId(id),
        onThinking: () => {
          updateLastMessage(id, (m) => { m.content = placeholder })
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
    const list = getMessages(id)
    const last = list[list.length - 1]
    if (last && !last.content) {
      updateLastMessage(id, (m) => { m.content = '（未收到任何内容，请检查中间层与 CORS 配置）' })
    }
  } catch (e) {
    updateLastMessage(id, (m) => {
      m.content = `请求失败：${e instanceof Error ? e.message : String(e)}`
    })
  } finally {
    streaming.value = false
  }
  nextTick(() => {
    const n = displayMessages.value.length
    if (n > 0) {
      rowVirtualizerRef.value.scrollToIndex(n - 1, { align: 'end', behavior: 'smooth' })
    }
  })
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

/* 可定制滚动条：细条、圆角、悬停显色，千条消息下仍流畅 */
.chat-scroll-area {
  scrollbar-gutter: stable;
}
.chat-scroll-area::-webkit-scrollbar {
  width: 8px;
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
</style>
