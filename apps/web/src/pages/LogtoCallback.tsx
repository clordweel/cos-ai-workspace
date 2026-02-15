import { useEffect, useState } from 'react';

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
    <div style={{ padding: 24, fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>登录回调</h1>
      {!resolved ? (
        <p className="text-zinc-500">登录处理中…</p>
      ) : (
        <>
          {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
          <a href="/logto" style={{ marginRight: 12 }}>
            重新登录
          </a>
          <a href="/space">返回工作台</a>
        </>
      )}
    </div>
  );
}
