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
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Matrix 等：富文本 HTML（如 formatted_body），有则优先用于渲染，须经前端净化 */
  formattedBody?: string;
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
  /** 消息中 @ 的机器人 id 列表，供按机器人路由（如 Dify 应用） */
  botIds?: string[];
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

export interface EditMessageParams {
  sessionId: string;
  backendSessionId?: string;
  messageId: string;
  content: string;
  formattedBody?: string;
  userId: string;
  matrixAccessToken?: string;
  currentUserMxid?: string;
}

export interface RedactMessageParams {
  sessionId: string;
  backendSessionId?: string;
  messageId: string;
  userId: string;
  matrixAccessToken?: string;
  currentUserMxid?: string;
}

/** 会话成员：join=已在房，invite=待接受邀请 */
export interface NormalizedRoomMember {
  userId: string;
  membership: 'join' | 'invite';
  displayName?: string;
  avatarUrl?: string;
  /** 是否为房间创建者（仅 Matrix 等支持时返回，用于 UI 标注与禁止踢出/屏蔽） */
  isOwner?: boolean;
}

export interface ListSessionMembersParams {
  sessionId: string;
  backendSessionId?: string;
  matrixAccessToken?: string;
}

export interface KickFromSessionParams {
  sessionId: string;
  backendSessionId?: string;
  targetUserId: string;
  matrixAccessToken?: string;
  reason?: string;
}

export interface BanFromSessionParams {
  sessionId: string;
  backendSessionId?: string;
  targetUserId: string;
  matrixAccessToken?: string;
  reason?: string;
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
  listMessages?(params: ListMessagesParams): Promise<{ messages: NormalizedMessage[]; nextToken?: string }>;
  createSession?(params: CreateSessionParams): Promise<NormalizedSession>;
  inviteToSession?(params: InviteToSessionParams): Promise<void>;
  deleteSession?(params: DeleteSessionParams): Promise<void>;
  renameSession?(params: RenameSessionParams): Promise<void>;
  editMessage?(params: EditMessageParams): Promise<void>;
  redactMessage?(params: RedactMessageParams): Promise<void>;
  listSessionMembers?(params: ListSessionMembersParams): Promise<NormalizedRoomMember[]>;
  kickFromSession?(params: KickFromSessionParams): Promise<void>;
  banFromSession?(params: BanFromSessionParams): Promise<void>;
}
