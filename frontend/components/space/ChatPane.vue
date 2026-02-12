<template>
  <div class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
    <ChatHeader
      :title="chatTitle"
      :user-name="chatUserName"
      :user-avatar="chatUserAvatar"
      :is-session-expanded="isSessionExpanded"
      @close="emit('close')"
      @rename="emit('rename')"
      @share="emit('share')"
      @copy-link="emit('copy-link')"
      @export-screen="emit('export-screen')"
      @export-screenshot="emit('export-screenshot')"
      @export-markdown="emit('export-markdown')"
      @archive="emit('archive')"
      @delete="emit('delete')"
    />
    <!-- 用 margin-bottom 抬高滚动区底部；默认 8.75rem，随输入框高度上报更新变量。滚动容器外置，顶部固定「回到底部」按钮。 -->
    <div
      class="chat-messages-wrap flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col relative"
      :style="{
        '--chat-text-scale': sessionAreaFontScale,
        '--chat-input-area-height': chatInputAreaHeightPx != null ? `${chatInputAreaHeightPx}px` : '8.75rem',
        marginBottom: 'var(--chat-input-area-height)'
      }"
    >
      <!-- 顶部边距至少超过顶栏 + 回到底部按钮高度，避免首条消息被遮挡 -->
      <div
        ref="chatScrollRef"
        class="chat-messages-scroll flex-1 min-h-0 overflow-y-auto pt-24 pb-3"
        @scroll="onChatScroll"
      >
        <UChatMessages
          :messages="uiMessages"
          :status="chatStatus"
          should-scroll-to-bottom
          should-auto-scroll
          :auto-scroll="false"
          class="flex flex-col gap-0.5 min-h-full"
        >
          <template #content="{ message }">
            <slot name="content" :message="message" />
          </template>
        </UChatMessages>
      </div>
      <Transition name="fade">
        <button
          v-if="showScrollToBottom"
          type="button"
          class="scroll-to-bottom-btn absolute left-1/2 top-14 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-md hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors pointer-events-auto"
          aria-label="回到底部"
          @click="scrollToBottom"
        >
          <ArrowDown class="h-4 w-4" aria-hidden />
        </button>
      </Transition>
    </div>
    <ChatInputPanel
      :model-value="input"
      :streaming="streaming"
      :reply-target="replyTarget"
      @update:model-value="emit('update:input', $event)"
      @submit="emit('submit')"
      @stop="emit('stop')"
      @clear="emit('clear')"
      @scroll-to-last="emit('scroll-to-last')"
      @add-participant="emit('add-participant')"
      @cancel-reply="emit('cancel-reply')"
      @input-area-height="chatInputAreaHeightPx = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ArrowDown } from 'lucide-vue-next'
import type { UiMessage } from '~/composables/useSpaceChatPane'
import ChatHeader from '~/components/ChatHeader.vue'
import ChatInputPanel from '~/components/ChatInputPanel.vue'

/** 输入区实际高度（px），由 ChatInputPanel ResizeObserver 上报；未上报前用 CSS 默认 8.75rem */
const chatInputAreaHeightPx = ref<number | null>(null)

const chatScrollRef = ref<HTMLElement | null>(null)
const showScrollToBottom = ref(false)
/** 距底部超过该像素即显示「回到底部」按钮 */
const SCROLL_THRESHOLD = 50

/** 与 Nuxt UI ChatMessages 一致：取最近的可滚动祖先 */
function getScrollParent(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null
  const overflowRegex = /auto|scroll/
  let current: HTMLElement | null = node
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current)
    if (overflowRegex.test(style.overflowY)) return current
    current = current.parentElement
  }
  return null
}

/** 实际发生滚动的元素（与 UChatMessages 内部 getScrollParent 结果一致） */
const scrollParentRef = ref<HTMLElement | null>(null)
/** 滚动监听与 ResizeObserver 的清理函数，由 onMounted 内 nextTick 后写入；onUnmounted 时调用 */
const scrollCleanupRef = ref<(() => void) | null>(null)

onUnmounted(() => {
  scrollCleanupRef.value?.()
})

function checkScrollPosition() {
  const el = scrollParentRef.value ?? chatScrollRef.value
  if (!el) return
  const scrollTop = Math.round(el.scrollTop)
  const clientHeight = el.clientHeight
  const scrollHeight = el.scrollHeight
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight
  showScrollToBottom.value = distanceFromBottom > SCROLL_THRESHOLD
}

function onChatScroll() {
  checkScrollPosition()
}

function scrollToBottom() {
  const el = scrollParentRef.value ?? chatScrollRef.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  showScrollToBottom.value = false
}

onMounted(() => {
  nextTick(() => {
    const wrap = chatScrollRef.value
    if (!wrap) return
    const root = wrap.querySelector('[data-slot="root"]') as HTMLElement | null
    const parent = root ? getScrollParent(root) : wrap
    scrollParentRef.value = parent
    const el = parent ?? wrap
    const runCheckAfterPaint = () => requestAnimationFrame(() => checkScrollPosition())
    checkScrollPosition()
    runCheckAfterPaint()
    setTimeout(checkScrollPosition, 100)
    setTimeout(checkScrollPosition, 400)
    el.addEventListener('scroll', onChatScroll, { passive: true })
    const ro = new ResizeObserver(runCheckAfterPaint)
    ro.observe(el)
    scrollCleanupRef.value = () => {
      el.removeEventListener('scroll', onChatScroll)
      ro.disconnect()
      scrollParentRef.value = null
    }
  })
})

const props = defineProps<{
  uiMessages: UiMessage[]
  chatStatus: 'submitted' | 'streaming' | 'ready' | 'error'
  chatTitle: string
  chatUserName: string
  chatUserAvatar?: string
  isSessionExpanded: boolean
  sessionAreaFontScale: number
  input: string
  streaming: boolean
  replyTarget?: { id: string; role: string; content: string } | null
}>()

const emit = defineEmits<{
  'update:input': [value: string]
  close: []
  rename: []
  share: []
  'copy-link': []
  'export-screen': []
  'export-screenshot': []
  'export-markdown': []
  archive: []
  delete: []
  submit: []
  stop: []
  clear: []
  'scroll-to-last': []
  'add-participant': []
  'cancel-reply': []
}>()

watch(() => props.uiMessages.length, () => {
  nextTick(checkScrollPosition)
})
</script>

<style scoped>
/* 去除 Nuxt UI ChatMessage 自带的 content/container 背景，仅保留气泡自身背景；移除 container 默认 pb-8；移除 content 四周边距 */
:deep([data-slot="root"]),
:deep([data-slot="container"]),
:deep([data-slot="content"]) {
  background: transparent;
}
:deep([data-slot="content"]) {
  padding: 0;
}
:deep([data-slot="container"]) {
  padding-bottom: 0;
}
/* 左侧接收的消息保留底边距 */
:deep([data-role="assistant"] [data-slot="container"]) {
  padding-bottom: 1rem;
}
/* 右侧发送方消息：去除外层容器（root/container）的上下边距，仅保留气泡本身间距 */
:deep([data-role="user"] [data-slot="root"]),
:deep([data-role="user"] [data-slot="container"]) {
  padding-top: 0;
  padding-bottom: 0;
}
/* 保持与原有聊天区一致的选中样式 */
:deep([data-slot="content"]) *::selection {
  background: rgb(59 130 246 / 0.22);
  color: inherit;
}
:global(.dark) :deep([data-slot="content"]) *::selection {
  background: rgb(96 165 250 / 0.28);
}

/* 聊天消息区极细滚动条 */
:deep(.chat-messages-scroll) {
  scrollbar-width: thin;
  scrollbar-color: rgb(212 212 216) transparent;
}
:deep(.chat-messages-scroll)::-webkit-scrollbar {
  width: 2px;
  height: 2px;
}
:deep(.chat-messages-scroll)::-webkit-scrollbar-track {
  background: transparent;
}
:deep(.chat-messages-scroll)::-webkit-scrollbar-thumb {
  background-color: rgb(212 212 216);
  border-radius: 2px;
}
:global(.dark) :deep(.chat-messages-scroll) {
  scrollbar-color: rgb(82 82 91) transparent;
}
:global(.dark) :deep(.chat-messages-scroll)::-webkit-scrollbar-thumb {
  background-color: rgb(82 82 91);
}

/* 回到底部按钮淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
