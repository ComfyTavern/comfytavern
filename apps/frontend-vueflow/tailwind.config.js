import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  darkMode: "class", // 确保 darkMode 设置为 'class'
  theme: {
    extend: {
      fontSize: {
        // 保留现有的 fontSize 扩展
        xxs: ["0.65rem", { lineHeight: "0.85rem" }],
      },
      boxShadow: {
        // 'upward': '0 -2px 10px 0 hsl(var(--ct-upward-shadow-color-hsl) / var(--ct-upward-shadow-opacity))', // 已移除
      },
      colors: {
        // 颜色定义使用新的 HSL 通道变量和 <alpha-value>
        primary: "hsl(var(--ct-primary-hsl) / <alpha-value>)",
        secondary: "hsl(var(--ct-secondary-hsl) / <alpha-value>)",
        accent: "hsl(var(--ct-accent-hsl) / <alpha-value>)",
        "background-base": "hsl(var(--ct-background-base-hsl) / var(--ct-background-base-opacity))",
        "background-surface": "hsl(var(--ct-background-surface-hsl) / <alpha-value>)",
        "text-base": "hsl(var(--ct-text-base-hsl) / <alpha-value>)",
        "text-secondary": "hsl(var(--ct-text-secondary-hsl) / <alpha-value>)",
        "text-muted": "hsl(var(--ct-text-muted-hsl) / <alpha-value>)",
        "border-base": "hsl(var(--ct-border-base-hsl) / <alpha-value>)",
        backdrop: "hsl(var(--ct-backdrop-bg-hsl) / <alpha-value>)", // 新增 backdrop 颜色

        // 新增的变体，使用 primary 的 HSL 值，但固定 alpha
        "primary-soft": "hsl(var(--ct-primary-hsl) / 0.3)", // 例如 30% 透明度
        "primary-softest": "hsl(var(--ct-primary-hsl) / 0.15)", // 例如 15% 透明度

        "secondary-soft": "hsl(var(--ct-secondary-hsl) / 0.3)",
        "secondary-softest": "hsl(var(--ct-secondary-hsl) / 0.15)",

        "accent-soft": "hsl(var(--ct-accent-hsl) / 0.3)",
        "accent-softest": "hsl(var(--ct-accent-hsl) / 0.15)",

        "background-surface-soft": "hsl(var(--ct-background-surface-hsl) / 0.5)",
        "background-surface-softest": "hsl(var(--ct-background-surface-hsl) / 0.25)",

        "text-secondary-soft": "hsl(var(--ct-text-secondary-hsl) / 0.3)",
        "text-secondary-softest": "hsl(var(--ct-text-secondary-hsl) / 0.15)",

        "text-muted-soft": "hsl(var(--ct-text-muted-hsl) / 0.3)",
        "text-muted-softest": "hsl(var(--ct-text-muted-hsl) / 0.15)",

        "border-base-soft": "hsl(var(--ct-border-base-hsl) / 0.3)",
        "border-base-softest": "hsl(var(--ct-border-base-hsl) / 0.15)",

        // 状态颜色
        info: "hsl(var(--ct-info-hsl) / <alpha-value>)",
        "info-soft": "hsl(var(--ct-info-hsl) / 0.3)",
        "info-softest": "hsl(var(--ct-info-hsl) / 0.15)",
        success: "hsl(var(--ct-success-hsl) / <alpha-value>)",
        "success-soft": "hsl(var(--ct-success-hsl) / 0.3)",
        "success-softest": "hsl(var(--ct-success-hsl) / 0.15)",
        warning: "hsl(var(--ct-warning-hsl) / <alpha-value>)",
        "warning-soft": "hsl(var(--ct-warning-hsl) / 0.3)",
        "warning-softest": "hsl(var(--ct-warning-hsl) / 0.15)",
        error: "hsl(var(--ct-error-hsl) / <alpha-value>)",
        "error-soft": "hsl(var(--ct-error-hsl) / 0.3)",
        "error-softest": "hsl(var(--ct-error-hsl) / 0.15)",
        neutral: "hsl(var(--ct-neutral-hsl) / <alpha-value>)",
        "neutral-soft": "hsl(var(--ct-neutral-hsl) / 0.3)",
        "neutral-softest": "hsl(var(--ct-neutral-hsl) / 0.15)",
        "primary-content": "hsl(var(--ct-primary-content-hsl) / <alpha-value>)",
        "secondary-content": "hsl(var(--ct-secondary-content-hsl) / <alpha-value>)",
        "accent-content": "hsl(var(--ct-accent-content-hsl) / <alpha-value>)",
        "neutral-content": "hsl(var(--ct-neutral-content-hsl) / <alpha-value>)",
        "info-content": "hsl(var(--ct-info-content-hsl) / <alpha-value>)",
        "success-content": "hsl(var(--ct-success-content-hsl) / <alpha-value>)",
        "warning-content": "hsl(var(--ct-warning-content-hsl) / <alpha-value>)",
        "error-content": "hsl(var(--ct-error-content-hsl) / <alpha-value>)",
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: ["light", "dark"], // 我们将使用标准的 light 和 dark 主题，并通过 CSS 变量覆盖它们。
    darkTheme: "dark", // 指定 DaisyUI 默认使用的暗色主题名称
    base: true, // 应用基础样式 (默认 true)
    styled: true, // 应用 DaisyUI 组件样式 (默认 true)
    utils: true, // 添加 DaisyUI 工具类 (默认 true)
    logs: true, // 在控制台显示 DaisyUI 版本和配置信息，方便调试
    oklch: false, // 核心修复：禁用 oklch，强制 daisyui 使用 hsl()，以便我们的 HSL 变量能正确覆盖。
  },
};
