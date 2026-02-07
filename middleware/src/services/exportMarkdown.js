/**
 * 将会话消息列表转为 Markdown 文本
 * @param {{ role: 'user' | 'assistant', content: string, thinking?: string }[]} messages
 * @returns {string}
 */
export function messagesToMarkdown(messages) {
  const lines = [];
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
