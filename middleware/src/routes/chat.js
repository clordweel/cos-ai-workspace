/**
 * 对话相关：流式 SSE、导出 Markdown
 */
import { config } from '../config.js';
import { runStream } from '../services/difyStream.js';
import { messagesToMarkdown } from '../services/exportMarkdown.js';

export async function chatRoutes(app) {
  const { dify } = config;

  app.post('/api/chat/stream', async (req, reply) => {
    const { message, conversation_id, user_id = 'default' } = req.body || {};
    if (!message) {
      return reply.code(400).send({ error: 'message is required' });
    }
    if (!dify.apiKey) {
      return reply.code(502).send({
        error: 'Dify 未配置',
        message: '请在 .env 中设置 DIFY_API_BASE 与 DIFY_API_KEY',
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
      await runStream(req, reply, send, flush);
    } catch (e) {
      req.log.error(e);
      let errMsg = e.message || String(e);
      const body = e.responseBody;
      if (body != null) {
        const detail = typeof body === 'string' ? body : (body.message || JSON.stringify(body));
        if (detail) errMsg = `${errMsg} — ${detail}`;
      }
      if (e.statusCode === 400) {
        errMsg += '（请确认 Dify 应用类型为「对话」或「高级对话」，且 API Key 来自该应用的「API 访问」）';
      }
      send('error', { message: errMsg, ...(e.statusCode && { statusCode: e.statusCode }) });
      send('message', { delta: `错误：${errMsg}` });
      flush();
    } finally {
      reply.raw.end();
    }
  });

  app.post('/api/chat/export-markdown', async (req, reply) => {
    const body = req.body || {};
    const messages = body.messages ?? [];
    const markdown = messagesToMarkdown(messages);
    return reply.send({ markdown });
  });
}
