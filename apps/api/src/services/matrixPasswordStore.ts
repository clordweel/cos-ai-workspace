/** Matrix 密码缓存（api 内实现，仅内存） */
const TTL_MS = 90 * 24 * 60 * 60 * 1000;
const map = new Map<string, { password: string; expiresAt: number }>();

export async function getStoredMatrixPassword(logtoSub: string): Promise<string | null> {
  if (!logtoSub?.trim()) return null;
  const entry = map.get(logtoSub.trim());
  if (!entry || entry.expiresAt < Date.now()) {
    if (entry) map.delete(logtoSub.trim());
    return null;
  }
  return entry.password;
}

export async function setStoredMatrixPassword(logtoSub: string, password: string): Promise<void> {
  if (!logtoSub?.trim() || !password) return;
  map.set(logtoSub.trim(), { password, expiresAt: Date.now() + TTL_MS });
}

export async function deleteStoredMatrixPassword(logtoSub: string): Promise<void> {
  if (!logtoSub?.trim()) return;
  map.delete(logtoSub.trim());
}
