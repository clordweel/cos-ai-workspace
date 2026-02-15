import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import WorkspaceLayout from './components/WorkspaceLayout';
import Home from './pages/Home';
import Space from './pages/Space';
import Logto from './pages/Logto';
import LogtoCallback from './pages/LogtoCallback';
import { AnchoredToastProvider, ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';

/** Hash 路由下：登录成功后中间层重定向到 /space?auth=ok 时，跳转到 #/space 并清理地址栏（auth=ok 在主 URL，需读 window.location） */
function AuthOkRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('auth') === 'ok') {
      navigate('/space', { replace: true });
      window.history.replaceState(null, '', `${window.location.origin}/#/space`);
    }
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <ToastProvider position="bottom-right">
        <AnchoredToastProvider />
        <div className="isolate min-h-screen">
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
