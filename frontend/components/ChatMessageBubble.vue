<template>
  <div
    class="max-w-[85%] rounded-xl px-4 py-2.5"
    :class="
      message.role === 'user'
        ? 'bg-emerald-100 text-emerald-900'
        : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
   "
  >
    <!-- 仿 Gemini：可折叠的 <think> 思考块，仅助手消息且思考内容非空时展示 -->
    <div
      v-if="message.role === 'assistant' && message.thinking != null && message.thinking.trim()"
      class="mb-3"
    >
      <button
        type="button"
        class="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-700"
        @click="thinkingOpen = !thinkingOpen"
      >
        <span class="transition-transform" :class="thinkingOpen ? 'rotate-90' : ''">▶</span>
        <span>思考过程</span>
      </button>
      <div
        v-show="thinkingOpen"
        class="mt-1.5 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 whitespace-pre-wrap break-words border border-zinc-200"
      >
        {{ message.thinking }}
      </div>
    </div>
    <p class="whitespace-pre-wrap break-words">
      {{ message.content }}
      <span v-if="streaming" class="inline-block w-2 h-4 ml-0.5 bg-emerald-500 animate-pulse" />
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
