<template>
  <nav
    ref="navRef"
    class="session-list-bottom-nav absolute bottom-2 left-1/2 z-10 -translate-x-1/2 flex h-11 w-fit items-end justify-center gap-1 rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-white/50 dark:bg-zinc-800/40 px-2 pb-1 pt-2 backdrop-blur-xl transition-all duration-300 ease-out"
    aria-label="会话列表视图"
  >
    <button
      ref="tab0Ref"
      type="button"
      class="session-list-tab relative flex h-8 w-10 flex-col items-center justify-center gap-0 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
      :class="modelValue === 'active' ? 'text-zinc-800 dark:text-zinc-100 bg-white/90 dark:bg-zinc-600/80 shadow-md ring-1 ring-primary-200/50 dark:ring-primary-400/25' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-zinc-600/40'"
      aria-label="活动聊天"
      @click="emit('update:modelValue', 'active')"
    >
      <MessageCircle class="h-4 w-4 shrink-0" :class="modelValue === 'active' ? 'drop-shadow-sm' : ''" />
    </button>
    <button
      ref="tab1Ref"
      type="button"
      class="session-list-tab relative flex h-8 w-10 flex-col items-center justify-center gap-0 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
      :class="modelValue === 'pending' ? 'text-zinc-800 dark:text-zinc-100 bg-white/90 dark:bg-zinc-600/80 shadow-md ring-1 ring-primary-200/50 dark:ring-primary-400/25' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-zinc-600/40'"
      aria-label="待处理（未读等状态）"
      @click="emit('update:modelValue', 'pending')"
    >
      <Inbox class="h-4 w-4 shrink-0" :class="modelValue === 'pending' ? 'drop-shadow-sm' : ''" />
      <span v-if="pendingCount > 0" class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">{{ pendingCount > 99 ? '99+' : pendingCount }}</span>
    </button>
    <button
      ref="tab2Ref"
      type="button"
      class="session-list-tab relative flex h-8 w-10 flex-col items-center justify-center gap-0 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
      :class="modelValue === 'favorites' ? 'text-zinc-800 dark:text-zinc-100 bg-white/90 dark:bg-zinc-600/80 shadow-md ring-1 ring-primary-200/50 dark:ring-primary-400/25' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-zinc-600/40'"
      aria-label="收藏归档"
      @click="emit('update:modelValue', 'favorites')"
    >
      <Archive class="h-4 w-4 shrink-0" :class="modelValue === 'favorites' ? 'drop-shadow-sm' : ''" />
    </button>
    <button
      ref="tab3Ref"
      type="button"
      class="session-list-tab relative flex h-8 w-10 flex-col items-center justify-center gap-0 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
      :class="modelValue === 'settings' ? 'text-zinc-800 dark:text-zinc-100 bg-white/90 dark:bg-zinc-600/80 shadow-md ring-1 ring-primary-200/50 dark:ring-primary-400/25' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-zinc-600/40'"
      aria-label="会话设置"
      @click="emit('update:modelValue', 'settings')"
    >
      <Settings class="h-4 w-4 shrink-0" :class="modelValue === 'settings' ? 'drop-shadow-sm' : ''" />
    </button>
    <!-- 滑动指示器：加载完成后再显示，静止为短横条，过渡时朝目标方向伸长 -->
    <span
      v-show="indicatorReady"
      class="session-list-indicator absolute bottom-1 left-0 z-10 rounded-full pointer-events-none"
      :class="isTransitioning ? 'h-0.5 w-6' : 'h-0.5 w-3'"
      aria-hidden="true"
      :style="indicatorStyle"
    />
  </nav>
</template>

<script setup lang="ts">
import { Archive, Inbox, MessageCircle, Settings } from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: 'active' | 'favorites' | 'pending' | 'settings'
  /** 待处理（非已读）消息总数，用于角标 */
  pendingCount?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: 'active' | 'favorites' | 'pending' | 'settings']
}>()

const navRef = ref<HTMLElement | null>(null)
const tab0Ref = ref<HTMLElement | null>(null)
const tab1Ref = ref<HTMLElement | null>(null)
const tab2Ref = ref<HTMLElement | null>(null)
const tab3Ref = ref<HTMLElement | null>(null)
const pendingCount = computed(() => props.pendingCount ?? 0)
const indicatorLeft = ref(14)
const indicatorReady = ref(false)
const isTransitioning = ref(false)

const tabIndex = computed(() =>
  props.modelValue === 'active' ? 0 : props.modelValue === 'pending' ? 1 : props.modelValue === 'favorites' ? 2 : 3
)

const INDICATOR_TRANSITION_MS = 250
const SHORT_BAR_WIDTH = 12
const LONG_BAR_WIDTH = 24

function getTabCenter(nav: HTMLElement, tab: HTMLElement | null) {
  if (!nav || !tab) return null
  const navRect = nav.getBoundingClientRect()
  const tabRect = tab.getBoundingClientRect()
  return tabRect.left - navRect.left + tabRect.width / 2
}

function updateIndicatorPosition(options?: {
  phase?: 'expand' | 'slide'
  sourceIndex?: number
  targetIndex?: number
}) {
  nextTick(() => {
    const nav = navRef.value
    const tabs = [tab0Ref.value, tab1Ref.value, tab2Ref.value, tab3Ref.value]
    if (!nav || tabs.some((t) => !t)) return

    const phase = options?.phase
    const sourceIndex = options?.sourceIndex ?? tabIndex.value
    const targetIndex = options?.targetIndex ?? tabIndex.value

    if (phase === 'expand') {
      const sourceCenter = getTabCenter(nav, tabs[sourceIndex]!)
      const targetCenter = getTabCenter(nav, tabs[targetIndex]!)
      if (sourceCenter == null || targetCenter == null) return
      const movingRight = targetIndex > sourceIndex
      indicatorLeft.value = Math.round(
        movingRight ? sourceCenter - SHORT_BAR_WIDTH / 2 : sourceCenter - LONG_BAR_WIDTH + SHORT_BAR_WIDTH / 2
      )
      indicatorReady.value = true
      return
    }

    if (phase === 'slide') {
      const targetCenter = getTabCenter(nav, tabs[targetIndex]!)
      if (targetCenter == null) return
      indicatorLeft.value = Math.round(targetCenter - LONG_BAR_WIDTH / 2)
      return
    }

    const idx = tabIndex.value
    const center = getTabCenter(nav, tabs[idx]!)
    if (center == null) return
    const indicatorWidth = isTransitioning.value ? LONG_BAR_WIDTH : SHORT_BAR_WIDTH
    indicatorLeft.value = Math.round(center - indicatorWidth / 2)
    indicatorReady.value = true
  })
}

const indicatorStyle = computed(() => ({
  transform: `translateX(${indicatorLeft.value}px)`,
}))

watch(tabIndex, (newVal, oldVal) => {
  const prev = oldVal ?? tabIndex.value
  isTransitioning.value = true
  updateIndicatorPosition({ phase: 'expand', sourceIndex: prev, targetIndex: newVal })
  nextTick(() => {
    updateIndicatorPosition({ phase: 'slide', targetIndex: newVal })
  })
  setTimeout(() => {
    isTransitioning.value = false
    updateIndicatorPosition()
  }, INDICATOR_TRANSITION_MS)
})

onMounted(() => {
  updateIndicatorPosition()
})
</script>

<style scoped>
.session-list-bottom-nav {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}
:global(.dark) .session-list-bottom-nav {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
.session-list-indicator {
  transition:
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  background: #2563eb;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.5);
}
:global(.dark) .session-list-indicator {
  background: #60a5fa;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.15);
}
</style>
