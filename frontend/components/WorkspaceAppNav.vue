<template>
  <nav
    class="relative z-10 flex flex-col shrink-0 min-h-0 overflow-visible border-r border-zinc-200 py-1.5 rounded-l-lg transition-[width] duration-200"
    :class="isNavExpanded ? 'w-44' : 'w-12'"
    aria-label="应用"
  >
    <div class="flex-1 min-h-0 flex flex-col gap-px overflow-y-auto overscroll-contain min-w-0 px-1 py-0.5">
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md py-1.5 min-w-0 w-full text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
        :class="isNavExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0'"
        title="导航"
        @click="openNavPage"
      >
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600">
          <Home class="h-3.5 w-3.5" />
        </span>
        <span v-show="isNavExpanded" class="text-xs font-medium truncate">导航</span>
      </button>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md py-1.5 min-w-0 w-full text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
        :class="isNavExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0'"
        title="联系人"
        @click="openApp('contacts')"
      >
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600">
          <Users class="h-3.5 w-3.5" />
        </span>
        <span v-show="isNavExpanded" class="text-xs font-medium truncate">联系人</span>
      </button>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md py-1.5 min-w-0 w-full text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
        :class="isNavExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0'"
        title="机器人"
        @click="openApp('bots')"
      >
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-600">
          <Bot class="h-3.5 w-3.5" />
        </span>
        <span v-show="isNavExpanded" class="text-xs font-medium truncate">机器人</span>
      </button>
      <template v-for="app in appEntries" :key="app.id">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-md py-1.5 min-w-0 w-full text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
          :class="isNavExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0'"
          :title="app.title"
          @click="openApp('home', app.id)"
        >
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
            <component :is="app.icon" class="h-3.5 w-3.5" />
          </span>
          <span v-show="isNavExpanded" class="text-xs font-medium truncate">{{ app.title }}</span>
        </button>
      </template>
    </div>
    <!-- 分隔线 + 悬浮收起按钮 -->
    <div class="relative shrink-0 pt-1.5 pb-2">
      <div class="absolute left-0 right-0 top-1.5 h-px bg-zinc-200" aria-hidden="true" />
      <button
        type="button"
        class="absolute right-0 top-1.5 z-10 flex h-7 w-7 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-700 hover:shadow"
        :title="isNavExpanded ? '收起侧栏' : '展开侧栏'"
        @click="isNavExpanded = !isNavExpanded"
      >
        <PanelLeftClose v-if="isNavExpanded" class="h-3.5 w-3.5" />
        <PanelLeftOpen v-else class="h-3.5 w-3.5" />
      </button>
    </div>
    <div class="mt-auto shrink-0 flex flex-col gap-px px-1 pb-0.5">
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md py-1.5 min-w-0 w-full text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
        :class="isNavExpanded ? 'justify-start pl-2.5 pr-1.5' : 'justify-center px-0'"
        title="系统设置"
        @click="openApp('settings')"
      >
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600">
          <Settings class="h-3.5 w-3.5" />
        </span>
        <span v-show="isNavExpanded" class="text-xs font-medium truncate">设置</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { Home, Users, Bot, Settings, PanelLeftClose, PanelLeftOpen, Package, ClipboardList, Layers, PackageOpen } from 'lucide-vue-next'

const { openPanel, openNavPage } = useAppView()

const isNavExpanded = ref(true)

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
