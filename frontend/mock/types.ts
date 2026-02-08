/**
 * Mock 会话层类型定义。
 * 可配合 @faker-js/faker、msw 等专业 mock 库扩展。
 */

export type MockSessionType = 'private' | 'group'

/** 会话成员：用户或通过 @ 拉入的机器人 */
export type MockParticipantKind = 'user' | 'bot'
export type MockParticipant = { name: string; avatar?: string; kind?: MockParticipantKind }

export interface MockSessionItem {
  id: string
  title: string
  type: MockSessionType
  updatedAt: number
  participants?: MockParticipant[]
}
