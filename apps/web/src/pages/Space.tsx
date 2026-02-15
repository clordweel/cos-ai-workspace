import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useAuth } from '../hooks/useAuth';
import { useSessions } from '../hooks/useSessions';
import { useMessages } from '../hooks/useMessages';
import { useChatStream } from '../hooks/useChatStream';
import { useMatrixSyncClient } from '../hooks/useMatrixSyncClient';

export default function Space() {
  const { id: sessionId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user, authLoading, login, matrixSyncToken, matrixBaseUrl, matrixUserId, matrixDeviceId } = useAuth();
  const { sessions, loading: sessionsLoading, error: sessionsError, fetchSessions, createSession, addOrUpdateSession } = useSessions();
  const matrixSync = useMatrixSyncClient({
    matrixSyncToken,
    matrixBaseUrl,
    matrixUserId,
    matrixDeviceId: matrixDeviceId ?? undefined,
    ensureSession: addOrUpdateSession,
  });
  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    fetchMessages,
    appendStreamingContent,
    commitStreamingMessage,
    appendUserMessage,
    discardStreamingMessage,
  } = useMessages(sessionId);
  const { streamChat } = useChatStream();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const pendingNavigateRef = useRef<string | null>(null);

  useEffect(() => {
    matrixSync.setCurrentRoomId(sessionId);
  }, [sessionId, matrixSync.setCurrentRoomId]);

  useEffect(() => {
    if (matrixSync.hasSyncToken && isAuthenticated) {
      matrixSync.startSyncClient();
    }
  }, [matrixSync.hasSyncToken, isAuthenticated, matrixSync.startSyncClient]);

  useEffect(() => {
    if (sessionId && matrixSync.syncReady) {
      matrixSync.fillMessagesFromSyncTimeline(sessionId);
    }
  }, [sessionId, matrixSync.syncReady, matrixSync.fillMessagesFromSyncTimeline]);

  const handleNewSession = useCallback(async () => {
    const created = await createSession();
    if (created) navigate(`/space/${encodeURIComponent(created.id)}`);
  }, [createSession, navigate]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    setStreamError(null);
    pendingNavigateRef.current = null;
    appendUserMessage(text);
    let conversationId = sessionId || '';
    try {
      const fullText = await streamChat(text, (delta) => {
        flushSync(() => appendStreamingContent(delta));
      }, {
        conversationId: conversationId || undefined,
        onSessionCreated: (p) => {
          conversationId = p.session_id;
          fetchSessions();
          if (!sessionId) pendingNavigateRef.current = p.session_id;
        },
      });
      commitStreamingMessage(fullText);
      const toNav = pendingNavigateRef.current;
      if (toNav) {
        pendingNavigateRef.current = null;
        navigate(`/space/${encodeURIComponent(toNav)}`);
      }
    } catch (e) {
      discardStreamingMessage();
      setStreamError(e instanceof Error ? e.message : '发送失败');
    } finally {
      setSending(false);
    }
  }, [
    input,
    sending,
    sessionId,
    streamChat,
    appendUserMessage,
    appendStreamingContent,
    commitStreamingMessage,
    discardStreamingMessage,
    navigate,
    fetchSessions,
  ]);

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* 顶栏：用户/登录 + 新建会话 */}
      <div className="shrink-0 flex items-center justify-between gap-2 p-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="min-w-0">
          {authLoading ? (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">加载中…</span>
          ) : isAuthenticated && user ? (
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate block">
              {user.name}
            </span>
          ) : (
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              <Button variant="link" asChild>
                <a href="/logto" onClick={(e) => { e.preventDefault(); login(); }}>登录</a>
              </Button>
              {' '}后使用
            </span>
          )}
        </div>
        <Button size="sm" onClick={handleNewSession}>
          新建会话
        </Button>
      </div>

      {/* 会话列表 + 占位 */}
      <div className="shrink-0 overflow-auto border-b border-zinc-200 dark:border-zinc-700" style={{ maxHeight: '220px' }}>
        {sessionsLoading ? (
          <p className="p-3 text-sm text-zinc-500 dark:text-zinc-400">加载会话…</p>
        ) : sessionsError ? (
          <p className="p-3 text-sm text-red-600 dark:text-red-400">{sessionsError}</p>
        ) : sessions.length === 0 ? (
          <p className="p-3 text-sm text-zinc-500 dark:text-zinc-400">暂无会话，点击「新建会话」或直接发送消息。</p>
        ) : (
          <ul className="py-1">
            {sessions.map((s) => (
              <li key={s.id}>
                <a
                  href={`/space/${encodeURIComponent(s.id)}`}
                  className={`block px-3 py-2 text-sm truncate rounded-lg mx-2 my-0.5 ${
                    s.id === sessionId
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {s.title || s.id}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 消息区 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-3 flex flex-col gap-2">
          {!sessionId && sessions.length === 0 && messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-[120px]">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
                在下方输入消息并发送，将自动创建会话。
              </p>
            </div>
          ) : messagesLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">加载历史…</p>
          ) : messagesError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{messagesError}</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id ?? m.backendMessageId ?? Math.random()}
                className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                  m.role === 'user'
                    ? 'self-end bg-primary-100 dark:bg-primary-900/40 text-zinc-900 dark:text-zinc-100'
                    : m.role === 'assistant'
                      ? 'self-start bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                      : 'self-center text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {m.content}
              </div>
            ))
          )}
        </div>
        <div className="shrink-0 p-3 border-t border-zinc-200 dark:border-zinc-700">
          {streamError && (
            <p className="text-xs text-red-600 dark:text-red-400 mb-2 flex items-center gap-2 flex-wrap">
              <span>{streamError}</span>
              <button
                type="button"
                onClick={() => setStreamError(null)}
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                清除
              </button>
            </p>
          )}
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入消息…"
              className="flex-1 min-h-[40px] max-h-[120px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={1}
              disabled={sending}
            />
            <Button onClick={handleSend} disabled={sending || !input.trim()}>
              {sending ? '发送中…' : '发送'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
