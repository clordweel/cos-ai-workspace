<template>
  <!-- 用户：发送状态在气泡左侧外侧，已读时顶部外侧对方头像 -->
  <div v-if="message.role === 'user'" class="max-w-[85%] flex flex-col items-end gap-1">
    <!-- 已读：气泡顶部外侧，向右对齐、向左排列的对方头像 -->
    <div
      v-if="userReceiptStatus === 'read' && readBySources.length > 0"
      class="flex shrink-0 flex-row-reverse items-center gap-0 -space-x-2"
      :title="userReceiptStatusLabel"
    >
      <span
        v-for="(src, idx) in readBySources"
        :key="idx"
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-white dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300"
        :class="idx > 0 ? '-ml-2' : ''"
        :title="sourceLabel(src)"
      >
        <User v-if="src.type === 'other_user'" class="h-2.5 w-2.5" />
        <Bot v-else-if="src.type === 'bot'" class="h-2.5 w-2.5" />
        <Cog v-else class="h-2.5 w-2.5" />
      </span>
    </div>
    <div class="flex items-end gap-1.5">
      <!-- 发送状态：气泡左侧外侧 -->
      <span
        v-if="userReceiptStatus && userReceiptStatus !== 'read'"
        class="flex h-6 w-6 shrink-0 items-center justify-center self-center"
        :title="userReceiptStatusLabel"
        aria-hidden
      >
        <Loader2 v-if="userReceiptStatus === 'sending'" class="h-3.5 w-3.5 text-zinc-400 animate-spin" />
        <XCircle v-else-if="userReceiptStatus === 'failed'" class="h-3.5 w-3.5 text-red-500" />
        <Check v-else-if="userReceiptStatus === 'sent'" class="h-3.5 w-3.5 text-zinc-500" />
        <CheckCheck v-else-if="userReceiptStatus === 'delivered'" class="h-3.5 w-3.5 text-zinc-500" />
      </span>
      <ContextMenuRoot v-if="messageIndex !== undefined">
        <ContextMenuTrigger as-child>
          <div
            class="flex items-end gap-1.5 rounded-xl rounded-tr-none px-4 py-2.5 text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-900 dark:text-primary-100 w-fit max-w-full"
          >
            <p class="chat-message-text whitespace-pre-wrap break-words flex-1 min-w-0">{{ message.content }}</p>
          </div>
        </ContextMenuTrigger>
        <ContextMenuPortal>
          <ContextMenuContent
            class="z-[100] min-w-[140px] rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-1 shadow-lg"
            :side-offset="4"
          >
            <ContextMenuItem
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="编辑"
              @select="emit('editUserMessage')"
            >
              <Pencil class="h-3.5 w-3.5 shrink-0 opacity-70" />
              编辑
            </ContextMenuItem>
            <ContextMenuItem
              v-if="message.receiptStatus === 'failed'"
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="重试"
              @select="emit('retryUserMessage')"
            >
              <RefreshCw class="h-3.5 w-3.5 shrink-0 opacity-70" />
              重试
            </ContextMenuItem>
            <ContextMenuItem
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="撤回"
              @select="emit('recallMessage')"
            >
              <Undo2 class="h-3.5 w-3.5 shrink-0 opacity-70" />
              撤回
            </ContextMenuItem>
            <ContextMenuItem
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="删除"
              @select="emit('deleteMessage')"
            >
              <Trash2 class="h-3.5 w-3.5 shrink-0 opacity-70" />
              删除
            </ContextMenuItem>
            <ContextMenuItem
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="更多"
              disabled
            >
              <MoreHorizontal class="h-3.5 w-3.5 shrink-0 opacity-70" />
              更多
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenuPortal>
      </ContextMenuRoot>
      <template v-else>
        <div class="flex items-end gap-1.5 rounded-xl rounded-tr-none px-4 py-2.5 text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-900 dark:text-primary-100">
          <p class="chat-message-text whitespace-pre-wrap break-words flex-1 min-w-0">{{ message.content }}</p>
        </div>
      </template>
    </div>
    <span v-if="showTimestamp && timestampText" class="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
      {{ timestampText }}
    </span>
  </div>
  <!-- 左侧消息：标准宽度容器；仅气泡内容区可右键菜单 -->
  <div v-else class="min-w-[20rem] max-w-[85%] text-xs text-zinc-800 dark:text-zinc-200">
    <ContextMenuRoot v-if="messageIndex !== undefined">
      <ContextMenuTrigger as-child>
        <div class="w-full">
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
              class="chat-message-text mt-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap break-words border border-zinc-200 dark:border-zinc-600"
            >
              {{ message.thinking }}
            </div>
          </div>
          <div
            v-if="isThinkingPlaceholder"
            class="chat-message-text thinking-placeholder inline-flex items-center gap-2 rounded-xl border border-zinc-200/80 dark:border-zinc-600/80 bg-zinc-50/90 dark:bg-zinc-800/90 px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400"
          >
            <Sparkles class="h-3.5 w-3.5 shrink-0 text-amber-500/80 dark:text-amber-400/80 thinking-icon" />
            <span>思考中</span>
            <span class="thinking-dots">
              <span class="thinking-dot" />
              <span class="thinking-dot thinking-dot-2" />
              <span class="thinking-dot thinking-dot-3" />
            </span>
          </div>
          <p v-else class="chat-message-text whitespace-pre-wrap break-words">
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
          <div v-if="likeReactions.length > 0 || message.editedAt" class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span v-if="likeReactions.length > 0" class="inline-flex items-center gap-1">
              <ThumbsUp class="h-3 w-3 shrink-0" stroke-width="2" />
              <span>{{ likeReactionsLabel }}</span>
            </span>
            <span v-if="message.editedAt" class="inline-flex items-center gap-1" :title="editedByLabel">
              已编辑<template v-if="message.editedBy">（{{ message.editedBy.label || (message.editedBy.type === 'bot' ? '机器人' : '用户') }}）</template>
            </span>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuPortal>
        <ContextMenuContent
          class="z-[100] min-w-[140px] rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-1 shadow-lg"
          :side-offset="4"
        >
          <ContextMenuItem
            v-if="hasBotSource"
            class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            text-value="重试"
            @select="emit('retry')"
          >
            <RefreshCw class="h-3.5 w-3.5 shrink-0 opacity-70" />
            重试
          </ContextMenuItem>
          <ContextMenuItem
            class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            text-value="复制"
            @select="emit('copyMessage')"
          >
            <Copy class="h-3.5 w-3.5 shrink-0 opacity-70" />
            复制
          </ContextMenuItem>
          <ContextMenuItem
            class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            text-value="收藏"
            @select="emit('favorite')"
          >
            <Bookmark class="h-3.5 w-3.5 shrink-0 opacity-70" />
            收藏
          </ContextMenuItem>
          <ContextMenuItem
            class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            text-value="导出 Markdown"
            @select="emit('exportMarkdown')"
          >
            <FileDown class="h-3.5 w-3.5 shrink-0 opacity-70" />
            导出 Markdown
          </ContextMenuItem>
          <ContextMenuItem
            class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            text-value="查看编辑历史"
            @select="emit('viewEditHistory')"
          >
            <History class="h-3.5 w-3.5 shrink-0 opacity-70" />
            查看编辑历史
          </ContextMenuItem>
          <ContextMenuItem
            class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            text-value="听回复"
            @select="emit('listenReply')"
          >
            <Volume2 class="h-3.5 w-3.5 shrink-0 opacity-70" />
            听回复
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenuPortal>
    </ContextMenuRoot>
    <template v-else>
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
          class="chat-message-text mt-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap break-words border border-zinc-200 dark:border-zinc-600"
        >
          {{ message.thinking }}
        </div>
      </div>
      <div
        v-if="isThinkingPlaceholder"
        class="chat-message-text thinking-placeholder inline-flex items-center gap-2 rounded-xl border border-zinc-200/80 dark:border-zinc-600/80 bg-zinc-50/90 dark:bg-zinc-800/90 px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400"
      >
        <Sparkles class="h-3.5 w-3.5 shrink-0 text-amber-500/80 dark:text-amber-400/80 thinking-icon" />
        <span>思考中</span>
        <span class="thinking-dots">
          <span class="thinking-dot" />
          <span class="thinking-dot thinking-dot-2" />
          <span class="thinking-dot thinking-dot-3" />
        </span>
      </div>
      <p v-else class="chat-message-text whitespace-pre-wrap break-words">
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
      <div v-if="likeReactions.length > 0 || message.editedAt" class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span v-if="likeReactions.length > 0" class="inline-flex items-center gap-1">
          <ThumbsUp class="h-3 w-3 shrink-0" stroke-width="2" />
          <span>{{ likeReactionsLabel }}</span>
        </span>
        <span v-if="message.editedAt" class="inline-flex items-center gap-1" :title="editedByLabel">
          已编辑<template v-if="message.editedBy">（{{ message.editedBy.label || (message.editedBy.type === 'bot' ? '机器人' : '用户') }}）</template>
        </span>
      </div>
    </template>
    <!-- 消息工具栏：左侧按钮 + 右侧堆叠来源头像 -->
    <div class="mt-1.5 flex items-center gap-0.5 text-zinc-400 dark:text-zinc-500">
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        :class="userHasLiked ? '!text-zinc-700 dark:!text-zinc-200' : ''"
        aria-label="赞同"
        @click="onLike"
      >
        <ThumbsUp class="h-3.5 w-3.5" stroke-width="2" />
      </button>
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        aria-label="反对"
        @click="onDislike"
      >
        <ThumbsDown class="h-3.5 w-3.5" stroke-width="2" />
      </button>
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        aria-label="复制"
        @click="onCopy"
      >
        <Copy class="h-3.5 w-3.5" stroke-width="2" />
      </button>
      <button
        v-if="canEditOtherMessage"
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        aria-label="编辑"
        title="编辑"
        @click="emit('edit')"
      >
        <Pencil class="h-3.5 w-3.5" stroke-width="2" />
      </button>
      <DropdownMenuRoot>
        <DropdownMenuTrigger
          class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors outline-none"
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
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="重试"
              @select="emit('retry')"
            >
              <RefreshCw class="h-3.5 w-3.5 shrink-0 opacity-70" />
              重试
            </DropdownMenuItem>
            <DropdownMenuItem
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="收藏"
              @select="emit('favorite')"
            >
              <Bookmark class="h-3.5 w-3.5 shrink-0 opacity-70" />
              收藏
            </DropdownMenuItem>
            <DropdownMenuItem
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="导出 Markdown"
              @select="emit('exportMarkdown')"
            >
              <FileDown class="h-3.5 w-3.5 shrink-0 opacity-70" />
              导出 Markdown
            </DropdownMenuItem>
            <DropdownMenuItem
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="查看编辑历史"
              @select="emit('viewEditHistory')"
            >
              <History class="h-3.5 w-3.5 shrink-0 opacity-70" />
              查看编辑历史
            </DropdownMenuItem>
            <DropdownMenuItem
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
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
    <span v-if="showTimestamp && timestampText" class="block mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
      {{ timestampText }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { MessageReaction, MessageSource } from '~/composables/useChatSessions'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'radix-vue'
import { Bookmark, Bot, Check, CheckCheck, Cog, Copy, FileDown, History, Loader2, MoreHorizontal, MoreVertical, Pencil, RefreshCw, Sparkles, ThumbsDown, ThumbsUp, Trash2, Undo2, User, Volume2, XCircle } from 'lucide-vue-next'

const THINKING_PLACEHOLDER = '思考中…'

const props = defineProps<{
  message: {
    role: string
    content: string
    thinking?: string
    sources?: MessageSource[]
    contentChunks?: string[]
    reactions?: MessageReaction[]
    editedAt?: number
    editedBy?: MessageSource
    receiptStatus?: import('~/composables/useChatSessions').MessageReceiptStatus
    readBy?: MessageSource[]
    createdAt?: number
  }
  streaming?: boolean
  showTimestamp?: boolean
  timestampText?: string
  /** 当前用户标识，用于高亮“我”的点赞（可选） */
  currentUserLabel?: string
  /** 是否拥有编辑对方消息权限；为 true 时底部工具条显示编辑按钮 */
  canEditOtherMessage?: boolean
  /** 消息在列表中的下标，传入时气泡区域才启用右键菜单 */
  messageIndex?: number
}>()
const emit = defineEmits<{
  retry: []; favorite: []; exportMarkdown: []; listenReply: []; viewEditHistory: []; edit: [];
  editUserMessage: []; retryUserMessage: []; recallMessage: []; deleteMessage: []; copyMessage: [];
  reaction: [type: 'like' | 'dislike']
}>()

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

const likeReactions = computed(() => (props.message.reactions ?? []).filter((r) => r.type === 'like'))
const likeReactionsLabel = computed(() => {
  const labels = likeReactions.value.map((r) => r.by.label || (r.by.type === 'bot' ? '机器人' : '用户'))
  if (labels.length === 0) return ''
  if (labels.length <= 2) return `${labels.join('、')} 觉得很赞`
  return `${labels.slice(0, 2).join('、')} 等 ${labels.length} 人觉得很赞`
})
const editedByLabel = computed(() => {
  const e = props.message.editedBy
  if (!e) return ''
  return e.label || (e.type === 'bot' ? '机器人' : '用户')
})
const userHasLiked = computed(() =>
  props.currentUserLabel
    ? likeReactions.value.some((r) => r.by.label === props.currentUserLabel)
    : false,
)

const userReceiptStatus = computed(() => {
  if (props.message.role !== 'user') return null
  const s = props.message.receiptStatus
  return s ?? 'sent'
})
/** 已读时展示的对方头像来源；无 readBy 时默认展示一个 bot 占位 */
const readBySources = computed(() => {
  const r = props.message.readBy
  if (r && r.length > 0) return r
  return [{ type: 'bot' as const }]
})
const userReceiptStatusLabel = computed(() => {
  const s = userReceiptStatus.value
  if (!s) return ''
  const map: Record<string, string> = {
    sending: '发送中',
    sent: '已发送',
    delivered: '已送达',
    read: '已读',
    failed: '发送失败',
  }
  return map[s] ?? ''
})

function sourceLabel(src: MessageSource) {
  if (src.label) return src.label
  return src.type === 'bot' ? '机器人' : src.type === 'other_user' ? '其它用户' : '系统'
}

function onLike() {
  emit('reaction', 'like')
}
function onDislike() {
  emit('reaction', 'dislike')
}
function onCopy() {
  if (props.message.content) {
    navigator.clipboard.writeText(props.message.content)
  }
}
</script>

<style scoped>
/* 仅聊天对话文字随「界面字体大小」设置缩放（:deep 确保在 as-child 等插槽内也生效） */
:deep(.chat-message-text) {
  font-size: calc(1rem * var(--chat-text-scale, 1)) !important;
}
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
