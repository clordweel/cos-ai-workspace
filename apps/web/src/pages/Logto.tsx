import { useEffect, useState } from 'react';

export default function Logto() {
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const prompt = new URLSearchParams(window.location.search).get('prompt') || undefined;
    const q = prompt === 'consent' || prompt === 'login' ? `?prompt=${prompt}` : '';
    fetch(`/api/auth/logto/url${q}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data: { ok?: boolean; url?: string; error?: string }) => {
        if (data.ok && typeof data.url === 'string') {
          window.location.href = data.url;
          return;
        }
        setError(data.error || '获取登录地址失败');
      })
      .catch(() => setError('网络错误，请稍后重试'));
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>登录</h1>
      {error ? (
        <p style={{ color: '#b91c1c' }}>{error}</p>
      ) : (
        <p className="text-zinc-500">正在跳转到登录…</p>
      )}
    </div>
  );
}
