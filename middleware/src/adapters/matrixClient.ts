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

/** 429 时按 retry_after_ms 等待后重试一次 */
async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function doLogin(userId: string, password: string): Promise<{ res: Response; data: Record<string, unknown> }> {
  const { matrix } = config;
  const url = `${matrix.baseUrl}${basePath}/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: userId },
      password,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, data };
}

async function getAccessToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const { matrix } = config;
  if (matrix.accessToken?.trim()) {
    cachedToken = matrix.accessToken;
    return cachedToken;
  }
  if (!matrix.password || !matrix.userId) {
    throw new MatrixApiError(
      'Matrix 未配置：请设置 MATRIX_ACCESS_TOKEN 或 MATRIX_USER_ID + MATRIX_PASSWORD',
      0
    );
  }
  let { res, data } = await doLogin(matrix.userId, matrix.password);
  if (res.status === 429 && typeof (data as { retry_after_ms?: number }).retry_after_ms === 'number') {
    const ms = (data as { retry_after_ms: number }).retry_after_ms;
    await sleep(Math.min(ms, 10000));
    const next = await doLogin(matrix.userId, matrix.password);
    res = next.res;
    data = next.data;
  }
  const accessToken = data.access_token as string | undefined;
  if (!res.ok || !accessToken) {
    throw new MatrixApiError(
      (data.error as string) || `Login failed: ${res.status}`,
      res.status,
      data
    );
  }
  cachedToken = accessToken;
  return cachedToken;
}

/** 供 Synapse Admin API 等复用：获取当前 Matrix 认证 token（需为管理员账号） */
export async function getMatrixAccessToken(): Promise<string> {
  return getAccessToken();
}

const MAX_LOGIN_RETRIES = 3;
const MAX_RETRY_WAIT_MS = 15000;

/** 用户 Matrix 登录（每用户 Token）：用 MXID + 密码换取 access_token，不缓存；429 时按 retry_after_ms 等待并重试，最多 3 次 */
export async function loginAsUser(
  matrixUserId: string,
  password: string
): Promise<{ access_token: string; expires_in_ms?: number }> {
  const { matrix } = config;
  if (!matrix.baseUrl) {
    throw new MatrixApiError('Matrix 未配置：MATRIX_BASE_URL', 0);
  }
  let lastRes: Response | null = null;
  let lastData: Record<string, unknown> = {};
  for (let attempt = 0; attempt < MAX_LOGIN_RETRIES; attempt++) {
    const { res, data } = await doLogin(matrixUserId, password);
    lastRes = res;
    lastData = data;
    if (res.status === 429 && typeof (data as { retry_after_ms?: number }).retry_after_ms === 'number') {
      const ms = Math.min((data as { retry_after_ms: number }).retry_after_ms, MAX_RETRY_WAIT_MS);
      if (attempt < MAX_LOGIN_RETRIES - 1) await sleep(ms);
      continue;
    }
    const accessToken = data.access_token as string | undefined;
    if (res.ok && accessToken) {
      return {
        access_token: accessToken,
        expires_in_ms: data.expires_in_ms as number | undefined,
      };
    }
    break;
  }
  throw new MatrixApiError(
    (lastData.error as string) || `Login failed: ${lastRes?.status ?? 0}`,
    lastRes?.status ?? 0,
    lastData
  );
}

async function matrixFetch(
  path: string,
  options: RequestInit & { query?: Record<string, string> } = {}
): Promise<Response> {
  const token = await getAccessToken();
  return matrixFetchWithToken(path, options, token);
}

async function matrixFetchWithToken(
  path: string,
  options: RequestInit & { query?: Record<string, string> } = {},
  token: string
): Promise<Response> {
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
 * 通过 token 调用 whoami，返回该 token 对应的 Matrix user_id
 */
export async function getMatrixUserIdFromToken(
  userToken: string
): Promise<string | null> {
  const res = await matrixFetchWithToken('/account/whoami', {}, userToken);
  const data = (await res.json().catch(() => ({}))) as { user_id?: string; error?: string };
  if (!res.ok) return null;
  return data.user_id?.trim() ?? null;
}

/**
 * 获取配置中的 Matrix 管理员 user_id（用于区分 admin token 与普通用户 token）
 * 当 MATRIX_USER_ID 未配置时，通过 MATRIX_ACCESS_TOKEN 调用 whoami 获取
 */
let cachedAdminUserId: string | null | undefined = undefined;

export async function getMatrixAdminUserId(): Promise<string | null> {
  if (cachedAdminUserId !== undefined) return cachedAdminUserId;
  const { matrix } = config;
  if (matrix.userId?.trim()) {
    cachedAdminUserId = matrix.userId.trim();
    return cachedAdminUserId;
  }
  if (!matrix.accessToken) {
    cachedAdminUserId = null;
    return null;
  }
  const uid = await getMatrixUserIdFromToken(matrix.accessToken);
  cachedAdminUserId = uid ?? null;
  return cachedAdminUserId;
}

/**
 * 校验 token 是否属于指定用户（用于避免错误使用 admin token）
 * @returns true 表示 token 属于该用户，false 表示不匹配需重新获取
 */
export async function verifyMatrixTokenUserId(
  userToken: string,
  expectedUserId: string
): Promise<boolean> {
  const actual = await getMatrixUserIdFromToken(userToken);
  const expected = expectedUserId?.trim();
  return !!actual && !!expected && actual === expected;
}

/**
 * 获取当前用户已加入的房间 ID 列表
 * @param userToken 必填，当前用户 token（禁止传 admin token，否则会返回 admin 的房间）
 */
export async function getJoinedRooms(userToken?: string): Promise<string[]> {
  if (!userToken?.trim()) {
    throw new MatrixApiError('getJoinedRooms 需要用户 token', 0);
  }
  const res = await matrixFetchWithToken('/joined_rooms', {}, userToken);
  const data = (await res.json()) as { joined_rooms?: string[]; error?: string };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
  return data.joined_rooms || [];
}

/**
 * 获取房间名称（state m.room.name）
 */
export async function getRoomName(roomId: string, userToken?: string): Promise<string> {
  const encoded = encodeURIComponent(roomId);
  const res = userToken
    ? await matrixFetchWithToken(`/rooms/${encoded}/state/m.room.name`, {}, userToken)
    : await matrixFetch(`/rooms/${encoded}/state/m.room.name`);
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
  from?: string,
  userToken?: string
): Promise<{ events: MatrixMessageEvent[]; nextToken?: string }> {
  const encoded = encodeURIComponent(roomId);
  const query: Record<string, string> = { limit: String(limit), dir: 'b' };
  if (from) query.from = from;
  const res = userToken
    ? await matrixFetchWithToken(`/rooms/${encoded}/messages`, { query }, userToken)
    : await matrixFetch(`/rooms/${encoded}/messages`, { query });
  const data = (await res.json()) as RoomMessagesResponse & { error?: string };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
  const chunk = data.chunk || [];
  const events = chunk.filter((e) => e.type === 'm.room.message' && e.content?.body != null);
  return { events, nextToken: data.end };
}

/**
 * 发送一条文本消息到房间
 * userToken 必填：必须以当前用户 token 发送，否则消息归属到 admin
 */
export async function sendRoomMessage(
  roomId: string,
  body: string,
  msgtype = 'm.text',
  userToken?: string
): Promise<{ event_id: string }> {
  if (!userToken?.trim()) {
    throw new MatrixApiError('sendRoomMessage 必须使用当前用户 token，禁止回退到 admin', 0);
  }
  const encoded = encodeURIComponent(roomId);
  const res = await matrixFetchWithToken(
    `/rooms/${encoded}/send/m.room.message`,
    { method: 'POST', body: JSON.stringify({ msgtype, body }) },
    userToken
  );
  const data = (await res.json()) as { event_id?: string; error?: string };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
  return { event_id: data.event_id! };
}

/**
 * 创建房间（可选名称，私聊预设）
 * userToken 必填：必须以当前用户 token 创建，否则房间归属到 admin
 */
export async function createRoom(name?: string, userToken?: string): Promise<{ room_id: string }> {
  if (!userToken?.trim()) {
    throw new MatrixApiError('createRoom 必须使用当前用户 token，禁止回退到 admin', 0);
  }
  const body = JSON.stringify({
    name: name || undefined,
    preset: 'private_chat',
    visibility: 'private',
  });
  const res = await matrixFetchWithToken('/createRoom', { method: 'POST', body }, userToken);
  const data = (await res.json()) as { room_id?: string; error?: string };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
  return { room_id: data.room_id! };
}

/**
 * 邀请用户加入房间（需调用方已在该房间）
 * @param inviteeUserId 被邀请者的 MXID（user_id）
 */
export async function inviteToRoom(
  roomId: string,
  inviteeUserId: string,
  userToken?: string
): Promise<void> {
  const encoded = encodeURIComponent(roomId);
  const res = userToken
    ? await matrixFetchWithToken(
        `/rooms/${encoded}/invite`,
        {
          method: 'POST',
          body: JSON.stringify({ user_id: inviteeUserId }),
        },
        userToken
      )
    : await matrixFetch(`/rooms/${encoded}/invite`, {
        method: 'POST',
        body: JSON.stringify({ user_id: inviteeUserId }),
      });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new MatrixApiError(data.error || res.statusText, res.status, data);
  }
}

/**
 * 加入房间（如接受邀请后 join）
 * @param token 不传则用管理员 token（bot 加入）
 */
export async function joinRoom(roomId: string, token?: string): Promise<void> {
  const encoded = encodeURIComponent(roomId);
  const res = token
    ? await matrixFetchWithToken(`/rooms/${encoded}/join`, { method: 'POST', body: '{}' }, token)
    : await matrixFetch(`/rooms/${encoded}/join`, { method: 'POST', body: '{}' });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new MatrixApiError(data.error || res.statusText, res.status, data);
  }
}

/**
 * 离开房间（用户退出会话，房间仍存在）
 * @param userToken 必填：当前用户 token
 */
export async function leaveRoom(roomId: string, userToken?: string): Promise<void> {
  if (!userToken?.trim()) {
    throw new MatrixApiError('leaveRoom 必须使用当前用户 token', 0);
  }
  const encoded = encodeURIComponent(roomId);
  const res = await matrixFetchWithToken(
    `/rooms/${encoded}/leave`,
    { method: 'POST', body: '{}' },
    userToken
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new MatrixApiError(data.error || res.statusText, res.status, data);
  }
}

/**
 * 若仅有 password 无 token，可调用此方法预热 token（可选）
 */
export function clearTokenCache(): void {
  cachedToken = null;
}
