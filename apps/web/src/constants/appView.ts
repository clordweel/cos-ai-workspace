/**
 * 应用区视图与标签类型（与 frontend useAppViewConstants 对齐）
 */

export type AppView =
  | 'home'
  | 'contacts'
  | 'bots'
  | 'settings'
  | 'auth'
  | 'profile'
  | 'app'
  | 'connected-services'
  | 'system-config'
  | 'user-management'
  | 'role-management';

export interface AppTab {
  id: string;
  view: AppView;
  title: string;
  appId?: string;
  /** 认证标签：未登录时不可关闭 */
  isAuthRequired?: boolean;
}

export const VIEW_TITLES: Record<Exclude<AppView, 'app'>, string> = {
  home: '导航页',
  contacts: '联系人',
  bots: '机器人',
  settings: '设置',
  auth: '认证登录',
  profile: '用户信息',
  'connected-services': '授权管理',
  'system-config': '系统配置',
  'user-management': '用户管理',
  'role-management': '角色管理',
};

/** 只能创建一次的视图：再次激活时跳转到已有标签，不新建 */
export const SINGLE_INSTANCE_VIEWS: readonly AppView[] = [
  'profile',
  'settings',
  'auth',
  'connected-services',
  'system-config',
  'user-management',
  'role-management',
];

export function isSingleInstanceView(view: AppView): boolean {
  return (SINGLE_INSTANCE_VIEWS as readonly string[]).includes(view);
}

export const defaultHomeTab: AppTab = {
  id: 'tab-home-default',
  view: 'home',
  title: '导航页',
};

/** 已知应用 ID 的展示名（测试应用等） */
const APP_DISPLAY_NAMES: Record<string, string> = {
  'memo-test': '备忘录',
  'task-test': '测试任务',
};

export function getViewTitle(view: AppView, appId?: string): string {
  if (view === 'app' && appId) return APP_DISPLAY_NAMES[appId] ?? appId;
  return VIEW_TITLES[view] ?? view;
}
