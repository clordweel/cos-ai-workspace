import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildLogtoCallbackRedirectUrl } from '@cosai/logto-auth';
import { Button } from '../components/ui/button';

/** 与 Logto 注册一致，传给 API 的 redirect_uri 不含 fragment */
const LOGTO_CALLBACK_PATH = '/logto-callback';

/** 从 location.search 或 hash 中取 query（Logto 回调到 #/logto-callback?code=... 时参数在 hash 里） */
function getCallbackQuery(): URLSearchParams {
  const search = window.location.search;
  if (search && search.startsWith('?')) return new URLSearchParams(search);
  const hash = window.location.hash;
  const qs = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return new URLSearchParams(qs);
}

export default function LogtoCallback() {
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = getCallbackQuery();
    const code = q.get('code')?.trim();
    const err = q.get('error');
    const errDesc = q.get('error_description');

    if (err) {
      setError(errDesc || err || '登录被拒绝或已取消');
      setResolved(true);
      return;
    }

    if (!code) {
      setError(
        '未收到授权码，请从「重新登录」再次发起登录；若刚从 Logto 跳回，请确认该应用已配置 Redirect URI：' +
          (typeof window !== 'undefined' ? `${window.location.origin}/logto-callback` : '当前页地址') + '。'
      );
      setResolved(true);
      return;
    }

    const origin = window.location.origin;
    const redirectUri = `${origin}${LOGTO_CALLBACK_PATH}`;
    const url = buildLogtoCallbackRedirectUrl({ origin, code, redirectUri });
    window.location.href = url;
  }, []);

  return (
    <div className="logto-auth-page">
      <div className="logto-auth-card">
        <h1 className="logto-auth-title">登录回调</h1>
        {!resolved ? (
          <p className="logto-auth-description mt-2">登录处理中…</p>
        ) : (
          <>
            {error && <p className="logto-auth-error mt-2">{error}</p>}
            <div className="logto-auth-actions-inline">
              <Button asChild>
                <Link to="/logto">重新登录</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/space">返回工作台</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
