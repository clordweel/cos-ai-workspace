<template>
  <Transition name="fade">
    <div
      v-show="open"
      class="app-drawer absolute left-0 right-0 z-20 flex w-full shrink-0 flex-col border-b border-zinc-200/60 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800 shadow-lg isolate"
      :style="{ top: 0, height: `${heightRem}rem` }"
    >
      <div class="app-drawer-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pl-8 pr-7 pt-3 pb-8">
        <div class="mb-3 flex flex-col items-center gap-0">
          <Logo :size="22" class="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
          <span class="text-[10px] text-zinc-600 dark:text-zinc-400">由 COS AI 驱动</span>
        </div>
        <div
          class="grid auto-rows-[minmax(3.5rem,auto)] gap-1.5"
          :style="{ gridTemplateColumns: 'repeat(auto-fill, minmax(3.5rem, 1fr))' }"
        >
          <button
            v-for="app in apps"
            :key="app.id"
            type="button"
            class="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors"
            :class="isActive(app) ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''"
            @click="emit('select', app)"
          >
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-black dark:text-white bg-white dark:bg-zinc-700"
              :class="isActive(app) ? 'ring-2 ring-primary-500/50' : ''"
            >
              <component :is="app.icon" class="h-4 w-4" />
            </span>
            <span class="min-w-0 max-w-[3.25rem] truncate text-[10px]">{{ app.title }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import Logo from '~/components/Logo.vue'

export interface DrawerAppItem {
  id: string
  title: string
  icon: Component
  view?: string
  appId?: string
}

defineProps<{
  open: boolean
  heightRem: number
  apps: DrawerAppItem[]
  isActive: (app: DrawerAppItem) => boolean
}>()

const emit = defineEmits<{
  select: [app: DrawerAppItem]
}>()
</script>

<style scoped>
.app-drawer-scroll {
  scrollbar-width: none;
}
.app-drawer-scroll::-webkit-scrollbar {
  display: none;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
