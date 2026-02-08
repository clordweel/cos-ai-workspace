/**
 * 聊天后端适配器注册与获取
 * 根据 config.chat.provider 返回当前启用的适配器
 */
import { config } from '../config.js';
import { createMockAdapter } from './mock.js';

const adapters = new Map();

function register(name, factory) {
  adapters.set(name, factory);
}

// 注册内置适配器
register('mock', () => createMockAdapter());

/**
 * 获取当前配置的聊天后端适配器
 * @returns {import('./mock.js').ReturnType<typeof createMockAdapter> | null} 未配置或 provider 不可用时返回 null
 */
export function getChatAdapter() {
  const provider = config.chat?.provider || 'mock';
  const factory = adapters.get(provider);
  if (!factory) return null;
  try {
    return factory();
  } catch (e) {
    return null;
  }
}
