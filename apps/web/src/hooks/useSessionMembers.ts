/**
 * 房间成员列表（Element 房间信息 - 成员）
 * GET /api/sessions/:id/members
 */
import { useCallback, useEffect, useState } from 'react';

export interface RoomMember {
  userId: string;
  membership: 'join' | 'invite';
  displayName?: string;
  avatarUrl?: string;
  isOwner?: boolean;
}

export function useSessionMembers(sessionId: string | undefined) {
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!sessionId) {
      setMembers([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/members`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || '拉取成员失败');
        setMembers([]);
        return;
      }
      setMembers(Array.isArray((data as { members?: RoomMember[] }).members) ? (data as { members: RoomMember[] }).members : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { members, loading, error, fetchMembers };
}
