/**
 * Dify 流式对话：调用 ChatClient，按前端约定转发 SSE 事件
 */
import { ChatClient } from 'dify-client';
import { config } from '../config.js';
import { extractText, splitThinkingAndAnswer } from '../lib/thinkingParser.js';

export interface StreamParams {
  message: string;
  conversation_id?: string;
  user_id?: string;
}

export interface DifyConfig {
  apiKey: string;
  apiBase: string;
}

type SSESend = (event: string, data: Record<string, unknown>) => void;
type SSEFlush = () => void;

/**
 * 运行流式对话，向 send/flush 写入 SSE 事件（与请求解耦，供适配器调用）
 */
export async function runStreamWithParams(
  params: StreamParams,
  send: SSESend,
  flush: SSEFlush,
  difyConfig?: DifyConfig
): Promise<void> {
  const { message, conversation_id = '', user_id = 'default' } = params;
  const { apiKey, apiBase } = difyConfig ?? config.dify;
  const chatClient = new ChatClient({ apiKey, baseUrl: apiBase });

  const result = await chatClient.createChatMessage({
    inputs: {},
    query: message,
    user: user_id,
    response_mode: 'streaming',
    conversation_id: conversation_id || '',
  });
  await consumeStream(result, send, flush);
}

interface DifyStreamEvent {
  event?: string;
  data?: string | Record<string, unknown>;
  conversation_id?: string;
  message_id?: string;
  answer?: string;
}

/**
 * 消费 Dify 流式迭代器，发送 SSE 事件（thinking / message / message_end）
 */
export async function consumeStream(
  result: AsyncIterable<DifyStreamEvent> | { data?: unknown },
  send: SSESend,
  flush: SSEFlush
): Promise<void> {
  const isStream =
    result && typeof (result as AsyncIterable<DifyStreamEvent>)[Symbol.asyncIterator] === 'function';
  if (!isStream) {
    const data = (result as { data?: unknown }).data;
    const answer = extractText(
      typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : undefined
    );
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

  for await (const ev of result as AsyncIterable<DifyStreamEvent>) {
    let data = ev?.data;
    const evName = ev?.event;
    if (evName && evName !== 'message' && evName !== 'message_end') {
      send('dify_event', {
        type: evName,
        data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {},
      });
      flush();
    }
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data) as Record<string, unknown>;
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
    const chunk = extractText(data as Record<string, unknown>);
    if (typeof chunk !== 'string') {
      if ((data as DifyStreamEvent).event === 'message_end') {
        send('message_end', {
          conversation_id: (data as DifyStreamEvent).conversation_id,
          message_id: (data as DifyStreamEvent).message_id,
        });
        flush();
      }
      continue;
    }
    if (chunk.length === 0) {
      if ((data as DifyStreamEvent).event === 'message_end') {
        send('message_end', {
          conversation_id: (data as DifyStreamEvent).conversation_id,
          message_id: (data as DifyStreamEvent).message_id,
        });
        flush();
      }
      continue;
    }
    const dataObj = data as DifyStreamEvent;
    if (
      dataObj.answer !== undefined &&
      typeof dataObj.answer === 'string' &&
      dataObj.answer.length >= accumulatedFull.length
    ) {
      accumulatedFull = dataObj.answer;
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
    if (dataObj.event === 'message_end') {
      send('message_end', {
        conversation_id: dataObj.conversation_id,
        message_id: dataObj.message_id,
      });
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

interface FastifyReplyWithRaw {
  raw: NodeJS.WritableStream & { flush?: () => void };
  log: { error: (e: unknown) => void };
}

interface FastifyRequestWithBody {
  body?: { message?: string; conversation_id?: string; user_id?: string };
}

/**
 * 运行流式对话（从 req.body 读取参数，供现有路由直接使用）
 */
export async function runStream(
  req: FastifyRequestWithBody,
  _reply: FastifyReplyWithRaw,
  send: SSESend,
  flush: SSEFlush
): Promise<void> {
  const params: StreamParams = {
    message: req.body?.message ?? '',
    conversation_id: req.body?.conversation_id,
    user_id: req.body?.user_id ?? 'default',
  };
  await runStreamWithParams(params, send, flush);
}
