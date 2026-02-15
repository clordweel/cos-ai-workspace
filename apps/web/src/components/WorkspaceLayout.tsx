import React from 'react';

/**
 * 工作台布局壳：仅包裹子内容，界面已清空待重写
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen min-h-0 flex flex-col bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
