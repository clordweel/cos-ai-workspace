/**
 * 工作台布局上下文（与 frontend FRONTEND_SPEC 对照）
 * Layout 向子组件 provide isSessionExpanded，用于 space 页切换列表/聊天布局
 */
import React, { createContext, useContext } from 'react';

export interface WorkspaceLayoutContextValue {
  /** 会话区是否展开：应用区关闭或应用内容区折叠时为 true，会话列表与聊天可左右并排 */
  isSessionExpanded: boolean;
  /** 是否 md 断点以上（768px） */
  isMd: boolean;
}

const WorkspaceLayoutContext = createContext<WorkspaceLayoutContextValue | null>(null);

export function WorkspaceLayoutProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: WorkspaceLayoutContextValue;
}) {
  return (
    <WorkspaceLayoutContext.Provider value={value}>
      {children}
    </WorkspaceLayoutContext.Provider>
  );
}

export function useWorkspaceLayout(): WorkspaceLayoutContextValue {
  const ctx = useContext(WorkspaceLayoutContext);
  if (!ctx) throw new Error('useWorkspaceLayout must be used within WorkspaceLayout');
  return ctx;
}
