/**
 * Matrix 用户登录与修改密码（Client-Server API）
 * 供前端认证页 Matrix 登录、个人信息页修改 Matrix 密码使用
 */
import { config } from '../config.js';

const basePath = '/_matrix/client/v3';

function isMatrixConfigured(): boolean {
  const { matrix } = config;
  return Boolean(matrix.baseUrl && matrix.serverName);
}

export interface MatrixLoginResult {
  ok: true;
  access_token: string;
  user_id: string;
  device_id: string;
  base_url: string;
}

export interface MatrixLoginError {
  ok: false;
  error: string;
  statusCode?: number;
}

/** 根据输入推断 Matrix 登录 identifier（用户名 / 邮箱 / 手机号） */
function buildLoginIdentifier(
  identifier: string,
  country?: string
): { type: 'm.id.user'; user: string } | { type: 'm.id.thirdparty'; medium: 'email'; address: string } | { type: 'm.id.phone'; country: string; phone: string } {
  const raw = String(identifier).trim();
  if (raw.includes('@')) {
    return { type: 'm.id.thirdparty', medium: 'email', address: raw };
  }
  const digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.length >= 8 && /^\+?[\d\s]+$/.test(raw.trim())) {
    const c = (country || 'CN').toUpperCase();
    const phone = raw.startsWith('+') ? raw.slice(1).replace(/\D/g, '') : digitsOnly;
    return { type: 'm.id.phone', country: c, phone };
  }
  return { type: 'm.id.user', user: raw };
}

/**
 * 使用用户名 / 邮箱 / 手机号 + 密码登录 Matrix
 * identifier 自动推断：含 @ 为邮箱，纯数字（或 + 开头）为手机号，否则为用户名（localpart）
 */
export async function matrixLoginWithIdentifier(
  identifier: string,
  password: string,
  country?: string
): Promise<MatrixLoginResult | MatrixLoginError> {
  if (!isMatrixConfigured()) {
    return { ok: false, error: 'Matrix 未配置', statusCode: 503 };
  }
  const id = buildLoginIdentifier(identifier, country);
  const url = `${config.matrix.baseUrl}${basePath}/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'm.login.password',
      identifier: id,
      password,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    user_id?: string;
    device_id?: string;
    error?: string;
    errcode?: string;
  };
  if (!res.ok || !data.access_token) {
    return {
      ok: false,
      error: data.error || res.statusText || 'Matrix 登录失败',
      statusCode: res.status,
    };
  }
  return {
    ok: true,
    access_token: data.access_token,
    user_id: data.user_id ?? '',
    device_id: data.device_id ?? '',
    base_url: config.matrix.baseUrl,
  };
}

/**
 * 使用 user_id（localpart 或完整 MXID）+ password 登录，兼容旧接口
 */
export async function matrixLogin(
  userId: string,
  password: string
): Promise<MatrixLoginResult | MatrixLoginError> {
  const raw = String(userId).trim();
  const localpart = raw.startsWith('@') ? raw.slice(1).split(':')[0] : raw;
  return matrixLoginWithIdentifier(localpart, password);
}

export interface MatrixChangePasswordResult {
  ok: true;
}

export interface MatrixChangePasswordError {
  ok: false;
  error: string;
  statusCode?: number;
}

/**
 * 修改 Matrix 用户密码：先使用当前密码登录获取 token，再调用 account/password
 */
export async function matrixChangePassword(
  matrixUserId: string,
  currentPassword: string,
  newPassword: string
): Promise<MatrixChangePasswordResult | MatrixChangePasswordError> {
  if (!isMatrixConfigured()) {
    return { ok: false, error: 'Matrix 未配置', statusCode: 503 };
  }
  const loginResult = await matrixLogin(matrixUserId, currentPassword);
  if (!loginResult.ok) {
    return { ok: false, error: loginResult.error || '当前密码错误', statusCode: loginResult.statusCode };
  }
  const url = `${config.matrix.baseUrl}${basePath}/account/password`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginResult.access_token}`,
    },
    body: JSON.stringify({
      new_password: newPassword,
      auth: {
        type: 'm.login.password',
        user: matrixUserId,
        password: currentPassword,
      },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; errcode?: string };
  if (!res.ok) {
    return {
      ok: false,
      error: data.error || res.statusText || '修改密码失败',
      statusCode: res.status,
    };
  }
  return { ok: true };
}
