/**
 * 应用侧栏（FRONTEND_SPEC：可折叠、悬停展开、固定）
 * 宽度 w-44 展开 / w-12 折叠，200ms 过渡；文字展开后 140ms 淡入
 */
import React, { useEffect, useState } from 'react';
import { Home, Users, Bot, Settings, LogIn, Plus } from 'lucide-react';
import { useAppViewContext } from '../contexts/AppViewContext';
import type { AppView } from '../constants/appView';

const APP_NAV: { view: AppView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { view: 'settings', label: '设置', icon: Settings },
  { view: 'home', label: '首页', icon: Home },
  { view: 'contacts', label: '联系人', icon: Users },
  { view: 'bots', label: '机器人', icon: Bot },
  { view: 'auth', label: '认证', icon: LogIn },
];

const TEXT_FADE_DELAY_MS = 140;

export function WorkspaceAppNav() {
  const {
    isSidebarExpanded,
    currentView,
    openView,
    scheduleSidebarExpand,
    scheduleSidebarLeave,
  } = useAppViewContext();
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    if (isSidebarExpanded) {
      const t = setTimeout(() => setShowText(true), TEXT_FADE_DELAY_MS);
      return () => clearTimeout(t);
    }
    setShowText(false);
  }, [isSidebarExpanded]);

  return (
    <nav
      className="shrink-0 flex flex-col min-h-0 border-r border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 transition-[width] duration-200 ease-out w-12 overflow-hidden"
      style={{
        width: isSidebarExpanded ? '11rem' : '3rem',
        contain: 'layout style',
      }}
      aria-label="应用侧栏"
      onMouseEnter={scheduleSidebarExpand}
      onMouseLeave={scheduleSidebarLeave}
    >
      <div className="flex flex-col py-2 min-h-0 flex-1">
        {APP_NAV.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            type="button"
            onClick={() => openView(view)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg mx-1.5 my-0.5 transition-colors min-h-[2.25rem] ${
              currentView === view
                ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
            } ${isSidebarExpanded ? 'justify-start' : 'justify-center px-0'}`}
            title={label}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {showText && isSidebarExpanded && (
              <span className="truncate text-left opacity-100 transition-opacity duration-150">
                {label}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-700 py-1">
        <button
          type="button"
          onClick={() => openView('home')}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg mx-1.5 w-full transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 min-h-[2.25rem] ${
            isSidebarExpanded ? 'justify-start' : 'justify-center px-0'
          }`}
          title="新标签"
        >
          <Plus className="h-4 w-4 shrink-0" />
          {showText && isSidebarExpanded && (
            <span className="truncate text-left opacity-100 transition-opacity duration-150">新标签</span>
          )}
        </button>
      </div>
    </nav>
  );
}
