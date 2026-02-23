/**
 * AI 助手回复展示时，将英文辅助标识改为中文，与「思考过程」+ 正文结构一致
 */

/** 正文中常见的英文前缀/标签 → 中文或剥离（仅用于展示） */
const CONTENT_LABEL_MAP: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /^\s*Action\s*:\s*/i, replacement: '行动：' },
  { pattern: /^\s*Thought\s*:\s*/i, replacement: '思考过程：' },
  { pattern: /^\s*Observation\s*:\s*/i, replacement: '观察：' },
  { pattern: /^\s*Final\s+Answer\s*:\s*/i, replacement: '最终回答：' },
  { pattern: /^\s*<\s*thin\s*>\s*/i, replacement: '' },
];

/**
 * 归一化助手正文展示：将开头的英文辅助标识替换为中文
 */
export function normalizeAssistantContentForDisplay(content: string | undefined): string {
  if (content == null) return '';
  let s = content;
  for (const { pattern, replacement } of CONTENT_LABEL_MAP) {
    if (pattern.test(s)) {
      s = s.replace(pattern, replacement);
      break;
    }
  }
  return s;
}

/**
 * 归一化思考过程展示：剥离 <thin>、Thought/<thinht:、Thought for Xs >、Explored 等改为中文
 */
export function normalizeThinkingForDisplay(thinking: string | undefined): string {
  if (thinking == null) return '';
  return thinking
    .replace(/<\s*thin\s*>\s*/gi, '')
    .replace(/<\s*thinht\s*:\s*/gi, '思考过程：')
    .replace(/\bThought\s+for\s+(\d+)\s*s\s*>/gi, '思考 $1 秒 >')
    .replace(/\bThought\s*:\s*/gi, '思考过程：')
    .replace(/\bThought\s*>/gi, '思考过程 >')
    .replace(/\bExplored\s+(\d+)\s+searches?\s*>/gi, '已探索 $1 次搜索 >')
    .replace(/\bExplored\s+(\d+)\s+files?\s*>/gi, '已查看 $1 个文件 >');
}
