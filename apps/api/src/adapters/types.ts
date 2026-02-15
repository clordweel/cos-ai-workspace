/**
 * 会话/消息标准化类型（与现 middleware adapters/types 对齐，阶段 3 最小集）
 */
export interface NormalizedSession {
  id: string;
  title: string;
  updatedAt: number;
  backendSessionId?: string;
  provider?: string;
}

export interface NormalizedMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
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
  replyToMessageId?: string;
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

export interface CreateSessionParams {
  userId: string;
  title?: string;
}
