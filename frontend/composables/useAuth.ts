/** /api/auth/me 可能返回的用户对象（Logto 等提供 name/email/avatar） */
export interface AuthUserProfile {
  name: string
  email?: string
  avatar?: string
}

/** 当前用户：字符串（用户名）或完整资料对象 */
export type AuthUser = string | AuthUserProfile | null

const isAuthenticated = ref(false)
const user = ref<AuthUser>(null)
/** 稳定用户 id，供会话等多用户隔离使用（Logto 为 sub，其余为用户名），未登录为空 */
const userId = ref<string>('')
const authLoading = ref(true)
/** 当前用户权限列表，由 /api/auth/me 的 data.permissions 同步，未实现时为空数组 */
const permissions = ref<string[]>([])
/** 用户偏好（来自 Logto customData），仅 Logto 登录时有值 */
const preferences = ref<Record<string, unknown>>({})
/** Matrix sync 用 token（混合方案：仅用于前端 sync/typing/已读），来自 /api/auth/me */
const matrixSyncToken = ref<string>('')
/** Matrix 服务 base URL，与 matrixSyncToken 配套 */
const matrixBaseUrl = ref<string>('')
/** 当前用户 MXID（与 matrixSyncToken 配套，用于 createClient） */
const matrixUserId = ref<string>('')

export function useAuth() {
  const apiBase = useApiBase()

  /** 拉取当前用户（带 Cookie），用于初始化与 Logto 回调后刷新 */
  async function fetchUser() {
    authLoading.value = true
    try {
      const res = await fetch(`${apiBase}/api/auth/me`, { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok && data.user) {
        isAuthenticated.value = true
        user.value = data.user
        userId.value = typeof (data as { userId?: string }).userId === 'string' ? (data as { userId: string }).userId : ''
        permissions.value = Array.isArray((data as { permissions?: string[] }).permissions)
          ? (data as { permissions: string[] }).permissions
          : []
        preferences.value = (data as { preferences?: Record<string, unknown> }).preferences ?? {}
        matrixSyncToken.value = typeof (data as { matrixSyncToken?: string }).matrixSyncToken === 'string'
          ? (data as { matrixSyncToken: string }).matrixSyncToken
          : ''
        matrixBaseUrl.value = typeof (data as { matrix_base_url?: string }).matrix_base_url === 'string'
          ? (data as { matrix_base_url: string }).matrix_base_url
          : ''
        matrixUserId.value = typeof (data as { matrix_user_id?: string }).matrix_user_id === 'string'
          ? (data as { matrix_user_id: string }).matrix_user_id
          : ''
        return true
      }
      isAuthenticated.value = false
      user.value = null
      userId.value = ''
      permissions.value = []
      preferences.value = {}
      matrixSyncToken.value = ''
      matrixBaseUrl.value = ''
      matrixUserId.value = ''
      return false
    } catch {
      isAuthenticated.value = false
      user.value = null
      userId.value = ''
      permissions.value = []
      preferences.value = {}
      matrixSyncToken.value = ''
      matrixBaseUrl.value = ''
      matrixUserId.value = ''
      return false
    } finally {
      authLoading.value = false
    }
  }

  /** 登录：跳转至 Nuxt 承载的 Logto 入口 /logto（当前页同源），由前端发起授权并接收回调 */
  function login() {
    if (typeof window === 'undefined') return
    window.location.href = `${window.location.origin}/logto`
  }

  /** 登出 */
  async function logout(): Promise<void> {
    try {
      await fetch(`${apiBase}/api/auth/logout`, { method: 'POST', credentials: 'include' })
    } finally {
      isAuthenticated.value = false
      user.value = null
      userId.value = ''
      permissions.value = []
      preferences.value = {}
      matrixSyncToken.value = ''
      matrixBaseUrl.value = ''
      matrixUserId.value = ''
    }
  }

  /**
   * 需要认证时调用：若未登录则打开应用区「认证登录」标签并聚焦
   * 由布局/页面在 401 或进入需认证能力时调用
   */
  function requireAuth(): boolean {
    if (isAuthenticated.value) return true
    const { openAuthTab } = useAppView()
    openAuthTab()
    return false
  }

  /** 更新本地 preferences 缓存（由 useUserPreferences 在 PATCH 成功后调用） */
  function setPreferences(data: Record<string, unknown>) {
    preferences.value = data
  }

  return {
    isAuthenticated: readonly(isAuthenticated),
    user: readonly(user),
    userId: readonly(userId),
    authLoading: readonly(authLoading),
    permissions: readonly(permissions),
    preferences: readonly(preferences),
    matrixSyncToken: readonly(matrixSyncToken),
    matrixBaseUrl: readonly(matrixBaseUrl),
    matrixUserId: readonly(matrixUserId),
    fetchUser,
    login,
    logout,
    requireAuth,
    setPreferences,
  }
}
