/**
 * @ 提及列表：仅机器人 + 当前房间已加入/已邀请成员（排除自己）。
 * 订阅房间 state 更新，在成员加载或变更时重新计算。
 * 依赖 syncReady：直接进入房间时 sync 可能尚未完成，syncReady 为 true 后再次取 room 并订阅。
 * 初始刷新时 room 可能尚未加入 client：监听 ClientEvent.Room，房间出现时重试并拉取成员。
 */
import { useEffect, useMemo, useState } from 'react';
import * as sdk from 'matrix-js-sdk';
import type { MentionItem } from './useContactsAndBots';
import type { Bot } from './useContactsAndBots';

const JOIN = 'join';
const INVITE = 'invite';

export function useRoomMentionItems(
  syncClient: sdk.MatrixClient | null,
  roomId: string | undefined,
  myUserId: string | undefined,
  bots: Bot[],
  syncReady?: boolean
): MentionItem[] {
  const [roomStateVersion, setRoomStateVersion] = useState(0);
  const [roomReadyVersion, setRoomReadyVersion] = useState(0);

  useEffect(() => {
    if (!syncClient || !roomId) return;
    if (syncReady === false) return;
    const room = syncClient.getRoom(roomId);
    if (room?.currentState) {
      const state = room.currentState;
      const onUpdate = () => setRoomStateVersion((v) => v + 1);
      state.on(sdk.RoomStateEvent.Members, onUpdate);
      state.on(sdk.RoomStateEvent.Update, onUpdate);
      const loadPromise = typeof (room as sdk.Room).loadMembersIfNeeded === 'function'
        ? (room as sdk.Room).loadMembersIfNeeded()
        : Promise.resolve(false);
      loadPromise.then(() => onUpdate()).catch(() => {});
      return () => {
        state.off(sdk.RoomStateEvent.Members, onUpdate);
        state.off(sdk.RoomStateEvent.Update, onUpdate);
      };
    }
    const onRoom = (added: sdk.Room) => {
      if (added?.roomId === roomId) setRoomReadyVersion((v) => v + 1);
    };
    syncClient.on(sdk.ClientEvent.Room, onRoom);
    const retryId = setTimeout(() => {
      if (syncClient.getRoom(roomId)?.currentState) setRoomReadyVersion((v) => v + 1);
    }, 0);
    return () => {
      clearTimeout(retryId);
      syncClient.off(sdk.ClientEvent.Room, onRoom);
    };
  }, [syncClient, roomId, syncReady, roomReadyVersion]);

  return useMemo(() => {
    const botItems: MentionItem[] = bots.map((b) => ({ id: `bot-${b.id}`, display: b.name }));
    if (!syncClient || !roomId || !myUserId) return botItems;
    const room = syncClient.getRoom(roomId);
    if (!room) return botItems;
    const state = room.currentState;
    const botDisplayNames = new Set(bots.map((b) => b.name.trim()).filter(Boolean));
    const allMembers = (room.getMembers?.() ?? state?.getMembers?.() ?? []) as { userId: string; membership?: string; name?: string; rawDisplayName?: string }[];
    const members = allMembers.filter((m) => {
      if (m.userId === myUserId) return false;
      const membership = m.membership ?? '';
      if (membership !== JOIN && membership !== INVITE) return false;
      const display = (m.name ?? m.rawDisplayName ?? '').trim();
      if (botDisplayNames.has(display)) return false;
      return true;
    });
    const roomItems: MentionItem[] = members.map((m) => ({
      id: m.userId,
      display: m.name ?? m.rawDisplayName ?? m.userId,
    }));
    return [...roomItems, ...botItems];
  }, [syncClient, roomId, myUserId, bots, roomStateVersion]);
}
