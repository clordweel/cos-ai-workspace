/**
 * 管理端角色列表与分配：GET /api/admin/roles、POST /api/admin/roles/:id/users（仅系统管理员）
 */
import { useState, useCallback, useEffect } from 'react';

export interface AdminRoleItem {
  id: string;
  name: string;
  description?: string;
  type?: string;
}

export function useAdminRoles() {
  const [data, setData] = useState<AdminRoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/roles', { credentials: 'include' });
      const body = (await res.json().catch(() => ({}))) as
        | { ok: true; data: AdminRoleItem[] }
        | { ok: false; error?: string };
      if (!res.ok) {
        setError(body && !body.ok ? body.error ?? res.statusText : res.statusText);
        setData([]);
        return;
      }
      if (body.ok && Array.isArray(body.data)) {
        setData(body.data);
      } else {
        setData([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const assignRoleToUsers = useCallback(
    async (roleId: string, userIds: string[]): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/roles/${encodeURIComponent(roleId)}/users`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds }),
        });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok) {
          setError(body.error ?? res.statusText);
          return false;
        }
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    []
  );

  const removeRoleFromUser = useCallback(
    async (roleId: string, userId: string): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/admin/roles/${encodeURIComponent(roleId)}/users/${encodeURIComponent(userId)}`,
          { method: 'DELETE', credentials: 'include' }
        );
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok) {
          setError(body.error ?? res.statusText);
          return false;
        }
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    []
  );

  return { roles: data, loading, error, refetch: fetchRoles, assignRoleToUsers, removeRoleFromUser };
}
