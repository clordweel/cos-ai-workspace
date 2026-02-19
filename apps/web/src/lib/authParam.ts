/** 从当前 URL 的 search 或 hash 中读取 auth 参数（HashRouter 下 API 重定向到 /#/space?auth=ok，auth 在 hash 里） */
export function getAuthParam(): string | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  const fromSearch = q.get('auth');
  if (fromSearch) return fromSearch;
  const hash = window.location.hash;
  const qs = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return new URLSearchParams(qs).get('auth');
}
