'use client';

import { useState } from 'react';
import { Link2, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAssociation } from '@/contexts/AssociationContext';
import { useMemos } from '@/hooks/useMemos';
import { cn } from '@/lib/utils';

/** 备忘录应用：对接 GET/POST /api/memos（ERPNext ToDo/Memo），列表 + 新建；可选「关联到当前会话」。 */
export function MemoTestApp() {
  const { addPendingAssociation } = useAssociation();
  const { memos, loading, error, erpUnconfigured, fetchMemos, createMemo } = useMemos();
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const desc = newDesc.trim();
    if (!desc) return;
    setCreating(true);
    try {
      const created = await createMemo({ description: desc, status: 'Open' });
      if (created) setNewDesc('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col p-4">
      <h2 className="text-sm font-semibold text-foreground mb-2">备忘录</h2>

      {erpUnconfigured && (
        <p className="text-xs text-amber-600 dark:text-amber-500 mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2">
          ERP 未配置。请联系管理员在 apps/api 配置 COS_ERP_BASE 与 COS_ERP_API_KEY，或后续在「设置」中连接 ERP。
        </p>
      )}

      <div className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="新建待办内容…"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={creating || erpUnconfigured}
        />
        <Button
          type="button"
          size="sm"
          onClick={handleCreate}
          disabled={!newDesc.trim() || creating || erpUnconfigured}
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
          <span className="ml-1">新建</span>
        </Button>
      </div>

      {error && !erpUnconfigured && (
        <p className="text-xs text-destructive mb-2">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        </div>
      ) : memos.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">
          {erpUnconfigured ? '配置 ERP 后可在此查看与创建备忘录。' : '暂无备忘录，上方新建一条试试。'}
        </p>
      ) : (
        <ul className="space-y-2">
          {memos.map((memo) => (
            <li
              key={memo.name ?? String(memo)}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2'
              )}
            >
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-foreground">
                  {(memo.description as string) || '(无内容)'}
                </span>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {memo.status ?? '-'} · {memo.modified ? new Date(memo.modified as string).toLocaleString() : ''}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1"
                onClick={() =>
                  addPendingAssociation({
                    appId: 'memo-test',
                    entityType: 'memo',
                    entityId: (memo.name as string) ?? '',
                    title: (memo.description as string) || '(无内容)',
                    summary: undefined,
                  })
                }
              >
                <Link2 className="h-3 w-3" aria-hidden />
                关联到当前会话
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
