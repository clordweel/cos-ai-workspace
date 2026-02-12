# 聊天输入框重构方案：输入时渲染 Markdown / 富文本

本文档描述聊天输入框的重构方案，目标为**输入时即可渲染 Markdown、支持富文本**，并允许引入优秀的开源组件。最后更新：2026-02-13。

**实施状态**：已按推荐方案落地。`ChatInputPanel.vue` 已改用 Nuxt UI 的 `UEditor`（TipTap + content-type=markdown），`frontend/extensions/chatEnterSubmit.ts` 提供 Enter 提交 / Shift+Enter 换行；@ 提及由 `UEditorMentionMenu` 对接联系人+机器人列表。

---

## 1. 现状

### 1.1 当前实现

- **组件**：`frontend/components/ChatInputPanel.vue`
- **输入载体**：原生 `<textarea>`，纯文本
- **数据**：`modelValue` 为 string，与父组件（如 `useSpaceChatPane`）同步
- **已有能力**：
  - **@ 提及**：输入 `@` 后解析光标前内容，展示联系人/机器人候选（`useContactsAndBots`），选中后插入 `@名称 `
  - **工具栏**：提及、来源(#)、命令(/)，以及粗体、斜体、行内代码、代码块（通过 `wrapAtCursor` 在选区前后插入 `**`、`*`、`` ` ``、` ``` ` 等）
  - **快捷键**：Enter 提交、Shift+Enter 换行；@ 候选时方向键选择、Enter 选中、Escape 关闭
  - **高度**：可拖拽调整（MIN_EDIT_HEIGHT ~ MAX_EDIT_HEIGHT），空内容时根据 scrollHeight 自适应
- **消息展示**：
  - 用户消息：当前多为纯文本展示（`whitespace-pre-wrap`）；若存在 `formattedBody` 则用 `useMarkdownRender().renderFormattedBody` 净化 HTML 展示
  - 助手消息：使用 `useMarkdownRender().render()`（markdown-it → DOMPurify）渲染 `content`

### 1.2 痛点

- 输入框中**看不到** Markdown 效果（粗体、代码等），只有发送后在气泡里才渲染。
- 富文本仅通过「在选区前后包一层符号」实现，无真正 WYSIWYG 或实时预览。
- 若希望输入时即见即所得，需要替换为支持「输入时渲染」的富文本/ Markdown 方案。

---

## 2. 目标

- **输入时渲染 Markdown**：在输入区域内即可看到粗体、斜体、代码、列表等效果（可为 WYSIWYG 或同区域实时预览）。
- **富文本支持**：支持常见格式（粗体、斜体、代码、代码块、列表、引用等），与现有消息展示（markdown-it + DOMPurify）语义一致。
- **允许引入优秀开源组件**：优先选用成熟、可维护、与 Vue 3 / Nuxt 3 兼容的编辑器或组件库。
- **保持现有行为**：@ 提及（联系人+机器人）、Enter 提交/Shift+Enter 换行、可调高度、streaming 时禁用、回复预览、工具栏（提及/来源/命令/格式）等逻辑需保留或平滑迁移。

---

## 3. 可选方案与开源组件

### 3.1 方案概览

| 方案 | 输入时渲染方式 | 与现有栈契合度 | 备注 |
|------|----------------|----------------|------|
| **A. Nuxt UI Editor** | TipTap 富文本，content-type=markdown 时输入即结构化 | 高（项目已用 @nuxt/ui） | 内置 Mention、slash、markdown |
| **B. Tiptap 直接集成** | 同上，自行组装扩展与 UI | 高（Nuxt UI Editor 底层） | 更可控，需自接 @ 列表与工具栏 |
| **C. Echo Editor** | TipTap + shadcn-vue | 中（与 shadcn-vue 一致，但与 Nuxt UI 并存） | 开源 WYSIWYG，可作参考 |
| **D. 轻量：textarea + 实时预览** | 旁侧或下方用 markdown-it 渲染同一文本 | 高（仅用现有 useMarkdownRender） | 非 WYSIWYG，实现简单 |

### 3.2 推荐组件简介

- **Tiptap**（[tiptap.dev](https://tiptap.dev)）  
  - Headless 富文本编辑器，基于 ProseMirror；支持 Vue 3（`@tiptap/vue-3`）、Markdown 快捷输入与 `@tiptap/markdown` 扩展（解析/序列化为 Markdown）。  
  - 输入即渲染为富文本（contenteditable），可配置为以 Markdown 为存储格式，与现有「消息 content 存 Markdown/纯文本」一致。

- **Nuxt UI Editor（UEditor）**（[ui.nuxt.com/docs/components/editor](https://ui.nuxt.com/docs/components/editor)）  
  - 基于 TipTap 的富文本组件，支持 `content-type="markdown"` | `html` | `json`。  
  - 内置：Placeholder、Image、**Mention**、**Markdown**、StarterKit（粗体、斜体、标题、列表、引用、代码块等）。  
  - 提供 `UEditorToolbar`、`UEditorMentionMenu`、`UEditorSuggestionMenu`（slash 命令）等，与当前「提及 + 工具栏」需求高度重合。  
  - 项目已依赖 `@nuxt/ui`，引入成本低；需在 `nuxt.config` 中按文档配置 `vite.optimizeDeps.include` 避免 ProseMirror 多实例问题。

- **Echo Editor**（[Seedsa/echo-editor](https://github.com/Seedsa/echo-editor)）  
  - TipTap + shadcn-vue 的 WYSIWYG 编辑器，MIT。  
  - 若希望 UI 与 shadcn-vue 完全统一可参考；与 Nuxt UI 并存时可能重复一套编辑器生态，故更推荐以 Nuxt UI Editor 或 Tiptap 为主。

### 3.3 推荐路线

- **首选：Nuxt UI Editor（UEditor）+ content-type=markdown**  
  - 输入即富文本渲染，存储与接口仍为 Markdown 字符串，与现有 `message.content` 及 `useMarkdownRender` 一致。  
  - 用 `UEditorMentionMenu` 对接现有 `mentionCandidatesList`（联系人 + 机器人），保留 @ 提及行为。  
  - 工具栏可保留现有「提及 / 来源 / 命令」按钮，格式按钮改为调用 TipTap 命令（或使用 UEditorToolbar 的 `kind: 'mark'` 等）。  
  - 需在 ChatInputPanel 内保留：提交（Enter）、Shift+Enter 换行、streaming 禁用、回复预览、高度调节等；UEditor 作为「输入区」替换 textarea，外层布局与事件不变。

- **备选：直接使用 Tiptap**  
  - 若 UEditor 的默认样式或布局与设计不符、或希望最小化依赖，可仅用 `@tiptap/vue-3` + `@tiptap/starter-kit` + `@tiptap/markdown` + 自写 Mention 扩展。  
  - 自行实现：从 `useContactsAndBots` 取候选列表、在输入 `@` 时弹出列表、选中插入文本或自定义 node。  
  - 与当前 `parseAtMention` / `insertMention` 逻辑等价，但需在 ProseMirror 的 selection 与 transaction 上实现。

---

## 4. 重构要点（以 Nuxt UI Editor 为主）

### 4.1 数据与 API 兼容

- **modelValue**：继续使用 **string**。  
  - 使用 UEditor 时，`v-model` 绑定为 ref(string)，并设置 `content-type="markdown"`，则 UEditor 内部会以 Markdown 序列化/反序列化，与现有「输入 = 一串 Markdown 文本」一致。
- **提交**：仍通过 `emit('submit')`，父组件从 `modelValue`（或从 editor 取 `getMarkdown()`）取内容发送；发送后清空逻辑不变。
- **@ 提及**：  
  - 将 `mentionCandidatesList`（联系人 + 机器人）映射为 `EditorMentionMenuItem[]`（label、avatar 等）。  
  - `UEditorMentionMenu` 的 `items` 使用该列表；选中项时由 TipTap Mention 扩展插入，插入格式需与后端/Matrix 约定一致（例如保留 `@名称 ` 或改为 mention node 再在序列化时转成约定格式）。

### 4.2 行为保留

- **Enter / Shift+Enter**：在 TipTap 中通过 `addKeyboardShortcuts` 或扩展中拦截：Enter 且非 Shift → 提交并 `preventDefault`；Shift+Enter → 换行。  
  - 若 UEditor 默认 Enter 为换行，需在 ChatInputPanel 或通过 TipTap 的 keyboard shortcut 覆盖。
- **流式输出中**：`streaming === true` 时设置 editor 为 `editable: false`（或禁用输入区），并保留「停止」「清空」「回顾」等按钮。
- **回复预览、取消回复**：不依赖输入载体，保留现有 UI 与 emit。
- **高度调节**：当前为外层容器 + 内部 textarea 的固定高度。改为 UEditor 后，可继续保留拖拽把手，将 `editHeightPx` 作用在 UEditor 外层包裹元素上，UEditor 的 `min-height`/`height` 与该值同步，使可调高度行为一致。

### 4.3 用户消息展示（可选）

- 当前用户消息若为纯文本展示，可改为对 `message.content` 使用与助手消息相同的 `useMarkdownRender().render()`，使发送后的用户消息也以 Markdown 渲染，与输入侧「存 Markdown」一致。  
- 若后端或 Matrix 支持 `formattedBody`，可继续优先使用 `renderFormattedBody`。

### 4.4 实现步骤建议

1. **调研与 PoC**  
   - 在单独页面或分支中引入 Nuxt UI Editor，`content-type="markdown"`，验证 v-model 为 string 时的读写、Enter 行为、与现有主题/深色模式是否协调。  
   - 按 Nuxt UI 文档配置 `vite.optimizeDeps.include`（ProseMirror 相关包），避免 `Adding different instances of a keyed plugin` 等错误。

2. **ChatInputPanel 替换**  
   - 用 UEditor 替换 textarea；保留同一 `modelValue`、`emit('update:modelValue')`、`emit('submit')` 等接口。  
   - 实现 UEditor 的键盘拦截：Enter 提交、Shift+Enter 换行。  
   - 将现有「提及/来源/命令」按钮与 UEditor 的 Toolbar / Suggestion 对接（或保留为自定义按钮，内部调用 editor 命令或插入字符）。

3. **@ 提及迁移**  
   - 配置 `UEditorMentionMenu`，`items` 来自 `useContactsAndBots` 的列表，并处理选中后的插入格式（与当前 `@名称 ` 或后端约定一致）。  
   - 若 UEditor 的 Mention 插入的是 node 而非纯文本，需在提交时通过 `editor.getMarkdown()` 或自定义序列化保证发送出去的是约定格式。

4. **高度与布局**  
   - 保留 resize 把手与 `editHeightPx`，将 UEditor 容器高度绑定为该值；必要时用 CSS 限制 UEditor 内部滚动，避免出现双滚动条。

5. **回归与收尾**  
   - 验证：提交、清空、@ 提及、格式、streaming 禁用、回复、高度拖拽、无障碍与深色模式。  
   - 若采用「用户消息也渲染 Markdown」，在 ChatMessageBubble 中对 user 的 `content` 使用 `render()`，并补充样式与测试。

---

## 5. 备选：轻量方案（textarea + 实时预览）

若短期内不引入 TipTap/Nuxt UI Editor，可采用最小改动：

- 保留现有 textarea 与所有逻辑。  
- 在输入区**下方或右侧**增加一块「实时预览」区域：对 `modelValue` 使用 `useMarkdownRender().render()` 输出 HTML，用 `v-dompurify-html` 或安全方式渲染。  
- 优点：实现快、无新依赖、输入即见 Markdown 效果。  
- 缺点：非 WYSIWYG，光标与选区在预览中不联动；仅适合「预览」增强，不适合完整富文本编辑。

---

## 6. 参考

- 项目：`frontend/components/ChatInputPanel.vue`（当前输入）、`frontend/components/ChatMessageBubble.vue`（消息展示）、`frontend/composables/useMarkdownRender.ts`（Markdown 渲染）。  
- 规范：`docs/FRONTEND_SPEC.md`、`.cursor/rules/frontend-spec.mdc`（Shadcn-vue 与 Nuxt UI 约定）。  
- 外部：  
  - [Nuxt UI - Editor](https://ui.nuxt.com/docs/components/editor)  
  - [Tiptap - Vue 3](https://tiptap.dev/docs/editor/getting-started/install/vue3)、[Tiptap - Markdown](https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage)  
  - [Echo Editor](https://github.com/Seedsa/echo-editor)（可选参考）
