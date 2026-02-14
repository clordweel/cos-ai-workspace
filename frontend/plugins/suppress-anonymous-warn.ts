/**
 * 抑制由 radix-vue / reka-ui / Vue DevTools 等产生的无关紧要的 Vue 警告，不影响实际渲染。
 * - "Component <Anonymous> is missing template or render function"：Fragment/Portal 等实现
 * - "Extraneous non-props attributes (style) ... fragment or text or teleport root nodes"：Portal 定位层或 DevTools 高亮层（VueElement）接收 style 时 Vue 无法继承
 *
 * 1) 通过 app.config.warnHandler 过滤（含延迟再设置，避免被 DevTools 覆盖）
 * 2) 兜底：包装 console.warn，过滤上述文案（应对 DevTools 扩展在独立上下文中打印的警告）
 */
export default defineNuxtPlugin({
  name: 'suppress-anonymous-warn',
  enforce: 'post',
  order: 9999,
  setup(nuxtApp) {
    if (!import.meta.dev) return

    function shouldSuppressWarn(msg: string, trace?: string): boolean {
      if (
        msg.includes('Anonymous') &&
        msg.includes('missing template or render function')
      ) {
        return true
      }
      const hasExtraneousStyle =
        msg.includes('Extraneous non-props attributes') && msg.includes('style')
      const hasFragmentTeleport =
        msg.includes('fragment or text or teleport root nodes') ||
        msg.includes('teleport root') ||
        msg.includes('fragment')
      const traceStr = typeof trace === 'string' ? trace : String(trace ?? '')
      const isVueElement = traceStr.includes('VueElement')
      return !!(hasExtraneousStyle && (hasFragmentTeleport || isVueElement))
    }

    function installHandler() {
      const current = nuxtApp.vueApp.config.warnHandler
      nuxtApp.vueApp.config.warnHandler = (msg, instance, trace) => {
        if (typeof msg !== 'string') {
          if (current) current(msg, instance, trace)
          else console.warn('[Vue warn]:', msg, trace ?? '')
          return
        }
        if (shouldSuppressWarn(msg, typeof trace === 'string' ? trace : String(trace ?? ''))) {
          return
        }
        if (current) current(msg, instance, trace)
        else console.warn(`[Vue warn]: ${msg}`, trace ?? '')
      }
    }

    installHandler()
    setTimeout(installHandler, 0)

    const origWarn = console.warn
    console.warn = (...args: unknown[]) => {
      const full = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ')
      if (full.includes('Extraneous non-props attributes') && full.includes('style') && (full.includes('fragment') || full.includes('teleport') || full.includes('VueElement'))) {
        return
      }
      origWarn.apply(console, args)
    }
  },
})
