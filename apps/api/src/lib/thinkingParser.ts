/**
 * 从 Dify 流式数据中提取文本；将思考与正文分离（彻底重构）
 *
 * 支持：
 * - <think>...</think> 与 <thin>...</thin>（兼容大小写、可选空格、HTML 实体）
 * - 无闭合标签时从 answer 中剥离杂散标签，避免裸 <thin> 等进入展示
 *
 * 防护：
 * - 「Thought: 整段回复」：仅当该行较短（≤THOUGHT_LINE_MAX）才归入 thinking，否则保留在 answer 并只去掉前缀
 * - thinking 过长且 answer 为空：视为模型误把正文放进思考，将 thinking 整体作为 answer
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

/** 单行「Thought: …」仅当内容长度不超过此时才移入 thinking，否则保留在 answer 并只去掉前缀 */
const THOUGHT_LINE_MAX = 220;

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

/** 匹配应归入思考的行的开头：Thought:、<thinht: 等；仅用于判断是否剥离前缀 */
const LEADING_THOUGHT_PREFIX_RE = /^\s*(?:Thought\s*:|<\s*thinht\s*:)\s*/i;

/**
 * 处理 answer 开头的「Thought: …」「<thinht: …」行：
 * - 若该行内容较短（≤THOUGHT_LINE_MAX），整行移入 thinking
 * - 若该行过长，视为整段回复误带前缀，保留在 answer，只去掉前缀
 */
function moveLeadingThoughtLinesToThinking(answer: string): { thinking: string; answer: string } {
  let rest = answer;
  const extracted: string[] = [];
  while (rest.length > 0) {
    const match = rest.match(LEADING_THOUGHT_PREFIX_RE);
    if (!match) break;
    const lineEnd = rest.indexOf('\n');
    const line = lineEnd === -1 ? rest : rest.slice(0, lineEnd);
    const content = line.replace(LEADING_THOUGHT_PREFIX_RE, '').trim();
    if (content.length > 0 && content.length <= THOUGHT_LINE_MAX) {
      extracted.push(content);
    } else if (content.length > THOUGHT_LINE_MAX) {
      // 整段回复误带 Thought: 前缀，不再移入 thinking，只去掉前缀后留在 answer
      rest = content + (lineEnd === -1 ? '' : '\n' + rest.slice(lineEnd + 1));
      break;
    }
    rest = lineEnd === -1 ? '' : rest.slice(lineEnd + 1).trimStart();
  }
  const thinking = extracted.join('\n\n');
  return { thinking, answer: rest.trim() };
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
 * 分离 <think>...</think> 与 answer；支持 <thin>...</thin> 及 Thought: 行；并做误用恢复
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

  result.thinking = thinkingParts.filter((s) => s.length > 0).join('\n\n');
  result.answer = stripThinkTagsFromAnswer(answerParts.join(''));

  const { thinking: extraThinking, answer: finalAnswer } = moveLeadingThoughtLinesToThinking(result.answer);
  result.answer = finalAnswer;
  if (extraThinking.length > 0) {
    result.thinking = result.thinking ? `${result.thinking}\n\n${extraThinking}` : extraThinking;
  }

  recoverAnswerFromThinking(result);
  return result;
}
