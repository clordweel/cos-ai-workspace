import { useCallback, useEffect, useState } from 'react';
import { getAuthParam } from '@/lib/authParam';

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

  // 认证回调落地 auth=ok 时由 Space 做延迟拉取，避免 Cookie 未生效就请求导致一直未登录
  useEffect(() => {
    if (typeof window !== 'undefined' && getAuthParam() === 'ok') return;
    fetchUser();
  }, [fetchUser]);

  /** Hash 路由下须用 #/logto，用 path /logto 会落到首页 */
  const login = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.href = `${window.location.origin}/#/logto`;
    }
  }, []);

  /**
   * 弹窗内完成 Logto 登录，主窗口不跳转。
   * 打开 #/logto 弹窗，回调后中间层重定向到 /space?auth=ok，弹窗检测到后 postMessage 并关闭，主窗口刷新用户状态。
   * @returns Promise 在弹窗内登录成功并刷新用户后 resolve；弹窗被用户关闭未登录时 reject
   */
  const loginWithPopup = useCallback((): Promise<void> => {
    return openLogtoPopupAndWait(`${window.location.origin}/#/logto`, fetchUser);
  }, [fetchUser]);

  /**
   * 重新授权：弹窗内以 prompt=login 打开 Logto，可更换为其他账号。
   * @returns Promise 在弹窗内登录成功并刷新用户后 resolve；弹窗被用户关闭未登录时 reject
   */
  const reAuthWithPopup = useCallback((): Promise<void> => {
    return openLogtoPopupAndWait(`${window.location.origin}/#/logto?prompt=login`, fetchUser);
  }, [fetchUser]);

  const openLogtoPopupAndWait = useCallback((logtoUrl: string, onDone: () => Promise<unknown>): Promise<void> => {
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
        // 短延迟再拉用户，确保弹窗内 302 的 Set-Cookie 已落盘，主窗口 /me 能带上 Cookie
        setTimeout(() => {
          onDone().then(() => resolve());
        }, 200);
      };
      // 前 2s 不因弹窗关闭而 reject，给弹窗完成重定向并 postMessage 的时间
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
  }, [fetchUser]);

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

  /** 注销：请求服务端清除会话与 Cookie，并清空本地认证状态 */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      applyPayload({ ok: false }, false);
    }
  }, [applyPayload]);

  return {
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
  };
}
