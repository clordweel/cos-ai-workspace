/**
 * 聊天后端适配器：按 config.chat.provider 返回 mock 或 matrix（在 api 内实现，不依赖 middleware）
 */
import { config } from '../config.js';
import { getMockChatAdapter } from './mockChat.js';
import { createMatrixAdapter, isMatrixConfigured } from './matrixChat.js';

export type ChatAdapter = ReturnType<typeof getMockChatAdapter> | ReturnType<typeof createMatrixAdapter>;

export function getChatAdapter(): ChatAdapter | null {
  const provider = config.chat?.provider || 'mock';
  if (provider === 'matrix') {
    if (!isMatrixConfigured()) return null;
    return createMatrixAdapter();
  }
  return getMockChatAdapter();
}
