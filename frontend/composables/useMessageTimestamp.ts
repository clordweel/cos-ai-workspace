/**
 * 消息时间戳展示逻辑：连续且时间相近的消息合并时间戳
 * 仅在一组连续同角色、时间间隔 < 阈值的消息的最后一条展示时间
 */
const TIMESTAMP_MERGE_THRESHOLD_MS = 5 * 60 * 1000 // 5 分钟

export function formatMessageTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  const pad = (n: number) => String(n).padStart(2, '0')
  const h = d.getHours()
  const m = d.getMinutes()
  const timeStr = `${h}:${pad(m)}`

  if (msgDay.getTime() === today.getTime()) return timeStr
  if (msgDay.getTime() === yesterday.getTime()) return `昨天 ${timeStr}`
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日 ${timeStr}`
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${timeStr}`
}

export function getMessageTimestampDisplay(
  messages: Array<{ role: string; createdAt?: number }>,
  index: number
): { show: boolean; text: string } {
  if (index < 0 || index >= messages.length) return { show: false, text: '' }
  const msg = messages[index]
  if (msg.role === 'system') return { show: false, text: '' }
  const ts = msg.createdAt
  if (ts == null) return { show: false, text: '' }

  const next = messages[index + 1]
  const show =
    !next ||
    next.role !== msg.role ||
    (next.createdAt != null && next.createdAt - ts > TIMESTAMP_MERGE_THRESHOLD_MS)

  if (!show) return { show: false, text: '' }
  return { show: true, text: formatMessageTime(ts) }
}
