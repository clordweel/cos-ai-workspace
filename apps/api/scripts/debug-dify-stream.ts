/**
 * 本地调试：直接请求 Dify 流式接口，打印原始 chunk 与结构化解析结果（thinking / answer）
 * 用于稳步推进格式解析开发。
 *
 * 使用：cd apps/api && pnpm run script:debug-dify-stream
 * 环境变量：从 apps/api/.env 加载，需 DIFY_API_KEY、DIFY_API_BASE（可选）
 * 可选参数：DEBUG_DIFY_QUERY="自我介绍" 可覆盖默认测试问题
 */
import { ChatClient } from 'dify-client';
import { config } from '../src/config.js';
import { extractText } from '../src/lib/thinkingParser.js';
import { StreamParser } from '../src/lib/streamParser.js';

const QUERY = process.env.DEBUG_DIFY_QUERY || '自我介绍。';
const TAIL_LEN = 80;

function tail(s: string, len: number): string {
  if (s.length <= len) return s;
  return '…' + s.slice(-len);
}

async function main() {
  const { apiKey, apiBase } = config.dify;
  if (!apiKey?.trim()) {
    console.error('请设置 DIFY_API_KEY（apps/api/.env）');
    process.exit(1);
  }
  console.log('DIFY_API_BASE:', apiBase);
  console.log('查询:', QUERY);
  console.log('---');

  const chatClient = new ChatClient({ apiKey, baseUrl: apiBase });
  const result = await chatClient.createChatMessage({
    inputs: {},
    query: QUERY,
    user: 'debug-script',
    response_mode: 'streaming',
    conversation_id: '',
  });

  const isStream =
    result && typeof (result as AsyncIterable<{ event?: string; data?: string | Record<string, unknown>; answer?: string }>)[Symbol.asyncIterator] === 'function';
  if (!isStream) {
    const data = (result as { data?: unknown }).data;
    const text = extractText(
      typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : undefined
    );
    console.log('[非流式] answer 长度:', typeof text === 'string' ? text.length : 0);
    console.log('answer 尾:', tail(String(text), TAIL_LEN));
    return;
  }

  const parser = new StreamParser();
  let eventCount = 0;

  for await (const ev of result as AsyncIterable<{ event?: string; data?: string | Record<string, unknown>; answer?: string }>) {
    const data = ev?.data != null
      ? (ev.data as string | Record<string, unknown>)
      : (ev as Record<string, unknown> | undefined);
    const evName = ev?.event ?? (data != null && typeof data === 'object' ? (data as Record<string, unknown>).event as string | undefined : undefined);

    if (evName === 'error') {
      const msg = (data && typeof data === 'object' && (data as { message?: string }).message != null
        ? String((data as { message?: string }).message)
        : '') || 'Dify 返回错误';
      console.error('[error]', msg);
      continue;
    }

    let chunk = '';
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data) as Record<string, unknown>;
        chunk = extractText(parsed);
      } catch {
        chunk = data;
      }
    } else if (data != null && typeof data === 'object') {
      const dataObj = data as { answer?: string };
      if (dataObj.answer !== undefined && typeof dataObj.answer === 'string' && dataObj.answer.length > parser.getAccumulatedLength()) {
        parser.replaceFull(dataObj.answer);
        chunk = '[replaceFull]';
      } else {
        chunk = extractText(data as Record<string, unknown>);
        if (typeof chunk === 'string') parser.append(chunk);
      }
    }

    if (chunk.length > 0 || (chunk === '[replaceFull]' && parser.getAccumulatedLength() > 0)) {
      const { thinking, answer, thinkingDelta, answerDelta } = parser.getSnapshot();
      eventCount++;
      if (chunk !== '[replaceFull]') {
        console.log(`[${eventCount}] raw chunk 长度: ${chunk.length} 尾: ${tail(chunk.replace(/\n/g, '\\n'), 60)}`);
      } else {
        console.log(`[${eventCount}] replaceFull 累积长度: ${parser.getAccumulatedLength()}`);
      }
      console.log(`       thinking 总长: ${thinking.length} 增量: ${thinkingDelta.length} 尾: ${tail(thinking, TAIL_LEN)}`);
      console.log(`       answer 总长: ${answer.length} 增量: ${answerDelta.length} 尾: ${tail(answer, TAIL_LEN)}`);
      console.log('');
    }

    if (evName === 'message_end') {
      console.log('[message_end]');
    }
  }

  const { thinking, answer } = parser.getResult();
  console.log('--- 最终结构化结果 ---');
  console.log('thinking 长度:', thinking.length);
  console.log('thinking 全文:', thinking || '(空)');
  console.log('answer 长度:', answer.length);
  console.log('answer 全文:', answer || '(空)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
