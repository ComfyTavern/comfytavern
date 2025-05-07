import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // 启用基于类的暗色模式
  theme: {
    extend: {},
  },
  plugins: [daisyui],
  // Optional: Add DaisyUI configuration here if needed
  daisyui: {
    // themes: [], // Example: specify themes
    // darkTheme: "dark", // Example: set default dark theme
    // base: true, // Example: applies background color and foreground color for root element by default
    // styled: true, // Example: include daisyUI colors and design decisions for all components
    // utils: true, // Example: adds responsive and modifier utility classes
    // prefix: "", // Example: prefix for daisyUI classnames (components, modifiers and responsive class names. Not colors)
    // logs: true, // Example: Shows info about daisyUI version and used config in the console when building your CSS
  },
}