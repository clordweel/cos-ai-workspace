'use client';

import { useState, useCallback } from 'react';
import { ExternalLink, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

/** Hash 路由下需加载 #/logto */
function getLogtoUrl(): string {
  if (typeof window === 'undefined') return '/#/logto';
  const base = window.location.href.split('#')[0].replace(/\/$/, '') || window.location.origin;
  return `${base}#/logto`;
}

/**
 * 应用区认证面板：点击登录在弹窗内完成 Logto 认证，主窗口不跳转。
 */
export function AuthPanel({ className }: { className?: string }) {
  const { isAuthenticated, user, loginWithPopup } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 点击「登录」：弹窗打开 #/logto，在弹窗内完成 Logto 后关闭并刷新主窗口 */
  const startLogin = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithPopup();
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }, [loginWithPopup]);

  if (isAuthenticated && user) {
    return (
      <div
        className={cn(
          'rounded-xl border border-border bg-emerald-50/80 p-4 dark:bg-emerald-900/20 dark:border-emerald-800/40',
          className
        )}
      >
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">已登录</p>
        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
          {user.name || user.email || user.username || '—'}
        </p>
      </div>
    );
  }

  const logtoUrl = getLogtoUrl();

  return (
    <div
      className={cn(
        'flex min-h-full flex-col items-center justify-center p-6',
        className
      )}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-center text-lg font-semibold text-foreground">登录到你的账号</h2>
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          使用单点登录进入工作空间，认证由 Logto 提供。
        </p>
        {error && (
          <p className="mt-2 text-center text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <Button
            type="button"
            className="w-full"
            onClick={startLogin}
            disabled={loading}
          >
            <LogIn className="h-4 w-4" aria-hidden />
            {loading ? '登录中…' : '登录'}
          </Button>
          <a
            href={logtoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            在新标签页打开
          </a>
        </div>
      </div>
    </div>
  );
}
