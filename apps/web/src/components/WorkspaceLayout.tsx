import React, { useEffect, useState } from 'react';
import { Moon, Sun, Home, Users, Bot, Settings, LogIn } from 'lucide-react';
import { Button } from './ui/button';
import { useAppViewContext } from '../contexts/AppViewContext';
import { useTheme } from '../hooks/useTheme';
import { SettingsPanel } from './SettingsPanel';
import type { AppView } from '../constants/appView';

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

const APP_NAV: { view: AppView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { view: 'home', label: '首页', icon: Home },
  { view: 'contacts', label: '联系人', icon: Users },
  { view: 'bots', label: '机器人', icon: Bot },
  { view: 'settings', label: '设置', icon: Settings },
  { view: 'auth', label: '认证', icon: LogIn },
];

function AppPanelContent({ currentView }: { currentView: AppView }) {
  switch (currentView) {
    case 'home':
      return (
        <div className="text-zinc-600 dark:text-zinc-400 space-y-2">
          <p>欢迎使用智能交互工作台。</p>
          <p className="text-xs">更多扩展应用将在此展示（阶段 5.4 扩展入口）。</p>
        </div>
      );
    case 'contacts':
      return <p className="text-zinc-500 dark:text-zinc-400">联系人列表（待对接 API）。</p>;
    case 'bots':
      return <p className="text-zinc-500 dark:text-zinc-400">机器人列表（待对接 API）。</p>;
    case 'settings':
      return (
        <div className="p-4">
          <SettingsPanel />
        </div>
      );
    case 'auth':
      return (
        <div className="text-zinc-600 dark:text-zinc-400 space-y-2">
          <p>认证登录。</p>
          <a href="/logto" className="text-primary-600 dark:text-primary-400 hover:underline">
            前往 Logto 登录
          </a>
        </div>
      );
    case 'profile':
      return <p className="text-zinc-500 dark:text-zinc-400">用户信息（待实现）。</p>;
    case 'app':
      return <p className="text-zinc-500 dark:text-zinc-400">应用扩展（阶段 5.4）。</p>;
    default:
      return null;
  }
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const {
    isPanelOpen,
    isContentVisible,
    toggleContentPanel,
    tabs,
    activeTabId,
    currentView,
    openView,
    switchTab,
    closeTab,
  } = useAppViewContext();
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
              {/* 侧栏导航：首页/联系人/机器人/设置/认证 */}
              <div className="shrink-0 flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-700 px-2 py-1.5">
                {APP_NAV.map(({ view, label, icon: Icon }) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => openView(view)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      currentView === view
                        ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                    }`}
                    title={label}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
                <div className="flex-1 min-w-0" />
                <button
                  type="button"
                  onClick={toggleContentPanel}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  title={isContentVisible ? '折叠内容区' : '展开内容区'}
                  aria-label="切换应用内容区"
                >
                  {isContentVisible ? '◧' : '▢'}
                </button>
              </div>
              {isContentVisible && (
                <>
                  {/* 标签条：可切换、关闭 */}
                  {tabs.length > 0 && (
                    <div className="shrink-0 flex items-center gap-0.5 overflow-x-auto border-b border-zinc-100 dark:border-zinc-700/80 px-2 py-1 min-h-0">
                      {tabs.map((tab) => (
                        <div
                          key={tab.id}
                          className={`flex items-center gap-1 shrink-0 rounded-md px-2 py-1 text-xs ${
                            activeTabId === tab.id
                              ? 'bg-zinc-200 dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100'
                              : 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-600/50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => switchTab(tab.id)}
                            className="truncate max-w-[100px]"
                          >
                            {tab.title}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              closeTab(tab.id, { force: true });
                            }}
                            className="shrink-0 p-0.5 rounded hover:bg-zinc-300 dark:hover:bg-zinc-500"
                            aria-label="关闭标签"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 内容区：按 currentView 渲染 */}
                  <div className="flex-1 min-h-0 overflow-auto p-3 text-sm">
                    <AppPanelContent currentView={currentView} />
                  </div>
                </>
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
