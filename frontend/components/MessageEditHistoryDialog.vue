<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent
      class="w-[calc(100%-2rem)] max-w-md rounded-xl border-zinc-200 p-0 gap-0 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
      :show-close-button="true"
    >
      <DialogHeader class="border-b border-zinc-200 dark:border-zinc-600 px-5 py-4 pr-10">
        <DialogTitle class="text-base font-semibold text-zinc-800 dark:text-zinc-200">
          编辑历史
        </DialogTitle>
        <DialogDescription class="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          该消息的历次编辑内容，按时间从早到晚排列
        </DialogDescription>
      </DialogHeader>
      <div class="px-5 py-4 max-h-[60vh] overflow-y-auto">
        <div v-if="loading" class="flex items-center justify-center py-8 text-zinc-500 dark:text-zinc-400 text-sm">
          加载中…
        </div>
        <div v-else-if="error" class="py-4 text-sm text-red-600 dark:text-red-400">
          {{ error }}
        </div>
        <div v-else-if="!entries.length" class="py-4 text-sm text-zinc-500 dark:text-zinc-400">
          暂无编辑记录
        </div>
        <ul v-else class="space-y-3">
          <li
            v-for="(entry, i) in entries"
            :key="entry.eventId"
            class="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-800/60 px-3 py-2.5 text-xs"
          >
            <div class="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 mb-1.5">
              <span>{{ formatTime(entry.createdAt) }}</span>
              <span v-if="i === 0" class="rounded px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300">原文</span>
            </div>
            <div
              v-if="entry.formattedBody"
              class="chat-message-markdown break-words text-zinc-800 dark:text-zinc-200 prose prose-sm dark:prose-invert max-w-none"
              v-html="sanitizedHtml(entry.formattedBody)"
            />
            <p v-else class="whitespace-pre-wrap break-words text-zinc-800 dark:text-zinc-200">
              {{ entry.body }}
            </p>
          </li>
        </ul>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

export interface EditHistoryEntry {
  eventId: string
  createdAt: number
  body: string
  formattedBody?: string
  sender?: string
}

const props = defineProps<{
  open: boolean
  sessionId: string | undefined
  messageId: string | undefined
}>()

const emit = defineEmits<{
  close: []
}>()

const loading = ref(false)
const error = ref<string | null>(null)
const entries = ref<EditHistoryEntry[]>([])

function onOpenChange(open: boolean) {
  if (!open) emit('close')
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 简单净化：仅允许安全标签，避免 XSS */
function sanitizedHtml(html: string): string {
  if (typeof window === 'undefined') return html
  const div = document.createElement('div')
  div.innerHTML = html
  const allowed = ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a']
  const walk = (node: Node): void => {
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    if (!allowed.includes(el.tagName.toLowerCase())) {
      el.replaceWith(...el.childNodes)
      return
    }
    if (el.tagName.toLowerCase() === 'a') {
      const href = el.getAttribute('href')
      if (href && !href.startsWith('http://') && !href.startsWith('https://')) el.removeAttribute('href')
    }
    Array.from(el.childNodes).forEach(walk)
  }
  walk(div)
  return div.innerHTML
}

watch(
  () => [props.open, props.sessionId, props.messageId] as const,
  async ([open, sessionId, messageId]) => {
    if (!open || !sessionId || !messageId) {
      entries.value = []
      error.value = null
      return
    }
    loading.value = true
    error.value = null
    entries.value = []
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : ''
      const res = await fetch(
        `${base}/api/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}/edit-history`,
        { credentials: 'include' }
      )
      if (res.status === 401) {
        error.value = '请先登录'
        return
      }
      if (res.status === 501) {
        error.value = '当前后端不支持查看编辑历史'
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
        error.value = body.message || body.error || '加载失败'
        return
      }
      const json = (await res.json()) as { entries?: EditHistoryEntry[] }
      entries.value = json.entries ?? []
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载失败'
    } finally {
      loading.value = false
    }
  },
  { immediate: true }
)
</script>
