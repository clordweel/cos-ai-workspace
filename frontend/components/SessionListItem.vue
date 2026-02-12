<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <li
        role="button"
        tabindex="0"
        class="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:ring-offset-2 rounded-none"
        :class="[
          isActive ? 'bg-primary-50 dark:bg-primary-900/30 text-black dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 active:bg-zinc-100 dark:active:bg-zinc-700 text-black dark:text-white',
          isMock ? 'opacity-80' : '',
        ]"
        @click="$emit('click')"
        @keydown.enter.prevent="$emit('click')"
      >
        <SessionListThumb :type="thumbType" :participants="effectiveParticipants" />
        <p class="min-w-0 flex-1 text-xs font-medium text-inherit truncate">
          {{ item.title }}
        </p>
        <span v-if="dateLabel" class="shrink-0 text-[11px] text-inherit opacity-80">
          {{ dateLabel }}
        </span>
        <span class="text-inherit opacity-70 text-xs">›</span>
      </li>
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        class="z-[100] min-w-[140px] rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-1 shadow-lg"
        :side-offset="4"
      >
        <ContextMenuItem
          v-if="isPinned"
          class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
          text-value="取消置顶"
          @select="emit('toggle-pin')"
        >
          <PinOff class="h-3.5 w-3.5 shrink-0 opacity-70" />
          取消置顶
        </ContextMenuItem>
        <ContextMenuItem
          v-else
          class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
          text-value="置顶"
          @select="emit('toggle-pin')"
        >
          <Pin class="h-3.5 w-3.5 shrink-0 opacity-70" />
          置顶
        </ContextMenuItem>
        <ContextMenuItem
          class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
          text-value="重命名"
          @select="emit('rename')"
        >
          <Pencil class="h-3.5 w-3.5 shrink-0 opacity-70" />
          重命名
        </ContextMenuItem>
        <ContextMenuItem
          class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 outline-none hover:bg-red-50 dark:hover:bg-red-900/30"
          text-value="删除会话"
          @select="emit('delete')"
        >
          <Trash2 class="h-3.5 w-3.5 shrink-0 opacity-70" />
          删除会话
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
} from 'radix-vue'
import { Pencil, Pin, PinOff, Trash2 } from 'lucide-vue-next'
import type { SessionParticipant } from '~/components/SessionListThumb.vue'

export type SessionListItemType = {
  id: string
  title: string
  type?: 'private' | 'group'
  updatedAt?: number
  /** 会话对象列表，用于缩略图：一对一为对方，一对多为成员（按排序取前四） */
  participants?: SessionParticipant[]
}

const props = defineProps<{
  item: SessionListItemType
  isActive: boolean
  isMock: boolean
  /** 是否已置顶 */
  isPinned?: boolean
  dateLabel?: string
}>()
const emit = defineEmits<{
  (e: 'click'): void
  (e: 'toggle-pin'): void
  (e: 'rename'): void
  (e: 'delete'): void
}>()

const thumbType = computed(() => props.item.type === 'group' ? 'group' : 'private')

const effectiveParticipants = computed((): SessionParticipant[] => {
  const { item } = props
  const list = item.participants
  if (item.type === 'group') return list ?? []
  if (list?.length) return list
  return [{ name: item.title }]
})
</script>
