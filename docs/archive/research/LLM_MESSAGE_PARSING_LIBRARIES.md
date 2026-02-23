# 大模型消息解析通用开源库调研

用于解析大模型消息（流式/非流式、思考块、工具调用、正文）的通用开源库选型，避免自造轮子。调研时间：2026-02。

---

## 1. TokenLoom（推荐：流式 + 自定义标签）

- **仓库**: [alaa-eddine/tokenloom](https://github.com/alaa-eddine/tokenloom)
- **npm**: `tokenloom`
- **协议**: MIT
- **语言**: TypeScript/JavaScript，Node 18+，含浏览器构建

**能力**：

- **流式优先**：为「任意 chunk 边界」设计，标签或代码块被拆成多段也能渐进解析。
- **自定义标签**：配置 `tags: ["think", "plan"]` 等，识别 `<think>...</think>` 类非嵌套块（v1 不支持嵌套）。
- **代码块**：识别 \`\`\` / ~~~ 围栏及语言标识。
- **纯文本**：按 token/word/grapheme 输出，可配置 `EmitUnit`。
- **事件**：`text`、`tag-open`、`tag-close`、`code-fence-start`、`code-fence-chunk`、`code-fence-end`、`flush`、`end`、`buffer-released`。
- **插件**：preTransform / transform / postTransform，可做高亮、统计等。
- **背压**：高水位、`flush()`、缓冲释放事件。

**与当前需求契合度**：  
若重写「从 Dify 流 → 正文/思考分离」时，希望用**通用流式解析器**处理 `<think>...</think>` 等标签，TokenLoom 可直接接在 `extractText` 后的字符流上，用 `tags: ["think"]` 得到思考与正文两路事件，无需自写状态机。v1 不支持嵌套标签，若模型产出嵌套需预处理或等其后续版本。

**示例**（README 摘录）：

```ts
import { TokenLoom, EmitUnit } from "tokenloom";

const parser = new TokenLoom({
  tags: ["think"],
  emitUnit: EmitUnit.Word,
  emitDelay: 50,
});
parser.on("text", (e) => process.stdout.write(e.text));
parser.on("tag-open", (e) => console.log(`[${e.name}]`));
parser.on("tag-close", () => console.log("[/think]"));
for (const chunk of streamChunks) parser.feed({ text: chunk });
await parser.flush();
```

---

## 2. llm-exe（结构化输出 + 校验）

- **站点/文档**: [llm-exe.com - Parser](https://llm-exe.com/parser)
- **语言**: TypeScript

**能力**：

- 将 LLM **完整字符串输出**解析为结构化、带类型的数据。
- 内置解析器：listToArray、listToJson、stringExtract、JSON、regex、markdown 块等。
- Schema 校验、默认值、TypeScript 类型推断。
- 支持多 Provider（OpenAI、Anthropic 等），与 executor 组合使用。

**与当前需求契合度**：  
更适合「整段回复已就绪后的结构化解析」（如从回复中抽 JSON、列表、枚举），而不是「边收流边拆 thinking/answer」。若将来做「最终回答结构化抽取」可考虑；流式正文/思考分离仍建议用 TokenLoom 或自维护轻量解析。

---

## 3. LangChain.js（工具调用 + 消息转换）

- **文档**: [LangChain JS](https://js.langchain.com)、[convertResponsesMessageToAIMessage](https://reference.langchain.com/javascript/variables/_langchain_openai.convertResponsesMessageToAIMessage.html) 等

**能力**：

- 将 OpenAI 等 API 的 **chat completion / Responses API** 转为 LangChain 的 `AIMessage`。
- 工具调用解析：`parseToolCall()`、无效调用放入 `invalid_tool_calls`。
- 支持 reasoning traces、function calls 等。
- 另有 XML / Structured 等 output parser（偏「完整输出 → 结构」）。

**与当前需求契合度**：  
若整条技术栈已用 LangChain，可复用其消息与 tool call 解析；否则引入较重。流式「正文 vs 思考」拆分并非其主场景，需在应用层用 TokenLoom 或自定义逻辑配合。

---

## 4. Vercel AI SDK

- **文档**: [AI SDK - streamText](https://sdk.vercel.ai/docs/reference/ai-sdk-core/stream-text)、[Streaming](https://sdk.vercel.ai/docs/foundations/streaming)

**能力**：

- `streamText()`：从模型拉流并暴露 `textStream` 等。
- 流式 UI、StreamingTextResponse、与 React 等集成。
- 不提供「从已有 SSE 流中解析 <think>/正文」的通用解析器。

**与当前需求契合度**：  
适合「自己调模型并直接流式展示」的前端/全栈方案；当前中间层是转发 Dify SSE，需要的是「对已收到文本流的解析」，Vercel AI SDK 不覆盖此场景。

---

## 5. 小结与建议

| 场景 | 推荐 |
|------|------|
| **流式正文 + 思考块分离**（如 `<think>...</think>`） | **TokenLoom**：流式友好、可配置标签、事件清晰，可直接接在现有 `extractText` 下游。 |
| **完整回复的结构化抽取**（JSON/列表/枚举） | **llm-exe** 或 LangChain output parser。 |
| **已用 LangChain 且需统一消息/工具调用格式** | **LangChain.js** 消息与 tool call 解析。 |
| **自建流式解析** | 当前仓库内 `thinkingParser` + `streamParser` 已保留但未接入；重写时可二选一：接入 **TokenLoom** 或在此基础上做最小状态机（仅 <think> 与正文）。 |

**采用情况**：已采用。API 层 `apps/api/src/lib/tokenloomStreamAdapter.ts` 使用 TokenLoom 解析 <think>/正文，`difyStream` 在 extractText 下游喂入并下发 thinking + message 事件；前端恢复思考区展示。

**建议**：重写「AI 助手消息内容」链路时，优先评估 **TokenLoom**：npm 安装即用、API 简单、与现有「只下发 message delta」的中间层兼容（在中间层或前端对 delta 做 `parser.feed({ text: delta })`，按 `text` / `tag-open` / `tag-close` 分流即可）。
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
Read