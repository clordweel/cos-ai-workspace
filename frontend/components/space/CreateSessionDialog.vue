<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-show="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        aria-modal="true"
        role="dialog"
        aria-labelledby="create-session-title"
        @keydown.escape="onClose"
      >
        <div
          class="absolute inset-0 bg-black/50 dark:bg-black/60"
          @click="onClose"
        />
        <div
          class="relative w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-xl"
          @click.stop
        >
          <div class="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-600 px-4 py-3">
            <h2 id="create-session-title" class="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              新会话
            </h2>
            <button
              type="button"
              class="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200"
              aria-label="关闭"
              @click="onClose"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
          <div class="max-h-[min(60vh,320px)] overflow-y-auto p-2">
            <p v-if="createSessionError" class="px-2 py-1.5 text-xs text-red-600 dark:text-red-400">
              {{ createSessionError }}
            </p>
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors disabled:opacity-60"
              :disabled="creatingSession"
              @click="emit('select-solo')"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300"
              >
                <User class="h-4 w-4" />
              </span>
              <div class="min-w-0 flex-1">
                <span class="text-sm font-medium text-zinc-800 dark:text-zinc-200">Solo 模式</span>
                <p class="text-xs text-zinc-500 dark:text-zinc-400">仅自己，不邀请他人</p>
              </div>
              <span v-if="creatingSession" class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </button>
            <div class="my-1.5 border-t border-zinc-100 dark:border-zinc-700" />
            <p class="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400">选择对话人</p>
            <button
              v-for="c in contacts"
              :key="c.id"
              type="button"
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors disabled:opacity-60"
              :disabled="creatingSession"
              @click="emit('select-contact', c)"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-600 text-black dark:text-white text-sm font-medium"
              >
                {{ c.name?.charAt(0) ?? '?' }}
              </span>
              <span class="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {{ c.name }}
              </span>
              <span v-if="creatingSession" class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </button>
            <p v-if="contacts.length === 0" class="px-3 py-4 text-xs text-zinc-500 dark:text-zinc-400">
              暂无联系人
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { X, User } from 'lucide-vue-next'
import type { Contact } from '~/composables/useContactsAndBots'

defineProps<{
  open: boolean
  contacts: Contact[]
  creatingSession?: boolean
  createSessionError?: string | null
}>()

const emit = defineEmits<{
  close: []
  'select-solo': []
  'select-contact': [contact: Contact]
}>()

function onClose() {
  emit('close')
}
</script>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.15s ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
.dialog-enter-active .relative,
.dialog-leave-active .relative {
  transition: transform 0.15s ease;
}
.dialog-enter-from .relative,
.dialog-leave-to .relative {
  transform: scale(0.98);
}
</style>
