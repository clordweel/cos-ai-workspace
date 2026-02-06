<template>
  <div class="h-screen min-h-0 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex flex-col">
    <main class="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div class="flex-1 flex min-h-0 flex-row gap-0 p-3 relative">
        <!-- 会话区：内容区折叠时按展开逻辑占满除侧栏外宽度 -->
        <div
          class="h-full flex-1 min-w-0 flex flex-col overflow-visible"
          :class="isPanelOpen && isContentVisible ? 'max-w-sm mr-3' : isPanelOpen ? 'max-w-none mr-3' : 'max-w-none'"
        >
          <slot />
        </div>
        <!-- 应用区：顶部工具条 + 导航栏 + 内容区 -->
        <Transition name="app-panel" mode="out-in">
          <section v-if="isPanelOpen" key="panel" class="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm" :class="isContentVisible ? 'flex-1 min-w-0' : ''">
            <!-- 顶部工具条：内容折叠时仅折叠按钮且与侧栏图标居中对齐；内容展开时左右分布 -->
            <div
              class="shrink-0 flex items-center gap-1 border-b border-zinc-100 dark:border-zinc-700 py-1"
              :class="isContentVisible ? 'justify-between pl-3.5 pr-2' : 'justify-center px-1'"
            >
              <button
                v-if="isContentVisible"
                type="button"
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
                :class="isSidebarPinned ? 'bg-zinc-100 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200'"
                :title="isSidebarPinned ? '取消固定侧栏' : '固定侧栏展开'"
                aria-label="固定侧栏展开状态"
                @click="toggleSidebarPinned"
              >
                <PinOff v-if="isSidebarPinned" class="h-3.5 w-3.5" />
                <Pin v-else class="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                :title="isContentVisible ? '折叠内容区' : '展开内容区'"
                aria-label="切换应用内容区"
                @click="toggleContentPanel"
              >
                <PanelRightClose v-if="isContentVisible" class="h-3.5 w-3.5" />
                <PanelRightOpen v-else class="h-3.5 w-3.5" />
              </button>
            </div>
            <div class="flex flex-1 min-h-0 min-w-0">
              <WorkspaceAppNav />
              <div v-show="isContentVisible" class="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden p-2">
                <div class="flex-1 min-h-0 min-w-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/50 flex flex-col" style="box-shadow: inset 0 2px 4px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.06);">
                  <AppPanel />
                </div>
              </div>
            </div>
          </section>
        </Transition>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { PanelRightOpen, PanelRightClose, Pin, PinOff } from 'lucide-vue-next'

useTheme()
const { isPanelOpen, isContentVisible, isSidebarPinned, toggleContentPanel, toggleSidebarPinned } = useAppView()
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
