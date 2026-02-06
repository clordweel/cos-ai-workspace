<template>
  <header
    class="shrink-0 flex items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2"
    role="banner"
    aria-label="会话列表"
  >
    <div class="flex items-center gap-2 min-w-0">
      <Logo class="h-7 w-7 shrink-0 text-zinc-800 dark:text-zinc-100" />
      <h1 class="m-0 text-xs font-semibold leading-none tracking-tight text-zinc-800 dark:text-zinc-200 truncate">AI COS 工作台</h1>
    </div>
    <div class="flex items-center gap-1 shrink-0">
    <button
      type="button"
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
      title="新会话"
      aria-label="新会话"
      @click="$emit('newChat')"
    >
      <Plus class="h-4 w-4" />
    </button>
    <button
      type="button"
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
      title="搜索"
      aria-label="搜索"
      @click="$emit('search')"
    >
      <Search class="h-4 w-4" />
    </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Plus, Search } from 'lucide-vue-next'

defineEmits<{
  newChat: []
  search: []
}>()
</script>
