/**
 * Mock 会话数据库：基于 @faker-js/faker 生成会话与消息，与 frontend mock 数据源一致。
 * 单例内存存储，供 getSessionList / getMessages 使用。
 */

import { faker } from '@faker-js/faker';
import type { MockSessionItem, MockMessage } from './types.js';

const MOCK_SEED = 42;
faker.seed(MOCK_SEED);

/** 全情景调试会话 id，与 frontend 一致 */
export const MOCK_DEBUG_SESSION_ID = 'mock-debug-scenarios';

const USER_PHRASES = [
  '下周一的会议材料能先发一版吗？',
  '合同条款里交付周期那块再对一下。',
  '新版本大概什么时候能提测？',
  '帮我总结一下刚才文档里的三个要点。',
  '展开讲一下第 2 点。',
  '创建一个物料，名称「测试螺丝 M3」，编码用自动的。',
  '查一下订单 SO-2024-0088 的进度。',
  '产品组同步一下：下个迭代需求评审改到周三下午。',
  '这个方案用 Redis 做缓存，大家看有没有坑？',
  '支持，上周刚升过。',
  '新版首页的视觉稿大家看一下，有问题直接标在 Figma 上。',
  '客户那边要求把交付日期提前一周，能协调吗？',
  '这个需求用 AI 能自动生成初版配置吗？',
  '好，我整理一下发群里。',
];

const ASSISTANT_PHRASES = [
  '好的，我明天下午前整理好发你。需要把上季度的数据也附上吗？',
  '收到，一起做进表格里。',
  '我看了，目前写的是 30 个工作日，和销售那边确认过没问题。要改成自然日吗？',
  '先保持工作日，有变动再说。',
  '预计周三晚上打包，周四上午可以开始测。',
  '根据文档内容，三个要点如下：\n1. 项目周期与里程碑安排\n2. 资源与预算分配原则\n3. 风险与应对措施。',
  '资源与预算方面，文档中约定按阶段拨付，首期 40%，验收后 50%，尾款 10%。',
  '已根据您的描述生成草稿，请确认后即可正式创建。',
  '订单当前状态：已生产 80%，预计 2 日后入库。需要我帮你催一下物流吗？',
  '收到，周三下午没问题。',
  'OK，已更新日历。',
  '过期策略要定好，建议按业务键分桶，避免大 key。',
  '我们现有集群版本支持吗？要确认一下。',
  '那我没问题了，可以按这个方案推进。',
  '整体风格没问题，导航栏和底部 CTA 的对比度我标了两处建议。',
  '收到，我下午改一版。',
  '产线可以挤一挤，但需要采购先确认原料到货时间。',
  '原料没问题，已经加急。',
  '可以，把业务规则和字段说明发给我，我生成一份配置草稿。',
  '收到，等你的文档。',
];

function pick<T>(arr: T[]): T {
  return arr[faker.number.int({ min: 0, max: arr.length - 1 })]!;
}

function buildPrivateSessions(): MockSessionItem[] {
  const names = ['张三', '李四', '王五', 'AI 助手', '物料助手', '订单助手'];
  const ids = [
    'mock-private-zhangsan',
    'mock-private-lisi',
    'mock-private-wangwu',
    'mock-private-assistant',
    'mock-private-material',
    'mock-private-order',
  ];
  const now = Date.now();
  return ids.map((id, i) => ({
    id,
    title: names[i]!,
    type: 'private' as const,
    updatedAt: now - faker.number.int({ min: 1, max: 72 }) * 60 * 60 * 1000,
    participants: [{ name: names[i]! }],
  }));
}

function buildDebugSession(): MockSessionItem {
  return {
    id: MOCK_DEBUG_SESSION_ID,
    title: '【调试】全情景',
    type: 'private',
    updatedAt: Date.now(),
    participants: [{ name: 'AI 助手', kind: 'bot' }],
  };
}

const GROUP_BOTS = ['物料助手', 'AI 助手', '订单助手'] as const;

function buildGroupSessions(): MockSessionItem[] {
  const now = Date.now();
  const groups: { id: string; title: string; users: string[]; botNames?: string[] }[] = [
    { id: 'mock-group-product', title: '产品组 (3人+1 机器人)', users: ['小甲', '小乙', '小丙'], botNames: ['物料助手'] },
    { id: 'mock-group-tech', title: '技术讨论 (5人+1 机器人)', users: ['小明', '小红', '小刚', '小丽'], botNames: ['AI 助手'] },
    { id: 'mock-group-design', title: '设计评审 (4人)', users: ['设计A', '设计B', '设计C', '设计D'] },
    { id: 'mock-group-customer', title: '客户对接 (6人+1 机器人)', users: ['客户甲', '客户乙', '客户丙', '客户丁'], botNames: ['订单助手'] },
    { id: 'mock-group-ai', title: 'AI 协作群 (4人)', users: ['助手', '张三', '李四', '王五'] },
  ];
  return groups.map((g) => ({
    id: g.id,
    title: g.title,
    type: 'group' as const,
    updatedAt: now - faker.number.int({ min: 1, max: 48 }) * 60 * 60 * 1000,
    participants: [
      ...g.users.map((name) => ({ name, kind: 'user' as const })),
      ...(g.botNames ?? []).map((name) => ({ name, kind: 'bot' as const })),
    ],
  }));
}

/** 为会话生成基础消息（仅 id/role/content/createdAt），与 frontend buildMessagesForSession 逻辑一致 */
function buildMessagesForSession(session: MockSessionItem): MockMessage[] {
  const count = faker.number.int({ min: 2, max: 4 });
  const list: MockMessage[] = [];
  const isGroup = session.type === 'group';
  const participants = session.participants ?? [{ name: session.title }];
  const userLabels = participants.filter((p) => p.kind !== 'bot').map((p) => p.name);
  const botLabels = participants.filter((p) => p.kind === 'bot').map((p) => p.name);
  const baseTime = Date.now() - faker.number.int({ min: 24, max: 72 }) * 60 * 60 * 1000;
  let offsetMin = 0;
  let msgIndex = 0;
  const nextTs = () => {
    offsetMin += faker.number.int({ min: 2, max: 8 });
    return baseTime + offsetMin * 60 * 1000;
  };
  const push = (role: MockMessage['role'], content: string) => {
    list.push({ id: `msg-${session.id}-${msgIndex++}`, role, content, createdAt: nextTs() });
  };

  if (isGroup && userLabels.length > 0) {
    push('system', '会话已创建');
    push('system', `${userLabels[0]} 创建了群聊`);
    if (botLabels.length > 0) push('system', `${botLabels[0]} 加入了群聊`);
  } else {
    push('system', '会话已创建');
  }

  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) {
      push('user', pick(USER_PHRASES));
    } else {
      push('assistant', pick(ASSISTANT_PHRASES));
    }
  }
  return list;
}

/** 全情景调试消息：每条对应一种可展示状态，便于调试气泡、已读、工具栏等；含时间戳与系统消息 */
function buildDebugScenarioMessages(): MockMessage[] {
  const now = Date.now();
  const t = (minOffset: number) => now - minOffset * 60 * 1000;
  let i = 0;
  const id = () => `dbg-${i++}`;
  return [
    { id: id(), role: 'system', content: '会话已创建', createdAt: t(130) },
    { id: id(), role: 'system', content: 'AI 助手 加入了对话', createdAt: t(129) },
    { id: id(), role: 'user', content: '这条是发送中', receiptStatus: 'sending', createdAt: t(128) },
    { id: id(), role: 'user', content: '这条是已发送', receiptStatus: 'sent', createdAt: t(126) },
    { id: id(), role: 'user', content: '这条是已送达', receiptStatus: 'delivered', createdAt: t(124) },
    {
      id: id(),
      role: 'user',
      content: '这条是已读（气泡外对方头像）',
      receiptStatus: 'read',
      readBy: [{ type: 'bot', label: 'AI 助手' }],
      createdAt: t(122),
    },
    {
      id: id(),
      role: 'user',
      content: '已读且多人已读',
      receiptStatus: 'read',
      readBy: [
        { type: 'bot', label: 'AI 助手' },
        { type: 'other_user', label: '李四' },
      ],
      createdAt: t(120),
    },
    { id: id(), role: 'user', content: '这条是发送失败', receiptStatus: 'failed', createdAt: t(118) },
    {
      id: id(),
      role: 'assistant',
      content: '这是普通回复，单来源 bot，无思考过程。',
      sources: [{ type: 'bot', label: 'AI 助手' }],
      createdAt: t(116),
    },
    {
      id: id(),
      role: 'assistant',
      content: '根据文档内容，三个要点如下：\n1. 项目周期与里程碑\n2. 资源与预算分配\n3. 风险与应对措施。',
      thinking: '用户要求总结文档要点。从上下文中提取并分条列出，保持简洁。',
      sources: [{ type: 'bot', label: 'AI 助手' }],
      createdAt: t(114),
    },
    {
      id: id(),
      role: 'assistant',
      content: '思考中…',
      sources: [{ type: 'bot', label: 'AI 助手' }],
      createdAt: t(112),
    },
    {
      id: id(),
      role: 'assistant',
      content: '这条由机器人与用户协作生成，展示多来源头像堆叠。',
      sources: [
        { type: 'bot', label: 'AI 助手' },
        { type: 'other_user', label: '张三' },
      ],
      createdAt: t(110),
    },
    {
      id: id(),
      role: 'assistant',
      content: '这是一条系统/外部程序触发的回复。',
      sources: [{ type: 'system', label: '定时任务' }],
      createdAt: t(108),
    },
    {
      id: id(),
      role: 'assistant',
      content: '有人点赞这条消息时，会显示「觉得很赞」。',
      sources: [{ type: 'bot', label: 'AI 助手' }],
      reactions: [
        { type: 'like', by: { type: 'other_user', label: '王五' } },
        { type: 'like', by: { type: 'other_user', label: '李四' } },
      ],
      createdAt: t(106),
    },
    {
      id: id(),
      role: 'assistant',
      content: '这条消息已被编辑过，会显示「已编辑」及编辑者。',
      sources: [{ type: 'bot', label: 'AI 助手' }],
      editedAt: now - 120_000,
      editedBy: { type: 'other_user', label: '张三' },
      createdAt: t(104),
    },
    { id: id(), role: 'system', content: '——— 以下为未读/已读示例 ———', createdAt: t(102) },
    {
      id: id(),
      role: 'assistant',
      content: '这是未读的助手消息，会话列表会显示未读角标。',
      sources: [{ type: 'bot', label: 'AI 助手' }],
      receiptStatus: 'unread',
      createdAt: t(100),
    },
    {
      id: id(),
      role: 'assistant',
      content: '这是已读的助手消息。',
      sources: [{ type: 'bot', label: 'AI 助手' }],
      receiptStatus: 'read',
      createdAt: t(98),
    },
    {
      id: id(),
      role: 'assistant',
      content: '这条来自组织更高权限者，当前用户不可编辑，底部不显示编辑按钮。',
      sources: [{ type: 'other_user', label: '管理员' }],
      editableByCurrentUser: false,
      createdAt: t(96),
    },
    {
      id: id(),
      role: 'assistant',
      content: '流式输出的完整内容在这里。',
      contentChunks: ['流式', '输出的', '完整', '内容', '在这里。'],
      sources: [{ type: 'bot', label: 'AI 助手' }],
      createdAt: t(94),
    },
  ];
}

const sessionList: MockSessionItem[] = [
  buildDebugSession(),
  ...buildPrivateSessions(),
  ...buildGroupSessions(),
];

const messagesBySessionId = new Map<string, MockMessage[]>();
sessionList.forEach((s) => {
  messagesBySessionId.set(
    s.id,
    s.id === MOCK_DEBUG_SESSION_ID ? buildDebugScenarioMessages() : buildMessagesForSession(s)
  );
});

export function getSessionList(): MockSessionItem[] {
  return sessionList;
}

export function getSessionById(id: string): MockSessionItem | undefined {
  return sessionList.find((s) => s.id === id);
}

export function getMessages(sessionId: string): MockMessage[] {
  return messagesBySessionId.get(sessionId) ?? [];
}
