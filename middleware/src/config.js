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

export const config = {
  port: Number(process.env.PORT) || 3000,
  shutdownTimeoutMs: Number(process.env.SHUTDOWN_TIMEOUT_MS) || 15_000,

  dify: {
    apiBase: (process.env.DIFY_API_BASE || 'https://api.dify.ai/v1').replace(/\/$/, ''),
    apiKey: process.env.DIFY_API_KEY || '',
  },

  cos: {
    /** cos/ERPNext API 根地址，例如 https://erp.example.com */
    baseUrl: (process.env.COS_ERP_BASE || '').replace(/\/$/, ''),
    /** 调用 cos 时的认证：Bearer Token 或 API Key（由 cos 侧约定） */
    apiKey: process.env.COS_ERP_API_KEY || '',
  },
};
