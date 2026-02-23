'use client';

import { FileText, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HomeContentProps {
  /** 打开指定应用（用于测试应用入口） */
  onOpenApp?: (appId: string) => void;
}

/** 首页：导航与测试应用入口 */
export function HomeContent({ onOpenApp }: HomeContentProps) {
  const cards = [
    { appId: 'memo-test', title: '测试备忘录', description: '验证关联：将备忘录关联到当前会话', icon: FileText },
    { appId: 'task-test', title: '测试任务', description: '验证关联：将任务关联到当前会话', icon: ListTodo },
  ];

  return (
    <div className="flex min-h-full flex-col p-6">
      <h2 className="text-sm font-semibold text-foreground mb-1">首页</h2>
      <p className="text-xs text-muted-foreground mb-4">打开下方应用可体验「关联到当前会话」功能。</p>
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
