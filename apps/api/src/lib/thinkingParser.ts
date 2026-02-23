/**
 * 从 Dify 流式数据中提取文本；将 <think>...</think> 与正文分离
 * 兼容大小写、可选空格、HTML 实体
 */

/**
 * 从 Dify 事件数据中取正文，兼容顶层 answer/delta 与嵌套 message.answer（部分 Agent 返回格式）
 */
export function extractText(data: string | Record<string, unknown> | null | undefined): string {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return '';
  const obj = data as Record<string, unknown>;
  const top =
    obj.answer ?? obj.text ?? obj.delta ?? obj.content ?? '';
  if (typeof top === 'string' && top.length > 0) return top;
  const msg = obj.message;
  if (msg != null && typeof msg === 'object' && typeof (msg as Record<string, unknown>).answer === 'string') {
    return (msg as Record<string, unknown>).answer as string;
  }
  return typeof top === 'string' ? top : '';
}

export interface ThinkingAndAnswer {
  thinking: string;
  answer: string;
}

const OPEN_TAG_RE = /<\s*think\s*>/gi;
const CLOSE_TAG_RE = /<\s*\/\s*think\s*>/gi;

/**
 * 从正文中移除杂散 think 标签（含末尾不完整标签），避免流式 chunk 导致未成对标签进入 answer 展示
 * 使用独立正则避免与 splitThinkingAndAnswer 中 lastIndex 复用冲突
 */
function stripThinkTagsFromAnswer(raw: string): string {
  return raw
    .replace(/<\s*\/\s*think\s*>/gi, '')
    .replace(/<\s*think\s*>/gi, '')
    .replace(/<\s*\/\s*think[^>]*$/i, '')
    .replace(/<\s*think[^>]*$/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 仿 Gemini：分离所有 <think>...</think> 与 answer，支持一次回复中多段 think
 * - thinking：所有 think 块内容按顺序用双换行拼接
 * - answer：去掉全部 think 块后的正文，并 strip 杂散/未成对标签（流式时 </think> 先于 <think> 或末尾不完整标签会进入 answer，需清理）
 */
export function splitThinkingAndAnswer(text: string): ThinkingAndAnswer {
  const result: ThinkingAndAnswer = { thinking: '', answer: '' };
  if (typeof text !== 'string' || !text) return result;
  const normalized = text
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
  const thinkingParts: string[] = [];
  const answerParts: string[] = [];
  let lastEnd = 0;

  while (lastEnd < normalized.length) {
    OPEN_TAG_RE.lastIndex = lastEnd;
    const openMatch = OPEN_TAG_RE.exec(normalized);
    if (!openMatch) {
      answerParts.push(normalized.slice(lastEnd));
      break;
    }
    answerParts.push(normalized.slice(lastEnd, openMatch.index));
    const afterOpen = openMatch.index + openMatch[0].length;
    CLOSE_TAG_RE.lastIndex = afterOpen;
    const closeMatch = CLOSE_TAG_RE.exec(normalized);
    if (!closeMatch) {
      thinkingParts.push(normalized.slice(afterOpen));
      lastEnd = normalized.length;
      break;
    }
    thinkingParts.push(normalized.slice(afterOpen, closeMatch.index).trim());
    lastEnd = closeMatch.index + closeMatch[0].length;
  }

  result.thinking = thinkingParts.filter((s) => s.length > 0).join('\n\n');
  result.answer = stripThinkTagsFromAnswer(answerParts.join(''));
  return result;
}
