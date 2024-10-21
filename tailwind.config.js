/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#42a5f5',
          DEFAULT: '#1976d2',
          dark: '#1565c0',
        },
        secondary: {
          light: '#ba68c8',
          DEFAULT: '#9c27b0',
          dark: '#7b1fa2',
        },
        background: {
          light: '#f5f5f7',
          DEFAULT: '#ffffff',
          dark: '#e5e5e5',
        },
      },
      fontFamily: {
        sans: ['SF Pro Text', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
      },
      boxShadow: {
        'apple': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}
