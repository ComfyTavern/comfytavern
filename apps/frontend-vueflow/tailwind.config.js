import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // 确保 darkMode 设置为 'class'
  theme: {
    extend: {
      fontSize: { // 保留现有的 fontSize 扩展
        'xxs': ['0.65rem', { lineHeight: '0.85rem' }],
      },
      colors: { // 新增或覆盖颜色定义以使用 CSS 变量
        'primary': 'var(--ct-primary)',
        'secondary': 'var(--ct-secondary)',
        'accent': 'var(--ct-accent)',
        'background-base': 'var(--ct-background-base)',
        'background-surface': 'var(--ct-background-surface)',
        'text-base': 'var(--ct-text-base)',
        'text-muted': 'var(--ct-text-muted)',
        'border-base': 'var(--ct-border-base)',
        
        // 状态颜色，与 theme-variables.css 和主题 JSON 中的定义对应
        // 提供回退值是个好习惯，尽管我们的系统应该总能提供这些变量
        'info': 'var(--ct-info, var(--ct-primary))',
        'success': 'var(--ct-success, #28a745)',
        'warning': 'var(--ct-warning, #ffc107)',
        'error': 'var(--ct-error, #dc3545)',
        'neutral': 'var(--ct-neutral, var(--ct-text-base))',
        'primary-content': 'var(--ct-primary-content)', // 新增 primary-content
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [ // 定义 DaisyUI 使用的“桥接”主题
      {
        mytheme_light: { // 对应我们的亮色模式
          "primary": "var(--ct-primary)",
          "secondary": "var(--ct-secondary)",
          "accent": "var(--ct-accent)",
          "neutral": "var(--ct-neutral)", // 使用我们定义的 --ct-neutral
          "base-100": "var(--ct-background-base)", // DaisyUI 的基础背景
          "base-200": "var(--ct-background-surface)", // DaisyUI 的次级背景
          "info": "var(--ct-info)",
          "success": "var(--ct-success)",
          "warning": "var(--ct-warning)",
          "error": "var(--ct-error)",
          "primary-content": "var(--ct-primary-content)", // 新增
          // 如果需要 DaisyUI 的颜色亮度变体 (e.g., primary-focus),
          // 可以在此也用 CSS 变量定义它们，或者在 theme-variables.css 中定义这些派生变量
          // 例如: "primary-focus": "var(--ct-primary-focus)",
        },
        mytheme_dark: { // 对应我们的暗色模式
          "primary": "var(--ct-primary)",
          "secondary": "var(--ct-secondary)",
          "accent": "var(--ct-accent)",
          "neutral": "var(--ct-neutral)",
          "base-100": "var(--ct-background-base)",
          "base-200": "var(--ct-background-surface)",
          "info": "var(--ct-info)",
          "success": "var(--ct-success)",
          "warning": "var(--ct-warning)",
          "error": "var(--ct-error)",
          "primary-content": "var(--ct-primary-content)", // 新增
          // "primary-focus": "var(--ct-primary-focus)",
        }
      }
    ],
    darkTheme: "mytheme_dark", // 指定 DaisyUI 默认使用的暗色主题名称
    base: true, // 应用基础样式 (默认 true)
    styled: true, // 应用 DaisyUI 组件样式 (默认 true)
    utils: true, // 添加 DaisyUI 工具类 (默认 true)
    logs: true, // 在控制台显示 DaisyUI 版本和配置信息，方便调试
  },
}