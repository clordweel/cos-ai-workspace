/**
 * Matrix Client-Server API 封装（仅 REST，无 sync）
 * 用于会话适配器：登录、房间列表、消息历史、发消息
 */
import { config } from '../config.js';

const basePath = '/_matrix/client/v3';

export class MatrixApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public body?: unknown
  ) {
    super(message);
    this.name = 'MatrixApiError';
  }
}

let cachedToken: string | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const { matrix } = config;
  if (matrix.accessToken) {
    cachedToken = matrix.accessToken;
    return cachedToken;
  }
  if (!matrix.password || !matrix.userId) {
    throw new MatrixApiError(
      'Matrix 未配置：请设置 MATRIX_ACCESS_TOKEN 或 MATRIX_USER_ID + MATRIX_PASSWORD',
      0
    );
  }
  const url = `${matrix.baseUrl}${basePath}/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: matrix.userId },
      password: matrix.password,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string; errcode?: string };
  if (!res.ok || !data.access_token) {
    throw new MatrixApiError(
      data.error || `Login failed: ${res.status}`,
      res.status,
      data
    );
  }
  cachedToken = data.access_token;
  return cachedToken;
}

async function matrixFetch(
  path: string,
  options: RequestInit & { query?: Record<string, string> } = {}
): Promise<Response> {
  const token = await getAccessToken();
  const { query, ...rest } = options;
  let url = `${config.matrix.baseUrl}${basePath}${path}`;
  if (query && Object.keys(query).length) {
    const qs = new URLSearchParams(query).toString();
    url += (path.includes('?') ? '&' : '?') + qs;
  }
  return fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(rest.headers as Record<string, string>),
    },
  });
}

export interface MatrixRoomSummary {
  room_id: string;
  name?: string;
}

/**
 * 获取当前用户已加入的房间 ID 列表
 */
export async function getJoinedRooms(): Promise<string[]> {
  const res = await matrixFetch('/joined_rooms');
  const data = (await res.json()) as { joined_rooms?: string[]; error?: string };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
  return data.joined_rooms || [];
}

/**
 * 获取房间名称（state m.room.name）
 */
export async function getRoomName(roomId: string): Promise<string> {
  const encoded = encodeURIComponent(roomId);
  const res = await matrixFetch(`/rooms/${encoded}/state/m.room.name`);
  if (res.status === 404) return roomId;
  const data = (await res.json()) as { name?: string; error?: string };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
  return data.name || roomId;
}

export interface MatrixMessageEvent {
  event_id: string;
  sender: string;
  origin_server_ts: number;
  content?: { body?: string; msgtype?: string };
  type: string;
}

export interface RoomMessagesResponse {
  start?: string;
  end?: string;
  chunk?: MatrixMessageEvent[];
}

/**
 * 拉取房间消息（从新到旧，before 为上一页的 end token）
 */
export async function getRoomMessages(
  roomId: string,
  limit: number,
  from?: string
): Promise<{ events: MatrixMessageEvent[]; nextToken?: string }> {
  const encoded = encodeURIComponent(roomId);
  const query: Record<string, string> = { limit: String(limit), dir: 'b' };
  if (from) query.from = from;
  const res = await matrixFetch(`/rooms/${encoded}/messages`, { query });
  const data = (await res.json()) as RoomMessagesResponse & { error?: string };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
  const chunk = data.chunk || [];
  const events = chunk.filter((e) => e.type === 'm.room.message' && e.content?.body != null);
  return { events, nextToken: data.end };
}

/**
 * 发送一条文本消息到房间
 */
export async function sendRoomMessage(
  roomId: string,
  body: string,
  msgtype = 'm.text'
): Promise<{ event_id: string }> {
  const encoded = encodeURIComponent(roomId);
  const res = await matrixFetch(`/rooms/${encoded}/send/m.room.message`, {
    method: 'POST',
    body: JSON.stringify({ msgtype, body }),
  });
  const data = (await res.json()) as { event_id?: string; error?: string };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
  return { event_id: data.event_id! };
}

/**
 * 创建房间（可选名称，私聊预设）
 */
export async function createRoom(name?: string): Promise<{ room_id: string }> {
  const res = await matrixFetch('/createRoom', {
    method: 'POST',
    body: JSON.stringify({
      name: name || undefined,
      preset: 'private_chat',
      visibility: 'private',
    }),
  });
  const data = (await res.json()) as { room_id?: string; error?: string };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
  return { room_id: data.room_id! };
}

/**
 * 若仅有 password 无 token，可调用此方法预热 token（可选）
 */
export function clearTokenCache(): void {
  cachedToken = null;
}
