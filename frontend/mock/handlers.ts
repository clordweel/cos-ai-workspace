/**
 * MSW 请求处理器：将 mock 数据库以 REST 形式暴露。
 * 供开发/演示时通过 API 获取会话与消息（可选）。
 */

import { http, HttpResponse } from 'msw'
import { getSessionById, getMessages, getSessionList } from './db'

const base = '/api/mock'

export const mockHandlers = [
  http.get(`${base}/sessions`, () => {
    return HttpResponse.json(getSessionList())
  }),
  http.get(`${base}/sessions/:id`, ({ params }) => {
    const session = getSessionById(params.id as string)
    if (!session) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(session)
  }),
  http.get(`${base}/sessions/:id/messages`, ({ params }) => {
    const list = getMessages(params.id as string)
    return HttpResponse.json(list)
  }),
]
