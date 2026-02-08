/**
 * 聊天后端适配器注册与获取
 * 根据 config.chat.provider 返回当前启用的适配器
 */
import { config } from '../config.js';
import { createMockAdapter } from './mock.js';
import type { ChatBackendAdapter } from './types.js';

const adapters = new Map<string, () => ChatBackendAdapter>();

function register(name: string, factory: () => ChatBackendAdapter): void {
  adapters.set(name, factory);
}

register('mock', () => createMockAdapter());

/**
 * 获取当前配置的聊天后端适配器
 * 未配置或 provider 不可用时返回 null
 */
export function getChatAdapter(): ChatBackendAdapter | null {
  const provider = config.chat?.provider || 'mock';
  const factory = adapters.get(provider);
  if (!factory) return null;
  try {
    return factory();
  } catch {
    return null;
  }
}
