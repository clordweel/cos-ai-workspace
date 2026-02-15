/**
 * 应用区视图与标签类型与常量（阶段 5.1，与现 frontend useAppViewConstants 对照）
 */
export type AppView = 'home' | 'contacts' | 'bots' | 'settings' | 'auth' | 'profile' | 'app';

export interface AppTab {
  id: string;
  view: AppView;
  title: string;
  appId?: string;
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

const SINGLE_INSTANCE_VIEWS: readonly AppView[] = ['profile', 'settings', 'auth'];

export function isSingleInstanceView(view: AppView): boolean {
  return (SINGLE_INSTANCE_VIEWS as readonly string[]).includes(view);
}

export const defaultHomeTab: AppTab = {
  id: 'tab-home-default',
  view: 'home',
  title: '首页',
};
