/**
 * 消息解析逻辑参考并抄自 Dify 官方 SDK
 * 源码：https://github.com/langgenius/dify/blob/main/sdks/nodejs-client/src/http/sse.ts
 *
 * - extractTextFromEvent: 与 SDK 的 extractTextFromEvent 一致，按 answer > text > delta 顺序取正文
 * - 本包从事件 data 中取正文时统一经此函数，再在 thinkingParser 中做 <think>/answer 分离
 */

/**
 * 从单条 SSE 事件的 data 中提取文本（与 Dify SDK extractTextFromEvent 一致）
 * 字段优先级：answer > text > delta
 * 参考：sdks/nodejs-client/src/http/sse.ts
 */
export function extractTextFromEvent(data: unknown): string {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;
  if (typeof record.answer === 'string') return record.answer;
  if (typeof record.text === 'string') return record.text;
  if (typeof record.delta === 'string') return record.delta;
  return '';
}

/**
 * 扩展提取：在 SDK 三字段基础上，兼容 content 及嵌套 message.answer（部分 Agent/工作流返回格式）
 */
export function extractText(data: string | Record<string, unknown> | null | undefined): string {
  const fromEvent = extractTextFromEvent(data);
  if (fromEvent.length > 0) return fromEvent;
  if (!data || typeof data !== 'object') return '';
  const obj = data as Record<string, unknown>;
  if (typeof obj.content === 'string' && obj.content.length > 0) return obj.content;
  const msg = obj.message;
  if (msg != null && typeof msg === 'object' && typeof (msg as Record<string, unknown>).answer === 'string') {
    return (msg as Record<string, unknown>).answer as string;
  }
  return '';
}
