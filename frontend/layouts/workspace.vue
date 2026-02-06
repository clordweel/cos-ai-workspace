<template>
  <div class="h-screen min-h-0 bg-zinc-50 text-zinc-900 flex flex-col">
    <main class="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div class="flex-1 flex min-h-0 flex-row gap-0 p-3 relative">
        <!-- 会话区：内容区折叠时按展开逻辑占满除侧栏外宽度 -->
        <div
          class="h-full flex-1 min-w-0 flex flex-col overflow-visible"
          :class="isPanelOpen && isContentVisible ? 'max-w-sm mr-3' : isPanelOpen ? 'max-w-none mr-3' : 'max-w-none'"
        >
          <slot />
        </div>
        <!-- 应用区：导航栏 + 内容区拼接为一块，默认打开导航页 -->
        <Transition name="app-panel" mode="out-in">
          <section v-if="isPanelOpen" key="panel" class="flex min-h-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm" :class="isContentVisible ? 'flex-1 min-w-0' : ''">
            <WorkspaceAppNav />
            <div v-show="isContentVisible" class="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden p-2">
              <div class="flex-1 min-h-0 min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/50 flex flex-col" style="box-shadow: inset 0 2px 4px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.06);">
                <AppPanel />
              </div>
            </div>
          </section>
        </Transition>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const { isPanelOpen, isContentVisible } = useAppView()
provide('isSessionExpanded', computed(() => !isPanelOpen.value || !isContentVisible.value))
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
