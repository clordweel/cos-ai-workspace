# 消息 Markdown 渲染最佳实践

研究在聊天消息中安全、可维护地渲染 Markdown 的选型与实现要点，供前端实现参考。

---

## 一、现状

- **渲染方式**：`ChatMessageBubble.vue` 中消息正文为**纯文本**展示：
  - 用户/助手/系统消息均使用 `{{ message.content }}` 或 `contentChunks` 逐 token 展示。
  - 样式为 `whitespace-pre-wrap break-words`，无 Markdown 或 HTML 解析。
- **导出**：已有「导出 Markdown」能力（`useSpaceChatPane.onExportMarkdown`、服务端 `export-markdown`），仅用于下载，不参与气泡内渲染。
- **依赖**：`frontend/package.json` 中**未**引入任何 Markdown 或 HTML 净化库。

---

## 二、安全：必须先净化再渲染 HTML

一旦将 Markdown 转成 HTML 并用 `v-html` 渲染，就存在 XSS 风险：

- **来源**：用户输入、AI/LLM 生成内容、历史消息，均不可信。
- **风险**：解析后的 HTML 中可能包含 `<script>`、`<img onerror>`、`<a href="javascript:...">`、`<base href="...">` 等，直接 `v-html` 会导致执行脚本或钓鱼。
- **结论**：**所有在界面上以 HTML 形式渲染的消息内容，必须先经过净化（sanitize），再交给 Vue 渲染。**

推荐做法：

1. **仅渲染净化后的 HTML**  
   使用 DOMPurify（或基于 DOMPurify 的 Vue 指令/插件）对「Markdown → HTML」的结果做白名单净化，再通过 `v-html` 或 `v-dompurify-html` 输出。

2. **净化策略建议**  
   - 禁止 `<script>`、`<iframe>`、`<object>`、`<base>` 等危险标签。  
   - 对 `<a>` 的 `href`、`<img>` 的 `src` 限制为 `https:` 或相对路径，禁止 `javascript:` 等。  
   - 禁止所有 `on*` 事件属性。  
   - 若使用 @nuxtjs/mdc：务必升级到已修复 [GHSA-cj6r-rrr9-fg82](https://github.com/nuxt-modules/mdc/security/advisories/GHSA-cj6r-rrr9-fg82) 的版本（如 0.17.2+），且对用户/LLM 内容仍建议先净化再交给 MDC。

3. **CSP**  
   作为纵深防御，配置 Content-Security-Policy，减少注入脚本的执行面。

---

## 三、推荐技术方案

### 3.1 库选型

| 用途       | 推荐库 | 说明 |
|------------|--------|------|
| Markdown→HTML | **marked** 或 **markdown-it** | 成熟、可配、支持 GFM；markdown-it 插件生态更丰富（代码高亮、数学公式等）。 |
| HTML 净化 | **DOMPurify** | 业界常用、白名单模型、支持在 Node 与浏览器运行。 |
| Vue 中安全输出 HTML | **vue-dompurify-html** 或 自封装 | vue-dompurify-html：封装 DOMPurify，提供 `v-dompurify-html`，可替代 `v-html`；也可在 composable 中先 `DOMPurify.sanitize(html)` 再 `v-html`（不推荐长期用裸 v-html）。 |

**推荐组合**：**markdown-it** + **DOMPurify** + **vue-dompurify-html**（或统一在 composable 中 `sanitize(html)` 后通过单一指令/组件输出）。

- 若希望与 Nuxt 内容生态一致，可评估 **@nuxtjs/mdc**，但对**用户/LLM 生成内容**仍应**先经 DOMPurify 净化**再渲染；且需使用 0.17.2+ 并关注其安全更新。

### 3.2 渲染流程

```
原始文本 (message.content)
    → Markdown 解析 (markdown-it / marked)
    → 原始 HTML
    → DOMPurify.sanitize(html, { ADD_ATTR: ['target'], ... })
    → 安全 HTML
    → v-dompurify-html 或 封装组件的 v-html（仅接收已净化字符串）
```

- **仅对「最终内容」做 Markdown 渲染**（见下节流式策略）。  
- 同一套净化配置可在 composable 中集中维护（如 `useMarkdownRender(content: string) => sanitizedHtml`），便于复用与测试。

### 3.3 流式输出与 Markdown 的配合

当前实现是**按 chunk 追加**的纯文本流式展示（`contentChunks` + `streaming` 光标）。

- **问题**：流式过程中 Markdown 不完整，直接解析会得到残缺结构（未闭合标签、半段代码块等），体验与安全性都较差。  
- **推荐策略**：  
  - **流式进行中**：仅以**纯文本**展示（保持现有 `contentChunks` + `whitespace-pre-wrap`），不解析 Markdown。  
  - **流式结束或消息完整后**：用**完整 `message.content`** 做一次 Markdown 解析 + 净化，再以 HTML 形式展示；可替换原纯文本区域为「净化后的 HTML 块」。  
- 若产品希望「边流式边渲染」：可考虑仅对**已完整闭合的块**（如整段代码块、整段列表）做增量渲染，实现复杂且易出现闪烁，建议作为后续优化。

---

## 四、实现要点（与现有前端规范一致）

1. **职责拆分**  
   - **Composable**（如 `frontend/composables/useMarkdownRender.ts`）：  
     - 接收纯文本，调用 markdown-it 得到 HTML；  
     - 调用 DOMPurify.sanitize；  
     - 返回净化后的 HTML 字符串（及可选「是否允许 Markdown」开关）。  
   - **组件**：`ChatMessageBubble` 内根据「是否流式」「是否启用 Markdown」选择：  
     - 流式中或未启用 Markdown：继续使用现有 `contentChunks` / `message.content` 纯文本展示。  
     - 非流式且启用 Markdown：使用 composable 得到的安全 HTML，通过 `v-dompurify-html` 或封装好的「安全 HTML 块」组件渲染。

2. **样式**  
   - 为 Markdown 渲染块预留统一 class（如 `.chat-message-markdown`），在全局或 scoped 中对 `pre`、`code`、`ul`、`ol`、`blockquote`、表格等做样式约束，与现有 `chat-message-text`、圆角、深浅色主题一致（见 `.cursor/rules/frontend-spec.mdc`）。

3. **可访问性**  
   - 渲染块容器保留合理标题层级与 `aria-*`，代码块可考虑 `role="region"` 与 `aria-label`。

4. **仅对助手消息或可配置**  
   - 可先仅对 `role === 'assistant'` 且非流式的内容做 Markdown 渲染；用户消息是否支持 Markdown 可由设置或后续迭代决定。

---

## 五、参考与延伸

- [Why does markdown need to be sanitized? And how to do it in Vue?](https://itnext.io/why-does-markdown-need-to-be-sanitized-and-how-to-do-it-in-vue-390d70cf9574)  
- vue-dompurify-html：<https://github.com/LeSuisse/vue-dompurify-html>  
- DOMPurify：<https://github.com/cure53/DOMPurify>  
- @nuxtjs/mdc 安全公告（base 标签注入）：[GHSA-cj6r-rrr9-fg82](https://github.com/nuxt-modules/mdc/security/advisories/GHSA-cj6r-rrr9-fg82)  
- 项目内聊天 UI 与滚动：`docs/CHAT_UI_BEST_PRACTICES.md`、`docs/CHAT_SCROLL_IMPROVEMENTS.md`  
- 前端规范：`.cursor/rules/frontend-spec.mdc`、`docs/FRONTEND_SPEC.md`
