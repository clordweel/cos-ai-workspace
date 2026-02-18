'use client';

import { useState } from 'react';
import { User, Users } from 'lucide-react';
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export type CreateSessionContact = { id: string; name: string; avatar?: string };

export type CreateSessionResult =
  | { mode: 'solo' }
  | { mode: 'contacts'; contactIds: string[] };

export interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 联系人列表（多选为群组） */
  contacts?: CreateSessionContact[];
  /** 确认创建：solo 或 选中的联系人 id 列表（1=私聊，2+=群组） */
  onConfirm: (result: CreateSessionResult) => void;
}

type DialogMode = 'solo' | 'contacts';

export function CreateSessionDialog({
  open,
  onOpenChange,
  contacts = [],
  onConfirm,
}: CreateSessionDialogProps) {
  const [mode, setMode] = useState<DialogMode>('solo');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const canConfirm = mode === 'solo' || selectedIds.size > 0;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setMode('solo');
      setSelectedIds(new Set());
    }
    onOpenChange(next);
  };

  const handleConfirm = () => {
    if (mode === 'solo') {
      onConfirm({ mode: 'solo' });
    } else {
      onConfirm({ mode: 'contacts', contactIds: Array.from(selectedIds) });
    }
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup className="max-w-sm">
        <DialogHeader>
          <DialogTitle>创建会话</DialogTitle>
          <DialogDescription>
            选择 Solo 模式或从联系人中多选（多选将创建群组会话）
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-4">
          {/* 模式选择 */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">会话类型</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('solo')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                  mode === 'solo'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                <User className="h-4 w-4 shrink-0" />
                Solo 模式
              </button>
              <button
                type="button"
                onClick={() => setMode('contacts')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                  mode === 'contacts'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                <Users className="h-4 w-4 shrink-0" />
                选择联系人
              </button>
            </div>
          </div>

          {/* 联系人多选（仅 contacts 模式显示） */}
          {mode === 'contacts' && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                选择联系人（多选为群组）
              </span>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2 space-y-0.5">
                {contacts.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    暂无联系人
                  </p>
                ) : (
                  contacts.map((c) => (
                    <label
                      key={c.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/70',
                        selectedIds.has(c.id) && 'bg-muted/70'
                      )}
                    >
                      <Checkbox
                        checked={selectedIds.has(c.id)}
                        onCheckedChange={(checked) =>
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          })
                        }
                        aria-label={`选择 ${c.name}`}
                      />
                      {c.avatar ? (
                        <img
                          src={c.avatar}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          {c.name?.trim().charAt(0)?.toUpperCase() ?? '?'}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogPanel>
        <DialogFooter>
          <DialogClose
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            取消
          </DialogClose>
          <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
            创建会话
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
