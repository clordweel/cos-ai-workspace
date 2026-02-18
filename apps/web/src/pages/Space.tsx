import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, LogOut, MessageCircle, RefreshCw, Settings, User } from 'lucide-react';
import { MOCK_SESSION_LIST, getMockMessagesForSession } from '@/data/mockSessions';
import type { MockSessionItem } from '@/data/mockSessions';
import { buildChatDisplayItems } from '@/components/chat/buildChatDisplayItems';
import { ChatPane } from '@/components/chat/ChatPane';
import { CreateSessionDialog } from '@/components/CreateSessionDialog';
import { SessionCategory } from '@/components/SessionCategory';
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
import { Frame, FramePanel } from '@/components/ui/frame';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUISettings } from '@/hooks/useUISettings';
import { useAppTabs } from '@/hooks/useAppTabs';
import { useContactsAndBots } from '@/hooks/useContactsAndBots';
import { AppTagsBar } from '@/components/app/AppTagsBar';
import { AppContent } from '@/components/app/AppContent';
import { getLastChatId, setLastChatId } from '@/lib/chatSessionStorage';
import { getEffectiveWorkspaceId, setLastWorkspaceId, createNewWorkspaceId } from '@/lib/workspaceStorage';
import { formatSessionDate } from '@/lib/time';

/**
 * 工作区页：/space 进入上次工作空间（无则默认公开工作区 public）并重定向到 /space/:id；
 * /space/:id 为主界面框架：会话区 + 操作区（对应 frontend 应用区），具体布局与容器查询后续设计。
 */
export default function Space() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, reAuthWithPopup, logout } = useAuth();
  const { uiFontSizeStep, setUIFontSizeStep, sessionAreaFontScale, FONT_STEP_MIN, FONT_STEP_MAX } = useUISettings();
  const [enterToSend, setEnterToSend] = useState(true);

  useEffect(() => {
    if (id != null && id.length > 0) {
      setLastWorkspaceId(id);
      return;
    }
    if (searchParams.get('create') === '1') {
      const newWorkspaceId = createNewWorkspaceId();
      setLastWorkspaceId(newWorkspaceId);
      navigate(`/space/${newWorkspaceId}`, { replace: true });
      return;
    }
    const targetId = getEffectiveWorkspaceId();
    navigate(`/space/${targetId}`, { replace: true });
  }, [id, navigate, searchParams]);

  const [listViewTab, setListViewTab] = useState<ListViewTab>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [pinnedCollapsed, setPinnedCollapsed] = useState(false);
  const [createSessionDialogOpen, setCreateSessionDialogOpen] = useState(false);
  const [customSessions, setCustomSessions] = useState<MockSessionItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatInputAreaHeightPx, setChatInputAreaHeightPx] = useState<number | null>(null);
  const [localMessagesByChat, setLocalMessagesByChat] = useState<Record<string, Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: number }>>>({});
  const [appTagsBarPinned, setAppTagsBarPinned] = useState(false);
  const [appAreaCollapsed, setAppAreaCollapsed] = useState(false);
  const [tagBarHovered, setTagBarHovered] = useState(false);
  const [reAuthLoading, setReAuthLoading] = useState(false);
  const isTagBarExpanded = appTagsBarPinned || tagBarHovered;

  const {
    tabs,
    activeTabId,
    activeTab,
    currentView,
    addTab,
    openView,
    closeTab,
    switchTab,
    closeAllTabs,
  } = useAppTabs({
    onOpenPanel: useCallback(() => setAppAreaCollapsed(false), []),
  });

  const { contacts, mentionItems } = useContactsAndBots();

  /** 在右侧应用区打开用户/认证视图（供个人中心空态按钮调用） */
  const openUserAppPanel = useCallback(() => {
    openView('profile');
  }, [openView]);

  /** 进入工作区时恢复上次打开的会话（仅恢复 mock 列表中的 id，自定义会话不持久化） */
  useEffect(() => {
    if (id == null || id.length === 0) return;
    const stored = getLastChatId(id);
    if (stored && MOCK_SESSION_LIST.some((s) => s.id === stored)) {
      setSelectedChatId(stored);
    }
  }, [id]);

  const prevAuthenticatedRef = useRef(false);
  /** 仅在「在 profile 标签内刚完成认证」时关闭应用区并切回首页 */
  useEffect(() => {
    const justLoggedIn = isAuthenticated && !prevAuthenticatedRef.current;
    prevAuthenticatedRef.current = isAuthenticated;
    if (currentView === 'profile' && justLoggedIn) {
      closeAllTabs();
      setAppAreaCollapsed(true);
    }
  }, [currentView, isAuthenticated, closeAllTabs]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setSelectedChatId(sessionId);
      if (id != null && id.length > 0) setLastChatId(id, sessionId);
    },
    [id]
  );

  const sessionsList = useMemo(
    () => [...MOCK_SESSION_LIST, ...customSessions],
    [customSessions]
  );

  const selectedSession = useMemo(
    () => (selectedChatId ? sessionsList.find((s) => s.id === selectedChatId) ?? null : null),
    [selectedChatId, sessionsList]
  );

  /** 参与会话者（排除当前用户），供顶栏左侧头像展示 */
  const participantsExcludingMe = useMemo(() => {
    const list = selectedSession?.participants ?? [];
    return list
      .filter((p) => {
        const isMe =
          (user?.name && p.name === user.name) ||
          (user?.email && p.name === user.email) ||
          (user?.avatar && (p as { avatar?: string }).avatar === user.avatar);
        return !isMe;
      })
      .map((p) => ({ id: undefined as string | undefined, name: p.name, avatar: p.avatar ?? null }));
  }, [selectedSession?.participants, user?.name, user?.email, user?.avatar]);

  const chatDisplayItems = useMemo(() => {
    if (!selectedChatId) return [];
    const fromMock = getMockMessagesForSession(selectedChatId);
    const local = localMessagesByChat[selectedChatId] ?? [];
    const combined = [...fromMock, ...local].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
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
    let list = sessionsList;
    if (sessionFilter !== 'all') {
      list = list.filter((s) => s.type === sessionFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessionsList, searchQuery, sessionFilter]);

  const { pinnedSessions, activeSessions } = useMemo(() => {
    const pinned: MockSessionItem[] = [];
    const active: MockSessionItem[] = [];
    const idSet = new Set(pinnedIds);
    for (const s of filteredSessions) {
      if (idSet.has(s.id)) pinned.push(s);
      else active.push(s);
    }
    return { pinnedSessions: pinned, activeSessions: active };
  }, [filteredSessions, pinnedIds]);

  const handleTogglePin = useCallback((sessionId: string) => {
    setPinnedIds((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    );
  }, []);

  const handleCreateSession = useCallback(
    (result: { mode: 'solo' } | { mode: 'contacts'; contactIds: string[] }) => {
      const now = Date.now();
      if (result.mode === 'solo') {
        const newSession: MockSessionItem = {
          id: `solo-${now}`,
          title: '我的笔记',
          type: 'private',
          participants: [],
          updatedAt: now,
        };
        setCustomSessions((prev) => [...prev, newSession]);
        setSelectedChatId(newSession.id);
        if (id) setLastChatId(id, newSession.id);
        return;
      }
      const selected = result.contactIds
        .map((cid) => contacts.find((c) => c.id === cid))
        .filter(Boolean) as { id: string; name: string; avatar?: string }[];
      if (selected.length === 0) return;
      const participants = selected.map((c) => ({ name: c.name, avatar: c.avatar }));
      const isGroup = selected.length > 1;
      const newSession: MockSessionItem = {
        id: `${isGroup ? 'group' : 'private'}-${now}`,
        title: selected.map((c) => c.name).join('、'),
        type: isGroup ? 'group' : 'private',
        participants,
        updatedAt: now,
      };
      setCustomSessions((prev) => [...prev, newSession]);
      setSelectedChatId(newSession.id);
      if (id) setLastChatId(id, newSession.id);
    },
    [contacts, id]
  );

  if (id == null || id.length === 0) {
    return null;
  }

  return (
    <PageGrid columns="minmax(0, 990px) 1fr" className="min-h-0 flex-1 px-4">
      <Frame
        className="min-h-0 flex-1 flex flex-col overflow-hidden rounded-3xl border border-border p-0 @container"
        style={{ containerName: 'session' } as React.CSSProperties}
      >
        <FramePanel className="min-h-0 flex-1 flex overflow-hidden rounded-2xl pl-2 pt-2 pb-2 pr-0 border-0 shadow-none before:shadow-none bg-[var(--session-frame-panel-bg)]">
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
                    searchQuery={searchQuery}
                    filter={sessionFilter}
                    onSearchQueryChange={setSearchQuery}
                    onFilterChange={setSessionFilter}
                    onNewChat={() => setCreateSessionDialogOpen(true)}
                  />
                </SidebarHeader>
              )}
              {listViewTab === 'active' ? (
                <div className="session-list-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24">
                  {filteredSessions.length > 0 ? (
                    <div className="flex flex-col min-h-0 min-w-0">
                      {pinnedSessions.length > 0 && (
                        <SessionCategory
                          title="置顶"
                          count={pinnedSessions.length}
                          collapsed={pinnedCollapsed}
                          onCollapsedChange={setPinnedCollapsed}
                          accent
                        >
                          {pinnedSessions.map((session) => (
                            <SessionListItem
                              key={session.id}
                              item={session}
                              isActive={session.id === selectedChatId}
                              isPinned
                              dateLabel={formatSessionDate(session.updatedAt)}
                              unreadCount={session.id === 'mock-private-lisi' ? 2 : 0}
                              onClick={() => handleSelectSession(session.id)}
                              onTogglePin={() => handleTogglePin(session.id)}
                            />
                          ))}
                        </SessionCategory>
                      )}
                      <ul className="divide-y divide-zinc-100 dark:divide-zinc-700">
                        {activeSessions.map((session) => (
                          <SessionListItem
                            key={session.id}
                            item={session}
                            isActive={session.id === selectedChatId}
                            isPinned={pinnedIds.includes(session.id)}
                            dateLabel={formatSessionDate(session.updatedAt)}
                            unreadCount={session.id === 'mock-private-lisi' ? 2 : 0}
                            onClick={() => handleSelectSession(session.id)}
                            onTogglePin={() => handleTogglePin(session.id)}
                          />
                        ))}
                      </ul>
                    </div>
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
                  {listViewTab === 'settings' && (
                    <SidebarMenu className="flex h-full flex-col">
                      <div className="session-list-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 text-[12px]">
                        <h2 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                          会话设置
                        </h2>
                        <Accordion defaultValue={['font-size', 'send-newline']} className="mb-2">
                          <AccordionItem value="font-size">
                            <AccordionTrigger className="text-[12px]">界面字体大小</AccordionTrigger>
                            <AccordionContent>
                              <p className="mb-3 text-[12px] text-muted-foreground">
                                仅调节聊天与输入框的字号。
                              </p>
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <span className="text-[12px] text-zinc-600 dark:text-zinc-300">当前档位</span>
                                <span className="tabular-nums text-[12px] font-medium text-zinc-700 dark:text-zinc-200">
                                  {uiFontSizeStep}
                                </span>
                              </div>
                              <Slider
                                value={[uiFontSizeStep]}
                                min={FONT_STEP_MIN}
                                max={FONT_STEP_MAX}
                                step={1}
                                className="mx-auto w-full max-w-[12rem]"
                                onValueChange={(v) => setUIFontSizeStep(Array.isArray(v) ? v[0] : v)}
                              />
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="send-newline">
                            <AccordionTrigger className="text-[12px]">发送与换行</AccordionTrigger>
                            <AccordionContent>
                              <p className="mb-3 text-[12px] text-muted-foreground">
                                Enter 换行时，使用 Ctrl+Enter 发送。
                              </p>
                              <Select
                                value={enterToSend ? 'enter' : 'enterNewline'}
                                onValueChange={(v) => setEnterToSend(v === 'enter')}
                                items={[
                                  { value: 'enter', label: 'Enter 发送' },
                                  { value: 'enterNewline', label: 'Enter 换行' },
                                ]}
                              >
                                <SelectTrigger size="sm" className="w-full max-w-[12rem] text-[12px]" aria-label="发送与换行">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectPopup alignItemWithTrigger={false}>
                                  <SelectItem value="enter">Enter 发送</SelectItem>
                                  <SelectItem value="enterNewline">Enter 换行</SelectItem>
                                </SelectPopup>
                              </Select>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
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
                currentUserAvatar={user?.avatar}
                currentUserName={user?.name ?? user?.email}
                participants={participantsExcludingMe}
                displayItems={chatDisplayItems}
                input={chatInput}
                onInputChange={setChatInput}
                onSubmit={handleChatSubmit}
                mentionItems={mentionItems}
                onClose={() => setSelectedChatId(null)}
                showBack={false}
                enterToSend={enterToSend}
                sessionAreaFontScale={sessionAreaFontScale}
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
        <FramePanel className="min-h-0 flex-1 flex overflow-hidden rounded-2xl p-2 border-0 shadow-none before:shadow-none bg-zinc-100 dark:bg-zinc-800/50">
          <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden rounded-2xl bg-transparent">
            <AppTagsBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSwitchTab={switchTab}
              onCloseTab={closeTab}
              onNewTab={() => addTab('home')}
              onOpenProfile={() => openView('profile')}
              isTagBarExpanded={isTagBarExpanded}
              appAreaCollapsed={appAreaCollapsed}
              onToggleCollapse={setAppAreaCollapsed}
              appTagsBarPinned={appTagsBarPinned}
              onTogglePin={setAppTagsBarPinned}
              onMouseEnter={() => setTagBarHovered(true)}
              onMouseLeave={() => setTagBarHovered(false)}
              user={user}
            />
            <main
              className="min-h-0 min-w-0 flex-1 overflow-auto rounded-2xl border border-border bg-white dark:bg-background"
              aria-label="应用内容区"
            >
              <AppContent
                activeTab={activeTab}
                user={user}
                reAuthLoading={reAuthLoading}
                onReAuth={() => {
                  setReAuthLoading(true);
                  reAuthWithPopup()
                    .finally(() => setReAuthLoading(false))
                    .catch(() => {});
                }}
                onLogout={logout}
              />
            </main>
          </div>
        </FramePanel>
      </Frame>
      <CreateSessionDialog
        open={createSessionDialogOpen}
        onOpenChange={setCreateSessionDialogOpen}
        contacts={contacts}
        onConfirm={handleCreateSession}
      />
    </PageGrid>
  );
}
