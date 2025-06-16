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
      colors: { // 颜色定义使用新的 HSL 通道变量和 <alpha-value>
        'primary': 'hsl(var(--ct-primary-hsl) / <alpha-value>)',
        'secondary': 'hsl(var(--ct-secondary-hsl) / <alpha-value>)',
        'accent': 'hsl(var(--ct-accent-hsl) / <alpha-value>)',
        'background-base': 'hsl(var(--ct-background-base-hsl) / var(--ct-background-base-opacity))',
        'background-surface': 'hsl(var(--ct-background-surface-hsl) / <alpha-value>)',
        'text-base': 'hsl(var(--ct-text-base-hsl) / <alpha-value>)',
        'text-secondary': 'hsl(var(--ct-text-secondary-hsl) / <alpha-value>)',
        'text-muted': 'hsl(var(--ct-text-muted-hsl) / <alpha-value>)',
        'border-base': 'hsl(var(--ct-border-base-hsl) / <alpha-value>)',
        'backdrop': 'hsl(var(--ct-backdrop-bg-hsl) / <alpha-value>)', // 新增 backdrop 颜色
        
        // 新增的变体，使用 primary 的 HSL 值，但固定 alpha
        'primary-soft': 'hsl(var(--ct-primary-hsl) / 0.3)', // 例如 30% 透明度
        'primary-softest': 'hsl(var(--ct-primary-hsl) / 0.15)', // 例如 15% 透明度

        'secondary-soft': 'hsl(var(--ct-secondary-hsl) / 0.3)',
        'secondary-softest': 'hsl(var(--ct-secondary-hsl) / 0.15)',

        'accent-soft': 'hsl(var(--ct-accent-hsl) / 0.3)',
        'accent-softest': 'hsl(var(--ct-accent-hsl) / 0.15)',
            
        // 状态颜色
        'info': 'hsl(var(--ct-info-hsl) / <alpha-value>)',
        'info-soft': 'hsl(var(--ct-info-hsl) / 0.3)',
        'info-softest': 'hsl(var(--ct-info-hsl) / 0.15)',
        'success': 'hsl(var(--ct-success-hsl) / <alpha-value>)',
        'success-soft': 'hsl(var(--ct-success-hsl) / 0.3)',
        'success-softest': 'hsl(var(--ct-success-hsl) / 0.15)',
        'warning': 'hsl(var(--ct-warning-hsl) / <alpha-value>)',
        'warning-soft': 'hsl(var(--ct-warning-hsl) / 0.3)',
        'warning-softest': 'hsl(var(--ct-warning-hsl) / 0.15)',
        'error': 'hsl(var(--ct-error-hsl) / <alpha-value>)',
        'error-soft': 'hsl(var(--ct-error-hsl) / 0.3)',
        'error-softest': 'hsl(var(--ct-error-hsl) / 0.15)',
        'neutral': 'hsl(var(--ct-neutral-hsl) / <alpha-value>)',
        'neutral-soft': 'hsl(var(--ct-neutral-hsl) / 0.3)',
        'neutral-softest': 'hsl(var(--ct-neutral-hsl) / 0.15)',
        'primary-content': 'hsl(var(--ct-primary-content-hsl) / <alpha-value>)',
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [ // 定义 DaisyUI 使用的“桥接”主题
      {
        mytheme_light: { // 对应我们的亮色模式, 固定 alpha 为 1
          "primary": "hsl(var(--ct-primary-hsl) / 1)",
          "secondary": "hsl(var(--ct-secondary-hsl) / 1)",
          "accent": "hsl(var(--ct-accent-hsl) / 1)",
          "neutral": "hsl(var(--ct-neutral-hsl) / 1)",
          "base-100": "hsl(var(--ct-background-base-hsl) / var(--ct-background-base-opacity))",
          "base-200": "hsl(var(--ct-background-surface-hsl) / 1)",
          "info": "hsl(var(--ct-info-hsl) / 1)",
          "success": "hsl(var(--ct-success-hsl) / 1)",
          "warning": "hsl(var(--ct-warning-hsl) / 1)",
          "error": "hsl(var(--ct-error-hsl) / 1)",
          "primary-content": "hsl(var(--ct-primary-content-hsl) / 1)",
          // 如果需要 DaisyUI 的颜色亮度变体 (e.g., primary-focus),
          // 可以在此也用 CSS 变量定义它们，或者在 theme-variables.css 中定义这些派生变量
          // 例如: "primary-focus": "var(--ct-primary-focus)",
        },
        mytheme_dark: { // 对应我们的暗色模式, 固定 alpha 为 1
          "primary": "hsl(var(--ct-primary-hsl) / 1)",
          "secondary": "hsl(var(--ct-secondary-hsl) / 1)",
          "accent": "hsl(var(--ct-accent-hsl) / 1)",
          "neutral": "hsl(var(--ct-neutral-hsl) / 1)",
          "base-100": "hsl(var(--ct-background-base-hsl) / var(--ct-background-base-opacity))",
          "base-200": "hsl(var(--ct-background-surface-hsl) / 1)",
          "info": "hsl(var(--ct-info-hsl) / 1)",
          "success": "hsl(var(--ct-success-hsl) / 1)",
          "warning": "hsl(var(--ct-warning-hsl) / 1)",
          "error": "hsl(var(--ct-error-hsl) / 1)",
          "primary-content": "hsl(var(--ct-primary-content-hsl) / 1)",
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