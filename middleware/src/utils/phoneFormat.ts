/**
 * 手机号格式处理：Logto 存 digits only；展示用 +86 等区号格式化
 * Logto primaryPhone: 纯数字如 8613800138000
 * 展示格式: +86 138 0013 8000
 */

/** 任意格式 → 纯数字（供 Logto API） */
export function normalizePhoneToDigits(phone: string): string {
  return (phone ?? '').replace(/\D/g, '');
}

/**
 * 纯数字或混合格式 → 展示用字符串（+86 138 0013 8000）
 * 中国号码（86 开头或 11 位 1 开头）：+86 XXX XXXX XXXX
 */
export function formatPhoneForDisplay(raw: string): string {
  const digits = normalizePhoneToDigits(raw);
  if (!digits) return '';

  if (digits.length >= 13 && digits.startsWith('86') && digits[2] === '1') {
    return `+86 ${digits.slice(2, 5)} ${digits.slice(5, 9)} ${digits.slice(9, 13)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+86 ${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 11)}`;
  }
  if (digits.length > 11 && !digits.startsWith('86')) {
    return `+${digits}`;
  }
  return digits ? `+${digits}` : '';
}

/** 任意格式 → E.164（+8613800138000，供 Matrix msisdn） */
export function toE164(phone: string): string {
  const digits = normalizePhoneToDigits(phone);
  return digits ? `+${digits}` : '';
}
