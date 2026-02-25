/**
 * Frappe/ERPNext 客户端封装（frappe-js-sdk）
 * 仅 apps/api 内使用，前端不直连。支持单 Key 试跑与后续按用户 Key（token 由调用方传入）。
 */
import { FrappeApp } from 'frappe-js-sdk';
import { config } from '../config.js';

/** Memo 试点使用的 DocType：标准 ToDo 或自定义 Memo，由环境 COS_ERP_MEMO_DOCTYPE 或默认 ToDo */
export const MEMO_DOCTYPE = (process.env.COS_ERP_MEMO_DOCTYPE || 'ToDo').trim() || 'ToDo';

export interface MemoDoc {
  name?: string;
  description?: string;
  status?: string;
  priority?: string;
  assigned_to?: string;
  reference_type?: string;
  reference_name?: string;
  [key: string]: unknown;
}

/**
 * 创建 FrappeApp 实例（Base URL + Token）
 * @param baseUrl - ERP API Base URL，如 https://erp.example.com/api
 * @param token - API Key / Bearer token；不传则使用 config.cos.apiKey（单 Key 试跑）
 */
export function createFrappeApp(baseUrl: string, token?: string): FrappeApp {
  const key = token ?? config.cos.apiKey;
  return new FrappeApp(baseUrl, {
    useToken: true,
    token: () => key ?? '',
    type: 'Bearer',
  });
}

/**
 * 当前是否已配置 ERP（可调 Memo/cos）
 */
export function isErpConfigured(): boolean {
  return Boolean(config.cos.baseUrl && config.cos.apiKey);
}

/**
 * 列出 Memo（ToDo 或 Memo DocType）
 */
export async function listMemos(baseUrl: string, token?: string): Promise<MemoDoc[]> {
  const app = createFrappeApp(baseUrl, token);
  const db = app.db();
  const list = await db.getDocList<MemoDoc>(MEMO_DOCTYPE, {
    fields: ['name', 'description', 'status', 'priority', 'modified', 'owner', 'assigned_to'],
    limit: 100,
    orderBy: { field: 'modified', order: 'desc' },
  });
  return list ?? [];
}

/**
 * 获取单条 Memo
 */
export async function getMemo(baseUrl: string, id: string, token?: string): Promise<MemoDoc | null> {
  const app = createFrappeApp(baseUrl, token);
  const db = app.db();
  try {
    const doc = await db.getDoc<MemoDoc>(MEMO_DOCTYPE, id);
    return doc ?? null;
  } catch {
    return null;
  }
}

/**
 * 创建 Memo；ToDo 常用字段：description, status, priority, assigned_to
 */
export async function createMemo(
  baseUrl: string,
  value: Partial<MemoDoc> & { description?: string },
  token?: string
): Promise<MemoDoc> {
  const app = createFrappeApp(baseUrl, token);
  const db = app.db();
  const doc = await db.createDoc<MemoDoc>(MEMO_DOCTYPE, value as MemoDoc);
  return doc;
}

/**
 * 更新 Memo
 */
export async function updateMemo(
  baseUrl: string,
  id: string,
  value: Partial<MemoDoc>,
  token?: string
): Promise<MemoDoc> {
  const app = createFrappeApp(baseUrl, token);
  const db = app.db();
  const doc = await db.updateDoc<MemoDoc>(MEMO_DOCTYPE, id, value);
  return doc;
}

/**
 * 删除 Memo
 */
export async function deleteMemo(baseUrl: string, id: string, token?: string): Promise<void> {
  const app = createFrappeApp(baseUrl, token);
  const db = app.db();
  await db.deleteDoc(MEMO_DOCTYPE, id);
}
