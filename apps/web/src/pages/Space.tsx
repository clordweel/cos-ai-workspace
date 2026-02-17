import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Archive, Home, LogOut, MessageCircle, PanelRightClose, Pin, Plus, RefreshCw, User, Users } from 'lucide-react';
import { MOCK_SESSION_LIST, getMockMessagesForSession } from '@/data/mockSessions';
import type { MockSessionItem } from '@/data/mockSessions';
import { buildChatDisplayItems } from '@/components/chat/buildChatDisplayItems';
import { ChatPane } from '@/components/chat/ChatPane';
import { SessionListItem } from '@/components/SessionListItem';
import { PageGrid } from '@/components/layout/PageGrid';
import {
  SessionListBottomNav,
  type ListViewTab,
} from '@/components/SessionListBottomNav';
import {
  SessionListHeader,
  type SessionFilter,
} from '@/components/SessionListHeader';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyContent,
} from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import { AuthPanel } from '@/components/AuthPanel';
import { Frame, FramePanel } from '@/components/ui/frame';
import { Toggle } from '@/components/ui/toggle';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { getEffectiveWorkspaceId, setLastWorkspaceId } from '@/lib/workspaceStorage';

function formatSessionDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return '今天';
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 工作区页：/space 进入上次工作空间（无则默认公开工作区）并重定向到 /space/:id；
 * /space/:id 为主界面框架：会话区 + 操作区（对应 frontend 应用区），具体布局与容器查询后续设计。
 */
export default function Space() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, reAuthWithPopup, logout } = useAuth();

  useEffect(() => {
    if (id != null && id.length > 0) {
      setLastWorkspaceId(id);
      return;
    }
    const targetId = getEffectiveWorkspaceId();
    navigate(`/space/${targetId}`, { replace: true });
  }, [id, navigate]);

  const [listViewTab, setListViewTab] = useState<ListViewTab>('active');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatInputAreaHeightPx, setChatInputAreaHeightPx] = useState<number | null>(null);
  const [localMessagesByChat, setLocalMessagesByChat] = useState<Record<string, Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: number }>>>({});
  const [appTagsBarPinned, setAppTagsBarPinned] = useState(false);
  const [appAreaCollapsed, setAppAreaCollapsed] = useState(false);
  const [tagBarHovered, setTagBarHovered] = useState(false);
  const [activeAppTab, setActiveAppTab] = useState<string>('home');
  const [reAuthLoading, setReAuthLoading] = useState(false);
  const isTagBarExpanded = appTagsBarPinned || tagBarHovered;

  /** 在右侧应用区打开用户/认证视图（供个人中心空态按钮调用） */
  const openUserAppPanel = useCallback(() => {
    setActiveAppTab('me');
    setAppAreaCollapsed(false);
  }, []);

  const prevAuthenticatedRef = useRef(false);
  /** 仅在「在 me 标签内刚完成认证」时关闭应用区并切回首页；已登录时再点开用户项不关闭 */
  useEffect(() => {
    const justLoggedIn = isAuthenticated && !prevAuthenticatedRef.current;
    prevAuthenticatedRef.current = isAuthenticated;
    if (activeAppTab === 'me' && justLoggedIn) {
      setActiveAppTab('home');
      setAppAreaCollapsed(true);
    }
  }, [activeAppTab, isAuthenticated]);

  const selectedSession = useMemo(
    () => (selectedChatId ? MOCK_SESSION_LIST.find((s) => s.id === selectedChatId) ?? null : null),
    [selectedChatId]
  );

  const chatDisplayItems = useMemo(() => {
    if (!selectedChatId) return [];
    const fromMock = getMockMessagesForSession(selectedChatId);
    const local = localMessagesByChat[selectedChatId] ?? [];
    const combined = [...fromMock, ...local].sort((a, b) => a.createdAt - b.createdAt);
    return buildChatDisplayItems(combined);
  }, [selectedChatId, localMessagesByChat]);

  const handleChatSubmit = useCallback(() => {
    const text = chatInput.trim();
    if (!text || !selectedChatId) return;
    const msg = { id: `local-${Date.now()}`, role: 'user' as const, content: text, createdAt: Date.now() };
    setLocalMessagesByChat((prev) => ({
      ...prev,
      [selectedChatId]: [...(prev[selectedChatId] ?? []), msg],
    }));
    setChatInput('');
  }, [selectedChatId, chatInput]);

  const filteredSessions = useMemo((): MockSessionItem[] => {
    let list = MOCK_SESSION_LIST;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => s.title.toLowerCase().includes(q));
    }
    if (sessionFilter === 'recent') {
      list = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return list;
  }, [searchQuery, sessionFilter]);

  if (id == null || id.length === 0) {
    return null;
  }

  return (
    <PageGrid columns="minmax(0, 990px) 1fr" className="min-h-0 flex-1 px-4">
      <Frame
        className="min-h-0 flex-1 flex flex-col overflow-hidden rounded-3xl border border-border p-0 @container"
        style={{ containerName: 'session' } as React.CSSProperties}
      >
        <FramePanel className="min-h-0 flex-1 flex overflow-hidden rounded-2xl pl-3 pt-3 pb-3 pr-0 border-0 shadow-none before:shadow-none bg-zinc-100 dark:bg-zinc-800/50">
            <SidebarProvider
              className="min-h-0 flex-1 flex w-full flex-row"
              style={{ '--sidebar-width': '18rem' } as React.CSSProperties}
            >
              <div className="relative flex min-h-0 shrink-0 flex-col rounded-2xl border border-border bg-white dark:bg-background">
            <Sidebar
              collapsible="none"
              side="left"
              className="rounded-2xl bg-transparent"
            >
              {listViewTab === 'active' && (
                <SidebarHeader className="border-none p-0">
                  <SessionListHeader
                    searchOpen={searchOpen}
                    searchQuery={searchQuery}
                    filter={sessionFilter}
                    onSearchOpenChange={setSearchOpen}
                    onSearchQueryChange={setSearchQuery}
                    onFilterChange={setSessionFilter}
                  />
                </SidebarHeader>
              )}
              {listViewTab === 'active' ? (
                <div className="session-list-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24">
                  {filteredSessions.length > 0 ? (
                    <ul className="divide-y divide-zinc-100 dark:divide-zinc-700">
                      {filteredSessions.map((session) => (
                        <SessionListItem
                          key={session.id}
                          item={session}
                          isActive={session.id === selectedChatId}
                          dateLabel={formatSessionDate(session.updatedAt)}
                          unreadCount={session.id === 'mock-private-lisi' ? 2 : 0}
                          onClick={() => setSelectedChatId(session.id)}
                        />
                      ))}
                    </ul>
                  ) : (
                    <Empty className="min-h-[12rem] justify-center py-8">
                      <EmptyHeader>
                        <EmptyTitle className="text-sm font-medium">
                          {searchQuery.trim() ? '无匹配会话' : '暂无会话'}
                        </EmptyTitle>
                        <EmptyDescription className="text-xs mt-1">
                          {searchQuery.trim() ? '试试其它关键词' : '在左侧选择已有会话开始聊天'}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </div>
              ) : (
                <SidebarContent className="min-h-0 flex-1 overflow-hidden">
                  {listViewTab === 'contacts' && (
                    <SidebarMenu className="flex h-full flex-col">
                      <div className="session-list-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
                        <Empty className="min-h-[12rem] justify-center py-8">
                          <EmptyHeader>
                            <EmptyMedia variant="icon" className="size-16 p-3 text-zinc-300 dark:text-zinc-600 [&_svg]:!size-10">
                              <Users strokeWidth={1.5} aria-hidden />
                            </EmptyMedia>
                            <EmptyTitle className="text-sm font-medium">暂无联系人</EmptyTitle>
                          </EmptyHeader>
                        </Empty>
                      </div>
                    </SidebarMenu>
                  )}
                  {listViewTab === 'favorites' && (
                    <SidebarMenu className="flex h-full flex-col">
                      <div className="session-list-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
                        <Empty className="min-h-[12rem] justify-center py-8">
                          <EmptyHeader>
                            <EmptyMedia variant="icon" className="size-16 p-3 text-zinc-300 dark:text-zinc-600 [&_svg]:!size-10">
                              <Archive strokeWidth={1.5} aria-hidden />
                            </EmptyMedia>
                            <EmptyTitle className="text-sm font-medium">暂无收藏</EmptyTitle>
                          </EmptyHeader>
                        </Empty>
                      </div>
                    </SidebarMenu>
                  )}
                  {listViewTab === 'me' && (
                    <SidebarMenu className="flex h-full flex-col">
                      <div className="session-list-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
                        {user ? (
                          <div className="flex flex-col items-center gap-3 px-3 py-6">
                            <Avatar className="h-16 w-16">
                              {user.avatar ? (
                                <AvatarImage src={user.avatar} alt={user.name} />
                              ) : null}
                              <AvatarFallback className="text-lg">
                                {user.name?.slice(0, 1) ?? '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
                              <span className="truncate text-sm font-medium text-foreground">
                                {user.name}
                              </span>
                              {user.email ? (
                                <span className="truncate text-xs text-muted-foreground">
                                  {user.email}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex w-full flex-col gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full gap-1.5"
                                disabled={reAuthLoading}
                                onClick={() => {
                                  setReAuthLoading(true);
                                  reAuthWithPopup()
                                    .finally(() => setReAuthLoading(false))
                                    .catch(() => {});
                                }}
                              >
                                <RefreshCw className={cn('h-3.5 w-3.5', reAuthLoading && 'animate-spin')} aria-hidden />
                                {reAuthLoading ? '正在打开…' : '重新授权 / 更换账号'}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="w-full gap-1.5 text-muted-foreground hover:text-foreground"
                                onClick={() => logout()}
                              >
                                <LogOut className="h-3.5 w-3.5" aria-hidden />
                                退出登录
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Empty className="min-h-[12rem] justify-center py-8">
                            <EmptyHeader>
                              <EmptyMedia variant="icon" className="size-16 p-3 text-zinc-300 dark:text-zinc-600 [&_svg]:!size-10">
                                <User strokeWidth={1.5} aria-hidden />
                              </EmptyMedia>
                              <EmptyTitle className="text-sm font-medium">未登录</EmptyTitle>
                            </EmptyHeader>
                            <EmptyContent>
                              <Button
                                type="button"
                                onClick={openUserAppPanel}
                                className="w-full sm:w-auto"
                              >
                                认证登录
                              </Button>
                            </EmptyContent>
                          </Empty>
                        )}
                      </div>
                    </SidebarMenu>
                  )}
                </SidebarContent>
              )}
              <SidebarFooter className="relative shrink-0 p-0">
                <SessionListBottomNav
                  value={listViewTab}
                  onChange={setListViewTab}
                  userAvatar={user?.avatar}
                  userName={user?.name}
                />
              </SidebarFooter>
            </Sidebar>
          </div>
          <SidebarInset className="min-h-0 min-w-0 flex-1 rounded-r-2xl bg-transparent overflow-hidden">
            {selectedSession ? (
              <ChatPane
                chatTitle={selectedSession.title}
                chatUserAvatar={selectedSession.participants?.[0]?.avatar ?? null}
                chatUserName={selectedSession.participants?.[0]?.name ?? selectedSession.title}
                displayItems={chatDisplayItems}
                input={chatInput}
                onInputChange={setChatInput}
                onSubmit={handleChatSubmit}
                onClose={() => setSelectedChatId(null)}
                showBack={false}
                inputAreaHeightPx={chatInputAreaHeightPx}
                onInputAreaHeightChange={setChatInputAreaHeightPx}
              />
            ) : (
              <Empty className="h-full p-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="size-16 p-3 text-zinc-300 dark:text-zinc-600 [&_svg]:!size-10">
                    <MessageCircle strokeWidth={1.5} aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle className="text-base font-medium">还没有会话</EmptyTitle>
                  <EmptyDescription className="text-sm">
                    在左侧选择已有会话开始聊天
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </SidebarInset>
        </SidebarProvider>
        </FramePanel>
      </Frame>
      <Frame
        className="min-h-0 flex-1 flex max-w-full flex-col overflow-hidden rounded-3xl border border-border p-0 @container"
        style={{ containerName: 'app' } as React.CSSProperties}
      >
        <FramePanel className="min-h-0 flex-1 flex overflow-hidden rounded-2xl p-3 border-0 shadow-none before:shadow-none bg-zinc-100 dark:bg-zinc-800/50">
          <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden rounded-2xl bg-transparent">
            <aside
              className={cn(
                'group flex shrink-0 flex-col overflow-hidden rounded-l-2xl bg-transparent pr-2 transition-[width] duration-200 ease-out',
                appTagsBarPinned ? 'w-[220px]' : 'w-[52px] hover:w-[220px]'
              )}
              aria-label="应用标签栏"
              onMouseEnter={() => setTagBarHovered(true)}
              onMouseLeave={() => setTagBarHovered(false)}
            >
              <div
                className={cn(
                  'flex shrink-0 items-center gap-1 px-2 pb-2 pt-2',
                  isTagBarExpanded ? 'justify-between' : 'justify-center'
                )}
              >
                <Toggle
                  pressed={appAreaCollapsed}
                  onPressedChange={setAppAreaCollapsed}
                  size="sm"
                  className="rounded-md p-1 text-black dark:text-white"
                  aria-label={appAreaCollapsed ? '展开应用区' : '折叠应用区'}
                  title={appAreaCollapsed ? '展开应用区' : '折叠应用区'}
                >
                  <PanelRightClose className="h-4 w-4" aria-hidden />
                </Toggle>
                {isTagBarExpanded && (
                  <Toggle
                    pressed={appTagsBarPinned}
                    onPressedChange={setAppTagsBarPinned}
                    size="sm"
                    className="rounded-md p-1 text-black dark:text-white"
                    aria-label={appTagsBarPinned ? '取消固定标签栏' : '固定标签栏'}
                    title={appTagsBarPinned ? '取消固定标签栏' : '固定标签栏'}
                  >
                    <Pin
                      className={cn('h-4 w-4', appTagsBarPinned && '-rotate-45')}
                      aria-hidden
                    />
                  </Toggle>
                )}
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <button
                    type="button"
                    onClick={() => setActiveAppTab('home')}
                    className={cn(
                      'flex h-8 w-full cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-left text-[12px] font-medium text-black transition-colors dark:text-white',
                      'hover:bg-zinc-200 dark:hover:bg-zinc-600/90',
                      isTagBarExpanded ? 'min-w-0 justify-start' : 'justify-center px-2',
                      activeAppTab === 'home' && 'bg-zinc-100 dark:bg-zinc-800/80'
                    )}
                  >
                    <Home className="h-4 w-4 shrink-0" aria-hidden />
                    {isTagBarExpanded && <span className="truncate">首页</span>}
                  </button>
                </div>
                <div className="shrink-0 border-t-2 border-border pt-1 space-y-0.5">
                  <button
                    type="button"
                    className={cn(
                      'flex h-8 w-full cursor-pointer items-center gap-2 text-left text-[12px] text-black transition-colors dark:text-white',
                      'hover:bg-zinc-200 dark:hover:bg-zinc-600/90',
                      isTagBarExpanded ? 'justify-start rounded-[11px] px-3' : 'justify-center rounded-[46px] px-2'
                    )}
                  >
                    <Plus className="h-4 w-4 shrink-0" aria-hidden />
                    {isTagBarExpanded && <span className="truncate">创建新标签</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveAppTab('me'); setAppAreaCollapsed(false); }}
                    className={cn(
                      'flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-left text-[12px] font-medium text-black transition-colors dark:text-white',
                      isTagBarExpanded ? 'min-w-0 justify-start' : 'justify-center px-2',
                      activeAppTab === 'me' && 'bg-zinc-100 dark:bg-zinc-800/80'
                    )}
                    aria-label={user ? '用户配置' : '登录'}
                  >
                    {user ? (
                      <>
                        <Avatar className="h-5 w-5 shrink-0 ring-2 ring-white">
                          {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
                          <AvatarFallback className="text-[10px]">{user.name?.slice(0, 1) ?? '?'}</AvatarFallback>
                        </Avatar>
                        {isTagBarExpanded && <span className="truncate">{user.name || user.email || '用户'}</span>}
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4 shrink-0" aria-hidden />
                        {isTagBarExpanded && <span className="truncate">未登录</span>}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </aside>
            <main
              className="min-h-0 min-w-0 flex-1 overflow-auto rounded-2xl border border-border bg-white dark:bg-background"
              aria-label="应用内容区"
            >
              {activeAppTab === 'me' ? (
                user ? (
                  <div className="flex min-h-full flex-col items-center p-6">
                    <Avatar className="h-16 w-16">
                      {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
                      <AvatarFallback className="text-lg">{user.name?.slice(0, 1) ?? '?'}</AvatarFallback>
                    </Avatar>
                    <div className="mt-3 flex min-w-0 flex-col items-center gap-0.5 text-center">
                      <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
                      {user.email ? (
                        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                      ) : null}
                    </div>
                    <div className="mt-6 flex w-full max-w-sm flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5"
                        disabled={reAuthLoading}
                        onClick={() => {
                          setReAuthLoading(true);
                          reAuthWithPopup()
                            .finally(() => setReAuthLoading(false))
                            .catch(() => {});
                        }}
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', reAuthLoading && 'animate-spin')} aria-hidden />
                        {reAuthLoading ? '正在打开…' : '重新授权 / 更换账号'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full gap-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() => logout()}
                      >
                        <LogOut className="h-3.5 w-3.5" aria-hidden />
                        退出登录
                      </Button>
                    </div>
                  </div>
                ) : (
                  <AuthPanel className="min-h-full" />
                )
              ) : (
                <div className="min-h-full p-4" />
              )}
            </main>
          </div>
        </FramePanel>
      </Frame>
    </PageGrid>
  );
}
