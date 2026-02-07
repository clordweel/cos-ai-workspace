/**
 * 抑制由 radix-vue 等库内部产生的 "Component <Anonymous> is missing template or render function" 警告。
 * 该警告来自第三方组件的 Fragment/Portal 等实现，不影响实际渲染。
 */
export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.dev) {
    const originalWarn = nuxtApp.vueApp.config.warnHandler
    nuxtApp.vueApp.config.warnHandler = (msg, instance, trace) => {
      if (
        typeof msg === 'string' &&
        msg.includes('Anonymous') &&
        msg.includes('missing template or render function')
      ) {
        return
      }
      if (originalWarn) originalWarn(msg, instance, trace)
      else console.warn(`[Vue warn]: ${msg}`, trace ?? '')
    }
  }
})
