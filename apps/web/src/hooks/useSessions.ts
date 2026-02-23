import { useCallback, useEffect, useState } from 'react';
import { useMockMode } from './useMockMode';
import { MOCK_SESSION_LIST } from '@/data/mockSessions';

export interface Session {
  id: string;
  title: string;
  updatedAt: number;
  backendSessionId?: string;
  provider?: string;
  participants?: { name: string; avatar?: string; kind?: 'user' | 'bot'; id?: string }[];
}

function mockListToSessions(): Session[] {
  return MOCK_SESSION_LIST.map((s) => ({
    id: s.id,
    title: s.title,
    updatedAt: s.updatedAt ?? Date.now(),
    backendSessionId: s.id,
    provider: 'mock',
    participants: s.participants,
  }));
}

export function useSessions() {
  const isMockMode = useMockMode();
  const [sessions, setSessions] = useState<Session[]>(() => (isMockMode ? mockListToSessions() : []));
  const [loading, setLoading] = useState(!isMockMode);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (isMockMode) {
      setSessions(mockListToSessions());
      setLoading(false);
      return;
    }
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
  }, [isMockMode]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = useCallback(
    async (title?: string): Promise<Session | null> => {
      if (isMockMode) {
        const created: Session = {
          id: `mock-new-${Date.now()}`,
          title: title?.trim() || '新会话',
          updatedAt: Date.now(),
          backendSessionId: `mock-new-${Date.now()}`,
          provider: 'mock',
        };
        setSessions((prev) => [created, ...prev]);
        return created;
      }
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
    },
    [isMockMode]
  );

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
