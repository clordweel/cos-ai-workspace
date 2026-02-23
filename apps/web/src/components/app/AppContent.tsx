'use client';

import { LogOut, RefreshCw } from 'lucide-react';
import type { AppTab } from '@/constants/appView';
import { AuthPanel } from '@/components/AuthPanel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HomeContent } from '@/components/app/HomeContent';
import { MemoTestApp } from '@/components/app/testApps/MemoTestApp';
import { TaskTestApp } from '@/components/app/testApps/TaskTestApp';

export interface AppContentProps {
  /** 当前选中的标签，为 null 时显示首页占位 */
  activeTab: AppTab | null;
  user: { name?: string; email?: string; avatar?: string } | null;
  reAuthLoading?: boolean;
  onReAuth?: () => void;
  onLogout?: () => void;
  /** 打开应用（view=app 时用 appId 打开；首页卡片调用以打开测试应用） */
  onOpenApp?: (appId: string) => void;
}

export function AppContent({
  activeTab,
  user,
  reAuthLoading = false,
  onReAuth,
  onLogout,
  onOpenApp,
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
            {user.email ? (
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
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

  if (view === 'auth') {
    return <AuthPanel className="min-h-full" />;
  }

  if (view === 'contacts' || view === 'bots' || view === 'settings') {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {view === 'contacts' && '联系人功能开发中'}
        {view === 'bots' && '机器人功能开发中'}
        {view === 'settings' && '设置功能开发中'}
      </div>
    );
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
    return <HomeContent onOpenApp={onOpenApp} />;
  }

  return <div className="min-h-full p-4" />;
}
