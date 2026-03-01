import { useEffect, useState, Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Logto from './pages/Logto';
import LogtoCallback from './pages/LogtoCallback';
import InviteGate, { getInviteVerified } from './pages/InviteGate';
import { getAuthParam } from '@/lib/authParam';
import { AuthProvider } from '@/contexts/AuthContext';
import { AnchoredToastProvider, ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';

/** 是否启用邀请码门控：构建时注入 INVITE_CODE 则启用（webpack DefinePlugin 会替换 process.env.INVITE_CODE 为字符串，勿用 typeof process 判断否则浏览器端会短路） */
function isInviteGateRequired(): boolean {
  const code = (process.env as { INVITE_CODE?: string }).INVITE_CODE;
  return Boolean(String(code || '').trim());
}

/** 主应用路由懒加载，未通过邀请码前不加载，降低被直接抓包分析业务逻辑的风险 */
const LazyWorkspaceLayout = lazy(() => import('./components/WorkspaceLayout'));
const LazyHome = lazy(() => import('./pages/Home'));
const LazySpace = lazy(() => import('./pages/Space'));

function MainRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LazyHome />} />
      <Route path="/space" element={<LazyWorkspaceLayout><LazySpace /></LazyWorkspaceLayout>} />
      <Route path="/space/:id?" element={<LazyWorkspaceLayout><LazySpace /></LazyWorkspaceLayout>} />
      <Route path="/logto" element={<Logto />} />
      <Route path="/logto-callback" element={<LogtoCallback />} />
    </Routes>
  );
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

/** 弹窗/iframe 时不做主窗口的 URL 清理；主窗口下 auth=ok 的清理由 Space 在拉取用户成功后执行，保证会话区用户中心立即有数据 */
function AuthOkRedirect() {
  return null;
}

const Fallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
    <span className="text-sm text-muted-foreground">加载中…</span>
  </div>
);

/** URL 带 forceInviteGate=1 时强制显示门控页（便于调试，忽略 sessionStorage） */
function getForceInviteGate(): boolean {
  const search = new URLSearchParams(window.location.search);
  const hash = window.location.hash || '';
  const hashQs = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const hashParams = new URLSearchParams(hashQs);
  return search.get('forceInviteGate') === '1' || hashParams.get('forceInviteGate') === '1';
}

export default function App() {
  const inviteRequired = isInviteGateRequired();
  const forceGate = getForceInviteGate();
  const [verified, setVerified] = useState(() => {
    if (forceGate) return false;
    return !inviteRequired || getInviteVerified();
  });

  useEffect(() => {
    if (!inviteRequired) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'app_invite_verified' && e.newValue === '1') setVerified(true);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [inviteRequired]);

  if ((inviteRequired || forceGate) && !verified) {
    return (
      <InviteGate
        onSuccess={() => {
          setVerified(true);
        }}
      />
    );
  }

  return (
    <AuthProvider>
      <TooltipProvider delayDuration={300}>
        <ToastProvider position="bottom-right">
          <AnchoredToastProvider />
          <div className="isolate min-h-screen">
            <AuthPopupCloser />
            <AuthOkRedirect />
            <Suspense fallback={<Fallback />}>
              <MainRoutes />
            </Suspense>
          </div>
        </ToastProvider>
      </TooltipProvider>
    </AuthProvider>
  );
}
