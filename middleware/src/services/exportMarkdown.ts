/**
 * 将会话消息列表转为 Markdown 文本
 */
export interface MessageForExport {
  role: 'user' | 'assistant';
  content?: string;
  thinking?: string;
}

export function messagesToMarkdown(messages: MessageForExport[]): string {
  const lines: string[] = [];
  for (const msg of messages || []) {
    const roleLabel = msg.role === 'user' ? '用户' : '助手';
    lines.push(`## ${roleLabel}\n`);
    if (msg.content?.trim()) lines.push(msg.content.trim(), '\n');
    if (msg.thinking?.trim()) {
      lines.push('> **思考过程**\n> ', msg.thinking.trim().replace(/\n/g, '\n> '), '\n');
    }
    lines.push('\n');
  }
  return lines.join('').trimEnd();
}
