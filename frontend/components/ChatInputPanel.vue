<template>
  <div ref="inputPanelRootRef" class="absolute bottom-0 left-0 right-0 z-20 flex flex-col pointer-events-none">
    <div
      class="h-16 shrink-0 bg-gradient-to-t from-white/50 via-white/50 to-transparent dark:from-zinc-800/50 dark:via-zinc-800/50 dark:to-transparent"
      aria-hidden
    />
    <div class="shrink-0 p-3 pt-0 bg-white dark:bg-zinc-800 pointer-events-auto">
      <div class="chat-input-card relative rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-sm overflow-visible">
        <div
          v-if="streaming && showAssistantToolbar"
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
        <form ref="inputFormRef" class="flex flex-col overflow-hidden rounded-xl" @submit.prevent="onFormSubmit">
          <!-- 编辑中：正在编辑某条消息时显示，可点击取消 -->
          <div
            v-if="editingMessageId"
            class="flex items-center gap-2 mx-3 mt-2 mb-0 py-2 px-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20"
          >
            <span class="text-[10px] text-amber-700 dark:text-amber-400 flex-1">正在编辑消息</span>
            <button
              type="button"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-200/60 dark:hover:bg-amber-800/40 transition-colors"
              aria-label="取消编辑"
              @click="$emit('cancel-edit')"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
          <!-- 回复预览：回复某条消息时显示引用块，可点击关闭 -->
          <div
            v-if="replyTarget && !editingMessageId"
            class="flex items-center gap-2 mx-3 mt-2 mb-0 py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/80"
          >
            <div class="min-w-0 flex-1 text-left">
              <span class="text-[10px] text-zinc-500 dark:text-zinc-400">
                {{ replyTarget.role === 'user' ? '回复用户' : '回复助手' }}
              </span>
              <p class="text-[11px] text-zinc-700 dark:text-zinc-300 line-clamp-2 break-words mt-0.5">
                {{ replyTarget.content || '…' }}
              </p>
            </div>
            <button
              type="button"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-600 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              aria-label="取消回复"
              @click="$emit('cancel-reply')"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
          <div
            ref="editorWrapRef"
            class="chat-input-inner-scroll overflow-x-hidden overflow-y-auto"
            :style="{ height: `${editHeightPx}px`, minHeight: `${editHeightPx}px` }"
          >
            <UEditor
              :model-value="modelValue"
              content-type="markdown"
              placeholder="说点什么？输入 @ 可提及联系人或机器人"
              :editable="!streaming"
              :extensions="chatEnterExtensions"
              class="chat-input-editor chat-input-text-scale min-h-full w-full px-3 pt-3 pb-0 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 [&_.ProseMirror]:min-h-[3rem] [&_.ProseMirror]:outline-none"
              @update:model-value="onEditorUpdate"
            >
              <template v-slot="{ editor }">
                <ChatInputEditorBridge :editor="editor" @register="setEditorRef" />
                <UEditorMentionMenu
                  v-if="editor"
                  :editor="editor"
                  :items="mentionMenuItems"
                  :append-to="mentionMenuAppendTo"
                />
              </template>
            </UEditor>
          </div>
          <!-- 工具栏固定在输入框底部 -->
          <div class="chat-input-toolbar flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-2">
            <div class="flex items-center gap-1">
              <DropdownMenu v-if="isXxs">
                <DropdownMenuTrigger
                  as-child
                >
                  <button
                    type="button"
                    class="flex h-6 items-center justify-between gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-600 bg-transparent px-2 py-1 text-[10px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 [&_svg]:shrink-0 [&_svg]:opacity-70"
                    title="插入 @ 提及、# 来源、/ 命令"
                    aria-label="输入工具"
                  >
                    <span>工具</span>
                    <ChevronDown class="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="bottom" :side-offset="4" class="min-w-[8.5rem] shadow-none">
                  <DropdownMenuItem text-value="提及" class="gap-2" @select="editorRef?.chain().focus().insertContent('@').run()">
                    <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-200/80 dark:bg-zinc-600/80">
                      <AtSign class="h-2.5 w-2.5 text-black dark:text-white" />
                    </span>
                    提及
                  </DropdownMenuItem>
                  <DropdownMenuItem text-value="来源" class="gap-2" @select="editorRef?.chain().focus().insertContent('#').run()">
                    <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-200/80 dark:bg-zinc-600/80">
                      <Hash class="h-2.5 w-2.5 text-black dark:text-white" />
                    </span>
                    来源
                  </DropdownMenuItem>
                  <DropdownMenuItem text-value="命令" class="gap-2" @select="editorRef?.chain().focus().insertContent('/').run()">
                    <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-200/80 dark:bg-zinc-600/80">
                      <Slash class="h-2.5 w-2.5 text-black dark:text-white" />
                    </span>
                    命令
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger class="gap-2">
                      <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-200/80 dark:bg-zinc-600/80">
                        <Smile class="h-2.5 w-2.5 text-black dark:text-white" />
                      </span>
                      表情
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent class="max-h-52 overflow-auto p-2 w-auto" :side-offset="4">
                      <div class="grid grid-cols-8 gap-0">
                        <DropdownMenuItem
                          v-for="e in EMOJI_LIST"
                          :key="e"
                          class="justify-center p-1.5 rounded min-w-0 text-base cursor-pointer"
                          @select="insertEmoji(e)"
                        >
                          {{ e }}
                        </DropdownMenuItem>
                      </div>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem text-value="粗体" class="gap-2" @select="editorRef?.chain().focus().toggleBold().run()">
                    <Bold class="h-3 w-3" />
                    粗体
                  </DropdownMenuItem>
                  <DropdownMenuItem text-value="斜体" class="gap-2" @select="editorRef?.chain().focus().toggleItalic().run()">
                    <Italic class="h-3 w-3" />
                    斜体
                  </DropdownMenuItem>
                  <DropdownMenuItem text-value="代码" class="gap-2" @select="editorRef?.chain().focus().toggleCode().run()">
                    <Code class="h-3 w-3" />
                    代码
                  </DropdownMenuItem>
                  <DropdownMenuItem text-value="代码块" class="gap-2" @select="editorRef?.chain().focus().toggleCodeBlock().run()">
                    <Code class="h-3 w-3" />
                    代码块
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <template v-else>
                <button
                  type="button"
                  class="input-toolbar-chip relative flex h-6 items-center gap-1 rounded-lg border border-zinc-200/80 dark:border-zinc-600/80 bg-white/90 dark:bg-zinc-700/60 px-1 py-1 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-zinc-300 hover:bg-zinc-50 hover:shadow active:scale-[0.98] dark:border-zinc-600 dark:hover:border-zinc-500 dark:hover:bg-zinc-600/80"
                  title="@ 提及"
                  aria-label="@ 提及"
                  @click="editorRef?.chain().focus().insertContent('@').run()"
                >
                  <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-zinc-200/80 dark:bg-zinc-600/80 text-black dark:text-white">
                    <AtSign class="h-2 w-2" />
                  </span>
                  <span class="text-[10px] font-medium text-black dark:text-white">提及</span>
                </button>
                <button
                  type="button"
                  class="input-toolbar-chip relative flex h-6 items-center gap-1 rounded-lg border border-zinc-200/80 dark:border-zinc-600/80 bg-white/90 dark:bg-zinc-700/60 px-1 py-1 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-zinc-300 hover:bg-zinc-50 hover:shadow active:scale-[0.98] dark:border-zinc-600 dark:hover:border-zinc-500 dark:hover:bg-zinc-600/80"
                  title="# 来源"
                  aria-label="# 来源"
                  @click="editorRef?.chain().focus().insertContent('#').run()"
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
                  @click="editorRef?.chain().focus().insertContent('/').run()"
                >
                  <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-zinc-200/80 dark:bg-zinc-600/80 text-black dark:text-white">
                    <Slash class="h-2 w-2" />
                  </span>
                  <span class="text-[10px] font-medium text-black dark:text-white">命令</span>
                </button>
                <button
                  type="button"
                  class="input-toolbar-chip relative flex h-6 w-6 items-center justify-center rounded-lg border border-zinc-200/80 dark:border-zinc-600/80 bg-white/90 dark:bg-zinc-700/60 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-zinc-300 hover:bg-zinc-50 hover:shadow active:scale-[0.98] dark:border-zinc-600 dark:hover:border-zinc-500 dark:hover:bg-zinc-600/80"
                  title="粗体"
                  aria-label="粗体"
                  @click="editorRef?.chain().focus().toggleBold().run()"
                >
                  <Bold class="h-3 w-3 text-black dark:text-white" />
                </button>
                <button
                  type="button"
                  class="input-toolbar-chip relative flex h-6 w-6 items-center justify-center rounded-lg border border-zinc-200/80 dark:border-zinc-600/80 bg-white/90 dark:bg-zinc-700/60 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-zinc-300 hover:bg-zinc-50 hover:shadow active:scale-[0.98] dark:border-zinc-600 dark:hover:border-zinc-500 dark:hover:bg-zinc-600/80"
                  title="斜体"
                  aria-label="斜体"
                  @click="editorRef?.chain().focus().toggleItalic().run()"
                >
                  <Italic class="h-3 w-3 text-black dark:text-white" />
                </button>
                <button
                  type="button"
                  class="input-toolbar-chip relative flex h-6 w-6 items-center justify-center rounded-lg border border-zinc-200/80 dark:border-zinc-600/80 bg-white/90 dark:bg-zinc-700/60 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-zinc-300 hover:bg-zinc-50 hover:shadow active:scale-[0.98] dark:border-zinc-600 dark:hover:border-zinc-500 dark:hover:bg-zinc-600/80"
                  title="行内代码"
                  aria-label="行内代码"
                  @click="editorRef?.chain().focus().toggleCode().run()"
                >
                  <Code class="h-3 w-3 text-black dark:text-white" />
                </button>
              </template>
            </div>
            <div class="flex items-center gap-1">
              <span
                v-if="streaming"
                class="flex h-6 w-6 items-center justify-center text-zinc-400"
                aria-hidden
              >
                <Loader2 class="h-3.5 w-3.5 animate-spin" />
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  as-child
                >
                  <button
                    type="button"
                    class="relative flex h-6 w-8 shrink-0 flex-col items-center justify-center gap-0 rounded-lg text-black dark:text-white hover:text-black dark:hover:text-white hover:bg-white/50 dark:hover:bg-zinc-600/40"
                    title="表情"
                    aria-label="插入表情"
                  >
                    <Smile class="h-3.5 w-3.5 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" class="p-2 w-auto max-h-52 overflow-auto" :side-offset="4">
                  <div class="grid grid-cols-8 gap-0">
                    <DropdownMenuItem
                      v-for="e in EMOJI_LIST"
                      :key="e"
                      class="justify-center p-1.5 rounded min-w-0 text-base cursor-pointer"
                      @select="insertEmoji(e)"
                    >
                      {{ e }}
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
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
                :class="canSubmit ? 'send-btn-ready' : ''"
              >
                <button
                  type="submit"
                  class="send-btn-inner group relative flex h-6 min-w-8 items-center justify-center gap-0.5 rounded-[calc(0.5rem-1px)] pl-1 pr-1.5 transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50"
                  :class="canSubmit ? 'text-black dark:text-white bg-white dark:bg-zinc-800 shadow-md ring-1 ring-primary-200/50 dark:ring-primary-400/25 hover:bg-zinc-50 dark:hover:bg-zinc-700' : 'text-black dark:text-white bg-white dark:bg-zinc-800 hover:text-black dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700'"
                  :disabled="!canSubmit"
                  :aria-label="editingMessageId ? '保存' : '发送'"
                >
                  <span class="flex shrink-0 pl-0.5 transition-transform duration-200 group-hover:-rotate-90">
                    <SendHorizontal class="h-3 w-3" />
                  </span>
                  <span class="text-[10px] font-medium">{{ editingMessageId ? '保存' : '发送' }}</span>
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
import { AtSign, Bold, ChevronDown, Code, GripHorizontal, Hash, Italic, Loader2, SendHorizontal, Slash, Smile, Square, X } from 'lucide-vue-next'
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useBreakpoint } from '~/composables/useBreakpoint'
import { useContactsAndBots } from '~/composables/useContactsAndBots'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import type { Editor } from '@tiptap/vue-3'
import { ChatEnterSubmit } from '~/extensions/chatEnterSubmit'

const props = defineProps<{
  modelValue: string
  streaming: boolean
  /** 当前回复的目标消息，有则显示引用预览 */
  replyTarget?: { id: string; role: string; content: string } | null
  /** 正在编辑的消息 id，有则显示「正在编辑」条与「保存」按钮 */
  editingMessageId?: string | null
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
  (e: 'stop'): void
  (e: 'clear'): void
  (e: 'scroll-to-last'): void
  (e: 'add-participant'): void
  (e: 'cancel-reply'): void
  (e: 'cancel-edit'): void
  /** 输入区整体高度变化时发出（px），供父组件抬高滚动区底部 */
  (e: 'input-area-height', heightPx: number): void
}>()

const isXxs = useBreakpoint('xxs')
const { contacts, bots, getMentionedBotIdsFromText } = useContactsAndBots()

/** 常用表情列表，供插入到输入框 */
const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😜', '🤪', '😝',
  '👍', '👎', '👏', '🙌', '🤝', '🙏', '✌️', '🤞', '🤟', '👌', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💞',
  '💓', '💗', '💖', '💘', '💝', '🔥', '✨', '⭐', '🌟', '💫', '✅', '❌', '❓', '❗', '💬', '🎉', '🎊', '🙈', '🙉', '🙊',
]

function insertEmoji(emoji: string) {
  editorRef.value?.chain().focus().insertContent(emoji).run()
}

/** 输入中是否 @ 了机器人（支持纯文本 @名称 与指令块 [@id="..." label="..."]） */
const showAssistantToolbar = computed(() =>
  getMentionedBotIdsFromText(props.modelValue).length > 0
)

/**
 * 是否可提交：初次加载或内容全删时视为空。
 * 去除：普通空白、Unicode 空白（含 \u00A0）、零宽字符、字面量 HTML 实体（&nbsp; &#160; 等）。
 */
function isContentEmpty(value: string | undefined | null): boolean {
  if (value == null || value === '') return true
  let s = value
  // 字面量实体（富文本序列化可能输出为文本）
  s = s.replace(/&nbsp;|&#160;|&#x0?0?A0;/gi, '')
  // 所有 Unicode 空白（含不换行空格 \u00A0、全角空格等）
  s = s.replace(/\p{White_Space}/gu, '')
  // 零宽字符（不在 White_Space 中）
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '')
  return s.length === 0
}
const canSubmit = computed(() => !isContentEmpty(props.modelValue))

/** 编辑器内容变更时，若等效为空则同步为 ''，避免残留 &nbsp; 等导致发送按钮仍可点 */
function onEditorUpdate(value: string) {
  emit('update:modelValue', isContentEmpty(value) ? '' : value)
}

/** @ 提及菜单挂载到 body，悬浮显示、不占文档流（SSR 安全） */
const mentionMenuAppendTo = () => (typeof document !== 'undefined' ? document.body : undefined)

/** UEditor Mention 菜单项：联系人 + 机器人，格式为 Nuxt UI EditorMentionMenuItem */
const mentionMenuItems = computed(() => {
  const fromContacts = contacts.value.map((c) => ({ label: c.name, id: c.id }))
  const fromBots = bots.map((b) => ({ label: b.name, id: b.id }))
  return [...fromContacts, ...fromBots]
})

/** Enter 提交、Shift+Enter 换行的 TipTap 扩展 */
const chatEnterExtensions = [ChatEnterSubmit.configure({ onSubmit: () => emit('submit') })]

/** 最小高度抬高一倍后再调低 1/4：144 → 108 */
const MIN_EDIT_HEIGHT = 108
const MAX_EDIT_HEIGHT = 420
const DEFAULT_EDIT_HEIGHT = 108

const editorWrapRef = ref<HTMLElement | null>(null)
/** 从 UEditor slot 同步的 editor 实例，供底部工具栏使用 */
const editorRef = ref<Editor | null>(null)
function setEditorRef(e: Editor | null) {
  editorRef.value = e
}
const editHeightPx = ref(DEFAULT_EDIT_HEIGHT)
const inputPanelRootRef = ref<HTMLElement | null>(null)
const inputFormRef = ref<HTMLFormElement | null>(null)

function onFormSubmit() {
  emit('submit')
}

function reportInputAreaHeight() {
  const root = inputPanelRootRef.value
  const form = inputFormRef.value
  if (!root || !form) return
  const rootRect = root.getBoundingClientRect()
  const formRect = form.getBoundingClientRect()
  const heightFromBottomToFormTop = rootRect.bottom - formRect.top
  if (heightFromBottomToFormTop > 0) {
    emit('input-area-height', Math.round(heightFromBottomToFormTop))
  }
}

onMounted(() => {
  const el = inputPanelRootRef.value
  if (!el) return
  const ro = new ResizeObserver(() => {
    nextTick(reportInputAreaHeight)
  })
  ro.observe(el)
  nextTick(reportInputAreaHeight)
  onUnmounted(() => ro.disconnect())
})

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
/* 输入框文字随「界面字体大小」设置缩放 */
.chat-input-text-scale {
  font-size: calc(1rem * var(--chat-text-scale, 1));
}

/* 输入区：左右与上 padding 一致（0.75rem），下无 padding */
.chat-input-editor {
  padding-left: 0.75rem;
  padding-right: 0.75rem;
  padding-top: 0.75rem;
  padding-bottom: 0;
}
.chat-input-editor :deep(.ProseMirror) {
  padding-left: 0;
  padding-right: 0;
}

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
  border-radius: 2px;
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
