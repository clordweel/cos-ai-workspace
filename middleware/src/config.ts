/**
 * 中间层环境与常量
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(__dirname, '..', '..', '.env');
const cwdEnv = path.resolve(process.cwd(), '.env');
dotenv.config({ path: cwdEnv });
dotenv.config({ path: rootEnv });

export interface Config {
  port: number;
  shutdownTimeoutMs: number;
  chat: { provider: string };
  matrix: {
    baseUrl: string;
    serverName: string;
    userId: string;
    accessToken: string;
    password: string;
    /** 可选：用于把助手回复写入房间的 bot MXID，需配合 botAccessToken */
    botUserId: string;
    /** 可选：bot 的 access token，配置后助手回复会以 bot 身份发到 Matrix 房间 */
    botAccessToken: string;
  };
  /** 可选 MAS：配置后用于 Personal Session 与 set-password 回退，见 masAdminApi.ts */
  mas: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
  };
  dify: { apiBase: string; apiKey: string };
  cos: {
    baseUrl: string;
    apiKey: string;
    apiSecret: string;
    timeoutMs: number;
  };
  logto: {
    endpoint: string;
    appId: string;
    appSecret: string;
    /** 用于 Management API（如修改用户密码）的 M2M 应用；不填则用 appId/appSecret */
    m2mAppId: string;
    m2mAppSecret: string;
  };
  /** 中间层对外访问根 URL，用于拼 Logto redirect_uri；不设则从请求头/主机推导 */
  middlewarePublicOrigin: string;
  /** 会话存储：memory（默认）| redis。redis 时需配置 redisUrl，见 SESSION_PERSISTENCE.md */
  sessionStore: 'memory' | 'redis';
  /** Redis 连接 URL，SESSION_STORE=redis 时必填，如 redis://10.1.1.15:6379 或 redis://:password@host:6379 */
  redisUrl: string;
  /** Matrix 密码加密钥，配置后会将密码加密存 Logto customData 持久化，需 M2M */
  matrixPasswordEncryptionKey: string;
}

export const config: Config = {
  port: Number(process.env.PORT) || 3000,
  shutdownTimeoutMs: Number(process.env.SHUTDOWN_TIMEOUT_MS) || 15_000,

  chat: {
    provider: (process.env.CHAT_PROVIDER || 'mock').toLowerCase(),
  },

  matrix: {
    baseUrl: (process.env.MATRIX_BASE_URL || 'http://10.1.1.15:8008').replace(/\/$/, ''),
    serverName: process.env.MATRIX_SERVER_NAME || (() => {
      try {
        return new URL(process.env.MATRIX_BASE_URL || 'http://10.1.1.15:8008').hostname;
      } catch {
        return 'localhost';
      }
    })(),
    userId: process.env.MATRIX_USER_ID || '',
    accessToken: process.env.MATRIX_ACCESS_TOKEN || '',
    password: process.env.MATRIX_PASSWORD || '',
    botUserId: (process.env.MATRIX_BOT_USER_ID || '').trim(),
    botAccessToken: (process.env.MATRIX_BOT_ACCESS_TOKEN || '').trim(),
  },
  mas: {
    baseUrl: (process.env.MATRIX_BASE_URL || 'http://10.1.1.15:8008').replace(/\/$/, ''),
    clientId: process.env.MAS_ADMIN_CLIENT_ID || '',
    clientSecret: process.env.MAS_ADMIN_CLIENT_SECRET || '',
  },

  dify: {
    apiBase: (process.env.DIFY_API_BASE || 'https://api.dify.ai/v1').replace(/\/$/, ''),
    apiKey: process.env.DIFY_API_KEY || '',
  },

  cos: {
    baseUrl: (process.env.COS_ERP_BASE || '').replace(/\/$/, ''),
    apiKey: process.env.COS_ERP_API_KEY || '',
    apiSecret: process.env.COS_ERP_API_SECRET || '',
    timeoutMs: Number(process.env.COS_ERP_TIMEOUT_MS) || 15_000,
  },

  logto: {
    endpoint: (process.env.LOGTO_ENDPOINT || '').replace(/\/$/, ''),
    appId: process.env.LOGTO_APP_ID || '',
    appSecret: process.env.LOGTO_APP_SECRET || '',
    m2mAppId: process.env.LOGTO_M2M_APP_ID || process.env.LOGTO_APP_ID || '',
    m2mAppSecret: process.env.LOGTO_M2M_APP_SECRET || process.env.LOGTO_APP_SECRET || '',
  },

  middlewarePublicOrigin: (process.env.MIDDLEWARE_PUBLIC_ORIGIN || '').replace(/\/$/, ''),

  sessionStore: (process.env.SESSION_STORE || 'memory').toLowerCase() === 'redis' ? 'redis' : 'memory',
  redisUrl: (process.env.REDIS_URL || '').trim(),
  matrixPasswordEncryptionKey: (process.env.MATRIX_PASSWORD_ENCRYPTION_KEY || '').trim(),
};
