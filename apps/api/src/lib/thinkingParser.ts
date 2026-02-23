/**
 * 从 Dify 流式数据中提取文本；将思考与正文分离
 *
 * 消息正文提取逻辑参考 Dify 官方 SDK（sdks/nodejs-client/src/http/sse.ts），见 difyMessageParser.ts
 * 本模块仅负责：对提取出的全文做 <think>/<thin> 与 answer 的分离
 *
 * 支持：
 * - <think>...</think> 与 <thin>...</thin>（兼容大小写、可选空格、HTML 实体）
 * - 无闭合标签时从 answer 中剥离杂散标签，避免裸 <thin> 等进入展示
 *
 * 防护：
 * - thinking 过长且 answer 为空：视为模型误把正文放进思考，将 thinking 整体作为 answer
 */

export { extractText } from './difyMessageParser.js';

export interface ThinkingAndAnswer {
  thinking: string;
  answer: string;
}

const OPEN_TAG_RE = /<\s*think\s*>/gi;
const CLOSE_TAG_RE = /<\s*\/\s*think\s*>/gi;

/** answer 为空且 thinking 超过此长度时，将 thinking 整体当作 answer（模型误用思考块） */
const THINKING_AS_ANSWER_MIN_LEN = 120;

/**
 * 规范化：将 <thin> / </think> 统一成 <think> / </think>，便于同一套解析逻辑处理
 */
function normalizeThinTags(s: string): string {
  return s
    .replace(/<\s*thin\s*>/gi, '<think>')
    .replace(/<\s*\/\s*thin\s*>/gi, '</think>');
}

/**
 * 从正文中移除杂散 think/thin 标签及未闭合尾段，避免流式导致裸标签进入 answer
 * 流式时 chunk 边界可能切在 <thi、<think 等中间，末尾未闭合的开标签一并剥离
 */
function stripThinkTagsFromAnswer(raw: string): string {
  return raw
    .replace(/<\s*\/\s*think\s*>/gi, '')
    .replace(/<\s*think\s*>/gi, '')
    .replace(/<\s*\/\s*thin\s*>/gi, '')
    .replace(/<\s*thin\s*>/gi, '')
    .replace(/<\s*\/\s*think[^>]*$/i, '')
    .replace(/<\s*think[^>]*$/i, '')
    .replace(/<\s*\/\s*thin[^>]*$/i, '')
    .replace(/<\s*thin[^>]*$/i, '')
    .replace(/<\s*thin\s*$/i, '')
    .replace(/<\s*(?:think|thin)?\s*$/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 若 answer 为空且 thinking 过长，视为模型把正文放进思考块，整体作为 answer
 */
function recoverAnswerFromThinking(result: ThinkingAndAnswer): void {
  if ((result.answer ?? '').trim().length > 0) return;
  const t = (result.thinking ?? '').trim();
  if (t.length >= THINKING_AS_ANSWER_MIN_LEN) {
    result.answer = t;
    result.thinking = '';
  }
}

/**
 * 分离 <think>...</think> 与 answer；支持 <thin>...</thin>；并做误用恢复
 */
export function splitThinkingAndAnswer(text: string): ThinkingAndAnswer {
  const result: ThinkingAndAnswer = { thinking: '', answer: '' };
  if (typeof text !== 'string' || !text) return result;
  const withEntities = text
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
  const normalized = normalizeThinTags(withEntities);
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

  /** 去除连续重复的思考块（模型/Dify 有时会输出两段相同 <think> 内容，导致思考过程重复展示） */
  const deduped: string[] = [];
  const normalizeForDedup = (s: string) => s.replace(/^\s*<\s*thin?(?:k)?\s*[:\s]*/i, '').trim();
  for (const part of thinkingParts) {
    if (part.length === 0) continue;
    const norm = normalizeForDedup(part);
    if (deduped.length > 0 && normalizeForDedup(deduped[deduped.length - 1]!) === norm) continue;
    deduped.push(part);
  }
  result.thinking = deduped.join('\n\n');
  result.answer = stripThinkTagsFromAnswer(answerParts.join(''));

  recoverAnswerFromThinking(result);
  return result;
}
