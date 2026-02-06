<template>
  <nav
    class="relative z-10 flex flex-col shrink-0 min-h-0 overflow-visible rounded-l-lg transition-[width] duration-200"
    :class="isNavExpanded ? 'w-44' : 'w-12'"
    aria-label="应用"
  >
    <!-- 顶部：右侧内容区显隐切换（侧栏展开时居左，折叠时居中） -->
    <div class="shrink-0 flex items-center py-1.5" :class="isNavExpanded ? 'justify-start pl-1' : 'justify-center'">
      <button
        type="button"
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        :title="isContentVisible ? '折叠内容区' : '展开内容区'"
        aria-label="切换应用内容区"
        @click="toggleContentPanel"
      >
        <PanelRightOpen v-if="isContentVisible" class="h-3.5 w-3.5" />
        <PanelRightClose v-else class="h-3.5 w-3.5" />
      </button>
    </div>
    <!-- 设置：置于导航列表上方 -->
    <div class="shrink-0 flex flex-col gap-px px-1 pb-0.5">
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
    <!-- 折叠按钮：相对整条侧栏垂直居中 -->
    <button
      type="button"
      class="absolute right-0 top-1/2 z-10 flex h-7 w-7 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-700 hover:shadow"
      :title="isNavExpanded ? '收起侧栏' : '展开侧栏'"
      @click="isNavExpanded = !isNavExpanded"
    >
      <PanelLeftClose v-if="isNavExpanded" class="h-3.5 w-3.5" />
      <PanelLeftOpen v-else class="h-3.5 w-3.5" />
    </button>
  </nav>
</template>

<script setup lang="ts">
import { Home, Users, Bot, Settings, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Package, ClipboardList, Layers, PackageOpen } from 'lucide-vue-next'

const { openPanel, openNavPage, isContentVisible, toggleContentPanel } = useAppView()

const isNavExpanded = ref(false)

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
