import { useCallback, useEffect, useMemo, useState } from 'react';
import { AI_ASSISTANT_LABEL } from '@/components/chat/assistantConstants';

export type Contact = { id: string; name: string; avatar?: string };
export type Bot = { id: string; name: string; description?: string; avatar?: string };

/** 与 frontend 一致：内置 AI 助手 */
export const BOTS: Bot[] = [
  { id: 'assistant', name: AI_ASSISTANT_LABEL, description: '通用对话与任务' },
];

/** 与中间层 messageTextProcessor 一致：指令块 [@id="..." label="..."] */
const INSTRUCTION_REGEX = /\[@\s*([^\]]+)\]/g;

function parseInstructionAttrs(inner: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pairRegex = /(\w+)\s*=\s*["']([^"']*)["']/g;
  let m: RegExpExecArray | null;
  while ((m = pairRegex.exec(inner)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

/**
 * 从消息文本解析被 @ 的机器人 id 列表（与 frontend 及中间层约定一致）。
 * 支持：纯文本 @名称、@名称无空格变体、指令块 [@id="..." label="..."]
 */
export function getMentionedBotIdsFromText(text: string): string[] {
  const ids = new Set<string>();
  for (const b of BOTS) {
    if (text.includes(`@${b.name}`)) ids.add(b.id);
    const nameNoSpace = b.name.replace(/\s+/g, '');
    if (nameNoSpace && nameNoSpace !== b.name && text.includes(`@${nameNoSpace}`)) ids.add(b.id);
  }
  INSTRUCTION_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INSTRUCTION_REGEX.exec(text)) !== null) {
    const attrs = parseInstructionAttrs(m[1]);
    const id = attrs.id ?? '';
    const label = attrs.label ?? '';
    const matched = BOTS.find((b) => b.id === id || b.name === label);
    if (matched) ids.add(matched.id);
  }
  return Array.from(ids);
}

/** react-mentions 菜单项：id + display */
export type MentionItem = { id: string; display: string };

/**
 * 联系人 + 机器人，供 @ 提及菜单使用。
 * 联系人 id 使用 contact-{id}，机器人使用 bot-{id}，与 frontend getWithTitle 一致。
 */
export function useContactsAndBots(): {
  contacts: Contact[];
  bots: Bot[];
  mentionItems: MentionItem[];
  loading: boolean;
  refreshContacts: () => void;
  getMentionedBotIdsFromText: (text: string) => string[];
} {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/contacts', { credentials: 'include' });
      if (!res.ok) {
        setContacts([]);
        return;
      }
      const data = (await res.json()) as { contacts?: Contact[] };
      setContacts(data.contacts ?? []);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const mentionItems = useMemo<MentionItem[]>(() => {
    const botNames = new Set(BOTS.map((b) => b.name));
    const contactsFiltered = contacts.filter((c) => !botNames.has(c.name));
    return [
      ...contactsFiltered.map((c) => ({ id: `contact-${c.id}`, display: c.name })),
      ...BOTS.map((b) => ({ id: `bot-${b.id}`, display: b.name })),
    ];
  }, [contacts]);

  return {
    contacts,
    bots: BOTS,
    mentionItems,
    loading,
    refreshContacts: fetchContacts,
    getMentionedBotIdsFromText,
  };
}
