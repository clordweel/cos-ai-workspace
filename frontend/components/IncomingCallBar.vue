<template>
  <Transition name="incoming-call-slide">
    <div
      v-if="call"
      class="fixed left-0 right-0 top-14 z-50 flex items-center justify-between gap-4 px-4 py-3 shadow-lg border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
      role="alert"
      aria-live="assertive"
    >
      <div class="flex items-center gap-3 min-w-0">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" aria-hidden="true">
          <Phone class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
            {{ callerLabel }}
          </p>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            正在呼叫你…
          </p>
        </div>
      </div>
      <div class="flex shrink-0 gap-2">
        <Button
          variant="destructive"
          size="sm"
          aria-label="拒绝来电"
          @click="reject"
        >
          拒绝
        </Button>
        <Button
          variant="default"
          size="sm"
          aria-label="接听来电"
          :disabled="answering"
          @click="answer"
        >
          {{ answering ? '接听中…' : '接听' }}
        </Button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Phone } from 'lucide-vue-next'
import Button from '~/components/ui/button/Button.vue'

const { incomingCall, answerIncomingCall, rejectIncomingCall } = useMatrixSyncClient()

const call = computed(() => incomingCall.value)

const callerLabel = computed(() => {
  const c = call.value
  if (!c) return '来电'
  const member = c.getOpponentMember?.()
  const name = member?.name?.trim()
  if (name) return name
  const uid = member?.userId ?? c.roomId
  if (uid) {
    const local = typeof uid === 'string' && uid.includes(':') ? uid.slice(0, uid.indexOf(':')) : uid
    return local || '对方'
  }
  return '对方'
})

const answering = ref(false)

async function answer() {
  const c = call.value
  if (!c) return
  answering.value = true
  try {
    await answerIncomingCall(c)
  } finally {
    answering.value = false
  }
}

function reject() {
  const c = call.value
  if (!c) return
  rejectIncomingCall(c)
}
</script>

<style scoped>
.incoming-call-slide-enter-active,
.incoming-call-slide-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.incoming-call-slide-enter-from,
.incoming-call-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
