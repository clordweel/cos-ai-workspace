/**
 * 连接器凭证存储：按 logtoSub + provider 读/写/删
 * 供认证授权管理应用与业务路由（Memo、物料等）按用户取 ERP/Outline 等凭证。
 * 实现层可为 Logto customData 或后端键值库；当前一版为 Logto customData（生产建议加密敏感字段）。
 */
import {
  getLogtoUserCustomData,
  patchLogtoUserCustomData,
} from './logtoPreferences.js';

export const CONNECTOR_CREDENTIALS_KEY = 'connector_credentials' as const;

/** 已知 provider 标识 */
export type ConnectorProvider = 'erpnext' | 'outline';

/** 单 provider 凭证（按 provider 扩展） */
export interface ConnectorCredentials {
  apiKey?: string;
  apiSecret?: string;
  [key: string]: string | undefined;
}

export interface IConnectorCredentialsStore {
  get(logtoSub: string, provider: ConnectorProvider): Promise<ConnectorCredentials | null>;
  set(logtoSub: string, provider: ConnectorProvider, credentials: ConnectorCredentials): Promise<void>;
  delete(logtoSub: string, provider: ConnectorProvider): Promise<void>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function getConnectorDataFromCustomData(customData: Record<string, unknown>): Record<string, ConnectorCredentials> {
  const raw = customData[CONNECTOR_CREDENTIALS_KEY];
  if (!isPlainObject(raw)) return {};
  const out: Record<string, ConnectorCredentials> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (isPlainObject(v) && (typeof v.apiKey === 'string' || typeof v.apiSecret === 'string')) {
      out[k] = { apiKey: v.apiKey as string, apiSecret: v.apiSecret as string };
    }
  }
  return out;
}

/**
 * 使用 Logto customData 存储连接器凭证（key: connector_credentials）
 * 生产环境建议对 apiKey/apiSecret 做加密后再写入。
 */
export class LogtoConnectorCredentialsStore implements IConnectorCredentialsStore {
  async get(logtoSub: string, provider: ConnectorProvider): Promise<ConnectorCredentials | null> {
    const res = await getLogtoUserCustomData(logtoSub);
    if (!res.ok) return null;
    const map = getConnectorDataFromCustomData(res.customData);
    return map[provider] ?? null;
  }

  async set(logtoSub: string, provider: ConnectorProvider, credentials: ConnectorCredentials): Promise<void> {
    const res = await getLogtoUserCustomData(logtoSub);
    const currentCustom = res.ok ? res.customData : {};
    const currentMap = getConnectorDataFromCustomData(currentCustom);
    const nextMap = { ...currentMap, [provider]: credentials };
    const patch = { ...currentCustom, [CONNECTOR_CREDENTIALS_KEY]: nextMap };
    const patchRes = await patchLogtoUserCustomData(logtoSub, patch);
    if (!patchRes.ok) throw new Error(patchRes.error || '更新连接器凭证失败');
  }

  async delete(logtoSub: string, provider: ConnectorProvider): Promise<void> {
    const res = await getLogtoUserCustomData(logtoSub);
    if (!res.ok) return;
    const currentMap = getConnectorDataFromCustomData(res.customData);
    if (!(provider in currentMap)) return;
    const { [provider]: _, ...rest } = currentMap;
    const patch = { ...res.customData, [CONNECTOR_CREDENTIALS_KEY]: rest };
    await patchLogtoUserCustomData(logtoSub, patch);
  }
}

const defaultStore: IConnectorCredentialsStore = new LogtoConnectorCredentialsStore();

export function getConnectorCredentialsStore(): IConnectorCredentialsStore {
  return defaultStore;
}
