import { useCallback, useEffect, useState } from 'react';

export interface AuthUser {
  name: string;
  username?: string;
  email?: string;
  avatar?: string;
}

export interface AuthMePayload {
  ok: boolean;
  user?: AuthUser;
  userId?: string;
  type?: string;
  preferences?: Record<string, unknown>;
  error?: string;
  matrixSyncToken?: string;
  matrix_base_url?: string;
  matrix_user_id?: string;
  matrix_device_id?: string;
}

/** 单次进行中的 /api/auth/me 请求，避免 Strict Mode 双重挂载导致重复请求 */
let authMeInFlight: Promise<boolean> | null = null;

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userId, setUserId] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [matrixSyncToken, setMatrixSyncToken] = useState('');
  const [matrixBaseUrl, setMatrixBaseUrl] = useState('');
  const [matrixUserId, setMatrixUserId] = useState('');
  const [matrixDeviceId, setMatrixDeviceId] = useState('');
  const [preferences, setPreferences] = useState<Record<string, unknown>>({});
  const applyPayload = useCallback((data: AuthMePayload, resOk: boolean): void => {
    if (resOk && data.ok && data.user) {
      setIsAuthenticated(true);
      setUser(data.user as AuthUser);
      setUserId(typeof data.userId === 'string' ? data.userId : '');
      setMatrixSyncToken(typeof data.matrixSyncToken === 'string' ? data.matrixSyncToken : '');
      setMatrixBaseUrl(typeof data.matrix_base_url === 'string' ? data.matrix_base_url : '');
      setMatrixUserId(typeof data.matrix_user_id === 'string' ? data.matrix_user_id : '');
      setMatrixDeviceId(typeof data.matrix_device_id === 'string' ? data.matrix_device_id : '');
      setPreferences(typeof data.preferences === 'object' && data.preferences !== null ? data.preferences : {});
    } else {
      setIsAuthenticated(false);
      setUser(null);
      setUserId('');
      setMatrixSyncToken('');
      setMatrixBaseUrl('');
      setMatrixUserId('');
      setMatrixDeviceId('');
      setPreferences({});
    }
  }, []);

  const fetchUser = useCallback(async (): Promise<boolean> => {
    if (authMeInFlight) return authMeInFlight;
    setAuthLoading(true);
    authMeInFlight = (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data: AuthMePayload = await res.json().catch(() => ({}));
        const ok = res.ok && !!data.ok && !!data.user;
        applyPayload(data, res.ok);
        return ok;
      } catch {
        applyPayload({ ok: false }, false);
        return false;
      } finally {
        setAuthLoading(false);
        authMeInFlight = null;
      }
    })();
    return authMeInFlight;
  }, [applyPayload]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.href = `${window.location.origin}/logto`;
    }
  }, []);

  const updatePreferences = useCallback(
    async (patch: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/auth/me/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(patch),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; preferences?: Record<string, unknown>; error?: string };
        if (res.ok && data.ok) {
          setPreferences((prev) => ({ ...prev, ...(data.preferences ?? patch) }));
          return { ok: true };
        }
        return { ok: false, error: data.error || res.statusText };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : '请求失败' };
      }
    },
    []
  );

  return {
    isAuthenticated,
    user,
    userId,
    authLoading,
    fetchUser,
    login,
    matrixSyncToken,
    matrixBaseUrl,
    matrixUserId,
    matrixDeviceId,
    preferences,
    updatePreferences,
  };
}
