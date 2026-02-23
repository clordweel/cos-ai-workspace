/**
 * Matrix 仅 sync/typing/已读 客户端（阶段 4.2，与现 frontend useMatrixSyncClient 行为对照）
 * 使用 /api/auth/me 下发的 matrixSyncToken、matrix_base_url、matrix_user_id、matrix_device_id，
 * 仅用于：收 sync 新消息、发 typing、发已读回执。禁止用于发消息、拉列表、拉历史。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as sdk from 'matrix-js-sdk';
import * as store from '../stores/messagesByRoomStore';

const noop = () => {};
const silentLogger = {
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: (...args: unknown[]) => {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.error('[MatrixSync]', ...args);
    }
  },
  getChild: function getChild(this: typeof silentLogger) {
    return this;
  },
} as unknown as sdk.DebugLogger;

function buildSyncCryptoPrefix(userId: string, deviceId: string): string {
  const safe = (s: string) => s.replace(/[@:]/g, '_');
  return `matrix-sync-${safe(userId)}-${safe(deviceId)}`;
}

export interface UseMatrixSyncClientOptions {
  matrixSyncToken: string;
  matrixBaseUrl: string;
  matrixUserId: string;
  matrixDeviceId?: string;
  /** 当 Sync 发现新房间或房间名变更时调用，用于更新会话列表 */
  ensureSession?: (id: string, title: string) => void;
}

export function useMatrixSyncClient(options: UseMatrixSyncClientOptions) {
  const { matrixSyncToken, matrixBaseUrl, matrixUserId, matrixDeviceId, ensureSession } = options;
  const [syncClient, setSyncClient] = useState<sdk.MatrixClient | null>(null);
  const [syncReady, setSyncReady] = useState(false);
  const [currentRoomTypingUserIds, setCurrentRoomTypingUserIds] = useState<string[]>([]);
  const currentRoomIdRef = useRef<string | undefined>(undefined);
  const timelineRefreshBoundRooms = useRef<Set<string>>(new Set());

  const hasSyncToken = Boolean(
    matrixSyncToken && matrixBaseUrl && matrixUserId
  );

  const setCurrentRoomId = useCallback((roomId: string | undefined) => {
    currentRoomIdRef.current = roomId;
    if (!syncClient || !roomId) {
      setCurrentRoomTypingUserIds([]);
      return;
    }
    const room = syncClient.getRoom(roomId);
    if (!room) {
      setCurrentRoomTypingUserIds([]);
      return;
    }
    const state = (room as { currentState?: { getMembers?: () => { userId: string; typing?: boolean }[] } }).currentState;
    const members = state?.getMembers?.() ?? [];
    const typing = members.filter((m) => m.typing && m.userId !== matrixUserId).map((m) => m.userId);
    setCurrentRoomTypingUserIds(typing);
  }, [syncClient, matrixUserId]);

  const stopSyncClient = useCallback(() => {
    if (syncClient) {
      try {
        syncClient.stopClient?.();
      } catch {
        /* ignore */
      }
      setSyncClient(null);
    }
    setSyncReady(false);
  }, [syncClient]);

  useEffect(() => {
    if (!matrixSyncToken) stopSyncClient();
  }, [matrixSyncToken, stopSyncClient]);

  const bindTimelineRefreshForRoom = useCallback(
    (client: sdk.MatrixClient, room: { roomId?: string; on?: (ev: string, fn: () => void) => void }) => {
      if (!room?.roomId || timelineRefreshBoundRooms.current.has(room.roomId)) return;
      timelineRefreshBoundRooms.current.add(room.roomId);
      if (typeof room.on === 'function') {
        room.on(sdk.RoomEvent.TimelineRefresh, () => {
          if (room.roomId === currentRoomIdRef.current) {
            fillMessagesFromSyncTimelineImpl(client, room.roomId, matrixUserId, ensureSession);
          }
        });
      }
    },
    [matrixUserId, ensureSession]
  );

  const startSyncClient = useCallback(async (): Promise<sdk.MatrixClient | null> => {
    if (!matrixSyncToken || !matrixBaseUrl || !matrixUserId) return null;
    if (syncClient) {
      setSyncReady(true);
      return syncClient;
    }

    try {
      const c = sdk.createClient({
        baseUrl: matrixBaseUrl,
        accessToken: matrixSyncToken,
        userId: matrixUserId,
        ...(matrixDeviceId?.trim() ? { deviceId: matrixDeviceId.trim() } : {}),
        logger: silentLogger,
      });

      if (matrixDeviceId?.trim() && typeof c.initRustCrypto === 'function') {
        try {
          await c.initRustCrypto({
            cryptoDatabasePrefix: buildSyncCryptoPrefix(matrixUserId, matrixDeviceId.trim()),
          });
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[MatrixSync] initRustCrypto 失败，加密房间消息将无法解密:', e);
          }
        }
      }

      setSyncClient(c);
      setSyncReady(false);

      c.on(sdk.ClientEvent.Sync, (state: string) => {
        if (state === 'PREPARED' || state === 'SYNCING') {
          setSyncReady(true);
          const rooms = c.getRooms?.() ?? [];
          for (const room of rooms) {
            const roomId = room?.roomId;
            if (!roomId) continue;
            const name = (room?.name ?? '').trim();
            if (name) ensureSession?.(roomId, name);
            bindTimelineRefreshForRoom(c, room as Parameters<typeof bindTimelineRefreshForRoom>[1]);
          }
        }
        if (state === 'ERROR' && process.env.NODE_ENV === 'development') {
          console.warn('[MatrixSync] sync state ERROR，实时消息可能不可用');
        }
      });

      c.on(sdk.ClientEvent.Room, (room: { roomId?: string; on?: (ev: string, fn: () => void) => void }) => {
        bindTimelineRefreshForRoom(c, room);
        if (room?.roomId && room.roomId === currentRoomIdRef.current) {
          fillMessagesFromSyncTimelineImpl(c, room.roomId, matrixUserId, ensureSession);
        }
      });

      c.on(sdk.RoomEvent.Name, (room: { roomId?: string; name?: string }) => {
        const roomId = room?.roomId;
        const name = (room?.name ?? '').trim();
        if (roomId && name) ensureSession?.(roomId, name);
      });

      const updateTypingForRoom = (roomId: string) => {
        const room = c.getRoom?.(roomId);
        if (!room) return;
        const state = (room as { currentState?: { getMembers?: () => { userId: string; typing?: boolean }[] } }).currentState;
        const members = state?.getMembers?.() ?? [];
        const typing = members.filter((m) => m.typing && m.userId !== matrixUserId).map((m) => m.userId);
        if (roomId === currentRoomIdRef.current) {
          setCurrentRoomTypingUserIds(typing);
        }
      };

      try {
        c.on('RoomMember.typing' as sdk.RoomMemberEvent, (_event: unknown, member: { roomId?: string; userId?: string }) => {
          const roomId = member?.roomId;
          if (roomId) updateTypingForRoom(roomId);
        });
      } catch {
        /* SDK 版本可能无 RoomMemberEvent 枚举 */
      }

      c.on(
        sdk.ClientEvent.Event,
        (event: {
          getRoomId?: () => string;
          getType?: () => string;
          getContent?: () => Record<string, unknown>;
          getSender?: () => string;
          getId?: () => string;
          getTs?: () => number;
        }) => {
          const roomId = event.getRoomId?.();
          if (!roomId) return;
          const eventType = event.getType?.();
          const eventId = event.getId?.();
          const existing = store.getMessages(roomId);
          if (eventId && existing.some((m) => m.id === eventId)) return;
          const ts = typeof event.getTs === 'function' ? event.getTs() : undefined;
          const createdAt = ts && ts > 0 ? ts : Date.now();

          if (eventType === 'm.room.message') {
            const content = event.getContent?.() ?? {};
            const body = (content.body ?? (content as { body?: string }).body) as string | undefined;
            if (body == null) return;
            const relatesTo = (content as { 'm.relates_to'?: { rel_type?: string; event_id?: string } })['m.relates_to'];
            if (relatesTo?.rel_type === 'm.replace') return;
            const role = event.getSender?.() === matrixUserId ? 'user' : 'assistant';
            const bodyStr = String(body);
            if (bodyStr.trim() === '' && role === 'assistant') return;
            const room = c.getRoom?.(roomId);
            const title = (room?.name ?? '').trim() || roomId;
            ensureSession?.(roomId, title);
            if (eventId && store.replaceLastMessageIdIfMatch(roomId, bodyStr, role as 'user' | 'assistant', eventId)) {
              return;
            }
            const formattedBody = typeof (content as { formatted_body?: string }).formatted_body === 'string'
              ? (content as { formatted_body: string }).formatted_body
              : undefined;
            if (role === 'user' && eventId && store.replaceLastUserMessageIfMatch(roomId, bodyStr, eventId, formattedBody)) {
              return;
            }
            const senderId = role === 'assistant' ? (event.getSender?.() ?? undefined) : undefined;
            const msg: store.Message = {
              role: role as 'user' | 'assistant',
              content: bodyStr,
              formattedContent: formattedBody,
              id: eventId ?? undefined,
              backendMessageId: eventId ?? undefined,
              createdAt,
              senderId,
            };
            if (role === 'assistant' && store.replaceStreamingWithMessage(roomId, msg)) {
              return;
            }
            if (role === 'assistant' && eventId && store.replaceLastAssistantMessageIfFromSync(roomId, bodyStr, eventId, formattedBody, senderId)) {
              return;
            }
            if (role === 'assistant' && eventId && store.replaceLastAssistantMessageIfMatch(roomId, bodyStr, eventId, formattedBody)) {
              return;
            }
            if (role === 'assistant') {
              const list = store.getMessages(roomId);
              const last = list[list.length - 1];
              if (last?.role === 'assistant' && (last.content ?? '').trim() === bodyStr.trim()) {
                if (eventId) store.setLastMessageId(roomId, eventId);
                return;
              }
            }
            store.appendMessage(roomId, msg);
            return;
          }

          if (eventType === 'm.room.name') {
            const content = event.getContent?.() ?? {};
            const name = ((content as { name?: string }).name ?? '').trim() || '未命名';
            ensureSession?.(roomId, name);
          }
        }
      );

      await c.startClient({ initialSyncLimit: 50 });
      return c;
    } catch (e) {
      setSyncClient(null);
      setSyncReady(false);
      if (process.env.NODE_ENV === 'development') {
        console.warn('[MatrixSync] startClient 失败，实时消息不可用:', e);
      }
      return null;
    }
  }, [
    matrixSyncToken,
    matrixBaseUrl,
    matrixUserId,
    matrixDeviceId,
    ensureSession,
    syncClient,
    bindTimelineRefreshForRoom,
  ]);

  const fillMessagesFromSyncTimeline = useCallback(
    async (roomId: string): Promise<boolean> => {
      if (!syncClient) return false;
      return fillMessagesFromSyncTimelineImpl(syncClient, roomId, matrixUserId, ensureSession);
    },
    [syncClient, matrixUserId, ensureSession]
  );

  const sendTyping = useCallback(
    (roomId: string, isTyping: boolean): void => {
      const room = syncClient?.getRoom(roomId);
      if (!room) return;
      try {
        room.sendTyping(isTyping);
      } catch {
        /* ignore */
      }
    },
    [syncClient]
  );

  const sendReadReceipt = useCallback(
    (roomId: string, eventId: string): void => {
      const room = syncClient?.getRoom(roomId);
      const event = room?.findEventById?.(eventId) ?? null;
      if (!event || !syncClient) return;
      try {
        syncClient.sendReadReceipt(event as sdk.MatrixEvent, 'm.read');
      } catch {
        /* ignore */
      }
    },
    [syncClient]
  );

  /** 当前房间正在输入的用户 ID 列表（Element 风格，排除自己） */
  const typingUserIds = currentRoomTypingUserIds;

  return {
    syncClient,
    syncReady,
    hasSyncToken,
    startSyncClient,
    stopSyncClient,
    setCurrentRoomId,
    fillMessagesFromSyncTimeline,
    sendTyping,
    sendReadReceipt,
    typingUserIds,
  };
}

function fillMessagesFromSyncTimelineImpl(
  client: sdk.MatrixClient,
  roomId: string,
  userId: string,
  ensureSession?: (id: string, title: string) => void
): Promise<boolean> {
  const room = client.getRoom(roomId);
  if (!room) return Promise.resolve(false);
  const roomDecrypt = room as { decryptCriticalEvents?: () => Promise<unknown> };
  return (typeof roomDecrypt.decryptCriticalEvents === 'function'
    ? roomDecrypt.decryptCriticalEvents()
    : Promise.resolve()
  ).then(() => {
    const timeline = (room as { getLiveTimeline?: () => { getEvents?: () => unknown[] } }).getLiveTimeline?.();
    const rawEvents = timeline?.getEvents?.() ?? [];
    const byTs = (a: unknown, b: unknown) => {
      const ta = typeof (a as { getTs?: () => number }).getTs === 'function' ? (a as { getTs(): number }).getTs() : 0;
      const tb = typeof (b as { getTs?: () => number }).getTs === 'function' ? (b as { getTs(): number }).getTs() : 0;
      return ta - tb;
    };
    const sorted = [...rawEvents].sort(byTs);
    const eventMap = new Map<
      string,
      { role: 'user' | 'assistant'; content: string; formattedContent?: string; id: string; createdAt: number; senderId?: string }
    >();
    const ev = (e: unknown) => ({
      getType: () => (typeof (e as { getType?: () => string }).getType === 'function' ? (e as { getType(): string }).getType() : ''),
      getContent: () => (typeof (e as { getContent?: () => Record<string, unknown> }).getContent === 'function' ? (e as { getContent(): Record<string, unknown> }).getContent() : {}),
      getSender: () => (typeof (e as { getSender?: () => string }).getSender === 'function' ? (e as { getSender(): string }).getSender() : ''),
      getId: () => (typeof (e as { getId?: () => string }).getId === 'function' ? (e as { getId(): string }).getId() : ''),
      getTs: () => (typeof (e as { getTs?: () => number }).getTs === 'function' ? (e as { getTs(): number }).getTs() : 0),
    });
    for (const raw of sorted) {
      const e = ev(raw);
      if (e.getType() !== 'm.room.message') continue;
      const content = e.getContent();
      const body = (content.body ?? (content as { body?: string }).body) as string | undefined;
      if (body == null) continue;
      const rel = (content as { 'm.relates_to'?: { rel_type?: string } })['m.relates_to'];
      if (rel?.rel_type === 'm.replace') continue;
      const sender = e.getSender();
      const role = sender === userId ? ('user' as const) : ('assistant' as const);
      const id = e.getId();
      const ts = e.getTs();
      const formattedBody = typeof (content as { formatted_body?: string }).formatted_body === 'string'
        ? (content as { formatted_body: string }).formatted_body
        : undefined;
      const senderId = role === 'assistant' ? sender : undefined;
      eventMap.set(id, { role, content: String(body), formattedContent: formattedBody, id, createdAt: ts > 0 ? ts : Date.now(), senderId });
    }
    const messages = [...eventMap.values()].sort((a, b) => a.createdAt - b.createdAt).map((m) => ({
      role: m.role,
      content: m.content,
      formattedContent: m.formattedContent,
      id: m.id,
      createdAt: m.createdAt,
      senderId: m.senderId,
    }));
    if (messages.length === 0) return false;
    store.setMessages(roomId, messages);
    const title = (room.name ?? '').trim() || roomId;
    ensureSession?.(roomId, title);
    return true;
  });
}
