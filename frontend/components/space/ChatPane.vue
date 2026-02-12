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
      class="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col"
      :style="{ '--chat-text-scale': sessionAreaFontScale }"
    >
      <UChatMessages
        :messages="uiMessages"
        :status="chatStatus"
        should-scroll-to-bottom
        should-auto-scroll
        class="chat-messages-scroll flex-1 min-h-0 overflow-y-auto px-5 pt-3 pb-3"
      >
        <template #content="{ message }">
          <slot name="content" :message="message" />
        </template>
      </UChatMessages>
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
import type { UiMessage } from '~/composables/useSpaceChatPane'
import ChatHeader from '~/components/ChatHeader.vue'
import ChatInputPanel from '~/components/ChatInputPanel.vue'

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
</script>

<style scoped>
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
  width: 6px;
  height: 6px;
}
:deep(.chat-messages-scroll)::-webkit-scrollbar-track {
  background: transparent;
}
:deep(.chat-messages-scroll)::-webkit-scrollbar-thumb {
  background-color: rgb(212 212 216);
  border-radius: 3px;
}
:global(.dark) :deep(.chat-messages-scroll) {
  scrollbar-color: rgb(82 82 91) transparent;
}
:global(.dark) :deep(.chat-messages-scroll)::-webkit-scrollbar-thumb {
  background-color: rgb(82 82 91);
}
</style>
