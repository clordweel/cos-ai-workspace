'use client';

import {
  Home,
  LayoutGrid,
  LogIn,
  MessageCircle,
  PanelRightClose,
  Pin,
  Plus,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import type { AppTab, AppView } from '@/constants/appView';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

const VIEW_ICONS: Record<AppView, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  home: Home,
  profile: User,
  auth: LogIn,
  contacts: Users,
  bots: MessageCircle,
  settings: Settings,
  app: LayoutGrid,
  'connected-services': Settings,
  'system-config': Shield,
  'user-management': Users,
  'role-management': UserCog,
};

export interface AppTagsBarProps {
  tabs: AppTab[];
  activeTabId: string | null;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string, options?: { force?: boolean }) => void;
  onNewTab: () => void;
  onOpenProfile: () => void;
  isTagBarExpanded: boolean;
  appAreaCollapsed: boolean;
  onToggleCollapse: (pressed: boolean) => void;
  appTagsBarPinned: boolean;
  onTogglePin: (pressed: boolean) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  user: { name?: string; email?: string; avatar?: string } | null;
}

export function AppTagsBar({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onNewTab,
  onOpenProfile,
  isTagBarExpanded,
  appAreaCollapsed,
  onToggleCollapse,
  appTagsBarPinned,
  onTogglePin,
  onMouseEnter,
  onMouseLeave,
  user,
}: AppTagsBarProps) {
  return (
    <aside
      className={cn(
        'group flex shrink-0 flex-col overflow-hidden rounded-l-2xl bg-transparent transition-[width] duration-200 ease-out',
        'pr-2', /* 右侧留出间距，与主内容区隔开，避免滚动条贴边 */
        appTagsBarPinned ? 'w-[220px]' : 'w-[52px] hover:w-[220px]'
      )}
      aria-label="应用标签栏"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className={cn(
          'flex shrink-0 items-center gap-1 px-2 pb-2 pt-2',
          isTagBarExpanded ? 'justify-between' : 'justify-center'
        )}
      >
        <Toggle
          pressed={appAreaCollapsed}
          onPressedChange={onToggleCollapse}
          size="sm"
          className="rounded-md p-1 text-black dark:text-white"
          aria-label={appAreaCollapsed ? '展开应用区' : '折叠应用区'}
          title={appAreaCollapsed ? '展开应用区' : '折叠应用区'}
        >
          <PanelRightClose className="h-4 w-4" aria-hidden />
        </Toggle>
        {isTagBarExpanded && (
          <Toggle
            pressed={appTagsBarPinned}
            onPressedChange={onTogglePin}
            size="sm"
            className="rounded-md p-1 text-black dark:text-white"
            aria-label={appTagsBarPinned ? '取消固定标签栏' : '固定标签栏'}
            title={appTagsBarPinned ? '取消固定标签栏' : '固定标签栏'}
          >
            <Pin className={cn('h-4 w-4', appTagsBarPinned && '-rotate-45')} aria-hidden />
          </Toggle>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="app-tags-bar-scroll -mr-2 min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-0.5">
          {tabs.map((tab) => {
            const Icon = VIEW_ICONS[tab.view];
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className={cn(
                  'flex h-8 w-full cursor-pointer items-center gap-2 rounded-md text-left text-[12px] font-medium text-black transition-[background-color,border-color,color,padding] duration-150 ease-out dark:text-white',
                  'hover:bg-zinc-200 dark:hover:bg-zinc-600/90',
                  isTagBarExpanded ? 'min-w-0 justify-start px-3' : 'justify-center px-2',
                  isActive && 'bg-white dark:bg-white/10',
                  isActive && isTagBarExpanded && 'border-l-2 border-primary pl-[10px]'
                )}
                role="button"
                tabIndex={0}
                onClick={() => onSwitchTab(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSwitchTab(tab.id);
                  }
                }}
                aria-label={tab.title}
                aria-current={isActive ? 'true' : undefined}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
                {isTagBarExpanded && (
                  <>
                    <span className="min-w-0 flex-1 truncate">{tab.title}</span>
                    {(!tab.isAuthRequired || user) && (
                      <button
                        type="button"
                        className="shrink-0 rounded p-0.5 hover:bg-zinc-300 dark:hover:bg-zinc-500"
                        aria-label={`关闭 ${tab.title}`}
onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(tab.id, tab.isAuthRequired && user ? { force: true } : undefined);
                      }}
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="shrink-0 border-t-2 border-border pt-1 space-y-0.5">
          <button
            type="button"
            className={cn(
              'flex h-8 w-full cursor-pointer items-center gap-2 text-left text-[12px] text-black transition-colors dark:text-white',
              'hover:text-zinc-500 dark:hover:text-zinc-400',
              isTagBarExpanded ? 'justify-start rounded-[11px] px-3' : 'justify-center rounded-[46px] px-2'
            )}
            onClick={onNewTab}
            aria-label="创建新标签"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            {isTagBarExpanded && <span className="truncate">创建新标签</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
