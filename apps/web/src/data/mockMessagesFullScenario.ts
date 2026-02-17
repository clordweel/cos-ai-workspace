/**
 * 全场景 Mock 会话消息数据，用于消息列表（Element 风格）调试。
 * 覆盖：系统消息、发送状态、已读/多人已读、来源、反应、编辑、流式、未读/已读等。
 */

export const FULL_SCENARIO_SESSION_ID = 'mock-full-scenario';

export type MessageSourceType = 'other_user' | 'bot' | 'system';
export type MessageSource = { type: MessageSourceType; label?: string };

export type MessageReactionType = 'like' | 'dislike';
export type MessageReaction = { type: MessageReactionType; by: MessageSource };

export type MessageReceiptStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'unread'
  | 'failed';

export interface FullScenarioMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  readBy?: MessageSource[];
  sources?: MessageSource[];
  thinking?: string;
  reactions?: MessageReaction[];
  editedAt?: number;
  editedBy?: MessageSource;
  contentChunks?: string[];
  receiptStatus?: MessageReceiptStatus;
  editableByCurrentUser?: boolean;
  /** 回复引用的消息 id（Element 风格回复线） */
  replyToId?: string;
}

const now = Date.now();
const t = (minOffset: number) => now - minOffset * 60 * 1000;
let idx = 0;
const id = () => `full-${idx++}`;

/** 全场景消息列表：与 Element 消息列表需展示的各类状态一一对应，含对方用户消息，便于调试 */
export const FULL_SCENARIO_MESSAGES: FullScenarioMessage[] = [
  { id: id(), role: 'system', content: '会话已创建', createdAt: t(130) },
  { id: id(), role: 'system', content: 'AI 助手 加入了对话', createdAt: t(129) },
  {
    id: id(),
    role: 'assistant',
    content: '你好，我是对方用户李四，这条是对方用户发的消息。',
    sources: [{ type: 'other_user', label: '李四' }],
    createdAt: t(128.5),
  },
  {
    id: id(),
    role: 'user',
    content: '这条是发送中',
    receiptStatus: 'sending',
    createdAt: t(128),
  },
  {
    id: id(),
    role: 'user',
    content: '这条是已发送',
    receiptStatus: 'sent',
    createdAt: t(126),
  },
  {
    id: id(),
    role: 'user',
    content: '这条是已送达',
    receiptStatus: 'delivered',
    createdAt: t(124),
  },
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
  {
    id: id(),
    role: 'user',
    content: '这条是发送失败',
    receiptStatus: 'failed',
    createdAt: t(118),
  },
  {
    id: id(),
    role: 'assistant',
    content: '对方用户王五也来插一句，方便调试左右布局与头像。',
    sources: [{ type: 'other_user', label: '王五' }],
    createdAt: t(115),
  },
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
    content:
      '根据文档内容，三个要点如下：\n1. 项目周期与里程碑\n2. 资源与预算分配\n3. 风险与应对措施。',
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
  {
    id: id(),
    role: 'system',
    content: '——— 以下为未读/已读示例 ———',
    createdAt: t(102),
  },
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
  // 回复线示例（Element 风格）
  {
    id: id(),
    role: 'user',
    content: '请回复上面那条。',
    receiptStatus: 'read',
    readBy: [{ type: 'bot', label: 'AI 助手' }],
    replyToId: 'full-21',
    createdAt: t(92),
  },
  {
    id: id(),
    role: 'assistant',
    content: '这是对「请回复上面那条」的回复，展示引用线。',
    sources: [{ type: 'bot', label: 'AI 助手' }],
    replyToId: 'full-22',
    createdAt: t(90),
  },
  {
    id: id(),
    role: 'assistant',
    content: '最后一条：对方用户张三的结束语，用于确认对方用户消息在列表中的展示。',
    sources: [{ type: 'other_user', label: '张三' }],
    createdAt: t(88),
  },
];
