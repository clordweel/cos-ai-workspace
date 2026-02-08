<template>
  <div class="absolute bottom-0 left-0 right-0 z-20 flex flex-col">
    <div
      class="h-16 pointer-events-none shrink-0 bg-gradient-to-t from-white to-transparent dark:from-zinc-800 dark:to-transparent"
      aria-hidden
    />
    <div class="shrink-0 p-3 pt-0 bg-white dark:bg-zinc-800">
      <div class="rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-sm overflow-hidden">
        <div
          v-if="streaming"
          class="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-700"
        >
          <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <button
              type="button"
              class="font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
              @click="$emit('stop')"
            >
              停止
            </button>
            <span>Ctrl+Shift+Enter 停止</span>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              aria-label="清空输入"
              @click="$emit('clear')"
            >
              <X class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
              @click="$emit('scroll-to-last')"
            >
              回顾
            </button>
          </div>
        </div>
        <form class="flex flex-col" @submit.prevent="$emit('submit')">
          <div
            ref="textareaWrapRef"
            class="chat-input-inner-scroll overflow-y-auto overflow-x-hidden"
            :style="{ height: `${editHeightPx}px` }"
          >
            <textarea
              :value="modelValue"
              rows="2"
              placeholder="说点什么？"
              class="chat-input-textarea min-h-[72px] w-full resize-none border-0 bg-transparent px-3 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-0"
              :disabled="streaming"
              @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
              @keydown.enter.exact.prevent="$emit('submit')"
              @keydown.enter.shift.exact.prevent="$emit('update:modelValue', modelValue + '\n')"
            />
          </div>
          <button
            type="button"
            class="chat-input-resize-handle flex w-full shrink-0 cursor-ns-resize items-center justify-center border-0 bg-transparent py-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            aria-label="拖拽调整输入框高度"
            @mousedown.prevent="onResizeStart"
          >
            <GripHorizontal class="h-4 w-4" />
          </button>
          <div class="flex items-center justify-between gap-2 px-3 pb-2 pt-0">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700/50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <Infinity class="h-3.5 w-3.5" />
                <span>Agent</span>
                <ChevronDown class="h-3.5 w-3.5 opacity-60" />
              </button>
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700/50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <span>自动</span>
                <ChevronDown class="h-3.5 w-3.5 opacity-60" />
              </button>
            </div>
            <div class="flex items-center gap-1">
              <span
                v-if="streaming"
                class="flex h-8 w-8 items-center justify-center text-zinc-400"
                aria-hidden
              >
                <Loader2 class="h-4 w-4 animate-spin" />
              </span>
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                title="联网"
                aria-label="联网"
              >
                <Globe class="h-4 w-4 text-primary-500" />
              </button>
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                title="图片"
                aria-label="上传图片"
              >
                <ImageIcon class="h-4 w-4" />
              </button>
              <button
                v-if="streaming"
                type="button"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                aria-label="停止"
                @click="$emit('stop')"
              >
                <Square class="h-4 w-4" />
              </button>
              <button
                v-else
                type="submit"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                :disabled="!modelValue.trim()"
                aria-label="发送"
              >
                <Send class="h-4 w-4" />
              </button>
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
import { ChevronDown, Globe, GripHorizontal, Image as ImageIcon, Infinity, Loader2, Send, Square, X } from 'lucide-vue-next'
import { ref, onUnmounted } from 'vue'

defineProps<{
  modelValue: string
  streaming: boolean
}>()
defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
  (e: 'stop'): void
  (e: 'clear'): void
  (e: 'scroll-to-last'): void
}>()

const MIN_EDIT_HEIGHT = 72
const MAX_EDIT_HEIGHT = 280
const DEFAULT_EDIT_HEIGHT = 72

const textareaWrapRef = ref<HTMLElement | null>(null)
const editHeightPx = ref(DEFAULT_EDIT_HEIGHT)

let resizeStartY = 0
let resizeStartHeight = 0

function onResizeStart(e: MouseEvent) {
  resizeStartY = e.clientY
  resizeStartHeight = editHeightPx.value
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeEnd)
}

function onResizeMove(e: MouseEvent) {
  const delta = e.clientY - resizeStartY
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
.chat-input-inner-scroll {
  scrollbar-gutter: stable;
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
</style>
