/**
 * 应用标签栏持久化：刷新后还原最后打开的标签及顺序
 */

import type { AppTab } from '@/constants/appView';
import { defaultHomeTab } from '@/constants/appView';

const STORAGE_KEY = 'cosai-app-tabs';

export interface StoredAppTabs {
  tabs: AppTab[];
  activeTabId: string | null;
}

const VALID_VIEWS = new Set<string>([
  'home',
  'contacts',
  'bots',
  'settings',
  'auth',
  'profile',
  'app',
  'connected-services',
  'system-config',
  'user-management',
  'role-management',
]);

function isValidTab(t: unknown): t is AppTab {
  if (!t || typeof t !== 'object') return false;
  const o = t as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    o.id.length > 0 &&
    typeof o.view === 'string' &&
    VALID_VIEWS.has(o.view) &&
    typeof o.title === 'string'
  );
}

export function getStoredAppTabs(): StoredAppTabs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const { tabs, activeTabId } = parsed as Record<string, unknown>;
    if (!Array.isArray(tabs) || tabs.length === 0) return null;
    const validTabs = tabs.filter(isValidTab);
    if (validTabs.length === 0) return null;
    const active =
      typeof activeTabId === 'string' && activeTabId.length > 0 ? activeTabId : null;
    const activeExists = active && validTabs.some((t) => t.id === active);
    return {
      tabs: validTabs,
      activeTabId: activeExists ? active : validTabs[0].id,
    };
  } catch {
    return null;
  }
}

export function setStoredAppTabs(data: StoredAppTabs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 忽略存储失败（如隐私模式）
  }
}

export function getDefaultStoredAppTabs(): StoredAppTabs {
  return {
    tabs: [defaultHomeTab],
    activeTabId: defaultHomeTab.id,
  };
}
