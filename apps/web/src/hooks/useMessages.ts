import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import * as store from '../stores/messagesByRoomStore';

export type Message = store.Message;

export function useMessages(sessionId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messages = useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot(sessionId ?? ''),
    () => store.getSnapshot(sessionId ?? '')
  );

  const fetchMessages = useCallback(async () => {
    if (!sessionId) {
      store.setMessages('', []);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages?limit=50`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || '拉取历史失败');
        store.setMessages(sessionId, []);
        return;
      }
      const list = Array.isArray((data as { messages?: Message[] }).messages) ? (data as { messages: Message[] }).messages : [];
      store.setMessages(sessionId, list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误');
      store.setMessages(sessionId, []);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const appendStreamingContent = useCallback(
    (delta: string) => {
      if (sessionId) store.appendStreamingContent(sessionId, delta);
    },
    [sessionId]
  );

  const commitStreamingMessage = useCallback(
    (finalContent: string) => {
      if (sessionId) store.commitStreamingMessage(sessionId, finalContent);
    },
    [sessionId]
  );

  const appendUserMessage = useCallback(
    (content: string) => {
      if (sessionId) store.appendMessage(sessionId, { id: `u-${Date.now()}`, role: 'user', content, createdAt: Date.now() });
    },
    [sessionId]
  );

  const discardStreamingMessage = useCallback(() => {
    if (sessionId) store.discardStreamingMessage(sessionId);
  }, [sessionId]);

  const appendWaitingAssistant = useCallback(() => {
    if (sessionId) store.appendWaitingAssistant(sessionId);
  }, [sessionId]);

  return {
    messages,
    loading,
    error,
    fetchMessages,
    appendStreamingContent,
    commitStreamingMessage,
    appendUserMessage,
    discardStreamingMessage,
    appendWaitingAssistant,
  };
}
