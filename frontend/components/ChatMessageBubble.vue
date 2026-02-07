<template>
  <div
    class="max-w-[85%] rounded-xl px-4 py-2.5"
    :class="
      message.role === 'user'
        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100'
        : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-600'
   "
  >
    <!-- 仿 Gemini：可折叠的 <think> 思考块，仅助手消息且思考内容非空时展示 -->
    <div
      v-if="message.role === 'assistant' && message.thinking != null && message.thinking.trim()"
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
        class="mt-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap break-words border border-zinc-200 dark:border-zinc-600"
      >
        {{ message.thinking }}
      </div>
    </div>
    <p class="whitespace-pre-wrap break-words">
      {{ message.content }}
      <span v-if="streaming" class="inline-block w-2 h-4 ml-0.5 bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message: { role: string; content: string; thinking?: string }
  streaming?: boolean
}>()
const thinkingOpen = ref(false)
</script>
