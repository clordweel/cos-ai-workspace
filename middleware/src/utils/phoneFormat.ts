/**
 * 手机号格式处理：Logto 存 digits only（含国家码如 8613800138000）
 * 展示与 Matrix 均移除国家码，仅保留国内号
 */

/** 任意格式 → 纯数字（供 Logto API） */
export function normalizePhoneToDigits(phone: string): string {
  return (phone ?? '').replace(/\D/g, '');
}

/** 去除国家码，返回国内号码纯数字。中国 86：8613800138000 → 13800138000 */
export function stripCountryCode(phone: string): string {
  const digits = normalizePhoneToDigits(phone);
  if (!digits) return '';
  if (digits.length >= 12 && digits.startsWith('86') && digits[2] === '1') {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits;
  }
  return digits;
}

/** 纯数字或混合格式 → 展示用字符串（不含国家码）：138 0013 8000 */
export function formatPhoneForDisplay(raw: string): string {
  const local = stripCountryCode(raw);
  if (!local) return '';
  if (local.length === 11 && local.startsWith('1')) {
    return `${local.slice(0, 3)} ${local.slice(3, 7)} ${local.slice(7, 11)}`;
  }
  return local;
}

/** 任意格式 → 供 Matrix msisdn 3PID 的国内号码（去除国家码）。规范要求 address 不含前导 + */
export function toMsisdnLocal(phone: string): string {
  return stripCountryCode(phone);
}

/** 国内号 → Logto primaryPhone 格式（E.164 数字不含 +）。11 位 1 开头补 86 */
export function toLogtoPrimaryPhone(phone: string): string {
  const digits = normalizePhoneToDigits(phone);
  if (!digits) return '';
  if (digits.startsWith('86') && digits.length >= 12) return digits;
  if (digits.length === 11 && digits.startsWith('1')) return `86${digits}`;
  return digits;
}
