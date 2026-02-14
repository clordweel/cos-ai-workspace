# 会话系统完善开发计划

> 基于当前实现状态与 Element/Cinny 开源客户端最佳实践，重新梳理会话（Session/Chat）系统的完整需求与开发计划，涵盖会话列表优化、消息处理、实时同步、状态管理、已知问题修复及按阶段实现节奏。  
> 详细任务与状态见 `.cursor/plans/` 下对应计划文件。

---

## 一、现状分析

### 已完成功能

| 功能             | 前端  | 中间层 | Matrix |
| -------------- | --- | --- | ------ |
| 会话列表/历史/流式对话   | ✅   | ✅   | ✅      |
| 创建/删除/重命名会话    | ✅   | ✅   | ✅      |
| 邀请制/接受/拒绝      | ✅   | ✅   | ✅      |
| 成员管理/踢出/屏蔽     | ✅   | ✅   | ✅      |
| 消息编辑/撤回/回复     | ✅   | ✅   | ✅      |
| 置顶/Typing/已读回执 | ✅   | -   | ✅      |
| 实时新消息(Sync)    | ✅   | -   | ✅      |
| Tab 分类/搜索      | ✅   | -   | -      |

### 待完善功能

| 优先级    | 功能                | 说明                  |
| ------ | ----------------- | ------------------- |
| **P1** | Matrix Token 过期校验 | Token 过期后仍被使用直到 401 |
| **P2** | 真实 last_active 排序 | 当前列表排序不准确           |
| **P3** | 会话持久化             | 中间层重启后会话丢失          |
| P3     | 消息编辑历史查看          | 前端有 TODO 占位         |
| P3     | 消息收藏/归档/分享        | 前端有 TODO 占位         |

---

## 二、参考架构（Element RoomList2）

### 2.1 核心设计模式

```
┌─────────────────────────────────────────────────────────┐
│                   RoomListStore                         │
│  (状态协调器)                                            │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Filter    │  │  Algorithm  │  │   Sticky    │     │
│  │  Prefilter  │  │   Manager   │  │   Room      │     │
│  │  Runtime    │  │             │  │   Manager   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────────┐    ┌─────────────┐
│ List        │    │ Tag Sorting     │    │ Category    │
│ Algorithm   │    │ - Alphabetical  │    │ - Red       │
│ - Natural   │    │ - Manual        │    │ - Grey      │
│ - Importance│    │ - Recent        │    │ - Bold      │
└─────────────┘    └────────────────-┘    │ - Idle      │
                                          └─────────────┘
```

### 2.2 关键借鉴点

1. **分类排序（Importance Algorithm）**：按红(提及)/灰(通知)/粗(未读)/空闲 分类
2. **Sticky Room**：当前选中会话在列表中保持位置稳定
3. **过滤系统**：Prefilter（工作区过滤）+ Runtime Filter（搜索过滤）
4. **虚拟化列表**：大量会话时性能优化
5. **事件驱动**：监听 Matrix SDK 事件更新状态

---

## 三、开发计划（功能维度）

### 阶段一：核心问题修复（1-2 天）

#### 1.1 Matrix Token 过期校验（P1）

**目标**：Token 过期前主动刷新，避免 401 错误

**文件**：`middleware/src/services/matrixSessionToken.ts`、`middleware/src/routes/auth.ts`

**实现要点**：在 `ensureMatrixTokenForSession` 开头，若 `matrixTokenExpiresAt < Date.now() + BUFFER_MS`（如 5 分钟），清空 `matrixAccessToken` 并重新获取。

#### 1.2 真实 last_active 排序（P2）

**目标**：会话列表按房间最后活动时间排序

**方案**：中间层维护房间最后活动缓存（推荐）；或利用 Matrix Sync 的 Room.timeline 缓存最后事件时间。

**文件**：`middleware/src/adapters/matrix.ts`、`frontend/composables/useChatSessions.ts`

### 阶段二：会话列表优化（2-3 天）

- 分类排序系统（邀请 > 置顶 > 提及 > 通知 > 未读 > 空闲）
- Sticky Session 功能
- 虚拟化列表（@tanstack/vue-virtual）

### 阶段三：消息处理完善（2-3 天）

- 消息编辑历史查看（API + MessageEditHistoryDialog）
- 消息发送失败重试机制
- 消息收藏（Matrix Account Data + FavoriteMessagesDialog）

### 阶段四：状态管理优化（1-2 天）

- 会话持久化（SessionStore 抽象 + 文件存储）
- 状态同步优化（事件驱动、统一更新入口）

### 阶段五：用户体验完善（1-2 天）

- 会话归档、会话分享、批量操作

---

## 四、技术架构改进

### 4.1 数据流架构

- 前端：useChatSessions → useSpaceSessionList / useSpaceChatPane；useMatrixSyncClient 直连 Matrix Sync
- 中间层：Chat Routes → Matrix Adapter / Mock Adapter → matrixClient.ts
- Matrix：Client API（会话/消息）、Admin API（用户同步等）

### 4.2 状态管理模式

- 统一会话状态：chats、messagesByChatId、receiptStatus、invitedRooms、pinnedIds、categories、stickySessionId、lastActivityAt

---

## 五、文件清单

### 前端

- composables：useChatSessions、useSpaceSessionList、useSpaceChatPane、useChatStream、useMatrixSyncClient、useBottomNav、useSessionCategories、useChatTimeline、useRichTextEditor
- components/space：SpaceSessionDrawer、SessionCategory、VirtualSessionList、ChatArea、ChatTimeline、MessageGroup、MessageItem、TimelineDivider、ChatInputArea、RichTextEditor、InputToolbar、AutocompletePopup
- components：SessionListItem、ChatMessageBubble/MessageItem、MessageEditHistoryDialog、FavoriteMessagesDialog、ReadReceiptBadge、TypingIndicator、MessageRetryButton

### 中间层

- services：matrixSessionToken、auth/sessionStore、auth/sessionStoreFile、matrixRoomActivityCache
- adapters：matrix（listSessions 排序、编辑历史、收藏）
- routes：chat（新增编辑历史、收藏等 API）

---

## 六、界面设计（摘要）

- **布局**：底部导航 + 顶部抽屉，无左侧 64px 栏。会话列表 280px + Chat Area flex。
- **设计规范**：见 `docs/UI_DESIGN_SYSTEM.md`、`.cursor/rules/frontend-ui-design.mdc`（Button/Input/Dialog、圆角、颜色、shadcn-vue CLI）。
- **组件**：SessionCategoryHeader、VirtualSessionList、MessageEditHistoryDialog、FavoriteMessagesDialog、TypingIndicator、ReadReceiptBadge 等。

---

## 七、激进重构方案（摘要）

- **导航**：底部导航（聊天/收件箱/档案/设置）+ 顶部抽屉（搜索/新建/筛选）；不设 SpaceNavBar。
- **组件树**：TopDrawer、SpaceSessionDrawer（SessionSearchBar + SessionCategory + VirtualSessionList + SessionListFooter）、SpaceChatArea（ChatHeader + ChatTimeline + ChatInputArea）、BottomNav。
- **样式**：design-tokens.css、animations.css；--space-drawer-width、--bottom-nav-height、--bg-* 等。
- **状态**：useBottomNav（activeTab、inboxBadge）、useSessionCategories、useChatTimeline、useRichTextEditor。

---

## 八、Element 对照审查与查缺补漏

### 8.1 对照要点

- **时间轴**：分页策略 PAGE_SIZE（如 80）、向上加载、与 listMessages 对接；高度补偿用 scrollBy(0,x)。
- **房间列表**：已覆盖分类与 Sticky；补充搜索过滤缓存与「共 N 条」展示。
- **消息类型**：时间轴与存储支持 m.call.* 等，用于展示「语音/视频通话」记录。
- **房间头部**：ChatHeader 预留语音/视频按钮位。
- **设置**：预留「语音与视频」入口与结构。

### 8.2 计划内补漏项

- Timeline 分页明确触发与 PAGE_SIZE
- 消息类型扩展（eventType、m.call.* 占位条）
- ChatHeader 预留 1～2 个图标位
- 设置页「语音与视频」分组占位

---

## 九、音视频通话扩展预留

- **Matrix 能力**：1:1（m.call.invite/answer/hangup/candidates、MatrixCall）；群组（MatrixRTC、Full Mesh / LiveKit SFU）。
- **前端预留**：ChatHeader 语音/视频按钮占位；SessionListItem 可选「进行中通话」指示；MessageItem 对 m.call.* 摘要条；callState/activeCallRoomId 占位；设置「语音与视频」入口。
- **中间层**：可选预留 /api/rooms/:id/call；若前端直连 Matrix 信令+WebRTC 则不需要。
- **文档**：VOIP_AND_VIDEO_PLAN.md 或合并进 MATRIX 文档。
- **本期**：仅占位与数据结构，不实现实际通话与媒体。

---

## 十、按阶段实现节奏

### 10.1 节奏原则

- **小步交付**：每阶段 3～5 项可独立验证的交付物，验收后再进入下一阶段。
- **后端先行、前端跟进**：先后端小改动并验证，再改前端。
- **先通路、再优化**：先「能跑」再虚拟化、富文本等。
- **阶段验收**：每阶段结尾可验证清单检查，不带着已知问题进入下一阶段。

### 10.2 阶段总览

| 阶段  | 主题    | 主要交付                                                   | 建议工期    | 验收重点              |
| --- | ----- | ------------------------------------------------------ | ------- | ----------------- |
| 0   | 稳定基线  | Token 过期校验                                             | 0.5～1 天 | 长时间不操作后请求不 401    |
| 1   | 后端与导航 | last_active 排序 + 底部导航/顶部抽屉联动                           | 1～2 天   | 列表排序正确；Tab/抽屉切换正常 |
| 2   | 列表容器  | SessionDrawer + SessionCategory + useSessionCategories | 1.5～2 天 | 分类展示、折叠、点击进会话     |
| 3   | 列表优化  | VirtualSessionList + 会话持久化                             | 1～1.5 天 | 大量会话滚动流畅；重启不丢会话   |
| 4   | 时间轴骨架 | ChatArea + ChatTimeline 分页 + Divider + useChatTimeline | 2～2.5 天 | 消息展示、向上加载更多、日期分隔  |
| 5   | 消息展示  | MessageGroup + MessageItem 替换                          | 1.5～2 天 | 文本/回复/流式/已读均正常    |
| 6   | 输入区   | ChatInputArea + 输入与发送（可先简单再迭代富文本）                      | 1.5～2 天 | 发消息、回复、编辑流程通      |
| 7   | 样式与集成 | design-tokens + 布局 + 页面集成 + 清理旧代码                      | 1.5～2 天 | 视觉统一、无遗留旧组件引用     |
| 8   | 功能增强  | 编辑历史、收藏、重试、分类排序、Sticky、已读/输入中                          | 2～3 天   | 按项验收，每项可单独开关      |
| 9   | 收尾与预留 | 归档、音视频占位、文档、Timeline/m.call 预留                         | 1～1.5 天 | 占位可见、文档可查         |

### 10.3 各阶段要点

- **阶段 0**：仅 P1 Token 过期，不改前端。
- **阶段 1**：不拆 SessionList 内部，只稳定数据源与导航。
- **阶段 2**：列表项可仍用现有 SessionListItem，暂不虚拟化。
- **阶段 3**：虚拟化若有问题可先回退，阶段 7 再收尾。
- **阶段 4**：消息可仍用现有气泡，先打通分页与布局。
- **阶段 5**：不增加编辑历史、收藏等新功能，只做迁移与稳定。
- **阶段 6**：富文本可拆为 6a/6b，先保证「能发」。
- **阶段 7**：集成改动面大，阶段 6 稳定后做并做完整回归。
- **阶段 8**：每完成 1～2 项即验证并提交。
- **阶段 9**：占位与文档到位，主流程无回归。

### 10.4 风险与缓冲

- 阶段 4～5 可把「虚拟化时间轴」延后到阶段 7。
- 阶段 6 富文本成本高时，可先简单 textarea，富文本列为后续迭代。
- 每阶段预留约 20% 缓冲用于修 bug 与调整。

### 10.5 与 Week 1～5 对应关系

| 原 Week | 对应阶段            | 说明                  |
| ------ | --------------- | ------------------- |
| Week 1 | 阶段 0 + 1 + 2 部分 | 后端基线 + 导航 + 列表容器与分类 |
| Week 2 | 阶段 2 收尾 + 3 + 4 | 虚拟化、持久化、时间轴骨架       |
| Week 3 | 阶段 5 + 6        | 消息展示重构、输入区          |
| Week 4 | 阶段 7 + 8 部分     | 样式与集成、部分功能增强        |
| Week 5 | 阶段 8 收尾 + 9     | 其余功能增强、收尾与音视频预留     |

**实施时以阶段编号与验收清单为准；Week 仅作时间参考。**

---

## 相关文档

- 架构与 API：`docs/ARCHITECTURE.md`、`docs/PROJECT_STATUS.md`
- Matrix 整合：`docs/MATRIX_INTEGRATION_STATUS.md`、`docs/SESSION_PERSISTENCE.md`
- 前端规范：`docs/FRONTEND_SPEC.md`、`docs/UI_DESIGN_SYSTEM.md`
- 任务与状态：`.cursor/plans/` 下会话系统完善开发计划
