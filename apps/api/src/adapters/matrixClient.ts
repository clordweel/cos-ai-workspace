/**
 * Matrix Client-Server API 封装（仅 REST，无 sync）
 * 在 api 包内重新实现，不依赖 middleware；供会话适配器与 ensureMatrixUser/ensureMatrixToken 使用。
 */
import { config } from '../config.js';

const basePath = '/_matrix/client/v3';

/** Matrix 请求默认超时（毫秒），参考 MATRIX_CLIENT_BEST_PRACTICES */
const DEFAULT_MATRIX_REQUEST_TIMEOUT_MS = 30_000;
/** 429 最大重试次数（不含首次请求） */
const MAX_429_RETRIES = 3;
/** 429 等待时间上限（毫秒） */
const MAX_RETRY_AFTER_MS = 120_000;
const MIN_RETRY_AFTER_MS = 1_000;

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

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 从 429 响应中安全解析等待时间（参考 MATRIX_CLIENT_BEST_PRACTICES §1.3）
 * 优先 Retry-After 头（秒），否则 retry_after_ms；上下限 [MIN_RETRY_AFTER_MS, MAX_RETRY_AFTER_MS]
 */
function safeGetRetryAfterMs(res: Response, body: { retry_after_ms?: number }, attempt: number): number {
  const defaultMs = Math.min(1000 * 2 ** attempt, MAX_RETRY_AFTER_MS);
  const ra = res.headers.get('Retry-After');
  if (ra != null && ra !== '') {
    const sec = parseInt(ra, 10);
    if (Number.isInteger(sec) && sec > 0) {
      const ms = sec * 1000;
      return Math.min(Math.max(ms, MIN_RETRY_AFTER_MS), MAX_RETRY_AFTER_MS);
    }
  }
  const ms = body?.retry_after_ms;
  if (typeof ms === 'number' && Number.isInteger(ms) && ms > 0) {
    return Math.min(Math.max(ms, MIN_RETRY_AFTER_MS), MAX_RETRY_AFTER_MS);
  }
  return defaultMs;
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

/** 供 Synapse Admin API、ensureMatrixUser 等复用：获取当前 Matrix 认证 token（需为管理员账号） */
export async function getMatrixAccessToken(): Promise<string> {
  return getAccessToken();
}

const MAX_LOGIN_RETRIES = 3;
const MAX_RETRY_WAIT_MS = 15000;

/** 用户 Matrix 登录：用 MXID + 密码换取 access_token；429 时按 retry_after_ms 等待并重试 */
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

export async function matrixFetchWithToken(
  path: string,
  options: RequestInit & { query?: Record<string, string> } = {},
  token: string
): Promise<Response> {
  const { query, signal: userSignal, ...rest } = options;
  let url = `${config.matrix.baseUrl}${basePath}${path}`;
  if (query && Object.keys(query).length) {
    const qs = new URLSearchParams(query).toString();
    url += (path.includes('?') ? '&' : '?') + qs;
  }
  const signal = userSignal ?? AbortSignal.timeout(DEFAULT_MATRIX_REQUEST_TIMEOUT_MS);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string>),
  };

  let lastRes: Response | null = null;
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    lastRes = await fetch(url, { ...rest, signal, headers });
    if (lastRes.status !== 429 || attempt === MAX_429_RETRIES) return lastRes;
    const data = (await lastRes.json().catch(() => ({}))) as { retry_after_ms?: number };
    const waitMs = safeGetRetryAfterMs(lastRes, data, attempt);
    await sleep(waitMs);
  }
  return lastRes!;
}

export interface MatrixRoomSummary {
  room_id: string;
  name?: string;
}

export async function getMatrixWhoami(
  userToken: string
): Promise<{ user_id: string | null; device_id: string | null }> {
  const res = await matrixFetchWithToken('/account/whoami', {}, userToken);
  const data = (await res.json().catch(() => ({}))) as {
    user_id?: string;
    device_id?: string;
    error?: string;
  };
  if (!res.ok) {
    return { user_id: null, device_id: null };
  }
  return {
    user_id: data.user_id?.trim() ?? null,
    device_id: typeof data.device_id === 'string' && data.device_id.trim() ? data.device_id.trim() : null,
  };
}

export async function getMatrixUserIdFromToken(userToken: string): Promise<string | null> {
  const { user_id } = await getMatrixWhoami(userToken);
  return user_id;
}

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

export async function verifyMatrixTokenUserId(
  userToken: string,
  expectedUserId: string
): Promise<boolean> {
  const actual = await getMatrixUserIdFromToken(userToken);
  const expected = expectedUserId?.trim();
  return !!actual && !!expected && actual === expected;
}

export async function getJoinedRooms(userToken?: string): Promise<string[]> {
  if (!userToken?.trim()) {
    throw new MatrixApiError('getJoinedRooms 需要用户 token', 0);
  }
  const res = await matrixFetchWithToken('/joined_rooms', {}, userToken);
  const data = (await res.json()) as { joined_rooms?: string[]; error?: string };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
  return data.joined_rooms || [];
}

export interface InvitedRoom {
  roomId: string;
  name?: string;
}

export async function getInvitedRooms(userToken: string): Promise<InvitedRoom[]> {
  if (!userToken?.trim()) {
    throw new MatrixApiError('getInvitedRooms 需要用户 token', 0);
  }
  const res = await matrixFetchWithToken('/sync?timeout=0', {}, userToken);
  const data = (await res.json()) as {
    rooms?: {
      invite?: Record<string, { invite_state?: { events?: Array<{ type?: string; content?: { name?: string } }> } }>;
    };
    error?: string;
  };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
  const invite = data.rooms?.invite ?? {};
  const out: InvitedRoom[] = [];
  for (const roomId of Object.keys(invite)) {
    let name: string | undefined;
    const events = invite[roomId]?.invite_state?.events ?? [];
    const nameEv = events.find((e) => e.type === 'm.room.name');
    if (nameEv?.content?.name != null) name = String(nameEv.content.name).trim() || undefined;
    out.push({ roomId, name });
  }
  return out;
}

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

export async function setRoomName(
  roomId: string,
  name: string,
  userToken: string
): Promise<void> {
  if (!userToken?.trim()) {
    throw new MatrixApiError('setRoomName 需要用户 token', 0);
  }
  const encoded = encodeURIComponent(roomId);
  const res = await matrixFetchWithToken(
    `/rooms/${encoded}/state/m.room.name`,
    {
      method: 'PUT',
      body: JSON.stringify({ name: name.trim() || roomId }),
    },
    userToken
  );
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
}

export interface MatrixMessageEvent {
  event_id: string;
  sender: string;
  origin_server_ts: number;
  content?: {
    body?: string;
    msgtype?: string;
    'm.relates_to'?: {
      'm.in_reply_to'?: { event_id?: string };
    };
    membership?: string;
    displayname?: string;
    name?: string;
  };
  type: string;
  state_key?: string;
}

export interface RoomMessagesResponse {
  start?: string;
  end?: string;
  chunk?: MatrixMessageEvent[];
}

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
  const events = chunk.filter(
    (e) =>
      (e.type === 'm.room.message' && e.content?.body != null) ||
      (typeof e.type === 'string' && e.type.startsWith('m.call.'))
  );
  return { events, nextToken: data.end };
}

const basePathV1 = '/_matrix/client/v1';

export async function getRoomEvent(
  roomId: string,
  eventId: string,
  userToken: string
): Promise<MatrixMessageEvent | null> {
  const encRoom = encodeURIComponent(roomId);
  const encEvent = encodeURIComponent(eventId);
  const res = await matrixFetchWithToken(`/rooms/${encRoom}/event/${encEvent}`, {}, userToken);
  if (!res.ok) return null;
  const data = (await res.json()) as MatrixMessageEvent & { error?: string };
  return data.event_id ? data : null;
}

export async function getRoomRelations(
  roomId: string,
  eventId: string,
  relType: string,
  userToken: string
): Promise<MatrixMessageEvent[]> {
  const encRoom = encodeURIComponent(roomId);
  const encEvent = encodeURIComponent(eventId);
  const url = `${config.matrix.baseUrl}${basePathV1}/rooms/${encRoom}/relations/${encEvent}?rel_type=${encodeURIComponent(relType)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${userToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { chunk?: MatrixMessageEvent[]; error?: string };
  const chunk = data.chunk ?? [];
  return Array.isArray(chunk) ? chunk : [];
}

export async function getRoomLastActivityTs(
  roomId: string,
  userToken: string
): Promise<number> {
  if (!userToken?.trim()) return 0;
  const { events } = await getRoomMessages(roomId, 1, undefined, userToken);
  const ts = events[0]?.origin_server_ts;
  return typeof ts === 'number' && ts > 0 ? ts : 0;
}

export async function sendRoomMessage(
  roomId: string,
  body: string,
  msgtype = 'm.text',
  userToken?: string,
  inReplyToEventId?: string,
  formattedBody?: string
): Promise<{ event_id: string }> {
  if (!userToken?.trim()) {
    throw new MatrixApiError('sendRoomMessage 必须使用当前用户 token，禁止回退到 admin', 0);
  }
  const encoded = encodeURIComponent(roomId);
  const content: Record<string, unknown> = { msgtype, body };
  if (formattedBody?.trim()) {
    content.format = 'org.matrix.custom.html';
    content.formatted_body = formattedBody.trim();
  }
  if (inReplyToEventId?.trim()) {
    content['m.relates_to'] = {
      'm.in_reply_to': { event_id: inReplyToEventId.trim() },
    };
  }
  const res = await matrixFetchWithToken(
    `/rooms/${encoded}/send/m.room.message`,
    { method: 'POST', body: JSON.stringify(content) },
    userToken
  );
  const data = (await res.json()) as { event_id?: string; error?: string };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
  return { event_id: data.event_id! };
}

export async function redactRoomMessage(
  roomId: string,
  eventId: string,
  userToken: string
): Promise<{ event_id: string }> {
  if (!userToken?.trim()) {
    throw new MatrixApiError('redactRoomMessage 必须使用当前用户 token', 0);
  }
  const encoded = encodeURIComponent(roomId);
  const eventIdEnc = encodeURIComponent(eventId);
  const txnId = `redact-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const res = await matrixFetchWithToken(
    `/rooms/${encoded}/redact/${eventIdEnc}/${txnId}`,
    { method: 'PUT', body: JSON.stringify({}) },
    userToken
  );
  const data = (await res.json()) as { event_id?: string; error?: string };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
  return { event_id: data.event_id ?? eventId };
}

export async function editRoomMessage(
  roomId: string,
  eventId: string,
  newBody: string,
  userToken: string,
  formattedBody?: string
): Promise<{ event_id: string }> {
  if (!userToken?.trim()) {
    throw new MatrixApiError('editRoomMessage 必须使用当前用户 token', 0);
  }
  const encoded = encodeURIComponent(roomId);
  const content: Record<string, unknown> = {
    msgtype: 'm.text',
    body: ` * ${newBody}`,
    'm.relates_to': { rel_type: 'm.replace', event_id: eventId },
    'm.new_content': {
      msgtype: 'm.text',
      body: newBody,
    },
  };
  if (formattedBody?.trim()) {
    (content['m.new_content'] as Record<string, unknown>).format = 'org.matrix.custom.html';
    (content['m.new_content'] as Record<string, unknown>).formatted_body = formattedBody.trim();
  }
  const res = await matrixFetchWithToken(
    `/rooms/${encoded}/send/m.room.message`,
    { method: 'POST', body: JSON.stringify(content) },
    userToken
  );
  const data = (await res.json()) as { event_id?: string; error?: string };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
  return { event_id: data.event_id! };
}

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

const ADMIN_JOIN_PATH = '/_synapse/admin/v1/join';

export async function adminJoinUserToRoom(roomId: string, userId: string): Promise<void> {
  const token = await getMatrixAccessToken();
  const { matrix } = config;
  const encoded = encodeURIComponent(roomId);
  const url = `${matrix.baseUrl}${ADMIN_JOIN_PATH}/${encoded}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; errcode?: string };
  if (!res.ok) {
    throw new MatrixApiError(data.error || data.errcode || res.statusText, res.status, data);
  }
}

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

export async function kickFromRoom(
  roomId: string,
  targetUserId: string,
  userToken: string,
  reason?: string
): Promise<void> {
  if (!userToken?.trim()) {
    throw new MatrixApiError('kickFromRoom 必须使用当前用户 token', 0);
  }
  const encoded = encodeURIComponent(roomId);
  const res = await matrixFetchWithToken(
    `/rooms/${encoded}/kick`,
    {
      method: 'POST',
      body: JSON.stringify({ user_id: targetUserId, ...(reason ? { reason } : {}) }),
    },
    userToken
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new MatrixApiError(data.error || res.statusText, res.status, data);
  }
}

export async function banUserFromRoom(
  roomId: string,
  targetUserId: string,
  userToken: string,
  reason?: string
): Promise<void> {
  if (!userToken?.trim()) {
    throw new MatrixApiError('banUserFromRoom 必须使用当前用户 token', 0);
  }
  const encoded = encodeURIComponent(roomId);
  const res = await matrixFetchWithToken(
    `/rooms/${encoded}/ban`,
    {
      method: 'POST',
      body: JSON.stringify({ user_id: targetUserId, ...(reason ? { reason } : {}) }),
    },
    userToken
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new MatrixApiError(data.error || res.statusText, res.status, data);
  }
}

export interface RoomMemberEntry {
  userId: string;
  membership: 'join' | 'invite';
  displayName?: string;
  avatarUrl?: string;
  isOwner?: boolean;
}

export async function getRoomCreator(roomId: string, userToken: string): Promise<string | undefined> {
  if (!userToken?.trim()) return undefined;
  const encoded = encodeURIComponent(roomId);
  const res = await matrixFetchWithToken(
    `/rooms/${encoded}/state/m.room.create/`,
    {},
    userToken
  );
  if (!res.ok) return undefined;
  const data = (await res.json().catch(() => ({}))) as { creator?: string };
  return typeof data.creator === 'string' ? data.creator : undefined;
}

export async function getRoomMembers(roomId: string, userToken: string): Promise<RoomMemberEntry[]> {
  if (!userToken?.trim()) {
    throw new MatrixApiError('getRoomMembers 需要用户 token', 0);
  }
  const encoded = encodeURIComponent(roomId);
  const out: RoomMemberEntry[] = [];

  const joinedRes = await matrixFetchWithToken(
    `/rooms/${encoded}/joined_members`,
    {},
    userToken
  );
  if (joinedRes.ok) {
    const joinedData = (await joinedRes.json()) as { joined?: Record<string, { display_name?: string; avatar_url?: string }> };
    const joined = joinedData.joined ?? {};
    for (const [userId, info] of Object.entries(joined)) {
      out.push({
        userId,
        membership: 'join',
        displayName: info?.display_name,
        avatarUrl: info?.avatar_url,
      });
    }
  }

  const stateRes = await matrixFetchWithToken(
    `/rooms/${encoded}/state`,
    {},
    userToken
  );
  if (stateRes.ok) {
    try {
      const raw = await stateRes.json();
      const stateEvents = Array.isArray(raw) ? raw : [];
      const inviteUserIds = new Set(out.map((m) => m.userId));
      for (const ev of stateEvents as Array<{
        type?: string;
        state_key?: string;
        content?: { membership?: string; displayname?: string; avatar_url?: string };
      }>) {
        if (ev.type !== 'm.room.member' || ev.content?.membership !== 'invite') continue;
        const userId = ev.state_key;
        if (!userId || inviteUserIds.has(userId)) continue;
        inviteUserIds.add(userId);
        out.push({
          userId,
          membership: 'invite',
          displayName: ev.content?.displayname,
          avatarUrl: ev.content?.avatar_url,
        });
      }
    } catch {
      // ignore
    }
  }

  return out;
}

export async function getAccountData(
  userToken: string,
  type: string
): Promise<Record<string, unknown>> {
  if (!userToken?.trim()) {
    throw new MatrixApiError('getAccountData 需要用户 token', 0);
  }
  const userId = await getMatrixUserIdFromToken(userToken);
  if (!userId) throw new MatrixApiError('无法解析用户身份', 0);
  const path = `/user/${encodeURIComponent(userId)}/account_data/${encodeURIComponent(type)}`;
  const res = await matrixFetchWithToken(path, {}, userToken);
  if (res.status === 404) return {};
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!res.ok) throw new MatrixApiError(data.error || res.statusText, res.status, data);
  return data;
}

export async function setAccountData(
  userToken: string,
  type: string,
  content: Record<string, unknown>
): Promise<void> {
  if (!userToken?.trim()) {
    throw new MatrixApiError('setAccountData 需要用户 token', 0);
  }
  const userId = await getMatrixUserIdFromToken(userToken);
  if (!userId) throw new MatrixApiError('无法解析用户身份', 0);
  const path = `/user/${encodeURIComponent(userId)}/account_data/${encodeURIComponent(type)}`;
  const res = await matrixFetchWithToken(path, {
    method: 'PUT',
    body: JSON.stringify(content),
  }, userToken);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new MatrixApiError(data.error || res.statusText, res.status, data);
  }
}

export function clearTokenCache(): void {
  cachedToken = null;
}
