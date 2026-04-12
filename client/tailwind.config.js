/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Palette custom — remplace le slate/blue générique
        surface: {
          DEFAULT: '#f4f5f7',   // light bg
          50:  '#f9f9fb',
          100: '#f4f5f7',
          200: '#e8eaef',
          300: '#d1d4dc',
          400: '#727991',
          500: '#6b7186',
          600: '#4a4f63',
          700: '#2d3348',
          800: '#1c2137',
          900: '#141827',
          950: '#0c0f1a',
        },
        accent: {
          DEFAULT: '#d4a24e',   // gold
          light: '#e8c171',
          dark: '#b8872f',
        },
        gold: {
          DEFAULT: '#d4a24e',
          light: '#e8c171',
          dark: '#b8872f',
          muted: 'rgba(212, 162, 78, 0.15)',
        },
        result: {
          exact: '#34c770',
          good: '#d4a24e',
          miss: '#e8564a',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
