'use client';

import { useState } from 'react';
import { Loader2, UserCog } from 'lucide-react';
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

/** 角色管理：列表来自 GET /api/admin/roles；支持「分配用户」到角色 */
export function RoleManagementContent() {
  const { roles, loading, error, refetch, assignRoleToUsers } = useAdminRoles();
  const [assignRoleId, setAssignRoleId] = useState<string | null>(null);
  const [assignRoleName, setAssignRoleName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const { users, loading: usersLoading } = useAdminUsers({ page_size: 100 });
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
      if (ok) setAssignRoleId(null);
    } finally {
      setSubmitting(false);
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

  return (
    <div className="flex min-h-full flex-col p-4">
      <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
        <UserCog className="h-4 w-4" aria-hidden />
        角色管理
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        查看角色与权限；可将用户分配至角色（数据来自 Logto，仅系统管理员可访问）。
      </p>

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
            <ul className="space-y-2">
              {roles.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-4 py-3"
                >
                  <div>
                    <span className="text-sm font-medium text-foreground">{r.name}</span>
                    {r.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
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
          <div className="py-2">
            <Label className="text-xs text-muted-foreground">选择用户（可多选）</Label>
            {usersLoading ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                加载用户列表…
              </div>
            ) : (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {users.map((u) => (
                  <li key={u.id}>
                    <label
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 text-sm',
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
                        <span className="text-xs text-muted-foreground truncate">
                          {u.primaryEmail}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
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
