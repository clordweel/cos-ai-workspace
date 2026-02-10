import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue',
  ],
  theme: {
    extend: {
      screens: {
        /** 最窄档：≤320px，默认仅会话列表，点击会话切聊天 */
        xxs: { max: '320px' },
        /** 语义化断点，与 useBreakpoint 一致 */
        xs: '320px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
      colors: {
        /** 全局主题色（高饱和科技蓝），一处修改即可换肤 */
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      fontFamily: {
        sans: [
          '"HarmonyOS Sans SC"',
          'HarmonyOSHans-Regular',
          'HarmonyOSHans-fallback',
          'PingFangSC-Regular',
          'Microsoft YaHei',
          'Arial',
          'Helvetica',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config
