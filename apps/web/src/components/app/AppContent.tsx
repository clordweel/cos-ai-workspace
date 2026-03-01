'use client';

import { LogOut, RefreshCw, Link2 } from 'lucide-react';
import type { AppTab, AppView } from '@/constants/appView';
import { AuthPanel } from '@/components/AuthPanel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HomeContent } from '@/components/app/HomeContent';
import { MemoTestApp } from '@/components/app/testApps/MemoTestApp';
import { TaskTestApp } from '@/components/app/testApps/TaskTestApp';
import { ConnectedServicesContent } from '@/components/app/ConnectedServicesContent';
import { UserManagementContent } from '@/components/app/UserManagementContent';
import { RoleManagementContent } from '@/components/app/RoleManagementContent';

export interface AppContentProps {
  /** 当前选中的标签，为 null 时显示首页占位 */
  activeTab: AppTab | null;
  user: { name?: string; email?: string; avatar?: string; roles?: Array<{ id: string; name: string; description?: string }> } | null;
  /** 是否为系统管理员（显示超级管理员标记） */
  isSystemAdmin?: boolean;
  reAuthLoading?: boolean;
  onReAuth?: () => void;
  onLogout?: () => void;
  /** 打开应用（view=app 时用 appId 打开；首页卡片调用以打开测试应用） */
  onOpenApp?: (appId: string) => void;
  /** 打开指定视图（如授权管理） */
  onOpenView?: (view: AppView, appId?: string) => void;
}

export function AppContent({
  activeTab,
  user,
  isSystemAdmin = false,
  reAuthLoading = false,
  onReAuth,
  onLogout,
  onOpenApp,
  onOpenView,
}: AppContentProps) {
  const view = activeTab?.view ?? 'home';
  const appId = activeTab?.appId;

  if (view === 'profile') {
    if (user) {
      return (
        <div className="flex min-h-full flex-col items-center p-6">
          <Avatar className="h-16 w-16">
            {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
            <AvatarFallback className="text-lg">{user.name?.slice(0, 1) ?? '?'}</AvatarFallback>
          </Avatar>
          <div className="mt-3 flex min-w-0 flex-col items-center gap-0.5 text-center">
            <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
            {isSystemAdmin ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                超级管理员
              </span>
            ) : null}
            {user.email ? (
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            ) : null}
            {user.roles && user.roles.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap justify-center gap-x-1.5 gap-y-0.5">
                <span className="text-xs text-muted-foreground">角色：</span>
                {user.roles.map((r) => (
                  <span key={r.id} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground" title={r.description}>
                    {r.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="mt-6 flex w-full max-w-sm flex-col gap-2">
            {onReAuth && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                disabled={reAuthLoading}
                onClick={() => {
                  onReAuth();
                }}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', reAuthLoading && 'animate-spin')} aria-hidden />
                {reAuthLoading ? '正在打开…' : '重新授权 / 更换账号'}
              </Button>
            )}
            {onLogout && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={onLogout}
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                退出登录
              </Button>
            )}
          </div>
        </div>
      );
    }
    return <AuthPanel className="min-h-full" />;
  }

  if (view === 'system-config') {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">系统配置</p>
        <p className="mt-1 text-xs text-muted-foreground">仅系统管理员可访问，后续可在此扩展配置项。</p>
      </div>
    );
  }

  if (view === 'auth') {
    return <AuthPanel className="min-h-full" />;
  }

  if (view === 'contacts' || view === 'bots') {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {view === 'contacts' && '联系人功能开发中'}
        {view === 'bots' && '机器人功能开发中'}
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">设置功能开发中</p>
        {onOpenView && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onOpenView('connected-services')}
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            管理已连接服务
          </Button>
        )}
      </div>
    );
  }

  if (view === 'connected-services') {
    return <ConnectedServicesContent />;
  }

  if (view === 'app') {
    if (appId === 'memo-test') return <MemoTestApp />;
    if (appId === 'task-test') return <TaskTestApp />;
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
        未找到该应用或扩展已卸载
      </div>
    );
  }

  if (view === 'home') {
    return (
      <HomeContent
        onOpenApp={onOpenApp}
        onOpenView={onOpenView}
        isSystemAdmin={isSystemAdmin}
      />
    );
  }

  if (view === 'user-management') {
    return <UserManagementContent />;
  }

  if (view === 'role-management') {
    return <RoleManagementContent />;
  }

  return <div className="min-h-full p-4" />;
}
