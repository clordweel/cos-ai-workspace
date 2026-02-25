/**
 * Memo（备忘录）API：对接 apps/api GET/POST/PATCH/DELETE /api/memos
 * 需登录；credentials: 'include' 携带 Cookie。
 */
import { useCallback, useEffect, useState } from 'react';

export interface MemoDoc {
  name?: string;
  description?: string;
  status?: string;
  priority?: string;
  modified?: string;
  owner?: string;
  assigned_to?: string;
  [key: string]: unknown;
}

export interface UseMemosResult {
  memos: MemoDoc[];
  loading: boolean;
  error: string | null;
  /** 503 表示 ERP 未配置 */
  erpUnconfigured: boolean;
  fetchMemos: () => Promise<void>;
  createMemo: (payload: { description?: string; status?: string; priority?: string }) => Promise<MemoDoc | null>;
}

export function useMemos(): UseMemosResult {
  const [memos, setMemos] = useState<MemoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [erpUnconfigured, setErpUnconfigured] = useState(false);

  const fetchMemos = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErpUnconfigured(false);
    try {
      const res = await fetch('/api/memos', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setMemos([]);
        setError('请先登录');
        return;
      }
      if (res.status === 503) {
        setMemos([]);
        setErpUnconfigured(true);
        setError('ERP 未配置');
        return;
      }
      if (!res.ok) {
        setMemos([]);
        setError(typeof data?.error === 'string' ? data.error : '获取列表失败');
        return;
      }
      setMemos(Array.isArray(data?.memos) ? data.memos : []);
    } catch (e) {
      setMemos([]);
      setError(e instanceof Error ? e.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  const createMemo = useCallback(
    async (payload: { description?: string; status?: string; priority?: string }): Promise<MemoDoc | null> => {
      setError(null);
      try {
        const res = await fetch('/api/memos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setError('请先登录');
          return null;
        }
        if (res.status === 503) {
          setErpUnconfigured(true);
          setError('ERP 未配置');
          return null;
        }
        if (!res.ok) {
          setError(typeof data?.error === 'string' ? data.error : '创建失败');
          return null;
        }
        await fetchMemos();
        return (data as MemoDoc) ?? null;
      } catch (e) {
        setError(e instanceof Error ? e.message : '网络错误');
        return null;
      }
    },
    [fetchMemos]
  );

  useEffect(() => {
    fetchMemos();
  }, [fetchMemos]);

  return { memos, loading, error, erpUnconfigured, fetchMemos, createMemo };
}
