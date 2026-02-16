/**
 * Mock 会话与消息类型，与 frontend mock 对齐。
 */

export type MockSessionType = 'private' | 'group';

export type MockParticipantKind = 'user' | 'bot';
export type MockParticipant = { name: string; avatar?: string; kind?: MockParticipantKind };

export interface MockSessionItem {
  id: string;
  title: string;
  type: MockSessionType;
  updatedAt: number;
  participants?: MockParticipant[];
}

/** 消息来源：与 frontend MessageSource 对齐，用于调试全情景等多来源/已读展示 */
export type MockMessageSourceType = 'other_user' | 'bot' | 'system';
export type MockMessageSource = { type: MockMessageSourceType; label?: string };

/** 消息互动：与 frontend MessageReaction 对齐 */
export type MockMessageReactionType = 'like' | 'dislike';
export type MockMessageReaction = { type: MockMessageReactionType; by: MockMessageSource };

/** 接收/送达状态：与 frontend MessageReceiptStatus 对齐 */
export type MockMessageReceiptStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'unread'
  | 'failed';

/**
 * 消息格式：基础字段必填，扩展字段用于调试全情景等；frontend 可直接映射为 ChatMessage。
 */
export interface MockMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  /** 已读时展示的读者来源等 */
  readBy?: MockMessageSource[];
  sources?: MockMessageSource[];
  thinking?: string;
  reactions?: MockMessageReaction[];
  editedAt?: number;
  editedBy?: MockMessageSource;
  contentChunks?: string[];
  receiptStatus?: MockMessageReceiptStatus;
  editableByCurrentUser?: boolean;
}
