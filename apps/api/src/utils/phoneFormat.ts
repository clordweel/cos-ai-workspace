/** 手机号 → Matrix msisdn 3PID 国内号码（去除国家码） */
function normalizeDigits(phone: string): string {
  return (phone ?? '').replace(/\D/g, '');
}
function stripCountryCode(phone: string): string {
  const d = normalizeDigits(phone);
  if (!d) return '';
  if (d.length >= 12 && d.startsWith('86') && d[2] === '1') return d.slice(2);
  if (d.length === 11 && d.startsWith('1')) return d;
  return d;
}
export function toMsisdnLocal(phone: string): string {
  return stripCountryCode(phone);
}
