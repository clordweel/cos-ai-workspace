/**
 * Mock 会话列表数据，用于消息列表区占位与联调。
 * 与 frontend mock 结构对齐，后续可替换为接口或 MSW。
 */

export type MockSessionType = 'private' | 'group';

export type MockParticipant = {
  name: string;
  avatar?: string;
  kind?: 'user' | 'bot';
};

export interface MockSessionItem {
  id: string;
  title: string;
  type: MockSessionType;
  updatedAt: number;
  participants?: MockParticipant[];
}

const now = Date.now();
const hour = 60 * 60 * 1000;

export const MOCK_SESSION_LIST: MockSessionItem[] = [
  {
    id: 'mock-debug',
    title: '【调试】全情景',
    type: 'private',
    updatedAt: now,
    participants: [{ name: 'AI 助手', kind: 'bot' }],
  },
  {
    id: 'mock-private-zhangsan',
    title: '张三',
    type: 'private',
    updatedAt: now - 2 * hour,
    participants: [{ name: '张三' }],
  },
  {
    id: 'mock-private-lisi',
    title: '李四',
    type: 'private',
    updatedAt: now - 5 * hour,
    participants: [{ name: '李四' }],
  },
  {
    id: 'mock-private-wangwu',
    title: '王五',
    type: 'private',
    updatedAt: now - 24 * hour,
    participants: [{ name: '王五' }],
  },
  {
    id: 'mock-private-assistant',
    title: 'AI 助手',
    type: 'private',
    updatedAt: now - 48 * hour,
    participants: [{ name: 'AI 助手', kind: 'bot' }],
  },
  {
    id: 'mock-group-1',
    title: '产品组同步群',
    type: 'group',
    updatedAt: now - 1 * hour,
    participants: [
      { name: '张三' },
      { name: '李四' },
      { name: '王五' },
      { name: 'AI 助手', kind: 'bot' },
    ],
  },
  {
    id: 'mock-group-2',
    title: '订单与物料',
    type: 'group',
    updatedAt: now - 12 * hour,
    participants: [{ name: '物料助手', kind: 'bot' }, { name: '订单助手', kind: 'bot' }],
  },
];
