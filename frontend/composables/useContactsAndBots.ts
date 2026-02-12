export type Contact = { id: string; name: string; avatar?: string }
export type Bot = { id: string; name: string; description?: string; avatar?: string }

const contacts: Contact[] = [
  { id: '1', name: '张三' },
  { id: '2', name: '李四' },
  { id: '3', name: '王五' },
]

const bots: Bot[] = [
  { id: 'assistant', name: 'AI 助手', description: '通用对话与任务' },
]

/** 与中间层 messageTextProcessor 一致：指令块 [@id="..." label="..."] */
const INSTRUCTION_REGEX = /\[@\s*([^\]]+)\]/g

function parseInstructionAttrs(inner: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const pairRegex = /(\w+)\s*=\s*["']([^"']*)["']/g
  let m: RegExpExecArray | null
  while ((m = pairRegex.exec(inner)) !== null) {
    attrs[m[1]] = m[2]
  }
  return attrs
}

/**
 * 从消息文本解析被 @ 的机器人 id 列表。
 * 支持两种格式（与中间层约定一致）：
 * - 纯文本：@AI 助手
 * - 指令块：[@id="assistant" label="AI 助手"]
 */
export function getMentionedBotIdsFromText(text: string): string[] {
  const ids = new Set<string>()
  for (const b of bots) {
    if (text.includes(`@${b.name}`)) ids.add(b.id)
  }
  INSTRUCTION_REGEX.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = INSTRUCTION_REGEX.exec(text)) !== null) {
    const attrs = parseInstructionAttrs(m[1])
    const id = attrs.id ?? ''
    const label = attrs.label ?? ''
    const matched = bots.find((b) => b.id === id || b.name === label)
    if (matched) ids.add(matched.id)
  }
  return Array.from(ids)
}

export function useContactsAndBots() {
  const getContact = (id: string) => contacts.find((c) => c.id === id)
  const getBot = (id: string) => bots.find((b) => b.id === id)
  const getWithTitle = (withId: string): string | null => {
    if (withId.startsWith('contact-')) {
      const c = getContact(withId.replace(/^contact-/, ''))
      return c?.name ?? null
    }
    if (withId.startsWith('bot-')) {
      const b = getBot(withId.replace(/^bot-/, ''))
      return b?.name ?? null
    }
    return null
  }
  return {
    contacts,
    bots,
    getContact,
    getBot,
    getWithTitle,
    getMentionedBotIdsFromText,
  }
}
