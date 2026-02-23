'use client';

import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAssociation } from '@/contexts/AssociationContext';
import { MOCK_MEMOS } from '@/data/associationCandidates';

/** 测试应用：备忘录列表，每项可「关联到当前会话」 */
export function MemoTestApp() {
  const { addPendingAssociation } = useAssociation();

  return (
    <div className="flex min-h-full flex-col p-4">
      <h2 className="text-sm font-semibold text-foreground mb-2">测试备忘录</h2>
      <p className="text-xs text-muted-foreground mb-4">
        点击「关联到当前会话」后，该条会出现在聊天输入框上方，发送时随消息一起提交（方案 B）。
      </p>
      <ul className="space-y-2">
        {MOCK_MEMOS.map((memo) => (
          <li
            key={memo.entityId}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-foreground">{memo.title}</span>
              {memo.summary && (
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{memo.summary}</p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1"
              onClick={() => addPendingAssociation(memo)}
            >
              <Link2 className="h-3 w-3" aria-hidden />
              关联到当前会话
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
