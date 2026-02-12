# 聊天栏滚动改进方案（基于 Element / Cinny 参考）

从 [Element Web](https://github.com/element-hq/element-web) 与 [Cinny](https://github.com/cinnyapp/cinny) 等 Matrix 客户端提取的滚动实践，用于改进本项目聊天栏的滚动体验。

---

## 一、Element ScrollPanel 核心机制

### 1.1 BACAT（Bottom-Aligned, Clipped-At-Top）

Element 采用 **BACAT** 避免直接操纵 `scrollTop` 带来的问题：

- **问题**：`scrollTop` 在 macOS 等平台易与画面不同步（APZ 离屏滚动），连续设置会相互抵消
- **做法**：用 flexbox 将时间线**底部对齐**，给内容区**显式高度**（PAGE_SIZE 的倍数，如 400px）
- 视口下侧内容增高时：通过增加 timeline 高度补偿，**不调 scrollTop**
- 视口上侧变化时：等用户停止滚动 100ms 后再调 scrollTop，避免打断

### 1.2 滚动状态（scrollState）

| 状态 | 含义 | 行为 |
|------|------|------|
| `stuckAtBottom` | 用户已滚到底部 | 新消息到来时自动续滚到底部 |
| `fixed` | 用户在看某条消息 | 通过 scroll token 锚定，保持相对位置 |

### 1.3 stickyBottom

- `stickyBottom: true` 时，用户滚到底部即进入 `stuckAtBottom`，新消息自动下拉
- `stickyBottom: false` 时，仅保存当前 offset，不强制自动滚动

### 1.4 isAtBottom 判断

```ts
// Element: scrollHeight - (scrollTop + clientHeight) <= 1
// 考虑小数与 DPI，留 1px 容差
```

### 1.5 scrollBy 替代 scrollTop

高度变化时用 `scrollBy(0, delta)` 做**相对滚动**，而非读取再设置 `scrollTop`，避免 APZ 导致的值不同步。

---

## 二、Cinny / 通用聊天模式

- **智能滚动**：仅在两种情况下自动滚到底部
  1. 首次加载消息
  2. 收到新消息 **且** 用户已在底部
- 用户向上翻阅历史时，**不强制**拉回底部

---

## 三、本项目现状与改进方向

### 3.1 当前实现

- 使用 `@tanstack/vue-virtual` 虚拟列表
- 底部锚点 `scrollAnchorRef` + `scrollIntoView`
- 虚拟模式下使用 `scrollToIndex(count - 1, { align: 'end' })`
- 触发：`chatId` 变化、消息数 0→N、锚点挂载
- 无「用户是否在底部」判断，加载/新消息时一律滚到底部

### 3.2 改进选项

| 选项 | 改动范围 | 说明 |
|------|----------|------|
| **A. 轻量** | 保持虚拟列表 | 仅加 `isAtBottom`，新消息时仅当在底部才滚 |
| **B. 中量** | 保持虚拟列表 | A + stickyBottom 状态 + scrollBy 做相对补偿 |
| **C. 深度** | 去掉虚拟列表 | 采用 BACAT 布局，完全对齐 Element 模式 |

---

## 四、推荐实施方案（B：中量重构）

在保留虚拟列表的前提下，引入 Element 的核心理念：

1. **stickyBottom 行为**
   - 用户滚到底部时记为 `stuckAtBottom`
   - 新消息/加载完成且 `stuckAtBottom` 时自动滚到底部
   - 用户向上滚动后清除 `stuckAtBottom`，不再强制拉回

2. **isAtBottom 检测**
   - `scrollHeight - (scrollTop + clientHeight) <= 1`（或视虚拟列表 API 做等价判断）
   - 虚拟模式下可近似：`scrollRef.scrollTop + scrollRef.clientHeight >= virtualTotalSize - 1`

3. **加载后首次定位**
   - 切换会话或消息从空加载时，始终滚到底部并设 `stuckAtBottom`
   - 与「新消息时不打扰正在阅读用户」区分开

4. **scrollBy 替代直接 scrollTop**
   - 在需要做相对补偿的场景（如流式输出导致高度变化）使用 `scrollBy(0, delta)`

---

## 五、可选深度重构（C：BACAT）

若未来需彻底消除虚拟列表带来的测量/滚动时序问题，可考虑：

- 移除 `@tanstack/vue-virtual`
- 使用底部对齐 flex 布局 + 显式内容高度
- 实现 `onFillRequest` 风格的分页加载（接近顶部时加载更早消息）
- 完全采纳 Element 的 `restoreSavedScrollState` / `updateHeight` 流程

适用于消息量可控（如单次 <200 条）且更看重稳定性而非极端长列表性能的场景。

---

## 六、当前方案：Nuxt UI UChatMessages

已采用 **Nuxt UI ChatMessages**（UChatMessages）承载消息列表与滚动，替代原先的 CSS 反转滚动 + 虚拟列表。

- **组件**：ChatPane 内使用 `<UChatMessages>`，传入 `uiMessages`（由 displayMessages 映射为 UIMessage）、`chatStatus`（streaming ? 'streaming' : 'ready'）。
- **滚动**：`should-scroll-to-bottom`、`should-auto-scroll` 开启；组件内置「回到底部」按钮；无需手写 isAtBottom / stickyBottom。
- **自定义气泡**：通过 `#content` 插槽渲染既有 ChatMessageBubble，用 `getMessageIndexByUiId(message.id)` 反查 displayMessages 下标。
- **消息**：`displayMessages = messages`（旧→新），无虚拟列表；适合单会话数百条级。若未来需长列表可再评估虚拟或分页。

更全面的开源方案与选型见 **`docs/CHAT_UI_BEST_PRACTICES.md`**。

---

## 七、参考来源

| 来源 | 用途 |
|------|------|
| [Element Web scrolling docs](https://web-docs.element.dev/Element%20Web/scrolling.html) | BACAT 原理、scrollState、stickyBottom |
| [matrix-react-sdk ScrollPanel](https://github.com/element-hq/matrix-react-sdk/blob/develop/src/components/structures/ScrollPanel.tsx) | 具体实现、isAtBottom、scrollBy |
| Cinny / 通用聊天 | 智能滚动语义（加载 vs 新消息） |
| 项目内 `CHAT_UI_BEST_PRACTICES.md` | 开源方案汇总、消息列表与滚动最佳实践、组件选型 |
