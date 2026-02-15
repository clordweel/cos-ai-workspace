/**
 * Dify 聊天后端适配器：流式对话 + 会话列表/历史（Dify API）
 * 支持多应用：通过 backendAppId 选择 getDifyConfig(backendAppId)
 */
import { getDifyConfig } from '../config.js';
import { runStreamWithParams } from '../services/difyStream.js';
import type {
  ChatBackendAdapter,
  NormalizedSession,
  NormalizedMessage,
  ListSessionsParams,
  ListMessagesParams,
  StreamMessageParams,
} from './types.js';

interface DifyConversation {
  id: string;
  name?: string;
  created_at?: number;
  updated_at?: number;
}

interface DifyMessage {
  id?: string;
  conversation_id?: string;
  query?: string;
  answer?: string;
  created_at?: number;
}

async function difyFetch<T>(
  apiBase: string,
  apiKey: string,
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(path, apiBase.replace(/\/$/, '') + '/');
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dify API ${path} ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * 创建 Dify 适配器实例（无状态，配置按 backendAppId 运行时获取）
 */
export function createDifyAdapter(): ChatBackendAdapter {
  return {
    name: 'dify',

    supportsStreaming() {
      return true;
    },

    supportsListSessions() {
      return true;
    },

    supportsListMessages() {
      return true;
    },

    async streamMessage(params: StreamMessageParams) {
      const { backendAppId, send, flush, sessionId, backendSessionId, message, userId } = params;
      const difyConfig = getDifyConfig(backendAppId);
      await runStreamWithParams(
        {
          message,
          conversation_id: backendSessionId || sessionId,
          user_id: userId,
        },
        send,
        flush,
        difyConfig
      );
    },

    async listSessions(params: ListSessionsParams): Promise<NormalizedSession[]> {
      const { userId, backendAppId } = params;
      const { apiBase, apiKey, id: appId } = getDifyConfig(backendAppId);
      const data = await difyFetch<{ data?: DifyConversation[] }>(
        apiBase,
        apiKey,
        'conversations',
        { user: userId, limit: '100' }
      );
      const list = data.data ?? [];
      return list.map((c) => ({
        id: c.id,
        title: c.name || '未命名会话',
        updatedAt: (c.updated_at ?? c.created_at ?? 0) * 1000,
        backendSessionId: c.id,
        provider: 'dify' as const,
        backendAppId: appId === 'default' ? undefined : appId,
      }));
    },

    async listMessages(params: ListMessagesParams): Promise<NormalizedMessage[]> {
      const { sessionId, backendSessionId, userId, limit = 50, backendAppId } = params;
      const convId = backendSessionId || sessionId;
      const { apiBase, apiKey } = getDifyConfig(backendAppId);
      const data = await difyFetch<{ data?: DifyMessage[] }>(
        apiBase,
        apiKey,
        'messages',
        {
          conversation_id: convId,
          user: userId,
          limit: String(Number(limit) || 20),
        }
      );
      const list = data.data ?? [];
      const out: NormalizedMessage[] = [];
      for (const m of list) {
        if (m.query != null && m.query !== '') {
          out.push({
            id: `q-${m.id ?? out.length}`,
            role: 'user',
            content: m.query,
            backendMessageId: m.id,
            createdAt: m.created_at ? m.created_at * 1000 : undefined,
          });
        }
        if (m.answer != null && m.answer !== '') {
          out.push({
            id: `a-${m.id ?? out.length}`,
            role: 'assistant',
            content: m.answer,
            backendMessageId: m.id,
            createdAt: m.created_at ? m.created_at * 1000 : undefined,
          });
        }
      }
      return out;
    },
  };
}
