/**
 * 语义化断点（从窄到宽），与布局逻辑一致；
 * 可在 theme.extend.screens 中同步以便 Tailwind 类使用。
 *
 * 语义：
 * - xxs: 最窄档，viewport ≤ 320px，默认仅会话列表，点击会话切到聊天
 * - xs:  min-width 320px
 * - sm:  min-width 640px
 * - md:  min-width 768px
 * - lg:  min-width 1024px
 * - xl:  min-width 1280px
 * - 2xl: min-width 1536px
 */
export const BREAKPOINTS_MIN_PX: Record<string, number> = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

/** xxs 使用 max-width，其余为 min-width */
export const BREAKPOINTS_MAX_PX: Record<string, number> = {
  xxs: 320,
}

const breakpointRefs: Record<string, Ref<boolean>> = {}
const clientMediaQueries: Record<string, MediaQueryList> = {}

function getQuery(name: string): string {
  const maxPx = BREAKPOINTS_MAX_PX[name]
  if (maxPx != null) return `(max-width: ${maxPx}px)`
  const minPx = BREAKPOINTS_MIN_PX[name]
  if (minPx != null) return `(min-width: ${minPx}px)`
  return `(min-width: 0px)`
}

export type BreakpointKey = keyof typeof BREAKPOINTS_MIN_PX | keyof typeof BREAKPOINTS_MAX_PX

/** 当前视口是否满足断点（xxs 为 max-width ≤320px，其余为 min-width ≥），单例 per 断点 */
export function useBreakpoint(name: BreakpointKey) {
  const key = name
  if (!breakpointRefs[key]) {
    breakpointRefs[key] = ref(false)
  }
  if (import.meta.client) {
    if (!clientMediaQueries[key]) {
      const query = getQuery(key)
      const mq = window.matchMedia(query)
      breakpointRefs[key].value = mq.matches
      mq.addEventListener('change', (e: MediaQueryListEvent) => {
        breakpointRefs[key].value = e.matches
      })
      clientMediaQueries[key] = mq
      // 挂载后再次同步，避免 SSR/水合阶段误用初始 false
      onMounted(() => {
        breakpointRefs[key].value = mq.matches
      })
    }
  }
  return breakpointRefs[key]
}

/** 兼容旧用法：Tailwind 默认名（无 xxs/xs 时）仍可用 */
export const TAILWIND_BREAKPOINTS_PX = BREAKPOINTS_MIN_PX
