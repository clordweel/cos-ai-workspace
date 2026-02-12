/**
 * 手机号格式化：展示国内号 138 0013 8000（不含国家码）
 * 与中间层 phoneFormat 逻辑一致
 */
function normalizeToDigits(phone: string): string {
  return (phone ?? '').replace(/\D/g, '')
}

function stripCountryCode(phone: string): string {
  const digits = normalizeToDigits(phone)
  if (!digits) return ''
  if (digits.length >= 12 && digits.startsWith('86') && digits[2] === '1') {
    return digits.slice(2)
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits
  }
  return digits
}

function formatPhoneDisplay(raw: string): string {
  const local = stripCountryCode(raw)
  if (!local) return ''
  return local
}

export function usePhoneFormat() {
  return { formatPhoneDisplay }
}
