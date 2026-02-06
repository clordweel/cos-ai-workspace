<template>
  <!-- 会话区：单一 DOM 结构，用 v-show + class 切换布局，避免展开时整树卸载/挂载导致卡顿 -->
  <div class="h-full flex flex-col min-h-0 overflow-hidden rounded-xl border border-zinc-200 bg-white/80 shadow-sm">
    <div class="h-full flex min-h-0" :class="isPanelOpen ? 'flex-col' : 'flex-row'">
      <!-- 列表：单栏时仅无 chat 显示，两栏时始终显示 -->
      <aside
        v-show="!isPanelOpen || !chatId"
        class="flex flex-col min-h-0 shrink-0 border-zinc-200"
        :class="isPanelOpen ? 'flex-1 min-w-0 overflow-hidden border-b' : 'w-64 border-r'"
      >
        <div class="shrink-0 flex items-center justify-between border-b border-zinc-200 px-3 py-3">
          <h2 class="text-sm font-medium text-zinc-600">会话</h2>
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
            @click="startNewChat"
          >
            新会话
          </button>
        </div>
        <div class="flex-1 overflow-y-auto overscroll-contain">
          <ul class="divide-y divide-zinc-100">
            <li
              v-for="c in chats"
              :key="c.id"
              class="flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors"
              :class="[
                c.id === chatId && !isPanelOpen ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-zinc-50 active:bg-zinc-100',
              ]"
              @click="goToChat(c.id)"
            >
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-600 text-sm font-medium">
                {{ c.title.charAt(0) }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="font-medium text-zinc-800 truncate">{{ c.title }}</p>
                <p class="text-xs text-zinc-500 truncate">{{ lastPreview(c.id) }}</p>
              </div>
              <span class="text-zinc-400">›</span>
            </li>
          </ul>
        </div>
      </aside>
      <!-- 右侧/下方：聊天或占位，单栏时仅 chat 时显示 -->
      <main
        class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden"
        :class="{ 'border-t border-zinc-200': isPanelOpen }"
        v-show="isPanelOpen ? !!chatId : true"
      >
        <template v-if="chatId">
          <div class="shrink-0 flex items-center gap-2 border-b border-zinc-200 px-3 py-2.5">
            <NuxtLink
              v-if="isPanelOpen"
              to="/space"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
              aria-label="返回会话列表"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </NuxtLink>
            <span class="flex-1 text-sm font-medium text-zinc-800 truncate">{{ chatTitle }}</span>
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
          <div class="shrink-0 border-t border-zinc-200 p-3">
            <form @submit.prevent="send" class="flex gap-2">
              <input
                v-model="input"
                type="text"
                placeholder="输入消息…"
                class="flex-1 rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
                :disabled="streaming"
              />
              <button
                type="submit"
                class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 shrink-0"
                :disabled="streaming || !input.trim()"
              >
                发送
              </button>
            </form>
          </div>
        </template>
        <div v-else class="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-zinc-500">
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
definePageMeta({ layout: 'workspace' })

const route = useRoute()
const router = useRouter()
const chatId = computed(() => (route.params.id as string) || undefined)

const scrollRef = ref<HTMLElement | null>(null)
const input = ref('')
const streaming = ref(false)

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
