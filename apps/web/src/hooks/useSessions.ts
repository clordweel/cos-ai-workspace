import { useCallback, useEffect, useState } from 'react';

export interface Session {
  id: string;
  title: string;
  updatedAt: number;
  backendSessionId?: string;
  provider?: string;
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sessions', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || '拉取会话列表失败');
        setSessions([]);
        return;
      }
      setSessions(Array.isArray((data as { sessions?: Session[] }).sessions) ? (data as { sessions: Session[] }).sessions : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = useCallback(async (title?: string): Promise<Session | null> => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: title || '新会话' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return null;
      const created = data as Session;
      setSessions((prev) => [created, ...prev]);
      return created;
    } catch {
      return null;
    }
  }, []);

  /** 供 Sync 使用：确保会话在列表中（新则追加，已有则更新标题） */
  const addOrUpdateSession = useCallback((id: string, title: string) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const entry = { id, title: title || id, updatedAt: Date.now(), backendSessionId: id };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx]!, ...entry };
        return next;
      }
      return [entry, ...prev];
    });
  }, []);

  return { sessions, loading, error, fetchSessions, createSession, addOrUpdateSession };
}
