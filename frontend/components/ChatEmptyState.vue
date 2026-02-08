<template>
  <div class="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
    <div class="flex flex-col items-center gap-3">
      <div class="rounded-2xl bg-zinc-100 dark:bg-zinc-800 p-5 text-zinc-400 dark:text-zinc-500">
        <MessageCircle class="h-12 w-12" stroke-width="1.5" />
      </div>
      <div class="space-y-1">
        <p class="text-base font-medium text-zinc-700 dark:text-zinc-300">还没有会话</p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 max-w-[240px]">在左侧选择已有会话，或点击下方按钮开始新对话</p>
      </div>
    </div>
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3.5 py-2 text-xs font-medium text-black dark:text-white shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-600 hover:shadow transition-colors duration-200"
      @click="$emit('new-chat')"
    >
      <Plus class="h-3.5 w-3.5" stroke-width="2.25" />
      新会话
    </button>
  </div>
</template>

<script setup lang="ts">
import { MessageCircle, Plus } from 'lucide-vue-next'

defineEmits<{ (e: 'new-chat'): void }>()
</script>
