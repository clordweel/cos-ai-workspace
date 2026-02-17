/**
 * Logto 认证 URL 构建逻辑，与 frontend/pages/logto.vue 一致。
 * 供 apps/web 等复用，保证 scope、redirect_uri、prompt 行为一致。
 */

export interface BuildLogtoAuthUrlParams {
  /** Logto 端点，如 https://your.logto.app */
  endpoint: string;
  /** 应用 ID */
  appId: string;
  /** 回调地址，须与 Logto 应用配置的 Redirect URI 一致，如 origin + '/logto-callback' */
  redirectUri: string;
  /** 可选 state，不传则自动生成 */
  state?: string;
  /** prompt=consent 重新授权以更新 profile；prompt=login 强制登录 */
  prompt?: 'consent' | 'login';
}

/**
 * 构建 Logto OIDC 授权 URL（与 frontend logto.vue 一致）
 * scope: openid profile email phone
 */
export function buildLogtoAuthUrl(params: BuildLogtoAuthUrlParams): string {
  const { endpoint, appId, redirectUri, prompt } = params;
  const state =
    params.state ?? `auth_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  const searchParams = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email phone',
    state,
  });
  if (prompt) {
    searchParams.set('prompt', prompt);
  }
  const base = endpoint.replace(/\/$/, '');
  return `${base}/oidc/auth?${searchParams.toString()}`;
}

/**
 * 构建回调后跳转到中间层换 token 的 URL（与 frontend logto-callback.vue 一致）
 * 前端收到 code 后应跳转到此 URL，中间层写 Cookie 并重定向到工作台
 */
export function buildLogtoCallbackRedirectUrl(params: {
  /** 当前页 origin，用于同源请求以落 Cookie */
  origin: string;
  /** 授权码 */
  code: string;
  /** 与授权时一致的 redirect_uri */
  redirectUri: string;
}): string {
  const { origin, code, redirectUri } = params;
  const base = origin.replace(/\/$/, '');
  const path = '/api/auth/logto/callback';
  const query = new URLSearchParams({ code, redirect_uri: redirectUri });
  return `${base}${path}?${query.toString()}`;
}
