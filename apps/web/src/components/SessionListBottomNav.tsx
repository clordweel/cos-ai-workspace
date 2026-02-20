'use client';

import { Archive, MessagesSquare, Settings, User } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export type ListViewTab = 'me' | 'active' | 'favorites' | 'settings';

const TAB_ORDER: ListViewTab[] = ['me', 'active', 'favorites', 'settings'];

/** 与 frontend SessionListBottomNav.vue 一致：静止为短横条，过渡时伸长再滑动 */
const INDICATOR_TRANSITION_MS = 250;
const SHORT_BAR_WIDTH = 12; // w-3，静止时宽度
const LONG_BAR_WIDTH = 24;  // w-6，过渡时伸长宽度

export function SessionListBottomNav({
  value,
  onChange,
  userAvatar,
  userName,
  className,
}: {
  value: ListViewTab;
  onChange: (tab: ListViewTab) => void;
  /** 个人中心菜单项展示的用户头像 URL，不传则显示 User 图标 */
  userAvatar?: string | null;
  /** 未登录或无头像时，fallback 显示的首字母（取 name 首字） */
  userName?: string | null;
  className?: string;
}) {
  const navRef = useRef<HTMLDivElement>(null);
  const tab0Ref = useRef<HTMLButtonElement>(null);
  const tab1Ref = useRef<HTMLButtonElement>(null);
  const tab2Ref = useRef<HTMLButtonElement>(null);
  const tab3Ref = useRef<HTMLButtonElement>(null);
  const [indicatorLeft, setIndicatorLeft] = useState(0);
  const [indicatorReady, setIndicatorReady] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const tabIndex = TAB_ORDER.indexOf(value);
  const tabRefs = [tab0Ref, tab1Ref, tab2Ref, tab3Ref];
  const prevIndexRef = useRef(tabIndex);

  const getTabCenter = useCallback(
    (nav: HTMLElement, tab: HTMLElement | null) => {
      if (!nav || !tab) return null;
      const navRect = nav.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      return tabRect.left - navRect.left + tabRect.width / 2;
    },
    []
  );

  const updateIndicatorPosition = useCallback(
    (options?: {
      phase?: 'expand' | 'slide';
      sourceIndex?: number;
      targetIndex?: number;
    }) => {
      const nav = navRef.current;
      const tabs = tabRefs.map((r) => r.current);
      if (!nav || tabs.some((t) => !t)) return;

      const phase = options?.phase;
      const sourceIndex = options?.sourceIndex ?? tabIndex;
      const targetIndex = options?.targetIndex ?? tabIndex;

      if (phase === 'expand') {
        const sourceCenter = getTabCenter(nav, tabs[sourceIndex] ?? null);
        const targetCenter = getTabCenter(nav, tabs[targetIndex] ?? null);
        if (sourceCenter == null || targetCenter == null) return;
        const movingRight = targetIndex > sourceIndex;
        setIndicatorLeft(
          Math.round(
            movingRight
              ? sourceCenter - SHORT_BAR_WIDTH / 2
              : sourceCenter - LONG_BAR_WIDTH + SHORT_BAR_WIDTH / 2
          )
        );
        setIndicatorReady(true);
        return;
      }

      if (phase === 'slide') {
        const targetCenter = getTabCenter(nav, tabs[targetIndex] ?? null);
        if (targetCenter == null) return;
        setIndicatorLeft(Math.round(targetCenter - LONG_BAR_WIDTH / 2));
        return;
      }

    // 静止态：短横条居中于当前 tab（与 frontend 一致，不依赖 isTransitioning 避免 React 批处理导致收尾错误）
    const center = getTabCenter(nav, tabs[tabIndex] ?? null);
    if (center == null) return;
    setIndicatorLeft(Math.round(center - SHORT_BAR_WIDTH / 2));
    setIndicatorReady(true);
  },
  [tabIndex, getTabCenter]
);

  useLayoutEffect(() => {
    updateIndicatorPosition();
  }, [value, updateIndicatorPosition]);

  // 切换 tab 时：expand（短条朝目标方向伸长）→ slide（长条滑到目标中心）→ 收尾为短条居中（与 frontend watch + nextTick + setTimeout 一致）
  useEffect(() => {
    const newIndex = tabIndex;
    const prevIndex = prevIndexRef.current;
    if (prevIndex === newIndex) return;
    prevIndexRef.current = newIndex;
    setIsTransitioning(true);
    updateIndicatorPosition({
      phase: 'expand',
      sourceIndex: prevIndex,
      targetIndex: newIndex,
    });
    const raf = requestAnimationFrame(() => {
      updateIndicatorPosition({ phase: 'slide', targetIndex: newIndex });
    });
    const t = setTimeout(() => {
      setIsTransitioning(false);
      // 收尾：短条居中于当前 tab（在下一帧执行，确保 isTransitioning 已提交）
      requestAnimationFrame(() => {
        updateIndicatorPosition();
      });
    }, INDICATOR_TRANSITION_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [value, tabIndex, updateIndicatorPosition]);

  const activeClass =
    'text-zinc-800 dark:text-zinc-100 bg-white/90 dark:bg-zinc-600/80 ring-1 ring-primary-200/50 dark:ring-primary-400/25';
  const inactiveClass =
    'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-zinc-600/40';

  return (
    <nav
      ref={navRef}
      className={cn(
        'absolute bottom-2 left-1/2 z-10 flex h-11 w-fit -translate-x-1/2 items-end justify-center gap-1 rounded-2xl border border-zinc-200/80 bg-white/50 px-2 pb-1 pt-2 backdrop-blur-xl transition-all duration-300 ease-out dark:border-white/10 dark:bg-zinc-800/40',
        className
      )}
      aria-label="会话列表视图"
    >
      <button
        ref={tab0Ref}
        type="button"
        className={cn(
          'session-list-tab relative flex h-8 w-10 flex-col items-center justify-center gap-0 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95',
          value === 'me' ? activeClass : inactiveClass
        )}
        aria-label="用户中心"
        onClick={() => onChange('me')}
      >
        {userAvatar != null || userName != null ? (
          <Avatar
            className={cn(
              'shrink-0 border-0 ring-1 ring-zinc-200/60 dark:ring-zinc-500/40',
              value === 'me' ? '!rounded-xl' : 'h-6 w-6 rounded-full'
            )}
            style={value === 'me' ? { width: 'inherit', height: 'inherit' } : undefined}
          >
            {userAvatar && <AvatarImage src={userAvatar} alt="" />}
            <AvatarFallback className={cn(value === 'me' ? '!rounded-xl text-xs font-medium' : 'text-[10px] font-medium')}>
              {userName?.trim()?.[0]?.toUpperCase() ?? '?'}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span
            className={cn(
              'flex shrink-0 items-center justify-center bg-muted dark:bg-zinc-600/60',
              value === 'me'
                ? 'rounded-xl border-2 border-white ring-1 ring-zinc-200/60 dark:ring-zinc-500/40'
                : 'h-6 w-6 rounded-full'
            )}
            style={value === 'me' ? { width: 'inherit', height: 'inherit' } : undefined}
          >
            <User className={cn(value === 'me' ? 'h-5 w-5' : 'h-4 w-4', value === 'me' && 'drop-shadow-sm')} />
          </span>
        )}
      </button>
      <button
        ref={tab1Ref}
        type="button"
        className={cn(
          'session-list-tab relative flex h-8 w-10 flex-col items-center justify-center gap-0 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95',
          value === 'active' ? activeClass : inactiveClass
        )}
        aria-label="活动聊天"
        onClick={() => onChange('active')}
      >
        <MessagesSquare
          className={cn('h-4 w-4 shrink-0', value === 'active' && 'drop-shadow-sm')}
        />
      </button>
      <button
        ref={tab2Ref}
        type="button"
        className={cn(
          'session-list-tab relative flex h-8 w-10 flex-col items-center justify-center gap-0 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95',
          value === 'favorites' ? activeClass : inactiveClass
        )}
        aria-label="收藏归档"
        onClick={() => onChange('favorites')}
      >
        <Archive
          className={cn('h-4 w-4 shrink-0', value === 'favorites' && 'drop-shadow-sm')}
        />
      </button>
      <button
        ref={tab3Ref}
        type="button"
        className={cn(
          'session-list-tab relative flex h-8 w-10 flex-col items-center justify-center gap-0 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95',
          value === 'settings' ? activeClass : inactiveClass
        )}
        aria-label="设置"
        onClick={() => onChange('settings')}
      >
        <Settings
          className={cn('h-4 w-4 shrink-0', value === 'settings' && 'drop-shadow-sm')}
        />
      </button>
      {/* 滑动指示器：与 frontend 一致 — 静止短条(w-3)、过渡伸长(w-6)再滑动 */}
      {indicatorReady && (
        <span
          className={cn(
            'session-list-indicator absolute bottom-1 left-0 z-10 h-0.5 rounded-full pointer-events-none',
            isTransitioning ? 'w-6' : 'w-3'
          )}
          style={{
            transform: `translateX(${indicatorLeft}px)`,
            transition:
              'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          aria-hidden
        />
      )}
    </nav>
  );
}
