<template>
  <div class="flex-1 flex min-h-0 gap-4 p-4">
    <!-- 左：会话列表（仿 IM 首页） -->
    <aside class="flex flex-col w-full max-w-md shrink-0 min-h-0 overflow-hidden rounded-xl border border-zinc-200 bg-white/80 shadow-sm">
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
        <!-- 快捷入口：联系人、机器人（切换右侧应用视图） -->
        <div class="p-2 space-y-0.5 border-b border-zinc-100">
          <button
            type="button"
            class="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-zinc-700 hover:bg-zinc-50 transition-colors"
            @click="setAppView('contacts')"
          >
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 text-lg">👤</span>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-zinc-800">联系人</p>
              <p class="text-xs text-zinc-500">与同事发起对话</p>
            </div>
            <span class="text-zinc-400">›</span>
          </button>
          <button
            type="button"
            class="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-zinc-700 hover:bg-zinc-50 transition-colors"
            @click="setAppView('bots')"
          >
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-lg">◇</span>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-zinc-800">机器人</p>
              <p class="text-xs text-zinc-500">AI 助手与专用机器人</p>
            </div>
            <span class="text-zinc-400">›</span>
          </button>
        </div>
        <!-- 会话列表 -->
        <ul class="divide-y divide-zinc-100">
          <li
            v-for="c in chats"
            :key="c.id"
            class="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
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
    <!-- 右：应用区 -->
    <section class="flex-1 min-w-0 flex flex-col min-h-0">
      <div class="flex-1 min-h-0">
        <AppPanel />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const { chats, getMessages, ensureChat, createNewChat } = useChatSessions()
const { setView: setAppView } = useAppView()

function lastPreview(chatId: string): string {
  const list = getMessages(chatId)
  if (list.length === 0) return '暂无消息'
  const last = list[list.length - 1]
  const text = last.content.trim()
  return text ? (text.length > 20 ? `${text.slice(0, 20)}…` : text) : '暂无消息'
}

function goToChat(id: string) {
  router.push(`/chat/${id}`)
}

function startNewChat() {
  const id = createNewChat()
  router.push(`/chat/${id}`)
}

// 支持从 /list 跳转过来时带 ?with=contact-xx，先确保有该会话再跳转
const route = useRoute()
const { getWithTitle } = useContactsAndBots()

onMounted(() => {
  const withId = route.query.with as string | undefined
  if (withId) {
    const title = getWithTitle(withId)
    if (title) {
      ensureChat(withId, title)
      router.replace({ path: '/chat/' + withId, query: {} })
    }
    return
  }
  const app = route.query.app as 'contacts' | 'bots' | undefined
  if (app === 'contacts' || app === 'bots') setAppView(app)
})

watch(() => route.query.with, (withId) => {
  if (!withId || typeof withId !== 'string') return
  const title = getWithTitle(withId)
  if (!title) return
  ensureChat(withId, title)
  router.replace({ path: '/chat/' + withId, query: {} })
})
watch(() => route.query.app, (app) => {
  if (app === 'contacts' || app === 'bots') setAppView(app)
})
</script>
