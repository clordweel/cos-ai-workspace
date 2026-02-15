/**
 * 从 Dify 流式数据中提取文本；将 <think>...</think> 与正文分离
 * 兼容大小写、可选空格、HTML 实体
 */

export function extractText(data: string | Record<string, unknown> | null | undefined): string {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return '';
  const obj = data as Record<string, unknown>;
  return (obj.answer ?? obj.text ?? obj.delta ?? obj.content ?? '') as string;
}

export interface ThinkingAndAnswer {
  thinking: string;
  answer: string;
}

/**
 * 仿 Gemini：分离 <think>...</think> 与 answer，分别下发 thinking / message
 */
export function splitThinkingAndAnswer(text: string): ThinkingAndAnswer {
  const result: ThinkingAndAnswer = { thinking: '', answer: '' };
  if (typeof text !== 'string' || !text) return result;
  const normalized = text
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
