'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { PageFooter } from '@/components/PageFooter';
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
  { value: 'home', label: '返回首页' },
  { value: 'workspace', label: '打开工作区' },
  { value: 'theme', label: '切换主题' },
] as const;

/**
 * 工作台布局壳：顶栏含命令面板、返回首页（非首页时显示）、主题切换，主区为子内容，底栏为页脚
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isHome = pathname === '/' || pathname === '';
  const [commandOpen, setCommandOpen] = useState(false);

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
      if (value === 'home') navigate('/');
      if (value === 'workspace') navigate('/space');
      if (value === 'theme') {
        document.querySelector<HTMLButtonElement>('button[aria-label="切换主题"]')?.click();
      }
    },
    [navigate]
  );

  return (
    <div className="flex h-screen min-h-0 flex-col bg-white text-foreground dark:bg-background">
      <header className="flex shrink-0 items-center justify-between gap-2 bg-transparent px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center justify-start">
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
