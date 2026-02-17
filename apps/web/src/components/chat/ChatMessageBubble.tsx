'use client';

/**
 * 向后兼容：仅导出 MessageTile 与类型。
 * Element 风格消息列表请使用 MessageTile；类型见 chatMessageTypes。
 */

export { MessageTile as ChatMessageBubble } from './MessageTile';
export type { ChatMessageItem } from './chatMessageTypes';
