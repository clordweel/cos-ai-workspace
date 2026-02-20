'use client';

import { UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogPanel,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { RoomMember } from '@/hooks/useSessionMembers';
import { cn } from '@/lib/utils';

export interface SessionMembersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: RoomMember[];
  loading?: boolean;
  sessionId: string | undefined;
  onInvite?: (mxid: string) => Promise<boolean>;
  trigger?: React.ReactNode;
  /** 指定挂载容器时，Sheet 仅覆盖该区域（如会话区），不占全屏 */
  container?: HTMLElement | null;
}

function formatUserId(userId: string): string {
  if (userId.includes(':')) {
    return userId.slice(0, userId.indexOf(':'));
  }
  return userId;
}

export function SessionMembersSheet({
  open,
  onOpenChange,
  members,
  loading,
  sessionId,
  onInvite,
  trigger,
  container,
}: SessionMembersSheetProps) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteMxid, setInviteMxid] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const handleInviteSubmit = async () => {
    const mxid = inviteMxid.trim();
    if (!mxid || !onInvite) return;
    if (!mxid.includes(':')) {
      setInviteError('请填写完整 MXID（如 @user:server）');
      return;
    }
    setInviteError('');
    setInviteSubmitting(true);
    try {
      const ok = await onInvite(mxid);
      if (ok) {
        setInviteMxid('');
        setInviteDialogOpen(false);
      } else {
        setInviteError('邀请失败，请重试');
      }
    } catch {
      setInviteError('邀请失败');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const content = (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" aria-hidden />
          会话成员
        </SheetTitle>
      </SheetHeader>
      <div className="flex flex-col gap-3 px-4 py-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无成员数据</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {members.map((m) => (
              <li
                key={m.userId}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
                  m.membership === 'invite' && 'opacity-75'
                )}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="text-xs">
                    {(m.displayName || formatUserId(m.userId)).slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {m.displayName || formatUserId(m.userId)}
                </span>
                {m.isOwner && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">创建者</span>
                )}
                {m.membership === 'invite' && (
                  <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-400">待接受</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {sessionId && onInvite && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => setInviteDialogOpen(true)}
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden />
            邀请用户
          </Button>
        )}
      </div>
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogPanel className="max-w-sm">
          <DialogHeader>
            <DialogTitle>邀请用户</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            请输入对方的完整 Matrix 用户 ID（MXID），例如 @username:server
          </p>
          <Input
            value={inviteMxid}
            onChange={(e) => setInviteMxid(e.target.value)}
            placeholder="@user:example.com"
            className="mt-2"
            aria-invalid={!!inviteError}
          />
          {inviteError && (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {inviteError}
            </p>
          )}
          <DialogFooter className="mt-4">
            <DialogClose render={<Button variant="ghost">取消</Button>} />
            <Button onClick={handleInviteSubmit} disabled={inviteSubmitting || !inviteMxid.trim()}>
              {inviteSubmitting ? '邀请中…' : '邀请'}
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </>
  );

  const sheetContent = (
    <SheetContent side="right" className="w-full max-w-sm" container={container}>
      {content}
    </SheetContent>
  );
  if (trigger) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        {sheetContent}
      </Sheet>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {sheetContent}
    </Sheet>
  );
}
