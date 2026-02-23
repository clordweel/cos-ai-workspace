# 状态机与本地状态选用说明

本文档说明在 apps/web（及未来 apps/api）中何时使用 **xstate 状态机**、何时使用 **useState / useReducer**，避免过度或不足。

## 原则

- **有节制、按场景**使用状态机，不全面替换现有 useState。
- 状态机用于**多状态、多事件、易出现非法组合**的流程；简单线性或单一 loading/error 的用 useState/useReducer 即可。

## 何时用状态机（xstate）

适合用状态机的情况：

- **多阶段流程**：状态明确、迁移清晰，例如 `idle` → `sending` → `streaming` → `success` / `error`。
- **需要禁止非法组合**：例如「正在发送时禁止再次提交」「确认弹窗的 loading 与 submitting 不能与 idle 混用」。
- **副作用集中**：进入/离开某状态时的逻辑（请求、清理、重连）希望挂在状态定义上，便于测试与维护。
- **需要取消/中止**：如流式请求支持 Abort，状态机可统一管理 ABORT 事件与清理。

当前已用状态机的场景：

- **聊天发送流程**：`apps/web/src/machines/chatSendMachine.ts` + `useChatSendMachine`，封装 idle/sending/success/error，支持 abort；Space 页通过 `submit()` 派发 SUBMIT，由状态机驱动发送并派发 SUCCESS/ERROR。
- **Dify 流阶段**：`apps/web/src/machines/streamPhaseMachine.ts`，在 `useChatStream` 内用 `createActor` 驱动；SSE 解析按事件类型（status / thinking / message / message_end / dify_event / error）严格分发并派发到状态机，保证从 API 到前端的流阶段清晰可控；可选 `onPhaseChange`、`onDifyEvent`、`onStatus` 供 UI 展示「连接中/思考中/回复中」及「正在调用工具」等。

后续可考虑的试点（见 `.cursor/plans` 中 xstate 引入价值研究）：

- Matrix Sync 生命周期（连接/重连/就绪）。
- 删除/退出确认、重命名会话等确认类弹窗（多布尔合并为小状态机）。

## 何时用 useState / useReducer

适合继续用本地状态的情况：

- **简单 loading + error**：如 useSessions、useMessages、useAuth 等「请求中/成功/失败」线性流程，用 `useState` 或 `useReducer` 即可。
- **无复杂迁移**：如主题切换、标签页激活、单次开关，状态少且无严格「事件→下一状态」约束。
- **纯 UI 状态**：如输入框内容、弹窗开闭、hover，无需可视图或严格事件模型。

## 技术栈与位置

- **apps/web**：使用 `xstate` + `@xstate/react`；状态机定义放在 `src/machines/`，通过 `useMachine` 在 hook 或组件中接入。
- **apps/api**：当前未引入；若后续出现多步工作流或流式阶段文档化需求，再在对应服务内按需引入。

## 参考

- 引入价值与试点策略：`.cursor/plans` 中的 xstate 引入价值研究。
- 聊天发送状态机：`apps/web/src/machines/chatSendMachine.ts`、`apps/web/src/hooks/useChatSendMachine.ts`。
