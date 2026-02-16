import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { PageFooter } from '@/components/PageFooter';

/**
 * 工作台布局壳：顶栏含返回首页（非首页时显示）、主题切换，主区为子内容，底栏为页脚
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isHome = pathname === '/' || pathname === '';

  return (
    <div className="flex h-screen min-h-0 flex-col bg-white text-foreground dark:bg-background">
      <header className={cn('flex shrink-0 items-center gap-2 bg-transparent px-3 py-2', isHome ? 'justify-end' : 'justify-between')}>
        {!isHome && (
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800 dark:hover:text-foreground"
            aria-label="返回首页"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span>返回首页</span>
          </Link>
        )}
        <ThemeSwitcher />
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
        <PageFooter />
      </div>
    </div>
  );
}
