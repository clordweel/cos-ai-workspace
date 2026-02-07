<template>
  <!-- 用户：气泡容器，无工具栏 -->
  <div v-if="message.role === 'user'" class="max-w-[85%] rounded-xl rounded-tr-none px-4 py-2.5 text-sm bg-primary-100 dark:bg-primary-900/40 text-primary-900 dark:text-primary-100">
    <p class="whitespace-pre-wrap break-words">{{ message.content }}</p>
  </div>
  <!-- 左侧消息：标准宽度容器，保证短消息时工具栏与头像右对齐一致 -->
  <div v-else class="min-w-[20rem] max-w-[85%] text-sm text-zinc-800 dark:text-zinc-200">
    <div
      v-if="message.thinking != null && message.thinking.trim()"
      class="mb-3"
    >
      <button
        type="button"
        class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        @click="thinkingOpen = !thinkingOpen"
      >
        <span class="transition-transform" :class="thinkingOpen ? 'rotate-90' : ''">▶</span>
        <span>思考过程</span>
      </button>
      <div
        v-show="thinkingOpen"
        class="mt-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap break-words border border-zinc-200 dark:border-zinc-600"
      >
        {{ message.thinking }}
      </div>
    </div>
    <!-- 思考中占位：卡片 + 图标 + 轻微动效 -->
    <div
      v-if="isThinkingPlaceholder"
      class="thinking-placeholder inline-flex items-center gap-2 rounded-xl border border-zinc-200/80 dark:border-zinc-600/80 bg-zinc-50/90 dark:bg-zinc-800/90 px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400"
    >
      <Sparkles class="h-3.5 w-3.5 shrink-0 text-amber-500/80 dark:text-amber-400/80 thinking-icon" />
      <span>思考中</span>
      <span class="thinking-dots">
        <span class="thinking-dot" />
        <span class="thinking-dot thinking-dot-2" />
        <span class="thinking-dot thinking-dot-3" />
      </span>
    </div>
    <p v-else class="whitespace-pre-wrap break-words">
      <template v-if="message.contentChunks?.length">
        <span
          v-for="(chunk, i) in message.contentChunks"
          :key="i"
          class="stream-token"
        >{{ chunk }}</span>
      </template>
      <template v-else>{{ message.content }}</template>
      <span v-if="streaming" class="streaming-cursor bg-primary-500 dark:bg-primary-400 ml-0.5 align-middle" aria-hidden />
    </p>
    <!-- 消息工具栏：左侧按钮 + 右侧堆叠来源头像 -->
    <div class="mt-1.5 flex items-center gap-0.5 text-zinc-400 dark:text-zinc-500">
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        aria-label="赞同"
        @click="onLike"
      >
        <ThumbsUp class="h-3.5 w-3.5" stroke-width="2" />
      </button>
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        aria-label="反对"
        @click="onDislike"
      >
        <ThumbsDown class="h-3.5 w-3.5" stroke-width="2" />
      </button>
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        aria-label="复制"
        @click="onCopy"
      >
        <Copy class="h-3.5 w-3.5" stroke-width="2" />
      </button>
      <DropdownMenuRoot>
        <DropdownMenuTrigger
          class="flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors outline-none"
          aria-label="更多"
        >
          <MoreVertical class="h-3.5 w-3.5" stroke-width="2" />
        </DropdownMenuTrigger>
        <DropdownMenuPortal to="body">
          <DropdownMenuContent
            class="z-[100] min-w-[140px] rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-1 shadow-lg"
            :side-offset="4"
            align="start"
          >
            <DropdownMenuItem
              v-if="hasBotSource"
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="重试"
              @select="emit('retry')"
            >
              <RefreshCw class="h-3.5 w-3.5 shrink-0 opacity-70" />
              重试
            </DropdownMenuItem>
            <DropdownMenuItem
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="收藏"
              @select="emit('favorite')"
            >
              <Bookmark class="h-3.5 w-3.5 shrink-0 opacity-70" />
              收藏
            </DropdownMenuItem>
            <DropdownMenuItem
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="导出 Markdown"
              @select="emit('exportMarkdown')"
            >
              <FileDown class="h-3.5 w-3.5 shrink-0 opacity-70" />
              导出 Markdown
            </DropdownMenuItem>
            <DropdownMenuItem
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="听回复"
              @select="emit('listenReply')"
            >
              <Volume2 class="h-3.5 w-3.5 shrink-0 opacity-70" />
              听回复
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
      <div class="flex shrink-0 -space-x-2">
        <span
          v-for="(src, idx) in displaySources"
          :key="idx"
          class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300"
          :class="idx > 0 ? '-ml-2' : ''"
          :title="sourceLabel(src)"
        >
          <User v-if="src.type === 'other_user'" class="h-3 w-3" />
          <Bot v-else-if="src.type === 'bot'" class="h-3 w-3" />
          <Cog v-else class="h-3 w-3" />
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MessageSource } from '~/composables/useChatSessions'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'radix-vue'
import { Bookmark, Bot, Cog, Copy, FileDown, MoreVertical, RefreshCw, Sparkles, ThumbsDown, ThumbsUp, User, Volume2 } from 'lucide-vue-next'

const THINKING_PLACEHOLDER = '思考中…'

const props = defineProps<{
  message: { role: string; content: string; thinking?: string; sources?: MessageSource[]; contentChunks?: string[] }
  streaming?: boolean
}>()
const emit = defineEmits<{ retry: []; favorite: []; exportMarkdown: []; listenReply: [] }>()

const thinkingOpen = ref(true)

const displaySources = computed(() => {
  const s = props.message.sources
  if (s && s.length > 0) return s
  return [{ type: 'bot' as const }]
})

const hasBotSource = computed(() => displaySources.value.some((s) => s.type === 'bot'))
const isThinkingPlaceholder = computed(
  () => props.message.role === 'assistant' && props.message.content === THINKING_PLACEHOLDER
)

function sourceLabel(src: MessageSource) {
  if (src.label) return src.label
  return src.type === 'bot' ? '机器人' : src.type === 'other_user' ? '其它用户' : '系统'
}

function onLike() {}
function onDislike() {}
function onCopy() {
  if (props.message.content) {
    navigator.clipboard.writeText(props.message.content)
  }
}
</script>

<style scoped>
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  animation: streaming-blink 1s ease-in-out infinite;
}
@keyframes streaming-blink {
  0%,
  45%,
  55%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

/* 流式结论每段文字轻微渐显 */
.stream-token {
  animation: stream-token-in 0.2s ease-out;
}
@keyframes stream-token-in {
  from {
    opacity: 0.5;
  }
  to {
    opacity: 1;
  }
}

/* 思考中占位：图标轻微呼吸 + 三点依次亮起 */
.thinking-icon {
  animation: thinking-icon-pulse 2s ease-in-out infinite;
}
.thinking-dots {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.thinking-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.4;
  animation: thinking-dot-step 1.2s ease-in-out infinite;
}
.thinking-dot-2 {
  animation-delay: 0.2s;
}
.thinking-dot-3 {
  animation-delay: 0.4s;
}
@keyframes thinking-icon-pulse {
  0%,
  100% {
    opacity: 0.85;
  }
  50% {
    opacity: 1;
  }
}
@keyframes thinking-dot-step {
  0%,
  80%,
  100% {
    opacity: 0.35;
  }
  40% {
    opacity: 1;
  }
}
</style>
