/**
 * Dify 流式对话：调用 ChatClient，按前端约定转发 SSE 事件
 */
import { ChatClient } from 'dify-client';
import { config } from '../config.js';
import { extractText, splitThinkingAndAnswer } from '../lib/thinkingParser.js';

/**
 * 运行流式对话并写入 reply.raw
 * @param {{ body: { message?: string, conversation_id?: string, user_id?: string } }} req
 * @param {{ raw: import('stream').Writable & { flush?: () => void }, log: import('pino').Logger }} reply
 * @param {(event: string, data: object) => void} send
 * @param {() => void} flush
 */
export async function runStream(req, reply, send, flush) {
  const { message, conversation_id, user_id = 'default' } = req.body || {};
  const { apiKey, apiBase } = config.dify;
  const chatClient = new ChatClient({ apiKey, baseUrl: apiBase });

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
    if (typeof answer === 'string' && answer) send('message', { delta: answer });
    flush();
    send('message_end', {});
    flush();
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
}
