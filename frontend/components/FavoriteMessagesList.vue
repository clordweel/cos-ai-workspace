<template>
  <div class="favorite-messages-list">
    <div v-if="loading" class="flex items-center justify-center py-8 text-zinc-500 dark:text-zinc-400 text-sm">
      加载中…
    </div>
    <div v-else-if="error" class="py-4 text-sm text-red-600 dark:text-red-400">
      {{ error }}
    </div>
    <div v-else-if="!entries.length" class="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
      暂无收藏消息
    </div>
    <ul v-else class="space-y-3">
      <li
        v-for="entry in entries"
        :key="`${entry.roomId}-${entry.eventId}`"
        class="rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800/80 shadow-sm overflow-hidden"
      >
        <!-- 首行：会话标题 + 时间，同一行紧凑展示 -->
        <div class="flex items-center justify-between gap-3 px-3 pt-2.5 pb-1.5 min-w-0">
          <p class="font-medium text-zinc-800 dark:text-zinc-200 truncate text-sm">
            {{ roomTitle(entry.roomId) }}
          </p>
          <time
            class="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums"
            :datetime="new Date(entry.createdAt).toISOString()"
          >
            {{ formatTime(entry.createdAt) }}
          </time>
        </div>
        <!-- 消息摘要：独立内容块，视觉上与元信息区分 -->
        <div
          v-if="entry.snippet"
          class="px-3 pb-2 min-w-0 border-l-2 border-zinc-200 dark:border-zinc-600 ml-3 pl-2.5 py-0.5"
        >
          <p class="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 break-words">
            {{ entry.snippet }}
          </p>
        </div>
        <div v-else class="px-3 pb-1" />
        <!-- 操作区：固定底行，与内容分离 -->
        <div class="flex items-center justify-end gap-1.5 px-3 py-2 border-t border-zinc-100 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-800/50">
          <Button
            variant="ghost"
            size="sm"
            class="h-7 text-[11px] text-zinc-600 dark:text-zinc-300 hover:text-primary"
            @click="goToRoom(entry.roomId)"
          >
            在会话中查看
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 text-[11px] text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
            @click="removeFavorite(entry)"
          >
            取消收藏
          </Button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { Button } from '~/components/ui/button'

export interface FavoriteMessageEntry {
  roomId: string
  eventId: string
  createdAt: number
  snippet?: string
}

const props = withDefaults(
  defineProps<{
    /** 用于解析 roomId → 会话标题 */
    chats?: Array<{ id: string; title?: string }>
  }>(),
  { chats: () => [] }
)

const loading = ref(false)
const error = ref<string | null>(null)
const entries = ref<FavoriteMessageEntry[]>([])

function roomTitle(roomId: string): string {
  const list = props.chats ?? []
  const chat = list.find((c) => c.id === roomId)
  return chat?.title ?? roomId
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const M = String(d.getMonth() + 1).padStart(2, '0')
  const D = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${M}/${D} ${h}:${m}`
}

function goToRoom(roomId: string) {
  navigateTo(`/space/${encodeURIComponent(roomId)}`)
}

async function removeFavorite(entry: FavoriteMessageEntry) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  if (!base) return
  try {
    const res = await fetch(`${base}/api/sessions/favorite-messages`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: entry.roomId, eventId: entry.eventId }),
    })
    if (res.ok) {
      entries.value = entries.value.filter(
        (e) => !(e.roomId === entry.roomId && e.eventId === entry.eventId)
      )
    }
  } catch {
    // ignore
  }
}

async function fetchEntries() {
  loading.value = true
  error.value = null
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const res = await fetch(`${base}/api/sessions/favorite-messages`, { credentials: 'include' })
    if (res.status === 501) {
      error.value = '当前后端不支持消息收藏'
      entries.value = []
      return
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      error.value = body.message || body.error || '加载失败'
      entries.value = []
      return
    }
    const json = (await res.json()) as { entries?: FavoriteMessageEntry[] }
    entries.value = json.entries ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
    entries.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchEntries()
})
</script>
