/**
 * 系统诊断：通过 frappe-js-sdk 获取无需业务权限的数据（当前用户、版本等）
 */
import { FrappeApp } from 'frappe-js-sdk';
import { config } from '../config.js';

export interface DiagnosticCheck {
  id: string;
  name: string;
  ok: boolean;
  value?: string;
  error?: string;
}

export interface DiagnosticsResult {
  ok: boolean;
  checks: DiagnosticCheck[];
}

function errorMessage(e: unknown): string {
  if (!e) return '未知错误';
  if (typeof (e as Error)?.message === 'string' && (e as Error).message) return (e as Error).message;
  const err = e as { httpStatus?: number; message?: string; exception?: string };
  if (err?.httpStatus && err?.message) return `${err.httpStatus} ${err.message}`;
  if (err?.exception) return err.exception;
  return String(e);
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = '请求'
): Promise<T> {
  if (!ms || ms <= 0) return promise;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}超时（${ms}ms）`)), ms)
    ),
  ]);
}

/**
 * 运行诊断项列表，返回各检查项结果（不抛错）
 */
export async function runDiagnostics(): Promise<DiagnosticsResult> {
  const { baseUrl, apiKey, timeoutMs } = config.cos;
  const checks: DiagnosticCheck[] = [];

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

  const sdkBase = baseUrl.replace(/\/api\/?$/, '') || baseUrl;
  const timeout = timeoutMs || 15_000;

  let frappe: InstanceType<typeof FrappeApp>;
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

  try {
    const user = await withTimeout(
      frappe.auth().getLoggedInUser(),
      timeout,
      'get_logged_user'
    );
    const loggedUser =
      typeof user === 'string' ? user : (user as { message?: string })?.message ?? String(user ?? '');
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

  try {
    const res = await withTimeout(
      frappe.call().get('frappe.get_version'),
      timeout,
      'get_version'
    );
    const resMsg = res as { message?: string | { version?: string }; version?: string };
    const version =
      typeof resMsg?.message !== 'undefined'
        ? typeof resMsg.message === 'string'
          ? resMsg.message
          : (resMsg.message as { version?: string })?.version ?? String(resMsg.message)
        : resMsg?.version ?? String(res ?? '—');
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
