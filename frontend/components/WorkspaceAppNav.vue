<template>
  <nav
    class="relative z-10 flex flex-col shrink-0 min-h-0 overflow-visible rounded-l-lg transition-[width] duration-200 pt-1 pb-1"
    :class="showExpanded ? 'w-44' : 'w-12'"
    aria-label="应用"
    @mouseenter="setSidebarHovered(true)"
    @mouseleave="scheduleSidebarLeave()"
  >
    <!-- 设置：置于导航列表上方 -->
    <div class="shrink-0 flex flex-col gap-px px-1 pb-0.5">
      <button
        type="button"
        class="nav-item"
        :class="[
          showExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0',
          currentView === 'settings' && 'nav-item-active',
        ]"
        title="系统设置"
        aria-label="系统设置"
        @click="openApp('settings')"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
          :class="currentView === 'settings' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300'"
        >
          <Settings class="h-3.5 w-3.5" />
        </span>
        <span v-show="showExpanded" class="text-xs font-medium truncate">设置</span>
      </button>
    </div>
    <div class="flex-1 min-h-0 flex flex-col gap-px overflow-y-auto overscroll-contain min-w-0 px-1 py-0.5">
      <button
        type="button"
        class="nav-item"
        :class="[
          showExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0',
          currentView === 'home' && 'nav-item-active',
        ]"
        title="导航"
        aria-label="导航"
        @click="openNavPage"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
          :class="currentView === 'home' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300'"
        >
          <Home class="h-3.5 w-3.5" />
        </span>
        <span v-show="showExpanded" class="text-xs font-medium truncate">导航</span>
      </button>
      <button
        type="button"
        class="nav-item"
        :class="[
          showExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0',
          currentView === 'contacts' && 'nav-item-active',
        ]"
        title="联系人"
        aria-label="联系人"
        @click="openApp('contacts')"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
          :class="currentView === 'contacts' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300'"
        >
          <Users class="h-3.5 w-3.5" />
        </span>
        <span v-show="showExpanded" class="text-xs font-medium truncate">联系人</span>
      </button>
      <button
        type="button"
        class="nav-item"
        :class="[
          showExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0',
          currentView === 'bots' && 'nav-item-active',
        ]"
        title="机器人"
        aria-label="机器人"
        @click="openApp('bots')"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
          :class="currentView === 'bots' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300'"
        >
          <Bot class="h-3.5 w-3.5" />
        </span>
        <span v-show="showExpanded" class="text-xs font-medium truncate">机器人</span>
      </button>
      <template v-for="app in appEntries" :key="app.id">
        <button
          type="button"
          class="nav-item"
          :class="showExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0'"
          :title="app.title"
          :aria-label="app.title"
          @click="openApp('home', app.id)"
        >
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300">
            <component :is="app.icon" class="h-3.5 w-3.5" />
          </span>
          <span v-show="showExpanded" class="text-xs font-medium truncate">{{ app.title }}</span>
        </button>
      </template>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { Home, Users, Bot, Settings, Package, ClipboardList, Layers, PackageOpen } from 'lucide-vue-next'

const { currentView, openPanel, openNavPage, isSidebarPinned, isSidebarHovered, setSidebarHovered, scheduleSidebarLeave } = useAppView()

const showExpanded = computed(() => isSidebarPinned.value || isSidebarHovered.value)

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
.nav-item {
  @apply flex items-center gap-1.5 rounded-md py-1.5 min-w-0 w-full text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-800;
}
.nav-item-active {
  @apply bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-l-2 border-emerald-500;
}
</style>
