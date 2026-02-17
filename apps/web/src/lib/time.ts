import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

/**
 * 消息时间：今天显示 HH:mm；昨天「昨天 HH:mm」；更早「M月D日 HH:mm」。
 * 可选：1 分钟内显示「刚刚」。
 */
export function formatMessageTime(ts: number, useRelative = true): string {
  const d = dayjs(ts);
  const now = dayjs();
  if (useRelative && now.diff(d, 'minute') < 1 && now.diff(d, 'second') >= 0) {
    return '刚刚';
  }
  if (d.isSame(now, 'day')) {
    return d.format('HH:mm');
  }
  if (d.isSame(now.subtract(1, 'day'), 'day')) {
    return `昨天 ${d.format('HH:mm')}`;
  }
  return d.format('M月D日 HH:mm');
}

/**
 * 日期分隔标签：今天 / 昨天 / M月D日
 */
export function formatDateLabel(ts: number): string {
  const d = dayjs(ts);
  const now = dayjs();
  if (d.isSame(now, 'day')) return '今天';
  if (d.isSame(now.subtract(1, 'day'), 'day')) return '昨天';
  return d.format('M月D日');
}

/**
 * 会话列表日期标签：今天 / 昨天 / M月D日（与 formatDateLabel 一致）。
 * useRelative=true 时，当天显示「刚刚」「x 分钟前」或 HH:mm。
 */
export function formatSessionDate(ts: number, useRelative = false): string {
  const d = dayjs(ts);
  const now = dayjs();
  if (useRelative && d.isSame(now, 'day')) {
    const diffMin = now.diff(d, 'minute');
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    return d.format('HH:mm');
  }
  return formatDateLabel(ts);
}
