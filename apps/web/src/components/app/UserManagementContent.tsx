'use client';

import { Loader2, Users } from 'lucide-react';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/** 用户管理：列表来自 GET /api/admin/users（Logto Management API 代理） */
export function UserManagementContent() {
  const { users, totalCount, loading, error, refetch } = useAdminUsers({ page_size: 50 });

  return (
    <div className="flex min-h-full flex-col p-4">
      <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
        <Users className="h-4 w-4" aria-hidden />
        用户管理
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        查看与管理用户（数据来自 Logto，仅系统管理员可访问）。
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
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">暂无用户数据</p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">用户名 / 姓名</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>手机</TableHead>
                    <TableHead>角色</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.name || u.username || u.id.slice(0, 8) + '…'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {u.primaryEmail ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {u.primaryPhone ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {u.roleNames?.length ? u.roleNames.join(', ') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {totalCount > 0 && (
            <p className="text-xs text-muted-foreground mt-2">共 {totalCount} 条</p>
          )}
        </>
      )}
    </div>
  );
}
