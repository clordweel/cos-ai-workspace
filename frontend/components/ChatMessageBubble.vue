<template>
  <!-- 用户：气泡容器，无工具栏 -->
  <div v-if="message.role === 'user'" class="max-w-[85%] rounded-xl rounded-tr-none px-4 py-2.5 text-sm bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100">
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
    <p class="whitespace-pre-wrap break-words">
      {{ message.content }}
      <span v-if="streaming" class="inline-block w-px h-3.5 ml-0.5 bg-emerald-500 dark:bg-emerald-400 animate-pulse align-middle" />
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
import { Bookmark, Bot, Cog, Copy, FileDown, MoreVertical, RefreshCw, ThumbsDown, ThumbsUp, User, Volume2 } from 'lucide-vue-next'

const props = defineProps<{
  message: { role: string; content: string; thinking?: string; sources?: MessageSource[] }
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
