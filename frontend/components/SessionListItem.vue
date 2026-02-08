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
    <span
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300"
      :class="item.type === 'group' ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-zinc-200 dark:bg-zinc-600'"
    >
      <User v-if="item.type === 'private'" class="h-4 w-4" />
      <Users v-else-if="item.type === 'group'" class="h-4 w-4" />
      <span v-else class="text-xs font-medium">{{ item.title.charAt(0) }}</span>
    </span>
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
import { User, Users } from 'lucide-vue-next'

export type SessionListItemType = { id: string; title: string; type?: 'private' | 'group'; updatedAt?: number }

defineProps<{
  item: SessionListItemType
  isActive: boolean
  isMock: boolean
  dateLabel?: string
}>()
defineEmits<{ (e: 'click'): void }>()
</script>
