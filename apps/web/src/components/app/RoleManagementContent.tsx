'use client';

import { useState } from 'react';
import { Loader2, UserMinus } from 'lucide-react';
import { useAdminRoles } from '@/hooks/useAdminRoles';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** 角色管理：列表来自 GET /api/admin/roles；支持分配用户、从角色移除用户 */
export function RoleManagementContent() {
  const { roles, loading, error, refetch, assignRoleToUsers, removeRoleFromUser } = useAdminRoles();
  const [assignRoleId, setAssignRoleId] = useState<string | null>(null);
  const [assignRoleName, setAssignRoleName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const { users, loading: usersLoading, refetch: refetchUsers } = useAdminUsers({ page_size: 100 });
  const openAssign = (id: string, name: string) => {
    setAssignRoleId(id);
    setAssignRoleName(name);
    setSelectedUserIds(new Set());
  };

  const handleAssign = async () => {
    if (!assignRoleId) return;
    setSubmitting(true);
    try {
      const ok = await assignRoleToUsers(assignRoleId, Array.from(selectedUserIds));
      if (ok) {
        setAssignRoleId(null);
        refetchUsers();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveFromRole = async (userId: string) => {
    if (!assignRoleId) return;
    setRemovingUserId(userId);
    try {
      const ok = await removeRoleFromUser(assignRoleId, userId);
      if (ok) refetchUsers();
    } finally {
      setRemovingUserId(null);
    }
  };

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const currentMembers = assignRoleName
    ? users.filter((u) => u.roleNames?.includes(assignRoleName))
    : [];
  const usersNotInRole = users.filter((u) => !currentMembers.some((m) => m.id === u.id));

  return (
    <div className="flex min-h-full flex-col p-4">
      {error && (
        <p className="text-sm text-destructive mb-2" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        </div>
      ) : (
        <>
          {roles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">暂无角色数据</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {roles.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-4 py-2.5"
                >
                  <div>
                    <span className="font-medium text-foreground">{r.name}</span>
                    {r.description && (
                      <p className="text-muted-foreground mt-0.5">{r.description}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openAssign(r.id, r.name)}
                  >
                    分配用户
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Dialog open={Boolean(assignRoleId)} onOpenChange={(open) => !open && setAssignRoleId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>分配用户至「{assignRoleName}」</DialogTitle>
          </DialogHeader>
          {currentMembers.length > 0 && (
            <div className="py-2">
              <Label className="text-xs text-muted-foreground">当前成员（可从角色移除）</Label>
              <ul className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {currentMembers.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
                  >
                    <span className="min-w-0 truncate">
                      {u.name || u.username || u.primaryEmail || u.id.slice(0, 8)}
                      {u.primaryEmail && (
                        <span className="ml-1 text-muted-foreground truncate">
                          {u.primaryEmail}
                        </span>
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveFromRole(u.id)}
                      disabled={removingUserId === u.id}
                    >
                      {removingUserId === u.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <UserMinus className="h-3.5 w-3.5" aria-hidden />
                      )}
                      <span className="sr-only">从角色移除</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="py-2">
            <Label className="text-xs text-muted-foreground">添加用户（可多选）</Label>
            {usersLoading ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                加载用户列表…
              </div>
            ) : (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {usersNotInRole.length === 0 ? (
                  <li className="px-3 py-4 text-xs text-muted-foreground text-center">
                    暂无其他用户可添加
                  </li>
                ) : (
                usersNotInRole.map((u) => (
                  <li key={u.id}>
                    <label
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/50 text-xs',
                        selectedUserIds.has(u.id) && 'bg-muted/80'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(u.id)}
                        onChange={() => toggleUser(u.id)}
                        className="rounded border-input"
                      />
                      <span>{u.name || u.username || u.primaryEmail || u.id.slice(0, 8)}</span>
                      {u.primaryEmail && (
                        <span className="text-muted-foreground truncate">
                          {u.primaryEmail}
                        </span>
                      )}
                    </label>
                  </li>
                ))
                )}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAssignRoleId(null)}>
              取消
            </Button>
            <Button
              type="button"
              disabled={submitting || selectedUserIds.size === 0}
              onClick={handleAssign}
            >
              {submitting ? '提交中…' : `确定（已选 ${selectedUserIds.size} 人）`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
