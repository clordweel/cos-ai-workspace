<template>
  <div class="flex-1 flex flex-col items-center justify-center min-h-0">
    <Empty
      title="还没有会话"
      :description="createSessionError || '在左侧选择已有会话，或点击下方按钮开始新对话'"
      :icon="MessageCircle"
    >
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3.5 py-2 text-xs font-medium text-black dark:text-white shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-600 hover:shadow transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        :disabled="creatingSession"
        @click="$emit('new-chat')"
      >
        <Plus v-if="!creatingSession" class="h-3.5 w-3.5" stroke-width="2.25" />
        <span v-else class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        新会话
      </button>
    </Empty>
  </div>
</template>

<script setup lang="ts">
import { Empty } from '~/components/ui/empty'
import { MessageCircle, Plus } from 'lucide-vue-next'

defineProps<{
  creatingSession?: boolean
  createSessionError?: string | null
}>()
defineEmits<{ (e: 'new-chat'): void }>()
</script>
