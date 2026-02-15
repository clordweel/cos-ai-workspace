import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';

export default function LogtoCallback() {
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const code = q.get('code')?.trim();
    const err = q.get('error');
    const errDesc = q.get('error_description');

    if (err) {
      setError(errDesc || err || '登录被拒绝或已取消');
      setResolved(true);
      return;
    }

    if (!code) {
      setError('未收到授权码，请从「重新登录」再次发起登录；若刚从 Logto 跳回，请确认该应用已配置 Redirect URI：当前页地址。');
      setResolved(true);
      return;
    }

    const origin = window.location.origin;
    const redirectUri = `${origin}/logto-callback`;
    const url = `/api/auth/logto/callback?${new URLSearchParams({ code, redirect_uri: redirectUri }).toString()}`;
    window.location.href = url;
  }, []);

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 p-6 bg-zinc-50 dark:bg-zinc-900">
      <h1 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">登录回调</h1>
      {!resolved ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">登录处理中…</p>
      ) : (
        <>
          {error && <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}
          <div className="flex items-center gap-3">
            <Button asChild>
              <a href="/logto">重新登录</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/space">返回工作台</a>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
