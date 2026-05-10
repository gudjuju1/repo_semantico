/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#02161e',
        'dark-card': '#0b232a',
        'dark-border': '#1e3a3f',
        'primary': '#00ed64',
        'text-main': '#e8edeb',
      },
    },
  },
  plugins: [],
}