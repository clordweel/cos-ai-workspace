/**
 * Mock 会话列表：从 mock 数据库读取（@faker-js/faker 生成）。
 */

import { getSessionById, getSessionList } from './db'

export const mockSessionList = getSessionList()

export function getMockSessionById(id: string) {
  return getSessionById(id)
}
