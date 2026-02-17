import { useEffect, useState } from 'react';
import { buildLogtoAuthUrl } from '@cosai/logto-auth';
import { Button } from '../components/ui/button';

/** OIDC 规定 redirect_uri 不能含 fragment，故用 path；落地 /logto-callback 时由 index 重定向到 #/logto-callback */
const LOGTO_CALLBACK_PATH = '/logto-callback';

/** 中间层 404 时尝试用构建时环境变量（LOGTO_ENDPOINT、LOGTO_APP_ID）构建授权 URL */
function getFallbackConfig(): { endpoint: string; appId: string; appOrigin: string } | null {
  if (typeof window === 'undefined') return null;
  const endpoint = (process.env as { LOGTO_ENDPOINT?: string }).LOGTO_ENDPOINT?.trim();
  const appId = (process.env as { LOGTO_APP_ID?: string }).LOGTO_APP_ID?.trim();
  if (!endpoint || !appId) return null;
  const appOrigin = (process.env as { APP_ORIGIN?: string }).APP_ORIGIN?.trim() || window.location.origin;
  return { endpoint, appId, appOrigin };
}

/** Hash 路由下 prompt 可能在 hash 中，如 #/logto?prompt=login */
function getLogtoPageQuery(): URLSearchParams {
  const search = window.location.search;
  if (search && search.startsWith('?')) return new URLSearchParams(search);
  const hash = window.location.hash;
  const qs = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return new URLSearchParams(qs);
}

export default function Logto() {
  const [error, setError] = useState<string>('');

  const fetchConfigAndRedirect = () => {
    setError('');
    const promptParam = getLogtoPageQuery().get('prompt');
    const prompt = promptParam === 'consent' || promptParam === 'login' ? promptParam : undefined;

    fetch('/api/auth/logto/config', { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({})) as { ok?: boolean; endpoint?: string; appId?: string; appOrigin?: string; error?: string };
        if (!res.ok) {
          if (res.status === 404) {
            const fallback = getFallbackConfig();
            if (fallback) {
              const redirectUri = `${fallback.appOrigin.replace(/\/$/, '')}${LOGTO_CALLBACK_PATH}`;
              const url = buildLogtoAuthUrl({
                endpoint: fallback.endpoint,
                appId: fallback.appId,
                redirectUri,
                prompt,
              });
              window.location.href = url;
              return;
            }
            setError('认证服务不可用（404）。请启动中间层并设置 .env 中的 WEBPACK_PROXY_TARGET，或仅前端时设置 LOGTO_ENDPOINT、LOGTO_APP_ID 后重新构建。详见 .env.example。');
            return;
          }
          setError(data.error || `请求失败（${res.status}）`);
          return;
        }
        if (!data.ok || !data.endpoint || !data.appId) {
          setError(data.error || '未配置单点登录');
          return;
        }
        const origin = typeof window !== 'undefined' ? (data.appOrigin || window.location.origin) : data.appOrigin || '';
        const redirectUri = `${origin.replace(/\/$/, '')}${LOGTO_CALLBACK_PATH}`;
        const url = buildLogtoAuthUrl({
          endpoint: data.endpoint,
          appId: data.appId,
          redirectUri,
          prompt,
        });
        window.location.href = url;
      })
      .catch(() => {
        const fallback = getFallbackConfig();
        if (fallback) {
          const redirectUri = `${fallback.appOrigin.replace(/\/$/, '')}${LOGTO_CALLBACK_PATH}`;
          const url = buildLogtoAuthUrl({
            endpoint: fallback.endpoint,
            appId: fallback.appId,
            redirectUri,
            prompt,
          });
          window.location.href = url;
          return;
        }
        setError('网络错误，请稍后重试');
      });
  };

  useEffect(() => {
    fetchConfigAndRedirect();
  }, []);

  return (
    <div className="logto-auth-page">
      <div className="logto-auth-card">
        <h1 className="logto-auth-title">登录</h1>
        {error ? (
          <>
            <p className="logto-auth-error mt-2">{error}</p>
            <div className="logto-auth-actions">
              <Button variant="outline" onClick={fetchConfigAndRedirect}>
                重试
              </Button>
            </div>
          </>
        ) : (
          <p className="logto-auth-description mt-2">正在跳转到登录…</p>
        )}
      </div>
    </div>
  );
}
