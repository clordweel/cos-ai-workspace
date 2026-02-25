/**
 * 授权管理：已连接服务列表、连接、断开
 * GET /api/connected-services、POST /api/connected-services/:provider/connect、DELETE /api/connected-services/:provider
 */
import { useCallback, useEffect, useState } from 'react';

export interface ConnectedProvider {
  id: string;
  name: string;
  connected: boolean;
}

export interface UseConnectedServicesResult {
  providers: ConnectedProvider[];
  loading: boolean;
  error: string | null;
  fetchProviders: () => Promise<void>;
  connect: (provider: string, payload: { apiKey?: string; apiSecret?: string }) => Promise<boolean>;
  disconnect: (provider: string) => Promise<boolean>;
}

export function useConnectedServices(): UseConnectedServicesResult {
  const [providers, setProviders] = useState<ConnectedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/connected-services', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setProviders([]);
        setError('请先登录');
        return;
      }
      if (!res.ok) {
        setProviders([]);
        setError(typeof data?.error === 'string' ? data.error : '获取失败');
        return;
      }
      setProviders(Array.isArray(data?.providers) ? data.providers : []);
    } catch (e) {
      setProviders([]);
      setError(e instanceof Error ? e.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  const connect = useCallback(
    async (provider: string, payload: { apiKey?: string; apiSecret?: string }): Promise<boolean> => {
      setError(null);
      try {
        const res = await fetch(`/api/connected-services/${encodeURIComponent(provider)}/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data?.error === 'string' ? data.error : '连接失败');
          return false;
        }
        await fetchProviders();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : '网络错误');
        return false;
      }
    },
    [fetchProviders]
  );

  const disconnect = useCallback(
    async (provider: string): Promise<boolean> => {
      setError(null);
      try {
        const res = await fetch(`/api/connected-services/${encodeURIComponent(provider)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data?.error === 'string' ? data.error : '断开失败');
          return false;
        }
        await fetchProviders();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : '网络错误');
        return false;
      }
    },
    [fetchProviders]
  );

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  return { providers, loading, error, fetchProviders, connect, disconnect };
}
