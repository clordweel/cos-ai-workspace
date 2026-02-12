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

/** 回复引用：指向被回复的消息 */
export interface NormalizedInReplyTo {
  /** 被回复消息的 event_id / backendMessageId */
  id: string;
  /** 可选：被回复消息的 role，用于展示 */
  role?: 'user' | 'assistant';
  /** 可选：被回复消息内容摘要，用于展示引用块 */
  content?: string;
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
  /** 回复某条消息时的引用信息 */
  inReplyTo?: NormalizedInReplyTo;
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
  /** 回复某条消息时的 event_id / backendMessageId */
  replyToMessageId?: string;
  /** Matrix 每用户 token（混合方案） */
  matrixAccessToken?: string;
  /** 当前用户 MXID，用于 listMessages 等 role 判断 */
  currentUserMxid?: string;
}

export interface StreamMessageResult {
  backendSessionId?: string;
  backendMessageId?: string;
}

export interface ListSessionsParams {
  userId: string;
  /** Matrix 每用户 token（混合方案） */
  matrixAccessToken?: string;
}

export interface ListMessagesParams {
  sessionId: string;
  backendSessionId?: string;
  userId: string;
  limit?: number;
  beforeId?: string;
  matrixAccessToken?: string;
  /** 当前用户 MXID，用于 role/sources 判断 */
  currentUserMxid?: string;
}

export interface CreateSessionParams {
  userId: string;
  title?: string;
  matrixAccessToken?: string;
  currentUserMxid?: string;
}

export interface InviteToSessionParams {
  sessionId: string;
  backendSessionId?: string;
  userId: string;
  inviteeUserId: string;
  inviteeMxid: string;
  matrixAccessToken?: string;
}

export interface DeleteSessionParams {
  sessionId: string;
  backendSessionId?: string;
  userId: string;
  matrixAccessToken?: string;
}

export interface RenameSessionParams {
  sessionId: string;
  backendSessionId?: string;
  userId: string;
  title: string;
  matrixAccessToken?: string;
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
  createSession?(params: CreateSessionParams): Promise<NormalizedSession>;
  inviteToSession?(params: InviteToSessionParams): Promise<void>;
  deleteSession?(params: DeleteSessionParams): Promise<void>;
  renameSession?(params: RenameSessionParams): Promise<void>;
}
