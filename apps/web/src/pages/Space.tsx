import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Space() {
  const { id } = useParams();
  const { isAuthenticated, user, authLoading, login } = useAuth();

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>会话</h1>
      {authLoading ? (
        <p className="text-zinc-500">加载中…</p>
      ) : isAuthenticated && user ? (
        <p>当前用户：{user.name}</p>
      ) : (
        <p>
          <a href="/logto" onClick={(e) => { e.preventDefault(); login(); }}>登录</a> 后使用工作台。
        </p>
      )}
      <p>会话 id: {id ?? '—'}</p>
    </div>
  );
}
