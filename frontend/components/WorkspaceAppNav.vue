<template>
  <nav
    class="relative z-10 flex flex-col shrink-0 min-h-0 overflow-visible rounded-l-lg transition-[width] duration-200"
    :class="showExpanded ? 'w-44' : 'w-12'"
    aria-label="应用"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- 设置：置于导航列表上方 -->
    <div class="shrink-0 flex flex-col gap-px px-1 pb-0.5">
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md py-1.5 min-w-0 w-full text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        :class="showExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0'"
        title="系统设置"
        @click="openApp('settings')"
      >
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300">
          <Settings class="h-3.5 w-3.5" />
        </span>
        <span v-show="showExpanded" class="text-xs font-medium truncate">设置</span>
      </button>
    </div>
    <div class="flex-1 min-h-0 flex flex-col gap-px overflow-y-auto overscroll-contain min-w-0 px-1 py-0.5">
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md py-1.5 min-w-0 w-full text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        :class="showExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0'"
        title="导航"
        @click="openNavPage"
      >
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300">
          <Home class="h-3.5 w-3.5" />
        </span>
        <span v-show="showExpanded" class="text-xs font-medium truncate">导航</span>
      </button>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md py-1.5 min-w-0 w-full text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        :class="showExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0'"
        title="联系人"
        @click="openApp('contacts')"
      >
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300">
          <Users class="h-3.5 w-3.5" />
        </span>
        <span v-show="showExpanded" class="text-xs font-medium truncate">联系人</span>
      </button>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md py-1.5 min-w-0 w-full text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        :class="showExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0'"
        title="机器人"
        @click="openApp('bots')"
      >
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-600">
          <Bot class="h-3.5 w-3.5" />
        </span>
        <span v-show="showExpanded" class="text-xs font-medium truncate">机器人</span>
      </button>
      <template v-for="app in appEntries" :key="app.id">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-md py-1.5 min-w-0 w-full text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          :class="showExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0'"
          :title="app.title"
          @click="openApp('home', app.id)"
        >
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
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

const { openPanel, openNavPage, isSidebarPinned } = useAppView()

const isHovered = ref(false)
const showExpanded = computed(() => isSidebarPinned.value || isHovered.value)

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
