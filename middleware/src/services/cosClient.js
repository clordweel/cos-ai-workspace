/**
 * 调用 cos/ERPNext API：确认创建物料 create_from_draft
 */
import { config } from '../config.js';

/** cos Base 为 <host>/api，方法路径为 /method/... */
const COS_METHOD = '/method/cos.api.material.create_from_draft';

/**
 * 确认创建物料（权限校验由 cos 侧负责，中间层仅转发并带认证）
 * @param {{ draft_id: string, confirmed_by: string }} payload
 * @returns {Promise<{ item_code?: string, item_name?: string, name?: string } | { error: string, exc?: string, message?: string }>}
 */
export async function createFromDraft(payload) {
  const { baseUrl, apiKey, timeoutMs } = config.cos;
  if (!baseUrl) {
    return { error: 'COS_ERP_BASE 未配置', message: '请在 .env 中设置 COS_ERP_BASE' };
  }

  const url = baseUrl.replace(/\/$/, '') + COS_METHOD;
  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
  };

  const controller = new AbortController();
  const timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        draft_id: payload.draft_id,
        confirmed_by: payload.confirmed_by,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') {
      return { error: '请求超时', message: `ERPNext 接口在 ${timeoutMs}ms 内未响应` };
    }
    throw e;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      error: body.exc || body.message || `HTTP ${res.status}`,
      ...(body.message && { message: body.message }),
    };
  }
  return body;
}
