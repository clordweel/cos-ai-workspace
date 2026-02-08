/**
 * 调用 cos/ERPNext API：确认创建物料 create_from_draft
 */
import { config } from '../config.js';
import { getFrappeAuthForSession } from './auth.js';
import type { Session } from './auth.js';

const COS_METHOD = '/method/cos.api.material.create_from_draft';

export interface CreateFromDraftPayload {
  draft_id: string;
  confirmed_by: string;
}

export interface CreateFromDraftSuccess {
  item_code?: string;
  item_name?: string;
  name?: string;
}

export interface CreateFromDraftError {
  error: string;
  message?: string;
  exc?: string;
}

/**
 * 确认创建物料（权限校验由 cos 侧负责，中间层仅转发并带认证）
 */
export async function createFromDraft(
  payload: CreateFromDraftPayload,
  session: Session | null | undefined
): Promise<CreateFromDraftSuccess | (CreateFromDraftError & { statusCode?: number })> {
  const { baseUrl, apiKey, timeoutMs } = config.cos;
  if (!baseUrl) {
    return { error: 'COS_ERP_BASE 未配置', message: '请在 .env 中设置 COS_ERP_BASE' };
  }

  const url = baseUrl.replace(/\/$/, '') + COS_METHOD;
  const authHeaders = session
    ? getFrappeAuthForSession(session)
    : apiKey
      ? { Authorization: `Bearer ${apiKey}` }
      : {};
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders,
  };

  const controller = new AbortController();
  const timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let res: Response;
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
    if (e instanceof Error && e?.name === 'AbortError') {
      return { error: '请求超时', message: `ERPNext 接口在 ${timeoutMs}ms 内未响应` };
    }
    throw e;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err: CreateFromDraftError & { statusCode?: number } = {
      error: (body.exc ?? body.message ?? `HTTP ${res.status}`) as string,
    };
    if (body.message) err.message = body.message as string;
    return err;
  }
  return body as CreateFromDraftSuccess;
}
