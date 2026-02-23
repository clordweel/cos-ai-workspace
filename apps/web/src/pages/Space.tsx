import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, LogOut, MessageCircle, RefreshCw, Settings, User } from 'lucide-react';
import { buildChatDisplayItems } from '@/components/chat/buildChatDisplayItems';
import type { ChatMessageItem } from '@/components/chat/chatMessageTypes';
import { ChatPane } from '@/components/chat/ChatPane';
import { CreateSessionDialog } from '@/components/CreateSessionDialog';
import { InvitedSessionRow } from '@/components/InvitedSessionRow';
import { SessionCategory } from '@/components/SessionCategory';
import { SessionMembersSheet } from '@/components/SessionMembersSheet';
import { SessionListItem, type SessionListEntry } from '@/components/SessionListItem';
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
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUISettings } from '@/hooks/useUISettings';
import { useAppTabs } from '@/hooks/useAppTabs';
import { useContactsAndBots } from '@/hooks/useContactsAndBots';
import { useSessions } from '@/hooks/useSessions';
import { useMessages } from '@/hooks/useMessages';
import { useChatStream } from '@/hooks/useChatStream';
import { useChatSendMachine } from '@/hooks/useChatSendMachine';
import { useInvitedSessions } from '@/hooks/useInvitedSessions';
import { useMatrixSyncClient } from '@/hooks/useMatrixSyncClient';
import { useRoomMentionItems } from '@/hooks/useRoomMentionItems';
import { useSessionMembers } from '@/hooks/useSessionMembers';
import { AppTagsBar } from '@/components/app/AppTagsBar';
import { AppContent } from '@/components/app/AppContent';
import { getStreamPhaseLabel, isAiAssistantSender, AI_ASSISTANT_LABEL as assistantLabel } from '@/components/chat/assistantConstants';
import { getAuthParam } from '@/lib/authParam';
import { getLastChatId, setLastChatId } from '@/lib/chatSessionStorage';
import { getEffectiveWorkspaceId, setLastWorkspaceId, createNewWorkspaceId } from '@/lib/workspaceStorage';
import { formatSessionDate } from '@/lib/time';
import { toastManager } from '@/components/ui/toast';
import { AssociationProvider, useAssociationOptional } from '@/contexts/AssociationContext';
import { toAssociationPayload } from '@/types/associations';
import { serializeSegmentsToMessageBody } from '@/types/messageSegments';

/**
 * 工作区页：/space 进入上次工作空间（无则默认公开工作区 public）并重定向到 /space/:id；
 * /space/:id 为主界面框架：会话区 + 操作区（对应 frontend 应用区），具体布局与容器查询后续设计。
 */
function SpaceContent() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, reAuthWithPopup, logout, matrixSyncToken, matrixBaseUrl, matrixUserId, matrixDeviceId, fetchUser } = useAuth();
  const { uiFontSizeStep, setUIFontSizeStep, sessionAreaFontScale, FONT_STEP_MIN, FONT_STEP_MAX } = useUISettings();
  const [enterToSend, setEnterToSend] = useState(true);
  const association = useAssociationOptional();

  /** 认证回调后：先等 Cookie 落盘再拉用户（延迟 + 重试），成功后再清理 URL，保证个人中心立即有数据 */
  useEffect(() => {
    if (getAuthParam() !== 'ok') return;
    const clearUrl = () => {
      navigate('/space', { replace: true });
      window.history.replaceState(null, '', `${window.location.origin}/#/space`);
    };
    // 首请求延迟 500ms，再 401 则 800ms、1.2s 各重试一次，避免 302 Set-Cookie 尚未生效
    const initialDelayMs = 500;
    const retryDelaysMs = [800, 1200];
    let retryIdx = 0;
    const tryFetch = (): Promise<void> => {
      return fetchUser().then((ok) => {
        if (ok) {
          clearUrl();
          return;
        }
        if (retryIdx < retryDelaysMs.length) {
          const delay = retryDelaysMs[retryIdx]!;
          retryIdx += 1;
          return new Promise((r) => setTimeout(r, delay)).then(tryFetch);
        }
        clearUrl();
      });
    };
    const t = setTimeout(tryFetch, initialDelayMs);
    return () => clearTimeout(t);
  }, [fetchUser, navigate]);

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
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatInputAreaHeightPx, setChatInputAreaHeightPx] = useState<number | null>(null);
  const [appTagsBarPinned, setAppTagsBarPinned] = useState(false);
  const [appAreaCollapsed, setAppAreaCollapsed] = useState(false);
  const [tagBarHovered, setTagBarHovered] = useState(false);
  const [reAuthLoading, setReAuthLoading] = useState(false);
  const [invitedAccepting, setInvitedAccepting] = useState<string | null>(null);
  const [invitedDeclining, setInvitedDeclining] = useState<string | null>(null);
  const [membersSheetOpen, setMembersSheetOpen] = useState(false);
  const [sessionAreaContainer, setSessionAreaContainer] = useState<HTMLDivElement | null>(null);
  /** 删除/退出确认：{ sessionId, isCreator, error? }；打开前先请求 creator 接口；失败时保留弹窗并设 error */
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    sessionId: string;
    isCreator: boolean;
    error?: string;
  } | null>(null);
  const [deleteConfirmLoading, setDeleteConfirmLoading] = useState(false);
  const [deleteConfirmSubmitting, setDeleteConfirmSubmitting] = useState(false);
  /** 重命名会话：{ sessionId, title }；弹层在会话区内 */
  const [renameState, setRenameState] = useState<{ sessionId: string; title: string } | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  /** Dify 流阶段（由 useChatStream 内状态机驱动），便于 UI 展示思考中/流式中/正在调用工具 */
  const [streamPhase, setStreamPhase] = useState<string>('idle');
  const isTagBarExpanded = appTagsBarPinned || tagBarHovered;

  const { sessions, loading: sessionsLoading, error: sessionsError, fetchSessions, createSession, addOrUpdateSession } = useSessions();
  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    fetchMessages,
    appendStreamingContent,
    commitStreamingMessage,
    appendStreamingThinking,
    setStreamingThinking,
    appendUserMessage,
    discardStreamingMessage,
    appendWaitingAssistant,
  } = useMessages(selectedChatId ?? undefined);
  const { streamChat } = useChatStream();
  const { isSending, errorMessage, submit } = useChatSendMachine(streamChat);
  const { invited, fetchInvited, acceptInvite, declineInvite } = useInvitedSessions();
  const { members, loading: membersLoading, fetchMembers } = useSessionMembers(selectedChatId ?? undefined);
  const hasSyncToken = Boolean(matrixSyncToken && matrixBaseUrl && matrixUserId);
  const {
    syncClient,
    syncReady,
    startSyncClient,
    setCurrentRoomId,
    fillMessagesFromSyncTimeline,
    sendTyping,
    sendReadReceipt,
    typingUserIds,
  } = useMatrixSyncClient({
    matrixSyncToken,
    matrixBaseUrl,
    matrixUserId,
    matrixDeviceId: matrixDeviceId || undefined,
    ensureSession: addOrUpdateSession,
  });

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

  const { contacts, bots, getMentionedBotIdsFromText } = useContactsAndBots();

  /** @ 提及仅列出：机器人 + 当前房间已加入/已邀请成员（排除自己）；依赖 syncReady 以便直接进房时 sync 完成后再取成员 */
  const mentionItems = useRoomMentionItems(syncClient, selectedChatId ?? undefined, matrixUserId ?? undefined, bots, syncReady);

  /** 在右侧应用区打开用户/认证视图（供个人中心空态按钮调用） */
  const openUserAppPanel = useCallback(() => {
    openView('profile');
  }, [openView]);

  /** 进入工作区时恢复上次打开的会话（若该会话仍在列表中且当前未选会话） */
  useEffect(() => {
    if (id == null || id.length === 0 || sessions.length === 0 || selectedChatId != null) return;
    const stored = getLastChatId(id);
    if (stored && sessions.some((s) => s.id === stored)) {
      setSelectedChatId(stored);
    }
  }, [id, sessions.length, selectedChatId]);

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

  const sessionsList: SessionListEntry[] = useMemo(() => {
    const seen = new Set<string>();
    return sessions
      .filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      })
      .map((s) => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
        type: (s.participants?.length && s.participants.length > 1 ? 'group' : 'private') as 'private' | 'group',
        participants: s.participants ?? [],
      }));
  }, [sessions]);

  const selectedSession = useMemo(
    () => (selectedChatId ? sessions.find((s) => s.id === selectedChatId) ?? null : null),
    [selectedChatId, sessions]
  );

  /** 参与会话者（排除“我”），供顶栏堆叠头像；来自房间成员 API */
  const participantsExcludingMe = useMemo(() => {
    if (!members.length) return [];
    const myId = matrixUserId ?? undefined;
    return members
      .filter((m) => m.userId !== myId)
      .map((m) => ({
        id: m.userId,
        name: m.displayName ?? undefined,
        avatar: m.avatarUrl ?? undefined,
        kind: (m.userId?.toLowerCase().includes('ai-assistant') ?? false) ? ('bot' as const) : ('user' as const),
      }));
  }, [members, matrixUserId]);

  const chatDisplayItems = useMemo(() => {
    const room = selectedChatId && syncClient ? syncClient.getRoom(selectedChatId) : null;
    const getSenderLabel = (senderId: string): string => {
      const member = room?.getMember?.(senderId) ?? null;
      if (!member) return senderId;
      return (member as { name?: string }).name ?? (member as { rawDisplayName?: string }).rawDisplayName ?? senderId;
    };
    const items: ChatMessageItem[] = messages.map((m) => {
      const base = {
        id: m.id ?? m.backendMessageId ?? `msg-${m.createdAt ?? 0}`,
        role: m.role,
        content: m.content,
        formattedContent: m.formattedContent,
        createdAt: m.createdAt,
        thinking: m.thinking,
      };
      if (m.role !== 'assistant') return base;
      const isAiAssistantBot = isAiAssistantSender(m.senderId);
      const sources =
        m.senderId != null
          ? [
              isAiAssistantBot
                ? ({ type: 'bot' as const, label: getSenderLabel(m.senderId) || assistantLabel })
                : ({ type: 'other_user' as const, label: getSenderLabel(m.senderId) }),
            ]
          : [{ type: 'bot' as const, label: assistantLabel }];
      return { ...base, sources };
    });
    return buildChatDisplayItems(items);
  }, [messages, selectedChatId, syncClient]);

  /** 流结束后重置阶段，便于下次发送时从 connecting 开始 */
  useEffect(() => {
    if (!isSending) setStreamPhase('idle');
  }, [isSending]);

  /** 聊天发送失败时 toast（仅在一次进入 error 时提示，避免重复） */
  const prevErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (errorMessage && prevErrorRef.current !== errorMessage) {
      prevErrorRef.current = errorMessage;
      toastManager.add({ title: '回复失败', description: errorMessage || '请重试', type: 'error' });
    }
    if (!errorMessage) prevErrorRef.current = null;
  }, [errorMessage]);

  const handleChatSubmit = useCallback(
    (submittedText?: string) => {
      const text = (submittedText ?? chatInput).trim();
      if (!text || isSending) return;
      const conversationId = selectedChatId || undefined;
      const roomId = selectedChatId ?? '';
      const botIds = getMentionedBotIdsFromText(text);
      const pending = association?.pendingAssociations ?? [];
      const messageBody =
        pending.length > 0
          ? serializeSegmentsToMessageBody([
              { type: 'text', content: text },
              ...pending.map((item) => ({ type: 'association' as const, payload: toAssociationPayload(item) })),
            ])
          : text;
      association?.clearPendingAssociations();
      let batch = '';
      let rafId: number | null = null;
      const flush = () => {
        rafId = null;
        if (batch && roomId) {
          appendStreamingContent(batch);
          batch = '';
        }
      };
      const onDelta = (delta: string) => {
        batch += delta;
        if (rafId == null) rafId = requestAnimationFrame(flush);
      };
      setChatInput('');
      submit({
        text: messageBody,
        conversationId,
        botIds: botIds.length ? botIds : undefined,
        onSessionCreated: (p) => {
          addOrUpdateSession(p.session_id, p.session_id);
          setSelectedChatId(p.session_id);
          if (id) setLastChatId(id, p.session_id);
        },
        onDelta,
        onThinking: (delta) => appendStreamingThinking(delta),
        onThinkingFull: (full) => setStreamingThinking(full),
        onPhaseChange: (phase) => setStreamPhase(phase),
        onDifyEvent: (ev) => {
          if (ev.type === 'tool_call') {
            toastManager.add({
              title: '正在调用工具',
              type: 'info',
              duration: 2000,
            });
          }
        },
        appendUserMessage,
        appendWaitingAssistant,
        commitStreamingMessage,
        discardStreamingMessage,
        onBeforeCommit: () => {
          if (rafId != null) cancelAnimationFrame(rafId);
          flush();
        },
      });
    },
    [
      chatInput,
      selectedChatId,
      id,
      isSending,
      association,
      submit,
      appendStreamingContent,
      appendStreamingThinking,
      setStreamingThinking,
      appendUserMessage,
      appendWaitingAssistant,
      commitStreamingMessage,
      discardStreamingMessage,
      addOrUpdateSession,
      getMentionedBotIdsFromText,
    ]
  );

  const filteredSessions = useMemo((): SessionListEntry[] => {
    let list = sessionsList;
    if (sessionFilter !== 'all') {
      list = list.filter((s) => (s.type ?? 'private') === sessionFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessionsList, searchQuery, sessionFilter]);

  const { pinnedSessions, activeSessions } = useMemo(() => {
    const pinned: SessionListEntry[] = [];
    const active: SessionListEntry[] = [];
    const idSet = new Set(pinnedIds);
    for (const s of filteredSessions) {
      if (idSet.has(s.id)) pinned.push(s);
      else active.push(s);
    }
    // 粘性当前房间：选中的会话固定在列表首位，其余按 updatedAt 降序，避免收到新消息时选中项跳位
    const sortByUpdatedAt = (a: SessionListEntry, b: SessionListEntry) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    if (selectedChatId && active.length > 1) {
      const sticky = active.find((s) => s.id === selectedChatId);
      const rest = active.filter((s) => s.id !== selectedChatId).sort(sortByUpdatedAt);
      const orderedActive = sticky ? [sticky, ...rest] : [...active].sort(sortByUpdatedAt);
      return { pinnedSessions: pinned, activeSessions: orderedActive };
    }
    return { pinnedSessions: pinned, activeSessions: [...active].sort(sortByUpdatedAt) };
  }, [filteredSessions, pinnedIds, selectedChatId]);

  const handleTogglePin = useCallback((sessionId: string) => {
    setPinnedIds((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    );
  }, []);

  /** Matrix Sync：有 token 时启动；切换房间时设置当前房间并可选从 Sync 时间线补消息 */
  useEffect(() => {
    if (!hasSyncToken) return;
    startSyncClient();
  }, [hasSyncToken, startSyncClient]);

  useEffect(() => {
    setCurrentRoomId(selectedChatId ?? undefined);
  }, [selectedChatId, setCurrentRoomId]);

  const handleAcceptInvite = useCallback(
    async (roomId: string) => {
      setInvitedAccepting(roomId);
      try {
        const ok = await acceptInvite(roomId);
        if (ok) {
          fetchSessions();
          setSelectedChatId(roomId);
          if (id) setLastChatId(id, roomId);
        }
      } finally {
        setInvitedAccepting(null);
      }
    },
    [acceptInvite, fetchSessions, id]
  );

  const handleDeclineInvite = useCallback(
    async (roomId: string) => {
      setInvitedDeclining(roomId);
      try {
        await declineInvite(roomId);
      } finally {
        setInvitedDeclining(null);
      }
    },
    [declineInvite]
  );

  const handleLeaveSession = useCallback(async () => {
    if (!selectedChatId) return;
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(selectedChatId)}/leave`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setSelectedChatId(null);
        setMembersSheetOpen(false);
        fetchSessions();
      }
    } catch {
      /* ignore */
    }
  }, [selectedChatId, fetchSessions]);

  /** 列表项右键「删除会话」：先请求是否为创建者，再打开确认框（创建者=删除，非创建者=退出） */
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    setDeleteConfirmLoading(true);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/creator`, {
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as { isCreator?: boolean };
      setDeleteConfirmState({ sessionId, isCreator: data.isCreator === true });
    } catch {
      setDeleteConfirmState({ sessionId, isCreator: false });
    } finally {
      setDeleteConfirmLoading(false);
    }
  }, []);

  const handleCloseDeleteConfirm = useCallback(() => {
    setDeleteConfirmState(null);
  }, []);

  const handleConfirmDeleteOrLeave = useCallback(async () => {
    const state = deleteConfirmState;
    if (!state) return;
    setDeleteConfirmSubmitting(true);
    setDeleteConfirmState((prev) => (prev ? { ...prev, error: undefined } : null));
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(state.sessionId)}/leave`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (res.ok) {
        setDeleteConfirmState(null);
        if (selectedChatId === state.sessionId) {
          setSelectedChatId(null);
          setMembersSheetOpen(false);
          if (id) setLastChatId(id, null);
        }
        fetchSessions();
      } else {
        const msg = data.message || data.error || `请求失败（${res.status}）`;
        setDeleteConfirmState((prev) => (prev ? { ...prev, error: msg } : null));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '网络错误';
      setDeleteConfirmState((prev) => (prev ? { ...prev, error: msg } : null));
    } finally {
      setDeleteConfirmSubmitting(false);
    }
  }, [deleteConfirmState, selectedChatId, id, fetchSessions]);

  const handleOpenRename = useCallback((sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    const title = session?.title ?? sessionId;
    setRenameState({ sessionId, title });
    setRenameInputValue(title);
    setRenameError(null);
  }, [sessions]);

  const handleCloseRename = useCallback(() => {
    setRenameState(null);
    setRenameInputValue('');
    setRenameError(null);
  }, []);

  const handleSubmitRename = useCallback(async () => {
    if (!renameState) return;
    const title = renameInputValue.trim();
    if (!title) return;
    setRenameSubmitting(true);
    setRenameError(null);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(renameState.sessionId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (res.ok) {
        fetchSessions();
        handleCloseRename();
      } else {
        setRenameError(data.message || data.error || `请求失败（${res.status}）`);
      }
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : '网络错误');
    } finally {
      setRenameSubmitting(false);
    }
  }, [renameState, renameInputValue, fetchSessions, handleCloseRename]);

  const handleInviteToSession = useCallback(
    async (mxid: string): Promise<boolean> => {
      if (!selectedChatId) return false;
      try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(selectedChatId)}/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ user_id: mxid.trim() }),
        });
        if (res.ok) {
          fetchMembers();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [selectedChatId, fetchMembers]
  );

  /** Matrix 正在输入：输入时发送 typing，防抖后发送 not typing */
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selectedChatId || !hasSyncToken) return;
    if (chatInput.trim().length > 0) {
      sendTyping(selectedChatId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(selectedChatId, false);
        typingTimeoutRef.current = null;
      }, 3000);
    } else {
      sendTyping(selectedChatId, false);
    }
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [chatInput, selectedChatId, hasSyncToken, sendTyping]);

  const handleCreateSession = useCallback(
    async (result: { mode: 'solo' } | { mode: 'contacts'; contactIds: string[] }) => {
      const title =
        result.mode === 'solo'
          ? '新会话'
          : result.contactIds
            .map((cid) => contacts.find((c) => c.id === cid)?.name)
            .filter(Boolean)
            .join('、') || '新会话';
      const created = await createSession(title);
      if (!created) return;
      if (result.mode === 'contacts' && result.contactIds?.length > 0) {
        await Promise.allSettled(
          result.contactIds.map((contactId) =>
            fetch(`/api/sessions/${encodeURIComponent(created.id)}/invite`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ user_id: contactId }),
            })
          )
        );
      }
      setSelectedChatId(created.id);
      if (id) setLastChatId(id, created.id);
    },
    [contacts, createSession, id]
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
        <div className="relative min-h-0 flex-1 flex flex-col overflow-hidden">
        <FramePanel className="min-h-0 flex-1 flex overflow-hidden rounded-2xl pl-2 pt-2 pb-2 pr-0 border-0 shadow-none before:shadow-none bg-zinc-100 dark:bg-zinc-850">
            <SidebarProvider
              ref={setSessionAreaContainer}
              className="min-h-0 flex-1 flex w-full flex-row"
              style={{ '--sidebar-width': '18rem' } as React.CSSProperties}
            >
              <div className="relative flex min-h-0 shrink-0 flex-col rounded-2xl border-2 border-border bg-white dark:bg-background">
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
                  {(invited.length > 0 || filteredSessions.length > 0) ? (
                    <div className="flex flex-col min-h-0 min-w-0">
                      {invited.length > 0 && (
                        <SessionCategory
                          title="邀请"
                          count={invited.length}
                          collapsed={false}
                          onCollapsedChange={() => {}}
                          accent
                        >
                          <ul className="divide-y divide-zinc-100 dark:divide-zinc-700">
                            {invited.map((inv) => (
                              <InvitedSessionRow
                                key={`invited-${inv.roomId}`}
                                roomId={inv.roomId}
                                name={inv.name}
                                onAccept={() => handleAcceptInvite(inv.roomId)}
                                onDecline={() => handleDeclineInvite(inv.roomId)}
                                accepting={invitedAccepting === inv.roomId}
                                declining={invitedDeclining === inv.roomId}
                              />
                            ))}
                          </ul>
                        </SessionCategory>
                      )}
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
                              key={`pinned-${session.id}`}
                              item={session}
                              isActive={session.id === selectedChatId}
                              isPinned
                              dateLabel={formatSessionDate(session.updatedAt)}
                              unreadCount={0}
                              onClick={() => handleSelectSession(session.id)}
                              onTogglePin={() => handleTogglePin(session.id)}
                              onRename={() => handleOpenRename(session.id)}
                              onDelete={() => handleDeleteSession(session.id)}
                            />
                          ))}
                        </SessionCategory>
                      )}
                      <ul className="divide-y divide-zinc-100 dark:divide-zinc-700">
                        {activeSessions.map((session) => (
                          <SessionListItem
                            key={`active-${session.id}`}
                            item={session}
                            isActive={session.id === selectedChatId}
                            isPinned={pinnedIds.includes(session.id)}
                            dateLabel={formatSessionDate(session.updatedAt)}
                            unreadCount={0}
                            onClick={() => handleSelectSession(session.id)}
                            onTogglePin={() => handleTogglePin(session.id)}
                            onRename={() => handleOpenRename(session.id)}
                            onDelete={() => handleDeleteSession(session.id)}
                          />
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <Empty className="min-h-[12rem] justify-center py-8">
                      <EmptyHeader>
                        <EmptyTitle className="text-sm font-medium">
                          {sessionsLoading ? '加载中…' : searchQuery.trim() ? '无匹配会话' : sessionsError ? '拉取失败' : '暂无会话'}
                        </EmptyTitle>
                        <EmptyDescription className="text-xs mt-1">
                          {sessionsLoading ? '正在拉取会话列表' : searchQuery.trim() ? '试试其它关键词' : sessionsError ? sessionsError : '新建会话或从邀请中接受'}
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
              <>
                <ChatPane
                  chatTitle={selectedSession.title}
                  chatUserAvatar={selectedSession.participants?.[0]?.avatar ?? null}
                  chatUserName={selectedSession.participants?.[0]?.name ?? selectedSession.title}
                  chatUserIsAiAssistant={
                    !selectedSession.participants?.[0]?.avatar &&
                    (selectedSession.title === assistantLabel ||
                      selectedSession.participants?.[0]?.name === assistantLabel ||
                      (selectedSession.participants?.[0]?.kind === 'bot' && selectedSession.participants?.[0]?.id && isAiAssistantSender(selectedSession.participants[0].id)))
                  }
                  currentUserAvatar={user?.avatar}
                  currentUserName={user?.name ?? user?.email}
                  participants={participantsExcludingMe}
                  displayItems={chatDisplayItems}
                  input={chatInput}
                  onInputChange={setChatInput}
                  onSubmit={handleChatSubmit}
                  mentionItems={mentionItems}
                  onClose={() => {
                    setSelectedChatId(null);
                    if (id != null && id.length > 0) setLastChatId(id, null);
                  }}
                  onOpenMembers={() => setMembersSheetOpen(true)}
                  onLeave={hasSyncToken ? handleLeaveSession : undefined}
                  onRename={selectedChatId ? () => handleOpenRename(selectedChatId) : undefined}
                  showBack={false}
                  enterToSend={enterToSend}
                  sessionAreaFontScale={sessionAreaFontScale}
                  inputAreaHeightPx={chatInputAreaHeightPx}
                  onInputAreaHeightChange={setChatInputAreaHeightPx}
                  typingUserIds={typingUserIds}
                  streamingInProgress={false}
                  streamPhaseLabel={getStreamPhaseLabel(streamPhase)}
                  onOpenAssociation={(appId) => openView('app', appId)}
                />
                <SessionMembersSheet
                  open={membersSheetOpen}
                  onOpenChange={setMembersSheetOpen}
                  members={members}
                  loading={membersLoading}
                  sessionId={selectedChatId}
                  onInvite={handleInviteToSession}
                  container={sessionAreaContainer}
                />
              </>
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
        {deleteConfirmState && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/32 backdrop-blur-sm rounded-2xl"
            role="dialog"
            aria-modal
            aria-labelledby="delete-confirm-title"
            onClick={handleCloseDeleteConfirm}
          >
            <div
              className="w-full max-w-sm rounded-2xl border bg-popover text-popover-foreground shadow-lg flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-2 p-6">
                <h2 id="delete-confirm-title" className="font-heading font-semibold text-xl leading-none">
                  {deleteConfirmState.isCreator ? '删除会话' : '退出会话'}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {deleteConfirmState.isCreator
                    ? '确定要删除该会话吗？删除后将从会话列表中移除。'
                    : '确定要退出该会话吗？退出后将从会话列表中移除。'}
                </p>
                <p className="text-xs text-muted-foreground font-mono break-all" aria-label="会话 ID">
                  会话 ID：{deleteConfirmState.sessionId}
                  {(sessions.find((s) => s.id === deleteConfirmState.sessionId)?.title ?? null) != null && (
                    <> · 标题：{sessions.find((s) => s.id === deleteConfirmState.sessionId)?.title}</>
                  )}
                </p>
                {deleteConfirmState.error && (
                  <p className="text-sm text-destructive font-medium" role="alert">
                    {deleteConfirmState.error}
                  </p>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 px-6 pb-6 sm:flex-row sm:justify-end border-t bg-muted/72 py-4 rounded-b-[calc(var(--radius-2xl)-1px)]">
                <Button variant="outline" size="sm" disabled={deleteConfirmSubmitting} onClick={handleCloseDeleteConfirm}>
                  取消
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteConfirmSubmitting}
                  onClick={() => handleConfirmDeleteOrLeave()}
                >
                  {deleteConfirmSubmitting ? '处理中…' : deleteConfirmState.isCreator ? '删除' : '退出'}
                </Button>
              </div>
            </div>
          </div>
        )}
        {renameState && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/32 backdrop-blur-sm rounded-2xl"
            role="dialog"
            aria-modal
            aria-labelledby="rename-confirm-title"
            onClick={handleCloseRename}
          >
            <div
              className="w-full max-w-sm rounded-2xl border bg-popover text-popover-foreground shadow-lg flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-2 p-6">
                <h2 id="rename-confirm-title" className="font-heading font-semibold text-xl leading-none">
                  重命名会话
                </h2>
                <p className="text-muted-foreground text-sm">修改会话标题，其他成员可见。</p>
                <Input
                  value={renameInputValue}
                  onChange={(e) => setRenameInputValue(e.target.value)}
                  placeholder="会话标题"
                  className="mt-1"
                  disabled={renameSubmitting}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmitRename();
                    if (e.key === 'Escape') handleCloseRename();
                  }}
                />
                {renameError && (
                  <p className="text-sm text-destructive font-medium" role="alert">
                    {renameError}
                  </p>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 px-6 pb-6 sm:flex-row sm:justify-end border-t bg-muted/72 py-4 rounded-b-[calc(var(--radius-2xl)-1px)]">
                <Button variant="outline" size="sm" disabled={renameSubmitting} onClick={handleCloseRename}>
                  取消
                </Button>
                <Button size="sm" disabled={renameSubmitting || !renameInputValue.trim()} onClick={() => handleSubmitRename()}>
                  {renameSubmitting ? '保存中…' : '确定'}
                </Button>
              </div>
            </div>
          </div>
        )}
        </div>
      </Frame>
      <Frame
        className="min-h-0 flex-1 flex max-w-full flex-col overflow-hidden rounded-2xl border border-border p-0 @container"
        style={{ containerName: 'app' } as React.CSSProperties}
      >
        <FramePanel className="min-h-0 flex-1 flex overflow-hidden rounded-2xl p-2 border-0 shadow-none before:shadow-none bg-zinc-100 dark:bg-zinc-850">
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
              className="min-h-0 min-w-0 flex-1 overflow-auto rounded-2xl bg-white dark:bg-background"
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
                onOpenApp={(appId) => openView('app', appId)}
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

export default function Space() {
  return (
    <AssociationProvider>
      <SpaceContent />
    </AssociationProvider>
  );
}
