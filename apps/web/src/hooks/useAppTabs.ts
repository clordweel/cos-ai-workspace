import { useCallback, useMemo, useState } from 'react';
import {
  type AppTab,
  type AppView,
  defaultHomeTab,
  getViewTitle,
  isSingleInstanceView,
} from '@/constants/appView';

function genTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface UseAppTabsOptions {
  /** 打开/切换标签时调用，用于展开应用区 */
  onOpenPanel?: () => void;
}

export function useAppTabs(options: UseAppTabsOptions = {}) {
  const { onOpenPanel } = options;
  const [tabs, setTabs] = useState<AppTab[]>([defaultHomeTab]);
  const [activeTabId, setActiveTabId] = useState<string | null>(defaultHomeTab.id);

  const activeTab = useMemo(() => {
    if (!activeTabId) return null;
    return tabs.find((t) => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);

  const currentView = useMemo<AppView>(() => {
    return activeTab?.view ?? 'home';
  }, [activeTab]);

  const addTab = useCallback(
    (view: AppView, appId?: string, opts?: { isAuthRequired?: boolean }) => {
      const id = genTabId();
      const title = getViewTitle(view, appId);
      const newTab: AppTab = {
        id,
        view,
        title,
        appId,
        isAuthRequired: opts?.isAuthRequired,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(id);
      onOpenPanel?.();
      return id;
    },
    [onOpenPanel]
  );

  /** 按应用激活类型打开：单例则切换已有标签，否则新建 */
  const openView = useCallback(
    (view: AppView, appId?: string, opts?: { isAuthRequired?: boolean }): string => {
      onOpenPanel?.();
      if (isSingleInstanceView(view)) {
        const same = (t: AppTab) =>
          t.view === view && (appId == null ? t.appId == null : t.appId === appId);
        const existing = tabs.find(same);
        if (existing) {
          setActiveTabId(existing.id);
          return existing.id;
        }
      }
      return addTab(view, appId, opts);
    },
    [tabs, addTab, onOpenPanel]
  );

  const closeTab = useCallback(
    (id: string, options?: { force?: boolean }) => {
      const tab = tabs.find((t) => t.id === id);
      if (!tab) return;
      if (tab.isAuthRequired && !options?.force) return;
      const index = tabs.findIndex((t) => t.id === id);
      const nextTabs = tabs.filter((t) => t.id !== id);
      if (nextTabs.length === 0) {
        setTabs([defaultHomeTab]);
        setActiveTabId(defaultHomeTab.id);
        return;
      }
      setTabs(nextTabs);
      if (activeTabId === id) {
        const nextIndex = Math.min(index, nextTabs.length - 1);
        setActiveTabId(nextTabs[nextIndex].id);
      }
    },
    [tabs, activeTabId]
  );

  const switchTab = useCallback((id: string) => {
    setActiveTabId((prev) => {
      if (prev === id) return prev;
      return id;
    });
    onOpenPanel?.();
  }, [onOpenPanel]);

  /** 关闭全部标签，仅保留首页 */
  const closeAllTabs = useCallback(() => {
    setTabs([defaultHomeTab]);
    setActiveTabId(defaultHomeTab.id);
  }, []);

  return {
    tabs,
    activeTabId,
    activeTab,
    currentView,
    addTab,
    openView,
    closeTab,
    switchTab,
    closeAllTabs,
  };
}
