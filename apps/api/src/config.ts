/**
 * 环境与常量（阶段 1 子集，与现 middleware 对齐便于对照）
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(__dirname, '..', '..', '..', '.env');
const apiEnv = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: rootEnv });
dotenv.config({ path: apiEnv });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: Number(process.env.API_PORT) || Number(process.env.PORT) || 3000,
  logto: {
    endpoint: (process.env.LOGTO_ENDPOINT || '').replace(/\/$/, ''),
    appId: process.env.LOGTO_APP_ID || '',
    appSecret: process.env.LOGTO_APP_SECRET || '',
    m2mAppId: (process.env.LOGTO_M2M_APP_ID || process.env.LOGTO_APP_ID || '').trim(),
    m2mAppSecret: (process.env.LOGTO_M2M_APP_SECRET || process.env.LOGTO_APP_SECRET || '').trim(),
  },
  publicOrigin: (process.env.MIDDLEWARE_PUBLIC_ORIGIN || process.env.API_PUBLIC_ORIGIN || '').replace(/\/$/, ''),
  frontendOrigin: process.env.FRONTEND_ORIGIN || process.env.MIDDLEWARE_PUBLIC_ORIGIN || 'http://localhost:3001',
  /** 与现 middleware 一致：聊天适配器 mock | matrix */
  chat: { provider: (process.env.CHAT_PROVIDER || 'mock').toLowerCase() },
  /** Matrix：在 api 内重新实现，不依赖 middleware */
  matrix: {
    baseUrl: (process.env.MATRIX_BASE_URL || '').replace(/\/$/, ''),
    serverName: process.env.MATRIX_SERVER_NAME || (() => {
      try { return new URL(process.env.MATRIX_BASE_URL || 'http://localhost:8008').hostname; } catch { return 'localhost'; }
    })(),
    userId: (process.env.MATRIX_USER_ID || '').trim(),
    accessToken: (process.env.MATRIX_ACCESS_TOKEN || '').trim(),
    password: (process.env.MATRIX_PASSWORD || '').trim(),
    botUserId: (process.env.MATRIX_BOT_USER_ID || '').trim(),
    botAccessToken: (process.env.MATRIX_BOT_ACCESS_TOKEN || '').trim(),
  },
};
