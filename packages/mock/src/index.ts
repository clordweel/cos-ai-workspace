/**
 * 共享 Mock 会话与消息数据入口。
 * 供 frontend 与 apps/web 使用，与 frontend mock 数据源一致。
 */

export type {
  MockSessionItem,
  MockMessage,
  MockParticipant,
  MockSessionType,
  MockParticipantKind,
  MockMessageSource,
  MockMessageSourceType,
  MockMessageReaction,
  MockMessageReactionType,
  MockMessageReceiptStatus,
} from './types.js';
export {
  getSessionList,
  getSessionById,
  getMessages,
  MOCK_DEBUG_SESSION_ID,
} from './db.js';
