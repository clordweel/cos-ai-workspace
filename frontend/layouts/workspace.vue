<template>
  <div class="h-screen min-h-0 bg-zinc-100 text-zinc-900 flex flex-col">
    <header class="border-b border-zinc-200 bg-white/80 px-4 py-3 shrink-0 flex items-center gap-3">
      <Logo class="h-8 w-8 shrink-0 text-zinc-800 dark:text-white" />
      <h1 class="text-lg font-medium tracking-tight text-zinc-800">AI 工作台</h1>
      <button
        type="button"
        class="ml-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
        :title="isPanelOpen ? '关闭应用区' : '打开应用区'"
        @click="toggleAppPanel"
      >
        <span
          class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
          :class="isPanelOpen ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-500'"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        </span>
        <span class="hidden sm:inline">{{ isPanelOpen ? '关闭应用区' : '打开应用区' }}</span>
      </button>
    </header>
    <main class="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div class="flex-1 flex min-h-0 flex-row gap-0 p-4 relative">
        <!-- 会话区：全高；应用区关闭时取消最大宽度以展开 -->
        <div
          class="h-full flex-1 min-w-0 flex flex-col overflow-hidden"
          :class="isPanelOpen ? 'max-w-md mr-4' : 'max-w-none'"
        >
          <slot />
        </div>
        <!-- 应用区：导航栏 + 内容区拼接为一块，默认打开导航页 -->
        <Transition name="app-panel" mode="out-in">
          <section v-if="isPanelOpen" key="panel" class="flex-1 min-w-0 flex min-h-0 overflow-hidden rounded-xl border border-zinc-200 bg-white/80 shadow-sm">
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
  right: 1rem;
  top: 1rem;
  bottom: 1rem;
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
