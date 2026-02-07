<template>
  <nav
    class="relative z-10 flex flex-col shrink-0 min-h-0 overflow-visible rounded-l-lg pt-1 pb-1 nav-width-transition"
    :class="[
      showExpanded ? 'w-48' : 'w-12',
      labelsVisible && 'labels-visible'
    ]"
    aria-label="标签"
    @mouseenter="scheduleSidebarExpand()"
    @mouseleave="scheduleSidebarLeave()"
  >
    <!-- 标签列表：类似浏览器侧栏标签，可切换、关闭；未展开时隐藏滚动条，展开时最细滚动条 -->
    <div
      class="nav-tabs-scroll flex-1 min-h-0 flex flex-col gap-px overflow-y-auto overscroll-contain min-w-0 px-1 py-0.5"
      :class="showExpanded ? 'nav-tabs-scroll-expanded' : 'nav-tabs-scroll-collapsed'"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="tab-item group"
        :class="[
          layoutExpanded ? 'justify-start pl-2 pr-1' : 'justify-center px-0',
          activeTabId === tab.id && 'tab-item-active',
        ]"
        :title="tab.title"
        :aria-label="tab.title"
        @click="switchTab(tab.id)"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
          :class="activeTabId === tab.id ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400' : 'bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300'"
        >
          <component :is="tabIcon(tab)" class="h-3.5 w-3.5" />
        </span>
        <Transition name="nav-label">
          <span v-if="labelsVisible" :key="tab.id" class="tab-label text-xs font-medium truncate min-w-0">{{ tab.title }}</span>
        </Transition>
        <Transition name="nav-label">
          <button
            v-if="labelsVisible && tabs.length > 1"
            type="button"
            class="tab-close shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-opacity focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-800"
            :aria-label="`关闭 ${tab.title}`"
            @click.stop="closeTab(tab.id)"
          >
            <X class="h-3 w-3" />
          </button>
        </Transition>
      </button>
    </div>
    <!-- 底部：新标签、设置（打开即新增对应标签） -->
    <div class="shrink-0 flex flex-col gap-px px-1 pt-0.5 pb-1 border-t border-zinc-100 dark:border-zinc-700">
      <button
        type="button"
        class="tab-item"
        :class="layoutExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0'"
        title="新标签"
        aria-label="新标签"
        @click="addTab('home')"
      >
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300">
          <Plus class="h-3.5 w-3.5" />
        </span>
        <Transition name="nav-label">
          <span v-if="labelsVisible" key="new" class="tab-label text-xs font-medium truncate">新标签</span>
        </Transition>
      </button>
      <button
        type="button"
        class="tab-item"
        :class="layoutExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0'"
        title="系统设置"
        aria-label="系统设置"
        @click="openSettingsTab"
      >
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300">
          <Settings class="h-3.5 w-3.5" />
        </span>
        <Transition name="nav-label">
          <span v-if="labelsVisible" key="settings" class="tab-label text-xs font-medium truncate">设置</span>
        </Transition>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { Home, Users, Bot, Settings, Package, ClipboardList, Layers, PackageOpen, X, Plus } from 'lucide-vue-next'
import type { AppTab } from '~/composables/useAppView'

const { tabs, activeTabId, addTab, closeTab, switchTab, isSidebarPinned, sidebarPinnedExpanded, isSidebarHovered, scheduleSidebarExpand, scheduleSidebarLeave } = useAppView()

function openSettingsTab() {
  const settingsTab = tabs.value.find((t) => t.view === 'settings')
  if (settingsTab) switchTab(settingsTab.id)
  else addTab('settings')
}

const showExpanded = computed(() => isSidebarPinned.value ? sidebarPinnedExpanded.value : isSidebarHovered.value)

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

const APP_ICONS: Record<string, typeof Package> = {
  material: Package,
  order: ClipboardList,
  bom: Layers,
  inventory: PackageOpen,
}

const VIEW_ICONS: Record<string, typeof Home> = {
  home: Home,
  contacts: Users,
  bots: Bot,
  settings: Settings,
}

function tabIcon(tab: AppTab) {
  if (tab.appId && APP_ICONS[tab.appId]) return APP_ICONS[tab.appId]
  return VIEW_ICONS[tab.view] ?? Home
}
</script>

<style scoped>
.nav-width-transition {
  transition: width 0.2s ease-out;
  contain: layout style;
}

/* 未展开：滚动条不可见 */
.nav-tabs-scroll-collapsed {
  scrollbar-width: none;
}
.nav-tabs-scroll-collapsed::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

/* 展开：最细滚动条（与 zinc 色系一致） */
.nav-tabs-scroll-expanded {
  scrollbar-width: thin;
  scrollbar-color: rgb(212 212 216) transparent;
}
.dark .nav-tabs-scroll-expanded {
  scrollbar-color: rgb(82 82 91) transparent;
}
.nav-tabs-scroll-expanded::-webkit-scrollbar {
  width: 5px;
}
.nav-tabs-scroll-expanded::-webkit-scrollbar-track {
  background: transparent;
}
.nav-tabs-scroll-expanded::-webkit-scrollbar-thumb {
  background-color: rgb(212 212 216);
  border-radius: 9999px;
}
.dark .nav-tabs-scroll-expanded::-webkit-scrollbar-thumb {
  background-color: rgb(82 82 91);
}
.nav-tabs-scroll-expanded::-webkit-scrollbar-thumb:hover {
  background-color: rgb(161 161 170);
}
.dark .nav-tabs-scroll-expanded::-webkit-scrollbar-thumb:hover {
  background-color: rgb(113 113 122);
}
.nav-tabs-scroll-expanded::-webkit-scrollbar-button {
  display: none;
}
.tab-item {
  @apply flex items-center gap-1.5 rounded-md py-1.5 min-w-0 w-full text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-800;
}
.tab-item-active {
  @apply bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-l-2 border-primary-500;
}
.tab-label {
  @apply flex-1 min-w-0 text-left;
}
.tab-close {
  margin-left: auto;
}
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
