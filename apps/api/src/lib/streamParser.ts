/**
 * 流式格式解析器：接收数据流后进行结构化数据处理
 * 累积原始文本，按块调用 splitThinkingAndAnswer，对外提供增量 thinking/answer 与最终结果
 */
import { splitThinkingAndAnswer, type ThinkingAndAnswer } from './thinkingParser.js';

export interface StreamParserSnapshot {
  thinking: string;
  answer: string;
  thinkingDelta: string;
  answerDelta: string;
}

/**
 * 流式解析器：append(chunk) 后可通过 getSnapshot() 取当前 thinking/answer 及自上次以来的增量
 */
export class StreamParser {
  private accumulated = '';
  private prevThinkingLen = 0;
  private prevAnswerLen = 0;

  append(chunk: string): void {
    if (typeof chunk !== 'string') return;
    this.accumulated += chunk;
  }

  /** 用 Dify 返回的完整 answer 替换累积（Agent 等可能一次下发整段） */
  replaceFull(fullText: string): void {
    if (typeof fullText === 'string' && fullText.length > this.accumulated.length) {
      this.accumulated = fullText;
    }
  }

  /**
   * 获取当前解析快照：thinking / answer 全文，以及自上次 getSnapshot 以来的增量
   */
  getSnapshot(): StreamParserSnapshot {
    const { thinking, answer } = splitThinkingAndAnswer(this.accumulated);
    const thinkingDelta = thinking.slice(this.prevThinkingLen);
    const answerDelta = answer.slice(this.prevAnswerLen);
    this.prevThinkingLen = thinking.length;
    this.prevAnswerLen = answer.length;
    return { thinking, answer, thinkingDelta, answerDelta };
  }

  /**
   * 流结束时的最终结果（含恢复逻辑后的 thinking/answer）
   */
  getResult(): ThinkingAndAnswer {
    return splitThinkingAndAnswer(this.accumulated);
  }

  /** 当前累积原文长度，便于调试 */
  getAccumulatedLength(): number {
    return this.accumulated.length;
  }
}
