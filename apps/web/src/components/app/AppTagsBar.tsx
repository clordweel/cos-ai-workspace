'use client';

import {
  DndContext,
  type DragEndEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
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
  onReorderTabs: (oldIndex: number, newIndex: number) => void;
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

interface SortableTabItemProps {
  tab: AppTab;
  isActive: boolean;
  isTagBarExpanded: boolean;
  user: AppTagsBarProps['user'];
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string, options?: { force?: boolean }) => void;
}

function SortableTabItem({
  tab,
  isActive,
  isTagBarExpanded,
  user,
  onSwitchTab,
  onCloseTab,
}: SortableTabItemProps) {
  const Icon = VIEW_ICONS[tab.view];
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const baseClass = cn(
    'flex h-8 w-full cursor-grab touch-none select-none items-center gap-2 rounded-md text-left text-[12px] font-medium text-black transition-[background-color,border-color,color,padding] duration-150 ease-out dark:text-white',
    'hover:bg-zinc-200 dark:hover:bg-zinc-600/90 active:cursor-grabbing',
    isTagBarExpanded ? 'min-w-0 justify-start pl-3 pr-2' : 'justify-center px-3',
    isActive && 'border border-border bg-white dark:border-zinc-600 dark:bg-white/10',
    isDragging && 'opacity-50'
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={baseClass}
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
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className={cn(
          'flex min-w-0 flex-1 cursor-grab touch-none select-none items-center gap-2 active:cursor-grabbing',
          isTagBarExpanded ? 'justify-start' : 'justify-center'
        )}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
        {isTagBarExpanded && (
          <span className="min-w-0 flex-1 truncate">{tab.title}</span>
        )}
      </div>
      {isTagBarExpanded && (!tab.isAuthRequired || user) && (
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
    </div>
  );
}

export function AppTagsBar({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onReorderTabs,
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
  const tabIds = tabs.map((t) => t.id);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tabs.findIndex((t) => t.id === active.id);
    const newIndex = tabs.findIndex((t) => t.id === over.id);
    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
      onReorderTabs(oldIndex, newIndex);
    }
  };

  return (
    <aside
      className={cn(
        'group flex shrink-0 flex-col overflow-hidden rounded-l-2xl bg-transparent transition-[width] duration-200 ease-out',
        'pr-2', /* 右侧留出间距，与主内容区隔开，避免滚动条贴边 */
        appTagsBarPinned ? 'w-[180px]' : 'w-[48px] hover:w-[180px]'
      )}
      aria-label="应用标签栏"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className={cn(
          'flex shrink-0 items-center gap-1 pb-2 pt-2',
          isTagBarExpanded ? 'justify-between px-2' : 'justify-center px-2'
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext items={tabIds} strategy={verticalListSortingStrategy}>
              {tabs.map((tab) => (
                <SortableTabItem
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  isTagBarExpanded={isTagBarExpanded}
                  user={user}
                  onSwitchTab={onSwitchTab}
                  onCloseTab={onCloseTab}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
        <div className="shrink-0 border-t-2 border-border pt-1 space-y-0.5">
          <button
            type="button"
            className={cn(
              'flex h-8 w-full cursor-pointer items-center gap-2 text-left text-[12px] text-black transition-colors dark:text-white',
              'hover:text-zinc-500 dark:hover:text-zinc-400',
              isTagBarExpanded ? 'justify-start rounded-[11px] px-2' : 'justify-center rounded-[46px] px-2'
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
