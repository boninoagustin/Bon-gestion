/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      colors: {
        'slate-dark': '#18181b', // Zinc 950 (Rich Black) instead of bluish #2c3e50
        'craft': '#fdfbf7',     // Off-white/paper for background
        'copper': '#b87333',     // Copper/Amber for accents
        'copper-dark': '#935c28', // Darker copper for hover
      }
    },
  },
  plugins: [],
}