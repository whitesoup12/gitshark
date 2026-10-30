/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        shark: {
          950: "rgb(var(--shark-950) / <alpha-value>)",
          900: "rgb(var(--shark-900) / <alpha-value>)",
          850: "rgb(var(--shark-850) / <alpha-value>)",
          800: "rgb(var(--shark-800) / <alpha-value>)",
          750: "rgb(var(--shark-750) / <alpha-value>)",
          700: "rgb(var(--shark-700) / <alpha-value>)",
          650: "rgb(var(--shark-650) / <alpha-value>)",
          600: "rgb(var(--shark-600) / <alpha-value>)",
          500: "rgb(var(--shark-500) / <alpha-value>)",
          400: "rgb(var(--shark-400) / <alpha-value>)",
          300: "rgb(var(--shark-300) / <alpha-value>)",
          200: "rgb(var(--shark-200) / <alpha-value>)",
          100: "rgb(var(--shark-100) / <alpha-value>)",
          50: "rgb(var(--shark-50) / <alpha-value>)",
          accent: "rgb(var(--shark-accent) / <alpha-value>)",
          "accent-hover": "rgb(var(--shark-accent-hover) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
}
