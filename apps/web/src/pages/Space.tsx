import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { MOCK_SESSION_LIST, getMockMessagesForSession } from '@/data/mockSessions';
import type { MockSessionItem } from '@/data/mockSessions';
import { buildChatDisplayItems } from '@/components/chat/buildChatDisplayItems';
import { ChatPane } from '@/components/chat/ChatPane';
import { SessionListItem } from '@/components/SessionListItem';
import { Block } from '@/components/layout/Block';
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from '@/components/ui/sidebar';
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
  const { user } = useAuth();

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
    <PageGrid className="min-h-0 flex-1 px-4">
      <Block
        containerName="session"
        className="flex flex-col rounded-3xl border border-border bg-zinc-100 pl-3 pt-3 pb-3 dark:bg-zinc-800/50"
      >
        <SidebarProvider
          className="min-h-0 flex-1 flex w-full flex-row"
          style={{ '--sidebar-width': '18rem' } as React.CSSProperties}
        >
          <div className="relative flex min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:bg-background dark:shadow-none">
            <Sidebar
              collapsible="none"
              side="left"
              className="rounded-2xl bg-transparent"
            >
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
                    <div className="flex min-h-[12rem] flex-col items-center justify-center py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        {searchQuery.trim() ? '无匹配会话' : '暂无会话'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {searchQuery.trim() ? '试试其它关键词' : ''}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <SidebarContent className="min-h-0 flex-1 overflow-hidden">
                  {listViewTab === 'contacts' && (
                    <SidebarMenu className="flex h-full flex-col">
                      <div className="px-2 py-3 text-sm text-muted-foreground">联系人</div>
                      {/* 联系人列表待实现 */}
                    </SidebarMenu>
                  )}
                  {listViewTab === 'favorites' && (
                    <SidebarMenu className="flex h-full flex-col">
                      <div className="px-2 py-3 text-sm text-muted-foreground">收藏列表</div>
                      {/* 收藏待实现 */}
                    </SidebarMenu>
                  )}
                  {listViewTab === 'me' && (
                    <SidebarMenu className="flex h-full flex-col">
                      <div className="px-2 py-3 text-sm text-muted-foreground">个人中心</div>
                      {/* 个人中心待实现 */}
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
              <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                  <MessageCircle className="size-7" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-base font-medium text-foreground">还没有会话</p>
                  <p className="text-sm text-muted-foreground">
                    在左侧选择已有会话开始聊天
                  </p>
                </div>
              </div>
            )}
          </SidebarInset>
        </SidebarProvider>
      </Block>
      <Block
        containerName="app"
        className="flex flex-col rounded-3xl border border-border bg-zinc-100 p-3 dark:bg-zinc-800/50"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white p-3 dark:bg-background">
          <div className="text-sm font-medium text-muted-foreground">操作区</div>
          {/* 对应 frontend 应用区：标签、侧栏、内容区等待设计 */}
        </div>
      </Block>
    </PageGrid>
  );
}
