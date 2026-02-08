/**
 * 标准化会话/消息类型（与后端无关）
 * 所有适配器负责将后端 API 映射为此模型。
 */

export type ProviderKind = 'dify' | 'zulip' | 'matrix' | 'mock';

export interface NormalizedSession {
  id: string;
  title: string;
  updatedAt: number;
  backendSessionId?: string;
  provider?: ProviderKind;
}

export interface NormalizedMessageSource {
  type: 'other_user' | 'bot' | 'system';
  label?: string;
}

export interface NormalizedMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  sources?: NormalizedMessageSource[];
  receiptStatus?: string;
  editedAt?: number;
  backendMessageId?: string;
  createdAt?: number;
}

export type SSESend = (event: string, data: Record<string, unknown>) => void;
export type SSEFlush = () => void;

export interface StreamMessageParams {
  sessionId: string;
  backendSessionId?: string;
  message: string;
  userId: string;
  send: SSESend;
  flush: SSEFlush;
}

export interface StreamMessageResult {
  backendSessionId?: string;
  backendMessageId?: string;
}

export interface ListSessionsParams {
  userId: string;
}

export interface ListMessagesParams {
  sessionId: string;
  backendSessionId?: string;
  userId: string;
  limit?: number;
  beforeId?: string;
}

/**
 * 聊天后端适配器接口（各适配器实现此契约）
 */
export interface ChatBackendAdapter {
  name: ProviderKind;
  supportsStreaming(): boolean;
  supportsListSessions(): boolean;
  supportsListMessages(): boolean;
  streamMessage(params: StreamMessageParams): Promise<StreamMessageResult | void>;
  listSessions?(params: ListSessionsParams): Promise<NormalizedSession[]>;
  listMessages?(params: ListMessagesParams): Promise<NormalizedMessage[]>;
}
