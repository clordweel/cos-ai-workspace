export type Contact = { id: string; name: string; avatar?: string }
export type Bot = { id: string; name: string; description?: string; avatar?: string }

const contacts: Contact[] = [
  { id: '1', name: '张三' },
  { id: '2', name: '李四' },
  { id: '3', name: '王五' },
]

const bots: Bot[] = [
  { id: 'assistant', name: 'AI 助手', description: '通用对话与任务' },
  { id: 'material', name: '物料助手', description: '参数化创建物料' },
  { id: 'order', name: '订单助手', description: '查询订单与进度' },
]

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
  }
}
