# Element Matrix 客户端输入框（Composer）实现调研

本文档记录对 Element（原 Riot Web）Matrix 客户端**消息输入框（Composer）**的实现方式与技术栈的调研结果，供本仓库聊天输入框选型与实现参考。

---

## 1. 技术栈概览

| 维度 | 说明 |
|------|------|
| **前端框架** | React（Element Web 基于 matrix-react-sdk，React 应用） |
| **桌面壳** | Electron（Element Desktop） |
| **协议层** | Matrix JS SDK（matrix-js-sdk） |
| **输入框核心** | **自研 CIDER 编辑器**，非第三方富文本库 |
| **源码位置** | matrix-react-sdk 的 `/editor/` 目录（现维护于 element-hq/matrix-react-sdk） |

---

## 2. CIDER 编辑器

### 2.1 名称与含义

**CIDER** = **C**ontenteditable-**I**nput-**D**iff-**E**rror-**R**econcile

- 基于 **contenteditable** 的输入
- 通过 **input 事件** 驱动
- **Diff** 计算变更
- **Error/Reconcile**：模型校验 + 与 DOM 的**调和（reconcile）**

### 2.2 设计动机（为何自研）

Element 官方博客（Riot Web 1.5，2019）说明：

- 曾使用 **Draft.js**、**Slate.js** 等第三方富文本方案，多次重写后仍遇到大量边界情况与难以修复的 bug。
- 最终决定**自研**，目标为「尽可能简单」：只支持 Riot 需要的功能（pills、自动补全、Markdown 格式化、命令、粘贴图片）。
- **放弃 WYSIWYG**：改为 **Markdown 输入 + 选中文本时的上下文格式化**，避免与 contenteditable 的复杂交互。
- 强调**无障碍**与**多语言输入法**兼容（IME、非拉丁字符等）。

### 2.3 架构要点

- **模型（Model）**：由若干 **Part** 组成；每个 Part 有文本和类型（plain text、pill、pill candidate 等）。
- **单向流**：  
  `DOM (contenteditable) → 转成字符串 + 光标偏移 → Model.update() → Diff → 应用到 Part → 校验/转换 → renderModel() 写回 DOM`
- **不依赖 key 事件**：用 **input 事件** 感知变更，兼容各类输入方式（键盘、IME、粘贴等）。
- **不依赖 beforeinput**：避免对尚未普及的 API 的依赖。

---

## 3. 核心流程（简要）

1. **DOM → 字符串 + 光标**  
   在 `dom.ts` 的 `getCaretOffsetAndText()` 中：
   - 将 contenteditable 的 DOM 转成「内容字符串」；
   - 处理块级元素换行、**caret 节点**（见下）等，使「字符串偏移」与「DOM 光标位置」一致；
   - 得到 (caretOffset, contentString)。

2. **Diff**  
   在 `diff.ts` 中：
   - 比较「当前 model 的字符串」与「上一步得到的 contentString」；
   - 假设**仅有一处变更且靠近光标**，做轻量 diff，得到增/删片段。

3. **应用到 Model**  
   - 将 diff 结果应用到各个 Part；
   - Part 可做校验（如 plain text 里输入 `@` 被拒绝，交给「part creator」变成 **pill candidate**，从而打开 @ 自动补全）；
   - 选中补全项后，pill candidate 被替换为不可编辑的 **pill**。

4. **DOM 调和**  
   在 `render.ts` 的 `renderModel()` 中：
   - 根据最新 Model 状态**调和 DOM**（与 React 的 reconcile 思路类似）；
   - 若 model 未拒绝输入且无额外变更，可**不改 DOM**，保证性能；
   - 同时**校正光标**，以适配 model 对内容的修改。

5. **Caret 节点**  
   - 为在**两个 pill 之间**或 **pill 与行首/行尾** 正确放置光标，需要在 DOM 中插入不可见的 **caret 节点**（含零宽字符）；
   - Model 不感知 caret 节点，仅在渲染阶段插入，在「DOM → 字符串」时忽略，避免干扰偏移计算。

---

## 4. 关键文件（matrix-react-sdk）

| 文件 | 职责 |
|------|------|
| `editor/dom.ts` | `getCaretOffsetAndText()`：DOM → 内容字符串 + 光标偏移；处理换行与 caret 节点 |
| `editor/diff.ts` | 围绕光标的轻量 diff，得到增/删片段 |
| `editor/render.ts` | `renderModel()`：按 Model 状态调和 DOM，并校正光标 |

文档与说明可参考：

- Element 官方文档：<https://web-docs.element.dev/Element%20Web/ciderEditor.html>
- 博客：<https://element.io/blog/riot-web-1-5/>（Riot Web 1.5，CIDER 介绍）

---

## 5. 与本仓库的对照

| 对比项 | Element (CIDER) | 本仓库（apps/web 当前） |
|--------|------------------|--------------------------|
| 输入载体 | contenteditable + 自研 Model/Part | Lexical（富文本框架） |
| @ 提及 | Part 类型（pill / pill candidate）+ 自动补全 | Lexical MentionNode + TypeaheadMenuPlugin |
| 富文本 | Markdown 输入，无 WYSIWYG | Lexical 可扩展为富文本 / Markdown |
| 复杂度 | 自研，只做必要功能 | 依赖 Lexical 生态，功能多、定制需熟悉 API |

若希望**最大限度控制行为、避免第三方编辑器坑**，可参考 CIDER 的「contenteditable + 字符串 diff + Part 模型 + 调和」思路；若希望**快速实现富文本 + 提及**，继续用 Lexical 或 TipTap 更合适。  
本仓库 frontend 已采用 **TipTap（UEditor）**；apps/web 已采用 **Lexical**，与 Element 的 CIDER 为不同技术路线。

---

## 6. 参考链接

- Element Web & Desktop 文档 - CIDER：<https://web-docs.element.dev/Element%20Web/ciderEditor.html>
- Riot Web 1.5 博客（CIDER 发布）：<https://element.io/blog/riot-web-1-5/>
- matrix-react-sdk（含 editor 目录）：<https://github.com/element-hq/matrix-react-sdk>
- Matrix JS SDK：<https://github.com/matrix-org/matrix-js-sdk>
