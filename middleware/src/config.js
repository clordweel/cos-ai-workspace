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

  /** ERPNext / cos 业务接口（物料、订单、库存、BOM 等） */
  cos: {
    /** API 根地址，例如 https://erp.example.com/api（勿带末尾斜杠） */
    baseUrl: (process.env.COS_ERP_BASE || '').replace(/\/$/, ''),
    /** 认证：Bearer Token 或 API Key（由 Frappe/cos 侧约定） */
    apiKey: process.env.COS_ERP_API_KEY || '',
    /** 若使用 API Key + Secret 认证时使用（由 cos 侧约定） */
    apiSecret: process.env.COS_ERP_API_SECRET || '',
    /** 请求超时毫秒数，默认 15000 */
    timeoutMs: Number(process.env.COS_ERP_TIMEOUT_MS) || 15_000,
  },
};
