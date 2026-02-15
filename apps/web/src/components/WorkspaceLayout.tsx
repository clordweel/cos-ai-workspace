import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';
import { useAppViewContext } from '../contexts/AppViewContext';
import { useTheme } from '../hooks/useTheme';

/** 断点 md (768px) 以上显示应用区与底栏 */
function useMediaMd() {
  const [md, setMd] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setMd(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return md;
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { isPanelOpen, isContentVisible, toggleContentPanel } = useAppViewContext();
  const md = useMediaMd();
  const showAppPanel = isPanelOpen && md;

  return (
    <div className="h-screen min-h-0 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex flex-col">
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* 顶栏：品牌 + 主题切换 */}
        <header
          className="shrink-0 h-14 flex items-center justify-center px-4 w-full border-b border-zinc-200 dark:border-zinc-700"
          role="banner"
          aria-label="产品"
        >
          <div className="flex items-center justify-between w-full max-w-[1600px]">
            <a
              href="/space"
              className="flex items-center gap-2 min-w-0 rounded-lg py-1.5 px-2 -mx-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-offset-zinc-900"
            >
              <span className="text-sm font-semibold">COS&AI</span>
              <span className="hidden sm:inline text-sm font-medium text-zinc-500 dark:text-zinc-400 border-l border-zinc-300 dark:border-zinc-600 pl-2">
                智能交互工作台
              </span>
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? '切换到浅色' : '切换到深色'}
              title={theme === 'dark' ? '浅色模式' : '深色模式'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {/* 会话区 + 应用区 两栏 */}
        <div
          className="flex-1 grid min-h-0 px-3 pt-0 pb-2 gap-3"
          style={{
            gridTemplateColumns: showAppPanel ? (isContentVisible ? '1fr minmax(0, 360px)' : '1fr 48px') : '1fr',
            gridTemplateRows: 'minmax(0, 1fr)',
          }}
        >
          {/* 左栏：会话区 */}
          <div className="h-full min-h-0 w-full min-w-0 flex flex-col overflow-hidden">
            <div className="h-full min-h-0 w-full min-w-0 flex flex-col overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
              {children}
            </div>
          </div>

          {/* 右栏：应用区（md+ 且打开时显示） */}
          {showAppPanel && (
            <section
              className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 min-w-0"
              aria-label="应用区"
            >
              <div className="shrink-0 flex items-center justify-end py-1 pr-2">
                <button
                  type="button"
                  onClick={toggleContentPanel}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  title={isContentVisible ? '折叠内容区' : '展开内容区'}
                  aria-label="切换应用内容区"
                >
                  {isContentVisible ? '◧' : '▢'}
                </button>
              </div>
              {isContentVisible && (
                <div className="flex-1 min-h-0 overflow-auto p-3 text-sm text-zinc-500 dark:text-zinc-400">
                  应用区占位。联系人、机器人、设置等（阶段 2.4 起实现）。
                </div>
              )}
            </section>
          )}
        </div>

        {/* 底栏：md+ 显示 */}
        {md && (
          <footer
            className="shrink-0 flex flex-col items-center justify-center gap-1.5 min-h-20 px-4 py-3 text-xs border-t border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
            role="contentinfo"
            aria-label="页脚"
          >
            <p className="m-0">
              © {new Date().getFullYear()} COS&AI · 智能交互工作台
            </p>
            <nav className="flex items-center justify-center gap-4" aria-label="底栏链接">
              <a href="/space" className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                首页
              </a>
            </nav>
          </footer>
        )}
      </main>
    </div>
  );
}
