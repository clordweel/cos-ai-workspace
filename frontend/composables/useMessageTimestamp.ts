/**
 * 消息时间戳展示逻辑（参考 Cinny）：
 * - 每条非系统消息均在气泡右侧显示时间
 * - 跨日期时在首条消息上方显示日期分隔线（今天 / 昨天 / 具体日期）
 */
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

/** 每条非系统消息且存在 createdAt 时都显示时间戳 */
export function getMessageTimestampDisplay(
  messages: Array<{ role: string; createdAt?: number }>,
  index: number
): { show: boolean; text: string } {
  if (index < 0 || index >= messages.length) return { show: false, text: '' }
  const msg = messages[index]
  if (msg.role === 'system') return { show: false, text: '' }
  const ts = msg.createdAt
  if (ts == null) return { show: false, text: '' }
  return { show: true, text: formatMessageTime(ts) }
}

/** 若该条消息是“新日期”的第一条，返回日期分隔文案（今天/昨天/M月D日/YYYY年M月D日），否则返回空 */
export function getDateSeparatorBefore(
  messages: Array<{ role: string; createdAt?: number }>,
  index: number
): string {
  if (index < 0 || index >= messages.length) return ''
  const msg = messages[index]
  const ts = msg.createdAt
  if (ts == null) return ''
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const msgDay = new Date(new Date(ts).getFullYear(), new Date(ts).getMonth(), new Date(ts).getDate())

  const prev = index > 0 ? messages[index - 1] : null
  const prevTs = prev?.createdAt
  const prevDay =
    prevTs != null
      ? new Date(new Date(prevTs).getFullYear(), new Date(prevTs).getMonth(), new Date(prevTs).getDate())
      : null
  if (prevDay != null && prevDay.getTime() === msgDay.getTime()) return ''

  if (msgDay.getTime() === today.getTime()) return '今天'
  if (msgDay.getTime() === yesterday.getTime()) return '昨天'
  const d = new Date(ts)
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
