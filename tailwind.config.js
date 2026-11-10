/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        madrasa: {
          navy: '#0b192c',
          navyLight: '#1e3e62',
          blue: '#1d4ed8',
          gold: '#d97706',
          goldLight: '#f59e0b',
          surface: '#f8fafc',
          card: '#ffffff'
        }
      },
      fontFamily: {
        bengali: ['"Hind Siliguri"', '"Kalpurush"', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
