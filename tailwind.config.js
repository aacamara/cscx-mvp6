/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // CSCX Brand Colors (based on casadvisory.ca palette)
        cscx: {
          // Primary backgrounds
          black: '#000000',
          white: '#ffffff',

          // Alt backgrounds
          'bg-alt': '#0a0a0a',
          'bg-alt-light': '#f8f8f8',

          // Accent - the signature red
          accent: '#e63946',

          // Gray scale
          gray: {
            50: '#f8f8f8',
            100: '#e5e5e5',
            200: '#cccccc',
            300: '#999999',
            400: '#666666',
            500: '#555555',
            600: '#444444',
            700: '#333333',
            800: '#222222',
            900: '#0a0a0a',
          },

          // Semantic colors (keeping some for status indicators)
          cyan: '#00d4ff',
          success: '#22c55e',
          warning: '#eab308',
          error: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Roboto Mono', 'monospace'],
      },
      boxShadow: {
        'accent-glow': '0 0 20px rgba(230, 57, 70, 0.4)',
        'accent-glow-lg': '0 0 40px rgba(230, 57, 70, 0.3)',
        'soft': '0 4px 20px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'fadeIn': 'fadeIn 0.5s ease-out',
        'slideUp': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
