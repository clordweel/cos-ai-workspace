'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, LogIn, LogOut, MoreHorizontal, RefreshCw, Settings, User } from 'lucide-react';
import type { AppTab } from '@/constants/appView';
import { getViewTitle } from '@/constants/appView';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface AppContentToolbarProps {
  /** 当前选中的标签，用于面包屑与刷新上下文 */
  activeTab: AppTab | null;
  /** 刷新应用内容区（重新拉取当前视图数据），由父级传入 */
  onRefresh?: () => void;
  /** 可选：点击面包屑「导航页」时切回首页 */
  onGoHome?: () => void;
  /** 可选：菜单「设置」回调 */
  onOpenSettings?: () => void;
  /** 可选：更换账号 / 重新认证授权（弹窗重新登录） */
  onReAuth?: () => void | Promise<void>;
  /** 当前用户（用于工具栏用户入口）；未登录时为 null */
  user?: { name?: string; email?: string; avatar?: string } | null;
  /** 点击用户入口时打开个人中心/登录 */
  onOpenProfile?: () => void;
  /** 退出登录 */
  onLogout?: () => void | Promise<void>;
  className?: string;
}

export function AppContentToolbar({
  activeTab,
  onRefresh,
  onGoHome,
  onOpenSettings,
  onReAuth,
  user = null,
  onOpenProfile,
  onLogout,
  className,
}: AppContentToolbarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const view = activeTab?.view ?? 'home';
  const appId = activeTab?.appId;
  const currentTitle = getViewTitle(view, appId);

  const handleBack = () => {
    window.history.back();
  };

  const handleForward = () => {
    window.history.forward();
  };

  const handleRefresh = () => {
    if (typeof onRefresh === 'function') onRefresh();
  };

  const closeUserMenu = () => setUserMenuOpen(false);

  const handleUserAction = (fn?: () => void) => {
    closeUserMenu();
    fn?.();
  };

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1 border-b border-border bg-muted/30 px-1.5 py-1',
        className
      )}
      role="toolbar"
      aria-label="应用内容区工具栏"
    >
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:!bg-transparent hover:text-foreground"
          onClick={handleBack}
          aria-label="后退"
          title="后退"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:!bg-transparent hover:text-foreground"
          onClick={handleForward}
          aria-label="前进"
          title="前进"
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
      <div className="min-w-0 flex-1 rounded-md bg-muted/60 px-2 py-1 dark:bg-muted/40">
        <Breadcrumb className="h-full overflow-hidden">
          <BreadcrumbList className="h-full flex-1 truncate">
            <BreadcrumbItem>
              {view !== 'home' && onGoHome ? (
                <button
                  type="button"
                  onClick={onGoHome}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground truncate transition-colors"
                >
                  导航页
                </button>
              ) : (
                <BreadcrumbPage className="truncate text-xs font-medium text-muted-foreground">
                  导航页
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {view !== 'home' && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="max-w-[180px] truncate text-xs font-medium text-foreground">
                    {currentTitle}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:!bg-transparent hover:text-foreground"
        onClick={handleRefresh}
        aria-label="刷新当前内容"
        title="刷新当前内容"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
      </Button>
      {onOpenProfile && (
        <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="group flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 transition-colors"
              aria-label={user ? '用户与账户' : '登录'}
              title={user ? user.name || user.email || '用户' : '登录'}
            >
              {user ? (
                <Avatar className="h-5 w-5 border-0 ring-1 ring-border opacity-90 transition-opacity group-hover:opacity-100">
                  {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
                  <AvatarFallback className="text-[10px]">{user.name?.slice(0, 1) ?? '?'}</AvatarFallback>
                </Avatar>
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
                  <User className="h-3.5 w-3.5" aria-hidden />
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" sideOffset={6} className="w-64 p-0 overflow-hidden">
            <div className="flex flex-col">
              <div className="bg-muted/50 px-4 py-3 flex flex-col items-center gap-1.5">
                {user ? (
                  <>
                    <Avatar className="h-12 w-12 border-0 ring-1 ring-border">
                      {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
                      <AvatarFallback className="text-sm">{user.name?.slice(0, 1) ?? '?'}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground truncate w-full text-center">
                      {user.name || user.email || '用户'}
                    </span>
                    {user.email && (
                      <span className="text-xs text-muted-foreground truncate w-full text-center">
                        {user.email}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <User className="h-5 w-5 text-muted-foreground" aria-hidden />
                    </span>
                    <span className="text-sm text-muted-foreground">未登录</span>
                    <span className="text-xs text-muted-foreground">登录后同步偏好与账户信息</span>
                  </>
                )}
              </div>
              <div className="border-t border-border py-1">
                {user ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleUserAction(onOpenProfile)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/70"
                    >
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      个人资料
                    </button>
                    {onReAuth && (
                      <button
                        type="button"
                        onClick={() => handleUserAction(onReAuth)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/70"
                      >
                        <LogIn className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        更换账号
                      </button>
                    )}
                    {onLogout && (
                      <button
                        type="button"
                        onClick={() => handleUserAction(onLogout)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/70"
                      >
                        <LogOut className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        退出登录
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUserAction(onOpenProfile)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/70"
                  >
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    登录
                  </button>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:!bg-transparent hover:text-foreground"
            aria-label="更多操作"
            title="更多操作"
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[140px]">
          {onOpenSettings && (
            <DropdownMenuItem onClick={onOpenSettings}>
              <Settings className="mr-2 h-3.5 w-3.5" aria-hidden />
              设置
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
