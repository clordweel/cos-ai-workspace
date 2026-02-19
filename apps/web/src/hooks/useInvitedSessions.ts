/**
 * 待接受邀请的会话列表（Element 风格）
 * GET /api/sessions/invited；接受 = POST join，拒绝 = POST leave（未加入则忽略）
 */
import { useCallback, useEffect, useState } from 'react';

export interface InvitedSession {
  roomId: string;
  name?: string;
}

export function useInvitedSessions() {
  const [invited, setInvited] = useState<InvitedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvited = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sessions/invited', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || '拉取邀请列表失败');
        setInvited([]);
        return;
      }
      setInvited(Array.isArray((data as { invited?: InvitedSession[] }).invited) ? (data as { invited: InvitedSession[] }).invited : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误');
      setInvited([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvited();
  }, [fetchInvited]);

  const acceptInvite = useCallback(async (roomId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(roomId)}/join`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      setInvited((prev) => prev.filter((i) => i.roomId !== roomId));
      return true;
    } catch {
      return false;
    }
  }, []);

  const declineInvite = useCallback(async (roomId: string): Promise<boolean> => {
    try {
      await fetch(`/api/sessions/${encodeURIComponent(roomId)}/leave`, {
        method: 'POST',
        credentials: 'include',
      });
      setInvited((prev) => prev.filter((i) => i.roomId !== roomId));
      return true;
    } catch {
      setInvited((prev) => prev.filter((i) => i.roomId !== roomId));
      return true;
    }
  }, []);

  return { invited, loading, error, fetchInvited, acceptInvite, declineInvite };
}
