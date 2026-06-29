/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        f1: {
          pink: {
            50:  '#FFE5F4',
            100: '#FFCCE9',
            200: '#FF99D3',
            300: '#FF66BE',
            400: '#FF40A0',
            500: '#E6007E',
            600: '#B3005F',
            700: '#8C004A',
            800: '#660036',
            900: '#4D0028',
            950: '#33001A',
          },
          neutral: {
            50:  '#FAFAFA',
            100: '#F0F0F0',
            200: '#D4D4D4',
            300: '#AAAAAA',
            400: '#777777',
            500: '#555555',
            600: '#3A3A3A',
            700: '#2A2A2A',
            800: '#1E1E1E',
            850: '#141414',
            900: '#0E0E0E',
            950: '#080808',
          },
          white: '#FFFFFF',
          gray:  '#555555',
          // Team colors kept
          mercedes: '#00D2BE',
          ferrari:  '#DC0000',
          redbull:  '#0600EF',
          mclaren:  '#FF8700',
          orange:   '#FF8700',
        }
      },
      fontFamily: {
        'sans': ['Saira', 'Arial', 'sans-serif'],
        'f1':   ['"Formula1"', 'Saira', 'Arial', 'sans-serif'],
        'mono': ['"Courier New"', 'Courier', 'monospace'],
      },
      fontSize: {
        'display-xl':  ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-2xl': ['4.5rem', { lineHeight: '1',   letterSpacing: '-0.02em' }],
        'body-compact': ['0.875rem', { lineHeight: '1.25' }],
      },
      boxShadow: {
        'f1-glow':    '0 0 20px rgba(230, 0, 126, 0.5)',
        'f1-glow-lg': '0 0 40px rgba(230, 0, 126, 0.6)',
        'card':       '0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -1px rgba(0,0,0,0.4)',
        'card-hover': '0 10px 15px -3px rgba(0,0,0,0.6), 0 4px 6px -2px rgba(0,0,0,0.5)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      animation: {
        'pulse-pink': 'pulse-pink 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-pink': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(230, 0, 126, 0.4)' },
          '50%':      { boxShadow: '0 0 40px rgba(230, 0, 126, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}
