/**
 * 工作台可选列表：账套、Dify 应用，供会话级选择器使用
 */
import { ref } from 'vue'

export interface TenantOption {
  id: string
  name: string
}

export interface DifyAppOption {
  id: string
  name: string
}

const tenants = ref<TenantOption[]>([])
const difyApps = ref<DifyAppOption[]>([])
let tenantsLoaded = false
let appsLoaded = false

export function useWorkspaceOptions() {
  const apiBase = useApiBase()

  async function loadTenants(): Promise<void> {
    if (tenantsLoaded) return
    const base = apiBase || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!base) return
    try {
      const res = await fetch(`${base}/api/tenants`, { credentials: 'include' })
      if (!res.ok) return
      const json = (await res.json()) as { tenants?: TenantOption[] }
      tenants.value = json.tenants ?? []
      tenantsLoaded = true
    } catch {
      // 静默失败，保留空列表
    }
  }

  async function loadDifyApps(): Promise<void> {
    if (appsLoaded) return
    const base = apiBase || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!base) return
    try {
      const res = await fetch(`${base}/api/dify-apps`, { credentials: 'include' })
      if (!res.ok) return
      const json = (await res.json()) as { apps?: DifyAppOption[] }
      difyApps.value = json.apps ?? []
      appsLoaded = true
    } catch {
      // 静默失败
    }
  }

  /** 加载全部（进入空间页时调用一次即可） */
  async function loadAll(): Promise<void> {
    await Promise.all([loadTenants(), loadDifyApps()])
  }

  return {
    tenants,
    difyApps,
    loadTenants,
    loadDifyApps,
    loadAll,
  }
}
