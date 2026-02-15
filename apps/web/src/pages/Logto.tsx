import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';

export default function Logto() {
  const [error, setError] = useState<string>('');

  const fetchAndRedirect = () => {
    setError('');
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
  };

  useEffect(() => {
    fetchAndRedirect();
  }, []);

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 p-6 bg-zinc-50 dark:bg-zinc-900">
      <h1 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">登录</h1>
      {error ? (
        <>
          <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          <Button variant="outline" onClick={fetchAndRedirect}>
            重试
          </Button>
        </>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">正在跳转到登录…</p>
      )}
    </div>
  );
}
