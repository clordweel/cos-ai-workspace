/**
 * 适配器注册与 getChatAdapter 行为测试
 * 默认 CHAT_PROVIDER 为 mock 时返回 Mock 适配器
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('getChatAdapter', () => {
  it('returns mock adapter when CHAT_PROVIDER is mock (default)', async () => {
    const { getChatAdapter } = await import('../../src/adapters/index.js');
    const adapter = getChatAdapter();
    assert(adapter !== null, 'adapter should be defined when provider is mock');
    assert.strictEqual(adapter.name, 'mock');
    assert.strictEqual(adapter.supportsStreaming(), true);
  });
});
