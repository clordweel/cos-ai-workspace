<template>
  <Transition name="fade">
    <div
      v-show="open"
      class="app-drawer absolute left-0 right-0 z-20 flex w-full shrink-0 flex-col border-b border-zinc-200/60 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800 shadow-lg isolate relative"
      :style="{ top: 0, height: `${heightRem}rem` }"
    >
      <!-- 顶部栏：左侧折叠按钮，右侧应用列表说明标题 -->
      <div class="shrink-0 flex items-center justify-between pl-2 pr-4 pt-2 pb-0 relative z-10">
        <button
          type="button"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          title="收起应用"
          aria-label="收起应用"
          @click="emit('close')"
        >
          <ChevronUp class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 rounded-md px-2 py-1 transition-colors"
          title="全部应用"
          @click="emit('more')"
        >
          更多
          <ChevronRight class="h-3.5 w-3.5 shrink-0" />
        </button>
      </div>
      <div class="app-drawer-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pl-6 pr-4 pt-0 pb-8 relative z-10">
        <!-- 用户信息区块 -->
        <div class="mb-1 flex items-center gap-2.5 px-1 py-1">
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200/80 dark:border-zinc-500/80 bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300"
          >
            <img
              v-if="userAvatarUrl"
              :src="userAvatarUrl"
              :alt="userName || '用户'"
              class="h-full w-full object-cover"
            />
            <span v-else-if="userName" class="text-sm font-medium">{{ userFirstChar }}</span>
            <User v-else class="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
              {{ userName || '未登录' }}
            </p>
            <p class="text-[10px] text-zinc-500 dark:text-zinc-400">
              {{ isAuthenticated ? '已登录' : '点击登录以使用更多功能' }}
            </p>
          </div>
        </div>
        <!-- 常用 -->
        <div class="mb-1">
          <p class="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 px-0.5">常用</p>
          <div
            class="grid auto-rows-[minmax(3.5rem,auto)] gap-x-1.5 gap-y-0"
            :style="{ gridTemplateColumns: 'repeat(auto-fill, minmax(3.5rem, 1fr))' }"
          >
            <button
              v-for="app in commonApps"
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
        <!-- 收藏 -->
        <div>
          <p class="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 px-0.5">收藏</p>
          <div
            class="grid auto-rows-[minmax(3.5rem,auto)] gap-x-1.5 gap-y-0"
            :style="{ gridTemplateColumns: 'repeat(auto-fill, minmax(3.5rem, 1fr))' }"
          >
            <button
              v-for="app in favoriteApps"
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
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'
import { ChevronRight, ChevronUp, User } from 'lucide-vue-next'
import { useAuth } from '~/composables/useAuth'

const { user, isAuthenticated } = useAuth()
const userName = computed(() => {
  const u = user.value
  if (typeof u === 'string') return u
  if (u && typeof u === 'object' && 'name' in u && typeof (u as { name?: string }).name === 'string')
    return (u as { name: string }).name
  return null
})
const userAvatarUrl = computed(() => {
  const u = user.value
  if (u && typeof u === 'object' && 'avatar' in u && typeof (u as { avatar?: string }).avatar === 'string')
    return (u as { avatar: string }).avatar
  return ''
})
const userFirstChar = computed(() => {
  const name = userName.value
  if (!name || !name.trim()) return '?'
  return name.trim().charAt(0).toUpperCase()
})

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
  commonApps: DrawerAppItem[]
  favoriteApps: DrawerAppItem[]
  isActive: (app: DrawerAppItem) => boolean
}>()

const emit = defineEmits<{
  select: [app: DrawerAppItem]
  close: []
  more: []
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
