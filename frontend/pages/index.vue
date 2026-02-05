<template>
  <div class="h-full flex flex-col">
    <div ref="scrollRef" class="flex-1 overflow-y-auto p-4 space-y-4">
      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="flex"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <ChatMessageBubble :message="msg" :streaming="msg.role === 'assistant' && i === messages.length - 1 && streaming" />
      </div>
    </div>
    <div class="shrink-0 border-t border-zinc-800 p-4">
      <form @submit.prevent="send" class="flex gap-2">
        <input
          v-model="input"
          type="text"
          placeholder="输入问题或指令…"
          class="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          :disabled="streaming"
        />
        <button
          type="submit"
          class="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          :disabled="streaming || !input.trim()"
        >
          发送
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const scrollRef = ref<HTMLElement | null>(null)
const input = ref('')
const streaming = ref(false)
const messages = ref<Array<{ role: 'user' | 'assistant'; content: string; thinking?: string }>>([])

const { streamChat } = useChatStream()

async function send() {
  const text = input.value.trim()
  if (!text || streaming.value) return
  input.value = ''
  messages.value.push({ role: 'user', content: text })
  messages.value.push({ role: 'assistant', content: '', thinking: '' })
  streaming.value = true
  const idx = messages.value.length - 1
  const placeholder = '思考中…'
  try {
    await streamChat(
      text,
      (delta) => {
        const current = messages.value[idx].content
        if (current === placeholder) messages.value[idx].content = delta
        else messages.value[idx].content += delta
      },
      {
        onThinking: () => { messages.value[idx].content = placeholder },
        onThinkingDelta: (delta) => {
          if (!messages.value[idx].thinking) messages.value[idx].thinking = ''
          messages.value[idx].thinking += delta
        },
        onThinkingDone: (fullText) => {
          if (fullText) messages.value[idx].thinking = fullText
        },
      }
    )
    if (!messages.value[idx].content) {
      messages.value[idx].content = '（未收到任何内容，请检查中间层与 CORS 配置）'
    }
  } catch (e) {
    messages.value[idx].content = `请求失败：${e instanceof Error ? e.message : String(e)}`
  } finally {
    streaming.value = false
  }
  nextTick(() => scrollRef.value?.scrollTo({ top: scrollRef.value.scrollHeight, behavior: 'smooth' }))
}
</script>
