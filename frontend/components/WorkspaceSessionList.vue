<template>
  <aside class="session-shell flex flex-col w-full max-w-md shrink-0 min-h-0 overflow-hidden rounded-xl border border-zinc-200 bg-white/80 shadow-sm ml-4">
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
          :class="currentId === c.id ? 'bg-emerald-50/80' : 'hover:bg-zinc-50 active:bg-zinc-100'"
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
</template>

<script setup lang="ts">
const router = useRouter()
const route = useRoute()
const { chats, getMessages, createNewChat } = useChatSessions()

const currentId = computed(() => (route.params.id as string) ?? '')

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
</script>

<style scoped>
.session-shell {
  position: relative;
  z-index: 0;
}

.session-shell::before {
  content: "";
  position: absolute;
  inset: -8px;
  z-index: -1;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.55), rgba(59, 130, 246, 0.5), rgba(168, 85, 247, 0.45));
  filter: blur(12px);
  opacity: 0.9;
}

.session-shell::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
}
</style>
