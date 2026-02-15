import React, { createContext, useCallback, useContext, useState } from 'react';

interface AppViewContextValue {
  isPanelOpen: boolean;
  isContentVisible: boolean;
  toggleContentPanel: () => void;
  togglePanelOpen: () => void;
}

const AppViewContext = createContext<AppViewContextValue | null>(null);

export function AppViewProvider({ children }: { children: React.ReactNode }) {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isContentVisible, setIsContentVisible] = useState(true);

  const toggleContentPanel = useCallback(() => {
    setIsContentVisible((v) => !v);
  }, []);

  const togglePanelOpen = useCallback(() => {
    setIsPanelOpen((v) => !v);
  }, []);

  const value: AppViewContextValue = {
    isPanelOpen,
    isContentVisible,
    toggleContentPanel,
    togglePanelOpen,
  };

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
