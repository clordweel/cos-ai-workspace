/**
 * Mock 会话独立模块入口。
 * 会话列表与消息数据集中在此，便于替换为 @faker-js/faker、msw 等专业 mock 库。
 */

export * from './types'
export { mockSessionList, getMockSessionById } from './sessionList'
export { getMockSessionMessages } from './sessionMessages'
export { getSessionList, getSessionById, getMessages, MOCK_DEBUG_SESSION_ID } from './db'
