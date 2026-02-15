import React, { useCallback, useState } from 'react';
import { Button } from '../ui/button';

export interface MaterialConfirmCardProps {
  draftId: string;
  itemName?: string;
  onConfirmed?: () => void;
}

/**
 * 待确认物料任务卡片（与 frontend TaskCard/MaterialConfirm 对照）
 * 调用 POST /api/material/confirm，展示加载/成功/错误态
 */
export function MaterialConfirmCard({ draftId, itemName, onConfirmed }: MaterialConfirmCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const confirm = useCallback(async () => {
    if (loading || !draftId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/material/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ draft_id: draftId, confirmed_by: 'current-user' }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (res.status === 401) {
        setError('需要登录');
        return;
      }
      if (!res.ok) {
        setError(data.message || data.error || res.statusText);
        return;
      }
      setSuccess(true);
      onConfirmed?.();
    } finally {
      setLoading(false);
    }
  }, [draftId, loading, onConfirmed]);

  return (
    <div className="rounded-xl border border-amber-700/50 bg-amber-900/20 p-4 dark:border-amber-600/50 dark:bg-amber-950/30">
      <h4 className="text-sm font-medium text-amber-200 mb-2">待确认物料</h4>
      <p className="text-zinc-400 dark:text-zinc-500 text-sm mb-3">{itemName || '—'}</p>
      {error && (
        <p className="text-red-500 dark:text-red-400 text-sm mb-2" role="alert">
          {error}
        </p>
      )}
      {success ? (
        <p className="text-emerald-500 dark:text-emerald-400 text-sm">已确认创建</p>
      ) : (
        <Button
          type="button"
          size="sm"
          className="bg-amber-600 hover:bg-amber-500 text-white"
          disabled={loading}
          onClick={confirm}
        >
          {loading ? '提交中…' : '确认创建'}
        </Button>
      )}
    </div>
  );
}
