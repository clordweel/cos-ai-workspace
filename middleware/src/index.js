/**
 * AI 工作台中间层 - Fastify
 * - SSE 流式代理（Dify Chat API → 前端），使用官方 dify-client
 * - 编排：Dify 意图 → cos / ERPNext API
 * - 写入前确认与权限校验
 * - Git 只读：多次提交分析（log）
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { simpleGit } from 'simple-git';
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

// Git 仓库路径：仅读，不信任前端传入路径；默认取工作区根目录
const GIT_REPO_PATH = process.env.GIT_REPO_PATH || path.resolve(__dirname, '..', '..');
const MAX_GIT_LOG = Math.min(Number(process.env.GIT_LOG_MAX) || 50, 100);

/**
 * Git 多次提交分析（只读）
 * GET /api/git/log?limit=20
 * 返回最近 N 条提交的摘要，供 Dify/前端做 changelog 或上下文
 */
app.get('/api/git/log', async (request, reply) => {
  const limit = Math.min(Math.max(1, Number(request.query?.limit) || 20), MAX_GIT_LOG);
  try {
    const git = simpleGit({ baseDir: GIT_REPO_PATH });
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return reply.code(404).send({ error: 'not a git repository', path: GIT_REPO_PATH });
    }
    const log = await git.log({ maxCount: limit });
    const commits = (log.all || []).map((c) => ({
      hash: c.hash,
      shortHash: c.hash.slice(0, 7),
      date: c.date,
      author: c.author_name,
      message: c.message,
    }));
    return reply.send({ commits, total: commits.length });
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({
      error: 'git log failed',
      message: e.message || String(e),
    });
  }
});

/**
 * 单次提交详情（只读）
 * GET /api/git/log/:hash
 * 返回该提交的元数据与 diff 摘要（--stat），便于分析单次变更
 */
app.get('/api/git/log/:hash', async (request, reply) => {
  const { hash } = request.params;
  if (!hash || !/^[a-fA-F0-9]{7,40}$/.test(hash)) {
    return reply.code(400).send({ error: 'invalid commit hash' });
  }
  try {
    const git = simpleGit({ baseDir: GIT_REPO_PATH });
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return reply.code(404).send({ error: 'not a git repository', path: GIT_REPO_PATH });
    }
    const show = await git.show([hash, '--stat', '--format=%H%n%an%n%ae%n%ad%n%s%n%b', '--no-patch']);
    const lines = show.split('\n');
    const files = [];
    let i = 0;
    const [fullHash, authorName, authorEmail, date, subject, ...bodyLines] = lines;
    let bodyEnd = bodyLines.findIndex((l) => /^\s*[\d]+ files? changed/.test(l));
    if (bodyEnd < 0) bodyEnd = bodyLines.length;
    const body = bodyLines.slice(0, bodyEnd).join('\n').trim();
    for (let j = bodyEnd + 1; j < bodyLines.length; j++) {
      const line = bodyLines[j];
      const m = line.match(/^(.+?)\s+\|\s+(\d+)(?:\s+([+\-]+))?/);
      if (m) files.push({ path: m[1].trim(), changes: parseInt(m[2], 10), insertions: m[3] || '' });
    }
    return reply.send({
      hash: fullHash?.trim(),
      shortHash: (fullHash || hash).slice(0, 7),
      author: { name: authorName?.trim(), email: authorEmail?.trim() },
      date: date?.trim(),
      subject: subject?.trim(),
      body: body || undefined,
      files,
    });
  } catch (e) {
    request.log.error(e);
    return reply.code(404).send({
      error: 'commit not found',
      message: e.message || String(e),
    });
  }
});

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
