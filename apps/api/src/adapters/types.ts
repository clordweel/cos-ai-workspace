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
  /** Matrix 用户 token，provider=matrix 时必传 */
  matrixAccessToken?: string;
  /** 当前用户 MXID，用于 role/sources 判断 */
  currentUserMxid?: string;
}

export interface ListSessionsParams {
  userId: string;
  matrixAccessToken?: string;
  currentUserMxid?: string;
}

export interface ListMessagesParams {
  sessionId: string;
  backendSessionId?: string;
  userId: string;
  limit?: number;
  beforeId?: string;
  matrixAccessToken?: string;
  currentUserMxid?: string;
}

export interface CreateSessionParams {
  userId: string;
  title?: string;
  matrixAccessToken?: string;
  currentUserMxid?: string;
}
