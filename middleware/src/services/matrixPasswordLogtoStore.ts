/**
 * Matrix 密码持久化到 Logto customData
 * 使用 AES-256-GCM 加密后存储，配置 MATRIX_PASSWORD_ENCRYPTION_KEY 时启用
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { getLogtoUserCustomData, patchLogtoUserCustomData } from './logtoManagement.js';
import { config } from '../config.js';

const LOGTO_MATRIX_PASSWORD_KEY = 'matrixPasswordEncrypted';
const ALGORITHM = 'aes-256-gcm';
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
const KEY_LEN = 32;

function getEncryptionKey(): Buffer | null {
  const raw = config.matrixPasswordEncryptionKey?.trim();
  if (!raw || raw.length < 16) return null;
  return createHash('sha256').update(raw).digest();
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, enc]).toString('base64');
}

function decrypt(encrypted: string, key: Buffer): string | null {
  try {
    const buf = Buffer.from(encrypted, 'base64');
    if (buf.length < IV_LEN + AUTH_TAG_LEN) return null;
    const iv = buf.subarray(0, IV_LEN);
    const authTag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
    const ciphertext = buf.subarray(IV_LEN + AUTH_TAG_LEN);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  } catch {
    return null;
  }
}

export function isLogtoMatrixPasswordEnabled(): boolean {
  return getEncryptionKey() !== null;
}

export async function getMatrixPasswordFromLogto(logtoSub: string): Promise<string | null> {
  const key = getEncryptionKey();
  if (!key) return null;
  const res = await getLogtoUserCustomData(logtoSub);
  if (!res.ok || !res.customData) return null;
  const enc = res.customData[LOGTO_MATRIX_PASSWORD_KEY];
  if (typeof enc !== 'string') return null;
  return decrypt(enc, key);
}

export async function setMatrixPasswordToLogto(
  logtoSub: string,
  password: string
): Promise<boolean> {
  const key = getEncryptionKey();
  if (!key || !password) return false;
  const enc = encrypt(password, key);
  const current = await getLogtoUserCustomData(logtoSub);
  const existing = current.ok ? current.customData : {};
  const merged = { ...existing, [LOGTO_MATRIX_PASSWORD_KEY]: enc };
  const res = await patchLogtoUserCustomData(logtoSub, merged);
  return res.ok;
}

export async function deleteMatrixPasswordFromLogto(logtoSub: string): Promise<boolean> {
  const key = getEncryptionKey();
  if (!key) return false;
  const current = await getLogtoUserCustomData(logtoSub);
  if (!current.ok) return false;
  const { [LOGTO_MATRIX_PASSWORD_KEY]: _, ...rest } = current.customData;
  const res = await patchLogtoUserCustomData(logtoSub, rest);
  return res.ok;
}
