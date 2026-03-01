import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AppTab,
  type AppView,
  defaultHomeTab,
  getViewTitle,
  isSingleInstanceView,
} from '@/constants/appView';
import {
  getDefaultStoredAppTabs,
  getStoredAppTabs,
  setStoredAppTabs,
} from '@/lib/appTabsStorage';

function genTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface UseAppTabsOptions {
  /** 打开/切换标签时调用，用于展开应用区 */
  onOpenPanel?: () => void;
}

function getInitialState(): { tabs: AppTab[]; activeTabId: string | null } {
  const stored = getStoredAppTabs();
  if (stored) return { tabs: stored.tabs, activeTabId: stored.activeTabId };
  const def = getDefaultStoredAppTabs();
  return { tabs: def.tabs, activeTabId: def.activeTabId };
}

export function useAppTabs(options: UseAppTabsOptions = {}) {
  const { onOpenPanel } = options;
  const [tabs, setTabs] = useState<AppTab[]>(() => getInitialState().tabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(
    () => getInitialState().activeTabId
  );
  /** 应用内容区前进/后退历史（仅标签切换，不操作浏览器 history） */
  const [contentHistory, setContentHistory] = useState<{ history: string[]; index: number }>(
    () => {
      const init = getInitialState();
      const ids = init.tabs.map((t) => t.id);
      const idx = init.activeTabId
        ? Math.max(0, ids.indexOf(init.activeTabId))
        : 0;
      return { history: ids, index: idx };
    }
  );

  /** 持久化到 localStorage */
  useEffect(() => {
    setStoredAppTabs({ tabs, activeTabId });
  }, [tabs, activeTabId]);

  const activeTab = useMemo(() => {
    if (!activeTabId) return null;
    return tabs.find((t) => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);

  const currentView = useMemo<AppView>(() => {
    return activeTab?.view ?? 'home';
  }, [activeTab]);

  const pushContentHistory = useCallback((tabId: string) => {
    setContentHistory((prev) => {
      const truncated =
        prev.index < prev.history.length - 1 ? prev.history.slice(0, prev.index + 1) : prev.history;
      const nextHistory = [...truncated, tabId];
      return { history: nextHistory, index: nextHistory.length - 1 };
    });
  }, []);

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
      pushContentHistory(id);
      onOpenPanel?.();
      return id;
    },
    [onOpenPanel, pushContentHistory]
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
          pushContentHistory(existing.id);
          return existing.id;
        }
      }
      return addTab(view, appId, opts);
    },
    [tabs, addTab, onOpenPanel, pushContentHistory]
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
        setContentHistory({ history: [defaultHomeTab.id], index: 0 });
        return;
      }
      setTabs(nextTabs);
      if (activeTabId === id) {
        const nextIndex = Math.min(index, nextTabs.length - 1);
        const targetId = nextTabs[nextIndex].id;
        setActiveTabId(targetId);
        setContentHistory((prev) => {
          const idx = prev.history.lastIndexOf(targetId);
          if (idx >= 0) return { ...prev, index: idx };
          return prev;
        });
      }
    },
    [tabs, activeTabId]
  );

  /** 拖拽排序标签 */
  const reorderTabs = useCallback((oldIndex: number, newIndex: number) => {
    if (oldIndex === newIndex) return;
    setTabs((prev) => {
      const next = [...prev];
      const [removed] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, removed);
      return next;
    });
  }, []);

  const switchTab = useCallback(
    (id: string) => {
      setActiveTabId((prev) => {
        if (prev === id) return prev;
        return id;
      });
      setContentHistory((prev) => {
        if (prev.history[prev.index] === id) return prev;
        const truncated =
          prev.index < prev.history.length - 1 ? prev.history.slice(0, prev.index + 1) : prev.history;
        const nextHistory = [...truncated, id];
        return { history: nextHistory, index: nextHistory.length - 1 };
      });
      onOpenPanel?.();
    },
    [onOpenPanel]
  );

  const tabIdSet = useMemo(() => new Set(tabs.map((t) => t.id)), [tabs]);

  const goBack = useCallback(() => {
    if (contentHistory.index <= 0) return;
    for (let i = contentHistory.index - 1; i >= 0; i--) {
      if (tabIdSet.has(contentHistory.history[i])) {
        setActiveTabId(contentHistory.history[i]);
        setContentHistory((prev) => ({ ...prev, index: i }));
        return;
      }
    }
  }, [contentHistory, tabIdSet]);

  const goForward = useCallback(() => {
    if (contentHistory.index >= contentHistory.history.length - 1) return;
    for (let i = contentHistory.index + 1; i < contentHistory.history.length; i++) {
      if (tabIdSet.has(contentHistory.history[i])) {
        setActiveTabId(contentHistory.history[i]);
        setContentHistory((prev) => ({ ...prev, index: i }));
        return;
      }
    }
  }, [contentHistory, tabIdSet]);

  const canGoBack = contentHistory.index > 0 && contentHistory.history.some((id, i) => i < contentHistory.index && tabIdSet.has(id));
  const canGoForward =
    contentHistory.index < contentHistory.history.length - 1 &&
    contentHistory.history.some((id, i) => i > contentHistory.index && tabIdSet.has(id));

  /** 回到首页：切换到已有的 home 标签，不新开标签 */
  const goHome = useCallback(() => {
    const homeTab = tabs.find((t) => t.view === 'home');
    if (homeTab) {
      switchTab(homeTab.id);
    } else {
      addTab('home');
    }
  }, [tabs, switchTab, addTab]);

  /** 关闭全部标签，仅保留首页 */
  const closeAllTabs = useCallback(() => {
    setTabs([defaultHomeTab]);
    setActiveTabId(defaultHomeTab.id);
    setContentHistory({ history: [defaultHomeTab.id], index: 0 });
  }, []);

  return {
    tabs,
    activeTabId,
    activeTab,
    currentView,
    addTab,
    openView,
    closeTab,
    reorderTabs,
    switchTab,
    closeAllTabs,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    goHome,
  };
}
