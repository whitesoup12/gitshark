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
          950: "#090d16",
          900: "#0f172a",
          850: "#141e34",
          800: "#1e293b",
          750: "#27354d",
          700: "#334155",
          600: "#475569",
          500: "#64748b",
          accent: "#0ea5e9", // cyan/ocean accent
          "accent-hover": "#0284c7",
        },
      },
    },
  },
  plugins: [],
}
