import React from 'react';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { PageFooter } from '@/components/PageFooter';

/**
 * 工作台布局壳：顶栏含主题切换，主区为子内容，底栏为页脚
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-end gap-2 border-b border-border px-3 py-2">
        <ThemeSwitcher />
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        <PageFooter />
      </div>
    </div>
  );
}
