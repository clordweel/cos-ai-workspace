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

export const defaultProfileTab: AppTab = { id: 'tab-profile-default', view: 'profile', title: '用户信息' }
export const defaultHomeTab: AppTab = { id: 'tab-home-default', view: 'home', title: '首页' }
