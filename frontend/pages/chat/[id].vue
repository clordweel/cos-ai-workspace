<template>
  <div class="flex-1 flex min-h-0 gap-4 p-4">
    <!-- 左：单聊区（IM 式，顶部导航条 + 消息 + 输入） -->
    <aside class="flex flex-col w-full max-w-md shrink-0 min-h-0 overflow-hidden rounded-xl border border-zinc-200 bg-white/80 shadow-sm">
      <!-- 顶部导航条：返回 + 标题（仿 IM 顶栏） -->
      <div class="shrink-0 flex items-center gap-2 border-b border-zinc-200 px-3 py-2.5">
        <NuxtLink
          to="/"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          aria-label="返回会话列表"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </NuxtLink>
        <span class="flex-1 text-sm font-medium text-zinc-800 truncate">{{ chatTitle }}</span>
      </div>
      <!-- 消息区 -->
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
      <!-- 输入区 -->
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
    </aside>
    <!-- 右：应用区 -->
    <section class="flex-1 min-w-0 flex flex-col min-h-0">
      <div class="flex-1 min-h-0">
        <AppPanel />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const chatId = computed(() => route.params.id as string)

const scrollRef = ref<HTMLElement | null>(null)
const input = ref('')
const streaming = ref(false)

const {
  chats,
  getMessages,
  appendMessage,
  updateLastMessage,
  ensureChat,
  getConversationId,
  setConversationId,
} = useChatSessions()

const messages = computed(() => getMessages(chatId.value))

const chatTitle = computed(() => {
  const c = chats.value.find((x) => x.id === chatId.value)
  return c?.title ?? '会话'
})

onMounted(() => {
  const id = chatId.value
  if (!id) {
    router.replace('/')
    return
  }
  const c = chats.value.find((x) => x.id === id)
  if (!c) {
    const title = getWithTitle(id) ?? '会话'
    ensureChat(id, title)
  }
})

const { getWithTitle } = useContactsAndBots()

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
  const msgIndex = getMessages(id).length - 1
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
