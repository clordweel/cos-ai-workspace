/**
 * 环境与常量（阶段 1 子集，与现 middleware 对齐便于对照）
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(__dirname, '..', '..', '..', '.env');
dotenv.config({ path: rootEnv });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: Number(process.env.API_PORT) || Number(process.env.PORT) || 3002,
  logto: {
    endpoint: (process.env.LOGTO_ENDPOINT || '').replace(/\/$/, ''),
    appId: process.env.LOGTO_APP_ID || '',
    appSecret: process.env.LOGTO_APP_SECRET || '',
  },
  publicOrigin: (process.env.MIDDLEWARE_PUBLIC_ORIGIN || process.env.API_PUBLIC_ORIGIN || '').replace(/\/$/, ''),
  frontendOrigin: process.env.FRONTEND_ORIGIN || process.env.MIDDLEWARE_PUBLIC_ORIGIN || 'http://localhost:3003',
};
