'use client';

import { useState, useCallback } from 'react';
import { Loader2, Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const PAGE_SIZE = 20;

/** 用户管理：列表来自 GET /api/admin/users（Logto Management API 代理），支持搜索与分页 */
export function UserManagementContent() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const { users, totalCount, loading, error, refetch } = useAdminUsers({
    page: page - 1,
    page_size: PAGE_SIZE,
    search: search || undefined,
  });

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex min-h-full flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="搜索用户名、邮箱…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-8 w-48 pl-8 text-sm"
              aria-label="搜索用户"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="h-8">
            搜索
          </Button>
        </form>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1"
          onClick={() => refetch()}
          disabled={loading}
        >
          <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} aria-hidden />
          刷新
        </Button>
      </div>

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
            <p className="text-sm text-muted-foreground py-6">
              {search ? '未找到匹配用户' : '暂无用户数据'}
            </p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table className="text-[11px]">
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
                      <TableCell className="text-muted-foreground">
                        {u.primaryEmail ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.primaryPhone ?? '—'}
                      </TableCell>
                      <TableCell>
                        {u.roleNames?.length ? u.roleNames.join(', ') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              共 {totalCount} 条
              {totalPages > 1 && ` · 第 ${page} / ${totalPages} 页`}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!hasPrev}
                  aria-label="上一页"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={!hasNext}
                  aria-label="下一页"
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
