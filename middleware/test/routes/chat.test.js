/**
 * 会话相关路由集成测试（依赖 Mock 适配器，CHAT_PROVIDER=mock）
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import { chatRoutes } from '../../dist/src/routes/chat.js';

describe('Chat routes (mock adapter)', () => {
  let app;

  before(async () => {
    app = Fastify({ logger: false });
    await app.register(chatRoutes);
  });

  after(async () => {
    await app.close();
  });

  it('GET /api/sessions returns 200 and sessions array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      query: { user_id: 'default' },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert(body && Array.isArray(body.sessions));
    assert(body.sessions.length >= 1);
    assert(body.sessions[0].id);
    assert.strictEqual(body.sessions[0].provider, 'mock');
  });

  it('GET /api/sessions/:id/messages returns 200 and messages array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions/mock-session-1/messages',
      query: { user_id: 'default', limit: '20' },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert(body && Array.isArray(body.messages));
    assert(body.messages.length >= 1);
    assert(['user', 'assistant'].includes(body.messages[0].role));
  });

  it('POST /api/chat/stream returns 200 and SSE stream with message_end', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      payload: { message: 'hello', user_id: 'default' },
      headers: { 'content-type': 'application/json' },
    });
    assert.strictEqual(res.statusCode, 200);
    const payload = res.payload;
    assert(payload.includes('event: message'));
    assert(payload.includes('event: message_end'));
    assert(payload.includes('data:'));
  });

  it('POST /api/chat/stream without message returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      payload: { user_id: 'default' },
      headers: { 'content-type': 'application/json' },
    });
    assert.strictEqual(res.statusCode, 400);
    const body = res.json();
    assert(body && body.error);
  });

  it('POST /api/chat/export-markdown returns 200 and markdown', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/export-markdown',
      payload: {
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello' },
        ],
      },
      headers: { 'content-type': 'application/json' },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert(body && typeof body.markdown === 'string');
    assert(body.markdown.includes('Hi'));
    assert(body.markdown.includes('Hello'));
  });
});
