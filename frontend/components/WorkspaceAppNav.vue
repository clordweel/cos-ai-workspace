<template>
  <nav
    class="flex flex-col shrink-0 w-14 min-h-0 overflow-hidden rounded-xl border border-zinc-200 bg-white/80 shadow-sm py-2"
    aria-label="应用"
  >
    <div class="flex flex-col items-center gap-0.5 overflow-y-auto overscroll-contain">
      <button
        type="button"
        class="flex flex-col items-center gap-1 rounded-lg py-2.5 px-1 min-w-[2.25rem] text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
        title="联系人"
        @click="openApp('contacts')"
      >
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-base">👤</span>
        <span class="text-[10px] leading-tight">联系人</span>
      </button>
      <button
        type="button"
        class="flex flex-col items-center gap-1 rounded-lg py-2.5 px-1 min-w-[2.25rem] text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
        title="机器人"
        @click="openApp('bots')"
      >
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 text-base">◇</span>
        <span class="text-[10px] leading-tight">机器人</span>
      </button>
      <template v-for="app in appEntries" :key="app.id">
        <button
          type="button"
          class="flex flex-col items-center gap-1 rounded-lg py-2.5 px-1 min-w-[2.25rem] text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
          :title="app.title"
          @click="openApp('home', app.id)"
        >
          <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 text-base">{{ app.icon }}</span>
          <span class="text-[10px] leading-tight">{{ app.title }}</span>
        </button>
      </template>
    </div>
  </nav>
</template>

<script setup lang="ts">
const { openPanel } = useAppView()

const appEntries = [
  { id: 'material', title: '物料助手', icon: '◇' },
  { id: 'order', title: '订单进度', icon: '○' },
  { id: 'bom', title: 'BOM 状态', icon: '▣' },
  { id: 'inventory', title: '库存概览', icon: '▤' },
]

function openApp(view: 'home' | 'contacts' | 'bots', _appId?: string) {
  openPanel(view)
}
</script>
