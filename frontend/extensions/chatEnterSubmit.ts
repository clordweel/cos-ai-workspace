/**
 * TipTap 扩展：聊天输入框 Enter 提交、Shift+Enter 换行。
 * 用于 Nuxt UI Editor，覆盖默认 Enter 行为。
 */
import { Extension } from '@tiptap/core'

export interface ChatEnterSubmitOptions {
  /** 按下 Enter（未按 Shift）时调用，应触发提交并返回 true 以阻止默认换行 */
  onSubmit: () => void
}

export const ChatEnterSubmit = Extension.create<ChatEnterSubmitOptions>({
  name: 'chatEnterSubmit',

  addOptions() {
    return {
      onSubmit: () => {},
    }
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        this.options.onSubmit()
        return true
      },
      'Shift-Enter': () => this.editor.chain().focus().setHardBreak().run(),
    }
  },
})
