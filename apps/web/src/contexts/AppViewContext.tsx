import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
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
  /** 侧栏是否固定（固定后常开、不随鼠标收起） */
  isSidebarPinned: boolean;
  /** 侧栏是否展开（固定或悬停展开后） */
  isSidebarExpanded: boolean;
  toggleSidebarPinned: () => void;
  /** nav mouseenter 时调用 */
  scheduleSidebarExpand: () => void;
  /** nav 或工具栏 mouseleave 时调用 */
  scheduleSidebarLeave: () => void;
  /** 工具栏 mouseenter 时调用，取消延迟收起 */
  cancelSidebarLeave: () => void;
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

const SIDEBAR_EXPAND_DELAY_MS = 500;
const SIDEBAR_LEAVE_DELAY_MS = 180;
const SIDEBAR_IGNORE_LEAVE_MS = 280;

export function AppViewProvider({ children }: { children: React.ReactNode }) {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isContentVisible, setIsContentVisible] = useState(true);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [tabs, setTabs] = useState<AppTab[]>([defaultHomeTab]);
  const [activeTabId, setActiveTabId] = useState<string | null>(defaultHomeTab.id);

  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandTimeRef = useRef<number>(0);

  const isSidebarExpanded = isSidebarPinned || hoverExpanded;

  const toggleContentPanel = useCallback(() => {
    setIsContentVisible((v) => !v);
  }, []);

  const toggleSidebarPinned = useCallback(() => {
    setIsSidebarPinned((p) => !p);
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const scheduleSidebarExpand = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    if (expandTimerRef.current) return;
    expandTimerRef.current = setTimeout(() => {
      expandTimerRef.current = null;
      expandTimeRef.current = Date.now();
      setHoverExpanded(true);
    }, SIDEBAR_EXPAND_DELAY_MS);
  }, []);

  const scheduleSidebarLeave = useCallback(() => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
    const now = Date.now();
    if (!isSidebarPinned && now - expandTimeRef.current < SIDEBAR_IGNORE_LEAVE_MS) return;
    if (leaveTimerRef.current) return;
    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null;
      setHoverExpanded(false);
    }, SIDEBAR_LEAVE_DELAY_MS);
  }, [isSidebarPinned]);

  const cancelSidebarLeave = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
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
      isSidebarPinned,
      isSidebarExpanded,
      toggleSidebarPinned,
      scheduleSidebarExpand,
      scheduleSidebarLeave,
      cancelSidebarLeave,
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
      isSidebarPinned,
      isSidebarExpanded,
      toggleSidebarPinned,
      scheduleSidebarExpand,
      scheduleSidebarLeave,
      cancelSidebarLeave,
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
