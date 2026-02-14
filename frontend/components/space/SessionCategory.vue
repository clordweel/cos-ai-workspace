<template>
  <section
    class="session-category shrink-0 border-b border-zinc-100 dark:border-zinc-700/80 rounded-r-md"
    :class="accent ? 'bg-amber-50/60 dark:bg-amber-950/20 border-l-2 border-l-amber-400/70 dark:border-l-amber-500/50' : ''"
  >
    <button
      type="button"
      class="session-category-header flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium rounded-r-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
      :class="accent ? 'text-amber-800 dark:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 focus-visible:ring-amber-400/40' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:ring-zinc-400/40'"
      @click="emit('update:collapsed', !collapsed)"
    >
      <component
        :is="collapsed ? ChevronRight : ChevronDown"
        class="h-3.5 w-3.5 shrink-0"
        :class="accent ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400'"
      />
      <Pin
        v-if="accent"
        class="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
      />
      <span class="flex-1">{{ title }}</span>
      <span
        v-if="count !== undefined && count > 0"
        class="shrink-0 min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-md text-[11px] font-semibold tabular-nums"
        :class="accent ? 'bg-amber-200/80 dark:bg-amber-700/50 text-amber-800 dark:text-amber-200' : 'bg-zinc-200/80 dark:bg-zinc-700/50 text-zinc-700 dark:text-zinc-300'"
      >
        {{ count }}
      </span>
    </button>
    <ul
      v-show="!collapsed"
      class="divide-y"
      :class="accent ? 'divide-amber-100 dark:divide-amber-900/40' : 'divide-zinc-100 dark:divide-zinc-700'"
    >
      <slot />
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ChevronDown, ChevronRight, Pin } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    title: string
    count?: number
    collapsed: boolean
    /** 置顶/Mock 等强调样式（amber） */
    accent?: boolean
  }>(),
  { accent: false }
)

const emit = defineEmits<{
  'update:collapsed': [value: boolean]
}>()
</script>
