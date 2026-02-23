'use client';

import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAssociation } from '@/contexts/AssociationContext';
import { MOCK_TASKS } from '@/data/associationCandidates';

/** 测试应用：项目任务列表，每项可「关联到当前会话」 */
export function TaskTestApp() {
  const { addPendingAssociation } = useAssociation();

  return (
    <div className="flex min-h-full flex-col p-4">
      <h2 className="text-sm font-semibold text-foreground mb-2">测试任务</h2>
      <p className="text-xs text-muted-foreground mb-4">
        将任务关联到会话后，发送的消息会携带该任务信息，便于 AI 或后续功能使用。
      </p>
      <ul className="space-y-2">
        {MOCK_TASKS.map((task) => (
          <li
            key={task.entityId}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-foreground">{task.title}</span>
              {task.summary && (
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{task.summary}</p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1"
              onClick={() => addPendingAssociation(task)}
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
