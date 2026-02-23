'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AssociationItem } from '@/types/associations';

export interface AssociationContextValue {
  /** 当前待发关联列表 */
  pendingAssociations: AssociationItem[];
  addPendingAssociation: (item: AssociationItem) => void;
  removePendingAssociation: (entityId: string, appId: string) => void;
  clearPendingAssociations: () => void;
  /** 打开关联选择（由输入区注册，工具栏点击时调用） */
  openAssociationPicker: () => void;
  /** 注册打开关联选择的回调（返回注销函数） */
  registerOpenAssociationPicker: (fn: () => void) => () => void;
}

const AssociationContext = createContext<AssociationContextValue | null>(null);

export function AssociationProvider({ children }: { children: ReactNode }) {
  const [pendingAssociations, setPendingAssociations] = useState<AssociationItem[]>([]);
  const openPickerRef = useRef<(() => void) | null>(null);

  const addPendingAssociation = useCallback((item: AssociationItem) => {
    setPendingAssociations((prev) => {
      const key = `${item.appId}:${item.entityId}`;
      if (prev.some((p) => `${p.appId}:${p.entityId}` === key)) return prev;
      return [...prev, item];
    });
  }, []);

  const removePendingAssociation = useCallback((entityId: string, appId: string) => {
    setPendingAssociations((prev) =>
      prev.filter((p) => !(p.entityId === entityId && p.appId === appId))
    );
  }, []);

  const clearPendingAssociations = useCallback(() => setPendingAssociations([]), []);

  const registerOpenAssociationPicker = useCallback((fn: () => void) => {
    openPickerRef.current = fn;
    return () => {
      if (openPickerRef.current === fn) openPickerRef.current = null;
    };
  }, []);

  const openAssociationPicker = useCallback(() => {
    openPickerRef.current?.();
  }, []);

  const value: AssociationContextValue = {
    pendingAssociations,
    addPendingAssociation,
    removePendingAssociation,
    clearPendingAssociations,
    openAssociationPicker,
    registerOpenAssociationPicker,
  };

  return (
    <AssociationContext.Provider value={value}>
      {children}
    </AssociationContext.Provider>
  );
}

export function useAssociation(): AssociationContextValue {
  const ctx = useContext(AssociationContext);
  if (!ctx) throw new Error('useAssociation must be used within AssociationProvider');
  return ctx;
}

export function useAssociationOptional(): AssociationContextValue | null {
  return useContext(AssociationContext);
}
