/**
 * 认证状态与登录方式：用户名密码、Token、Logto SSO；会话由中间层 Cookie 保持
 */
const isAuthenticated = ref(false)
const user = ref<string | null>(null)
const authLoading = ref(true)

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
        return true
      }
      isAuthenticated.value = false
      user.value = null
      return false
    } catch {
      isAuthenticated.value = false
      user.value = null
      return false
    } finally {
      authLoading.value = false
    }
  }

  /** 用户名密码登录 */
  async function loginWithPassword(usr: string, pwd: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usr: usr.trim(), pwd }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        isAuthenticated.value = true
        user.value = data.user
        return { ok: true }
      }
      return { ok: false, error: data.error || '登录失败' }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : '网络错误' }
    }
  }

  /** Token 登录 */
  async function loginWithToken(token: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${apiBase}/api/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        isAuthenticated.value = true
        user.value = data.user
        return { ok: true }
      }
      return { ok: false, error: data.error || 'Token 无效' }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : '网络错误' }
    }
  }

  /** 跳转至 Logto 登录（中间层会 302 到 Logto，回调后重定向回前端） */
  function loginWithLogto() {
    window.location.href = `${apiBase}/api/auth/logto`
  }

  /** 登出 */
  async function logout(): Promise<void> {
    try {
      await fetch(`${apiBase}/api/auth/logout`, { method: 'POST', credentials: 'include' })
    } finally {
      isAuthenticated.value = false
      user.value = null
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

  return {
    isAuthenticated: readonly(isAuthenticated),
    user: readonly(user),
    authLoading: readonly(authLoading),
    fetchUser,
    loginWithPassword,
    loginWithToken,
    loginWithLogto,
    logout,
    requireAuth,
  }
}
