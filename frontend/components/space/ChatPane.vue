<template>
  <div class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
    <ChatHeader
      :title="chatTitle"
      :user-name="chatUserName"
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
      :ref="scrollRef"
      class="chat-scroll-area absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain p-3 pl-5 pt-16 pb-52"
      :style="{ '--chat-text-scale': sessionAreaFontScale }"
    >
      <slot />
    </div>
    <ChatInputPanel
      :model-value="input"
      :streaming="streaming"
      @update:model-value="emit('update:input', $event)"
      @submit="emit('submit')"
      @stop="emit('stop')"
      @clear="emit('clear')"
      @scroll-to-last="emit('scroll-to-last')"
      @add-participant="emit('add-participant')"
    />
  </div>
</template>

<script setup lang="ts">
import type { Ref } from 'vue'
import ChatHeader from '~/components/ChatHeader.vue'
import ChatInputPanel from '~/components/ChatInputPanel.vue'

defineProps<{
  scrollRef: Ref<HTMLElement | null> | null
  chatTitle: string
  chatUserName: string
  isSessionExpanded: boolean
  sessionAreaFontScale: number
  input: string
  streaming: boolean
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
