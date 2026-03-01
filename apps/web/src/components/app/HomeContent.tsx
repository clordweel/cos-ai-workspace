'use client';

import type { AppView } from '@/constants/appView';
import { FileText, ListTodo, Shield, Settings, Users, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HomeContentProps {
  /** 打开指定应用（用于测试应用入口） */
  onOpenApp?: (appId: string) => void;
  /** 打开指定视图（系统配置、用户管理、角色管理等） */
  onOpenView?: (view: AppView, appId?: string) => void;
  /** 是否为系统管理员（显示超级管理员区块） */
  isSystemAdmin?: boolean;
}

/** 导航页：应用入口与超级管理员入口 */
export function HomeContent({ onOpenApp, onOpenView, isSystemAdmin }: HomeContentProps) {
  const cards = [
    { appId: 'memo-test', title: '备忘录', description: 'ERP 待办列表，新建与关联到当前会话', icon: FileText },
    { appId: 'task-test', title: '测试任务', description: '验证关联：将任务关联到当前会话', icon: ListTodo },
  ];

  const adminEntries: { view: AppView; title: string; description: string; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }> }[] = [
    { view: 'system-config', title: '系统配置', description: '系统级配置与参数', icon: Settings },
    { view: 'user-management', title: '用户管理', description: '查看与管理用户', icon: Users },
    { view: 'role-management', title: '角色管理', description: '查看与管理角色权限', icon: UserCog },
  ];

  return (
    <div className="flex min-h-full flex-col p-6">
      {isSystemAdmin && onOpenView ? (
        <div className="mb-6">
          <h3 className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
            超级管理员
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {adminEntries.map(({ view, title, description, icon: Icon }) => (
              <button
                type="button"
                key={view}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-left dark:border-amber-800 dark:bg-amber-950/30',
                  'transition-colors hover:bg-amber-100/80 hover:border-amber-300 dark:hover:bg-amber-900/40 dark:hover:border-amber-700',
                  'cursor-pointer'
                )}
                onClick={() => onOpenView(view)}
              >
                <Icon className="h-8 w-8 text-amber-600 dark:text-amber-400" aria-hidden />
                <span className="text-sm font-medium text-foreground">{title}</span>
                <span className="text-[10px] text-muted-foreground">{description}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ appId, title, description, icon: Icon }) => (
          <button
            type="button"
            key={appId}
            className={cn(
              'flex flex-col items-start gap-2 rounded-xl border border-border bg-muted/30 p-4 text-left',
              'transition-colors hover:bg-muted/50 hover:border-border/80',
              onOpenApp && 'cursor-pointer'
            )}
            onClick={() => onOpenApp?.(appId)}
            disabled={!onOpenApp}
          >
            <Icon className="h-8 w-8 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium text-foreground">{title}</span>
            <span className="text-[10px] text-muted-foreground">{description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
