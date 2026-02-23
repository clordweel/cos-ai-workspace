/**
 * Dify 流式对话：调用 ChatClient，经 TokenLoom 解析 <think>/正文 后下发 thinking + message 事件
 */
import { ChatClient } from 'dify-client';
import { config } from '../config.js';
import { extractText } from '../lib/difyMessageParser.js';
import { createTokenLoomAdapter } from '../lib/tokenloomStreamAdapter.js';

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
 * 运行流式对话，向 send/flush 写入 SSE 事件（thinking + message + message_end）
 * @returns 助手回复的正文全文（不含 <think> 内容）
 */
export async function runStreamWithParams(
  params: StreamParams,
  send: SSESend,
  flush: SSEFlush,
  difyConfig?: DifyConfig
): Promise<string> {
  const { message, conversation_id = '', user_id = 'default' } = params;
  const { apiKey, apiBase } = difyConfig ?? config.dify;
  if (!apiKey?.trim()) throw new Error('DIFY_API_KEY 未配置');
  const chatClient = new ChatClient({ apiKey, baseUrl: apiBase });

  const result = await chatClient.createChatMessage({
    inputs: {},
    query: message,
    user: user_id,
    response_mode: 'streaming',
    conversation_id: conversation_id || '',
  });
  return consumeStream(result, send, flush);
}

interface DifyStreamEvent {
  event?: string;
  data?: string | Record<string, unknown>;
  conversation_id?: string;
  message_id?: string;
  answer?: string;
}

/**
 * 消费 Dify 流式迭代器：提取正文后经 TokenLoom 拆分为 <think>/正文，下发 thinking 与 message 事件
 */
export async function consumeStream(
  result: AsyncIterable<DifyStreamEvent> | { data?: unknown },
  send: SSESend,
  flush: SSEFlush
): Promise<string> {
  const isStream =
    result && typeof (result as AsyncIterable<DifyStreamEvent>)[Symbol.asyncIterator] === 'function';
  if (!isStream) {
    const data = (result as { data?: unknown }).data;
    const text = extractText(
      typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : undefined
    );
    const str = typeof text === 'string' ? text : '';
    if (str) {
      const adapter = createTokenLoomAdapter(send, flush);
      adapter.feed(str);
      const { answer, thinking } = await adapter.flush();
      if (thinking) send('thinking', { fullText: thinking });
      flush();
      if (answer) send('message', { delta: answer });
      flush();
      send('message_end', {});
      flush();
      return answer || str;
    }
    send('message_end', {});
    flush();
    return '';
  }

  send('status', { status: 'thinking' });
  flush();

  const adapter = createTokenLoomAdapter(send, flush);
  let accumulated = '';
  let sentAny = false;

  for await (const ev of result as AsyncIterable<DifyStreamEvent>) {
    let data: string | Record<string, unknown> | undefined =
      ev?.data != null ? (ev.data as string | Record<string, unknown>) : (ev as Record<string, unknown> | undefined);
    let evName: string | undefined =
      ev?.event ??
      (data != null && typeof data === 'object' ? (data as Record<string, unknown>).event as string | undefined : undefined);

    if (evName === 'error') {
      const msg = (data && typeof data === 'object' && (data as { message?: string }).message != null
        ? String((data as { message?: string }).message)
        : '') || 'Dify 返回错误';
      let hint = msg;
      try {
        const parsed = JSON.parse(msg) as { message?: string; args?: { description?: string } };
        const desc = parsed?.args?.description ?? parsed?.message ?? msg;
        if (/401|User not found|invalid.*key/i.test(desc)) {
          hint = `模型服务鉴权失败（401/User not found），请检查 Dify 中 OpenRouter（或当前模型）的 API Key 是否有效。`;
        } else if (desc) {
          hint = desc.length > 200 ? desc.slice(0, 200) + '…' : desc;
        }
      } catch {
        if (msg.length > 200) hint = msg.slice(0, 200) + '…';
      }
      send('error', { message: hint });
      flush();
    }

    if (evName && evName !== 'message' && evName !== 'message_end' && evName !== 'agent_message') {
      send('dify_event', {
        type: evName,
        data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {},
      });
      flush();
    }

    if (typeof data === 'string') {
      try {
        data = JSON.parse(data) as Record<string, unknown>;
        evName = (data as Record<string, unknown>).event as string | undefined ?? evName;
      } catch {
        const raw = typeof data === 'string' ? data : '';
        if (raw) {
          accumulated += raw;
          adapter.feed(raw);
          sentAny = true;
        }
        continue;
      }
    }

    if (!data || typeof data !== 'object') {
      const ev = data && typeof data === 'object' ? (data as DifyStreamEvent) : null;
      if (ev?.event === 'message_end') {
        send('message_end', {
          conversation_id: ev.conversation_id,
          message_id: ev.message_id,
        });
        flush();
      }
      continue;
    }

    const chunk = extractText(data as Record<string, unknown>);
    if (typeof chunk !== 'string' || chunk.length === 0) {
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
      dataObj.answer.length > accumulated.length
    ) {
      const full = dataObj.answer;
      const delta = full.slice(accumulated.length);
      accumulated = full;
      if (delta) {
        adapter.feed(delta);
        sentAny = true;
      }
    } else {
      accumulated += chunk;
      adapter.feed(chunk);
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

  const { answer } = await adapter.flush();
  if (!sentAny && !answer) {
    send('message', { delta: '（Dify 未返回文本，请检查应用类型与 API 配置）' });
    flush();
  }
  send('message_end', {});
  flush();
  return answer ?? accumulated ?? '';
}
