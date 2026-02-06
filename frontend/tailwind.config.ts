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
