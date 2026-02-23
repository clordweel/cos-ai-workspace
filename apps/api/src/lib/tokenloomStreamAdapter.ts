/**
 * 使用 TokenLoom 将流式正文拆分为 <think> 与 answer，并转发为 SSE 事件
 * 供 difyStream 在 extractText 下游使用
 */
import { TokenLoom } from 'tokenloom';
import type { Event } from 'tokenloom';

const THINK_TAG = 'think';

type SSESend = (event: string, data: Record<string, unknown>) => void;
type SSEFlush = () => void;

export interface TokenLoomAdapterResult {
  /** 正文（answer）全文，不含 <think> 内容 */
  answer: string;
  /** 思考过程全文 */
  thinking: string;
}

/**
 * 创建适配器：对 send/flush 写入 thinking 与 message 事件
 * - 在 <think> 内的文本 -> thinking 事件（delta + 结束时 fullText）
 * - 在 <think> 外的文本 -> message 事件（delta）
 */
export function createTokenLoomAdapter(send: SSESend, flush: SSEFlush) {
  const parser = new TokenLoom({
    tags: [THINK_TAG],
    emitUnit: 'token' as const,
    emitDelay: 0,
    specMinParseLength: 2,
  });

  let thinkingAcc = '';
  let answerAcc = '';

  parser.on('text', (event: Event) => {
    if (event.type !== 'text' || typeof event.text !== 'string') return;
    const inThink = event.in?.inTag?.name === THINK_TAG;
    if (inThink) {
      thinkingAcc += event.text;
      send('thinking', { delta: event.text });
      flush();
    } else {
      answerAcc += event.text;
      send('message', { delta: event.text });
      flush();
    }
  });

  parser.on('tag-open', (event: Event) => {
    if (event.type === 'tag-open' && event.name === THINK_TAG) {
      // 可选：通知前端进入思考区
      send('thinking', { delta: '' });
      flush();
    }
  });

  parser.on('tag-close', (event: Event) => {
    if (event.type === 'tag-close' && event.name === THINK_TAG && thinkingAcc) {
      send('thinking', { fullText: thinkingAcc });
      flush();
    }
  });

  return {
    /** 喂入一段正文（来自 Dify 的 answer/delta） */
    feed(chunk: string): void {
      if (chunk) parser.feed({ text: chunk });
    },
    /** 流结束：冲刷缓冲区并返回累积结果 */
    async flush(): Promise<TokenLoomAdapterResult> {
      await parser.flush();
      parser.dispose();
      return { answer: answerAcc, thinking: thinkingAcc };
    },
    getParser(): TokenLoom {
      return parser;
    },
  };
}
