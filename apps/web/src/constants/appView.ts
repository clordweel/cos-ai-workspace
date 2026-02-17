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
  | 'app';

export interface AppTab {
  id: string;
  view: AppView;
  title: string;
  appId?: string;
  /** 认证标签：未登录时不可关闭 */
  isAuthRequired?: boolean;
}

export const VIEW_TITLES: Record<Exclude<AppView, 'app'>, string> = {
  home: '首页',
  contacts: '联系人',
  bots: '机器人',
  settings: '设置',
  auth: '认证登录',
  profile: '用户信息',
};

/** 只能创建一次的视图：再次激活时跳转到已有标签，不新建 */
export const SINGLE_INSTANCE_VIEWS: readonly AppView[] = [
  'profile',
  'settings',
  'auth',
];

export function isSingleInstanceView(view: AppView): boolean {
  return (SINGLE_INSTANCE_VIEWS as readonly string[]).includes(view);
}

export const defaultHomeTab: AppTab = {
  id: 'tab-home-default',
  view: 'home',
  title: '首页',
};

export function getViewTitle(view: AppView, appId?: string): string {
  if (view === 'app' && appId) return appId;
  return VIEW_TITLES[view] ?? view;
}
