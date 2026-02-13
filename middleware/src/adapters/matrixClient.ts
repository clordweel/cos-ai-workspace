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

/**
 * 设置房间名称（PUT state m.room.name）
 * userToken 必填：须以当前用户 token 发送，需为房间成员且有权限
 */
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
  // 仅保留时间线消息；m.room.name / m.room.member 为状态事件，与 Cinny 一致不放入聊天流
  const events = chunk.filter(
    (e) => e.type === 'm.room.message' && e.content?.body != null
  );
  return { events, nextToken: data.end };
}

/**
 * 发送一条文本消息到房间
 * userToken 必填：必须以当前用户 token 发送，否则消息归属到 admin
 * @param inReplyToEventId - 回复某条消息时，被回复消息的 event_id
 * @param formattedBody - 可选，HTML 富文本；有则带 format: org.matrix.custom.html
 */
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

/**
 * 撤回（redact）房间内一条消息：服务端移除内容，需当前用户 token
 * @see https://spec.matrix.org/latest/client-server-api/#put_matrixclientv3roomsroomidredacteventidtxnid
 */
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

/**
 * 编辑房间内一条消息（发送 m.replace 关系事件），需当前用户 token
 * @see MSC2676 / m.replace, m.new_content
 */
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
 * 获取当前用户的 account_data（必须使用用户 token，禁止 admin token）
 * @see https://spec.matrix.org/latest/client-server-api/#get_matrixclientv3useruseridaccount_datatype
 */
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

/**
 * 设置当前用户的 account_data（必须使用用户 token；整份覆盖该 type）
 * @see https://spec.matrix.org/latest/client-server-api/#put_matrixclientv3useruseridaccount_datatype
 */
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

/**
 * 若仅有 password 无 token，可调用此方法预热 token（可选）
 */
export function clearTokenCache(): void {
  cachedToken = null;
}
