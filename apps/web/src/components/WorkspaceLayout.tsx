'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { PageFooter } from '@/components/PageFooter';
import { IconCos } from '@/components/icons/IconCos';
import { IconCosAi } from '@/components/icons/IconCosAi';
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandDialogTrigger,
  CommandCollection,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from '@/components/ui/command';

const COMMAND_ITEMS = [
  { value: 'workspace', label: '工作空间管理' },
  { value: 'theme', label: '切换主题' },
] as const;

/** 至少播完一轮图标路径动画（与 frontend 一致）后才允许退出 */
const ICON_CYCLE_MS = 3200;
/** 前端资源加载完毕（window load）后退出；若超时未触发则兜底退出 */
const LOADING_MAX_MS = 8000;

/**
 * 工作台布局壳：顶栏含工作空间管理（左）、命令面板（中）、主题切换（右），主区为子内容，底栏为页脚；参考 Element 左侧工具栏
 * 首屏 loading：资源加载完毕且至少动画播放一遍后退出
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [commandOpen, setCommandOpen] = useState(false);
  const [loadComplete, setLoadComplete] = useState(false);
  const [animationCycleDone, setAnimationCycleDone] = useState(false);
  const [loadingPlayTrigger, setLoadingPlayTrigger] = useState(0);

  const showLoadingOverlay = !(loadComplete && animationCycleDone);
  const prevOverlayRef = useRef(false);

  useEffect(() => {
    if (showLoadingOverlay && !prevOverlayRef.current) setLoadingPlayTrigger((t) => t + 1);
    prevOverlayRef.current = showLoadingOverlay;
  }, [showLoadingOverlay]);

  // 条件一：至少动画播放一遍（3.2s）
  useEffect(() => {
    const t = setTimeout(() => setAnimationCycleDone(true), ICON_CYCLE_MS);
    return () => clearTimeout(t);
  }, []);

  // 条件二：前端资源加载完毕（window load）；已 complete 则立即满足，并设最大等待兜底
  useEffect(() => {
    const onLoad = () => setLoadComplete(true);
    if (document.readyState === 'complete') {
      setLoadComplete(true);
      return;
    }
    window.addEventListener('load', onLoad);
    const fallback = setTimeout(() => {
      setLoadComplete(true);
    }, LOADING_MAX_MS);
    return () => {
      window.removeEventListener('load', onLoad);
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleCommandSelect = useCallback(
    (value: string | null) => {
      setCommandOpen(false);
      if (value === 'workspace') navigate('/space');
      if (value === 'theme') {
        document.querySelector<HTMLButtonElement>('button[aria-label="切换主题"]')?.click();
      }
    },
    [navigate]
  );

  return (
    <div className="flex h-screen min-h-0 flex-col bg-white text-foreground dark:bg-background">
      {/* 刷新/首屏加载过场：鉴权完成且至少播完一轮图标路径动画后再进入主界面（与 frontend 一致） */}
      {showLoadingOverlay && (
        <div
          className="app-loading-overlay fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-zinc-50/80 text-zinc-600 backdrop-blur-sm dark:bg-zinc-900/80 dark:text-zinc-400"
          aria-live="polite"
          aria-busy="true"
          role="status"
        >
          <div className="flex w-[140px] flex-col items-center justify-center gap-5 opacity-100">
            <IconCos
              size={100}
              color="currentColor"
              className="shrink-0 text-zinc-700 dark:text-zinc-200"
              playTrigger={loadingPlayTrigger}
            />
            <IconCosAi
              width={120}
              height={20}
              color="currentColor"
              className="shrink-0 text-zinc-800 dark:text-zinc-100"
              playTrigger={loadingPlayTrigger}
              loop
            />
          </div>
        </div>
      )}
      <header className="flex shrink-0 items-center justify-between gap-2 bg-transparent px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center justify-start gap-0.5">
          <button
            type="button"
            onClick={() => navigate('/space')}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800 dark:hover:text-foreground"
            aria-label="工作空间管理"
          >
            <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">工作空间管理</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/space?create=1')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800 dark:hover:text-foreground"
            aria-label="快速创建新工作空间"
            title="快速创建新工作空间"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
            <CommandDialogTrigger
              className="flex min-w-[20rem] items-center justify-center gap-2 rounded-xl border border-transparent bg-zinc-100 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-zinc-200 hover:text-foreground dark:bg-zinc-800/60 dark:hover:bg-zinc-700/80 dark:hover:text-foreground"
              aria-label="打开命令面板"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden w-full text-left sm:inline">搜索…</span>
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded border border-border bg-muted/50 px-1.5 font-mono text-[10px] font-medium sm:inline-flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </CommandDialogTrigger>
            <CommandDialogPopup>
              <CommandPanel>
                <Command
                  items={[...COMMAND_ITEMS]}
                  onValueChange={(value) => handleCommandSelect(value)}
                  itemToStringLabel={(item) => (typeof item === 'object' && item && 'label' in item ? String(item.label) : String(item))}
                  itemToStringValue={(item) => (typeof item === 'object' && item && 'value' in item ? String(item.value) : String(item))}
                >
                  <CommandInput placeholder="输入命令或搜索…" />
                  <CommandList>
                    <CommandEmpty>无匹配命令</CommandEmpty>
                    <CommandCollection>
                      {(item: (typeof COMMAND_ITEMS)[number], index: number) => (
                        <CommandItem
                          key={item.value}
                          value={item}
                          index={index}
                          onClick={() => handleCommandSelect(item.value)}
                        >
                          {item.label}
                        </CommandItem>
                      )}
                    </CommandCollection>
                  </CommandList>
                </Command>
              </CommandPanel>
            </CommandDialogPopup>
          </CommandDialog>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end">
          <ThemeSwitcher />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
        <PageFooter />
      </div>
    </div>
  );
}
