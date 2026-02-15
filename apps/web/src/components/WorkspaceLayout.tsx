import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun, Pin, PinOff } from 'lucide-react';
import { Button } from './ui/button';
import { useAppViewContext } from '../contexts/AppViewContext';
import { WorkspaceLayoutProvider } from '../contexts/WorkspaceLayoutContext';
import { useTheme } from '../hooks/useTheme';
import { SettingsPanel } from './SettingsPanel';
import { MaterialConfirmCard } from './task/MaterialConfirmCard';
import { WorkspaceAppNav } from './WorkspaceAppNav';
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

function AppPanelContent({ currentView }: { currentView: AppView }) {
  switch (currentView) {
    case 'home':
      return (
        <div className="text-zinc-600 dark:text-zinc-400 space-y-4">
          <p>欢迎使用智能交互工作台。</p>
          <p className="text-xs">更多扩展应用将在此展示（阶段 5.4 扩展入口）。</p>
          <div className="pt-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">任务卡片示例</p>
            <MaterialConfirmCard
              draftId="MAT-DRAFT-demo"
              itemName="示例物料（确认后将请求接口）"
              onConfirmed={() => {}}
            />
          </div>
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
          <Link to="/logto" className="text-primary-600 dark:text-primary-400 hover:underline">
            前往 Logto 登录
          </Link>
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
    isSidebarPinned,
    toggleSidebarPinned,
    cancelSidebarLeave,
    scheduleSidebarLeave,
    tabs,
    activeTabId,
    currentView,
    switchTab,
    closeTab,
  } = useAppViewContext();
  const md = useMediaMd();
  const showAppPanel = isPanelOpen && md;
  /** 会话区是否展开：应用区关闭或应用内容区折叠时为 true（FRONTEND_SPEC） */
  const isSessionExpanded = !showAppPanel || !isContentVisible;

  return (
    <WorkspaceLayoutProvider value={{ isSessionExpanded, isMd: md }}>
      <div className="h-screen min-h-0 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex flex-col">
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* 顶栏：品牌 + 主题切换 */}
          <header
          className="shrink-0 h-14 flex items-center justify-center px-4 w-full border-b border-zinc-200 dark:border-zinc-700"
          role="banner"
          aria-label="产品"
        >
          <div className="flex items-center justify-between w-full max-w-[1600px]">
            <Link
              to="/space"
              className="flex items-center gap-2 min-w-0 rounded-lg py-1.5 px-2 -mx-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-offset-zinc-900"
            >
              <span className="text-sm font-semibold">COS&AI</span>
              <span className="hidden sm:inline text-sm font-medium text-zinc-500 dark:text-zinc-400 border-l border-zinc-300 dark:border-zinc-600 pl-2">
                智能交互工作台
              </span>
            </Link>
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
          {/* 左栏：会话区（应用区打开且内容展开时限制宽度 max-w-sm，与 FRONTEND_SPEC 一致） */}
          <div
            className={`h-full min-h-0 w-full min-w-0 flex flex-col overflow-hidden ${showAppPanel && isContentVisible ? 'max-w-sm' : ''}`}
          >
            <div className="h-full min-h-0 w-full min-w-0 flex flex-col overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
              {children}
            </div>
          </div>

          {/* 右栏：应用区（md+ 且打开时显示）= 工具栏 + 侧栏 + 内容区 */}
          {showAppPanel && (
            <section
              className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 min-w-0 shadow-sm"
              aria-label="应用区"
            >
              {/* 顶部工具栏：固定侧栏 + 折叠内容区（FRONTEND_SPEC：固定/展开按钮在侧栏上方） */}
              <div
                className="shrink-0 flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-700 px-2 py-1.5"
                onMouseEnter={cancelSidebarLeave}
                onMouseLeave={scheduleSidebarLeave}
              >
                <button
                  type="button"
                  onClick={toggleSidebarPinned}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  title={isSidebarPinned ? '取消固定侧栏' : '固定侧栏'}
                  aria-label={isSidebarPinned ? '取消固定侧栏' : '固定侧栏'}
                >
                  {isSidebarPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={toggleContentPanel}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  title={isContentVisible ? '折叠内容区' : '展开内容区'}
                  aria-label="切换应用内容区"
                >
                  {isContentVisible ? '◧' : '▢'}
                </button>
                <div className="flex-1 min-w-0" />
              </div>
              <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
                <WorkspaceAppNav />
                {isContentVisible && (
                  <>
                    {/* 标签条 + 应用内容区（内层圆角、浅底、阴影，见 layout-app-content） */}
                    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
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
                      <div className="flex-1 min-h-0 overflow-auto rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-700/80 shadow-inner m-2 mt-0 p-3 text-sm">
                        <AppPanelContent currentView={currentView} />
                      </div>
                    </div>
                  </>
                )}
              </div>
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
              <Link to="/space" className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                首页
              </Link>
            </nav>
          </footer>
        )}
        </main>
      </div>
    </WorkspaceLayoutProvider>
  );
}
