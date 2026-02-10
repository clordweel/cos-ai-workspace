/**
 * 鉴权与权限：免认证 / 需认证 / 分权限 操作的统一入口
 * 详见 docs/FRONTEND_AUTH_AND_PERMISSIONS.md
 */
import type { AppExtension } from '~/types/app-extensions'

export function usePermissions() {
  const auth = useAuth()

  /**
   * 是否拥有某权限（用于分权限 UI：按钮、菜单、路由）
   * 权限列表来自 /api/auth/me 的 permissions，未实现时恒为 false
   */
  function can(permission: string): boolean {
    return auth.permissions.value.includes(permission)
  }

  /**
   * 是否可访问该应用扩展（免认证扩展始终可访问；需认证扩展仅登录后可访问）
   */
  function canAccessApp(app: AppExtension): boolean {
    return !app.requireAuth || auth.isAuthenticated.value
  }

  /**
   * 需要登录时调用：未登录则打开认证标签并返回 false
   */
  function requireAuth(): boolean {
    return auth.requireAuth()
  }

  return {
    /** 是否已登录 */
    isAuthenticated: auth.isAuthenticated,
    /** 当前用户权限列表（只读） */
    permissions: auth.permissions,
    can,
    canAccessApp,
    requireAuth,
  }
}
