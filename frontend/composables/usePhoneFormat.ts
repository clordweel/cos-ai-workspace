/**
 * 手机号格式化：展示 +86 138 0013 8000
 * 与中间层 phoneFormat 逻辑一致
 */
function normalizeToDigits(phone: string): string {
  return (phone ?? '').replace(/\D/g, '')
}

function formatPhoneDisplay(raw: string): string {
  const digits = normalizeToDigits(raw)
  if (!digits) return ''

  if (digits.length >= 13 && digits.startsWith('86') && digits[2] === '1') {
    return `+86 ${digits.slice(2, 5)} ${digits.slice(5, 9)} ${digits.slice(9, 13)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+86 ${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 11)}`
  }
  return digits ? `+${digits}` : ''
}

export function usePhoneFormat() {
  return { formatPhoneDisplay }
}
