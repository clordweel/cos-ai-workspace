/**
 * Tailwind 默认断点（min-width），与 tailwind.config 保持一致；
 * 未在 theme.extend.screens 覆盖时使用此映射。
 * @see https://tailwindcss.com/docs/responsive-design#breakpoints
 */
export const TAILWIND_BREAKPOINTS_PX: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

const breakpointRefs: Record<string, Ref<boolean>> = {}

/** 当前视口是否 >= 指定 Tailwind 断点（min-width），单例 per 断点，与 Tailwind 类对齐 */
export function useBreakpoint(name: keyof typeof TAILWIND_BREAKPOINTS_PX) {
  const key = name
  if (!breakpointRefs[key]) {
    const minWidth = TAILWIND_BREAKPOINTS_PX[name] ?? 0
    const query = `(min-width: ${minWidth}px)`
    breakpointRefs[key] = ref(false)
    if (import.meta.client) {
      const mq = window.matchMedia(query)
      breakpointRefs[key].value = mq.matches
      mq.addEventListener('change', (e: MediaQueryListEvent) => { breakpointRefs[key].value = e.matches })
    }
  }
  return breakpointRefs[key]
}
