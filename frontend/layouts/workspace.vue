<template>
  <div class="h-screen min-h-0 bg-zinc-50 text-zinc-900 flex flex-col">
    <header class="border-b border-zinc-200 bg-white px-4 py-2 shrink-0 flex items-center gap-3">
      <Logo class="h-7 w-7 shrink-0 text-zinc-800 dark:text-white" />
      <h1 class="text-base font-semibold tracking-tight text-zinc-800">AI COS 工作台</h1>
      <button
        type="button"
        class="ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
        :title="isPanelOpen ? '关闭应用区' : '打开应用区'"
        @click="toggleAppPanel"
      >
        <span
          class="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
          :class="isPanelOpen ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-500'"
        >
          <LayoutPanelLeft class="h-3.5 w-3.5" />
        </span>
        <span class="hidden sm:inline text-sm">{{ isPanelOpen ? '关闭应用区' : '打开应用区' }}</span>
      </button>
    </header>
    <main class="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div class="flex-1 flex min-h-0 flex-row gap-0 p-3 relative">
        <!-- 会话区：全高；应用区关闭时取消最大宽度以展开 -->
        <div
          class="h-full flex-1 min-w-0 flex flex-col overflow-hidden"
          :class="isPanelOpen ? 'max-w-md mr-3' : 'max-w-none'"
        >
          <slot />
        </div>
        <!-- 应用区：导航栏 + 内容区拼接为一块，默认打开导航页 -->
        <Transition name="app-panel" mode="out-in">
          <section v-if="isPanelOpen" key="panel" class="flex-1 min-w-0 flex min-h-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <WorkspaceAppNav />
            <div class="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
              <AppPanel />
            </div>
          </section>
        </Transition>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { LayoutPanelLeft } from 'lucide-vue-next'

const { isPanelOpen, openPanel, closePanel } = useAppView()

function toggleAppPanel() {
  if (isPanelOpen.value) closePanel()
  else openPanel()
}
</script>

<style scoped>
.app-panel-enter-active,
.app-panel-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
/* 离开时脱离文档流，会话区可立即占满，避免「先半宽再全宽」两段式 */
.app-panel-leave-active {
  position: absolute;
  right: 0.75rem;
  top: 0.75rem;
  bottom: 0.75rem;
  width: min(50%, 32rem);
  margin: 0;
}
.app-panel-enter-from {
  opacity: 0;
  transform: translateX(1rem);
}
.app-panel-leave-to {
  opacity: 0;
  transform: translateX(0.5rem);
}
</style>
