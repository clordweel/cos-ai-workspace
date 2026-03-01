/**
 * 环境与常量（阶段 1 子集，与现 middleware 对齐便于对照）
 * 仅从 apps/api/.env 加载环境变量，不读取根目录 .env，与根目录彻底隔离。
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiEnv = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: apiEnv, override: true });

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
  /** Matrix：在 api 内重新实现，不依赖 middleware。baseUrl 供服务端请求（需 API 能访问），publicBaseUrl 供 /me 下发给前端 */
  matrix: {
    baseUrl: (process.env.MATRIX_BASE_URL || '').replace(/\/$/, ''),
    publicBaseUrl: (process.env.MATRIX_PUBLIC_BASE_URL || process.env.MATRIX_BASE_URL || '').replace(/\/$/, ''),
    serverName: process.env.MATRIX_SERVER_NAME || (() => {
      try { return new URL(process.env.MATRIX_BASE_URL || 'http://localhost:8008').hostname; } catch { return 'localhost'; }
    })(),
    userId: (process.env.MATRIX_USER_ID || '').trim(),
    accessToken: (process.env.MATRIX_ACCESS_TOKEN || '').trim(),
    password: (process.env.MATRIX_PASSWORD || '').trim(),
    botUserId: (process.env.MATRIX_BOT_USER_ID || '').trim(),
    botAccessToken: (process.env.MATRIX_BOT_ACCESS_TOKEN || '').trim(),
  },
  /** 会话存储：memory（默认）| file | redis。file 时单文件 JSON 持久化，见 docs/SESSION_PERSISTENCE.md */
  sessionStore: (() => {
    const v = (process.env.SESSION_STORE || 'memory').toLowerCase();
    if (v === 'redis') return 'redis' as const;
    if (v === 'file') return 'file' as const;
    return 'memory' as const;
  })(),
  /** SESSION_STORE=file 时会话文件路径，默认 apps/api/data/sessions.json */
  sessionFilePath: (process.env.SESSION_FILE_PATH || '').trim() || path.resolve(path.dirname(apiEnv), 'data', 'sessions.json'),
  redisUrl: (process.env.REDIS_URL || '').trim(),
  /** Dify：@ 助手时流式回复，与 middleware 一致 */
  dify: {
    apiBase: (process.env.DIFY_API_BASE || 'https://api.dify.ai/v1').replace(/\/$/, ''),
    apiKey: (process.env.DIFY_API_KEY || '').trim(),
  },
  /** 系统管理员：指定邮箱视为系统管理员（与当前用户 email 忽略大小写比较），GET /api/auth/me 返回 isSystemAdmin: true */
  systemAdminEmail: (process.env.SYSTEM_ADMIN_EMAIL || '').trim().toLowerCase(),
  /** Frappe/ERPNext（cos、Memo 等）：仅 apps/api 内使用，前端不直连 */
  cos: {
    /** Base URL，如 https://<erpnext-host>/api，末尾无斜杠 */
    baseUrl: (process.env.COS_ERP_BASE || '').replace(/\/$/, ''),
    /** 单 Key 试跑时使用；每用户 Key 时由 ConnectorCredentialsStore 按 logtoSub 取 */
    apiKey: (process.env.COS_ERP_API_KEY || '').trim(),
    apiSecret: (process.env.COS_ERP_API_SECRET || '').trim(),
  },
};
