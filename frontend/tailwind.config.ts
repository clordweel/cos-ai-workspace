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
      colors: {
        /** 全局主题色（科技蓝），一处修改即可换肤 */
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
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
