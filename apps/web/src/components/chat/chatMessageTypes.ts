/**
 * 聊天消息类型：与 Element 风格消息列表对齐，支持全部展示字段。
 */

export type MessageSourceType = 'other_user' | 'bot' | 'system';
export type MessageSource = { type: MessageSourceType; label?: string };

export type MessageReactionType = 'like' | 'dislike';
export type MessageReaction = { type: MessageReactionType; by: MessageSource };

export type MessageReceiptStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'unread'
  | 'failed';

/** 单条消息：必填基础字段 + Element 风格扩展（已读、来源、反应、编辑、状态、回复引用等） */
export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: number;
  /** 已读时展示的读者来源 */
  readBy?: MessageSource[];
  /** 消息来源（bot/用户/系统），展示在气泡旁或下方 */
  sources?: MessageSource[];
  /** 思考过程（仅展示用） */
  thinking?: string;
  reactions?: MessageReaction[];
  editedAt?: number;
  editedBy?: MessageSource;
  contentChunks?: string[];
  receiptStatus?: MessageReceiptStatus;
  editableByCurrentUser?: boolean;
  /** 回复引用的消息 id（Element 风格引用线） */
  replyToId?: string;
}
