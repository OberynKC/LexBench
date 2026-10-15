/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f5fa',
          100: '#dce7f2',
          200: '#b9cfe5',
          300: '#8dafd3',
          400: '#5c8abc',
          500: '#3a6da3',
          600: '#2c5687',
          700: '#25466e',
          800: '#1e3a5f',
          900: '#162c49',
          950: '#0f1f33',
        },
        // 偏蓝校准的中性灰阶：页面既有 gray-* 类自动获得统一色相
        gray: {
          50: '#f7f8fa',
          100: '#eff1f4',
          200: '#e3e5ea',
          300: '#cdd1d9',
          400: '#9ba1ad',
          500: '#767c88',
          600: '#5b616c',
          700: '#474c57',
          800: '#2e323a',
          900: '#1e2026',
          950: '#121316',
        },
        // 语义层：引用 src/index.css 中的 CSS 变量，随明暗主题自动切换
        sidebar: 'var(--bg-sidebar)',
        surface: 'var(--bg-surface)',
        field: 'var(--bg-field)',
        hover: 'var(--bg-hover)',
        active: 'var(--bg-active)',
        line: {
          1: 'var(--line-1)',
          2: 'var(--line-2)',
          3: 'var(--line-3)',
        },
        ink: {
          DEFAULT: 'var(--ink-1)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
          4: 'var(--ink-4)',
        },
      },
      // base 仅用于背景，避免 text-base 字号类同时生成背景色文字。
      backgroundColor: {
        base: 'var(--bg-base)',
      },
      borderRadius: {
        // 统一圆角尺度：控件 6px（md）、卡片/面板 8px（lg）、弹层 10px（xl）
        xl: '10px',
      },
      boxShadow: {
        // 阴影只表达浮层关系
        pop: 'var(--shadow-pop)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
