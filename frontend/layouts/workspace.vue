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
            <!-- 顶部工具条：左区块=固定按钮（侧栏+内容都折叠时隐藏），右区块=折叠按钮；鼠标进入工具栏时取消侧栏延迟折叠 -->
            <div
              class="shrink-0 flex items-center py-1"
              @mouseenter="cancelSidebarLeave()"
              @mouseleave="scheduleSidebarLeave()"
            >
              <!-- 左区块：侧栏折叠且内容区折叠时隐藏；悬停固定按钮不触发展开 -->
              <div
                v-if="showPinButton"
                class="flex items-center shrink-0"
                :class="isContentVisible ? 'pl-2.5' : 'pl-2'"
                @mouseenter="cancelSidebarExpand()"
              >
                <button
                  type="button"
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors"
                  :class="isSidebarPinned ? 'bg-zinc-100 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200'"
                  :title="isSidebarPinned ? '取消固定侧栏' : '固定侧栏当前状态'"
                  aria-label="固定侧栏坍缩/展开状态"
                  @click="toggleSidebarPinned"
                >
                  <PinOff v-if="isSidebarPinned" class="h-3.5 w-3.5" />
                  <Pin v-else class="h-3.5 w-3.5" />
                </button>
              </div>
              <!-- 右区块：折叠按钮；侧栏+内容都折叠时居中 -->
              <div
                class="flex items-center shrink-0 pr-2"
                :class="showPinButton ? 'ml-auto' : 'toolbar-fold-btn-centered'"
              >
                <button
                  type="button"
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                  :title="isContentVisible ? '折叠内容区' : '展开内容区'"
                  aria-label="切换应用内容区"
                  @click="toggleContentPanel"
                >
                  <PanelRightClose v-if="isContentVisible" class="h-3.5 w-3.5" />
                  <PanelRightOpen v-else class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div class="flex flex-1 min-h-0 min-w-0">
              <WorkspaceAppNav />
              <div v-show="isContentVisible" class="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden p-2 pl-0 pt-0">
                <div class="flex-1 min-h-0 min-w-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 flex flex-col" style="box-shadow: inset 0 2px 4px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.06);">
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

const route = useRoute()
const router = useRouter()
useTheme()
const { isPanelOpen, isContentVisible, isSidebarPinned, isSidebarHovered, toggleContentPanel, toggleSidebarPinned, cancelSidebarLeave, cancelSidebarExpand, scheduleSidebarLeave, openAuthTab } = useAppView()
const { fetchUser, isAuthenticated, authLoading } = useAuth()

/** 侧边栏和应用内容区都折叠时隐藏左区块（固定按钮）；任一展开或侧栏悬浮/固定则显示 */
const showPinButton = computed(() => isContentVisible.value || isSidebarPinned.value || isSidebarHovered.value)
provide('isSessionExpanded', computed(() => !isPanelOpen.value || !isContentVisible.value))

onMounted(async () => {
  await fetchUser()
  if (!authLoading.value && !isAuthenticated.value) openAuthTab()
})

watch(() => route.query?.auth, (auth) => {
  if (auth === 'ok') {
    fetchUser().then(() => {
      const q = { ...route.query }
      delete q.auth
      delete q.auth_error
      router.replace({ path: route.path, query: q })
    })
  }
})
watch(() => route.query?.auth_error, (authError) => {
  if (authError) openAuthTab()
})
</script>

<style scoped>
/* 侧栏与内容区都折叠时，折叠按钮居中 */
.toolbar-fold-btn-centered {
  margin: auto;
  padding-right: 0;
}

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
