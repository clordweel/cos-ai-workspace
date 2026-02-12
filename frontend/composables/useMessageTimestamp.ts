/**
 * 消息时间戳展示逻辑（参考 Cinny）：
 * - 跨日期时在首条消息上方显示日期分隔线（今天 / 昨天 / 具体日期）
 * - 时间戳：仅当与上一条非系统消息的间隔超过 2 分钟时显示，减少连续对话中的冗余
 */
const TIMESTAMP_GAP_MS = 2 * 60 * 1000 // 2 分钟
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

/**
 * 是否显示该条消息的时间戳：与上一条参考消息的间隔超过 2 分钟则显示（首条或间隔足够大时显示）。
 * 用户/助手消息参考上一条非系统消息；系统消息参考上一条任意有 createdAt 的消息。
 */
export function getMessageTimestampDisplay(
  messages: Array<{ role: string; createdAt?: number }>,
  index: number
): { show: boolean; text: string } {
  if (index < 0 || index >= messages.length) return { show: false, text: '' }
  const msg = messages[index]
  const ts = msg.createdAt
  if (ts == null) return { show: false, text: '' }
  // 系统消息：与上一条任意有 createdAt 的消息比较
  const useAnyRole = msg.role === 'system'
  let prevTs: number | null = null
  for (let i = index - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.createdAt == null) continue
    if (useAnyRole || m.role !== 'system') {
      prevTs = m.createdAt
      break
    }
  }
  const show = prevTs == null || ts - prevTs > TIMESTAMP_GAP_MS
  return { show, text: formatMessageTime(ts) }
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
