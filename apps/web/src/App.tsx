import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import WorkspaceLayout from './components/WorkspaceLayout';
import Home from './pages/Home';
import Space from './pages/Space';
import Logto from './pages/Logto';
import LogtoCallback from './pages/LogtoCallback';
import { AnchoredToastProvider, ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';

/** 从当前 URL 的 search 或 hash 中读取 auth 参数（HashRouter 下 API 重定向到 /#/space?auth=ok，auth 在 hash 里） */
function getAuthParam(): string | null {
  const q = new URLSearchParams(window.location.search);
  const fromSearch = q.get('auth');
  if (fromSearch) return fromSearch;
  const hash = window.location.hash;
  const qs = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return new URLSearchParams(qs).get('auth');
}

/** 弹窗/iframe 内登录成功：若 URL 带 auth=ok，通知父窗口或 opener 并（弹窗时）关闭 */
function AuthPopupCloser() {
  useEffect(() => {
    if (getAuthParam() !== 'ok') return;
    const origin = window.location.origin;
    if (window.opener) {
      window.opener.postMessage({ type: 'logto-auth-done' }, origin);
      window.close();
    } else if (window !== window.top) {
      window.parent.postMessage({ type: 'logto-auth-done' }, origin);
    }
  }, []);
  return null;
}

/** Hash 路由下：登录成功后中间层重定向到 /#/space?auth=ok 时，清理地址栏（弹窗/iframe 由 AuthPopupCloser 处理） */
function AuthOkRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    if (window.opener || window !== window.top) return;
    if (getAuthParam() !== 'ok') return;
    navigate('/space', { replace: true });
    window.history.replaceState(null, '', `${window.location.origin}/#/space`);
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <ToastProvider position="bottom-right">
        <AnchoredToastProvider />
        <div className="isolate min-h-screen">
      <AuthPopupCloser />
      <AuthOkRedirect />
      <Routes>
        <Route path="/" element={<Home />} />
      <Route path="/space" element={<WorkspaceLayout><Space /></WorkspaceLayout>} />
      <Route path="/space/:id?" element={<WorkspaceLayout><Space /></WorkspaceLayout>} />
      <Route path="/logto" element={<Logto />} />
        <Route path="/logto-callback" element={<LogtoCallback />} />
      </Routes>
        </div>
      </ToastProvider>
    </TooltipProvider>
  );
}
