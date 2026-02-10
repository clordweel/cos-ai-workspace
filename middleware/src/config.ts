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
    userId: string;
    accessToken: string;
    password: string;
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
  };
  /** 中间层对外访问根 URL，用于拼 Logto redirect_uri；不设则从请求头/主机推导 */
  middlewarePublicOrigin: string;
}

export const config: Config = {
  port: Number(process.env.PORT) || 3000,
  shutdownTimeoutMs: Number(process.env.SHUTDOWN_TIMEOUT_MS) || 15_000,

  chat: {
    provider: (process.env.CHAT_PROVIDER || 'mock').toLowerCase(),
  },

  matrix: {
    baseUrl: (process.env.MATRIX_BASE_URL || 'http://10.1.1.15:8008').replace(/\/$/, ''),
    userId: process.env.MATRIX_USER_ID || '',
    accessToken: process.env.MATRIX_ACCESS_TOKEN || '',
    password: process.env.MATRIX_PASSWORD || '',
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
  },

  middlewarePublicOrigin: (process.env.MIDDLEWARE_PUBLIC_ORIGIN || '').replace(/\/$/, ''),
};
