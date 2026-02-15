import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { AppView, AppTab } from '../constants/appView';
import { defaultHomeTab, isSingleInstanceView, VIEW_TITLES } from '../constants/appView';

function genId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function tabTitle(view: AppView, appId?: string): string {
  if (view === 'app' && appId) return appId;
  return view === 'app' ? '应用' : VIEW_TITLES[view];
}

interface AppViewContextValue {
  isPanelOpen: boolean;
  isContentVisible: boolean;
  toggleContentPanel: () => void;
  togglePanelOpen: () => void;
  tabs: AppTab[];
  activeTabId: string | null;
  activeTab: AppTab | null;
  currentView: AppView;
  openView: (view: AppView, appId?: string, opts?: { isAuthRequired?: boolean }) => string;
  switchTab: (id: string) => void;
  closeTab: (id: string, options?: { force?: boolean }) => void;
  setView: (view: AppView) => void;
  openAuthTab: () => string;
}

const AppViewContext = createContext<AppViewContextValue | null>(null);

export function AppViewProvider({ children }: { children: React.ReactNode }) {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isContentVisible, setIsContentVisible] = useState(true);
  const [tabs, setTabs] = useState<AppTab[]>([defaultHomeTab]);
  const [activeTabId, setActiveTabId] = useState<string | null>(defaultHomeTab.id);

  const toggleContentPanel = useCallback(() => {
    setIsContentVisible((v) => !v);
  }, []);

  const togglePanelOpen = useCallback(() => {
    setIsPanelOpen((v) => !v);
  }, []);

  const activeTab = useMemo(() => {
    if (!activeTabId) return null;
    return tabs.find((t) => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);

  const currentView: AppView = activeTab?.view ?? 'home';

  const addTab = useCallback((view: AppView, appId?: string, opts?: { isAuthRequired?: boolean }) => {
    const id = genId();
    const title = tabTitle(view, appId);
    const newTab: AppTab = { id, view, title, appId, isAuthRequired: opts?.isAuthRequired };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
    setIsPanelOpen(true);
    setIsContentVisible(true);
    return id;
  }, []);

  const openView = useCallback(
    (view: AppView, appId?: string, opts?: { isAuthRequired?: boolean }): string => {
      setIsPanelOpen(true);
      setIsContentVisible(true);
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
    [tabs, addTab]
  );

  const switchTab = useCallback((id: string) => {
    if (tabs.some((t) => t.id === id)) {
      setActiveTabId(id);
      setIsPanelOpen(true);
      setIsContentVisible(true);
    }
  }, [tabs]);

  const closeTab = useCallback((id: string, options?: { force?: boolean }) => {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    if (tab.isAuthRequired && !options?.force) return;
    const index = tabs.findIndex((t) => t.id === id);
    const nextList = tabs.filter((t) => t.id !== id);
    if (nextList.length === 0) {
      setTabs([defaultHomeTab]);
      setActiveTabId(defaultHomeTab.id);
      return;
    }
    setTabs(nextList);
    if (activeTabId === id) {
      const nextIndex = Math.min(index, nextList.length - 1);
      setActiveTabId(nextList[nextIndex].id);
    }
  }, [tabs, activeTabId]);

  const setView = useCallback((view: AppView) => openView(view), [openView]);

  const openAuthTab = useCallback(() => openView('auth', undefined, { isAuthRequired: true }), [openView]);

  const value: AppViewContextValue = useMemo(
    () => ({
      isPanelOpen,
      isContentVisible,
      toggleContentPanel,
      togglePanelOpen,
      tabs,
      activeTabId,
      activeTab,
      currentView,
      openView,
      switchTab,
      closeTab,
      setView,
      openAuthTab,
    }),
    [
      isPanelOpen,
      isContentVisible,
      toggleContentPanel,
      togglePanelOpen,
      tabs,
      activeTabId,
      activeTab,
      currentView,
      openView,
      switchTab,
      closeTab,
      setView,
      openAuthTab,
    ]
  );

  return (
    <AppViewContext.Provider value={value}>
      {children}
    </AppViewContext.Provider>
  );
}

export function useAppViewContext(): AppViewContextValue {
  const ctx = useContext(AppViewContext);
  if (!ctx) throw new Error('useAppViewContext must be used within AppViewProvider');
  return ctx;
}
