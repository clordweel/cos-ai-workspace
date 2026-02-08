<template>
  <li
    role="button"
    tabindex="0"
    class="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:ring-offset-2 rounded-md"
    :class="[
      isActive ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 active:bg-zinc-100 dark:active:bg-zinc-700',
      isMock ? 'opacity-80' : '',
    ]"
    @click="$emit('click')"
    @keydown.enter.prevent="$emit('click')"
  >
    <SessionListThumb :type="thumbType" :participants="effectiveParticipants" />
    <p class="min-w-0 flex-1 text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
      {{ item.title }}
    </p>
    <span v-if="dateLabel" class="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">
      {{ dateLabel }}
    </span>
    <span class="text-zinc-400 dark:text-zinc-500 text-xs">›</span>
  </li>
</template>

<script setup lang="ts">
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
  dateLabel?: string
}>()
defineEmits<{ (e: 'click'): void }>()

const thumbType = computed(() => props.item.type === 'group' ? 'group' : 'private')

const effectiveParticipants = computed((): SessionParticipant[] => {
  const { item } = props
  const list = item.participants
  if (item.type === 'group') return list ?? []
  if (list?.length) return list
  return [{ name: item.title }]
})
</script>
