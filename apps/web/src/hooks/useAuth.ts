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

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userId, setUserId] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [matrixSyncToken, setMatrixSyncToken] = useState('');
  const [matrixBaseUrl, setMatrixBaseUrl] = useState('');
  const [matrixUserId, setMatrixUserId] = useState('');
  const [matrixDeviceId, setMatrixDeviceId] = useState('');

  const fetchUser = useCallback(async (): Promise<boolean> => {
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data: AuthMePayload = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.user) {
        setIsAuthenticated(true);
        setUser(data.user as AuthUser);
        setUserId(typeof data.userId === 'string' ? data.userId : '');
        setMatrixSyncToken(typeof data.matrixSyncToken === 'string' ? data.matrixSyncToken : '');
        setMatrixBaseUrl(typeof data.matrix_base_url === 'string' ? data.matrix_base_url : '');
        setMatrixUserId(typeof data.matrix_user_id === 'string' ? data.matrix_user_id : '');
        setMatrixDeviceId(typeof data.matrix_device_id === 'string' ? data.matrix_device_id : '');
        return true;
      }
      setIsAuthenticated(false);
      setUser(null);
      setUserId('');
      setMatrixSyncToken('');
      setMatrixBaseUrl('');
      setMatrixUserId('');
      setMatrixDeviceId('');
      return false;
    } catch {
      setIsAuthenticated(false);
      setUser(null);
      setUserId('');
      setMatrixSyncToken('');
      setMatrixBaseUrl('');
      setMatrixUserId('');
      setMatrixDeviceId('');
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.href = `${window.location.origin}/logto`;
    }
  }, []);

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
  };
}
