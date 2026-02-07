/**
 * 系统诊断：通过 frappe-js-sdk 获取无需业务权限的数据（当前用户、版本等）
 */
import { FrappeApp } from 'frappe-js-sdk';
import { config } from '../config.js';

/** 从 SDK 抛出的错误中安全取出可读信息（SDK 在 error.response 为空时可能抛 TypeError） */
function errorMessage(e) {
  if (!e) return '未知错误';
  if (typeof e?.message === 'string' && e.message) return e.message;
  if (e?.httpStatus && e?.message) return `${e.httpStatus} ${e.message}`;
  if (e?.exception) return e.exception;
  return String(e);
}

/** 带超时的 Promise 包装 */
function withTimeout(promise, ms, label = '请求') {
  if (!ms || ms <= 0) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label}超时（${ms}ms）`)), ms)
    ),
  ]);
}

/**
 * 运行诊断项列表，返回各检查项结果（不抛错）
 * @returns {{ ok: boolean, checks: Array<{ id: string, name: string, ok: boolean, value?: string, error?: string }> }}
 */
export async function runDiagnostics() {
  const { baseUrl, apiKey, timeoutMs } = config.cos;
  const checks = [];

  const baseConfigured = Boolean(baseUrl && baseUrl.trim());
  checks.push({
    id: 'base_configured',
    name: 'ERPNext 地址已配置',
    ok: baseConfigured,
    value: baseConfigured ? baseUrl : undefined,
    error: baseConfigured ? undefined : '未设置 COS_ERP_BASE',
  });

  if (!baseConfigured) {
    return { ok: false, checks };
  }

  // SDK 期望站点根 URL（不含 /api），内部会请求 /api/method/...
  const sdkBase = baseUrl.replace(/\/api\/?$/, '') || baseUrl;
  const timeout = timeoutMs || 15_000;

  let frappe;
  try {
    frappe = new FrappeApp(sdkBase, {
      useToken: true,
      token: () => apiKey || '',
      type: 'Bearer',
    });
  } catch (e) {
    checks.push({
      id: 'sdk_init',
      name: 'SDK 初始化',
      ok: false,
      error: errorMessage(e),
    });
    return { ok: false, checks };
  }

  // 2. 连通性 + 当前用户（frappe.auth.get_logged_user）
  try {
    const user = await withTimeout(
      frappe.auth().getLoggedInUser(),
      timeout,
      'get_logged_user'
    );
    const loggedUser = typeof user === 'string' ? user : (user?.message ?? String(user ?? ''));
    checks.push({
      id: 'erp_reach',
      name: 'ERPNext 连接与认证',
      ok: true,
      value: '已连通',
    });
    checks.push({
      id: 'logged_user',
      name: '当前 API 对应用户',
      ok: true,
      value: loggedUser || '—',
    });
  } catch (e) {
    const msg = errorMessage(e);
    const hint =
      /403|401|Forbidden|Unauthorized/i.test(msg)
        ? `${msg}（请检查 .env 中 COS_ERP_API_KEY 是否填写且有效）`
        : msg;
    checks.push({
      id: 'erp_reach',
      name: 'ERPNext 连接与认证',
      ok: false,
      error: hint,
    });
    checks.push({
      id: 'logged_user',
      name: '当前 API 对应用户',
      ok: false,
      value: '—',
      error: hint,
    });
  }

  // 3. Frappe 版本（frappe.get_version，若站点未开放会失败）
  try {
    const res = await withTimeout(
      frappe.call().get('frappe.get_version'),
      timeout,
      'get_version'
    );
    const version =
      typeof res?.message !== 'undefined'
        ? (typeof res.message === 'string' ? res.message : res.message?.version ?? String(res.message))
        : res?.version ?? String(res ?? '—');
    checks.push({
      id: 'frappe_version',
      name: 'Frappe 版本',
      ok: true,
      value: version || '—',
    });
  } catch (e) {
    const msg = errorMessage(e);
    checks.push({
      id: 'frappe_version',
      name: 'Frappe 版本',
      ok: false,
      value: '—',
      error: /whitelist|403|417|Permission|未开放/i.test(msg)
        ? '接口未开放或需权限，可忽略'
        : msg,
    });
  }

  const ok = checks.filter((c) => c.id === 'erp_reach')[0]?.ok === true;
  return { ok, checks };
}
