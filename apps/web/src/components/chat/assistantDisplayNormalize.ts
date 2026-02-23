/**
 * AI 助手回复展示：剥离 <think> 裸标签，并从正文中移除未放入 <think> 的 Thought/Action 块，避免重复展示思考推理
 */

/** 从正文中移除 **Action: Thought:** / **Thought:** 段落，仅影响展示，避免思考推理数据出现在正文区 */
function stripThoughtActionBlocksFromContent(raw: string): string {
  if (!raw.trim()) return raw;
  return raw
    .replace(/\*\*Action:\s*Thought:\*\*[^\n]*(?=\n|$)/gi, '')
    .replace(/\*\*Thought:\*\*[^\n]*(?=\n|$)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 正文展示：移除未放入 <think> 的 Thought/Action 块，只保留真实回答，避免与「思考过程」重复
 */
export function normalizeAssistantContentForDisplay(content: string | undefined): string {
  if (content == null) return '';
  return stripThoughtActionBlocksFromContent(content);
}

/**
 * 从正文中提取 **Action: Thought:** / **Thought:** 段落，用于在「思考过程」中展示（模型未用 <think> 时）
 */
export function extractThoughtBlocksFromContent(content: string | undefined): string {
  if (content == null) return '';
  const actionThought = content.match(/\*\*Action:\s*Thought:\*\*[^\n]*/gi);
  const thought = content.match(/\*\*Thought:\*\*[^\n]*/gi);
  const parts = [...(actionThought ?? []), ...(thought ?? [])];
  if (parts.length === 0) return '';
  return parts
    .map((p) => p.replace(/\*\*(?:Action:\s*)?Thought:\*\*\s*/gi, '').trim())
    .filter(Boolean)
    .join('\n\n');
}

/** 思考过程展示：TokenLoom 解析 <think> 后的原文，仅做简单清洗 */
export function normalizeThinkingForDisplay(thinking: string | undefined): string {
  if (thinking == null) return '';
  return thinking.replace(/<\s*\/?\s*think\s*>/gi, '').trim();
}
