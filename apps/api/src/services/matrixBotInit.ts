/**
 * 部署时根据 Dify + Matrix 配置自动创建/加载 AI 助手 bot 账号
 * 满足「系统部署时初始化一个 AI 助手」：未配置 MATRIX_BOT_* 时用 Admin API 创建 bot 并持久化 token
 */
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { getMatrixAccessToken, loginAsUser } from '../adapters/matrixClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_PATH = '/_synapse/admin/v2/users';
/** Token 存于 apps/api/data/，与 src 平级，便于 .gitignore 且不混入源码 */
const BOT_TOKEN_FILE = path.resolve(__dirname, '..', '..', 'data', '.matrix-bot-token');
/** 兼容旧位置 src/data/（已废弃，仅读取时回退） */
const BOT_TOKEN_FILE_LEGACY = path.resolve(__dirname, '..', 'data', '.matrix-bot-token');

const DEFAULT_BOT_LOCALPART = 'ai-assistant';
const BOT_DISPLAYNAME = 'AI 助手';

function generatePassword(): string {
  return randomBytes(24).toString('base64url');
}

function getBotLocalpart(): string {
  const v = (process.env.MATRIX_BOT_LOCALPART || '').trim();
  return v || DEFAULT_BOT_LOCALPART;
}

function getBotUserId(): string {
  const localpart = getBotLocalpart();
  return `@${localpart}:${config.matrix.serverName}`;
}

async function readStoredBotToken(): Promise<{ botUserId: string; accessToken: string } | null> {
  const tryRead = async (filePath: string) => {
    try {
      const raw = await readFile(filePath, 'utf8');
      const line = raw.split('\n')[0]?.trim();
      if (!line) return null;
      return { botUserId: getBotUserId(), accessToken: line };
    } catch {
      return null;
    }
  };
  const stored = (await tryRead(BOT_TOKEN_FILE)) ?? (await tryRead(BOT_TOKEN_FILE_LEGACY));
  return stored;
}

async function writeStoredBotToken(accessToken: string): Promise<void> {
  const dir = path.dirname(BOT_TOKEN_FILE);
  await mkdir(dir, { recursive: true });
  await writeFile(BOT_TOKEN_FILE, accessToken + '\n', { mode: 0o600 });
}

function shouldAutoInit(): boolean {
  if (config.chat.provider !== 'matrix') return false;
  if (!config.dify?.apiKey?.trim()) return false;
  if (!config.matrix.baseUrl?.trim() || !config.matrix.serverName?.trim()) return false;
  if (config.matrix.botUserId?.trim() && config.matrix.botAccessToken?.trim()) return false;
  return true;
}

/**
 * 确保 Matrix bot 可用：若已配置 env 则不动；否则尝试从文件读 token；否则用 Admin API 创建 bot 并写 token。
 * 会改写 config.matrix.botUserId / config.matrix.botAccessToken。
 */
export async function ensureMatrixBot(): Promise<void> {
  if (config.matrix.botUserId?.trim() && config.matrix.botAccessToken?.trim()) {
    return;
  }

  const botPassword = (process.env.MATRIX_BOT_PASSWORD || '').trim();
  const botUserId = getBotUserId();

  if (config.matrix.botUserId?.trim() && botPassword) {
    try {
      const { access_token } = await loginAsUser(config.matrix.botUserId, botPassword);
      await writeStoredBotToken(access_token);
      (config.matrix as { botAccessToken: string }).botAccessToken = access_token;
      return;
    } catch {
      /* 登录失败则继续尝试从文件或创建 */
    }
  }

  if (shouldAutoInit()) {
    const stored = await readStoredBotToken();
    if (stored?.accessToken) {
      if (!config.matrix.botUserId?.trim()) (config.matrix as { botUserId: string }).botUserId = stored.botUserId;
      (config.matrix as { botAccessToken: string }).botAccessToken = stored.accessToken;
      return;
    }
  }

  if (!shouldAutoInit()) return;

  let adminToken: string;
  try {
    adminToken = await getMatrixAccessToken();
  } catch {
    return;
  }

  const url = `${config.matrix.baseUrl}${ADMIN_PATH}/${encodeURIComponent(botUserId)}`;
  const getRes = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${adminToken}` } });

  if (getRes.status === 200) {
    if (botPassword) {
      try {
        const { access_token } = await loginAsUser(botUserId, botPassword);
        await writeStoredBotToken(access_token);
        (config.matrix as { botUserId: string }).botUserId = botUserId;
        (config.matrix as { botAccessToken: string }).botAccessToken = access_token;
      } catch {
        /* 密码错误则跳过 */
      }
    }
    return;
  }

  if (getRes.status !== 404) return;

  const password = generatePassword();
  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password,
      displayname: BOT_DISPLAYNAME,
      admin: false,
    }),
  });

  if (!putRes.ok) return;

  let accessToken: string;
  try {
    const out = await loginAsUser(botUserId, password);
    accessToken = out.access_token;
  } catch {
    return;
  }

  await writeStoredBotToken(accessToken);
  (config.matrix as { botUserId: string }).botUserId = botUserId;
  (config.matrix as { botAccessToken: string }).botAccessToken = accessToken;
}
