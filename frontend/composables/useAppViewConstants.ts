/**
 * 应用区视图与标签的类型与默认常量（供 useAppView 使用）
 */
export type AppView = 'home' | 'contacts' | 'bots' | 'settings' | 'auth' | 'profile' | 'app'

/** 侧栏「标签」：类似浏览器标签，可多开、切换、关闭 */
export interface AppTab {
  id: string
  view: AppView
  title: string
  appId?: string
  /** 认证标签：未登录时不可关闭 */
  isAuthRequired?: boolean
}

export const VIEW_TITLES: Record<Exclude<AppView, 'app'>, string> = {
  home: '首页',
  contacts: '联系人',
  bots: '机器人',
  settings: '设置',
  auth: '认证登录',
  profile: '用户信息',
}

/** 只能创建一次的视图：再次激活时跳转到已有标签，不新建（如设置、用户信息、认证） */
export const SINGLE_INSTANCE_VIEWS: readonly AppView[] = ['profile', 'settings', 'auth']

export function isSingleInstanceView(view: AppView): boolean {
  return (SINGLE_INSTANCE_VIEWS as readonly string[]).includes(view)
}

export const defaultProfileTab: AppTab = { id: 'tab-profile-default', view: 'profile', title: '用户信息' }
export const defaultSettingsTab: AppTab = { id: 'tab-settings-default', view: 'settings', title: '设置' }
export const defaultHomeTab: AppTab = { id: 'tab-home-default', view: 'home', title: '首页' }
