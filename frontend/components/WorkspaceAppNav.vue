<template>
  <nav
    class="relative z-10 flex flex-col shrink-0 min-h-0 overflow-visible rounded-l-lg pt-1 pb-1 nav-width-transition"
    :class="[
      showExpanded ? 'w-44' : 'w-12',
      labelsVisible && 'labels-visible'
    ]"
    aria-label="应用"
    @mouseenter="scheduleSidebarExpand()"
    @mouseleave="scheduleSidebarLeave()"
  >
    <!-- 设置：置于导航列表上方 -->
    <div class="shrink-0 flex flex-col gap-px px-1 pb-0.5">
      <button
        type="button"
        class="nav-item"
        :class="[
          layoutExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0',
          currentView === 'settings' && 'nav-item-active',
        ]"
        title="系统设置"
        aria-label="系统设置"
        @click="openApp('settings')"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
          :class="currentView === 'settings' ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400' : 'bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300'"
        >
          <Settings class="h-3.5 w-3.5" />
        </span>
        <Transition name="nav-label">
          <span v-if="labelsVisible" key="settings" class="nav-label text-xs font-medium truncate">设置</span>
        </Transition>
      </button>
    </div>
    <div class="flex-1 min-h-0 flex flex-col gap-px overflow-y-auto overscroll-contain min-w-0 px-1 py-0.5">
      <button
        type="button"
        class="nav-item"
        :class="[
          layoutExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0',
          currentView === 'home' && 'nav-item-active',
        ]"
        title="导航"
        aria-label="导航"
        @click="openNavPage"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
          :class="currentView === 'home' ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400' : 'bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300'"
        >
          <Home class="h-3.5 w-3.5" />
        </span>
        <Transition name="nav-label">
          <span v-if="labelsVisible" key="home" class="nav-label text-xs font-medium truncate">导航</span>
        </Transition>
      </button>
      <button
        type="button"
        class="nav-item"
        :class="[
          layoutExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0',
          currentView === 'contacts' && 'nav-item-active',
        ]"
        title="联系人"
        aria-label="联系人"
        @click="openApp('contacts')"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
          :class="currentView === 'contacts' ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400' : 'bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300'"
        >
          <Users class="h-3.5 w-3.5" />
        </span>
        <Transition name="nav-label">
          <span v-if="labelsVisible" key="contacts" class="nav-label text-xs font-medium truncate">联系人</span>
        </Transition>
      </button>
      <button
        type="button"
        class="nav-item"
        :class="[
          layoutExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0',
          currentView === 'bots' && 'nav-item-active',
        ]"
        title="机器人"
        aria-label="机器人"
        @click="openApp('bots')"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
          :class="currentView === 'bots' ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400' : 'bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300'"
        >
          <Bot class="h-3.5 w-3.5" />
        </span>
        <Transition name="nav-label">
          <span v-if="labelsVisible" key="bots" class="nav-label text-xs font-medium truncate">机器人</span>
        </Transition>
      </button>
      <template v-for="app in appEntries" :key="app.id">
        <button
          type="button"
          class="nav-item"
          :class="layoutExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0'"
          :title="app.title"
          :aria-label="app.title"
          @click="openApp('home', app.id)"
        >
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300">
            <component :is="app.icon" class="h-3.5 w-3.5" />
          </span>
          <Transition name="nav-label">
            <span v-if="labelsVisible" :key="app.id" class="nav-label text-xs font-medium truncate">{{ app.title }}</span>
          </Transition>
        </button>
      </template>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { Home, Users, Bot, Settings, Package, ClipboardList, Layers, PackageOpen } from 'lucide-vue-next'

const { currentView, openPanel, openNavPage, isSidebarPinned, isSidebarHovered, scheduleSidebarExpand, scheduleSidebarLeave } = useAppView()

const showExpanded = computed(() => isSidebarPinned.value || isSidebarHovered.value)

/** 按钮布局（图标左/中）：收起后保持「展开布局」直到宽度动画结束，避免图标瞬间回中 */
const layoutExpanded = ref(false)
let layoutCollapseTimer: ReturnType<typeof setTimeout> | null = null
const NAV_WIDTH_DURATION_MS = 200

watch(showExpanded, (v) => {
  if (v) {
    if (layoutCollapseTimer) {
      clearTimeout(layoutCollapseTimer)
      layoutCollapseTimer = null
    }
    layoutExpanded.value = true
  } else {
    layoutCollapseTimer = setTimeout(() => {
      layoutExpanded.value = false
      layoutCollapseTimer = null
    }, NAV_WIDTH_DURATION_MS)
  }
}, { immediate: true })

/** 文字延后显示，避免与宽度动画同帧造成卡顿；收起时立即隐藏 */
const labelsVisible = ref(false)
let labelsExpandTimer: ReturnType<typeof setTimeout> | null = null
const LABELS_EXPAND_DELAY_MS = 140

watch(showExpanded, (v) => {
  if (labelsExpandTimer) {
    clearTimeout(labelsExpandTimer)
    labelsExpandTimer = null
  }
  if (v) {
    labelsExpandTimer = setTimeout(() => {
      labelsVisible.value = true
      labelsExpandTimer = null
    }, LABELS_EXPAND_DELAY_MS)
  } else {
    labelsVisible.value = false
  }
}, { immediate: true })

onUnmounted(() => {
  if (labelsExpandTimer) clearTimeout(labelsExpandTimer)
  if (layoutCollapseTimer) clearTimeout(layoutCollapseTimer)
})

const appEntries = [
  { id: 'material', title: '物料助手', icon: Package },
  { id: 'order', title: '订单进度', icon: ClipboardList },
  { id: 'bom', title: 'BOM 状态', icon: Layers },
  { id: 'inventory', title: '库存概览', icon: PackageOpen },
]

function openApp(view: 'home' | 'contacts' | 'bots' | 'settings', _appId?: string) {
  openPanel(view)
}
</script>

<style scoped>
/* 宽度单独过渡，用 contain 限制布局影响范围 */
.nav-width-transition {
  transition: width 0.2s ease-out;
  contain: layout style;
}
.nav-item {
  @apply flex items-center gap-1.5 rounded-md py-1.5 min-w-0 w-full text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-800;
}
.nav-item-active {
  @apply bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-l-2 border-primary-500;
}
/* 文字延后挂载 + 淡入，减少同帧重排 */
.nav-label-enter-active {
  transition: opacity 0.14s ease-out;
}
.nav-label-enter-from {
  opacity: 0;
}
.nav-label-leave-active {
  transition: opacity 0.06s ease-out;
}
.nav-label-leave-to {
  opacity: 0;
}
</style>
