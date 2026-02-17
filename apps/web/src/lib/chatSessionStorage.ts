const STORAGE_KEY_PREFIX = 'cosai-workspace';

function getKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}-${workspaceId}-last-chat-id`;
}

/** 读取该工作区上次打开的会话 id */
export function getLastChatId(workspaceId: string): string | null {
  if (typeof window === 'undefined' || !workspaceId) return null;
  const v = localStorage.getItem(getKey(workspaceId));
  return v && v.length > 0 ? v : null;
}

/** 记住该工作区最后一次打开的会话 id */
export function setLastChatId(workspaceId: string, chatId: string | null): void {
  if (typeof window === 'undefined' || !workspaceId) return;
  if (chatId == null || chatId.length === 0) {
    localStorage.removeItem(getKey(workspaceId));
  } else {
    localStorage.setItem(getKey(workspaceId), chatId);
  }
}
