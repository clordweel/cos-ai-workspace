import type { AppExtension } from '~/types/app-extensions'

const registry = ref<Map<string, AppExtension>>(new Map())

/**
 * 工作台应用扩展注册表。
 * 在插件或应用初始化时调用 register() 注册扩展，首页与 AppPanel 据此渲染入口和内容。
 */
export function useAppExtensions() {
  /** 注册一个应用扩展；同一 id 重复注册会覆盖 */
  function register(ext: AppExtension) {
    const next = new Map(registry.value)
    next.set(ext.id, ext)
    registry.value = next
  }

  /** 按 id 取消注册 */
  function unregister(id: string) {
    const next = new Map(registry.value)
    next.delete(id)
    registry.value = next
  }

  /** 已注册扩展列表（按 order 升序，未设 order 的排在后面） */
  const list = computed<AppExtension[]>(() => {
    const arr = Array.from(registry.value.values())
    return arr.sort((a, b) => {
      const oa = a.order ?? 9999
      const ob = b.order ?? 9999
      return oa - ob
    })
  })

  /** 根据 id 获取扩展 */
  function get(id: string): AppExtension | undefined {
    return registry.value.get(id)
  }

  /** 是否存在指定 id 的扩展 */
  function has(id: string): boolean {
    return registry.value.has(id)
  }

  return {
    list,
    register,
    unregister,
    get,
    has,
  }
}
