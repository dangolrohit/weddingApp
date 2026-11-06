/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Cinzel', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fbf9f6',
          100: '#f6f1ec',
          200: '#ede1d5',
          300: '#e0ccb8',
          400: '#cca98a',
          500: '#b88961',
          600: '#a3714c',
          700: '#875a3e',
          800: '#6f4a35',
          900: '#5a3d2e',
        }
      }
    },
  },
  plugins: [],
}

