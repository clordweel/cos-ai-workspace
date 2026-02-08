/**
 * 对话相关：流式 SSE、会话列表/历史（适配器驱动）、导出 Markdown（未登录也可会话）
 */
import { getChatAdapter } from '../adapters/index.js';
import { messagesToMarkdown } from '../services/exportMarkdown.js';

export async function chatRoutes(app) {
  app.post('/api/chat/stream', async (req, reply) => {
    const { message, conversation_id, user_id = 'default' } = req.body || {};
    if (!message) {
      return reply.code(400).send({ error: 'message is required' });
    }

    const adapter = getChatAdapter();
    const useAdapter = adapter && adapter.supportsStreaming();
    if (!useAdapter) {
      return reply.code(502).send({
        error: '聊天后端未配置',
        message: '请设置 CHAT_PROVIDER（如 mock 用于调试）',
      });
    }

    const origin = req.headers.origin || '*';
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });

    const send = (event, data) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    const flush = () => {
      if (typeof reply.raw.flush === 'function') reply.raw.flush();
    };

    try {
      await adapter.streamMessage({
        sessionId: conversation_id || '',
        backendSessionId: conversation_id || undefined,
        message,
        userId: user_id,
        send,
        flush,
      });
    } catch (e) {
      req.log.error(e);
      const errMsg = e.message || String(e);
      send('error', { message: errMsg, ...(e.statusCode && { statusCode: e.statusCode }) });
      send('message', { delta: `错误：${errMsg}` });
      flush();
    } finally {
      reply.raw.end();
    }
  });

  /** 会话列表（标准化 API，由当前适配器提供） */
  app.get('/api/sessions', async (req, reply) => {
    const adapter = getChatAdapter();
    if (!adapter || !adapter.supportsListSessions() || typeof adapter.listSessions !== 'function') {
      return reply.code(501).send({
        error: '当前后端不支持会话列表',
        message: '请使用支持 listSessions 的 CHAT_PROVIDER（如 mock）',
      });
    }
    const userId = req.query?.user_id || req.query?.user || 'default';
    try {
      const list = await adapter.listSessions({ userId });
      return reply.send({ sessions: list });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '拉取会话列表失败',
        message: e.message || String(e),
      });
    }
  });

  /** 会话历史消息（标准化 API，由当前适配器提供） */
  app.get('/api/sessions/:id/messages', async (req, reply) => {
    const adapter = getChatAdapter();
    if (!adapter || !adapter.supportsListMessages() || typeof adapter.listMessages !== 'function') {
      return reply.code(501).send({
        error: '当前后端不支持会话历史',
        message: '请使用支持 listMessages 的 CHAT_PROVIDER（如 mock）',
      });
    }
    const sessionId = req.params?.id;
    if (!sessionId) {
      return reply.code(400).send({ error: 'session id is required' });
    }
    const userId = req.query?.user_id || req.query?.user || 'default';
    const limit = req.query?.limit ?? 50;
    const beforeId = req.query?.before_id;
    try {
      const messages = await adapter.listMessages({
        sessionId,
        backendSessionId: sessionId,
        userId,
        limit: Number(limit) || 50,
        beforeId: beforeId || undefined,
      });
      return reply.send({ messages });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '拉取会话历史失败',
        message: e.message || String(e),
      });
    }
  });

  app.post('/api/chat/export-markdown', async (req, reply) => {
    const body = req.body || {};
    const messages = body.messages ?? [];
    const markdown = messagesToMarkdown(messages);
    return reply.send({ markdown });
  });
}
