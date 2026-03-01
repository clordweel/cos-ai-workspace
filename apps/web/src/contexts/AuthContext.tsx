'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getAuthParam } from '@/lib/authParam';

export interface AuthUserRole {
  id: string;
  name: string;
  description?: string;
}

export interface AuthUser {
  name: string;
  username?: string;
  email?: string;
  avatar?: string;
  roles?: AuthUserRole[];
}

export interface AuthMePayload {
  ok: boolean;
  user?: AuthUser;
  userId?: string;
  type?: string;
  preferences?: Record<string, unknown>;
  roles?: AuthUserRole[];
  isSystemAdmin?: boolean;
  error?: string;
  matrixSyncToken?: string;
  matrix_base_url?: string;
  matrix_user_id?: string;
  matrix_device_id?: string;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  user: AuthUser | null;
  userId: string;
  authLoading: boolean;
  fetchUser: () => Promise<boolean>;
  login: () => void;
  loginWithPopup: () => Promise<void>;
  reAuthWithPopup: () => Promise<void>;
  logout: () => Promise<void>;
  matrixSyncToken: string;
  matrixBaseUrl: string;
  matrixUserId: string;
  matrixDeviceId: string;
  preferences: Record<string, unknown>;
  updatePreferences: (patch: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  isSystemAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let authMeInFlight: Promise<boolean> | null = null;
let lastAuthResult: { data: AuthMePayload; resOk: boolean } | null = null;

function openLogtoPopupAndWait(
  logtoUrl: string,
  onDone: () => Promise<unknown>
): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Not in browser'));
  }
  const origin = window.location.origin;
  const width = 420;
  const height = 740;
  const left = Math.round((window.screen.width - width) / 2);
  const top = Math.round((window.screen.height - height) / 2);
  const popup = window.open(
    logtoUrl,
    'logto-auth',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
  );
  if (!popup) {
    return Promise.reject(new Error('弹窗被阻止，请允许当前站点弹出窗口后重试'));
  }
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.data?.type !== 'logto-auth-done') return;
      window.removeEventListener('message', onMessage);
      clearInterval(timer);
      setTimeout(() => {
        onDone().then(() => resolve());
      }, 200);
    };
    const startCheckClosed = Date.now() + 2000;
    const timer = setInterval(() => {
      if (Date.now() < startCheckClosed) return;
      if (popup.closed) {
        window.removeEventListener('message', onMessage);
        clearInterval(timer);
        reject(new Error('登录已取消'));
      }
    }, 300);
    window.addEventListener('message', onMessage);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userId, setUserId] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [matrixSyncToken, setMatrixSyncToken] = useState('');
  const [matrixBaseUrl, setMatrixBaseUrl] = useState('');
  const [matrixUserId, setMatrixUserId] = useState('');
  const [matrixDeviceId, setMatrixDeviceId] = useState('');
  const [preferences, setPreferences] = useState<Record<string, unknown>>({});
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);

  const applyPayload = useCallback((data: AuthMePayload, resOk: boolean): void => {
    if (resOk && data.ok && data.user) {
      setIsAuthenticated(true);
      const u = data.user as AuthUser;
      const roles = Array.isArray(data.roles) ? data.roles : (u?.roles ?? []);
      setUser({ ...u, roles });
      setUserId(typeof data.userId === 'string' ? data.userId : '');
      setMatrixSyncToken(typeof data.matrixSyncToken === 'string' ? data.matrixSyncToken : '');
      setMatrixBaseUrl(typeof data.matrix_base_url === 'string' ? data.matrix_base_url : '');
      setMatrixUserId(typeof data.matrix_user_id === 'string' ? data.matrix_user_id : '');
      setMatrixDeviceId(typeof data.matrix_device_id === 'string' ? data.matrix_device_id : '');
      setPreferences(
        typeof data.preferences === 'object' && data.preferences !== null ? data.preferences : {}
      );
      setIsSystemAdmin(Boolean(data.isSystemAdmin));
    } else {
      setIsAuthenticated(false);
      setUser(null);
      setUserId('');
      setMatrixSyncToken('');
      setMatrixBaseUrl('');
      setMatrixUserId('');
      setMatrixDeviceId('');
      setPreferences({});
      setIsSystemAdmin(false);
    }
    setAuthLoading(false);
  }, []);

  const fetchUser = useCallback(async (): Promise<boolean> => {
    if (authMeInFlight) {
      authMeInFlight.then(() => {
        if (lastAuthResult) applyPayload(lastAuthResult.data, lastAuthResult.resOk);
      });
      return authMeInFlight;
    }
    setAuthLoading(true);
    authMeInFlight = (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data: AuthMePayload = await res.json().catch(() => ({}));
        const ok = res.ok && !!data.ok && !!data.user;
        lastAuthResult = { data, resOk: res.ok };
        applyPayload(data, res.ok);
        return ok;
      } catch {
        lastAuthResult = { data: { ok: false }, resOk: false };
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
    if (typeof window === 'undefined') return;
    if (getAuthParam() === 'ok') {
      const t = setTimeout(() => {
        fetchUser();
      }, 400);
      return () => clearTimeout(t);
    }
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.href = `${window.location.origin}/#/logto`;
    }
  }, []);

  const loginWithPopup = useCallback((): Promise<void> => {
    return openLogtoPopupAndWait(`${window.location.origin}/#/logto`, fetchUser);
  }, [fetchUser]);

  const reAuthWithPopup = useCallback((): Promise<void> => {
    return openLogtoPopupAndWait(
      `${window.location.origin}/#/logto?prompt=login`,
      fetchUser
    );
  }, [fetchUser]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      applyPayload({ ok: false }, false);
    }
  }, [applyPayload]);

  const updatePreferences = useCallback(
    async (patch: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/auth/me/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(patch),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          preferences?: Record<string, unknown>;
          error?: string;
        };
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

  const value: AuthContextValue = {
    isAuthenticated,
    user,
    userId,
    authLoading,
    fetchUser,
    login,
    loginWithPopup,
    reAuthWithPopup,
    logout,
    matrixSyncToken,
    matrixBaseUrl,
    matrixUserId,
    matrixDeviceId,
    preferences,
    updatePreferences,
    isSystemAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth 必须在 AuthProvider 内使用');
  }
  return ctx;
}
