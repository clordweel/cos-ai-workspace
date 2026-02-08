/**
 * 标准化会话/消息类型（与后端无关）
 * 所有适配器负责将后端 API 映射为此模型。
 */

/**
 * @typedef {Object} NormalizedSession
 * @property {string} id - 项目内唯一 id（可与后端会话 id 一致，如 Dify conversation_id）
 * @property {string} title
 * @property {number} updatedAt - 时间戳 ms
 * @property {string} [backendSessionId] - 后端原始会话 id
 * @property {'dify'|'zulip'|'matrix'} [provider]
 */

/**
 * @typedef {Object} NormalizedMessage
 * @property {string} [id]
 * @property {'user'|'assistant'} role
 * @property {string} content
 * @property {string} [thinking]
 * @property {{ type: 'other_user'|'bot'|'system'; label?: string }[]} [sources]
 * @property {string} [receiptStatus]
 * @property {number} [editedAt]
 * @property {string} [backendMessageId]
 * @property {number} [createdAt] - 时间戳 ms
 */

/**
 * 聊天后端适配器接口（JSDoc 约定，各适配器实现此契约）
 * @typedef {Object} ChatBackendAdapter
 * @property {string} name - 'dify'|'zulip'|'matrix'
 * @property {() => boolean} supportsStreaming
 * @property {() => boolean} supportsListSessions
 * @property {() => boolean} supportsListMessages
 * @property {(params: { sessionId: string; backendSessionId?: string; message: string; userId: string; send: (e: string, d: object) => void; flush: () => void }) => Promise<{ backendSessionId?: string; backendMessageId?: string } | void>} streamMessage
 * @property {(params: { userId: string }) => Promise<NormalizedSession[]>} [listSessions]
 * @property {(params: { sessionId: string; backendSessionId?: string; userId: string; limit?: number; beforeId?: string }) => Promise<NormalizedMessage[]>} [listMessages]
 */

export const Types = {}
