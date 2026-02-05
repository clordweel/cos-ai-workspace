<template>
  <div class="h-screen min-h-0 bg-zinc-100 text-zinc-900 flex flex-col">
    <header class="border-b border-zinc-200 bg-white/80 px-4 py-3 shrink-0">
      <h1 class="text-lg font-medium tracking-tight text-zinc-800">AI 工作台</h1>
    </header>
    <main class="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div class="flex-1 flex min-h-0 flex-row gap-0 p-4">
        <!-- 左侧应用栏：固定 -->
        <WorkspaceAppNav />
        <!-- 会话区：全高，最大宽度限制，中间空白留给应用区 -->
        <div class="h-full flex-1 min-w-0 max-w-md flex flex-col overflow-hidden ml-4">
          <slot />
        </div>
        <!-- 右侧应用区：占满中间空白区域，宽高自适应，带滑入/滑出 -->
        <Transition name="app-panel" mode="out-in">
          <section v-if="isPanelOpen" key="panel" class="flex-1 min-w-0 flex flex-col min-h-0 ml-4 overflow-hidden">
            <div class="flex-1 min-h-0 min-w-0">
              <AppPanel />
            </div>
          </section>
        </Transition>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const { isPanelOpen } = useAppView()
</script>

<style scoped>
.app-panel-enter-active,
.app-panel-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
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
