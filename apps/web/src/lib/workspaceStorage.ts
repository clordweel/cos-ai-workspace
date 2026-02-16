const STORAGE_KEY = 'cosai-workspace-last-id';

/** 无上次工作空间时使用的默认公开工作区 id */
export const DEFAULT_PUBLIC_WORKSPACE_ID = 'public';

export function getLastWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v && v.length > 0 ? v : null;
}

/** 当前应进入的工作区 id：上次使用的，或默认公开工作区 */
export function getEffectiveWorkspaceId(): string {
  return getLastWorkspaceId() ?? DEFAULT_PUBLIC_WORKSPACE_ID;
}

export function setLastWorkspaceId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, id);
}
