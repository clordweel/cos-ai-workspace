import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useAuth } from '../hooks/useAuth';

export default function Space() {
  const { id } = useParams();
  const { isAuthenticated, user, authLoading, login } = useAuth();

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">会话</h1>
      {authLoading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">加载中…</p>
      ) : isAuthenticated && user ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">当前用户：{user.name}</p>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Button variant="link" asChild>
            <a href="/logto" onClick={(e) => { e.preventDefault(); login(); }}>登录</a>
          </Button>
          {' '}后使用工作台。
        </p>
      )}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">会话 id: {id ?? '—'}</p>
    </div>
  );
}
