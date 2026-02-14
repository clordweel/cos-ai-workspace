<template>
  <Transition name="fade">
    <div
      v-show="open"
      class="app-drawer z-20 flex w-full shrink-0 flex-col border-b border-zinc-200/60 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800 shadow-lg isolate relative overflow-hidden"
      :class="fillParent ? 'absolute inset-0' : 'absolute left-0 right-0'"
      :style="drawerRootStyle"
    >
      <!-- 左上射出的渐变色带（仅装饰） -->
      <div
        class="drawer-gradient-band absolute left-0 top-0 z-0 h-full w-full pointer-events-none dark:[filter:brightness(0.26)]"
        aria-hidden="true"
      />
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
      <div class="app-drawer-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pl-4 pr-4 pt-2 pb-8 relative z-10">
        <!-- 用户信息入口：点击打开个人信息应用 -->
        <button
          type="button"
          class="drawer-user-block mb-4 w-full flex items-center gap-3 rounded-xl border border-zinc-200/60 dark:border-zinc-500/50 bg-white/60 dark:bg-zinc-700/50 backdrop-blur-md px-3 py-2.5 text-left hover:bg-white/80 dark:hover:bg-zinc-700/70 hover:border-zinc-300 dark:hover:border-zinc-500 transition-colors cursor-pointer"
          @click="emit('select', profileAppItem)"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200/80 dark:border-zinc-500/80 bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300"
          >
            <img
              v-if="userAvatarUrl"
              :src="userAvatarUrl"
              :alt="userName || '用户'"
              class="h-full w-full object-cover"
            />
            <span v-else-if="userName" class="text-sm font-semibold">{{ userFirstChar }}</span>
            <User v-else class="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium mt-1 text-zinc-800 dark:text-zinc-200 leading-none">
              {{ userName || '未登录' }}
            </p>
            <p class="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-1 mb-0.5 leading-none" :title="userEmail || undefined">
              {{ isAuthenticated ? (userEmail || '已登录') : '点击登录以使用更多功能' }}
            </p>
          </div>
        </button>
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
const userEmail = computed(() => {
  const u = user.value
  if (u && typeof u === 'object' && 'email' in u && typeof (u as { email?: string }).email === 'string')
    return (u as { email: string }).email
  return ''
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

/** 抽屉顶部用户卡片点击时发出，用于打开个人信息视图 */
const profileAppItem: DrawerAppItem = {
  id: 'profile',
  title: '用户信息',
  icon: User,
  view: 'profile',
}

const props = withDefaults(
  defineProps<{
    open: boolean
    /** 为 true 时填满父容器（用于「推动下移」布局） */
    fillParent?: boolean
    /** 为 true 时按内容高度自适应，由父级用 ResizeObserver 测量后设外层高度 */
    autoHeight?: boolean
    /** 抽屉定位 top，非 fillParent 时有效 */
    top?: string
    heightRem: number
    commonApps: DrawerAppItem[]
    favoriteApps: DrawerAppItem[]
    isActive: (app: DrawerAppItem) => boolean
  }>(),
  { fillParent: false, autoHeight: false, top: '0' },
)

const drawerRootStyle = computed(() => {
  if (props.fillParent) return undefined
  if (props.autoHeight) return { top: props.top, height: 'auto', maxHeight: '80vh' }
  return { top: props.top, height: `${props.heightRem}rem` }
})

const emit = defineEmits<{
  select: [app: DrawerAppItem]
  close: []
  more: []
}>()
</script>

<style scoped>
/* 左上到右下的线束：清晰光带，无晕开，约 135° 对角线 */
.drawer-gradient-band {
  background:
    linear-gradient(132deg, transparent 0%, transparent 18%, color-mix(in srgb, white 35%, transparent) 22%, color-mix(in srgb, white 12%, transparent) 28%, transparent 32%, transparent 100%),
    linear-gradient(128deg, transparent 0%, transparent 8%, color-mix(in srgb, #c7d2fe 28%, transparent) 12%, color-mix(in srgb, #a5b4fc 8%, transparent) 20%, transparent 24%, transparent 100%),
    linear-gradient(136deg, transparent 0%, transparent 25%, color-mix(in srgb, #bfdbfe 24%, transparent) 29%, color-mix(in srgb, #93c5fd 6%, transparent) 35%, transparent 39%, transparent 100%),
    linear-gradient(124deg, transparent 0%, transparent 42%, color-mix(in srgb, #e9d5ff 18%, transparent) 46%, transparent 52%, transparent 100%);
}
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
