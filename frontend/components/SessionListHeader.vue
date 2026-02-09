<template>
  <header
    class="session-list-header h-12 shrink-0 flex items-center justify-between gap-1 border-b border-zinc-200/60 dark:border-zinc-700/60 backdrop-blur-md bg-white/75 dark:bg-zinc-800/75 px-2"
    role="banner"
    aria-label="会话列表"
  >
    <!-- 展开时折叠按钮移至抽屉左上角，顶栏此处隐藏 -->
    <button
      v-if="!appDrawerOpen"
      type="button"
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-black dark:hover:text-white transition-colors"
      title="应用"
      aria-label="应用"
      @click="$emit('app')"
    >
      <ChevronDown class="h-4 w-4" />
    </button>
    <div class="flex min-w-0 flex-1 items-center justify-end gap-1">
      <SessionSearchBar
        :open="searchBarOpen"
        :model-value="searchQuery"
        @update:model-value="$emit('update:searchQuery', $event)"
        @toggle="$emit('search')"
      />
      <button
        type="button"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-black dark:hover:text-white transition-colors"
        title="新会话"
        aria-label="新会话"
        @click="$emit('new-chat')"
      >
        <MessageSquarePlus class="h-4 w-4" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ChevronDown, MessageSquarePlus } from 'lucide-vue-next'

defineProps<{
  appDrawerOpen?: boolean
  searchBarOpen?: boolean
  searchQuery?: string
}>()

defineEmits<{
  'new-chat': []
  search: []
  app: []
  'update:searchQuery': [value: string]
}>()
</script>
