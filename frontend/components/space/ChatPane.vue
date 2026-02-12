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
    <div
      :ref="setScrollRef"
      class="chat-scroll-area chat-scroll-inverted absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain p-3 pl-5 pb-16 pt-52 scroll-smooth"
      :style="{ '--chat-text-scale': sessionAreaFontScale }"
    >
      <div class="chat-scroll-inverted-inner">
        <slot />
      </div>
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
    />
  </div>
</template>

<script setup lang="ts">
import type { Ref } from 'vue'
import ChatHeader from '~/components/ChatHeader.vue'
import ChatInputPanel from '~/components/ChatInputPanel.vue'

const props = defineProps<{
  scrollRef: Ref<HTMLElement | null> | null
  chatTitle: string
  chatUserName: string
  chatUserAvatar?: string
  isSessionExpanded: boolean
  sessionAreaFontScale: number
  input: string
  streaming: boolean
  replyTarget?: { id: string; role: string; content: string } | null
}>()

let wheelCleanup: (() => void) | null = null

function setScrollRef(el: unknown) {
  const el2 = el as HTMLElement | null
  if (props.scrollRef) props.scrollRef.value = el2
  if (wheelCleanup) {
    wheelCleanup()
    wheelCleanup = null
  }
  if (el2) {
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      el2.scrollTop -= e.deltaY
    }
    el2.addEventListener('wheel', handler, { passive: false })
    wheelCleanup = () => el2.removeEventListener('wheel', handler)
  }
}

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
</script>

<style scoped>
.chat-scroll-area *::selection {
  background: rgb(59 130 246 / 0.22);
  color: inherit;
}
.chat-scroll-area *::-moz-selection {
  background: rgb(59 130 246 / 0.22);
  color: inherit;
}
:global(.dark) .chat-scroll-area *::selection {
  background: rgb(96 165 250 / 0.28);
}
:global(.dark) .chat-scroll-area *::-moz-selection {
  background: rgb(96 165 250 / 0.28);
}
/* 反转滚动方向：scrollTop=0 显示底部（最新），内容用内层 scaleY(-1) 翻回正序 */
.chat-scroll-inverted {
  transform: scaleY(-1);
}
.chat-scroll-inverted-inner {
  transform: scaleY(-1);
}
.chat-scroll-area {
  scrollbar-gutter: stable;
}
.chat-scroll-area::-webkit-scrollbar {
  width: 2px;
}
.chat-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}
.chat-scroll-area::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: rgb(161 161 170 / 0.4);
}
.chat-scroll-area::-webkit-scrollbar-thumb:hover {
  background: rgb(161 161 170 / 0.6);
}
.chat-scroll-area::-webkit-scrollbar-thumb:active {
  background: rgb(161 161 170 / 0.8);
}
@supports (scrollbar-width: thin) {
  .chat-scroll-area {
    scrollbar-width: thin;
    scrollbar-color: rgb(161 161 170 / 0.5) transparent;
  }
}
</style>
