/**
 * Mock 适配器单元测试
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createMockAdapter } from '../../src/adapters/mock.js';

describe('Mock adapter', () => {
  it('has name mock', () => {
    const adapter = createMockAdapter();
    assert.strictEqual(adapter.name, 'mock');
  });

  it('supports streaming, listSessions, listMessages', () => {
    const adapter = createMockAdapter();
    assert.strictEqual(adapter.supportsStreaming(), true);
    assert.strictEqual(adapter.supportsListSessions(), true);
    assert.strictEqual(adapter.supportsListMessages(), true);
  });

  it('listSessions returns array with id, title, updatedAt, provider', async () => {
    const adapter = createMockAdapter();
    const list = await adapter.listSessions({ userId: 'default' });
    assert(Array.isArray(list));
    assert(list.length >= 1);
    const first = list[0];
    assert(first.id);
    assert(first.title);
    assert(typeof first.updatedAt === 'number');
    assert.strictEqual(first.provider, 'mock');
  });

  it('listMessages returns array for known session', async () => {
    const adapter = createMockAdapter();
    const messages = await adapter.listMessages({
      sessionId: 'mock-session-1',
      backendSessionId: 'mock-session-1',
      userId: 'default',
      limit: 20,
    });
    assert(Array.isArray(messages));
    assert(messages.length >= 1);
    assert.strictEqual(messages[0].role, 'user');
    assert.strictEqual(typeof messages[0].content, 'string');
  });

  it('listMessages returns empty array for unknown session', async () => {
    const adapter = createMockAdapter();
    const messages = await adapter.listMessages({
      sessionId: 'unknown-session',
      userId: 'default',
    });
    assert(Array.isArray(messages));
    assert.strictEqual(messages.length, 0);
  });

  it('streamMessage sends status, message deltas, and message_end', async () => {
    const adapter = createMockAdapter();
    const events = [];
    const send = (event, data) => {
      events.push({ event, data });
    };
    const flush = () => {};
    await adapter.streamMessage({
      message: '测试',
      userId: 'default',
      send,
      flush,
    });
    const eventNames = events.map((e) => e.event);
    assert(eventNames.includes('status'));
    assert(eventNames.includes('message_end'));
    const messageEvents = events.filter((e) => e.event === 'message');
    assert(messageEvents.length >= 1);
    assert(messageEvents.some((e) => e.data && e.data.delta));
  });
});
