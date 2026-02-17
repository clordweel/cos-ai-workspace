import type { MentionItem } from '@/hooks/useContactsAndBots';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 将纯文本中的 @显示名 转为 react-mentions 的 markup：@[显示名](id)。
 * 仅替换尚未为 markup 的片段（即 @名 后不紧跟 ] 的），且按 display 长度从长到短替换避免短名吞掉长名。
 */
export function plainTextToMarkup(plainText: string, items: MentionItem[]): string {
  if (!plainText || items.length === 0) return plainText;
  const sorted = [...items].sort((a, b) => b.display.length - a.display.length);
  let out = plainText;
  for (const { id, display } of sorted) {
    const re = new RegExp('@' + escapeRegex(display) + '(?!\\])', 'g');
    out = out.replace(re, `@[${display}](${id})`);
  }
  return out;
}
