<template>
  <div class="absolute bottom-0 left-0 right-0 z-20 flex flex-col">
    <div
      class="h-16 pointer-events-none shrink-0 bg-gradient-to-t from-white via-white to-transparent dark:from-zinc-800 dark:via-zinc-800 dark:to-transparent"
      aria-hidden
    />
    <div class="shrink-0 p-3 pt-0 bg-white dark:bg-zinc-800">
      <div class="chat-input-card relative rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-sm overflow-visible">
        <div
          v-if="streaming"
          class="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-700"
        >
          <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <button
              type="button"
              class="font-medium text-black dark:text-white hover:text-black dark:hover:text-white"
              @click="$emit('stop')"
            >
              停止
            </button>
            <span>Ctrl+Shift+Enter 停止</span>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              aria-label="清空输入"
              @click="$emit('clear')"
            >
              <X class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-sm font-medium text-black dark:text-white bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
              @click="$emit('scroll-to-last')"
            >
              回顾
            </button>
          </div>
        </div>
        <!-- 顶部外侧悬浮把手：不占编辑框空间 -->
        <button
          type="button"
          class="chat-input-resize-handle absolute left-1/2 top-0 z-10 flex -translate-x-1/2 -translate-y-full cursor-n-resize items-center justify-center rounded-t-md rounded-b-none border border-zinc-200 dark:border-zinc-600 border-b-0 bg-white dark:bg-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-600 transition-colors py-px px-3 text-black dark:text-white hover:text-black dark:hover:text-white"
          aria-label="拖拽调整输入框高度"
          @mousedown.prevent="onResizeStart"
        >
          <GripHorizontal class="h-2 w-2" />
        </button>
        <form class="flex flex-col overflow-hidden rounded-xl" @submit.prevent="onFormSubmit">
          <!-- @ 提及候选：输入 @ 后显示在输入框上方，紧凑样式 + 极细滚动条 -->
          <div
            v-show="atMentionOpen"
            ref="mentionListRef"
            class="mention-list absolute left-3 z-30 w-44 max-h-40 overflow-y-auto overflow-x-hidden rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-md py-0.5"
            :style="{ bottom: `${editHeightPx + 52}px` }"
          >
            <button
              v-for="(item, i) in mentionCandidates"
              :key="item.id + item.kind"
              type="button"
              class="flex w-full items-center gap-1.5 px-2 py-1 text-left text-xs transition-colors"
              :class="i === mentionSelectedIndex ? 'bg-primary-50 dark:bg-primary-900/30 text-black dark:text-white' : 'text-black dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700/50'"
              @mousedown.prevent="onMentionSelect(item)"
            >
              <span
                v-if="item.kind === 'contact'"
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-600 text-black dark:text-white text-[10px] font-medium"
              >
                {{ item.name.charAt(0) }}
              </span>
              <span
                v-else
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/50 text-black dark:text-white"
              >
                <Bot class="h-2.5 w-2.5" />
              </span>
              <span class="min-w-0 flex-1 truncate font-medium">{{ item.name }}</span>
              <span class="shrink-0 text-[9px] text-zinc-400 dark:text-zinc-500">
                {{ item.kind === 'contact' ? '联系人' : '机器人' }}
              </span>
            </button>
            <p
              v-if="atMentionOpen && mentionCandidates.length === 0"
              class="px-2 py-1 text-[10px] text-zinc-500 dark:text-zinc-400"
            >
              无匹配
            </p>
          </div>
          <div
            ref="textareaWrapRef"
            class="chat-input-inner-scroll overflow-x-hidden"
            :class="modelValue.trim() ? 'overflow-y-auto' : 'overflow-y-hidden'"
            :style="{ height: `${editHeightPx}px` }"
          >
            <textarea
              ref="textareaRef"
              :value="modelValue"
              rows="2"
              placeholder="说点什么？输入 @ 可引用联系人或机器人"
              class="chat-input-textarea min-h-[72px] w-full resize-none border-0 bg-transparent pl-3 pr-1 py-3 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-0"
              :disabled="streaming"
              @input="onTextareaInput"
              @keydown="onTextareaKeydown"
            />
          </div>
          <div class="flex items-center justify-between gap-2 px-3 pb-2 pt-0">
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="input-toolbar-chip relative flex h-6 items-center gap-1 rounded-lg border border-zinc-200/80 dark:border-zinc-600/80 bg-white/90 dark:bg-zinc-700/60 px-1 py-1 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-primary-200 hover:bg-primary-50/80 hover:shadow active:scale-[0.98] dark:border-zinc-600 dark:hover:border-primary-500/40 dark:hover:bg-primary-900/20"
                title="@ 引用联系人或机器人"
                aria-label="@ 引用"
                @click="insertAtCursor('@')"
              >
                <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary-100 dark:bg-primary-900/50 text-black dark:text-white">
                  <AtSign class="h-2 w-2" />
                </span>
                <span class="text-[10px] font-medium text-black dark:text-white">引用</span>
              </button>
              <button
                type="button"
                class="input-toolbar-chip relative flex h-6 items-center gap-1 rounded-lg border border-zinc-200/80 dark:border-zinc-600/80 bg-white/90 dark:bg-zinc-700/60 px-1 py-1 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-zinc-300 hover:bg-zinc-50 hover:shadow active:scale-[0.98] dark:border-zinc-600 dark:hover:border-zinc-500 dark:hover:bg-zinc-600/80"
                title="# 引用来源"
                aria-label="# 引用来源"
                @click="insertAtCursor('#')"
              >
                <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-zinc-200/80 dark:bg-zinc-600/80 text-black dark:text-white">
                  <Hash class="h-2 w-2" />
                </span>
                <span class="text-[10px] font-medium text-black dark:text-white">来源</span>
              </button>
              <button
                type="button"
                class="input-toolbar-chip relative flex h-6 items-center gap-1 rounded-lg border border-zinc-200/80 dark:border-zinc-600/80 bg-white/90 dark:bg-zinc-700/60 px-1 py-1 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-zinc-300 hover:bg-zinc-50 hover:shadow active:scale-[0.98] dark:border-zinc-600 dark:hover:border-zinc-500 dark:hover:bg-zinc-600/80"
                title="/ 命令"
                aria-label="/ 命令"
                @click="insertAtCursor('/')"
              >
                <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-zinc-200/80 dark:bg-zinc-600/80 text-black dark:text-white">
                  <Slash class="h-2 w-2" />
                </span>
                <span class="text-[10px] font-medium text-black dark:text-white">命令</span>
              </button>
            </div>
            <div class="flex items-center gap-1">
              <span
                v-if="streaming"
                class="flex h-6 w-6 items-center justify-center text-zinc-400"
                aria-hidden
              >
                <Loader2 class="h-3.5 w-3.5 animate-spin" />
              </span>
              <button
                type="button"
                class="relative flex h-6 w-8 shrink-0 flex-col items-center justify-center gap-0 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 text-black dark:text-white hover:text-black dark:hover:text-white hover:bg-white/50 dark:hover:bg-zinc-600/40"
                title="图片"
                aria-label="上传图片"
              >
                <ImageIcon class="h-3.5 w-3.5 shrink-0" />
              </button>
              <button
                v-if="streaming"
                type="button"
                class="relative flex h-6 w-8 shrink-0 flex-col items-center justify-center gap-0 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 text-black dark:text-white hover:text-black dark:hover:text-white hover:bg-white/50 dark:hover:bg-zinc-600/40"
                aria-label="停止"
                @click="$emit('stop')"
              >
                <Square class="h-3.5 w-3.5 shrink-0" />
              </button>
              <div
                v-else
                class="send-btn-wrap shrink-0 rounded-lg p-0.5 transition-colors duration-300"
                :class="modelValue.trim() ? 'send-btn-ready' : ''"
              >
                <button
                  type="submit"
                  class="send-btn-inner group relative flex h-6 min-w-8 items-center justify-center gap-1 rounded-[calc(0.5rem-1px)] pl-1 pr-1.5 transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50"
                  :class="modelValue.trim() ? 'text-black dark:text-white bg-white dark:bg-zinc-600/80 shadow-md ring-1 ring-primary-200/50 dark:ring-primary-400/25 hover:bg-white dark:hover:bg-zinc-600/90' : 'text-black dark:text-white bg-zinc-100 dark:bg-zinc-600/60 hover:text-black dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-600'"
                  :disabled="!modelValue.trim()"
                  aria-label="发送"
                >
                  <span class="flex shrink-0 pl-0.5 transition-transform duration-200 group-hover:-rotate-90">
                    <SendHorizontal class="h-3 w-3" />
                  </span>
                  <span class="text-[10px] font-medium">发送</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
      <p class="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 text-center">
        AI 的回答未必正确无误，请注意核查
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AtSign, Bot, GripHorizontal, Hash, Image as ImageIcon, Loader2, SendHorizontal, Slash, Square, X } from 'lucide-vue-next'
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useContactsAndBots } from '~/composables/useContactsAndBots'

const props = defineProps<{
  modelValue: string
  streaming: boolean
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
  (e: 'stop'): void
  (e: 'clear'): void
  (e: 'scroll-to-last'): void
  (e: 'add-participant'): void
}>()

const { contacts, bots } = useContactsAndBots()

type MentionCandidate = { kind: 'contact' | 'bot'; id: string; name: string }
const mentionCandidatesList = computed<MentionCandidate[]>(() => {
  const list: MentionCandidate[] = [
    ...contacts.map((c) => ({ kind: 'contact' as const, id: c.id, name: c.name })),
    ...bots.map((b) => ({ kind: 'bot' as const, id: b.id, name: b.name })),
  ]
  return list
})

const MIN_EDIT_HEIGHT = 72
const MAX_EDIT_HEIGHT = 280
const DEFAULT_EDIT_HEIGHT = 72

const textareaWrapRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const mentionListRef = ref<HTMLElement | null>(null)
const editHeightPx = ref(DEFAULT_EDIT_HEIGHT)

/** 当前 @ 提及起始位置（@ 的索引），null 表示未在输入 @ 状态 */
const atMentionStart = ref<number | null>(null)
/** 当前 @ 后已输入的查询词（用于过滤候选） */
const atMentionQuery = ref('')
/** 键盘选中的候选下标 */
const mentionSelectedIndex = ref(0)

const atMentionOpen = computed(() => atMentionStart.value !== null)

const mentionCandidates = computed(() => {
  const q = atMentionQuery.value.trim().toLowerCase()
  if (!q) return mentionCandidatesList.value
  return mentionCandidatesList.value.filter((item) =>
    item.name.toLowerCase().includes(q),
  )
})

watch(mentionCandidates, (list) => {
  mentionSelectedIndex.value = Math.max(0, Math.min(mentionSelectedIndex.value, list.length - 1))
})

function parseAtMention(value: string, cursorPos: number) {
  let start: number | null = null
  for (let i = cursorPos - 1; i >= 0; i--) {
    if (value[i] === '\n') break
    if (value[i] === '@') {
      start = i
      break
    }
  }
  if (start === null) {
    atMentionStart.value = null
    atMentionQuery.value = ''
    return
  }
  const query = value.slice(start + 1, cursorPos)
  if (/\s/.test(query)) {
    atMentionStart.value = null
    atMentionQuery.value = ''
    return
  }
  atMentionStart.value = start
  atMentionQuery.value = query
  mentionSelectedIndex.value = 0
}

function insertMention(name: string) {
  const start = atMentionStart.value
  const el = textareaRef.value
  if (start === null || !el) return
  const value = props.modelValue
  const end = el.selectionStart
  const newValue = value.slice(0, start) + `@${name} ` + value.slice(end)
  emit('update:modelValue', newValue)
  atMentionStart.value = null
  atMentionQuery.value = ''
  nextTick(() => {
    const newCursor = start + name.length + 2
    el.focus()
    el.setSelectionRange(newCursor, newCursor)
    adjustTextareaHeight()
  })
}

function onMentionSelect(item: MentionCandidate) {
  insertMention(item.name)
}

/** 在光标处插入字符并聚焦输入框；插入 @ 后会触发提及候选 */
function insertAtCursor(char: string) {
  const el = textareaRef.value
  if (!el) return
  const value = props.modelValue
  const pos = el.selectionStart ?? value.length
  const newValue = value.slice(0, pos) + char + value.slice(pos)
  emit('update:modelValue', newValue)
  nextTick(() => {
    const newPos = pos + 1
    el.focus()
    el.setSelectionRange(newPos, newPos)
    if (char === '@') parseAtMention(newValue, newPos)
    adjustTextareaHeight()
  })
}

function onTextareaKeydown(e: KeyboardEvent) {
  if (!atMentionOpen.value) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      emit('submit')
      return
    }
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      emit('update:modelValue', props.modelValue + '\n')
      return
    }
    return
  }
  const list = mentionCandidates.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    mentionSelectedIndex.value = Math.min(mentionSelectedIndex.value + 1, list.length - 1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    mentionSelectedIndex.value = Math.max(mentionSelectedIndex.value - 1, 0)
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const item = list[mentionSelectedIndex.value]
    if (item) onMentionSelect(item)
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    atMentionStart.value = null
    atMentionQuery.value = ''
    return
  }
}

function onFormSubmit() {
  if (atMentionOpen.value) return
  emit('submit')
}

function adjustTextareaHeight() {
  nextTick(() => {
    const el = textareaRef.value
    if (!el) return
    el.style.overflow = 'hidden'
    el.style.height = '0'
    const h = Math.max(MIN_EDIT_HEIGHT, el.scrollHeight)
    el.style.height = `${h}px`
    el.style.overflow = 'hidden'
    // 空内容时让外层高度与 textarea 一致，避免出现滚动条
    if (!props.modelValue.trim()) {
      editHeightPx.value = h
    }
  })
}

function onTextareaInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  const value = el.value
  const cursorPos = el.selectionStart ?? value.length
  emit('update:modelValue', value)
  parseAtMention(value, cursorPos)
  adjustTextareaHeight()
}

watch(() => props.modelValue, adjustTextareaHeight)
onMounted(adjustTextareaHeight)

let resizeStartY = 0
let resizeStartHeight = 0

function onResizeStart(e: MouseEvent) {
  resizeStartY = e.clientY
  resizeStartHeight = editHeightPx.value
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeEnd)
}

function onResizeMove(e: MouseEvent) {
  const delta = resizeStartY - e.clientY
  const next = Math.min(MAX_EDIT_HEIGHT, Math.max(MIN_EDIT_HEIGHT, resizeStartHeight + delta))
  editHeightPx.value = next
}

function onResizeEnd() {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
})
</script>

<style scoped>
.mention-list {
  scrollbar-gutter: stable;
}
.mention-list::-webkit-scrollbar {
  width: 2px;
}
.mention-list::-webkit-scrollbar-track {
  background: transparent;
}
.mention-list::-webkit-scrollbar-thumb {
  border-radius: 2px;
  background: rgb(161 161 170 / 0.3);
}
.mention-list::-webkit-scrollbar-thumb:hover {
  background: rgb(161 161 170 / 0.45);
}
@supports (scrollbar-width: thin) {
  .mention-list {
    scrollbar-width: thin;
    scrollbar-color: rgb(161 161 170 / 0.4) transparent;
  }
}

.chat-input-inner-scroll {
  scrollbar-gutter: stable;
}
/* 空内容时不预留滚动条、不显示滚动条 */
.chat-input-inner-scroll.overflow-y-hidden {
  scrollbar-gutter: auto;
}
.chat-input-inner-scroll::-webkit-scrollbar {
  width: 2px;
}
.chat-input-inner-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.chat-input-inner-scroll::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: rgb(161 161 170 / 0.4);
}
.chat-input-inner-scroll::-webkit-scrollbar-thumb:hover {
  background: rgb(161 161 170 / 0.6);
}
.chat-input-inner-scroll::-webkit-scrollbar-thumb:active {
  background: rgb(161 161 170 / 0.8);
}
@supports (scrollbar-width: thin) {
  .chat-input-inner-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgb(161 161 170 / 0.5) transparent;
  }
}
/* 仅外层滚动，textarea 不出现第二条滚动条 */
.chat-input-textarea {
  overflow: hidden;
}

/* 发送按钮：等待发送时流光边框 */
.send-btn-wrap {
  position: relative;
}
.send-btn-ready {
  background: transparent;
  overflow: hidden;
}
.send-btn-ready::before {
  content: '';
  position: absolute;
  inset: -100%;
  /* 纯白缺口 #ffffff，约 60deg；高饱和科技蓝主题流光 */
  background: conic-gradient(
    from 0deg,
    #ffffff 0deg 60deg,
    #0ea5e9 60deg,
    #3b82f6,
    #2563eb,
    #6366f1,
    #06b6d4,
    #0284c7,
    #0ea5e9
  );
  filter: blur(2px);
  animation: send-btn-flow 2.5s linear infinite;
}
.send-btn-ready .send-btn-inner {
  position: relative;
  z-index: 1;
}
@keyframes send-btn-flow {
  to {
    transform: rotate(360deg);
  }
}
</style>
