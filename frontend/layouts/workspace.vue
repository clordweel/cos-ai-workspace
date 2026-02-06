<template>
  <div class="h-screen min-h-0 bg-zinc-100 text-zinc-900 flex flex-col">
    <header class="border-b border-zinc-200 bg-white/80 px-4 py-3 shrink-0 flex items-center gap-3">
      <Logo class="h-8 w-8 shrink-0 text-zinc-800 dark:text-white" />
      <h1 class="text-lg font-medium tracking-tight text-zinc-800">AI 工作台</h1>
    </header>
    <main class="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div class="flex-1 flex min-h-0 flex-row gap-0 p-4">
        <!-- 会话区：全高，最大宽度限制 -->
        <div class="h-full flex-1 min-w-0 max-w-md flex flex-col overflow-hidden mr-4">
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
