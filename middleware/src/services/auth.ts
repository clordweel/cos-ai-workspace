/**
 * 认证服务统一入口：会话存储、Frappe 登录、Logto SSO（实现拆至 services/auth/*.ts）
 */
export {
  getCookieName,
  getFrappeAuthForSession,
  getSessionFromCookie,
  getStableUserId,
  generateSessionId,
  logoutSession,
  saveSession,
  SESSION_TTL_MS,
  type Session,
  type UserProfile,
} from './auth/sessionStore.js';

export {
  loginWithPassword,
  loginWithToken,
  type LoginResult,
  type LoginResultOk,
  type LoginResultFail,
} from './auth/frappeLogin.js';

export {
  getLogtoAuthUrl,
  handleLogtoCallback,
  createSessionFromLogtoAccessToken,
  type LogtoAuthUrlResult,
  type LogtoAuthUrlError,
  type LogtoCallbackResultOk,
  type LogtoCallbackResultFail,
} from './auth/logto.js';
