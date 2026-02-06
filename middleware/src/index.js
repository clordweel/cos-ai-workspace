/**
 * AI 工作台中间层 - Fastify
 * - SSE 流式代理（Dify Chat API → 前端），使用官方 dify-client
 * - 编排：Dify 意图 → cos / ERPNext API
 * - 写入前确认与权限校验
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ChatClient } from 'dify-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(__dirname, '..', '..', '.env');
const cwdEnv = path.resolve(process.cwd(), '.env');
dotenv.config({ path: cwdEnv });
dotenv.config({ path: rootEnv });

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

// 健康检查
app.get('/health', async () => ({ status: 'ok' }));

const DIFY_API_BASE = (process.env.DIFY_API_BASE || 'https://api.dify.ai/v1').replace(/\/$/, '');
const DIFY_API_KEY = process.env.DIFY_API_KEY || '';
const COS_ERP_BASE = process.env.COS_ERP_BASE || '';

/**
 * SSE 流式对话：使用官方 dify-client ChatClient，转发流式响应为前端约定的 message/delta、message_end
 * POST /api/chat/stream
 * Body: { message: string, conversation_id?: string, user_id?: string }
 */
app.post('/api/chat/stream', async (req, reply) => {
  const { message, conversation_id, user_id = 'default' } = req.body || {};
  if (!message) {
    return reply.code(400).send({ error: 'message is required' });
  }

  if (!DIFY_API_KEY) {
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

  function extractText(data) {
    if (typeof data === 'string') return data;
    if (!data || typeof data !== 'object') return '';
    return data.answer ?? data.text ?? data.delta ?? data.content ?? '';
  }

  // 仿 Gemini：将 <think>...</think> 与正文分离，分别下发 thinking / message
  // 兼容大小写、可选空格、HTML 实体（Dify/深度思考模型可能逐字或变体输出）
  function splitThinkingAndAnswer(text) {
    const result = { thinking: '', answer: '' };
    if (typeof text !== 'string' || !text) return result;
    let normalized = text
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
    const openRe = /<\s*think\s*>/gi;
    const closeRe = /<\s*\/\s*think\s*>/gi;
    const openMatch = normalized.match(openRe);
    if (!openMatch) {
      result.answer = text;
      return result;
    }
    const openTag = openMatch[0];
    const open = normalized.indexOf(openTag);
    const afterOpen = open + openTag.length;
    const rest = normalized.slice(afterOpen);
    const closeMatch = rest.match(closeRe);
    if (!closeMatch) {
      result.thinking = rest;
      return result;
    }
    const closeTag = closeMatch[0];
    const close = rest.indexOf(closeTag);
    result.thinking = rest.slice(0, close);
    result.answer = rest.slice(close + closeTag.length).trim();
    return result;
  }

  try {
    const chatClient = new ChatClient({
      apiKey: DIFY_API_KEY,
      baseUrl: DIFY_API_BASE,
    });

    const result = await chatClient.createChatMessage({
      inputs: {},
      query: message,
      user: user_id,
      response_mode: 'streaming',
      conversation_id: conversation_id || '',
    });

    const isStream = result && typeof result[Symbol.asyncIterator] === 'function';
    if (!isStream) {
      const answer = extractText(result?.data) || '';
      if (typeof answer === 'string' && answer) {
        send('message', { delta: answer });
        flush();
      }
      send('message_end', {});
      flush();
      reply.raw.end();
      return;
    }

    send('status', { status: 'thinking' });
    flush();

    let accumulatedFull = '';
    let prevThinkingLen = 0;
    let prevAnswerLen = 0;
    let sentAny = false;
    for await (const ev of result) {
      let data = ev?.data;
      // 转发 Dify agent/工具 等事件，便于前端展示「正在调用 MCP 工具」等状态
      const evName = ev?.event;
      if (evName && evName !== 'message' && evName !== 'message_end') {
        send('dify_event', { type: evName, data: data && typeof data === 'object' ? data : {} });
        flush();
      }
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          if (data) {
            accumulatedFull += data;
            const { thinking, answer } = splitThinkingAndAnswer(accumulatedFull);
            if (thinking.length > prevThinkingLen) {
              send('thinking', { delta: thinking.slice(prevThinkingLen) });
              flush();
              prevThinkingLen = thinking.length;
              sentAny = true;
            }
            if (answer.length > prevAnswerLen) {
              send('message', { delta: answer.slice(prevAnswerLen) });
              flush();
              prevAnswerLen = answer.length;
              sentAny = true;
            }
          }
          continue;
        }
      }
      if (!data || typeof data !== 'object') continue;
      const chunk = extractText(data);
      if (typeof chunk !== 'string') {
        if (data.event === 'message_end') {
          send('message_end', { conversation_id: data.conversation_id, message_id: data.message_id });
          flush();
        }
        continue;
      }
      if (chunk.length === 0) {
        if (data.event === 'message_end') {
          send('message_end', { conversation_id: data.conversation_id, message_id: data.message_id });
          flush();
        }
        continue;
      }
      if (data.answer !== undefined && typeof data.answer === 'string' && data.answer.length >= accumulatedFull.length) {
        accumulatedFull = data.answer;
      } else {
        accumulatedFull += chunk;
      }
      const { thinking, answer } = splitThinkingAndAnswer(accumulatedFull);
      if (thinking.length > prevThinkingLen) {
        send('thinking', { delta: thinking.slice(prevThinkingLen) });
        flush();
        prevThinkingLen = thinking.length;
        sentAny = true;
      }
      if (answer.length > prevAnswerLen) {
        send('message', { delta: answer.slice(prevAnswerLen) });
        flush();
        prevAnswerLen = answer.length;
        sentAny = true;
      }
      if (data.event === 'message_end') {
        send('message_end', { conversation_id: data.conversation_id, message_id: data.message_id });
        flush();
      }
    }

    // 流结束前发一次完整思考内容，确保前端能保留「思考过程」
    const { thinking: finalThinking } = splitThinkingAndAnswer(accumulatedFull);
    if (finalThinking && finalThinking.length > 0) {
      send('thinking', { fullText: finalThinking });
      flush();
    }
    if (!sentAny) {
      send('message', { delta: '（Dify 未返回文本，请检查应用类型与 API 配置）' });
      flush();
    }
    send('message_end', {});
    flush();
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

/**
 * 确认写入物料（权限校验后调用 cos create_from_draft）
 * POST /api/material/confirm
 * Body: { draft_id: string, confirmed_by: string }
 */
app.post('/api/material/confirm', async (request, reply) => {
  const { draft_id, confirmed_by } = request.body || {};
  if (!draft_id || !confirmed_by) {
    return reply.code(400).send({ error: 'draft_id and confirmed_by required' });
  }
  // TODO: 1) 校验当前用户/会话权限  2) 调用 cos create_from_draft
  return reply.send({ item_code: null, message: 'TODO: 对接 cos API' });
});

const port = Number(process.env.PORT) || 3000;
await app.listen({ port, host: '0.0.0.0' });
console.log(`Middleware listening on http://0.0.0.0:${port}`);

/** 退出或终端关闭时关闭 Fastify 并释放端口 */
let shuttingDown = false;
function gracefulShutdown(signal) {
  return () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, closing server...`);
    app
      .close()
      .then(() => {
        console.log('Server closed, port released.');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Error closing server:', err);
        process.exit(1);
      });
  };
}

process.on('SIGINT', gracefulShutdown('SIGINT'));   // Ctrl+C
process.on('SIGTERM', gracefulShutdown('SIGTERM')); // kill / 容器停止
process.on('SIGHUP', gracefulShutdown('SIGHUP'));   // 终端断开/关闭
