'use client';

import { useState, useCallback, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SESSION_KEY = 'app_invite_verified';

/** 从构建时注入的环境变量读取邀请码（webpack 会替换 process.env.INVITE_CODE，勿用 typeof process 判断） */
function getExpectedInviteCode(): string {
  return String((process.env as { INVITE_CODE?: string }).INVITE_CODE || '');
}

export function getInviteVerified(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function setInviteVerified(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_KEY, '1');
}

export interface InviteGateProps {
  onSuccess: () => void;
}

/**
 * 邀请码门控页：测试版部署时限制仅持邀请码用户可继续访问。
 * 通过后写入 sessionStorage，同会话内不再展示；主应用使用懒加载，未通过时不加载业务包。
 */
export default function InviteGate({ onSuccess }: InviteGateProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const expected = getExpectedInviteCode();

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setError('');
      if (!code.trim()) {
        setError('请输入邀请码');
        return;
      }
      setLoading(true);
      // 简单时序比较，避免明文在内存中长期暴露
      const ok = expected !== '' && code.trim() === expected;
      setLoading(false);
      if (ok) {
        setInviteVerified();
        onSuccess();
      } else {
        setError('邀请码错误');
      }
    },
    [code, expected, onSuccess]
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-center text-lg font-semibold text-foreground">邀请码验证</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          当前为测试环境，请输入邀请码以继续访问。
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="请输入邀请码"
            className="rounded-xl"
            autoComplete="off"
            autoFocus
            disabled={loading}
            aria-label="邀请码"
            aria-invalid={!!error}
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? '验证中…' : '继续访问'}
          </Button>
        </form>
      </div>
    </div>
  );
}
