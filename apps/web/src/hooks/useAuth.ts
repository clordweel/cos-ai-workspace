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
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userId, setUserId] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  const fetchUser = useCallback(async (): Promise<boolean> => {
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data: AuthMePayload = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.user) {
        setIsAuthenticated(true);
        setUser(data.user as AuthUser);
        setUserId(typeof data.userId === 'string' ? data.userId : '');
        return true;
      }
      setIsAuthenticated(false);
      setUser(null);
      setUserId('');
      return false;
    } catch {
      setIsAuthenticated(false);
      setUser(null);
      setUserId('');
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
  };
}
