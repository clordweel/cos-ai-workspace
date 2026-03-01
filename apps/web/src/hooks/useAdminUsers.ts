/**
 * 管理端用户列表：GET /api/admin/users（仅系统管理员）
 */
import { useState, useCallback, useEffect } from 'react';

export interface AdminUserItem {
  id: string;
  username?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  name?: string;
  avatar?: string;
  roleNames?: string[];
  createdAt?: number;
}

export function useAdminUsers(params?: { page?: number; page_size?: number; search?: string }) {
  const [data, setData] = useState<AdminUserItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams();
      if (params?.page != null) searchParams.set('page', String(params.page));
      if (params?.page_size != null) searchParams.set('page_size', String(params.page_size));
      if (params?.search) searchParams.set('search', params.search);
      const qs = searchParams.toString();
      const url = qs ? `/api/admin/users?${qs}` : '/api/admin/users';
      const res = await fetch(url, { credentials: 'include' });
      const body = (await res.json().catch(() => ({}))) as
        | { ok: true; data: AdminUserItem[]; totalCount?: number }
        | { ok: false; error?: string };
      if (!res.ok) {
        setError(body && !body.ok ? body.error ?? res.statusText : res.statusText);
        setData([]);
        return;
      }
      if (body.ok && Array.isArray(body.data)) {
        setData(body.data);
        setTotalCount(body.totalCount ?? body.data.length);
      } else {
        setData([]);
        setTotalCount(0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [params?.page, params?.page_size, params?.search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users: data, totalCount, loading, error, refetch: fetchUsers };
}
