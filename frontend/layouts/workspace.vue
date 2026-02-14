<template>
  <div class="h-screen min-h-0 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex flex-col">
    <!-- 刷新/首屏加载过场：鉴权完成且至少播完一轮图标路径动画后再进入主界面 -->
    <Transition name="app-loading-fade">
      <div
        v-if="showLoadingOverlay"
        class="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 backdrop-blur-sm"
        aria-live="polite"
        aria-busy="true"
        role="status"
      >
        <!-- IconCos 播一次，IconCosAi 循环 -->
        <div class="flex flex-col items-center justify-center gap-5 w-[140px] opacity-100">
          <IconCos
            :size="100"
            color="currentColor"
            class="text-zinc-700 dark:text-zinc-200 shrink-0"
            :animated="true"
            :loop="false"
          />
          <IconCosAi
            :width="120"
            :height="20"
            color="currentColor"
            class="text-zinc-800 dark:text-zinc-100 shrink-0"
            :animated="true"
          />
        </div>
      </div>
    </Transition>
    <main class="flex-1 min-h-0 flex flex-col overflow-hidden">
      <!-- 顶栏：IconCosAi 字标 + 标语；点击播放路径动画 -->
      <header
        class="workspace-topbar shrink-0 h-14 flex items-center justify-center px-4 w-full"
        role="banner"
        aria-label="产品"
      >
        <button
          type="button"
          class="brand-block flex items-center gap-2 min-w-0 rounded-lg py-1.5 px-2 -mx-2 text-zinc-600 dark:text-zinc-300 select-none cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-offset-zinc-900"
          aria-label="播放图标路径动画"
          @click="playTopbarIconAnimation"
        >
          <IconCosAi
            :width="72"
            :height="12"
            color="currentColor"
            class="shrink-0 pointer-events-none"
            :animated="topbarIconAnimating"
          />
          <span
            class="hidden sm:inline text-sm font-medium whitespace-nowrap pl-2 border-l border-zinc-400 dark:border-zinc-500"
            aria-hidden="true"
          >
            智能交互工作台
          </span>
        </button>
      </header>
      <div
        class="workspace-grid flex-1 grid min-h-0 px-3 pt-0 pb-2 relative"
        :class="showAppPanel ? 'gap-3' : 'gap-0'"
        :style="{ gridTemplateColumns: effectiveGridColumns, gridTemplateRows: 'minmax(0, 1fr)' }"
      >
        <!-- 左栏：会话区；行高由 minmax(0,1fr) 约束，避免聊天内容撑开整页 -->
        <div class="workspace-session-column h-full min-h-0 w-full min-w-0 flex flex-col overflow-hidden">
          <div class="workspace-session-column-inner h-full min-h-0 w-full min-w-0 flex flex-col overflow-hidden">
            <slot />
          </div>
        </div>
        <!-- 右栏：应用区；xxs 下由 CSS 媒体查询首屏即隐藏，避免刷新时先显后隐 -->
        <Transition name="app-panel" mode="out-in">
          <section
            v-if="showAppPanel"
            key="panel"
            class="workspace-app-panel flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 min-w-0"
            :class="isContentVisible ? 'flex-1 min-w-0' : ''"
          >
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
                  :class="isSidebarPinned ? 'bg-zinc-100 dark:bg-zinc-600 text-black dark:text-white' : 'text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-black dark:hover:text-white'"
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
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-black dark:hover:text-white transition-colors"
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
                <div class="workspace-app-content flex-1 min-h-0 min-w-0 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 flex flex-col" style="box-shadow: inset 0 2px 4px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.06);">
                  <AppPanel />
                </div>
              </div>
            </div>
          </section>
        </Transition>
      </div>
      <!-- 底栏：挂载后且断点 ≥ md 时显示，避免 SSR 与客户端首帧不一致导致水合告警 -->
      <footer
        v-if="showFooter"
        class="workspace-footer shrink-0 flex flex-col items-center justify-center gap-1.5 min-h-28 px-4 py-5 text-xs"
        role="contentinfo"
        aria-label="页脚"
      >
        <p class="m-0 flex items-center justify-center gap-1.5 min-h-[1.5em] font-medium text-zinc-700 dark:text-zinc-300 text-center">
          <Copyright class="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
          <span>{{ new Date().getFullYear() }} COS&AI · 智能交互工作台</span>
        </p>
        <p class="m-0 flex items-center justify-center min-h-[1.5em] text-zinc-500 dark:text-zinc-400">
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            京ICP备xxxxxxxx号
          </a>
        </p>
        <p class="m-0 flex items-center justify-center gap-1.5 min-h-[1.5em] text-zinc-500 dark:text-zinc-400">
          <Mail class="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
          <span>技术支持：support@example.com</span>
        </p>
        <nav class="flex items-center justify-center gap-4 pt-0.5 min-h-[1.5em] text-zinc-400 dark:text-zinc-500" aria-label="底栏链接">
          <NuxtLink
            to="/space"
            class="inline-flex items-center gap-1.5 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            <Home class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            首页
          </NuxtLink>
          <a
            href="#"
            class="inline-flex items-center gap-1.5 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            @click.prevent
          >
            <HelpCircle class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            帮助
          </a>
          <a
            href="#"
            class="inline-flex items-center gap-1.5 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            @click.prevent
          >
            <InfoIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            关于
          </a>
        </nav>
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
import { PanelRightOpen, PanelRightClose, Pin, PinOff, Copyright, Mail, Home, HelpCircle, Info as InfoIcon } from 'lucide-vue-next'
import IconCos from '~/components/icons/IconCos.vue'
import IconCosAi from '~/components/icons/IconCosAi.vue'

const route = useRoute()
const router = useRouter()
useTheme()
const { isPanelOpen, isContentVisible, isSidebarPinned, isSidebarHovered, toggleContentPanel, toggleSidebarPinned, cancelSidebarLeave, cancelSidebarExpand, scheduleSidebarLeave, openAuthTab } = useAppView()
const { fetchUser, isAuthenticated, authLoading } = useAuth()
const { isSessionExpanded, appContentVisible, gridTemplateColumns, showAppPanel, isXxs, isXl, showFooter } = useWorkspaceLayout()

/** 至少完成一轮图标路径动画（3.2s）后再进入主界面 */
const ICON_CYCLE_MS = 3200
const logoCycleDone = ref(false)
let logoCycleTimer: ReturnType<typeof setTimeout> | null = null

/** 顶栏 IconCosAi 点击播放路径动画：播放一轮后停止 */
const TOPBAR_ICON_CYCLE_MS = 3200
const topbarIconAnimating = ref(false)
let topbarIconAnimationTimer: ReturnType<typeof setTimeout> | null = null
function playTopbarIconAnimation() {
  if (topbarIconAnimating.value) return
  topbarIconAnimating.value = true
  if (topbarIconAnimationTimer) clearTimeout(topbarIconAnimationTimer)
  topbarIconAnimationTimer = setTimeout(() => {
    topbarIconAnimating.value = false
    topbarIconAnimationTimer = null
  }, TOPBAR_ICON_CYCLE_MS)
}

const showLoadingOverlay = computed(() => authLoading.value || !logoCycleDone.value)
watch(authLoading, (loading) => {
  if (loading) {
    logoCycleDone.value = false
    if (logoCycleTimer) clearTimeout(logoCycleTimer)
    logoCycleTimer = setTimeout(() => {
      logoCycleDone.value = true
      logoCycleTimer = null
    }, ICON_CYCLE_MS)
  } else {
    // 鉴权已结束或初始即为 false（如从其他页进入、水合后已就绪）：若从未启动过 timer，
    // 则直接允许隐藏遮罩，避免 showLoadingOverlay 恒为 true 导致遮罩常驻、整页无法点击
    if (!logoCycleTimer && !logoCycleDone.value) {
      logoCycleDone.value = true
    }
  }
}, { immediate: true })
onBeforeUnmount(() => {
  if (logoCycleTimer) clearTimeout(logoCycleTimer)
  if (topbarIconAnimationTimer) clearTimeout(topbarIconAnimationTimer)
})

/** 按实际视口判断 xl：与 SSR 一致初值为 false，仅在 onMounted 后更新，避免水合时 grid-template-columns 不一致 */
const isXlFromViewport = ref(false)
onMounted(() => {
  const mq = window.matchMedia('(min-width: 1280px)')
  const update = () => { isXlFromViewport.value = mq.matches }
  update()
  mq.addEventListener('change', update)
})

/** 当前是否为会话页（有 chat id）：有则应用区展开时会话列始终 1fr，避免聊天被折叠 */
const hasChatInRoute = computed(() => {
  const p = route.path
  if (!p.startsWith('/space')) return false
  const rest = p.slice('/space'.length)
  const id = rest === '' || rest === '/' ? undefined : rest.replace(/^\//, '').split('/')[0]
  return !!id
})
/** xl+ 或会话页且应用区展开时：左栏最大 940px、右栏 1fr 占满剩余，避免过宽时留白 */
const effectiveGridColumns = computed(() => {
  const appExpanded = showAppPanel.value && isContentVisible.value
  if (appExpanded && (isXlFromViewport.value || hasChatInRoute.value)) return 'minmax(0, 940px) 1fr'
  return gridTemplateColumns.value
})

/** 供子组件（space 页、应用区工具栏）使用；仅 md～lg 且应用区展开时折叠会话聊天区，xl 及以上不折叠 */
const hideChatForApp = computed(() => appContentVisible.value && showAppPanel.value && !isXlFromViewport.value)
provide('isSessionExpanded', isSessionExpanded)
provide('appContentVisible', appContentVisible)
provide('showAppPanel', showAppPanel)
provide('isXxs', isXxs)
provide('isXl', isXl)
provide('hideChatForApp', hideChatForApp)

/** 侧边栏和应用内容区都折叠时隐藏左区块（固定按钮）；任一展开或侧栏悬浮/固定则显示 */
const showPinButton = computed(() => isContentVisible.value || isSidebarPinned.value || isSidebarHovered.value)

onMounted(() => {
  fetchUser().then(() => {
    if (!authLoading.value && !isAuthenticated.value) openAuthTab()
  })
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
/* 应用内容区：内容超出显示滚动条，极细样式 */
.workspace-app-content {
  scrollbar-width: thin;
  scrollbar-color: rgb(212 212 216) transparent;
}
.workspace-app-content::-webkit-scrollbar {
  width: 2px;
  height: 2px;
}
.workspace-app-content::-webkit-scrollbar-track {
  background: transparent;
}
.workspace-app-content::-webkit-scrollbar-thumb {
  background-color: rgb(212 212 216);
  border-radius: 2px;
}
.dark .workspace-app-content {
  scrollbar-color: rgb(82 82 91) transparent;
}
.dark .workspace-app-content::-webkit-scrollbar-thumb {
  background-color: rgb(82 82 91);
}

/* < md 断点：首屏即单栏、隐藏应用区；避免刷新时先显示应用区 */
@media (max-width: 767px) {
  .workspace-grid {
    grid-template-columns: 1fr 0fr !important;
  }
  .workspace-app-panel {
    display: none !important;
  }
}

/* < sm 断点：会话区居中，最大宽度 32rem */
@media (max-width: 639px) {
  .workspace-session-column {
    display: flex;
    justify-content: center;
    align-items: stretch;
  }
  .workspace-session-column-inner {
    width: 100%;
    max-width: 32rem;
    margin-left: auto;
    margin-right: auto;
  }
}

/* 视口高度较小时隐藏底栏，为主内容留出空间 */
@media (max-height: 860px) {
  .workspace-footer {
    display: none !important;
  }
}

/* xxs 断点：去除 padding 与 border */
@media (max-width: 320px) {
  .workspace-grid {
    padding: 0 !important;
  }
  .workspace-app-panel {
    border: none !important;
  }
}

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

/* 首屏加载遮罩：短淡入避免“先只有图标、后出文字”的两段感；离开阶段不拦截点击，避免过渡期间误触阻塞 */
.app-loading-fade-enter-active,
.app-loading-fade-leave-active {
  transition: opacity 0.12s ease;
}
.app-loading-fade-leave-active {
  pointer-events: none;
}
.app-loading-fade-enter-from,
.app-loading-fade-leave-to {
  opacity: 0;
}
</style>
