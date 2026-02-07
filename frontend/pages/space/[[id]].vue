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
              class="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors"
              :class="[
                c.id === chatId && isSessionExpanded ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 active:bg-zinc-100 dark:active:bg-zinc-700',
              ]"
              @click="goToChat(c.id)"
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
        class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden"
        :class="{ 'border-t border-zinc-200 dark:border-zinc-700': !isSessionExpanded }"
        v-show="isSessionExpanded || !!chatId"
      >
        <template v-if="chatId">
          <div class="shrink-0 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2">
            <NuxtLink
              v-if="!isSessionExpanded"
              to="/space"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
              aria-label="返回会话列表"
            >
              <ChevronLeft class="h-4 w-4" />
            </NuxtLink>
            <span class="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate min-w-0">{{ chatTitle }}</span>
          </div>
          <div ref="scrollRef" class="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3">
            <div
              v-for="(msg, i) in messages"
              :key="i"
              class="flex"
              :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <ChatMessageBubble
                :message="msg"
                :streaming="msg.role === 'assistant' && i === messages.length - 1 && streaming"
              />
            </div>
          </div>
          <!-- 会话输入区：参考图示布局 -->
          <div class="shrink-0 border-t border-zinc-200 dark:border-zinc-700 p-3">
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
import { ChevronLeft, ChevronDown, Globe, Image, Infinity, Loader2, Search, Send, Square, X } from 'lucide-vue-next'

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

const messages = computed(() => (chatId.value ? getMessages(chatId.value) : []))

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
  if (list.length === 0) return '暂无消息'
  const last = list[list.length - 1]
  const text = last.content.trim()
  return text ? (text.length > 20 ? `${text.slice(0, 20)}…` : text) : '暂无消息'
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
    const el = scrollRef.value
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
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
</style>
