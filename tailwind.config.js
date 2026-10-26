/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './context/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'Outfit', 'Roboto', 'sans-serif'],
        mono: [
          '"JetBrains Mono"',
          '"Roboto Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        // Fondos Pizarra / Carbón Industrial
        'slate-dark': '#121417',
        'craft-dark': '#121417',
        'craft-surface': '#1a1d21',
        'craft-elevated': '#22262b',
        'craft-border': '#2c3138',
        craft: '#f8f6f1',

        // Acentos Bronce / Ámbar Dorado
        copper: {
          DEFAULT: '#d97706',
          light: '#f59e0b',
          dark: '#b45309',
          glow: 'rgba(245, 158, 11, 0.18)',
        },
        'copper-dark': '#b45309',
        'copper-light': '#f59e0b',

        // Semáforos de Estado Industriales
        'status-hop': {
          DEFAULT: '#10b981', // Verde lúpulo (Activo / Limpio / En rango)
          dark: '#059669',
          light: '#34d399',
        },
        'status-alert': {
          DEFAULT: '#ef4444', // Rojo alerta (Crítico / Sin stock / Exotermia)
          dark: '#dc2626',
          light: '#f87171',
        },
        'status-chill': {
          DEFAULT: '#0ea5e9', // Azul enfriamiento (Cold Crash / Glicol / Fermentando)
          dark: '#0284c7',
          light: '#38bdf8',
        },
      },
      minHeight: {
        touch: '44px',
        'touch-lg': '48px',
      },
      minWidth: {
        touch: '44px',
        'touch-lg': '48px',
      },
      boxShadow: {
        industrial:
          '0 4px 20px -2px rgba(0, 0, 0, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.04)',
        'copper-glow': '0 8px 24px -4px rgba(217, 119, 6, 0.35)',
        'hop-glow': '0 8px 24px -4px rgba(16, 185, 129, 0.30)',
        'chill-glow': '0 8px 24px -4px rgba(14, 165, 233, 0.30)',
      },
      backgroundImage: {
        'ferm-gradient':
          'linear-gradient(90deg, #d97706 0%, #f59e0b 55%, #10b981 100%)',
        'chill-gradient':
          'linear-gradient(90deg, #0284c7 0%, #0ea5e9 55%, #38bdf8 100%)',
        'alert-gradient':
          'linear-gradient(90deg, #dc2626 0%, #ef4444 60%, #f59e0b 100%)',
      },
       keyframes: {
        'progress-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.78' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        'progress-pulse': 'progress-pulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'float-slow 3.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};