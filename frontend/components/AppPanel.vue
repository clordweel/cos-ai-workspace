<template>
  <div class="h-full flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
    <!-- 单卡：当前应用 -->
    <div class="shrink-0 flex items-center gap-2 border-b border-zinc-200 px-4 py-3 bg-white/80">
      <button
        v-if="canGoBack"
        type="button"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        aria-label="返回上一应用"
        @click="goBack"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h2 class="flex-1 text-sm font-medium text-zinc-500 tracking-wide truncate min-w-0">
        {{ cardTitle(currentView) }}
      </h2>
      <button
        type="button"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        aria-label="关闭应用面板"
        @click="closePanel"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-4 min-h-0">
          <template v-if="currentView === 'home'">
            <div class="grid gap-3 sm:grid-cols-2">
              <div
                v-for="app in placeholderApps"
                :key="app.id"
                class="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors cursor-pointer"
                @click="app.action"
              >
                <div class="flex items-center gap-3">
                  <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 text-lg" v-html="app.icon" />
                  <div class="min-w-0">
                    <p class="font-medium text-zinc-800 truncate">{{ app.title }}</p>
                    <p class="text-xs text-zinc-500 truncate">{{ app.desc }}</p>
                  </div>
                </div>
              </div>
            </div>
            <p class="mt-6 text-xs text-zinc-500 text-center">
              更多扩展应用将在此展示，支持物料、订单、BOM 等操作
            </p>
          </template>
          <template v-else-if="currentView === 'contacts'">
            <ul class="divide-y divide-zinc-100">
              <li
                v-for="c in contacts"
                :key="c.id"
                class="flex items-center gap-3 px-0 py-3 cursor-pointer hover:bg-zinc-50 rounded-lg transition-colors -mx-1 px-1"
                @click="openChat('contact', c.id, c.name)"
              >
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-600 text-sm font-medium">
                  {{ c.name.charAt(0) }}
                </span>
                <span class="font-medium text-zinc-800">{{ c.name }}</span>
              </li>
            </ul>
          </template>
          <template v-else-if="currentView === 'bots'">
            <ul class="divide-y divide-zinc-100">
              <li
                v-for="b in bots"
                :key="b.id"
                class="flex items-center gap-3 px-0 py-3 cursor-pointer hover:bg-zinc-50 rounded-lg transition-colors -mx-1 px-1"
                @click="openChat('bot', b.id, b.name)"
              >
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-sm">◇</span>
                <div class="min-w-0 flex-1">
                  <p class="font-medium text-zinc-800">{{ b.name }}</p>
                  <p v-if="b.description" class="text-xs text-zinc-500 truncate">{{ b.description }}</p>
                </div>
              </li>
            </ul>
          </template>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const { currentView, canGoBack, goBack, closePanel } = useAppView()
const { contacts, bots } = useContactsAndBots()
const { ensureChat } = useChatSessions()

function cardTitle(view: 'home' | 'contacts' | 'bots'): string {
  return view === 'contacts' ? '联系人' : view === 'bots' ? '机器人' : '应用'
}

function openChat(type: 'contact' | 'bot', id: string, name: string) {
  const chatId = type === 'contact' ? `contact-${id}` : `bot-${id}`
  ensureChat(chatId, name)
  router.push(`/space/${chatId}`)
}

const placeholderApps = [
  { id: 'material', title: '物料助手', desc: '参数化创建球磨机零件', icon: '◇', action: () => {} },
  { id: 'order', title: '订单进度', desc: '查询生产与交货状态', icon: '○', action: () => {} },
  { id: 'bom', title: 'BOM 状态', desc: '查看物料清单与齐套', icon: '▣', action: () => {} },
  { id: 'inventory', title: '库存概览', desc: '球磨机零件库存', icon: '▤', action: () => {} },
]
</script>
